#!/usr/bin/env bash
# Speed check of the task templates (documentation/TASK_TEMPLATE_WBS.html, PART 40) on a throwaway database of the local Postgres (docker compose up -d first):
#   ONE stage with N rows inside (10 sub-stages, leaves under them), 2 task lines a leaf, a chain of links (every 2nd leaf waits for the one before) ->
#   Save to template - Fill (tree) into an empty task - Fill with Replace - Fill of the same template again.
# Target: every step < 4 s for 2000 rows (Supabase cuts a statement of `authenticated` at 8 s).     Usage: ./bench_task_template.sh [rows]   (default 2000)
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqltplbench
N=${1:-2000}
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1_sql_tables.sql + start2_sql_code.sql + start4_sql_insert_missing.sql"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables start2_sql_code start4_sql_insert_missing; do
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/$f.sql >/dev/null
done

echo "== a stage with $N rows inside (the data is made with the triggers off: the tree triggers are quadratic and are not what is measured)"
psqlc -d "$DB" >/dev/null <<SQL
SELECT public.organization_ensure_user('bench@acme.test', '99999999-9999-9999-9999-999999999999', 'Bench', 'B');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001'), '99999999-9999-9999-9999-999999999999', '{"name":"Bench"}');
SET session_replication_role = replica;
CREATE TEMP TABLE top AS SELECT 'bbbbbbbb-0000-0000-0000-0000000000aa'::uuid AS g, public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-0000000000aa') AS path;
CREATE TEMP TABLE sub AS SELECT gen_random_uuid() AS g, NULL::ltree AS path, top.path AS parent, i FROM top, generate_series(1, 10) i;
UPDATE sub SET path = parent || public.pm_ltree_label(g);
CREATE TEMP TABLE leaf AS SELECT gen_random_uuid() AS g, s.path AS parent, NULL::ltree AS path, row_number() OVER () AS rn FROM sub s, generate_series(1, CEIL($N::numeric / 10)::int) k;
UPDATE leaf SET path = parent || public.pm_ltree_label(g);
DELETE FROM leaf WHERE rn > $N - 10;
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "orderInList", "rowJSON")
SELECT g, path, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, '99999999-9999-9999-9999-999999999999'::uuid, 0, '{"taskDescription":"Top","rowKind":"stage"}'::jsonb FROM top
UNION ALL SELECT g, path, 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', i, jsonb_build_object('taskDescription','Sub '||i,'rowKind','stage') FROM sub
UNION ALL SELECT g, path, 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', rn, jsonb_build_object('taskDescription','Leaf '||rn,'rowKind','task','durationDays',3,'notes','x') FROM leaf;
INSERT INTO public.task_line_table ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT t."projectGUID", t."rowGUID", (ARRAY['timeGenus','materialGenus'])[k], k, jsonb_build_object('qtyTaskLine', 100, 'priceTaskLine', 2, 'sumForContract', 200, 'sumForBudget', 200, 'taskIsPosted', true)
  FROM public.project_task_table t, generate_series(1, 2) k WHERE t."rowJSON"->>'rowKind' = 'task';
-- links: every 2nd leaf waits for the leaf before it
INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID", "rowOwnerGUID")
SELECT a.g, b.g, 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999' FROM leaf a JOIN leaf b ON b.rn = a.rn - 1 WHERE a.rn % 2 = 0;
SET session_replication_role = origin;
SELECT public.pm_rebuild_dependency_closure('bbbbbbbb-0000-0000-0000-000000000001');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
VALUES ('bbbbbbbb-0000-0000-0000-0000000000bb', public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-0000000000bb'), 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', '{"taskDescription":"Target","rowKind":"task"}');
ANALYZE;
SQL
echo "   rows: $(psqlc -d "$DB" -At -c 'select count(*) from public.project_task_table')   lines: $(psqlc -d "$DB" -At -c 'select count(*) from public.task_line_table')   links: $(psqlc -d "$DB" -At -c 'select count(*) from public.project_task_dependencies_table')"

# every step is its own transaction, as in the app (the app calls the RPCs one by one); the time includes the start of psql (~100 ms)
AS="select set_config('request.jwt.claims','{\"email\":\"bench@acme.test\",\"sub\":\"99999999-9999-9999-9999-999999999999\"}',false), set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',false);"
TOP=bbbbbbbb-0000-0000-0000-0000000000aa
TARGET=bbbbbbbb-0000-0000-0000-0000000000bb
LIMIT_MS=4000
fail=0
step() { # name, sql
  local t0 t1 ms out
  t0=$(python3 -c 'import time; print(int(time.time()*1000))')
  out=$(psqlc -d "$DB" -At -c "$AS" -c "$2" | tail -1)
  t1=$(python3 -c 'import time; print(int(time.time()*1000))')
  ms=$((t1 - t0))
  printf '   %-20s %6s ms  %s\n' "$1" "$ms" "$out"
  if [ "$ms" -gt "$LIMIT_MS" ]; then fail=1; fi
}
step "save" "select public.task_template_save('$TOP', 'Big stage')"
TPL=$(psqlc -d "$DB" -At -c 'select "rowGUID" from public.task_template_header limit 1')
step "fill (tree)" "select public.task_template_fill('$TPL', '$TARGET')"
step "fill again (add)" "select public.task_template_fill('$TPL', '$TARGET')"
step "fill (replace)" "select public.task_template_fill('$TPL', '$TARGET', true)"
step "delete the template" "delete from public.task_template_header"
if [ "$fail" = 1 ]; then echo "   FAILED: a step took more than $LIMIT_MS ms"; exit 1; fi
echo "   ok: every step under $LIMIT_MS ms"
