#!/bin/zsh
# =========================================================================
# UNIVERSAL1 - deploy the Supabase Edge Function  files-drive  (file attachments, chat files)
#   Code     : supabase/functions/files-drive   (README there)
#   Project  : the ref is read from EXPO_PUBLIC_SUPABASE_URL in .env (https://<ref>.supabase.co).
#              PROJECT_REF=abcdefgh ./deploy_files-drive.command   another project
#   Flags    : --no-verify-jwt  (the function checks the user itself: files_authorize)
#   Function : ./deploy_files-drive.command organization-invite   deploys another function of supabase/functions
#   Needs    : the Supabase CLI (brew install supabase/tap/supabase) and `supabase login` once.
#   .env is only READ, never changed.
# =========================================================================

set -eo pipefail

# Standard system and Homebrew binaries when launched from the macOS Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

pause_end() { if [ -t 0 ]; then echo; read -k 1 "?Press any key to close..."; echo; fi; }
fail() { echo "FAILED: $1"; pause_end; exit 1; }

# 1. The repository root = three folders above this file (kit8/sql/start)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_DIR"

FUNCTION_NAME="${1:-files-drive}"
[ -d "supabase/functions/$FUNCTION_NAME" ] || fail "no folder supabase/functions/$FUNCTION_NAME"

command -v supabase >/dev/null 2>&1 || fail "the Supabase CLI is not installed (brew install supabase/tap/supabase)"

# 2. The project ref
REF="${PROJECT_REF:-}"
if [ -z "$REF" ] && [ -f .env ]; then
  URL="$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
  REF="$(printf '%s' "$URL" | sed -nE 's#^https?://([a-z0-9]+)\.supabase\.co.*#\1#p')"
fi
[ -n "$REF" ] || fail "no project ref: set EXPO_PUBLIC_SUPABASE_URL in .env or run  PROJECT_REF=<ref> $0"

echo "Function : $FUNCTION_NAME"
echo "Project  : $REF"
echo "Folder   : $REPO_DIR/supabase/functions/$FUNCTION_NAME"
echo

# 3. Deploy
supabase functions deploy "$FUNCTION_NAME" --no-verify-jwt --project-ref "$REF" || fail "the deploy did not finish (not logged in? run: supabase login)"

echo
echo "DONE: $FUNCTION_NAME deployed to $REF."
pause_end
