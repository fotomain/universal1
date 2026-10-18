#!/usr/bin/env bash
# Speed check of the Monitor01 worker (documentation/MONITOR01_WBS.html, section 7) on a throwaway database of the local Postgres (docker compose up -d first):
#   2000 tasks x 3 lines x 20 days = 120 000 plan movements  ->  an EMPTY tick, one change of one task, a batch of 500 tasks, the whole backfill.
# Targets: empty tick < 5 ms · one task < 50 ms · 500-task batch < 300 ms.     Usage: ./bench_monitor01.sh [tasks]   (default 2000)
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlbench
N=${1:-2000}
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1_sql_tables.sql + start2_sql_code.sql + start3_sql_insert_missing.sql"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/start1_sql_tables.sql >/dev/null
docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/start2_sql_code.sql >/dev/null
docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/start3_sql_insert_missing.sql >/dev/null

echo "== $N tasks, 3 lines each, 20 days a line (the data is made with the triggers off: the tree triggers of the task table are quadratic and are not what is measured; the queue is filled by monitor01_rebuild)"
psqlc -d "$DB" >/dev/null <<SQL
SELECT public.organization_ensure_user('bench@acme.test', '99999999-9999-9999-9999-999999999999', 'Bench', 'B');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001'), '99999999-9999-9999-9999-999999999999', '{"name":"Bench"}');
SET session_replication_role = replica;
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
SELECT g, public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001') || public.pm_ltree_label(g), 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', jsonb_build_object('taskDescription', 'task' || i)
  FROM (SELECT gen_random_uuid() AS g, i FROM generate_series(1, $N) i) s;
INSERT INTO public.task_line_table ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT t."projectGUID", t."rowGUID", (ARRAY['timeGenus','materialGenus','expenseGenus'])[k], k,
       jsonb_build_object('resourceRoleItem', (SELECT "rowGUID" FROM public."resourceRoleTable" ORDER BY "rowGUID" OFFSET k LIMIT 1), 'measureUnitTaskLine', (ARRAY['unit_hour','unit_pcs','unit_pcs'])[k], 'qtyTaskLine', 100, 'priceTaskLine', 2,
                          'taskResourceContract', CASE WHEN k = 1 THEN 'c-1' END)
  FROM public.project_task_table t, generate_series(1, 3) k;
INSERT INTO public.task_line_plan_movements ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "rowPeriodDatetime", "rowCoefficient", "qtyTaskLine")
SELECT l."rowProjectGUID", l."rowOwnerGUID", l."rowGUID", ('2026-10-01'::date + d)::timestamptz, 0.05, 5
  FROM public.task_line_table l, generate_series(0, 19) d;
SET session_replication_role = origin;
SELECT public.monitor01_rebuild('bbbbbbbb-0000-0000-0000-000000000001');
ANALYZE;
SQL
echo "   movements: $(psqlc -d "$DB" -At -c 'select count(*) from public.task_line_plan_movements')   queued tasks: $(psqlc -d "$DB" -At -c 'select count(*) from public.monitor01_dirty')"

psqlc -d "$DB" <<'SQL'
DO $$
DECLARE t0 timestamptz; ms numeric; n int; total int := 0; batches int := 0; one uuid;
BEGIN
  -- 1. the backfill: the whole queue in batches of 500 (a transaction each in production; here one block, the times are per batch)
  LOOP
    t0 := clock_timestamp();
    n := public.monitor01_process_batch(500);
    EXIT WHEN n = 0;
    ms := extract(epoch FROM clock_timestamp() - t0) * 1000;
    batches := batches + 1; total := total + n;
    IF batches IN (1, 2) OR n < 500 THEN RAISE NOTICE 'batch % : % tasks in % ms', batches, n, round(ms); END IF;
  END LOOP;
  RAISE NOTICE 'backfill: % tasks, % batches, view rows %', total, batches, (SELECT count(*) FROM public.monitor01_view);
  -- 2. the empty tick
  t0 := clock_timestamp();
  FOR i IN 1..1000 LOOP PERFORM public.monitor01_process_batch(500); END LOOP;
  RAISE NOTICE 'empty tick: % ms (average of 1000)', round((extract(epoch FROM clock_timestamp() - t0) * 1000 / 1000)::numeric, 3);
  -- 3. one change of one task
  SELECT "rowOwnerGUID" INTO one FROM public.task_line_plan_movements LIMIT 1;
  UPDATE public.task_line_plan_movements SET "qtyTaskLine" = "qtyTaskLine" + 1 WHERE "rowOwnerGUID" = one AND "rowPeriodDatetime" = (SELECT min("rowPeriodDatetime") FROM public.task_line_plan_movements WHERE "rowOwnerGUID" = one);
  t0 := clock_timestamp();
  n := public.monitor01_process_batch(500);
  RAISE NOTICE 'one changed task: % task in % ms', n, round((extract(epoch FROM clock_timestamp() - t0) * 1000)::numeric, 1);
  -- 4. nothing changed: a re-computation writes nothing
  PERFORM public.monitor01_rebuild('bbbbbbbb-0000-0000-0000-000000000001');
  t0 := clock_timestamp();
  n := public.monitor01_process_batch(500);
  RAISE NOTICE 'recompute of 500 unchanged tasks: % ms, rows written %', round((extract(epoch FROM clock_timestamp() - t0) * 1000)::numeric, 1), (SELECT "rowsUpserted" FROM public.monitor01_refresh_log ORDER BY "ranAt" DESC, "rowGUID" LIMIT 1);
END $$;
SQL
