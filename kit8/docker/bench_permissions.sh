#!/usr/bin/env bash
# Speed check of the permission policies (documentation/PERMISSIONS_WBS.html, risk R4) on a throwaway database of the local Postgres (docker compose up -d first):
#   a project of N tasks (default 10000) with 2 lines each, read as the OWNER, as a READ ONLY member (matrix policy), as a derived RESPONSIBLE, and compared with the same list read by the SQL editor
#   (no policy at all). Prints the times; the target of the plan is "+20 % of today" for the reads that a member does (today a member sees nothing, so the owner is the base).
# Usage: ./bench_permissions.sh [tasks]
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlpermbench
N=${1:-10000}
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1_sql_tables.sql + start2_sql_code.sql + start4_sql_insert_missing.sql"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables start2_sql_code start4_sql_insert_missing; do
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/$f.sql >/dev/null
done

echo "== $N tasks, 2 lines each (data made with the triggers off: the tree triggers are not what is measured)"
psqlc -d "$DB" >/dev/null <<SQL
SELECT public.organization_ensure_user('owner@acme.test', '11111111-1111-1111-1111-111111111111', 'Owner', 'O');
SELECT public.organization_ensure_user('member@acme.test', '22222222-2222-2222-2222-222222222222', 'Member', 'M');
SELECT public.organization_ensure_user('resp@acme.test', '33333333-3333-3333-3333-333333333333', 'Resp', 'R');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowParentGUID", "rowJSON")
SELECT 'aaaaaaaa-0000-0000-0000-0000000000b1', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-0000000000b1'), '11111111-1111-1111-1111-111111111111', u."rowJSON"->>'userOrganization', '{"name":"Bench"}'
  FROM public."userTable" u WHERE u."rowOwnerGUID" = 'owner@acme.test';
SET session_replication_role = replica;
CREATE TEMP TABLE bt AS SELECT gen_random_uuid() AS g FROM generate_series(1, $N);
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
SELECT g, public.pm_ltree_label('aaaaaaaa-0000-0000-0000-0000000000b1') || public.pm_ltree_label(g), 'aaaaaaaa-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', jsonb_build_object('taskDescription', 'T ' || g, 'rowKind', 'task', 'durationDays', 3) FROM bt;
INSERT INTO public.task_line_table ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON")
SELECT 'aaaaaaaa-0000-0000-0000-0000000000b1', g, 'materialGenus', '{"qtyTaskLine": 1}' FROM bt, generate_series(1, 2);
SET session_replication_role = origin;
INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', '{"permissionProfileGUID": "permissionProjectReadOnly"}');
INSERT INTO public."personTable" ("rowGUID", "rowJSON") VALUES ('person-resp', '{"personEmail": "resp@acme.test"}');
INSERT INTO public.task_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") SELECT g, 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-resp", "raciItem": "raciResponsibleGUID"}' FROM (SELECT g FROM bt LIMIT 50) x;
ANALYZE public.project_task_table; ANALYZE public.task_line_table; ANALYZE public.task_user_permission_table; ANALYZE public.project_permission_profile_user_table;
SQL

echo "== reads (ms)"
psqlc -d "$DB" <<SQL
\timing on
SELECT tt_ok FROM (SELECT 1 AS tt_ok) x;
-- the SQL editor: no policy
SELECT count(*) AS editor_tasks FROM public.project_task_table;
SELECT count(*) AS editor_lines FROM public.task_line_table;
BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"email":"owner@acme.test","sub":"11111111-1111-1111-1111-111111111111"}', true);
SELECT count(*) AS owner_tasks FROM public.project_task_table;
SELECT count(*) AS owner_lines FROM public.task_line_table;
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"email":"member@acme.test","sub":"22222222-2222-2222-2222-222222222222"}', true);
SELECT count(*) AS member_tasks FROM public.project_task_table;
SELECT count(*) AS member_lines FROM public.task_line_table;
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"email":"resp@acme.test","sub":"33333333-3333-3333-3333-333333333333"}', true);
SELECT count(*) AS responsible_tasks FROM public.project_task_table;
UPDATE public.project_task_table SET "rowProgress" = 20 WHERE "rowGUID" IN (SELECT "rowOwnerGUID"::uuid FROM public.task_user_permission_table WHERE "rowParentGUID" = '33333333-3333-3333-3333-333333333333');
COMMIT;
\timing off
SQL
echo "== rebuild of the derived table and its verify (ms)"
psqlc -d "$DB" <<SQL
\timing on
SELECT public.task_user_permission_rebuild('aaaaaaaa-0000-0000-0000-0000000000b1');
SELECT public.task_user_permission_verify();
SQL
