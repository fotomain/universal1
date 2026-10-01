#!/bin/zsh
# =========================================================================
# UNIVERSAL1 Expo App — Save to Branch of universal1: expo-YYYY-MM-DD-HH-MM
# Target Remote : https://github.com/fotomain/universal1.git
# Target Branch : expo-YYYY-MM-DD-HH-MM
# =========================================================================

set -eo pipefail

# Ensure standard system and Homebrew binaries are in PATH when launched from macOS Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# 1. Resolve repository directory
cd "$(dirname "$0")"
REPO_DIR="$(pwd)"

REMOTE_NAME="origin"
REMOTE_URL="https://github.com/fotomain/universal1.git"
TIMESTAMP=$(date +'%Y-%m-%d-%H-%M')
BRANCH_NAME="expo-${TIMESTAMP}"

echo "=============================================================================="
echo "  UNIVERSAL1 -> GITHUB SAVE UTILITY"
echo "  Directory     : ${REPO_DIR}"
echo "  Remote URL    : ${REMOTE_URL}"
echo "  Target Branch : ${BRANCH_NAME}"
echo "  Timestamp     : $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================================================="

# -------------------------------------------------------------------------
# Step 0: Auto-resolve stale locks and hung Git processes
# Fixes error: Unable to create '.git/index.lock': File exists
# -------------------------------------------------------------------------
echo "[0/5] Checking repository health & clearing stale locks..."

# 0.1 Terminate any hanging git processes locking this repository
CURRENT_PID=$$
for pid in $(pgrep -f "git " 2>/dev/null || true); do
    if [ "$pid" != "$CURRENT_PID" ]; then
        PROC_CWD=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep "^n/" | grep "$REPO_DIR" || true)
        if [ -n "$PROC_CWD" ]; then
            echo "      Terminating hanging git process (PID: $pid)..."
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
done

# 0.2 Safely remove all stale lock files (.git/index.lock, .git/refs/**/*.lock, etc.)
find .git -name "*.lock" 2>/dev/null | while IFS= read -r lock_file; do
    if [ -n "$lock_file" ]; then
        echo "      Removing stale lock: $lock_file"
        rm -f "$lock_file" 2>/dev/null || true
    fi
done
rm -f .git/index.lock 2>/dev/null || true
find .git -name "*.lock" -delete 2>/dev/null || true
echo "      ✓ Git repository unlocked and clean."

# -------------------------------------------------------------------------
# Step 1: Ensure Git repository initialized & Remote Origin configured
# -------------------------------------------------------------------------
if [ ! -d ".git" ]; then
    echo "[1/5] Initializing Git repository..."
    git init
fi

# Clean up any leftover temporary snapshot remotes
if git remote | grep -q "^expo_snap$"; then
    git remote remove expo_snap 2>/dev/null || true
fi

CURRENT_REMOTE=$(git remote get-url "$REMOTE_NAME" 2>/dev/null || true)
if [ -z "$CURRENT_REMOTE" ]; then
    echo "[1/5] Adding remote ${REMOTE_NAME}: ${REMOTE_URL}"
    git remote add "$REMOTE_NAME" "$REMOTE_URL"
elif [[ "$CURRENT_REMOTE" != *"universal1"* ]]; then
    echo "[1/5] Updating remote ${REMOTE_NAME} to: ${REMOTE_URL}"
    git remote set-url "$REMOTE_NAME" "$REMOTE_URL"
else
    echo "[1/5] Remote ${REMOTE_NAME} verified: ${CURRENT_REMOTE}"
fi

# -------------------------------------------------------------------------
# Step 2: Create and switch to target branch expo-YYYY-MM-DD-HH-MM
# -------------------------------------------------------------------------
echo "[2/5] Creating and switching to chronological branch: ${BRANCH_NAME}..."
git checkout -B "$BRANCH_NAME"

# -------------------------------------------------------------------------
# Step 3: Stage workspace files (with auto-retry and lock clearance)
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
COMMIT_MSG="${1:-Save codebase to branch: ${BRANCH_NAME} [$(date '+%Y-%m-%d %H:%M:%S')]}"

if git diff --cached --quiet; then
    echo "[4/5] Working tree clean. Creating checkpoint commit..."
    git commit --allow-empty -m "$COMMIT_MSG"
else
    echo "[4/5] Committing changes: \"${COMMIT_MSG}\""
    git commit -m "$COMMIT_MSG"
fi

# -------------------------------------------------------------------------
# Step 5: Push to universal1 on branch expo-YYYY-MM-DD-HH-MM
# -------------------------------------------------------------------------
echo "[5/5] Pushing branch '${BRANCH_NAME}' to ${REMOTE_NAME} (universal1)..."

PUSH_SUCCESS=0
for attempt in 1 2 3; do
    echo "      Pushing to ${REMOTE_NAME}/${BRANCH_NAME} (attempt ${attempt}/3)..."
    find .git -name "*.lock" -delete 2>/dev/null || true
    if git push -u "$REMOTE_NAME" "$BRANCH_NAME"; then
        PUSH_SUCCESS=1
        break
    else
        echo "      Push attempt ${attempt} failed. Retrying..."
        find .git -name "*.lock" -delete 2>/dev/null || true
        sleep 2
    fi
done

echo ""
echo "=============================================================================="
if [ $PUSH_SUCCESS -eq 1 ]; then
    echo "  [✓] SUCCESSFULLY SAVED TO BRANCH: ${BRANCH_NAME}"
    echo "  • Repository : ${REMOTE_URL}"
    echo "  • Branch     : ${BRANCH_NAME}"
    echo "  • Commit     : $(git rev-parse --short HEAD)"
    echo "  • GitHub URL : https://github.com/fotomain/universal1/tree/${BRANCH_NAME}"
else
    echo "  [!] Committed locally, but push failed after 3 attempts."
    echo "  • Branch     : ${BRANCH_NAME}"
    echo "  • Commit     : $(git rev-parse --short HEAD)"
fi
echo "=============================================================================="

# Keep window open if double-clicked from macOS Finder interactively
if [ -t 0 ] && [ -z "${NON_INTERACTIVE:-}" ]; then
    echo ""
    read -k 1 -s "?Press any key to close this window..." 2>/dev/null || read -n 1 -s -r -p "Press any key to close this window..." 2>/dev/null || true
    echo ""
fi
