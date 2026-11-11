#!/usr/bin/env bash
# F0b item 2 (documentation/FILE_ATTACHMENT_WBS.html): the deployed Edge Function files-drive with a LARGE file - upload straight to Google through the session url,
# then a full download and a ranged download THROUGH the function, timed. Shows whether the function's limits (2 s CPU, 150 s Free / 400 s paid wall clock, 256 MB memory) are enough.
# Needs: the function deployed + secrets set + the organization CONNECTED (Project settings -> Files, later; for the skeleton: call connect_start and open the url).
#   FN_URL   https://<project>.supabase.co/functions/v1/files-drive
#   SB_JWT   a Supabase access token of an ADMINISTRATOR of the organization (browser devtools: localStorage "sb-...-auth-token" -> access_token; valid about an hour)
#   ORG      the organization GUID
#   SIZE_MB  optional, default 200
set -u
: "${FN_URL:?}" "${SB_JWT:?}" "${ORG:?}"
SIZE_MB=${SIZE_MB:-200}
command -v jq >/dev/null || { echo "missing: jq"; exit 2; }
BIN=$(mktemp); OUT=$(mktemp); trap 'rm -f "$BIN" "$OUT"' EXIT
fn() { curl -s -X POST -H "Authorization: Bearer $SB_JWT" -H 'Content-Type: application/json' "$FN_URL" -d "$1"; }
echo "== making a $SIZE_MB MB random file"; head -c $((SIZE_MB*1024*1024)) /dev/urandom > "$BIN"; SUM=$(shasum -a 256 "$BIN" | cut -d' ' -f1)
echo "== upload_session"; S=$(fn "{\"action\":\"upload_session\",\"organizationGUID\":\"$ORG\",\"scope\":\"organization\",\"name\":\"f0b-$SIZE_MB.bin\",\"mime\":\"application/octet-stream\",\"size\":$((SIZE_MB*1024*1024))}")
URL=$(echo "$S" | jq -r '.sessionUrl // empty'); [ -n "$URL" ] || { echo "FAIL no session url: $S"; exit 1; }
echo "== PUT $SIZE_MB MB straight to Google (no token)"; T0=$(date +%s); FILE=$(curl -s -X PUT -H 'Content-Type: application/octet-stream' --data-binary @"$BIN" "$URL" | jq -r '.id // empty'); echo "   $(( $(date +%s) - T0 )) s, file id: $FILE"
[ -n "$FILE" ] || { echo "FAIL upload"; exit 1; }
fn "{\"action\":\"upload_finish\",\"organizationGUID\":\"$ORG\",\"fileId\":\"$FILE\"}" | jq -c '{size,mimeType}'
D=$(fn "{\"action\":\"download_url\",\"organizationGUID\":\"$ORG\",\"fileId\":\"$FILE\"}" | jq -r '.url')
echo "== full download through the function"; T0=$(date +%s); CODE=$(curl -s -o "$OUT" -w '%{http_code}' "$D"); T=$(( $(date +%s) - T0 ))
echo "   HTTP $CODE in $T s; sha256 $( [ "$(shasum -a 256 "$OUT" | cut -d' ' -f1)" = "$SUM" ] && echo EQUAL || echo DIFFERENT )  (Free plan wall clock 150 s, paid 400 s)"
echo "== range 100 MB .. +1 MB (video seeking)"; CODE=$(curl -s -o "$OUT" -w '%{http_code}' -H 'Range: bytes=104857600-105906175' "$D"); echo "   HTTP $CODE, $(wc -c < "$OUT" | tr -d ' ') bytes (expect 206, 1048576)"
echo "== cleanup"; fn "{\"action\":\"delete\",\"organizationGUID\":\"$ORG\",\"id\":\"$FILE\"}" | jq -c .
