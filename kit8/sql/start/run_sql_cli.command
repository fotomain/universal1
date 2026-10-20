#!/bin/zsh
# =========================================================================
# UNIVERSAL1 - run the structure SQL on the LINKED Supabase project with the Supabase CLI
#   runs, in this order:  start1_*.sql (the tables)  then  start2_*.sql (functions, triggers, policies, realtime, backfills)  then  start3_*.sql (the pg_cron schedule of the Monitor01 worker)
#   both are idempotent: safe to run again, an existing database is upgraded, nothing is deleted.
#   NOT run on purpose: start4 (seeds, only when seeds changed), start5 (overwrites seed rows), delete_sql_structure.sql (drops tables WITH their data).
#
#   ./run_sql_cli.command          shows the project and the files, waits for Enter, runs, then checks the cost total objects
#   ./run_sql_cli.command -y       no question
#   ./run_sql_cli.command --dry    only shows what would run
#   every error (a failed file, the pause of the worker, the final check) is written to sql_errors.txt next to this script (rewritten on every run; the file says
#   "no errors" after a clean run) - send that file when something fails
#   PROJECT_REF=abcdef ./run_sql_cli.command   another project (default: supabase/.temp/linked-project.json of the repo)
# Needs the Supabase CLI logged in (supabase login). Stops at the FIRST error and tells which file failed.
# =========================================================================

set -eo pipefail

# standard system and Homebrew binaries when launched from the macOS Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

SQL_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SQL_DIR/../../.." && pwd)"
cd "$REPO_DIR"

ASSUME_YES=0
DRY=0
for a in "$@"; do
  case "$a" in
    -y|--yes) ASSUME_YES=1 ;;
    --dry|--dry-run) DRY=1 ;;
    *) echo "unknown option: $a (use -y or --dry)"; exit 2 ;;
  esac
done

pause_end() { if [ -t 0 ] && [ "$ASSUME_YES" = 0 ]; then echo; read -k 1 "?Press any key to close..."; echo; fi; }
ERRLOG="$SQL_DIR/sql_errors.txt"
ERRORS=0
log_error() {   # log_error "<step>" "<text>": appends to sql_errors.txt (the file is rewritten at the start of a run)
  ERRORS=$((ERRORS + 1))
  { echo "=== $(date '+%Y-%m-%d %H:%M:%S') | project ${REF:-?} | $1"; echo "$2"; echo; } >> "$ERRLOG"
}
die() { echo; echo "FAILED: $*"; echo "   (logged in $ERRLOG)"; pause_end; exit 1; }

command -v supabase >/dev/null 2>&1 || die "the Supabase CLI is not installed (brew install supabase/tap/supabase)"

# the project: PROJECT_REF, else the linked project of this repo
REF="${PROJECT_REF:-}"
if [ -z "$REF" ] && [ -f supabase/.temp/linked-project.json ]; then
  REF="$(python3 -I -c 'import json,sys;print(json.load(open("supabase/.temp/linked-project.json")).get("ref",""))')"
fi
[ -n "$REF" ] || die "no project: run 'supabase link' in $REPO_DIR or set PROJECT_REF"

# the files: every start1_*.sql, then every start2_*.sql, then start3_sql_pg_cron.sql (start1_sql_structure.sql no longer exists; the order is the install order)
FILES=()
for pattern in "start1_*.sql" "start2_*.sql" "start3_*.sql"; do
  for f in "$SQL_DIR"/${~pattern}(N); do FILES+=("$f"); done
done
[ ${#FILES[@]} -gt 0 ] || die "no start1_*.sql / start2_*.sql / start3_*.sql in $SQL_DIR"

echo "=============================================================================="
echo "  UNIVERSAL1 -> SUPABASE: run the structure SQL"
echo "  Project ref : $REF"
echo "  Files       :"
for f in "${FILES[@]}"; do echo "    - $(basename "$f")  ($(wc -c < "$f" | tr -d ' ') bytes)"; done
echo "  Not run     : start4 (seeds), start5 (seed upsert), delete_sql_structure.sql"
echo "  WARNING     : the install drops / creates triggers (ACCESS EXCLUSIVE locks) for a few seconds: a Post or an edit made in the app AT THAT MOMENT"
echo "                can fail with \"deadlock detected\" (40P01) and is NOT saved - run it when nobody edits, or edit again"
echo "=============================================================================="

if [ "$DRY" = 1 ]; then echo "(dry run: nothing was executed)"; exit 0; fi

if [ "$ASSUME_YES" = 0 ] && [ -t 0 ]; then
  read -k 1 "?Run these files on this project? [Enter = yes, any other key = no] "; echo
  [ "$REPLY" = $'\n' ] || [ -z "$REPLY" ] || { echo "cancelled"; exit 0; }
fi

echo "run $(date '+%Y-%m-%d %H:%M:%S') on project ${REF}: ${#FILES[@]} files" > "$ERRLOG"; echo >> "$ERRLOG"

# supabase db query --linked talks to the Management API; --project-ref names the project explicitly (the plain --linked can fail with ProjectRefNotLinkedError)
run_sql() { supabase db query --linked --project-ref "$REF" "$@" 2>&1 | grep -v "new version of Supabase CLI\|We recommend updating regularly"; return "${pipestatus[1]}"; }

# the Monitor01 worker (pg_cron, every 2 s) writes the same tables the install changes: a trigger swap of start2 can end in "deadlock detected" (40P01).
# So the jobs are PAUSED here (nothing happens when pg_cron is not enabled) and start3_sql_pg_cron.sql switches them on again as the last file.
echo; echo ">> pause the Monitor01 worker (start3 resumes it)"
PAUSE="do \$\$ begin if to_regnamespace('cron') is not null then perform cron.alter_job(j.jobid, active := false) from cron.job j where j.jobname in ('monitor01_tick', 'monitor01_housekeeping'); end if; end \$\$"
if pout="$(run_sql "$PAUSE")"; then echo "   OK"; else echo "   (could not pause it: the install goes on - see $ERRLOG)"; log_error "pause the Monitor01 worker" "$pout"; fi

for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  echo; echo ">> $name"
  start=$SECONDS
  if out="$(run_sql -f "$f")"; then
    echo "   OK in $((SECONDS - start)) s"
    # a NOTICE / WARNING is not an error; an "ERROR:" line in an answer that came back with exit code 0 is logged
    if echo "$out" | grep -q "ERROR:"; then log_error "$name answered OK but its output has ERROR lines" "$(echo "$out" | grep -B2 -A4 'ERROR:' | head -40)"; fi
    # the install backfill of start2 answers with the rebuild of a project that had no cost rows yet (none on a second run): show its numbers
    echo "$out" | grep -E '"(changedRows|projectTotal|tasks)"' | sed 's/^ */   backfill: /' || true
  else
    echo "$out" | tail -15
    log_error "$name FAILED (the files after it were NOT run)" "$out"
    die "$name failed - the files after it were NOT run"
  fi
done

echo; echo ">> check (read only)"
CHECK="select to_regclass('public.project_task_cost_total') as cost_table, (select count(*) from public.project_task_cost_total) as cost_rows, (select count(*) from pg_proc where proname in ('project_cost_apply','project_cost_rebuild','project_cost_verify','update_project_cost_total','project_cost_budget_on','project_cost_process_dirty','project_cost_fresh')) as functions_of_7, (select count(*) from pg_trigger where tgname in ('trg_project_cost_task_moved','trg_project_cost_task_deleted','trg_project_cost_budget')) as triggers_of_3, (select count(*) from (select (public.project_cost_verify(p.\"rowGUID\")).* from public.project_table p) v) as verify_differences"
# -o json: the CLI prints a TABLE when a terminal is attached (the keys below would not be found)
for attempt in 1 2; do   # the Management API sometimes answers late right after a big install: one more try
  if cout="$(run_sql -o json "$CHECK")" && echo "$cout" | grep -qE '"(cost_table|cost_rows|functions_of_7|triggers_of_3|verify_differences)"'; then
    echo "$cout" | grep -E '"(cost_table|cost_rows|functions_of_7|triggers_of_3|verify_differences)"' | sed 's/^ */   /'
    break
  fi
  if [ "$attempt" = 1 ]; then sleep 3; else echo "   (the check could not be read - see $ERRLOG)"; log_error "check (read only) could not be read" "$cout"; fi
done

if [ "$ERRORS" = 0 ]; then echo "no errors" >> "$ERRLOG"; echo; echo "No errors (sql_errors.txt says so)."; else echo; echo "$ERRORS error(s) logged in $ERRLOG"; fi
echo; echo "DONE. Reload the app; no Expo restart is needed (only the database changed)."
pause_end
