#!/usr/bin/env bash
# Behaviour tests of the fact input (documentation/FACT_INPUT.html, PART 24) and of Monitor01 (documentation/MONITOR01_WBS.html, PART 25) on a throwaway database of the local Postgres
# (docker compose up -d first):  fresh database -> start1_sql_tables.sql + start2_sql_code.sql -> start3_sql_insert_missing.sql -> tests/5N_*.sql, tests/6N_*.sql and tests/7N_*.sql (each in its own transaction that is rolled back; tests/00_helpers.sql first)
# -> the procedure monitor01_process_dirty (COMMIT inside, so it cannot run inside a test transaction).
# Usage: ./test_fact_monitor01.sh            all
#        ./test_fact_monitor01.sh 50         only tests/50_*.sql
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlfactmon
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1_sql_tables.sql + start2_sql_code.sql + start3_sql_insert_missing.sql"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/start1_sql_tables.sql >/dev/null
docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/start2_sql_code.sql >/dev/null
docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/start3_sql_insert_missing.sql >/dev/null

fail=0
for f in tests/5[0-9]_*.sql tests/6[0-9]_*.sql tests/7[0-9]_*.sql; do
  [ -e "$f" ] || continue
  if [ $# -gt 0 ] && [[ "$f" != tests/$1_* ]]; then continue; fi
  echo "== $f"
  psqlc -d "$DB" -c "drop schema if exists tt cascade" >/dev/null
  if out=$( (cat tests/00_helpers.sql "$f") | psqlc -d "$DB" 2>&1 ); then
    echo "$out" | grep -E "ok:" | sed 's/^[A-Za-z:._0-9\/ ]*NOTICE:  /   /' || true
    echo "   -> $(echo "$out" | grep -c 'ok:') checks passed"
  else
    echo "$out" | grep -E "ERROR|FAILED|ok:" | sed 's/^/   /'; fail=1
  fi
done

if [ $# -eq 0 ]; then
  echo "== the procedure monitor01_process_dirty (COMMIT per batch, outside a test transaction)"
  psqlc -d "$DB" -c "delete from public.monitor01_dirty" -c "delete from public.monitor01_refresh_log" >/dev/null
  psqlc -d "$DB" -c "insert into public.monitor01_dirty (\"rowOwnerGUID\") select gen_random_uuid() from generate_series(1, 1200)" >/dev/null
  psqlc -d "$DB" -c "call public.monitor01_process_dirty(500, 1500)" >/dev/null
  left=$(psqlc -d "$DB" -At -c "select count(*) from public.monitor01_dirty")
  runs=$(psqlc -d "$DB" -At -c "select count(*) from public.monitor01_refresh_log")
  if [ "$left" = "0" ] && [ "$runs" = "3" ]; then echo "   ok: 1200 queued tasks drained in 3 batches"; else echo "   FAILED: queue left $left, log rows $runs (expected 0 and 3)"; fail=1; fi
  psqlc -d "$DB" -c "call public.monitor01_process_dirty()" >/dev/null
  runs=$(psqlc -d "$DB" -At -c "select count(*) from public.monitor01_refresh_log")
  if [ "$runs" = "3" ]; then echo "   ok: an empty queue writes no log row"; else echo "   FAILED: log rows $runs after an empty run (expected 3)"; fail=1; fi
fi
[ "$fail" = 0 ] && echo "ALL OK" || { echo "FAILED"; exit 1; }
