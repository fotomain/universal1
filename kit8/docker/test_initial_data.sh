#!/usr/bin/env bash
# The initial program data (documentation/INITIAL_DATA_WBS.html, SQL PART 60, kit8/initial/data):
#   1. fresh database with start1 + start2 and NO seeds -> initial_data_tests/112_initial_data.sql (the functions: insert only, whitelist, rights, bootstrap, calendars)
#   2. the JSON files of the application are installed through the functions, as the first run does (the first user bootstraps, every table in the order of the definition)
#   3. every one of the 20 tables (and the calendar days) must equal the database made by start4_sql_insert_missing.sql (database sqlseeds, made by make_seeds_db.sh)
#   4. smoke: on that database, with NO start4: a demo project, a task, a Time line, Post
# Usage: ./test_initial_data.sh        (docker compose up -d first)
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlinitialdata
SEEDS=sqlseeds
TMP=${TMPDIR:-/tmp}
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
quiet() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1_sql_tables.sql + start2_sql_code.sql (no seeds)"
quiet -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
quiet -d "$DB" -f /sql/start1_sql_tables.sql >/dev/null
quiet -d "$DB" -f /sql/start2_sql_code.sql >/dev/null
if ! quiet -d postgres -At -c "select 1 from pg_database where datname = '$SEEDS'" | grep -q 1; then ./make_seeds_db.sh "$SEEDS" >/dev/null; fi

fail=0
echo "== initial_data_tests/112_initial_data.sql"
if out=$( (cat tests/00_helpers.sql initial_data_tests/112_initial_data.sql) | psqlc -d "$DB" 2>&1 ); then
  echo "$out" | grep -E "ok:" | sed 's/^[A-Za-z:._0-9\/ ]*NOTICE:  /   /' || true
  echo "   -> $(echo "$out" | grep -c 'ok:') checks passed"
else
  echo "$out" | grep -E "ERROR|FAILED|ok:" | sed 's/^/   /'; fail=1
fi
psqlc -d "$DB" -c "drop schema if exists tt cascade" >/dev/null

echo "== the JSON files installed through initial_data_install (the first run of the application)"
{
  cat tests/00_helpers.sql
  echo "BEGIN;"
  echo "SELECT public.organization_ensure_user('first@new.test', '77777777-7777-7777-7777-777777777777', 'First', 'User');"
  echo "SELECT tt.as_user('first@new.test', '77777777-7777-7777-7777-777777777777');"
  echo "SELECT tt.eq(public.initial_data_bootstrap_admin(), true, 'the first user becomes the application administrator');"
  node initial_data_to_sql.mjs
  echo "SELECT tt.eq(public.initial_data_status('{\"application_permission_table\": []}'::jsonb)->>'isApplicationAdmin', 'true', 'the administrator exists');"
  echo "COMMIT;"
} > "$TMP/initial_data_e2e.sql"
if out=$(psqlc -d "$DB" < "$TMP/initial_data_e2e.sql" 2>&1); then echo "   -> installed ($(echo "$out" | grep -c 'ok:') checks)"; else echo "$out" | grep -E "ERROR|FAILED" | head -5 | sed 's/^/   /'; fail=1; fi
psqlc -d "$DB" -c "drop schema if exists tt cascade" >/dev/null

echo "== every table equals the database of start4_sql_insert_missing.sql"
node initial_data_to_sql.mjs --compare > "$TMP/initial_data_compare.sql"
quiet -d "$DB" -At < "$TMP/initial_data_compare.sql" > "$TMP/initial_data_a.txt"
quiet -d "$SEEDS" -At < "$TMP/initial_data_compare.sql" > "$TMP/initial_data_b.txt"
if diff "$TMP/initial_data_a.txt" "$TMP/initial_data_b.txt" > "$TMP/initial_data_diff.txt"; then
  echo "   ok: $(wc -l < "$TMP/initial_data_a.txt" | tr -d ' ') tables are equal"
else
  echo "   FAILED: the tables differ:"; sed 's/^/   /' "$TMP/initial_data_diff.txt" | head -20; fail=1
fi

echo "== smoke: a project, a task, a Time line and Post on the database made WITHOUT start4"
{
  cat tests/00_helpers.sql
  cat <<'SQL'
BEGIN;
SELECT tt.as_user('first@new.test', '77777777-7777-7777-7777-777777777777');
SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT t."rowGUID" AS t1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '77777777-7777-7777-7777-777777777777' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT tt.eq(:'t1' IS NOT NULL, true, 'a demo project with its tasks exists');
SELECT tt.line(:'t1', 'person', 'p-first') AS l1 \gset
SELECT tt.as_user('first@new.test', '77777777-7777-7777-7777-777777777777');
SELECT tt.post(:'t1', format('[{"line": "%s", "days": {"2026-10-14": 8}}]', :'l1')::jsonb) AS r1 \gset
SELECT tt.eq((:'r1'::jsonb->>'rows')::int, 1, 'a Time line is posted');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.task_line_plan_movements WHERE "rowParentGUID" = :'l1'), 1::bigint, 'the plan movement is in the register');
ROLLBACK;
SQL
} > "$TMP/initial_data_smoke.sql"
if out=$(psqlc -d "$DB" < "$TMP/initial_data_smoke.sql" 2>&1); then echo "$out" | grep -E "ok:" | sed 's/^[A-Za-z:._0-9\/ ]*NOTICE:  /   /'; else echo "$out" | grep -E "ERROR|FAILED" | head -5 | sed 's/^/   /'; fail=1; fi
psqlc -d "$DB" -c "drop schema if exists tt cascade" >/dev/null
[ "$fail" = 0 ] && echo "ALL OK" || { echo "FAILED"; exit 1; }
