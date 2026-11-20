#!/bin/zsh
# =========================================================================
# UNIVERSAL1 - deploy EVERYTHING of Supabase for end-to-end work, in one go
#
#   1. SECRETS    the secrets of the Edge Functions, taken from .env (read only) - or generated once, or kept when Supabase has them already
#   2. FUNCTIONS  every function of supabase/functions:  files-drive  organization-invite  identification-recognize
#   3. SQL        kit8/sql/start/run_sql_cli.command -y  (start1 tables, start2 code, start3 pg_cron; idempotent)   [--no-sql to skip]
#   4. DATABASE   the settings the pg_cron cleanup tick of files-drive needs (function url + cleanup secret)
#   5. CHECKS     every function answers on the internet, the Google AI key is valid (HTTP status only), what is still missing
#
#   ./deploy_all.command            shows the plan, waits for Enter, runs
#   ./deploy_all.command -y         no question
#   ./deploy_all.command --dry      only shows the plan (secrets: set from .env / kept / generated / MISSING) - changes NOTHING, asks NOTHING, never waits for a key
#   --no-secrets  --no-functions  --no-sql  --no-db      skip a part
#   --seeds                         also run start4_sql_insert_missing.sql (the seed rows; ON CONFLICT DO NOTHING)
#   PROJECT_REF=abcdefgh ./deploy_all.command            another project (default: EXPO_PUBLIC_SUPABASE_URL of .env, else supabase/.temp/linked-project.json)
#
#   SECRETS ARE NEVER PRINTED. Values are read from .env, written to a temporary file (mode 600, deleted at the end) and handed to `supabase secrets set --env-file`;
#   the exception is GOOGLE_AI_API_KEY, which has its own command: supabase secrets set GOOGLE_AI_API_KEY="$(grep '^GOOGLE_AI_API_KEY=' .env | cut -d= -f2-)" --project-ref <ref>.
#   .env is only READ, never changed. A secret that has to be CREATED (FILES_TOKEN_KEY, FILES_URL_SECRET, FILES_CLEANUP_SECRET) is generated ONCE and only when
#   Supabase does not have it: a new FILES_TOKEN_KEY would make the stored Google / OneDrive refresh tokens unreadable (every organization would have to reconnect).
#   The generated values are saved in supabase/.generated_secrets.env (mode 600, git-ignored) - copy those lines into .env, you need them again for another project / a lost project.
#   The automatic secrets of Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY ...) are never set here: every function gets them from Supabase.
#
#   Needs the Supabase CLI (brew install supabase/tap/supabase) and `supabase login` once.
# =========================================================================

set -eo pipefail

# standard system and Homebrew binaries when launched from the macOS Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

SUPABASE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SUPABASE_DIR/.." && pwd)"
cd "$REPO_DIR"

ASSUME_YES=0; DRY=0; DO_SECRETS=1; DO_FUNCTIONS=1; DO_SQL=1; DO_DB=1; DO_SEEDS=0
for a in "$@"; do
  case "$a" in
    -y|--yes) ASSUME_YES=1 ;;
    --dry|--dry-run) DRY=1 ;;
    --no-secrets) DO_SECRETS=0 ;;
    --no-functions) DO_FUNCTIONS=0 ;;
    --no-sql) DO_SQL=0 ;;
    --no-db) DO_DB=0 ;;
    --seeds) DO_SEEDS=1 ;;
    *) echo "unknown option: $a"; echo "use: -y --dry --no-secrets --no-functions --no-sql --no-db --seeds"; exit 2 ;;
  esac
done

# --dry never asks and never waits: no question, no "Press any key" (also not after an error), no prompt of the CLI (stdin is closed)
if [ "$DRY" = 1 ]; then ASSUME_YES=1; exec < /dev/null; fi

pause_end() { if [ -t 0 ] && [ "$ASSUME_YES" = 0 ]; then echo; read -k 1 "?Press any key to close..."; echo; fi; }
fail() { echo; echo "FAILED: $1"; pause_end; exit 1; }
hr() { echo "=============================================================================="; }
# the CLI advertises a new version on every call: not interesting here
clean() { grep -v "new version of Supabase CLI\|We recommend updating regularly\|A new version of Supabase CLI"; }

command -v supabase >/dev/null 2>&1 || fail "the Supabase CLI is not installed (brew install supabase/tap/supabase)"
command -v openssl >/dev/null 2>&1 || fail "openssl is needed to generate secrets"
command -v python3 >/dev/null 2>&1 || fail "python3 is needed (it reads the answers of the CLI)"
[ -f .env ] || fail "no .env in $REPO_DIR (it holds the secrets this script sets)"

# ---------------------------------------------------------------- .env
# the value of NAME in .env (the last line wins; quotes and a trailing CR removed); empty when missing
envval() { { grep -E "^$1=" .env || true; } | tail -1 | cut -d= -f2- | tr -d '\r' | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }

# ---------------------------------------------------------------- the project
REF="${PROJECT_REF:-}"
if [ -z "$REF" ]; then
  URL="$(envval EXPO_PUBLIC_SUPABASE_URL | tr -d ' ')"
  REF="$(printf '%s' "$URL" | sed -nE 's#^https?://([a-z0-9]+)\.supabase\.co.*#\1#p')"
fi
if [ -z "$REF" ] && [ -f supabase/.temp/linked-project.json ]; then
  REF="$(python3 -I -c 'import json;print(json.load(open("supabase/.temp/linked-project.json")).get("ref",""))')"
fi
[ -n "$REF" ] || fail "no project: set EXPO_PUBLIC_SUPABASE_URL in .env, run 'supabase link', or PROJECT_REF=<ref> $0"
BASE="https://$REF.supabase.co"


# ---------------------------------------------------------------- what exists in Supabase (names only: the CLI never shows values) - also the login check
EXISTING=""
if out="$(supabase secrets list --project-ref "$REF" -o json 2>&1 | clean)"; then
  EXISTING="$(printf '%s' "$out" | python3 -I -c 'import json,sys
try:
    d=json.load(sys.stdin)
    print("\n".join(sorted(str(x.get("name","")) for x in d)))
except Exception:
    pass')"
else
  fail "could not read the secrets of project $REF (not logged in? run: supabase login). Answer: $(printf '%s' "$out" | head -3)"
fi
exists_in_supabase() { printf '%s\n' "$EXISTING" | grep -qx "$1"; }

# ---------------------------------------------------------------- the secrets
# NAME | source (env = from .env, gen = generated once) | function | required (yes / no)
SECRETS=(
  "GOOGLE_AI_API_KEY|env|identification-recognize|yes"
  "GOOGLE_AI_MODEL|env|identification-recognize|no"
  "GOOGLE_DRIVE_CLIENT_ID|env|files-drive (Google Drive)|yes"
  "GOOGLE_DRIVE_CLIENT_SECRET|env|files-drive (Google Drive)|yes"
  "FILES_APP_RETURN_URL|env|files-drive (where Google sends the user back, e.g. https://<app>/user/files)|yes"
  "FILES_TOKEN_KEY|gen|files-drive (encrypts the stored refresh tokens: NEVER regenerate)|yes"
  "FILES_URL_SECRET|gen|files-drive (signs download links)|yes"
  "FILES_CLEANUP_SECRET|gen|files-drive (the pg_cron cleanup tick)|yes"
  "MICROSOFT_CLIENT_ID|env|files-drive (OneDrive)|no"
  "MICROSOFT_CLIENT_SECRET|env|files-drive (OneDrive)|no"
  "MICROSOFT_TENANT|env|files-drive (OneDrive)|no"
  "MICROSOFT_CLIENT_SECRET_EXPIRES|env|files-drive (OneDrive, YYYY-MM-DD)|no"
  "INVITE_REDIRECT_URL|env|organization-invite (where the e-mail link opens the app)|no"
)

WORK="$(mktemp -d)"; chmod 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT
SECRET_FILE="$WORK/secrets.env"; : > "$SECRET_FILE"; chmod 600 "$SECRET_FILE"
GENERATED_FILE="$SUPABASE_DIR/.generated_secrets.env"
NEW_GENERATED=0
AI_KEY_FROM_ENV=0
MISSING=()          # required secrets nobody can give
CLEANUP_VALUE=""    # the value of FILES_CLEANUP_SECRET when this run knows it (for the database setting)
PLAN_LINES=()

for row in "${SECRETS[@]}"; do
  name="${row%%|*}"; rest="${row#*|}"; kind="${rest%%|*}"; rest="${rest#*|}"; fn="${rest%%|*}"; req="${rest##*|}"
  val="$(envval "$name")"
  if [ "$name" = "GOOGLE_AI_API_KEY" ] && [ -n "$val" ]; then
    # set by its own command in step 1 (supabase secrets set GOOGLE_AI_API_KEY=... --project-ref <ref>), not through the env file
    PLAN_LINES+=("  set      $name  (from .env, own command: supabase secrets set $name=... --project-ref $REF)  - $fn")
    AI_KEY_FROM_ENV=1
  elif [ -n "$val" ]; then
    PLAN_LINES+=("  set      $name  (from .env)  - $fn")
    printf '%s=%s\n' "$name" "$val" >> "$SECRET_FILE"
    [ "$name" = "FILES_CLEANUP_SECRET" ] && CLEANUP_VALUE="$val"
  elif [ "$kind" = "gen" ] && ! exists_in_supabase "$name"; then
    PLAN_LINES+=("  GENERATE $name  (new random value, saved in supabase/.generated_secrets.env)  - $fn")
    if [ "$DRY" = 0 ] && [ "$DO_SECRETS" = 1 ]; then
      gv="$(openssl rand -base64 32 | tr -d '\n')"
      printf '%s=%s\n' "$name" "$gv" >> "$SECRET_FILE"
      ( umask 077; printf '%s=%s\n' "$name" "$gv" >> "$GENERATED_FILE" )
      NEW_GENERATED=1
      [ "$name" = "FILES_CLEANUP_SECRET" ] && CLEANUP_VALUE="$gv"
    fi
  elif exists_in_supabase "$name"; then
    PLAN_LINES+=("  keep     $name  (already set in Supabase, not in .env)  - $fn")
  elif [ "$req" = "yes" ]; then
    PLAN_LINES+=("  MISSING  $name  (add  $name=...  to .env)  - $fn")
    MISSING+=("$name")
  else
    PLAN_LINES+=("  skip     $name  (optional, not in .env)  - $fn")
  fi
done

# ---------------------------------------------------------------- the functions
FUNCTIONS=()
for d in supabase/functions/*(N/); do
  [ -f "$d/index.ts" ] && FUNCTIONS+=("$(basename "$d")")
done
# files-drive is called by Google's redirect and by <video src> without an Authorization header: the gateway must let it through, the function checks the caller itself
# (decision of documentation/FILE_ATTACHMENT_WBS.html, README of the function). The others keep the JWT check of the gateway.
fn_flags() { case "$1" in files-drive) echo "--no-verify-jwt" ;; *) echo "" ;; esac; }

# ---------------------------------------------------------------- the plan
hr
echo "  UNIVERSAL1 -> SUPABASE: deploy all"
echo "  Project   : $REF   ($BASE)"
echo "  Secrets   : $([ "$DO_SECRETS" = 1 ] && echo yes || echo skipped)"
if [ "$DO_SECRETS" = 1 ]; then for l in "${PLAN_LINES[@]}"; do echo "$l"; done; fi
echo "  Functions : $([ "$DO_FUNCTIONS" = 1 ] && echo "${FUNCTIONS[*]}" || echo skipped)"
echo "  SQL       : $([ "$DO_SQL" = 1 ] && echo "kit8/sql/start/run_sql_cli.command -y (start1, start2, start3)" || echo skipped)$([ "$DO_SEEDS" = 1 ] && echo " + start4 seeds")"
echo "  Database  : $([ "$DO_DB" = 1 ] && echo "settings of the files cleanup tick (app.settings.files_function_url / files_cleanup_secret)" || echo skipped)"
echo "  Secrets are never printed; .env is only read."
hr

if [ "$DRY" = 1 ]; then
  [ ${#MISSING[@]} -gt 0 ] && { echo; echo "STILL MISSING for end-to-end work: ${MISSING[*]}"; echo "  add them to .env (name=value), then run this script again."; }
  echo "(dry run: nothing was changed)"; exit 0
fi

if [ "$ASSUME_YES" = 0 ] && [ -t 0 ]; then
  read -k 1 "?Deploy all this to project $REF? [Enter = yes, any other key = no] "; echo
  [ "$REPLY" = $'\n' ] || [ -z "$REPLY" ] || { echo "cancelled"; exit 0; }
fi

ERRORS=()

# ---------------------------------------------------------------- 1. secrets
if [ "$DO_SECRETS" = 1 ]; then
  echo; echo ">> 1. secrets"
  # the Google AI key of .env (identification-recognize), with its own command:
  #   supabase secrets set GOOGLE_AI_API_KEY="$(grep '^GOOGLE_AI_API_KEY=' .env | cut -d= -f2-)" --project-ref <ref>
  # (envval does the same as the grep + cut and also removes quotes and a trailing CR). Nothing is printed except the answer of the CLI.
  if [ "$AI_KEY_FROM_ENV" = 1 ]; then
    if supabase secrets set GOOGLE_AI_API_KEY="$(envval GOOGLE_AI_API_KEY)" --project-ref "$REF" 2>&1 | clean | sed 's/^/   /'; then
      echo "   GOOGLE_AI_API_KEY set"
    else
      ERRORS+=("secrets: supabase secrets set GOOGLE_AI_API_KEY failed")
    fi
  fi
  if [ -s "$SECRET_FILE" ]; then
    count="$(grep -c '=' "$SECRET_FILE")"
    if supabase secrets set --env-file "$SECRET_FILE" --project-ref "$REF" 2>&1 | clean | sed 's/^/   /'; then
      echo "   $count secret(s) set"
      [ "$NEW_GENERATED" = 1 ] && echo "   NEW generated secrets were saved in supabase/.generated_secrets.env - copy those lines into .env (it is git-ignored)"
    else
      ERRORS+=("secrets: supabase secrets set failed")
    fi
  else
    echo "   nothing to set"
  fi
fi

# ---------------------------------------------------------------- 2. functions
if [ "$DO_FUNCTIONS" = 1 ]; then
  echo; echo ">> 2. functions"
  for fn in "${FUNCTIONS[@]}"; do
    flags="$(fn_flags "$fn")"
    echo "   - $fn ${flags:+($flags)}"
    start=$SECONDS
    if supabase functions deploy "$fn" ${=flags} --project-ref "$REF" 2>&1 | clean | sed 's/^/     /'; then
      echo "     deployed in $((SECONDS - start)) s"
    else
      # no Docker on this Mac: bundle on the server instead
      echo "     (retry with --use-api)"
      if supabase functions deploy "$fn" ${=flags} --use-api --project-ref "$REF" 2>&1 | clean | sed 's/^/     /'; then
        echo "     deployed in $((SECONDS - start)) s"
      else
        ERRORS+=("function $fn: the deploy failed")
      fi
    fi
  done
fi

# ---------------------------------------------------------------- 3. SQL
if [ "$DO_SQL" = 1 ]; then
  echo; echo ">> 3. SQL (start1 tables, start2 code, start3 pg_cron)"
  if ! "$REPO_DIR/kit8/sql/start/run_sql_cli.command" -y; then
    ERRORS+=("SQL: run_sql_cli.command failed (see kit8/sql/start/sql_errors.txt)")
  fi
fi
if [ "$DO_SEEDS" = 1 ]; then
  echo; echo ">> 3b. seeds (start4_sql_insert_missing.sql)"
  if ! supabase db query --linked --project-ref "$REF" -f "$REPO_DIR/kit8/sql/start/start4_sql_insert_missing.sql" 2>&1 | clean | tail -5 | sed 's/^/   /'; then
    ERRORS+=("seeds: start4 failed")
  fi
fi

# ---------------------------------------------------------------- 4. database settings of the cleanup tick
if [ "$DO_DB" = 1 ]; then
  echo; echo ">> 4. database settings of the files cleanup tick"
  if [ -n "$CLEANUP_VALUE" ]; then
    SQLF="$WORK/settings.sql"; ( umask 077; : > "$SQLF" )
    esc="$(printf '%s' "$CLEANUP_VALUE" | sed "s/'/''/g")"
    {
      echo "ALTER DATABASE postgres SET app.settings.files_function_url = '$BASE/functions/v1/files-drive';"
      echo "ALTER DATABASE postgres SET app.settings.files_cleanup_secret = '$esc';"
    } > "$SQLF"
    if supabase db query --linked --project-ref "$REF" -f "$SQLF" 2>&1 | clean | tail -3 | sed 's/^/   /'; then
      echo "   set (the pg_cron tick files_cleanup_tick can now call the function)"
    else
      ERRORS+=("database settings of the cleanup tick could not be set")
    fi
  else
    echo "   skipped: this run does not know the value of FILES_CLEANUP_SECRET (it exists in Supabase but not in .env)."
    echo "   Add  FILES_CLEANUP_SECRET=<the value>  to .env and run again, or set it by hand (README of files-drive, 'The pg_cron tick')."
  fi
fi

# ---------------------------------------------------------------- 5. checks
echo; echo ">> 5. checks"
if [ "$DO_FUNCTIONS" = 1 ]; then
  for fn in "${FUNCTIONS[@]}"; do
    code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' -X OPTIONS "$BASE/functions/v1/$fn" 2>/dev/null || echo 000)"
    case "$code" in
      2??|401|403|405) echo "   function $fn: answers (HTTP $code$([ "$code" = 401 ] && echo ", needs a signed-in user: as designed"))" ;;
      404) echo "   function $fn: NOT FOUND (HTTP 404) - not deployed?"; ERRORS+=("function $fn answers 404") ;;
      *) echo "   function $fn: HTTP $code"; ERRORS+=("function $fn answers HTTP $code") ;;
    esac
  done
fi
AIKEY="$(envval GOOGLE_AI_API_KEY)"
if [ -n "$AIKEY" ]; then
  code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' -H "x-goog-api-key: $AIKEY" 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1' 2>/dev/null || echo 000)"
  if [ "$code" = 200 ]; then echo "   Google AI key: valid (HTTP 200)"; else echo "   Google AI key: HTTP $code - the key is refused or the service is unreachable"; ERRORS+=("Google AI key check answered HTTP $code"); fi
fi
if exists_in_supabase FILES_TOKEN_KEY || [ -s "$GENERATED_FILE" ]; then echo "   files-drive secrets: present"; fi

# ---------------------------------------------------------------- what is left for YOU (nothing a script can do)
echo; hr
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "  STILL MISSING for end-to-end work (add to .env, then run this script again):"
  for m in "${MISSING[@]}"; do echo "    $m=..."; done
  echo
fi
echo "  By hand, once (cannot be done by a script):"
echo "   - Google Cloud: the OAuth client \"Files Drive (Edge Function)\" must have the redirect URI  $BASE/functions/v1/files-drive  and the Drive API enabled"
echo "   - OneDrive (optional): the Entra app needs the same redirect URI as a Web redirect, and its secret expiry in MICROSOFT_CLIENT_SECRET_EXPIRES"
echo "   - Google AI: restrict the key GOOGLE_AI_API_KEY in Google AI Studio / Cloud (it is also inside the app build through app.config.js extra)"
echo "   - Auth redirect URLs (Supabase Dashboard -> Authentication -> URL configuration) for every app scheme: see KNOW_HOW.md, 'Sign-in scheme'"
hr
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "  ${#ERRORS[@]} problem(s):"; for e in "${ERRORS[@]}"; do echo "    - $e"; done
  pause_end; exit 1
fi
echo "  DONE: secrets, functions, SQL and checks finished on project $REF."
echo "  The app needs a restart only when .env changed:  npx expo start --web -c"
pause_end
