#!/usr/bin/env bash
# A database with the repository seeds: fresh db -> start1_sql_tables.sql + start2_sql_code.sql + start4_sql_insert_missing.sql. The source of
#   node kit8/initial/data/code/dumpInitialData.mjs --source docker --db sqlseeds     (the JSON files of the initial program data, kit8/initial/data)
# (docker compose up -d first). Usage: ./make_seeds_db.sh [dbname]   default sqlseeds
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=${1:-sqlseeds}
docker exec -i "$C" psql -U postgres -q -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables start2_sql_code start4_sql_insert_missing; do
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "/sql/$f.sql" >/dev/null
  echo "$f ok"
done
echo "database $DB is ready"
