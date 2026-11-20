#!/usr/bin/env bash
# Speed of POST (create_task_line_plan) in the day model against the time-of-day model (PART 53), on a throwaway database of the local Postgres (docker compose up -d first).
# The SAME payloads (days + slices of every Time line) are posted four ways, one call per task like the app does, as a signed-in user:
#   A  dayByDayModel,  capacityModeOff   (the slices are sent and ignored)           = the floor: what a day project pays
#   B  hourByHourModel, capacityModeOff  (slices written + checked against the days)  = B - A is the price of the hour rows alone
#   C  dayByDayModel,  capacityModeBlock (day busy check)
#   D  hourByHourModel, capacityModeBlock (busy check to the MINUTE)                  = D - C is the price of the minute check
# then the order is reversed (D C B A) to show the order does not matter. Question behind it: is it worth splitting the day and the hour planning into separate server functions?
# Usage: ./bench_plan_day_vs_hour.sh [tasks] [lines per task]   (default 300 tasks x 2 Time lines, 4 days a line, 2 slices a day; a person has 4 lines = exactly his 8 h a day)
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlplanbench
N=${1:-300}
L=${2:-2}
USERID=99999999-9999-9999-9999-999999999999
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1 + start2 + start4"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables start2_sql_code start4_sql_insert_missing; do
  psqlc -d "$DB" -f /sql/$f.sql >/dev/null
done

echo "== $N tasks x $L Time lines, persons = lines / 4, 4 days (Mon-Thu 2026-10-12..15) a line, windows 09-13 + 14-18"
psqlc -d "$DB" >/dev/null <<SQL
SELECT public.organization_ensure_user('bench@acme.test', '$USERID', 'Bench', 'B');
SELECT set_config('request.jwt.claims', jsonb_build_object('email', 'bench@acme.test', 'sub', '$USERID')::text, false), set_config('request.jwt.claim.sub', '$USERID', false);
SET ROLE authenticated;
SELECT public.pm_seed_demo();
RESET ROLE;
SELECT "rowGUID" AS pid, "rowParentGUID" AS oid FROM public.project_table WHERE "rowOwnerGUID" = '$USERID' ORDER BY "orderInList" LIMIT 1 \gset
INSERT INTO public."personTable" ("rowGUID", "rowJSON") SELECT 'pb-' || i, jsonb_build_object('personFirstName', 'P' || i, 'personLastName', 'B') FROM generate_series(1, GREATEST(1, ($N * $L + 3) / 4)) i;
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"windows": [{"from": "09:00", "to": "13:00"}, {"from": "14:00", "to": "18:00"}]}'
 WHERE "rowGUID" IN ('standardWorkWeekCalendar:2026-10-12', 'standardWorkWeekCalendar:2026-10-13', 'standardWorkWeekCalendar:2026-10-14', 'standardWorkWeekCalendar:2026-10-15');
SET session_replication_role = replica;
CREATE TEMP TABLE bt AS SELECT i, gen_random_uuid() AS g FROM generate_series(1, $N) i;
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
SELECT g, public.pm_ltree_label(:'pid'::uuid) || public.pm_ltree_label(g), :'pid'::uuid, '$USERID'::uuid, jsonb_build_object('taskDescription', 'Bench ' || i, 'rowKind', 'task', 'durationDays', 4)
  FROM bt;
SET session_replication_role = origin;
-- the Time lines: line number k (1..N*L) books person (k-1)/4+1, so each person has 4 lines
CREATE TABLE public.bench_payload (task uuid PRIMARY KEY, payload jsonb NOT NULL, batch int NOT NULL DEFAULT 0);
CREATE TABLE public.bench_result (scenario text, round int, ms numeric, rows int, slices int);
GRANT SELECT ON public.bench_payload TO authenticated;
GRANT INSERT ON public.bench_result TO authenticated;
CREATE TEMP TABLE tk AS SELECT "rowGUID" AS task, row_number() OVER (ORDER BY "rowGUID") AS n FROM public.project_task_table WHERE "projectGUID" = :'pid'::uuid AND "rowJSON"->>'taskDescription' LIKE 'Bench %';
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON")
SELECT gen_random_uuid(), tk.task, 'timeGenus', jsonb_build_object('taskResourceKind', 'person', 'taskResourceItem', 'pb-' || (((tk.n - 1) * $L + l - 1) / 4 + 1), 'measureUnitTaskLine', 'unit_hour')
  FROM tk, generate_series(1, $L) l;
INSERT INTO public.bench_payload
SELECT tk.task, jsonb_build_object('taskGUID', tk.task, 'timeZone', 'UTC', 'lines', (
  SELECT jsonb_agg(jsonb_build_object('lineGUID', ln."rowGUID", 'qtyTaskLine', 8, 'sumForBudget', 800, 'sumForContract', 800, 'sumForAccounting', 800, 'baseOfDistribution', 1,
           'days', (SELECT jsonb_agg(jsonb_build_object('d', d::date, 'c', 0.25)) FROM generate_series('2026-10-12'::date, '2026-10-15'::date, '1 day') d),
           'hours', (SELECT jsonb_agg(jsonb_build_object('d', d::date, 'f', w.f, 't', w.t, 'c', 0.125)) FROM generate_series('2026-10-12'::date, '2026-10-15'::date, '1 day') d, (VALUES (540, 780), (840, 1080)) w(f, t))))
    FROM public.task_line_table ln WHERE ln."rowOwnerGUID" = tk.task))
  FROM tk;
UPDATE public.bench_payload b SET batch = x.n / 100 FROM (SELECT task, row_number() OVER (ORDER BY task) - 1 AS n FROM public.bench_payload) x WHERE x.task = b.task;
ANALYZE;
SQL
echo "   tasks: $(psqlc -d "$DB" -At -c 'select count(*) from public.bench_payload')   Time lines: $(psqlc -d "$DB" -At -c "select count(*) from public.task_line_table where \"rowParentGUID\" = 'timeGenus'")   persons: $(psqlc -d "$DB" -At -c "select count(*) from public.\"personTable\" where \"rowGUID\" like 'pb-%'")"

# one scenario: mode of the project, mode of the organization, a round number. The tasks are posted in batches of 100 with an ANALYZE between the batches (what autovacuum does on a
# real database while rows come in; without it the planner works with the statistics of an empty table and the busy checks look quadratic). Only the posts are timed.
scenario() { # name hour(true|false) capacity(Off|Block) round
  local name=$1 hour=$2 cap=$3 round=$4 mode='dayByDayModel'
  [ "$hour" = true ] && mode='hourByHourModel'
  psqlc -d "$DB" >/dev/null <<SQL
SELECT "rowGUID" AS pid, "rowParentGUID" AS oid FROM public.project_table WHERE "rowOwnerGUID" = '$USERID' ORDER BY "orderInList" LIMIT 1 \gset
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"resourceOptimizationMode": "$mode"}' WHERE "rowGUID" = :'pid';
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"resourceCapacityStrongMode": "capacityMode$cap"}' WHERE "rowGUID" = :'oid';
SQL
  local nb; nb=$(psqlc -d "$DB" -At -c "select max(batch) from public.bench_payload")
  for b in $(seq 0 "$nb"); do
    psqlc -d "$DB" >/dev/null <<SQL
ANALYZE;
SELECT set_config('request.jwt.claims', jsonb_build_object('email', 'bench@acme.test', 'sub', '$USERID')::text, false), set_config('request.jwt.claim.sub', '$USERID', false);
SET ROLE authenticated;
DO \$\$
DECLARE r record; t0 timestamptz; res jsonb;
BEGIN
  FOR r IN SELECT task, payload FROM public.bench_payload WHERE batch = $b ORDER BY task LOOP
    t0 := clock_timestamp();
    res := public.create_task_line_plan(r.payload);
    INSERT INTO public.bench_result VALUES ('$name', $round, extract(epoch FROM clock_timestamp() - t0) * 1000, (res->>'rows')::int, 0);
  END LOOP;
END \$\$;
RESET ROLE;
SQL
  done
  psqlc -d "$DB" -c "UPDATE public.bench_result SET slices = (SELECT count(*) FROM public.task_line_plan_hour_movements) WHERE scenario = '$name' AND round = $round AND slices = 0" >/dev/null
  echo "   done: $name (round $round)"
}

echo "== warm-up (not counted)"
scenario warm false Off 0
psqlc -d "$DB" -c "delete from public.bench_result" >/dev/null
echo "== round 1: A B C D"
scenario "A day  / capacity off  " false Off 1
scenario "B hour / capacity off  " true  Off 1
scenario "C day  / capacity block" false Block 1
scenario "D hour / capacity block" true  Block 1
echo "== round 2: D C B A"
scenario "D hour / capacity block" true  Block 2
scenario "C day  / capacity block" false Block 2
scenario "B hour / capacity off  " true  Off 2
scenario "A day  / capacity off  " false Off 2

echo
echo "== milliseconds per create_task_line_plan call (one task = $L Time lines x 4 days; client-to-database round trip NOT included)"
psqlc -d "$DB" -P pager=off -c "
SELECT scenario, round AS rnd, count(*) AS calls, round(sum(ms)) AS total_ms, round(avg(ms), 2) AS avg_ms, round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ms))::numeric, 2) AS p50,
       round((percentile_cont(0.95) WITHIN GROUP (ORDER BY ms))::numeric, 2) AS p95, round(max(ms), 1) AS max_ms, max(rows) AS day_rows, max(slices) AS slice_rows
  FROM public.bench_result GROUP BY scenario, round ORDER BY scenario, round"
psqlc -d "$DB" -P pager=off -c "
WITH a AS (SELECT scenario, avg(ms) AS m FROM public.bench_result GROUP BY scenario)
SELECT 'hour rows alone (B - A)' AS what, round((b.m - a.m)::numeric, 2) AS ms_per_call, round((100 * (b.m - a.m) / a.m)::numeric) AS pct_of_A FROM a, a b WHERE a.scenario LIKE 'A%' AND b.scenario LIKE 'B%'
UNION ALL SELECT 'minute check instead of day check (D - C)', round((d.m - c.m)::numeric, 2), round((100 * (d.m - c.m) / c.m)::numeric) FROM a c, a d WHERE c.scenario LIKE 'C%' AND d.scenario LIKE 'D%'
UNION ALL SELECT 'capacity check in the day model (C - A)', round((c.m - a.m)::numeric, 2), round((100 * (c.m - a.m) / a.m)::numeric) FROM a, a c WHERE a.scenario LIKE 'A%' AND c.scenario LIKE 'C%'"
