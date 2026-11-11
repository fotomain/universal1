#!/usr/bin/env bash
# F0 spike of documentation/FILE_ATTACHMENT_WBS.html: what Google Drive REALLY does for two members of a Shared drive.
# Reads and writes ONLY inside a test Shared drive "kit8-f0-spike" (or the one you give) and one test folder in A's My Drive; removes everything it made at the end.
# Needs: curl, jq, uuidgen. The access tokens come from the OAuth 2.0 Playground (see GOOGLE_DRIVE_HOW_IT_WORKS.html, section 10). Tokens are read from the environment only.
#
#   TOKEN_A        required  access token of account A (scope .../auth/drive) - A is/will be ORGANIZER of the Shared drive
#   TOKEN_B        required  access token of account B (scope .../auth/drive)
#   EMAIL_B        required  e-mail of account B
#   ROLE_B         optional  role given to B in the drive: reader | commenter | writer | fileOrganizer (default) | organizer
#   TOKEN_B_FILE   optional  B's token with ONLY .../auth/drive.file  (test T4b)
#   TOKEN_A_OTHER  optional  A's token from ANOTHER OAuth client (test T9: properties vs appProperties across clients)
#   DRIVE_ID       optional  an existing Shared drive where A is organizer (default: the script creates one and deletes it at the end)
#   DRIVE_ID2      optional  a second Shared drive where A is organizer (test T11b: move a folder between two Shared drives)
#   RUN_MYDRIVE    optional  1 = also run T12 (My Drive: what does the owner delete when a folder holds files of others)
set -u
API=${F0_API_BASE:-https://www.googleapis.com/drive/v3}   # F0_API_BASE only for a local dry run
: "${TOKEN_A:?set TOKEN_A}" "${TOKEN_B:?set TOKEN_B}" "${EMAIL_B:?set EMAIL_B}"
ROLE_B=${ROLE_B:-fileOrganizer}
TOKEN_B_FILE=${TOKEN_B_FILE:-}; TOKEN_A_OTHER=${TOKEN_A_OTHER:-}; DRIVE_ID=${DRIVE_ID:-}; DRIVE_ID2=${DRIVE_ID2:-}; RUN_MYDRIVE=${RUN_MYDRIVE:-0}
for c in curl jq uuidgen; do command -v "$c" >/dev/null || { echo "missing: $c"; exit 2; }; done
TMP=$(mktemp); RESULTS=$(mktemp); RUN=$(uuidgen | tr 'A-Z' 'a-z' | cut -c1-8)
CREATED_DRIVE=0; ROOT_FOLDER=""; MYD_FOLDER=""

CODE=0
call() { # method token url [json]  -> CODE, body in $TMP
  local m=$1 t=$2 u=$3 d=${4:-}
  if [ -n "$d" ]; then CODE=$(curl -s -o "$TMP" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$d" "$u")
  else CODE=$(curl -s -o "$TMP" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $t" "$u"); fi
}
list() { # token q [driveId]  -> CODE, body in $TMP  (searches inside the Shared drive)
  local t=$1 q=$2 d=${3:-$DRIVE_ID}
  CODE=$(curl -s -G -o "$TMP" -w '%{http_code}' -H "Authorization: Bearer $t" --data-urlencode "q=$q" \
    --data-urlencode "corpora=drive" --data-urlencode "driveId=$d" --data-urlencode "includeItemsFromAllDrives=true" \
    --data-urlencode "supportsAllDrives=true" --data-urlencode "fields=files(id,name,properties,trashed)" "$API/files")
}
reason() { jq -r '.error.errors[0].reason // .error.message // empty' "$TMP" 2>/dev/null | head -c 120; }
rec() { printf '%s\n' "$1" >> "$RESULTS"; printf '%s\n' "$1"; }
pass() { rec "$1|PASS|$2"; }
fail() { rec "$1|FAIL|$2"; }
info() { rec "$1|INFO|$2"; }
mkfolder() { # token name parent [extra json fields]
  local extra=${4:-}
  call POST "$1" "$API/files?supportsAllDrives=true&fields=id" "{\"name\":\"$2\",\"mimeType\":\"application/vnd.google-apps.folder\"${3:+,\"parents\":[\"$3\"]}$extra}"
  jq -r '.id // empty' "$TMP"
}
mkfile() { # token name parent
  call POST "$1" "$API/files?supportsAllDrives=true&fields=id" "{\"name\":\"$2\",\"mimeType\":\"text/plain\",\"parents\":[\"$3\"]}"
  jq -r '.id // empty' "$TMP"
}

cleanup() {
  echo "-- cleanup"
  [ -n "$MYD_FOLDER" ] && call DELETE "$TOKEN_A" "$API/files/$MYD_FOLDER?supportsAllDrives=true"
  [ -n "$ROOT_FOLDER" ] && call DELETE "$TOKEN_A" "$API/files/$ROOT_FOLDER?supportsAllDrives=true"
  if [ "$CREATED_DRIVE" = 1 ] && [ -n "$DRIVE_ID" ]; then
    list "$TOKEN_A" "trashed = true" >/dev/null 2>&1
    for id in $(jq -r '.files[]?.id' "$TMP" 2>/dev/null); do call DELETE "$TOKEN_A" "$API/files/$id?supportsAllDrives=true"; done
    call DELETE "$TOKEN_A" "$API/drives/$DRIVE_ID"; echo "   test Shared drive deleted: HTTP $CODE"
  fi
  rm -f "$TMP"
}
trap cleanup EXIT

echo "== F0 spike, run $RUN, role of B = $ROLE_B"
# T1 Shared drive: create (question 4) or use the given one
if [ -z "$DRIVE_ID" ]; then
  call POST "$TOKEN_A" "$API/drives?requestId=$(uuidgen)" "{\"name\":\"kit8-f0-spike-$RUN\"}"
  DRIVE_ID=$(jq -r '.id // empty' "$TMP")
  if [ -n "$DRIVE_ID" ]; then CREATED_DRIVE=1; pass T1 "A can create a Shared drive (drives.create HTTP $CODE) - Q4/Q17: the app may create it"
  else fail T1 "A cannot create a Shared drive (HTTP $CODE $(reason)) - the Workspace administrator must make it; set DRIVE_ID and run again"; exit 1; fi
else
  call GET "$TOKEN_A" "$API/drives/$DRIVE_ID"
  [ "$CODE" = 200 ] && info T1 "using the given Shared drive $DRIVE_ID (HTTP 200)" || { fail T1 "cannot read the drive (HTTP $CODE $(reason))"; exit 1; }
fi
# T2 A makes kit8root with a property mark (S2)
ROOT_FOLDER=$(mkfolder "$TOKEN_A" "kit8root-$RUN" "$DRIVE_ID" ",\"properties\":{\"kit8Kind\":\"root\",\"kit8Run\":\"$RUN\"},\"description\":\"F0 spike\"")
[ -n "$ROOT_FOLDER" ] && pass T2 "A made the folder with properties + description (HTTP $CODE)" || { fail T2 "A cannot make the folder (HTTP $CODE $(reason))"; exit 1; }
# T3 A adds B to the Shared drive
call POST "$TOKEN_A" "$API/files/$DRIVE_ID/permissions?supportsAllDrives=true&sendNotificationEmail=false" "{\"type\":\"user\",\"role\":\"$ROLE_B\",\"emailAddress\":\"$EMAIL_B\"}"
[ "$CODE" = 200 ] && pass T3 "A added B as $ROLE_B (HTTP 200)" || { fail T3 "A could not add B as $ROLE_B (HTTP $CODE $(reason)) - external accounts may be blocked (question 5)"; exit 1; }
sleep 3
# T4 B finds A's folder by its property (question 1, scope drive)
list "$TOKEN_B" "properties has { key='kit8Kind' and value='root' } and trashed = false"
if jq -e --arg id "$ROOT_FOLDER" '.files[]? | select(.id==$id)' "$TMP" >/dev/null 2>&1; then pass T4 "B (scope drive) FOUND A's folder by property (HTTP $CODE)"; else fail T4 "B did not find A's folder (HTTP $CODE $(reason))"; fi
if [ -n "$TOKEN_B_FILE" ]; then
  list "$TOKEN_B_FILE" "properties has { key='kit8Kind' and value='root' } and trashed = false"
  if jq -e --arg id "$ROOT_FOLDER" '.files[]? | select(.id==$id)' "$TMP" >/dev/null 2>&1; then info T4b "B with drive.file FOUND it - the narrow scope is enough"; else info T4b "B with drive.file did NOT find it (HTTP $CODE $(reason)) - the scope drive is needed (documented)"; fi
else info T4b "skipped (no TOKEN_B_FILE)"; fi
# T5 B makes a file in A's folder; A makes one too
B_FILE=$(mkfile "$TOKEN_B" "b_file.txt" "$ROOT_FOLDER"); [ -n "$B_FILE" ] && pass T5 "B can create a file in the folder (HTTP $CODE)" || info T5 "B cannot create a file as $ROLE_B (HTTP $CODE $(reason)) - expected for reader/commenter"
A_FILE=$(mkfile "$TOKEN_A" "a_file.txt" "$ROOT_FOLDER")
C_FILE=$(mkfile "$TOKEN_A" "c_file.txt" "$ROOT_FOLDER")
# T6 B sees A's files
list "$TOKEN_B" "'$ROOT_FOLDER' in parents and trashed = false"
n=$(jq '[.files[]?] | length' "$TMP" 2>/dev/null || echo 0)
[ "${n:-0}" -ge 2 ] && pass T6 "B lists $n files made by A and B in the folder" || fail T6 "B sees only $n file(s) in the folder (HTTP $CODE)"
# T7 B on its own file: permanent delete (organizer only) vs trash (fileOrganizer, organizer)
if [ -n "$B_FILE" ]; then
  call DELETE "$TOKEN_B" "$API/files/$B_FILE?supportsAllDrives=true"; d_code=$CODE; d_reason=$(reason)
  call PATCH "$TOKEN_B" "$API/files/$B_FILE?supportsAllDrives=true" '{"trashed":true}'; t_code=$CODE
  info T7 "B on its OWN file as $ROLE_B: files.delete HTTP $d_code $d_reason; trash HTTP $t_code  (documented: delete only organizer; trash fileOrganizer+)"
  [ "$d_code" = 204 ] && B_FILE=""
fi
# T8 B on A's file
call DELETE "$TOKEN_B" "$API/files/$A_FILE?supportsAllDrives=true"; d_code=$CODE; d_reason=$(reason)
call PATCH "$TOKEN_B" "$API/files/$A_FILE?supportsAllDrives=true" '{"trashed":true}'; t_code=$CODE
info T8 "B on A's file as $ROLE_B: files.delete HTTP $d_code $d_reason; trash HTTP $t_code"
# T8b A (organizer) permanently deletes both files, also the trashed ones
call DELETE "$TOKEN_A" "$API/files/$A_FILE?supportsAllDrives=true"; a1=$CODE
[ -n "$B_FILE" ] && { call DELETE "$TOKEN_A" "$API/files/$B_FILE?supportsAllDrives=true"; a2=$CODE; } || a2=n/a
[ "$a1" = 204 ] && pass T8b "A (organizer) permanently deleted the file of another member (HTTP 204; B's file: $a2)" || fail T8b "A could not delete permanently (HTTP $a1)"
# T9 properties vs appProperties across OAuth clients (question 3)
if [ -n "$TOKEN_A_OTHER" ]; then
  P=$(mkfolder "$TOKEN_A" "props-$RUN" "$ROOT_FOLDER" ",\"properties\":{\"kit8Pub\":\"public\"},\"appProperties\":{\"kit8Priv\":\"private\"}")
  call GET "$TOKEN_A_OTHER" "$API/files/$P?supportsAllDrives=true&fields=properties,appProperties"
  pub=$(jq -r '.properties.kit8Pub // empty' "$TMP"); priv=$(jq -r '.appProperties.kit8Priv // empty' "$TMP")
  if [ "$pub" = public ] && [ -z "$priv" ]; then pass T9 "second OAuth client sees properties, NOT appProperties (as documented)"; else info T9 "second client saw properties='$pub' appProperties='$priv' (HTTP $CODE)"; fi
else info T9 "skipped (no TOKEN_A_OTHER)"; fi
# T10 move a folder inside the drive
S1=$(mkfolder "$TOKEN_A" "sub1-$RUN" "$ROOT_FOLDER"); S2=$(mkfolder "$TOKEN_A" "sub2-$RUN" "$ROOT_FOLDER"); MV=$(mkfolder "$TOKEN_A" "mv-$RUN" "$S1")
call PATCH "$TOKEN_A" "$API/files/$MV?supportsAllDrives=true&addParents=$S2&removeParents=$S1" '{}'
[ "$CODE" = 200 ] && pass T10 "A moved a folder inside the Shared drive (HTTP 200, same id)" || fail T10 "A could not move a folder inside the drive (HTTP $CODE $(reason))"
call PATCH "$TOKEN_B" "$API/files/$MV?supportsAllDrives=true&addParents=$S1&removeParents=$S2" '{}'
info T10b "B as $ROLE_B moving the folder inside the drive: HTTP $CODE $(reason)  (documented: fileOrganizer and organizer may)"
# T11 My Drive folder -> Shared drive (documented: folders cannot), and a file
MYD_FOLDER=$(mkfolder "$TOKEN_A" "myd-folder-$RUN" "")
call PATCH "$TOKEN_A" "$API/files/$MYD_FOLDER?supportsAllDrives=true&addParents=$ROOT_FOLDER&removeParents=root" '{}'
if grep -q teamDrivesFolderMoveInNotSupported "$TMP"; then pass T11 "a My Drive FOLDER cannot be moved into the Shared drive (teamDrivesFolderMoveInNotSupported)"; else info T11 "moving a My Drive folder into the drive: HTTP $CODE $(reason) (documented: refused)"; fi
MYD_FILE=$(mkfile "$TOKEN_A" "myd-file-$RUN.txt" "root" 2>/dev/null)
if [ -n "$MYD_FILE" ]; then
  call PATCH "$TOKEN_A" "$API/files/$MYD_FILE?supportsAllDrives=true&addParents=$ROOT_FOLDER&removeParents=root" '{}'
  info T11a "moving a My Drive FILE into the Shared drive: HTTP $CODE $(reason)"
fi
if [ -n "$DRIVE_ID2" ]; then
  F2=$(mkfolder "$TOKEN_A" "d2-target-$RUN" "$DRIVE_ID2")
  call GET "$TOKEN_A" "$API/files/$MV?supportsAllDrives=true&fields=parents"; OLDP=$(jq -r '.parents[0] // empty' "$TMP")
  call PATCH "$TOKEN_A" "$API/files/$MV?supportsAllDrives=true&addParents=$F2&removeParents=$OLDP" '{}'
  info T11b "moving a folder from one Shared drive to another: HTTP $CODE $(reason)"
  [ -n "$F2" ] && call DELETE "$TOKEN_A" "$API/files/$F2?supportsAllDrives=true"
else info T11b "skipped (no DRIVE_ID2)"; fi
# T12 (optional) My Drive fallback: owner deletes a folder that holds files of others
if [ "$RUN_MYDRIVE" = 1 ]; then
  F=$(mkfolder "$TOKEN_A" "myd-share-$RUN" "")
  call POST "$TOKEN_A" "$API/files/$F/permissions?sendNotificationEmail=false" "{\"type\":\"user\",\"role\":\"writer\",\"emailAddress\":\"$EMAIL_B\"}"
  BF=$(mkfile "$TOKEN_B" "b_in_a_folder.txt" "$F")
  call DELETE "$TOKEN_A" "$API/files/$F"; fd=$CODE
  call GET "$TOKEN_B" "$API/files/$BF?fields=id,trashed,owners(emailAddress)"
  info T12 "My Drive: A deleted the folder (HTTP $fd); B's file afterwards: HTTP $CODE $(jq -c . "$TMP" | head -c 160)  (documented: B's file survives - owned by B)"
  [ "$CODE" = 200 ] && call DELETE "$TOKEN_B" "$API/files/$BF"
else info T12 "skipped (RUN_MYDRIVE=1 to run)"; fi
# T13 copy by B
if [ -n "$C_FILE" ]; then
  call POST "$TOKEN_B" "$API/files/$C_FILE/copy?supportsAllDrives=true&fields=id,owners" "{\"parents\":[\"$ROOT_FOLDER\"]}"
  [ "$CODE" = 200 ] && pass T13 "B copied a file inside the drive (HTTP 200)" || info T13 "B could not copy as $ROLE_B (HTTP $CODE $(reason))"
fi
echo; echo "== RESULT (paste this table back)"; column -t -s '|' "$RESULTS" 2>/dev/null || cat "$RESULTS"
rm -f "$RESULTS"
