#!/usr/bin/env bash
# Two sessions at the same moment (documentation/TIME_GENUS_CONTROL_WBS.html, E2): a Post that holds a resource makes a second Post and a change of a calendar of the same resource WAIT,
# so they cannot both succeed. Needs docker compose up -d. The database sqlrace is thrown away and made again.
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlrace
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
now() { python3 -c 'import time; print(time.time())'; }

echo "== fresh database $DB + start_sql_structure.sql + a committed world"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
psqlc -d "$DB" -f /sql/start_sql_structure.sql >/dev/null
cat tests/00_helpers.sql - <<'SQL' | psqlc -d "$DB" >/dev/null
BEGIN;
SELECT public.organization_ensure_user('anna@race.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT tt.as_user('anna@race.test', '11111111-1111-1111-1111-111111111111');
SELECT public.pm_seed_demo();
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"resourceCapacityStrongMode": "capacityModeBlock"}' WHERE "rowOwnerGUID" = 'anna@race.test';
INSERT INTO public."personTable" ("rowGUID","rowJSON") VALUES ('p-race', '{"personFirstName":"Race","personLastName":"R"}');
SELECT t."rowGUID" AS t1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'name' = 'Task 111' \gset
SELECT t."rowGUID" AS t2 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'name' = 'Task 112' \gset
SELECT tt.line(:'t1', 'person', 'p-race') AS l1 \gset
SELECT tt.line(:'t2', 'person', 'p-race') AS l2 \gset
CREATE TABLE tt.world AS SELECT :'t1'::uuid AS t1, :'t2'::uuid AS t2, :'l1'::uuid AS l1, :'l2'::uuid AS l2;
GRANT SELECT ON tt.world TO authenticated;
COMMIT;
SQL

echo "== race 1: two Posts of the same resource and day at the same moment - exactly one line may be posted"
# A posts task 1 (8 h on Wed 14 Oct) and keeps its transaction open for 4 s; B posts task 2 (8 h, same day) one second later
( cat <<'SQL' | psqlc -d "$DB" >/dev/null
BEGIN;
SELECT tt.as_user('anna@race.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(w.t1, format('[{"line": "%s", "days": {"2026-10-14": 8}}]', w.l1)::jsonb) FROM tt.world w;
SELECT pg_sleep(4);
COMMIT;
SQL
) &
A=$!
sleep 1
t0=$(now)
cat <<'SQL' | psqlc -d "$DB" >/dev/null
BEGIN;
SELECT tt.as_user('anna@race.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(w.t2, format('[{"line": "%s", "days": {"2026-10-14": 8}}]', w.l2)::jsonb) FROM tt.world w;
COMMIT;
SQL
t1=$(now)
wait $A
waited=$(python3 -c "print(round($t1 - $t0, 1))")
posted=$(psqlc -d "$DB" -At -c "select count(distinct \"rowParentGUID\") from public.task_line_plan_movements where \"rowParentGUID\" in (select l1 from tt.world union select l2 from tt.world)")
echo "   B waited ${waited} s for A; lines with rows: $posted"
python3 -c "import sys; sys.exit(0 if $waited >= 2.5 else 1)" || { echo "FAILED: B did not wait for A (the lock does not work)"; exit 1; }
[ "$posted" = "1" ] || { echo "FAILED: $posted lines were posted (exactly one expected)"; exit 1; }
echo "   OK: B waited, saw the rows of A and its line was left out"

echo "== race 2: a Post holds the resource, a change of the calendar that lowers the capacity waits for it and is then judged against the committed hours"
psqlc -d "$DB" -c "delete from public.task_line_plan_movements" -c "update public.task_line_table set \"rowJSON\" = \"rowJSON\" || '{\"taskIsPosted\": false}'" >/dev/null
( cat <<'SQL' | psqlc -d "$DB" >/dev/null
BEGIN;
SELECT tt.as_user('anna@race.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(w.t1, format('[{"line": "%s", "days": {"2026-10-15": 6}}]', w.l1)::jsonb) FROM tt.world w;
SELECT pg_sleep(4);
COMMIT;
SQL
) &
A=$!
sleep 1
t0=$(now)
# lowering Thursday 8 -> 5 h: the 6 posted hours (not yet committed when B starts) must be seen after the wait, so B is refused
if psqlc -d "$DB" -c "update public.\"managementCalendarDaysTable\" set \"rowJSON\" = \"rowJSON\" || '{\"hours\": 5}' where \"rowGUID\" = 'standardWorkWeekCalendar:2026-10-15'" >/dev/null 2>/tmp/race_err.txt; then
  wait $A; echo "FAILED: the calendar was lowered under the 6 posted hours"; exit 1
fi
t1=$(now); wait $A
waited=$(python3 -c "print(round($t1 - $t0, 1))")
echo "   B waited ${waited} s and was refused: $(grep -o 'cannot be less than [0-9.]* h' /tmp/race_err.txt | head -1)"
python3 -c "import sys; sys.exit(0 if $waited >= 2.5 else 1)" || { echo "FAILED: B did not wait for A"; exit 1; }
echo "ALL OK"
