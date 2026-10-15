#!/usr/bin/env bash
# Speed check of the project cost total (documentation/UPDATE_PROJECT_COST.html, section 10) on a throwaway database of the local Postgres (docker compose up -d first):
#   a tree of N tasks (20 stages > 10 > 5 > leaves, depth 5), 2 plan lines x 10 days a leaf, the Monitor01 worker fills the turnover and (step 3) the cost totals.
#   -> the backfill batches (500 tasks, with the cost step) - 500 changed tasks - ONE changed task - an unchanged batch - the rebuild of the project - verify.
# Targets: 500 changed tasks < 50 ms - one task < 5 ms - rebuild of 10 000 tasks < 250 ms - verify returns nothing.     Usage: ./bench_project_cost.sh [tasks]   (default 10000)
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlcostbench
N=${1:-10000}
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1_sql_tables.sql + start2_sql_code.sql + start3_sql_insert_missing.sql"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables start2_sql_code start3_sql_insert_missing; do
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/$f.sql >/dev/null
done

echo "== $N tasks in a tree of depth 5, the cost budget ON (the data is made with the triggers off: the tree triggers are quadratic and are not what is measured)"
psqlc -d "$DB" >/dev/null <<SQL
SELECT public.organization_ensure_user('bench@acme.test', '99999999-9999-9999-9999-999999999999', 'Bench', 'B');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001'), '99999999-9999-9999-9999-999999999999', '{"name":"Bench","projectExpenseBudgetNeeded":true}');
SET session_replication_role = replica;
CREATE TEMP TABLE n AS SELECT gen_random_uuid() AS g, NULL::ltree AS path, i, 1 AS lvl FROM generate_series(1, 20) i;
UPDATE n SET path = public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001') || public.pm_ltree_label(g);
CREATE TEMP TABLE n2 AS SELECT gen_random_uuid() AS g, NULL::ltree AS pp, a.path AS parent FROM n a, generate_series(1, 10);
UPDATE n2 SET pp = parent || public.pm_ltree_label(g);
CREATE TEMP TABLE n3 AS SELECT gen_random_uuid() AS g, a.pp AS parent, NULL::ltree AS pp FROM n2 a, generate_series(1, 5);
UPDATE n3 SET pp = parent || public.pm_ltree_label(g);
CREATE TEMP TABLE leaf AS SELECT gen_random_uuid() AS g, s.pp AS parent, NULL::ltree AS pp, row_number() OVER () AS rn FROM n3 s, generate_series(1, GREATEST(1, CEIL(($N - 1220)::numeric / 1000)::int)) k;
UPDATE leaf SET pp = parent || public.pm_ltree_label(g);
DELETE FROM leaf WHERE rn > GREATEST(0, $N - 1220);
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
SELECT g, path, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, '99999999-9999-9999-9999-999999999999'::uuid, jsonb_build_object('name', 'stage', 'rowKind', 'stage') FROM n
UNION ALL SELECT g, pp, 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', jsonb_build_object('name', 'stage', 'rowKind', 'stage') FROM n2
UNION ALL SELECT g, pp, 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', jsonb_build_object('name', 'stage', 'rowKind', 'stage') FROM n3
UNION ALL SELECT g, pp, 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', jsonb_build_object('name', 'task') FROM leaf;
INSERT INTO public.task_line_table ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT t."projectGUID", t."rowGUID", (ARRAY['timeGenus','materialGenus'])[k], k,
       jsonb_build_object('resourceRoleItem', (SELECT "rowGUID" FROM public."resourceRoleTable" ORDER BY "rowGUID" OFFSET k LIMIT 1), 'measureUnitTaskLine', (ARRAY['unit_hour','unit_pcs'])[k], 'qtyTaskLine', 100, 'priceTaskLine', 2)
  FROM public.project_task_table t, generate_series(1, 2) k WHERE t."rowJSON"->>'rowKind' IS DISTINCT FROM 'stage';
INSERT INTO public.task_line_plan_movements ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "rowPeriodDatetime", "rowCoefficient", "qtyTaskLine", "sumForBudget")
SELECT l."rowProjectGUID", l."rowOwnerGUID", l."rowGUID", ('2026-10-01'::date + d)::timestamptz, 0.1, 5, 10
  FROM public.task_line_table l, generate_series(0, 9) d;
SET session_replication_role = origin;
SELECT public.monitor01_rebuild('bbbbbbbb-0000-0000-0000-000000000001');
ANALYZE;
SQL
echo "   tasks: $(psqlc -d "$DB" -At -c 'select count(*) from public.project_task_table')   movements: $(psqlc -d "$DB" -At -c 'select count(*) from public.task_line_plan_movements')   queued tasks: $(psqlc -d "$DB" -At -c 'select count(*) from public.monitor01_dirty')"

psqlc -d "$DB" <<'SQL'
DO $$
DECLARE
  t0 timestamptz; ms numeric; n int; total int := 0; batches int := 0; one uuid; many uuid[]; r jsonb;
  P constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
BEGIN
  -- 1. the backfill: the whole queue in batches of 500 (Monitor01 + the cost step); the cost rows come from step 3
  LOOP
    t0 := clock_timestamp();
    n := public.monitor01_process_batch(500);
    EXIT WHEN n = 0;
    ms := extract(epoch FROM clock_timestamp() - t0) * 1000;
    batches := batches + 1; total := total + n;
    IF batches IN (1, 2) OR n < 500 THEN RAISE NOTICE 'batch % : % tasks in % ms (Monitor01 + cost step)', batches, n, round(ms); END IF;
  END LOOP;
  RAISE NOTICE 'backfill: % tasks, % batches, cost rows % (the root stages hold %)', total, batches, (SELECT count(*) FROM public.project_task_cost_total),
    (SELECT sum("costTotalForBudget") FROM public.project_task_cost_total c JOIN public.project_task_table t ON t."rowGUID" = c."rowOwnerGUID" WHERE nlevel(t."treePath") = 2);
  RAISE NOTICE 'verify after the backfill: % differing rows (must be 0)', (SELECT count(*) FROM public.project_cost_verify(P));

  -- 2. 500 changed tasks: the plan of 500 leaves goes up by 1 in the turnover, then ONLY the cost step runs
  SELECT array_agg("rowGUID") INTO many FROM (SELECT "rowGUID" FROM public.project_task_table WHERE "rowJSON"->>'rowKind' IS DISTINCT FROM 'stage' ORDER BY random() LIMIT 500) x;
  UPDATE public.project_status_month_turnover SET "sumForBudgetPlan" = "sumForBudgetPlan" + 1 WHERE "rowOwnerGUID" = ANY (many) AND ctid IN (SELECT min(ctid) FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = ANY (many) GROUP BY "rowOwnerGUID");
  t0 := clock_timestamp();
  n := public.project_cost_apply(many);
  RAISE NOTICE '500 changed tasks: % rows touched in % ms   (target < 50)', n, round((extract(epoch FROM clock_timestamp() - t0) * 1000)::numeric, 1);
  -- 3. nothing changed
  t0 := clock_timestamp();
  n := public.project_cost_apply(many);
  RAISE NOTICE '500 unchanged tasks: % rows touched in % ms', n, round((extract(epoch FROM clock_timestamp() - t0) * 1000)::numeric, 1);
  -- 4. ONE changed task
  one := many[1];
  UPDATE public.project_status_month_turnover SET "sumForBudgetPlan" = "sumForBudgetPlan" + 1 WHERE ctid IN (SELECT min(ctid) FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = one);
  t0 := clock_timestamp();
  n := public.project_cost_apply(ARRAY[one]);
  RAISE NOTICE 'one changed task: % rows touched in % ms   (target < 5)', n, round((extract(epoch FROM clock_timestamp() - t0) * 1000)::numeric, 2);
  -- 5. the rebuild of the whole project (the toolbar command, a moved stage) and verify
  t0 := clock_timestamp();
  r := public.project_cost_rebuild(P);
  RAISE NOTICE 'rebuild of % tasks: % ms, changed rows % (0 = nothing had drifted)   (target < 250)', r->>'tasks', round((extract(epoch FROM clock_timestamp() - t0) * 1000)::numeric, 1), r->>'changedRows';
  t0 := clock_timestamp();
  n := (SELECT count(*) FROM public.project_cost_verify(P));
  RAISE NOTICE 'verify: % differing rows in % ms (must be 0)', n, round((extract(epoch FROM clock_timestamp() - t0) * 1000)::numeric, 1);
  -- 6. the whole command (flush + rebuild)
  t0 := clock_timestamp();
  r := public.update_project_cost_total(P);
  RAISE NOTICE 'update_project_cost_total: % ms', round((extract(epoch FROM clock_timestamp() - t0) * 1000)::numeric, 1);
END $$;
SQL
