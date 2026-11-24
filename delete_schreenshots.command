#!/bin/zsh
# =========================================================================
# UNIVERSAL1 - delete the macOS screenshots (NO question, permanent: rm, not the Trash)
#   Folder : where macOS saves screenshots (defaults read com.apple.screencapture location), else ~/Desktop.
#            SCREENSHOT_DIR=/some/folder ./delete_schreenshots.command   another folder
#   Files  : only the screenshot files of that folder (not its sub folders, nothing else):
#            "Screenshot *.png|jpg|jpeg|heic|tiff"  and the older  "Screen Shot *.png|jpg|jpeg|heic|tiff"
#   Also  : the photos of the app in the Documents folder: "photo_*.*" (a photo taken by the app and saved there). Folder ~/Documents,
#            PHOTO_DIR=/some/folder ./delete_schreenshots.command   another folder. Only files of that folder, not its sub folders.
#   ./delete_schreenshots.command --dry    only lists what would be deleted
# =========================================================================

set -eo pipefail
setopt null_glob

DRY=0
for a in "$@"; do
  case "$a" in
    --dry|--dry-run) DRY=1 ;;
    *) echo "unknown option: $a (use --dry)"; exit 2 ;;
  esac
done

pause_end() { if [ -t 0 ]; then echo; read -k 1 "?Press any key to close..."; echo; fi; }

DIR="${SCREENSHOT_DIR:-}"
[ -n "$DIR" ] || DIR="$(defaults read com.apple.screencapture location 2>/dev/null || true)"
[ -n "$DIR" ] || DIR="$HOME/Desktop"
DIR="${DIR/#\~/$HOME}"
[ -d "$DIR" ] || { echo "FAILED: the folder does not exist: $DIR"; pause_end; exit 1; }

FILES=()
for ext in png jpg jpeg heic tiff; do
  for f in "$DIR"/Screenshot\ *.$ext "$DIR"/Screen\ Shot\ *.$ext; do
    [ -f "$f" ] && FILES+=("$f")
  done
done

# the photos in Documents: photo_*.*  (a folder that does not exist is skipped, it is no error)
PHOTO_FOLDER="${PHOTO_DIR:-$HOME/Documents}"
PHOTO_FOLDER="${PHOTO_FOLDER/#\~/$HOME}"
PHOTOS=()
if [ -d "$PHOTO_FOLDER" ]; then
  for f in "$PHOTO_FOLDER"/photo_*.*; do
    [ -f "$f" ] && PHOTOS+=("$f")
  done
fi

echo "Folder: $DIR"
[ -d "$PHOTO_FOLDER" ] && echo "Photos: $PHOTO_FOLDER (photo_*.*)" || echo "Photos: $PHOTO_FOLDER does not exist, skipped"
if [ ${#FILES[@]} -eq 0 ] && [ ${#PHOTOS[@]} -eq 0 ]; then echo "No screenshots and no photo_*.* files found."; pause_end; exit 0; fi

if [ "$DRY" = 1 ]; then
  for f in "${FILES[@]}"; do echo "  would delete: ${f:t}"; done
  for f in "${PHOTOS[@]}"; do echo "  would delete photo: ${f:t}"; done
  echo "(dry run: ${#FILES[@]} screenshot(s) + ${#PHOTOS[@]} photo(s), nothing was deleted)"
  pause_end; exit 0
fi

for f in "${FILES[@]}"; do rm -f -- "$f"; done
for f in "${PHOTOS[@]}"; do rm -f -- "$f"; done
echo "Deleted ${#FILES[@]} screenshot file(s) and ${#PHOTOS[@]} photo_*.* file(s) of Documents."
pause_end
