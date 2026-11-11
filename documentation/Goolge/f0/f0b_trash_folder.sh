#!/usr/bin/env bash
# F0b item 3 (documentation/FILE_ATTACHMENT_WBS.html): what can the narrow scope drive.file do with a WHOLE FOLDER?
# The first live test (f0_wayc_spike.sh) found: files.delete on a folder with children = 403 appNotAuthorizedToChild, even when only empty app-made folders were left.
# This script asks the open questions in isolation, with ONE account and a token with ONLY https://www.googleapis.com/auth/drive.file:
#   T1 delete a folder that has ONE EMPTY sub folder (top-down)            T2 delete an EMPTY folder
#   T3 trash a folder with a sub folder and a file (one call)              T4 after T3: list the children / read the file / delete the trashed folder permanently
#   T5 delete a folder that has ONE FILE (top-down)                        T6 delete leaf first then the folder (the known-good way)
# Everything it makes is removed at the end (bottom-up). TOKEN_A is read from the environment only.
set -u
API=${F0_API_BASE:-https://www.googleapis.com/drive/v3}
: "${TOKEN_A:?set TOKEN_A (scope drive.file only)}"
command -v jq >/dev/null || { echo "missing: jq"; exit 2; }
TMP=$(mktemp); RUN=$(date +%s); MADE=()
CODE=0
call() { local m=$1 u=$2 d=${3:-}
  if [ -n "$d" ]; then CODE=$(curl -s -o "$TMP" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' -d "$d" "$u")
  else CODE=$(curl -s -o "$TMP" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $TOKEN_A" "$u"); fi; }
reason() { jq -r '.error.errors[0].reason // .error.message // empty' "$TMP" 2>/dev/null | head -c 80; }
mkf() { call POST "$API/files?fields=id" "{\"name\":\"$1\",\"mimeType\":\"application/vnd.google-apps.folder\"${2:+,\"parents\":[\"$2\"]}}"; local id; id=$(jq -r '.id // empty' "$TMP"); MADE+=("$id"); echo "$id"; }
mkfile() { call POST "$API/files?fields=id" "{\"name\":\"$1\",\"mimeType\":\"text/plain\",\"parents\":[\"$2\"]}"; local id; id=$(jq -r '.id // empty' "$TMP"); MADE+=("$id"); echo "$id"; }
del() { call DELETE "$API/files/$1"; }
out() { printf '%-4s %-62s HTTP %s %s\n' "$1" "$2" "$3" "$4"; }
cleanup() { echo "-- cleanup (bottom-up, every id that was made, newest first)"; for ((i=${#MADE[@]}-1;i>=0;i--)); do [ -n "${MADE[$i]}" ] && del "${MADE[$i]}"; done; rm -f "$TMP"; }
trap cleanup EXIT

echo "== F0b trash / delete of folders with drive.file, run $RUN"
A=$(mkf "f0b-A-$RUN"); AS=$(mkf "sub" "$A"); del "$A"; out T1 "files.delete on a folder with ONE EMPTY sub folder (top-down)" "$CODE" "$(reason)"
B=$(mkf "f0b-B-$RUN"); del "$B"; out T2 "files.delete on an EMPTY folder" "$CODE" "$(reason)"
C=$(mkf "f0b-C-$RUN"); CS=$(mkf "sub" "$C"); CF=$(mkfile "a.txt" "$CS")
call PATCH "$API/files/$C?fields=id,trashed" '{"trashed":true}'; out T3 "trash a folder with a sub folder and a file (ONE call)" "$CODE" "$(reason) $(jq -r '.trashed // empty' "$TMP")"
call GET "$API/files/$CF?fields=id,trashed"; out T4a "read the file inside the trashed folder" "$CODE" "trashed=$(jq -r '.trashed // empty' "$TMP")"
del "$C"; out T4b "files.delete on the TRASHED folder (permanent)" "$CODE" "$(reason)"
call GET "$API/files/$CF?fields=id"; out T4c "the file after the permanent delete of its folder" "$CODE" "(404 = gone with it)"
D=$(mkf "f0b-D-$RUN"); DF=$(mkfile "a.txt" "$D"); del "$D"; out T5 "files.delete on a folder with ONE FILE (top-down)" "$CODE" "$(reason)"
E=$(mkf "f0b-E-$RUN"); ES=$(mkf "sub" "$E"); EF=$(mkfile "a.txt" "$ES"); del "$EF"; a=$CODE; del "$ES"; b=$CODE; del "$E"; c=$CODE
out T6 "bottom-up: file / sub folder / folder" "$a/$b/$c" "(204/204/204 = the known-good way)"
echo; echo "Read: T1/T2/T5 tell whether ANY folder delete works with drive.file; T3/T4 whether the function may TRASH a whole folder (one call) and then delete it for good."
