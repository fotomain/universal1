#!/usr/bin/env bash
set -e

# Determine directories
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$DIR/../../.." && pwd)"

# Which app to deploy: first argument (appClothes1, appPM80, ...) or APP_NAME from the environment,
# default appClothes1 (what this script always deployed). Every app with a slug of its own has ITS OWN
# EAS project (extra.eas.projectId in app.config.js), so a deploy never overwrites another app's site.
APP="${1:-${APP_NAME:-appClothes1}}"
export APP_NAME="$APP"
EXPORT_DIR="dist/eas/$APP"

echo "=========================================================="
echo "🚀 EAS Web Deploy: Deploying to Global Expo Web Hosting"
echo "=========================================================="
echo "App              : $APP"
echo "Project Directory: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# Ensure Node, nvm, Homebrew, and EAS are in PATH when launched from macOS Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
elif [ -d "$HOME/.nvm/versions/node" ]; then
  LATEST_NODE=$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)
  if [ -n "$LATEST_NODE" ]; then
    export PATH="$HOME/.nvm/versions/node/$LATEST_NODE/bin:$PATH"
  fi
fi

# Fallback: source user zsh profile if needed
if [ -f "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc" 2>/dev/null || true
fi

# Verify tools
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js is not found in PATH."
  read -n 1 -s -r -p "Press any key to exit..."
  exit 1
fi

if ! command -v eas >/dev/null 2>&1; then
  echo "❌ Error: EAS CLI is not found. Install it with: npm install -g eas-cli"
  read -n 1 -s -r -p "Press any key to exit..."
  exit 1
fi

echo "Node Version : $(node -v)"
echo "EAS CLI      : $(eas --version | head -n 1)"
echo "Account      : $(eas whoami 2>/dev/null | head -n 1 || echo 'Not logged in')"

# Read slug / EAS project of the chosen app from app.config.js (APP_NAME is exported above)
APP_SLUG="$(node -e "console.log(require('./app.config.js').expo.slug)")"
APP_PROJECT_ID="$(node -e "console.log(((require('./app.config.js').expo.extra||{}).eas||{}).projectId||'')")"
if [ -z "$APP_PROJECT_ID" ]; then
  echo "❌ Error: app '$APP' has no EAS project id in app.config.js (create one: APP_NAME=$APP eas init)."
  read -n 1 -s -r -p "Press any key to exit..."
  exit 1
fi
echo "Slug         : $APP_SLUG"
echo "EAS project  : $APP_PROJECT_ID"
echo "=========================================================="

# Step 1: Export production web build
echo ""
echo "📦 Step 1/2: Exporting optimized web production bundle of $APP into $EXPORT_DIR ..."
npx expo export -p web --output-dir "$EXPORT_DIR"

# Step 2: Deploy to EAS Web Hosting with auto-retry for large bundles
echo ""
echo "🌐 Step 2/2: Deploying to EAS Web Hosting (Production)..."

MAX_RETRIES=3
RETRY=1
SUCCESS=0

while [ $RETRY -le $MAX_RETRIES ]; do
  if eas deploy --prod --non-interactive --export-dir "$EXPORT_DIR"; then
    SUCCESS=1
    break
  else
    echo ""
    echo "⚠️ Upload attempt $RETRY of $MAX_RETRIES encountered a transient network/server timeout."
    if [ $RETRY -lt $MAX_RETRIES ]; then
      echo "⏳ Retrying upload in 5 seconds..."
      sleep 5
    fi
    RETRY=$((RETRY + 1))
  fi
done

if [ $SUCCESS -ne 1 ]; then
  echo ""
  echo "❌ Error: Deployment failed after $MAX_RETRIES attempts."
  read -n 1 -s -r -p "Press any key to exit..."
  exit 1
fi

echo ""
echo "=========================================================="
echo "🎉 Deployment successfully published to Global EAS Web!"
echo "=========================================================="
echo "Production URL : https://$APP_SLUG.expo.app"
echo "Dashboard      : https://expo.dev/projects/$APP_PROJECT_ID/hosting/deployments"
echo "=========================================================="
echo ""

# Keep terminal open if clicked from Finder
read -n 1 -s -r -p "Done! Press any key to exit..."
echo ""
