#!/usr/bin/env bash
# ===============================================================================================
# UNIVERSAL1 - Railway #1 Northeast Corridor Data Loader
# Script: RAILWAY_1_DATA_run.command
# Compatible with: macOS Terminal, macOS Finder (double-click), and WebStorm / IntelliJ IDE
# ===============================================================================================

set -eo pipefail

# -----------------------------------------------------------------------------------------------
# 1. Environment & PATH Resolution
# -----------------------------------------------------------------------------------------------
# Ensure standard macOS CLI locations (Homebrew, /usr/local/bin, node, etc.) are available,
# which are often omitted when launched from macOS Finder or WebStorm Run Configurations.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin:$PATH"

# ANSI Colors (disabled if NO_COLOR is set or terminal is dumb)
if [ -t 1 ] && [ -z "$NO_COLOR" ] && [ "$TERM" != "dumb" ]; then
  C_RESET="\033[0m"
  C_BOLD="\033[1m"
  C_DIM="\033[2m"
  C_CYAN="\033[36m"
  C_GREEN="\033[32m"
  C_YELLOW="\033[33m"
  C_RED="\033[31m"
  C_BLUE="\033[34m"
else
  C_RESET=""
  C_BOLD=""
  C_DIM=""
  C_CYAN=""
  C_GREEN=""
  C_YELLOW=""
  C_RED=""
  C_BLUE=""
fi

# -----------------------------------------------------------------------------------------------
# 2. WebStorm & Non-Interactive Detection
# -----------------------------------------------------------------------------------------------
# WebStorm runs scripts with specific environment variables or without an interactive TTY.
# When running in WebStorm or non-interactively, never block on prompts or wait for keypresses.
IS_WEBSTORM=0
if [ -n "$INTELLIJ_ENVIRONMENT_READER" ] || [ -n "$IDEA_INITIAL_DIRECTORY" ] || [[ "$TERMINAL_EMULATOR" == *"JetBrains"* ]] || [[ "$TERMINAL_EMULATOR" == *"JediTerm"* ]]; then
  IS_WEBSTORM=1
fi

IS_NON_INTERACTIVE=0
if [ ! -t 0 ] || [ ! -t 1 ] || [ "$IS_WEBSTORM" -eq 1 ]; then
  IS_NON_INTERACTIVE=1
fi

# -----------------------------------------------------------------------------------------------
# 3. Locate Script and Repository Root
# -----------------------------------------------------------------------------------------------
# Resolve physical script location even if invoked via symlink or with $PWD == $HOME (Finder)
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"

# Walk upwards from SCRIPT_DIR to locate the repo root (marked by package.json or supabase/)
REPO_ROOT="$SCRIPT_DIR"
while [ "$REPO_ROOT" != "/" ] && [ ! -f "$REPO_ROOT/package.json" ] && [ ! -d "$REPO_ROOT/supabase" ]; do
  REPO_ROOT="$(dirname "$REPO_ROOT")"
done

if [ ! -f "$REPO_ROOT/package.json" ] && [ ! -d "$REPO_ROOT/supabase" ]; then
  # Fallback to parent directory if root markers not found
  REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

cd "$REPO_ROOT"

# Locate SQL Seed File and HTML Documentation
SQL_FILE=""
for candidate in \
  "$SCRIPT_DIR/RAILWAY#1_DATA.sql" \
  "$REPO_ROOT/documentation/RAILWAY#1/RAILWAY#1_DATA.sql" \
  "$REPO_ROOT/documentation/RAILWAY_1/RAILWAY#1_DATA.sql"; do
  if [ -f "$candidate" ]; then
    SQL_FILE="$candidate"
    break
  fi
done

HTML_FILE=""
for candidate in \
  "$SCRIPT_DIR/RAILWAY#1_DATA.html" \
  "$REPO_ROOT/documentation/RAILWAY#1/RAILWAY#1_DATA.html" \
  "$REPO_ROOT/documentation/RAILWAY_1/RAILWAY#1_DATA.html"; do
  if [ -f "$candidate" ]; then
    HTML_FILE="$candidate"
    break
  fi
done

# Resolve Supabase Project Ref
PROJECT_REF="czgrxgzdmodkkmbmraub"
if [ -f "$REPO_ROOT/supabase/.temp/linked-project.json" ]; then
  PARSED_REF="$(grep -o '"ref":"[^"]*' "$REPO_ROOT/supabase/.temp/linked-project.json" | cut -d'"' -f4 || true)"
  [ -n "$PARSED_REF" ] && PROJECT_REF="$PARSED_REF"
fi

# -----------------------------------------------------------------------------------------------
# 4. Command Line Flags
# -----------------------------------------------------------------------------------------------
MODE="run"
AUTO_YES=0
NO_PAUSE=0
OPEN_HTML=0

for arg in "$@"; do
  case "$arg" in
    --dry-run|--dry)
      MODE="dry"
      ;;
    --verify|-v)
      MODE="verify"
      ;;
    --open|--html)
      OPEN_HTML=1
      ;;
    --yes|-y|--non-interactive)
      AUTO_YES=1
      ;;
    --no-pause)
      NO_PAUSE=1
      ;;
    --help|-h)
      echo -e "${C_BOLD}UNIVERSAL1 - Railway #1 Northeast Corridor Data Loader${C_RESET}"
      echo ""
      echo -e "Usage: ${C_CYAN}./RAILWAY_1_DATA_run.command${C_RESET} [options]"
      echo ""
      echo "Options:"
      echo "  (no args)       Executes SQL seed against the linked Supabase database and verifies data"
      echo "  --dry-run       Tests database connection and checks file availability without mutating data"
      echo "  --verify        Runs post-seed verification queries against the database"
      echo "  --open, --html  Opens the interactive HTML visual report in your default browser"
      echo "  --yes, -y       Runs without asking for any confirmation prompts"
      echo "  --no-pause      Exits immediately upon completion without waiting for keypress"
      echo "  --help, -h      Shows this help screen"
      echo ""
      echo "Environments Supported:"
      echo "  • WebStorm:   Right-click -> 'Run RAILWAY_1_DATA_run.command' (runs non-interactively)"
      echo "  • Mac Finder: Double-click from Finder (runs in Terminal and pauses so you can see results)"
      echo "  • Terminal:   Run directly with zsh/bash from any working directory"
      exit 0
      ;;
  esac
done

if [ "$IS_NON_INTERACTIVE" -eq 1 ] || [ "$AUTO_YES" -eq 1 ]; then
  NO_PAUSE=1
fi

# -----------------------------------------------------------------------------------------------
# 5. Header Banner
# -----------------------------------------------------------------------------------------------
echo -e "${C_CYAN}${C_BOLD}╔════════════════════════════════════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}║      UNIVERSAL1 ERP / PM — RAILWAY #1 (NORTHEAST CORRIDOR) DATA LOADER     ║${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}╚════════════════════════════════════════════════════════════════════════════╝${C_RESET}"
echo -e "${C_DIM}• Environment : $([ "$IS_WEBSTORM" -eq 1 ] && echo "WebStorm IDE" || ([ "$IS_NON_INTERACTIVE" -eq 1 ] && echo "Non-interactive Shell" || echo "Interactive Terminal"))${C_RESET}"
echo -e "${C_DIM}• Repo Root   : $REPO_ROOT${C_RESET}"
echo -e "${C_DIM}• Target Ref  : $PROJECT_REF${C_RESET}"
if [ -n "$SQL_FILE" ]; then
  echo -e "${C_DIM}• SQL Seed    : $SQL_FILE${C_RESET}"
else
  echo -e "${C_RED}✖ SQL Seed file not found in documentation directory!${C_RESET}"
  exit 1
fi
echo ""

# -----------------------------------------------------------------------------------------------
# 6. Check Dependencies
# -----------------------------------------------------------------------------------------------
SUPABASE_CMD=""
if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD="supabase"
elif [ -x "/usr/local/bin/supabase" ]; then
  SUPABASE_CMD="/usr/local/bin/supabase"
elif [ -x "/opt/homebrew/bin/supabase" ]; then
  SUPABASE_CMD="/opt/homebrew/bin/supabase"
fi

if [ -z "$SUPABASE_CMD" ]; then
  echo -e "${C_RED}✖ Supabase CLI not found in PATH or standard locations.${C_RESET}"
  echo -e "  Please install via: ${C_CYAN}brew install supabase/tap/supabase${C_RESET} or ${C_CYAN}npm i -g supabase${C_RESET}"
  exit 1
fi

# -----------------------------------------------------------------------------------------------
# 7. Execution Handlers
# -----------------------------------------------------------------------------------------------

run_verification() {
  echo -e "${C_BOLD}${C_BLUE}▶ Running Database Verification Queries...${C_RESET}"
  "$SUPABASE_CMD" db query --linked --project-ref "$PROJECT_REF" "
    SELECT 
      '1. Project' as check_item,
      \"rowGUID\"::text as id,
      \"rowJSON\"->>'projectCode' as code,
      \"rowJSON\"->>'name' as description
    FROM public.project_table 
    WHERE \"rowGUID\" = 'a1000000-0000-4000-8000-000000000001'::uuid
    UNION ALL
    SELECT 
      '2. Task Lines (' || \"rowParentGUID\" || ')',
      \"rowGUID\"::text,
      (\"rowJSON\"->>'sumForContract')::text || ' USD',
      \"rowJSON\"->>'description'
    FROM public.task_line_table 
    WHERE \"rowProjectGUID\" = 'a1000000-0000-4000-8000-000000000001'::uuid
    UNION ALL
    SELECT 
      '3. Doc: ' || doc_type,
      guid::text,
      status || ' | ' || num,
      title
    FROM (
      SELECT 'Purchase Order' as doc_type, \"rowGUID\" as guid, \"rowJSON\"->'documentHeader'->>'documentStatus' as status, \"rowJSON\"->'documentHeader'->>'documentNumber' as num, \"rowJSON\"->'documentHeader'->>'title' as title FROM public.purchase_order_header WHERE \"rowGUID\" = 'c1000000-0000-4000-8000-000000000001'::uuid
      UNION ALL
      SELECT 'Product Receipt', \"rowGUID\", \"rowJSON\"->'documentHeader'->>'documentStatus', \"rowJSON\"->'documentHeader'->>'documentNumber', \"rowJSON\"->'documentHeader'->>'title' FROM public.product_receipt_header WHERE \"rowGUID\" = 'c2000000-0000-4000-8000-000000000002'::uuid
      UNION ALL
      SELECT 'Fact Input', \"rowGUID\", \"rowJSON\"->'documentHeader'->>'documentStatus', \"rowJSON\"->'documentHeader'->>'documentNumber', \"rowJSON\"->'documentHeader'->>'title' FROM public.task_fact_header WHERE \"rowGUID\" = 'c3000000-0000-4000-8000-000000000003'::uuid
      UNION ALL
      SELECT 'Vendor Invoice', \"rowGUID\", \"rowJSON\"->'documentHeader'->>'documentStatus', \"rowJSON\"->'documentHeader'->>'documentNumber', \"rowJSON\"->'documentHeader'->>'title' FROM public.vendor_invoice_header WHERE \"rowGUID\" = 'c4000000-0000-4000-8000-000000000004'::uuid
      UNION ALL
      SELECT 'Customer Invoice', \"rowGUID\", \"rowJSON\"->'documentHeader'->>'documentStatus', \"rowJSON\"->'documentHeader'->>'documentNumber', \"rowJSON\"->'documentHeader'->>'title' FROM public.customer_invoice_header WHERE \"rowGUID\" = 'c5000000-0000-4000-8000-000000000005'::uuid
    ) docs
    ORDER BY check_item;
  "
}

if [ "$MODE" = "dry" ]; then
  echo -e "${C_YELLOW}⚡ Running in DRY-RUN mode (Connectivity & schema check)...${C_RESET}"
  "$SUPABASE_CMD" db query --linked --project-ref "$PROJECT_REF" "SELECT current_database(), current_user, now() as db_time;"
  echo -e "\n${C_GREEN}✔ Supabase connection to [$PROJECT_REF] is active and verified.${C_RESET}"
elif [ "$MODE" = "verify" ]; then
  run_verification
else
  echo -e "${C_BOLD}▶ Loading Railway #1 Seed SQL (${SQL_FILE})...${C_RESET}"
  START_TIME=$(date +%s)
  "$SUPABASE_CMD" db query --linked --project-ref "$PROJECT_REF" -f "$SQL_FILE"
  END_TIME=$(date +%s)
  ELAPSED=$((END_TIME - START_TIME))
  echo -e "${C_GREEN}${C_BOLD}✔ SQL Seed executed successfully in ${ELAPSED}s.${C_RESET}\n"

  run_verification
fi

# Optional HTML Report Open
if [ "$OPEN_HTML" -eq 1 ] && [ -n "$HTML_FILE" ]; then
  echo -e "\n${C_CYAN}▶ Opening Interactive Report: $HTML_FILE...${C_RESET}"
  open "$HTML_FILE" || true
fi

echo ""
echo -e "${C_GREEN}${C_BOLD}════════════════════════════════════════════════════════════════════════════${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}✔ All Railway #1 operations completed successfully!${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}════════════════════════════════════════════════════════════════════════════${C_RESET}"

# -----------------------------------------------------------------------------------------------
# 8. Clean Exit & Finder Pause
# -----------------------------------------------------------------------------------------------
if [ "$NO_PAUSE" -eq 0 ]; then
  echo ""
  # Give user 15 seconds to review or press Enter, then exit automatically without hanging
  read -t 15 -p "Press [Enter] to exit (auto-closing in 15s)..." || true
  echo ""
fi

exit 0
