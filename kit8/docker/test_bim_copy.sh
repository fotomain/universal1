#!/usr/bin/env bash
# BIM copy (bim_copy_begin) through the real database flow (documentation/BIM_WBS.html section 12): fresh database -> start1 + start2 + start4 -> the bundle made by py/bim/server/ifc_to_bim.py
# (kit8/pm/bim/examples/example2/out) -> begin / tasks / rows / commit -> expected numbers (4 stages, 215 tasks, 56 walls + 38 doors and windows, elements per storey 14/101/93/7, unit scale 1) -> the copy of the model into a second project (bim_copy_begin + bim_import_commit).
# Needs the container (docker compose up -d). Prints ALL OK.
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlbimcopy
EX=../pm/bim/examples/example2/out
PROJECT_FILE=$(ls $EX/project_data_*.json | head -1)
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
echo "== fresh database $DB"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables.sql start2_sql_code.sql start4_sql_insert_missing.sql; do psqlc -d "$DB" -f /sql/$f >/dev/null; done
docker exec "$C" rm -rf /tmp/bim_cp && docker exec "$C" mkdir -p /tmp/bim_cp
docker cp "$PROJECT_FILE" "$C:/tmp/bim_cp/project.json"
docker cp "$EX/bundle.json" "$C:/tmp/bim_cp/bundle.json"
echo "== import example 2, copy its model and check the numbers"
out=$( (cat tests/00_helpers.sql bim_copy_check.sql) | docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q 2>&1 ) || { echo "$out" | grep -E "ERROR|FAILED" | sed 's/^/   /'; echo FAILED; exit 1; }
echo "$out" | grep -E "ok:" | sed 's/^[A-Za-z:._0-9\/ ]*NOTICE:  /   /'
echo "   -> $(echo "$out" | grep -c 'ok:') checks passed"
echo ALL OK
