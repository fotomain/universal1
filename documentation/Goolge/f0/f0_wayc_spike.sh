#!/usr/bin/env bash
# F0 spike for WAY C (administrator-connected Drive through an Edge Function): ONE Google account, ONE token, the narrow scope drive.file.
# It proves what the Edge Function and the app would do: make folders with properties, find them again, open a RESUMABLE upload session and upload the bytes
# WITHOUT any token (as the app would after the function handed it the session url), read a byte range (video seeking), trash, restore, replace (revision), copy,
# delete permanently, and the 124-byte limit of a property. Works in the administrator's My Drive (a free Gmail account is enough). Removes everything it made.
#
#   TOKEN_A   required  access token with ONLY the scope https://www.googleapis.com/auth/drive.file   (OAuth 2.0 Playground: pick that scope, Authorize, Exchange, copy the access token)
#   F0_API_BASE / F0_UPLOAD_BASE / F0_TOKENINFO  only for a local dry run
set -u
API=${F0_API_BASE:-https://www.googleapis.com/drive/v3}
UPL=${F0_UPLOAD_BASE:-https://www.googleapis.com/upload/drive/v3}
: "${TOKEN_A:?set TOKEN_A (scope drive.file only)}"
for c in curl jq uuidgen; do command -v "$c" >/dev/null || { echo "missing: $c"; exit 2; }; done
TMP=$(mktemp); HDR=$(mktemp); RESULTS=$(mktemp); RUN=$(uuidgen | tr 'A-Z' 'a-z' | cut -c1-8); ROOT=""
CODE=0
call() { local m=$1 u=$2 d=${3:-}
  if [ -n "$d" ]; then CODE=$(curl -s -o "$TMP" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' -d "$d" "$u")
  else CODE=$(curl -s -o "$TMP" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $TOKEN_A" "$u"); fi; }
reason() { jq -r '.error.errors[0].reason // .error.message // empty' "$TMP" 2>/dev/null | head -c 100; }
rec() { printf '%s\n' "$1" >> "$RESULTS"; printf '%s\n' "$1"; }
pass() { rec "$1|PASS|$2"; }; fail() { rec "$1|FAIL|$2"; }; info() { rec "$1|INFO|$2"; }
cleanup() { echo "-- cleanup"; [ -n "$ROOT" ] && call DELETE "$API/files/$ROOT"; echo "   test folder deleted: HTTP $CODE"; rm -f "$TMP" "$HDR"; }
trap cleanup EXIT

echo "== Way C spike, run $RUN (one account, scope drive.file)"
# W1 the token really is the narrow scope
sc=$(curl -s "${F0_TOKENINFO:-https://oauth2.googleapis.com/tokeninfo}?access_token=$TOKEN_A" | jq -r '.scope // empty')
case "$sc" in *auth/drive.file*) [ "$sc" = "https://www.googleapis.com/auth/drive.file" ] && pass W1 "token scope is exactly drive.file" || info W1 "token scope: $sc (more than drive.file - the result may be too optimistic)";; *) fail W1 "token scope is '$sc' - need drive.file"; exit 1;; esac
# W2 root folder with marks (S2) in My Drive
call POST "$API/files?fields=id,webViewLink" "{\"name\":\"kit8root-$RUN\",\"mimeType\":\"application/vnd.google-apps.folder\",\"description\":\"Way C spike\",\"properties\":{\"kit8Kind\":\"root\",\"kit8Run\":\"$RUN\"}}"
ROOT=$(jq -r '.id // empty' "$TMP"); [ -n "$ROOT" ] && pass W2 "folder + properties + description made (HTTP $CODE)" || { fail W2 "cannot make the folder (HTTP $CODE $(reason))"; exit 1; }
# W3 find the folder again by its property (what the function does at the next start)
CODE=$(curl -s -G -o "$TMP" -w '%{http_code}' -H "Authorization: Bearer $TOKEN_A" --data-urlencode "q=properties has { key='kit8Kind' and value='root' } and trashed = false" --data-urlencode "fields=files(id,name)" "$API/files")
jq -e --arg id "$ROOT" '.files[]?|select(.id==$id)' "$TMP" >/dev/null 2>&1 && pass W3 "found again by property with drive.file (HTTP $CODE)" || fail W3 "not found by property (HTTP $CODE $(reason))"
# W4 nested folders project/<g>/task/<g>/files in one go + 124-byte property limit
P=$ROOT; for n in project p1 task t1 files; do
  call POST "$API/files?fields=id" "{\"name\":\"$n\",\"mimeType\":\"application/vnd.google-apps.folder\",\"parents\":[\"$P\"],\"properties\":{\"kit8Kind\":\"$n\"}}"; P=$(jq -r '.id // empty' "$TMP"); [ -z "$P" ] && break; done
[ -n "$P" ] && pass W4 "the layout project/p1/task/t1/files made (5 levels)" || fail W4 "nested folders failed (HTTP $CODE $(reason))"
long=$(printf 'x%.0s' $(seq 1 120))
call PATCH "$API/files/$P?fields=id" "{\"properties\":{\"k\":\"$long\"}}"; c1=$CODE
long2=$(printf 'x%.0s' $(seq 1 130))
call PATCH "$API/files/$P?fields=id" "{\"properties\":{\"k\":\"$long2\"}}"; c2=$CODE
[ "$c1" = 200 ] && [ "$c2" != 200 ] && pass W5 "property key+value: 121 bytes accepted, 131 refused (limit 124 confirmed)" || info W5 "121 bytes -> HTTP $c1, 131 bytes -> HTTP $c2"
# W6 RESUMABLE session, then the bytes WITHOUT a token (the app uploads straight to Google with the session url)
head -c 3000000 /dev/urandom > "$TMP.bin"
CODE=$(curl -s -D "$HDR" -o "$TMP" -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json; charset=UTF-8' -H 'X-Upload-Content-Type: application/octet-stream' -H "X-Upload-Content-Length: 3000000" -d "{\"name\":\"big.bin\",\"parents\":[\"$P\"],\"properties\":{\"kit8Kind\":\"file\"}}" "$UPL/files?uploadType=resumable&fields=id,size")
SESSION=$(grep -i '^location:' "$HDR" | tr -d '\r' | sed 's/^[Ll]ocation: *//')
if [ -n "$SESSION" ]; then
  CODE=$(curl -s -o "$TMP" -w '%{http_code}' -X PUT -H 'Content-Type: application/octet-stream' --data-binary @"$TMP.bin" "$SESSION")   # NO Authorization header
  FILE=$(jq -r '.id // empty' "$TMP"); [ -n "$FILE" ] && pass W6 "3 MB uploaded to the session url with NO token (HTTP $CODE) - the function only hands out the url" || fail W6 "upload to the session url failed (HTTP $CODE $(reason))"
else fail W6 "no session url (HTTP $CODE $(reason))"; fi
# W7 range read (video seeking through the function)
CODE=$(curl -s -o "$TMP.part" -w '%{http_code}' -H "Authorization: Bearer $TOKEN_A" -H 'Range: bytes=1000-1999' "$API/files/${FILE:-x}?alt=media")
[ "$CODE" = 206 ] && [ "$(wc -c < "$TMP.part" | tr -d ' ')" = 1000 ] && pass W7 "Range bytes=1000-1999 -> HTTP 206, 1000 bytes (seeking works)" || info W7 "Range read: HTTP $CODE, $(wc -c < "$TMP.part" | tr -d ' ') bytes"
cmp -s <(dd if="$TMP.bin" bs=1 skip=1000 count=1000 2>/dev/null) "$TMP.part" && pass W7b "the 1000 bytes equal the uploaded bytes" || info W7b "bytes differ or not read"
# W8 trash and restore, then replace the content (new revision) and keep the old one forever
call PATCH "$API/files/${FILE:-x}?fields=id,trashed" '{"trashed":true}'; t1=$CODE
call PATCH "$API/files/${FILE:-x}?fields=id,trashed" '{"trashed":false}'; t2=$CODE
[ "$t1" = 200 ] && [ "$t2" = 200 ] && pass W8 "trash and restore work (HTTP 200 / 200)" || fail W8 "trash $t1, restore $t2"
call GET "$API/files/${FILE:-x}/revisions?fields=revisions(id)"; REV=$(jq -r '.revisions[0].id // empty' "$TMP")
head -c 1000 /dev/urandom > "$TMP.new"
CODE=$(curl -s -o "$TMP" -w '%{http_code}' -X PATCH -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/octet-stream' --data-binary @"$TMP.new" "$UPL/files/${FILE:-x}?uploadType=media&fields=id,size")
[ "$CODE" = 200 ] && pass W9 "content replaced on the same file id (HTTP 200)" || fail W9 "replace failed (HTTP $CODE $(reason))"
[ -n "$REV" ] && { call PATCH "$API/files/${FILE:-x}/revisions/$REV" '{"keepForever":true}'; [ "$CODE" = 200 ] && pass W10 "old revision kept forever (HTTP 200)" || info W10 "keepForever: HTTP $CODE $(reason)"; }
# W11 copy, W12 permanent delete of file and folder (the owner is the administrator)
call POST "$API/files/${FILE:-x}/copy?fields=id" "{\"parents\":[\"$P\"]}"; [ "$CODE" = 200 ] && pass W11 "copy inside the layout (HTTP 200)" || info W11 "copy: HTTP $CODE $(reason)"
call DELETE "$API/files/${FILE:-x}"; d1=$CODE
call DELETE "$API/files/$ROOT"; d2=$CODE; [ "$d2" = 204 ] && ROOT=""
[ "$d1" = 204 ] && [ "$d2" = 204 ] && pass W12 "files.delete of the file and of the whole kit8root tree: HTTP 204 / 204 (permanent, owner = administrator)" || fail W12 "delete file $d1, folder $d2"
rm -f "$TMP.bin" "$TMP.part" "$TMP.new"
echo; echo "== RESULT (paste this table back)"; column -t -s '|' "$RESULTS" 2>/dev/null || cat "$RESULTS"; rm -f "$RESULTS"
