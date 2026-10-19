#!/bin/zsh
# =========================================================================
# UNIVERSAL1 - RAILWAY #1 DATA LOADER
# Runs ./RAILWAY#1_DATA.sql against the linked Supabase project using Supabase CLI
#
# Usage:
#   ./RAILWAY#1_DATA_run.command          (prompts before execution, runs, checks rows)
#   ./RAILWAY#1_DATA_run.command -y       (executes without confirmation)
#   ./RAILWAY#1_DATA_run.command --dry    (displays target info without executing)
#   PROJECT_REF=xyz ./RAILWAY#1_DATA_run.command
# =========================================================================

set -eo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

CMD_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$CMD_DIR/../.." && pwd)"
SQL_FILE="$CMD_DIR/RAILWAY#1_DATA.sql"

cd "$REPO_DIR"

ASSUME_YES=0
DRY=0
for a in "$@"; do
  case "$a" in
    -y|--yes) ASSUME_YES=1 ;;
    --dry|--dry-run) DRY=1 ;;
    *) echo "Unknown option: $a (valid: -y, --dry)"; exit 2 ;;
  esac
done

pause_end() {
  if [ -t 0 ] && [ "$ASSUME_YES" = 0 ]; then
    echo
    read -k 1 "?Press any key to close..."; echo
  fi
}

die() {
  echo
  echo "❌ FAILED: $*"
  pause_end
  exit 1
}

[ -f "$SQL_FILE" ] || die "File not found: $SQL_FILE"
command -v supabase >/dev/null 2>&1 || die "Supabase CLI is not installed (brew install supabase/tap/supabase)"

# Resolve project ref
REF="${PROJECT_REF:-}"
if [ -z "$REF" ] && [ -f supabase/.temp/linked-project.json ]; then
  REF="$(python3 -I -c 'import json,sys;print(json.load(open("supabase/.temp/linked-project.json")).get("ref",""))' 2>/dev/null || true)"
fi
[ -n "$REF" ] || die "No linked project found: run 'supabase link' in $REPO_DIR or export PROJECT_REF"

echo "=============================================================================="
echo "  🚄 UNIVERSAL1 -> RAILWAY #1 DATA AUTO-LOADER"
echo "  Project Target : Railway #1 (Northeast Corridor NY - WAS Section)"
echo "  Supabase Ref   : $REF"
echo "  Script Path    : documentation/RAILWAY#1/RAILWAY#1_DATA.sql ($(wc -c < "$SQL_FILE" | tr -d ' ') bytes)"
echo "  Lifecycle Docs : Purchase Order -> Product Receipt -> Fact Input"
echo "                   -> Vendor Invoice -> Customer Invoice"
echo "=============================================================================="

if [ "$DRY" = 1 ]; then
  echo "(Dry run active: SQL script was not executed)"
  exit 0
fi

if [ "$ASSUME_YES" = 0 ] && [ -t 0 ]; then
  read -k 1 "?Load Railway #1 Data into this project? [Enter = Proceed, other key = cancel] "; echo
  [ "$REPLY" = $'\n' ] || [ -z "$REPLY" ] || { echo "Cancelled by user."; exit 0; }
fi

run_sql() {
  supabase db query --linked --project-ref "$REF" "$@" 2>&1 | grep -v "new version of Supabase CLI\|We recommend updating regularly"
  return "${pipestatus[1]}"
}

echo ">> Executing RAILWAY#1_DATA.sql ..."
START_SEC=$SECONDS

if OUT="$(run_sql -f "$SQL_FILE")"; then
  ELAPSED=$((SECONDS - START_SEC))
  echo "   ✅ Execution SUCCESS in ${ELAPSED}s"
  echo "$OUT" | grep -i "NOTICE:" | sed 's/^/   /' || true
else
  echo "$OUT" | tail -25
  die "Execution of RAILWAY#1_DATA.sql encountered an error!"
fi

echo
echo ">> Verifying Database Records for Railway #1 ..."

VERIFY_SQL="
SELECT 'Project' AS object, count(*) AS count FROM public.project_table WHERE \"rowGUID\" = 'a1000000-0000-4000-8000-000000000001'
UNION ALL
SELECT 'Task', count(*) FROM public.project_task_table WHERE \"rowGUID\" = 'a3000000-0000-4000-8000-000000000001'
UNION ALL
SELECT 'Task Lines (4 Genera)', count(*) FROM public.task_line_table WHERE \"rowProjectGUID\" = 'a1000000-0000-4000-8000-000000000001'
UNION ALL
SELECT 'Purchase Orders', count(*) FROM public.purchase_order_header WHERE \"rowGUID\" = 'c1000000-0000-4000-8000-000000000001'
UNION ALL
SELECT 'Product Receipts', count(*) FROM public.product_receipt_header WHERE \"rowGUID\" = 'c2000000-0000-4000-8000-000000000002'
UNION ALL
SELECT 'Fact Inputs', count(*) FROM public.task_fact_header WHERE \"rowGUID\" = 'c3000000-0000-4000-8000-000000000003'
UNION ALL
SELECT 'Vendor Invoices', count(*) FROM public.vendor_invoice_header WHERE \"rowGUID\" = 'c4000000-0000-4000-8000-000000000004'
UNION ALL
SELECT 'Customer Invoices', count(*) FROM public.customer_invoice_header WHERE \"rowGUID\" = 'c5000000-0000-4000-8000-000000000005'
UNION ALL
SELECT 'Register Movements', count(*) FROM public.project_status_movements WHERE \"rowProjectGUID\" = 'a1000000-0000-4000-8000-000000000001';
"

run_sql "$VERIFY_SQL" | grep -E '"(object|count)"' | sed 's/^/   /' || echo "   (Verification query returned no rows or failed)"

echo
echo "🎉 RAILWAY #1 DATA IS READY IN UNIVERSAL1!"
echo "Open your Expo application or web dashboard to explore the Project, Task Finances, and Monitor01 Report."
pause_end
