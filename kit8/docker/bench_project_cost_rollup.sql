-- Roll-up benchmark behind documentation/UPDATE_PROJECT_COST.html (section 5): how to sum the cost of a task tree into its stages.
-- Throw-away database of the local Postgres (cd kit8/docker && docker compose up -d), synthetic data: 11 220 tasks (depth 5), 180 000 turnover rows.
--   docker exec -i universal1-pgtest psql -U postgres -d postgres -q -c "drop database if exists costbench with (force)" -c "create database costbench"
--   docker exec -i universal1-pgtest psql -U postgres -d costbench -q < kit8/docker/bench_project_cost_rollup.sql | grep -E "===|Execution Time|wrong"
--   docker exec -i universal1-pgtest psql -U postgres -d postgres -q -c "drop database costbench with (force)"
-- Part 1 compares the ways that join or scan the subtree (the ones that lost); part 2 is the winner: the stage GUIDs are read from the labels of the path.
\set ON_ERROR_STOP on
\timing on
CREATE EXTENSION IF NOT EXISTS ltree;
DROP TABLE IF EXISTS cost, turnover, tk;
CREATE TABLE tk (guid uuid PRIMARY KEY, path ltree NOT NULL UNIQUE, project uuid NOT NULL, kind text NOT NULL);
CREATE INDEX tk_gist ON tk USING gist(path);
CREATE TABLE turnover (task uuid NOT NULL, genus text NOT NULL, month date NOT NULL, plan numeric NOT NULL, PRIMARY KEY (task, genus, month));
CREATE TABLE cost (task uuid PRIMARY KEY, project uuid NOT NULL, own numeric NOT NULL DEFAULT 0, total numeric NOT NULL DEFAULT 0);

-- tree: 20 stages -> 10 -> 5 -> 10 leaves  (11 220 rows, depth 5)
DO $$
DECLARE p uuid := '00000000-0000-0000-0000-000000000001'; root ltree := 'p1';
BEGIN
  INSERT INTO tk SELECT gen_random_uuid(), (root::text || '.a' || a)::ltree, p, 'stage' FROM generate_series(1,20) a;
  INSERT INTO tk SELECT gen_random_uuid(), (t.path::text || '.b' || b)::ltree, p, 'stage' FROM tk t, generate_series(1,10) b WHERE nlevel(t.path)=2;
  INSERT INTO tk SELECT gen_random_uuid(), (t.path::text || '.c' || c)::ltree, p, 'stage' FROM tk t, generate_series(1,5) c WHERE nlevel(t.path)=3;
  INSERT INTO tk SELECT gen_random_uuid(), (t.path::text || '.d' || d)::ltree, p, 'task'  FROM tk t, generate_series(1,10) d WHERE nlevel(t.path)=4;
END $$;
INSERT INTO turnover SELECT t.guid, g, ('2026-01-01'::date + (m*31))::date, (random()*1000)::numeric(18,2)
  FROM tk t, unnest(ARRAY['timeGenus','materialGenus','expenseGenus']) g, generate_series(0,5) m WHERE t.kind='task';
INSERT INTO cost SELECT guid, project, 0, 0 FROM tk;
ANALYZE;
SELECT (SELECT count(*) FROM tk) tasks, (SELECT count(*) FROM turnover) turnover_rows;

-- full build (what the button / first run does): own from turnover, totals by prefix unnest
\echo === FULL BUILD of a project (11 220 tasks, 180 000 turnover rows)
BEGIN;
UPDATE cost c SET own = o.s FROM (SELECT task, sum(plan) s FROM turnover GROUP BY task) o WHERE o.task = c.task;
UPDATE cost c SET total = x.s
  FROM (SELECT t.guid, sum(c2.own) s FROM (SELECT t2.path, c3.own FROM cost c3 JOIN tk t2 ON t2.guid=c3.task WHERE c3.own<>0) c2
        CROSS JOIN LATERAL generate_series(1, nlevel(c2.path)) k
        JOIN tk t ON t.path = subpath(c2.path, 0, k) GROUP BY t.guid) x WHERE x.guid = c.task;
COMMIT;

-- batch of 500 changed leaves
CREATE TEMP TABLE batch AS SELECT guid AS task FROM tk WHERE kind='task' ORDER BY random() LIMIT 500;
CREATE TEMP TABLE batch1 AS SELECT guid AS task FROM tk WHERE kind='task' ORDER BY random() LIMIT 1;
ANALYZE batch; ANALYZE batch1;

\echo === A. own sum of the batch from the turnover (500 tasks)
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON) SELECT task, sum(plan) FROM turnover WHERE task IN (SELECT task FROM batch) GROUP BY task;

\echo === B1. totals of the affected ancestors, recompute with GiST subtree sum (500 leaf batch)
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
WITH anc AS (SELECT DISTINCT a.guid, a.path FROM batch b JOIN tk l ON l.guid=b.task JOIN tk a ON a.path @> l.path)
SELECT anc.guid, (SELECT sum(c.own) FROM tk d JOIN cost c ON c.task=d.guid WHERE d.path <@ anc.path) FROM anc;

\echo === B2. totals of the affected ancestors, recompute with prefix unnest, subtree read once per ancestor via path range
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
WITH anc AS (SELECT DISTINCT a.guid, a.path FROM batch b JOIN tk l ON l.guid=b.task
             CROSS JOIN LATERAL generate_series(1, nlevel(l.path)) k JOIN tk a ON a.path = subpath(l.path, 0, k))
SELECT anc.guid, (SELECT sum(c.own) FROM tk d JOIN cost c ON c.task=d.guid WHERE d.path <@ anc.path) FROM anc;

\echo === B3. DELTA: add (new own - old own) to the ancestors, 500 leaf batch (UPDATE, rolled back)
BEGIN;
CREATE TEMP TABLE delta AS SELECT b.task, 100::numeric AS d FROM batch b;
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
UPDATE cost c SET total = c.total + x.d
  FROM (SELECT a.guid, sum(dl.d) d FROM delta dl JOIN tk l ON l.guid=dl.task
        CROSS JOIN LATERAL generate_series(1, nlevel(l.path)) k JOIN tk a ON a.path = subpath(l.path, 0, k) GROUP BY a.guid) x
 WHERE c.task = x.guid;
ROLLBACK;

\echo === C. batch of ONE leaf: B2 (recompute ancestors) 
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
WITH anc AS (SELECT DISTINCT a.guid, a.path FROM batch1 b JOIN tk l ON l.guid=b.task
             CROSS JOIN LATERAL generate_series(1, nlevel(l.path)) k JOIN tk a ON a.path = subpath(l.path, 0, k))
SELECT anc.guid, (SELECT sum(c.own) FROM tk d JOIN cost c ON c.task=d.guid WHERE d.path <@ anc.path) FROM anc;

\echo === D. NOT STORED: the whole project totals at read time from the turnover (what a view / on-the-fly RPC would do per refresh)
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
SELECT t.guid, sum(o.s) FROM (SELECT task, sum(plan) s FROM turnover GROUP BY task) o JOIN tk l ON l.guid=o.task
 CROSS JOIN LATERAL generate_series(1, nlevel(l.path)) k JOIN tk t ON t.path = subpath(l.path, 0, k) GROUP BY t.guid;

\echo === E. NOT STORED, one stage subtree (top stage, 560 leaves) from the turnover
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
SELECT sum(o.plan) FROM tk d JOIN turnover o ON o.task = d.guid WHERE d.path <@ 'p1.a1';

\echo === F. READ side: the client reads the stored totals of the project (11 220 rows)
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON) SELECT task, total FROM cost WHERE project='00000000-0000-0000-0000-000000000001';

-- ===== part 2: ancestors from the LABELS of the path (labels are pm_ltree_label(guid) = the guid with '-' replaced by '_') =====
\set ON_ERROR_STOP on
-- tk.path labels here are 'a1.b2' etc.; for the real thing the labels are guid_with_underscores. Emulate: rebuild tk with real labels.
DROP TABLE IF EXISTS cost, tk2;
CREATE TABLE tk2 (guid uuid PRIMARY KEY, path ltree NOT NULL UNIQUE, project uuid NOT NULL, kind text NOT NULL);
DO $$
DECLARE p uuid := '00000000-0000-0000-0000-000000000001'; rl ltree := text2ltree(replace(p::text,'-','_'));
BEGIN
  CREATE TEMP TABLE n1 AS SELECT gen_random_uuid() g, a FROM generate_series(1,20) a;
  INSERT INTO tk2 SELECT g, rl || text2ltree(replace(g::text,'-','_')), p, 'stage' FROM n1;
  CREATE TEMP TABLE n2 AS SELECT gen_random_uuid() g, t.guid pg, t.path pp FROM tk2 t, generate_series(1,10) b;
  INSERT INTO tk2 SELECT g, pp || text2ltree(replace(g::text,'-','_')), p, 'stage' FROM n2;
  CREATE TEMP TABLE n3 AS SELECT gen_random_uuid() g, t.path pp FROM tk2 t, generate_series(1,5) c WHERE nlevel(t.path)=3;
  INSERT INTO tk2 SELECT g, pp || text2ltree(replace(g::text,'-','_')), p, 'stage' FROM n3;
  CREATE TEMP TABLE n4 AS SELECT gen_random_uuid() g, t.path pp FROM tk2 t, generate_series(1,10) d WHERE nlevel(t.path)=4;
  INSERT INTO tk2 SELECT g, pp || text2ltree(replace(g::text,'-','_')), p, 'task' FROM n4;
END $$;
CREATE TABLE cost (task uuid PRIMARY KEY REFERENCES tk2(guid) ON DELETE CASCADE, project uuid NOT NULL, own numeric NOT NULL DEFAULT 0, total numeric NOT NULL DEFAULT 0);
INSERT INTO cost SELECT guid, project, CASE WHEN kind='task' THEN (random()*3000)::numeric(18,2) ELSE 0 END, 0 FROM tk2;
ANALYZE tk2; ANALYZE cost;
select count(*) tasks from tk2;

\timing on
\echo === G. project totals by LABEL unnest, one hash aggregate, read-only (11 220 tasks)
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
SELECT replace(lbl,'_','-')::uuid AS anc, sum(c.own)
  FROM cost c JOIN tk2 t ON t.guid = c.task
 CROSS JOIN LATERAL unnest(string_to_array(ltree2text(subpath(t.path,1)), '.')) AS lbl
 WHERE c.project='00000000-0000-0000-0000-000000000001' AND c.own <> 0
 GROUP BY 1;

\echo === H. same, and write ONLY changed totals (first run: all 10 000+ change)
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
WITH f AS (SELECT replace(lbl,'_','-')::uuid AS anc, sum(c.own) s
  FROM cost c JOIN tk2 t ON t.guid = c.task
 CROSS JOIN LATERAL unnest(string_to_array(ltree2text(subpath(t.path,1)), '.')) AS lbl
 WHERE c.project='00000000-0000-0000-0000-000000000001' AND c.own <> 0 GROUP BY 1)
UPDATE cost c SET total = f.s FROM f WHERE c.task = f.anc AND c.total IS DISTINCT FROM f.s;
UPDATE cost c SET total = f.s FROM (SELECT replace(lbl,'_','-')::uuid AS anc, sum(c.own) s FROM cost c JOIN tk2 t ON t.guid=c.task CROSS JOIN LATERAL unnest(string_to_array(ltree2text(subpath(t.path,1)), '.')) AS lbl WHERE c.own<>0 GROUP BY 1) f WHERE c.task=f.anc;

\echo === I. steady state: ONE leaf changed -> re-run totals, nothing else changes except 5 rows
UPDATE cost SET own = own + 10 WHERE task = (SELECT guid FROM tk2 WHERE kind='task' LIMIT 1);
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
WITH f AS (SELECT replace(lbl,'_','-')::uuid AS anc, sum(c.own) s
  FROM cost c JOIN tk2 t ON t.guid = c.task
 CROSS JOIN LATERAL unnest(string_to_array(ltree2text(subpath(t.path,1)), '.')) AS lbl
 WHERE c.project='00000000-0000-0000-0000-000000000001' AND c.own <> 0 GROUP BY 1)
UPDATE cost c SET total = f.s FROM f WHERE c.task = f.anc AND c.total IS DISTINCT FROM f.s;

\echo === J. DELTA on labels, 500-leaf batch, no join to tk2 for the ancestors (only the batch leaves are joined)
DROP TABLE IF EXISTS batch;
BEGIN;
CREATE TEMP TABLE batch AS SELECT guid AS task FROM tk2 WHERE kind='task' ORDER BY random() LIMIT 500;
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
UPDATE cost c SET total = c.total + x.d
  FROM (SELECT replace(lbl,'_','-')::uuid anc, 100::numeric * count(*) d FROM batch b JOIN tk2 t ON t.guid=b.task
        CROSS JOIN LATERAL unnest(string_to_array(ltree2text(subpath(t.path,1)), '.')) lbl GROUP BY 1) x WHERE c.task = x.anc;
ROLLBACK;

\echo === K. DELTA, ONE leaf
BEGIN;
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF, SUMMARY ON)
UPDATE cost c SET total = c.total + x.d
  FROM (SELECT replace(lbl,'_','-')::uuid anc, 100::numeric d FROM tk2 t
        CROSS JOIN LATERAL unnest(string_to_array(ltree2text(subpath(t.path,1)), '.')) lbl WHERE t.guid=(SELECT guid FROM tk2 WHERE kind='task' LIMIT 1)) x WHERE c.task = x.anc;
ROLLBACK;

\echo === L. verify: totals equal the subtree sums (GiST), any difference = bug
SELECT count(*) AS wrong FROM cost c JOIN tk2 t ON t.guid=c.task
 WHERE c.total IS DISTINCT FROM (SELECT sum(c2.own) FROM tk2 d JOIN cost c2 ON c2.task=d.guid WHERE d.path <@ t.path);

DROP TABLE IF EXISTS b, chg;
BEGIN;
CREATE TEMP TABLE b AS SELECT guid AS task, (random()*500)::numeric(18,2) AS new_own FROM tk2 WHERE kind='task' ORDER BY random() LIMIT 500;
CREATE TEMP TABLE chg AS SELECT b.task, b.new_own - c.own AS d FROM b JOIN cost c ON c.task=b.task;
UPDATE cost c SET own = b.new_own FROM b WHERE c.task=b.task;
UPDATE cost c SET total = c.total + x.d FROM (SELECT replace(lbl,'_','-')::uuid anc, sum(chg.d) d FROM chg JOIN tk2 t ON t.guid=chg.task
  CROSS JOIN LATERAL unnest(string_to_array(ltree2text(subpath(t.path,1)), '.')) lbl GROUP BY 1) x WHERE c.task=x.anc;
SELECT count(*) AS wrong_after_delta FROM cost c JOIN tk2 t ON t.guid=c.task
 WHERE c.total IS DISTINCT FROM (SELECT sum(c2.own) FROM tk2 d JOIN cost c2 ON c2.task=d.guid WHERE d.path <@ t.path);
ROLLBACK;
