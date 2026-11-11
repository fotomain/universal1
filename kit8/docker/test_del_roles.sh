#!/usr/bin/env bash
# Tests kit8/sql/start/del_roles.sql on a throwaway database of the local Postgres (docker compose up -d first):
#   fresh install of the CURRENT sql (no role tables) -> the legacy tables and their matrix rows are made by hand (what an older database has) -> del_roles.sql twice -> nothing is left
#   and the current files install again and do not make the tables.
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqldelroles
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
echo "== fresh database $DB + start1 + start2 + start4"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables start2_sql_code start4_sql_insert_missing; do psqlc -d "$DB" -f /sql/$f.sql >/dev/null; done
n=$(psqlc -d "$DB" -At -c "select to_regclass('public.\"roleTable\"') is null and to_regclass('public.\"userRoleTable\"') is null")
[ "$n" = t ] && echo "   OK: the current files make no role table" || { echo "   FAILED: a role table exists on a fresh install"; exit 1; }
echo "== an older database: the two tables with rows, a policy, the matrix rows"
psqlc -d "$DB" <<'SQL' >/dev/null
CREATE TABLE public."roleTable" ("rowGUID" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, "rowOwnerGUID" TEXT NOT NULL DEFAULT 'roleCatalog', "rowParentGUID" TEXT NOT NULL DEFAULT 'empty', "rowJSON" JSONB NOT NULL DEFAULT '{}', "orderInList" NUMERIC NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public."userRoleTable" (LIKE public."roleTable" INCLUDING ALL);
INSERT INTO public."roleTable" ("rowJSON") VALUES ('{"roleName":"roleUser"}'), ('{"roleName":"roleAppAdmin"}');
INSERT INTO public."userRoleTable" ("rowOwnerGUID", "rowJSON") VALUES ('a@b.c', '{"roleName":"roleUser"}');
ALTER TABLE public."userRoleTable" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "userRoleTable_insert_self" ON public."userRoleTable" FOR INSERT TO authenticated WITH CHECK (true);
INSERT INTO public.project_permission_profile_crud_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('permissionCatalog', 'permissionProjectManager', '{"permissionTable":"roleTable","permissionSet":"RC"}'),
  ('permissionCatalog', 'permissionProjectManager', '{"permissionTable":"userRoleTable","permissionSet":"RC"}');
SQL
echo "== del_roles.sql (1st run)"
psqlc -d "$DB" -f /sql/del_roles.sql
echo "== del_roles.sql (2nd run, must not fail)"
psqlc -d "$DB" -f /sql/del_roles.sql
left=$(psqlc -d "$DB" -At -c "select (to_regclass('public.\"roleTable\"') is not null)::int + (to_regclass('public.\"userRoleTable\"') is not null)::int + (select count(*) from public.project_permission_profile_crud_table where \"rowJSON\"->>'permissionTable' in ('roleTable','userRoleTable'))::int + (select count(*) from pg_policies where tablename in ('roleTable','userRoleTable'))::int")
[ "$left" = 0 ] && echo "   OK: no table, no policy, no matrix row of the roles is left" || { echo "   FAILED: $left object(s) left"; exit 1; }
m=$(psqlc -d "$DB" -At -c "select count(distinct \"rowJSON\"->>'permissionTable') from public.project_permission_profile_crud_table")
[ "$m" = 142 ] && echo "   OK: the matrix still lists 142 tables" || { echo "   FAILED: matrix lists $m tables"; exit 1; }
echo "== the current files again on this database (they must not bring the tables back)"
for f in start1_sql_tables start2_sql_code start4_sql_insert_missing; do psqlc -d "$DB" -f /sql/$f.sql >/dev/null; done
n=$(psqlc -d "$DB" -At -c "select to_regclass('public.\"roleTable\"') is null and to_regclass('public.\"userRoleTable\"') is null")
[ "$n" = t ] && echo "ALL OK" || { echo "FAILED: the tables came back"; exit 1; }
psqlc -d postgres -c "drop database if exists $DB with (force)" >/dev/null
