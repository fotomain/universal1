#!/usr/bin/env bash
# The pg_cron part of the Monitor01 worker, for real (the Docker image has pg_cron: Dockerfile, docker-compose.yml; the extension lives in the database sqlcron).
#   1. the install in sqlcron creates the extension and the jobs monitor01_tick (every 2 seconds) and monitor01_housekeeping (daily)  2. a second install changes nothing (still 2 jobs)
#   3. a queued task is drained BY THE SCHEDULER (nobody calls monitor01_process_dirty), within a few seconds; cron.job_run_details shows the runs 'succeeded'
#   4. delete_sql_structure.sql unschedules the jobs  5. the install again schedules them
# Needs: docker compose up -d (the image with pg_cron: docker compose build). Usage: ./test_cron.sh
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlcron
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }
fail=0
ok() { echo "   ok: $1"; }
bad() { echo "   FAILED: $1"; fail=1; }
jobs() { psqlc -At -c "select jobname||' '||schedule||' '||active from cron.job where jobname like 'monitor01%' order by jobname"; }
install() { for f in start1_sql_tables start2_sql_code start3_sql_insert_missing; do psqlc -f /sql/$f.sql >/dev/null; done; }

echo "== the image has pg_cron and the scheduler runs in $DB"
[ "$(docker exec "$C" psql -U postgres -Atc "show shared_preload_libraries")" = "pg_cron" ] || { echo "   FAILED: not the pg_cron image: docker compose down -v && docker compose build && docker compose up -d"; exit 1; }
docker exec "$C" psql -U postgres -Atc "select 1 from pg_database where datname='$DB'" | grep -q 1 || { echo "   FAILED: database $DB is missing (it is made on the FIRST start of the container): docker compose down -v && docker compose up -d"; exit 1; }
for i in $(seq 1 20); do docker logs "$C" 2>&1 | grep -q "pg_cron scheduler started" && break; sleep 1; done
ok "pg_cron is preloaded, database $DB exists"

echo "== clean $DB (delete_sql_structure.sql, then the extension), install"
psqlc -f /sql/delete_sql_structure.sql >/dev/null
psqlc -c "drop extension if exists pg_cron cascade" >/dev/null
install
j=$(jobs)
echo "$j" | grep -qx "monitor01_tick 2 seconds true" && ok "job monitor01_tick = 2 seconds, active" || bad "monitor01_tick: [$j]"
echo "$j" | grep -q "^monitor01_housekeeping 17 3 \* \* \* true" && ok "job monitor01_housekeeping = daily, active" || bad "monitor01_housekeeping: [$j]"

echo "== a second install changes nothing"
install
[ "$(jobs | wc -l | tr -d ' ')" = "2" ] && ok "still 2 jobs" || bad "jobs after the 2nd install: $(jobs | wc -l)"

echo "== the scheduler drains the queue (nobody calls the procedure)"
psqlc -c "delete from public.monitor01_dirty" >/dev/null
psqlc -c "insert into public.monitor01_dirty (\"rowOwnerGUID\") select gen_random_uuid() from generate_series(1, 1200)" >/dev/null
t0=$(date +%s)
left=1200
for i in $(seq 1 30); do
  left=$(psqlc -At -c "select count(*) from public.monitor01_dirty")
  [ "$left" = "0" ] && break
  sleep 1
done
secs=$(( $(date +%s) - t0 ))
if [ "$left" = "0" ]; then ok "1200 queued tasks drained by pg_cron in about $secs s"; else bad "queue still has $left rows after 30 s"; fi
sleep 5
runs=$(psqlc -At -c "select count(*) from cron.job_run_details d join cron.job j using (jobid) where j.jobname='monitor01_tick' and d.status='succeeded'")
failed=$(psqlc -At -c "select count(*) from cron.job_run_details d join cron.job j using (jobid) where j.jobname='monitor01_tick' and d.status='failed'")
[ "$runs" -ge 3 ] && ok "monitor01_tick ran $runs times, succeeded" || bad "monitor01_tick succeeded only $runs times"
[ "$failed" = "0" ] && ok "no failed run" || bad "$failed failed runs: $(psqlc -At -c "select return_message from cron.job_run_details d join cron.job j using (jobid) where j.jobname='monitor01_tick' and d.status='failed' limit 1")"
log=$(psqlc -At -c "select count(*) from public.monitor01_refresh_log")
[ "$log" -ge 1 ] && ok "monitor01_refresh_log has $log batch rows" || bad "monitor01_refresh_log is empty"

echo "== delete_sql_structure.sql unschedules the jobs"
psqlc -f /sql/delete_sql_structure.sql >/dev/null
[ "$(psqlc -At -c "select count(*) from cron.job where jobname like 'monitor01%'")" = "0" ] && ok "no monitor01 job left" || bad "jobs left after the delete"
echo "== install again"
install
[ "$(jobs | wc -l | tr -d ' ')" = "2" ] && ok "2 jobs again" || bad "jobs after reinstall: $(jobs | wc -l)"

[ "$fail" = "0" ] && echo "== cron test OK" || { echo "== cron test FAILED"; exit 1; }
