#!/usr/bin/env bash
# Tests kit8/sql/start/del_old_mediaPost.sql on a throwaway database of the local Postgres (docker compose up -d first):
#   fresh install -> posts of a real user, of the demo id, of 'anon', a FILE row and an archive row -> the script twice -> only the real user's posts and the file row are left;
#   then the switch v_delete_all := true removes the real user's non-file posts too (file row stays).
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqldelmediapost
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
echo "== fresh database $DB + start1 + start2 + start4"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables start2_sql_code start4_sql_insert_missing; do psqlc -d "$DB" -f /sql/$f.sql >/dev/null; done
seed() {
psqlc -d "$DB" <<'SQL' >/dev/null
SET session_replication_role = replica;  -- no user guard / touch triggers for the hand made rows
TRUNCATE public."mediaPostTable", public."mediaPostTableArchive";
DELETE FROM public."userTable" WHERE "rowOwnerGUID" = 'del.mediapost@test.local';
INSERT INTO public."userTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('7a1e0000-0000-4000-8000-000000000001', 'del.mediapost@test.local', '{"userOrganization":"7a1e0000-0000-4000-8000-0000000000aa"}');
INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('p1', '7a1e0000-0000-4000-8000-000000000001', '{"mediaPostTitle":"real user recording"}'),
  ('p2', '111459c1-b433-47d4-bf99-031d23a7a389', '{"mediaPostTitle":"demo id"}'),
  ('p3', 'anon', '{"mediaPostTitle":"signed out recording"}'),
  ('p4', 'orgless-garbage', '{"fileSourceKind":"task","mediaPostTitle":"a FILE row, never deleted"}');
INSERT INTO public."mediaPostTableArchive" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('a1', 'anon', '{}'), ('a2', '7a1e0000-0000-4000-8000-000000000001', '{}');
SQL
}
ids() { psqlc -d "$DB" -At -c "select coalesce(string_agg(\"rowGUID\", ',' order by \"rowGUID\"), '') from public.\"$1\""; }
echo "== seed: 4 posts + 2 archive rows"
seed
echo "== del_old_mediaPost.sql (1st run)"
psqlc -d "$DB" -f /sql/del_old_mediaPost.sql
echo "== del_old_mediaPost.sql (2nd run, must not fail and change nothing)"
psqlc -d "$DB" -f /sql/del_old_mediaPost.sql
[ "$(ids mediaPostTable)" = "p1,p4" ] && echo "   OK: posts left = real user + file row" || { echo "   FAILED: posts left = $(ids mediaPostTable)"; exit 1; }
[ "$(ids mediaPostTableArchive)" = "a2" ] && echo "   OK: archive left = real user" || { echo "   FAILED: archive left = $(ids mediaPostTableArchive)"; exit 1; }
echo "== the switch v_delete_all := true"
seed
sed 's/v_delete_all boolean := false/v_delete_all boolean := true/' /dev/stdin < ../sql/start/del_old_mediaPost.sql | psqlc -d "$DB"
[ "$(ids mediaPostTable)" = "p4" ] && echo "   OK: only the file row is left" || { echo "   FAILED: posts left = $(ids mediaPostTable)"; exit 1; }
[ "$(ids mediaPostTableArchive)" = "" ] && echo "   OK: archive empty" || { echo "   FAILED: archive left = $(ids mediaPostTableArchive)"; exit 1; }
echo "== database without the two tables"
psqlc -d "$DB" -c 'drop table public."mediaPostTable" cascade' -c 'drop table public."mediaPostTableArchive" cascade' >/dev/null
psqlc -d "$DB" -f /sql/del_old_mediaPost.sql && echo "ALL OK"
psqlc -d postgres -c "drop database if exists $DB with (force)" >/dev/null
