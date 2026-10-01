#!/bin/zsh
# =========================================================================
# UNIVERSAL1 Expo App — Save Codebase to GitHub
# Target Repo: expo-YYYY-MM-DD-HH-MM
# =========================================================================

set -eo pipefail

# Change directory to repo root
cd "$(dirname "$0")"
REPO_DIR="$(pwd)"

echo "=============================================================================="
echo "  UNIVERSAL1 EXPO APP: SAVE CODEBASE TO GITHUB"
echo "  Directory : ${REPO_DIR}"
echo "  Time      : $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================================================="

# -------------------------------------------------------------------------
# Step 0: Auto-resolve stale locks and hung Git processes
# -------------------------------------------------------------------------
echo "[0/5] Checking repository health & clearing stale locks..."

# 1. Terminate any hung git processes locking this repository
CURRENT_PID=$$
GIT_PIDS=$(pgrep -f "git " 2>/dev/null | tr '\n' ' ' || true)
if [ -n "$GIT_PIDS" ]; then
    for pid in ${(z)GIT_PIDS}; do
        if [ "$pid" != "$CURRENT_PID" ]; then
            PROC_CWD=$(lsof -p "$pid" -Fn 2>/dev/null | grep "^n/" | grep "$REPO_DIR" || true)
            if [ -n "$PROC_CWD" ]; then
                echo "      Terminating hanging git process (PID: $pid)..."
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
    done
fi

# 2. Force remove all lock files in .git
STALE_LOCKS=$(find .git -name "*.lock" 2>/dev/null || true)
if [ -n "$STALE_LOCKS" ]; then
    echo "      Removing stale lock files:"
    for lock_file in ${(f)STALE_LOCKS}; do
        echo "       - $lock_file"
        rm -f "$lock_file"
    done
fi
find .git -name "*.lock" -delete 2>/dev/null || true
echo "      ✓ Git repository unlocked and ready."

# -------------------------------------------------------------------------
# Step 1: Ensure Git repository initialized
# -------------------------------------------------------------------------
if [ ! -d ".git" ]; then
    echo "[1/5] Initializing Git repository..."
    git init
else
    echo "[1/5] Git repository verified."
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main1")
if [ "$CURRENT_BRANCH" = "HEAD" ] || [ -z "$CURRENT_BRANCH" ]; then
    CURRENT_BRANCH="main1"
fi

# -------------------------------------------------------------------------
# Step 2: Generate Timestamped Repo Name: expo-YYYY-MM-DD-HH-MM
# -------------------------------------------------------------------------
TIMESTAMP=$(date +'%Y-%m-%d-%H-%M')
REPO_NAME="expo-${TIMESTAMP}"
echo "[2/5] Target Repository: ${REPO_NAME}"

# Retrieve GitHub Token from git credentials / environment
TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ]; then
    TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill 2>/dev/null | awk -F= '$1=="password"{print $2}')
fi

GH_USER="fotomain"
if [ -n "$TOKEN" ]; then
    API_USER=$(curl -s -H "Authorization: token $TOKEN" https://api.github.com/user 2>/dev/null | awk -F'"' '/"login":/{print $4; exit}')
    if [ -n "$API_USER" ]; then
        GH_USER="$API_USER"
    fi
    echo "      Authenticated as GitHub user: ${GH_USER}"
    echo "      Creating GitHub repository: ${GH_USER}/${REPO_NAME}..."
    HTTP_STATUS=$(curl -s -o /tmp/gh_repo_create.json -w "%{http_code}" \
        -X POST \
        -H "Authorization: token $TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        https://api.github.com/user/repos \
        -d "{\"name\":\"${REPO_NAME}\",\"private\":true,\"description\":\"Snapshot ${REPO_NAME}\"}")
    if [ "$HTTP_STATUS" = "201" ]; then
        echo "      ✓ Created new repository: https://github.com/${GH_USER}/${REPO_NAME}"
    elif [ "$HTTP_STATUS" = "422" ]; then
        echo "      ℹ Repository https://github.com/${GH_USER}/${REPO_NAME} already exists."
    else
        echo "      ℹ GitHub API response: ${HTTP_STATUS}"
    fi
else
    echo "      Warning: GitHub token not found in keychain, attempting push directly."
fi

TARGET_REMOTE_URL="https://github.com/${GH_USER}/${REPO_NAME}.git"

# Add or update the snapshot remote
if git remote | grep -q "^expo_snap$"; then
    git remote set-url expo_snap "$TARGET_REMOTE_URL"
else
    git remote add expo_snap "$TARGET_REMOTE_URL"
fi

# -------------------------------------------------------------------------
# Step 3: Stage workspace files (auto-clearing locks if any)
# -------------------------------------------------------------------------
echo "[3/5] Staging workspace files..."
find .git -name "*.lock" -delete 2>/dev/null || true

STAGE_ATTEMPTS=0
while [ $STAGE_ATTEMPTS -lt 3 ]; do
    if git add -A; then
        break
    else
        STAGE_ATTEMPTS=$((STAGE_ATTEMPTS + 1))
        echo "      Staging attempt $STAGE_ATTEMPTS failed, clearing locks and retrying..."
        find .git -name "*.lock" -delete 2>/dev/null || true
        sleep 1
    fi
done

# -------------------------------------------------------------------------
# Step 4: Commit changes
# -------------------------------------------------------------------------
COMMIT_MSG="${1:-Auto save: ${REPO_NAME} [$(date '+%Y-%m-%d %H:%M:%S')]}"

if git diff --staged --quiet; then
    echo "[4/5] Working tree clean, creating checkpoint commit..."
    git commit --allow-empty -m "$COMMIT_MSG"
else
    echo "[4/5] Committing changes: \"${COMMIT_MSG}\""
    git commit -m "$COMMIT_MSG"
fi

# -------------------------------------------------------------------------
# Step 5: Push to GitHub target repo & origin
# -------------------------------------------------------------------------
echo "[5/5] Pushing codebase to https://github.com/${GH_USER}/${REPO_NAME}.git..."

PUSH_SUCCESS=0
for attempt in 1 2 3; do
    echo "      Pushing to ${TARGET_REMOTE_URL} (attempt ${attempt}/3)..."
    if git push -u expo_snap "${CURRENT_BRANCH}:main" --force 2>/dev/null || git push -u expo_snap HEAD:main 2>/dev/null; then
        PUSH_SUCCESS=1
        break
    else
        echo "      Push attempt ${attempt} failed. Retrying..."
        find .git -name "*.lock" -delete 2>/dev/null || true
        sleep 2
    fi
done

# Also push to origin universal1 if available
if git remote | grep -q "^origin$"; then
    echo "      Synchronizing with origin (universal1)..."
    git push origin "$CURRENT_BRANCH" 2>/dev/null || true
    git push origin "${CURRENT_BRANCH}:${REPO_NAME}" 2>/dev/null || true
fi

echo ""
echo "=============================================================================="
if [ $PUSH_SUCCESS -eq 1 ]; then
    echo "  [✓] SUCCESSFULLY SAVED TO REPO: ${REPO_NAME}"
    echo "  • GitHub URL : https://github.com/${GH_USER}/${REPO_NAME}"
    echo "  • Commit     : $(git rev-parse --short HEAD)"
    echo "  • Branch     : main"
else
    echo "  [!] Snapshot created locally, but remote push encountered issues."
    echo "  • Commit     : $(git rev-parse --short HEAD)"
fi
echo "=============================================================================="

# Keep window open if double-clicked from macOS Finder interactively
if [ -t 0 ] && [ -z "${NON_INTERACTIVE:-}" ]; then
    echo ""
    read -k 1 -s "?Press any key to close this window..." 2>/dev/null || read -n 1 -s -r -p "Press any key to close this window..." 2>/dev/null || true
    echo ""
fi
