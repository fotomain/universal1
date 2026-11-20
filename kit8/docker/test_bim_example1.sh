#!/usr/bin/env bash
# BIM example 1 through the real database flow (documentation/BIM_WBS.html section 12): fresh database -> start1 + start2 + start4 -> the bundle made by py/bim/server/ifc_to_bim.py
# (kit8/pm/bim/examples/example1/out) -> begin / tasks / rows / commit -> expected numbers (4 stages, 58 tasks, 58 walls 31/5/5/17, 0.3048) -> delete_bim_data.sql removes it again.
# Needs the container (docker compose up -d). Prints ALL OK.
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlbim1
EX=../pm/bim/examples/example1/out
PROJECT_FILE=$(ls $EX/project_data_*.json | head -1)
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
echo "== fresh database $DB"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables.sql start2_sql_code.sql start4_sql_insert_missing.sql; do psqlc -d "$DB" -f /sql/$f >/dev/null; done
docker exec "$C" rm -rf /tmp/bim_ex1 && docker exec "$C" mkdir -p /tmp/bim_ex1
docker cp "$PROJECT_FILE" "$C:/tmp/bim_ex1/project.json"
docker cp "$EX/bundle.json" "$C:/tmp/bim_ex1/bundle.json"
echo "== import example 1 and check the numbers"
out=$( (cat tests/00_helpers.sql bim_example1_check.sql) | docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q 2>&1 ) || { echo "$out" | grep -E "ERROR|FAILED" | sed 's/^/   /'; echo FAILED; exit 1; }
echo "$out" | grep -E "ok:" | sed 's/^[A-Za-z:._0-9\/ ]*NOTICE:  /   /'
echo "   -> $(echo "$out" | grep -c 'ok:') checks passed"
echo "== delete_bim_data.sql (all projects)"
del=$(psqlc -d "$DB" -c "set client_min_messages = notice" -f /sql/delete_bim_data.sql 2>&1)
echo "$del" | grep -E "NOTICE|files_waiting|^ +[0-9]+" | sed 's/^/   /'
left=$(psqlc -d "$DB" -t -A -c "select (select count(*) from bim_model_table) + (select count(*) from bim_element_table) + (select count(*) from bim_chunk_table) + (select count(*) from bim_storey_table) + (select count(*) from bim_property_table) + (select count(*) from public.project_table where \"rowJSON\" ? 'projectIsBIMBased')")
queued=$(psqlc -d "$DB" -t -A -c "select count(*) from bim_storage_cleanup_table")
tasks=$(psqlc -d "$DB" -t -A -c "select count(*) from public.project_task_table")
[ "$left" = 0 ] || { echo "FAILED: $left bim rows / marks left"; exit 1; }
[ "$queued" = 4 ] || { echo "FAILED: expected 4 file paths queued, found $queued"; exit 1; }
[ "$tasks" = 62 ] || { echo "FAILED: the tasks must stay (62), found $tasks"; exit 1; }
echo "   bim rows left 0, 4 file paths queued for removal, 62 tasks stay"
echo "== the same with v_delete_tasks on"
sed 's/v_delete_tasks boolean := false;/v_delete_tasks boolean := true;/' ../sql/start/delete_bim_data.sql | psqlc -d "$DB" >/dev/null
tasks2=$(psqlc -d "$DB" -t -A -c "select count(*) from public.project_task_table")
[ "$tasks2" = 0 ] || { echo "FAILED: with v_delete_tasks the tasks of the import must go (found $tasks2 left)"; exit 1; }
echo "   the 62 tasks of the import were deleted"
echo ALL OK
