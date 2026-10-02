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

# Helper function: Rebuild corrupt git index
repair_corrupt_index() {
    echo "      Healing/rebuilding git index (.git/index)..."
    rm -f .git/index .git/index.lock 2>/dev/null || true
    find .git -name "*.lock" -delete 2>/dev/null || true
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
        git reset HEAD 2>/dev/null || git reset 2>/dev/null || true
    fi
}

# Helper function: Check if git index is healthy
check_and_heal_index() {
    # Check index file size if it exists (valid index header is >= 12 bytes)
    if [ -f ".git/index" ]; then
        INDEX_SIZE=$(wc -c < .git/index 2>/dev/null | tr -d ' ' || echo 0)
        if [ -n "$INDEX_SIZE" ] && [ "$INDEX_SIZE" -lt 12 ]; then
            echo "      Detected truncated/invalid .git/index (${INDEX_SIZE} bytes)."
            repair_corrupt_index
            return
        fi
    fi

    # Run quick status check to catch index file corruption
    HEALTH_OUTPUT=$(git status --porcelain 2>&1 || true)
    if echo "$HEALTH_OUTPUT" | grep -qi "smaller than expected\|bad index\|corrupt\|fatal: index"; then
        echo "      Detected corrupted index (${HEALTH_OUTPUT})."
        repair_corrupt_index
    fi
}

# -------------------------------------------------------------------------
# Step 0: Auto-resolve stale locks, hung processes, and corrupted index
# Fixes errors:
#   - Unable to create '.git/index.lock': File exists
#   - fatal: .git/index: index file smaller than expected
# -------------------------------------------------------------------------
echo "[0/5] Checking repository health & clearing stale locks..."

# 0.1 Terminate any hanging git processes locking this repository
CURRENT_PID=$$
for pid in $(pgrep -f "git " 2>/dev/null || true); do
    if [ "$pid" != "$CURRENT_PID" ]; then
        PROC_CWD=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep "^n/" | grep "$REPO_DIR" || true)
        if [ -n "$PROC_CWD" ]; then
            echo "      Terminating hanging git process (PID: $pid)..."
            kill -15 "$pid" 2>/dev/null || true
            sleep 0.5
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

# 0.3 Verify and heal corrupt index
check_and_heal_index
echo "      ✓ Git repository unlocked and clean."

# -------------------------------------------------------------------------
# Step 1: Ensure Git repository initialized & Remote Origin configured
# -------------------------------------------------------------------------
if [ ! -d ".git" ] || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[1/5] Initializing Git repository..."
    git init
fi

# Clean up any leftover temporary snapshot remotes
if git remote 2>/dev/null | grep -q "^expo_snap$"; then
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
if ! git checkout -B "$BRANCH_NAME" 2>&1; then
    echo "      Checkout encountered issue. Healing index and retrying..."
    repair_corrupt_index
    git checkout -B "$BRANCH_NAME"
fi

# -------------------------------------------------------------------------
# Step 3: Stage workspace files (with auto-healing and retry)
# -------------------------------------------------------------------------
echo "[3/5] Staging workspace files..."
find .git -name "*.lock" -delete 2>/dev/null || true

STAGE_ATTEMPTS=0
STAGE_SUCCESS=0
while [ $STAGE_ATTEMPTS -lt 3 ]; do
    STAGE_OUTPUT=$(git add -A 2>&1) && STAGE_SUCCESS=1
    if [ $STAGE_SUCCESS -eq 1 ]; then
        break
    else
        STAGE_ATTEMPTS=$((STAGE_ATTEMPTS + 1))
        echo "      Staging attempt $STAGE_ATTEMPTS failed: $STAGE_OUTPUT"
        find .git -name "*.lock" -delete 2>/dev/null || true
        if echo "$STAGE_OUTPUT" | grep -qi "smaller than expected\|bad index\|corrupt\|index"; then
            echo "      Repairing corrupted index before retry..."
            repair_corrupt_index
        fi
        sleep 1
    fi
done

if [ $STAGE_SUCCESS -ne 1 ]; then
    echo "      [!] Emergency repair: Re-initializing git index..."
    repair_corrupt_index
    git add -A || {
        echo "      [!] Critical: Re-initializing git workspace..."
        git init
        git remote add "$REMOTE_NAME" "$REMOTE_URL" 2>/dev/null || git remote set-url "$REMOTE_NAME" "$REMOTE_URL" 2>/dev/null || true
        git checkout -B "$BRANCH_NAME"
        git add -A
    }
fi

# -------------------------------------------------------------------------
# Step 4: Commit changes
# -------------------------------------------------------------------------
COMMIT_MSG="${1:-Save codebase to branch: ${BRANCH_NAME} [$(date '+%Y-%m-%d %H:%M:%S')]}"

# Check if anything is staged
check_and_heal_index

if git diff --cached --quiet 2>/dev/null; then
    echo "[4/5] Working tree clean. Creating checkpoint commit..."
    git commit --allow-empty -m "$COMMIT_MSG"
else
    echo "[4/5] Committing changes: \"${COMMIT_MSG}\""
    if ! git commit -m "$COMMIT_MSG" 2>&1; then
        echo "      Commit encountered issue. Repairing and retrying commit..."
        repair_corrupt_index
        git add -A
        git commit -m "$COMMIT_MSG"
    fi
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
