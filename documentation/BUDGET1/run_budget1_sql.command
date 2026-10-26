#!/bin/zsh
# =========================================================================
# UNIVERSAL1 - BUDGET1 (the budgeting process of the book as a WBS + Gantt chart) on the LINKED Supabase project: runs TWO SQL files, in this order
#   1. kit8/sql/start/start4_sql_insert_missing.sql   the seed rows (INSERT ... ON CONFLICT DO NOTHING): the standard budget items (PART 32) that BUDGET1 uses; nothing of yours is changed
#   2. documentation/BUDGET1/BUDGET1_WBS_DATA.sql     the project BUDGET1: catalogs (business units, role types, roles, budget items) + the WBS + the lines + the Gantt links
#                                                     (it REPLACES the earlier BUDGET1 project; it stops with a message when start1 + start2 + start4 were not run)
#   both are idempotent: safe to run again.
#   NOT run on purpose: start1 / start2 (the structure: kit8/sql/start/run_sql_cli.command), start5, delete_sql_structure.sql.
#
#   ./run_budget1_sql.command            shows the project and the files, waits for Enter, runs both, then checks the result
#   ./run_budget1_sql.command -y         no question
#   ./run_budget1_sql.command --dry      only shows what would run
#   ./run_budget1_sql.command --verify   runs NOTHING: only the read-only check of what is in the database now
#   PROJECT_REF=abcdef ./run_budget1_sql.command   another project (default: supabase/.temp/linked-project.json of the repo)
# Needs the Supabase CLI logged in (supabase login). Stops at the FIRST error and tells which file failed.
# After it: open the app, project BUDGET1, Project actions > "Post unposted tasks" (the plan of the lines is not posted by the file).
# =========================================================================

set -eo pipefail

# standard system and Homebrew binaries when launched from the macOS Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$HERE/../.." && pwd)"
cd "$REPO_DIR"

ASSUME_YES=0
DRY=0
VERIFY=0
for a in "$@"; do
  case "$a" in
    -y|--yes) ASSUME_YES=1 ;;
    --dry|--dry-run) DRY=1 ;;
    --verify|--check) VERIFY=1 ;;
    *) echo "unknown option: $a (use -y, --dry or --verify)"; exit 2 ;;
  esac
done

pause_end() { if [ -t 0 ] && [ "$ASSUME_YES" = 0 ]; then echo; read -k 1 "?Press any key to close..."; echo; fi; }
die() { echo; echo "FAILED: $*"; pause_end; exit 1; }

command -v supabase >/dev/null 2>&1 || die "the Supabase CLI is not installed (brew install supabase/tap/supabase)"

REF="${PROJECT_REF:-}"
if [ -z "$REF" ] && [ -f supabase/.temp/linked-project.json ]; then
  REF="$(python3 -I -c 'import json,sys;print(json.load(open("supabase/.temp/linked-project.json")).get("ref",""))')"
fi
[ -n "$REF" ] || die "no project: run 'supabase link' in $REPO_DIR or set PROJECT_REF"

FILES=("$REPO_DIR/kit8/sql/start/start4_sql_insert_missing.sql" "$HERE/BUDGET1_WBS_DATA.sql")
for f in "${FILES[@]}"; do [ -f "$f" ] || die "missing file: $f"; done

run_sql() { supabase db query --linked --project-ref "$REF" "$@" 2>&1 | grep -v "new version of Supabase CLI\|We recommend updating regularly"; return "${pipestatus[1]}"; }

# the read-only check (also the end of a run): what BUDGET1 is in the database now
check() {
  local P="md5('BUDGET1:project')::uuid"
  local Q1="select (select count(*) from public.project_task_table where \"projectGUID\" = $P) as wbs_rows_of_450, (select count(*) from public.project_task_table where \"projectGUID\" = $P and \"rowJSON\"->>'rowKind' = 'task') as tasks_of_357, (select count(*) from public.task_line_table where \"rowProjectGUID\" = $P) as task_lines_of_818, (select count(*) from public.project_task_dependencies_table where \"projectGUID\" = $P) as links_of_377, (select count(*) from public.\"businessUnitTable\" where \"rowGUID\" like 'bu_b1_%') as business_units_of_22, (select count(*) from public.\"resourceRoleTable\" where \"rowOwnerGUID\" like 'bgt%') as roles_of_61, (select count(*) from public.task_line_plan_movements where \"rowProjectGUID\" = $P) as plan_rows_0_until_post"
  run_sql "$Q1" | grep -E '"[a-z_0-9]+_(of_[0-9]+|0_until_post)"' | sed 's/^ */   /' || echo "   (the check could not be read)"
  echo "   the lines by genus (RUB):"
  local Q2="select \"rowParentGUID\" as genus, count(*) as lines, sum((\"rowJSON\"->>'sumForBudget')::numeric) as sum_rub from public.task_line_table where \"rowProjectGUID\" = $P group by 1 order by 1"
  run_sql "$Q2" | grep -E '"(genus|lines|sum_rub)"' | sed 's/^ */      /' || echo "   (the sums could not be read)"
}

if [ "$VERIFY" = 1 ]; then
  echo "Project ref : $REF  (read only - nothing is changed)"
  echo; echo ">> check"; check
  pause_end; exit 0
fi

echo "=============================================================================="
echo "  UNIVERSAL1 -> SUPABASE: BUDGET1, the budgeting process of the book (2 SQL files)"
echo "  Project ref : $REF"
echo "  Files       :"
for f in "${FILES[@]}"; do echo "    - $(basename "$f")  ($(wc -c < "$f" | tr -d ' ') bytes)"; done
echo "  Needs       : start1_sql_tables.sql and start2_sql_code.sql already run on this project (kit8/sql/start/run_sql_cli.command)"
echo "  WARNING     : BUDGET1_WBS_DATA.sql REPLACES the earlier BUDGET1 project of this database"
echo "=============================================================================="

if [ "$DRY" = 1 ]; then echo "(dry run: nothing was executed)"; exit 0; fi

if [ "$ASSUME_YES" = 0 ] && [ -t 0 ]; then
  read -k 1 "?Run these 2 files on this project? [Enter = yes, any other key = no] "; echo
  [ "$REPLY" = $'\n' ] || [ -z "$REPLY" ] || { echo "cancelled"; exit 0; }
fi

for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  echo; echo ">> $name"
  start=$SECONDS
  if out="$(run_sql -f "$f")"; then
    echo "   OK in $((SECONDS - start)) s"
  else
    echo "$out" | tail -15
    die "$name failed - the files after it were NOT run"
  fi
done

echo; echo ">> check (read only)"; check

echo; echo "DONE. Reload the app, open the project BUDGET1 and press Project actions > Post unposted tasks; no Expo restart is needed (only the database changed)."
pause_end
