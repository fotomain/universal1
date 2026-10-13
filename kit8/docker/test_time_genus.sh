#!/usr/bin/env bash
# Behaviour tests of the time genus control (documentation/TIME_GENUS_CONTROL_WBS.html) on a throwaway database of the local Postgres (docker compose up -d first):
#   fresh database -> start_sql_structure.sql -> start_sql_insert.sql -> every tests/NN_*.sql (each one in its own transaction that is rolled back; tests/00_helpers.sql is piped before it).
# Usage: ./test_time_genus.sh            all tests
#        ./test_time_genus.sh 10         only tests/10_*.sql
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlfeature
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start_sql_structure.sql + start_sql_insert.sql"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
PGOPTIONS="-c client_min_messages=warning" docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/start_sql_structure.sql >/dev/null
PGOPTIONS="-c client_min_messages=warning" docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/start_sql_insert.sql >/dev/null

fail=0
for f in tests/[0-9][0-9]_*.sql; do
  case "$f" in tests/00_*) continue;; esac
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
[ "$fail" = 0 ] && echo "ALL OK" || { echo "FAILED"; exit 1; }
