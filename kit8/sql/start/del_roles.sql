-- ===============================================================================================
-- UNIVERSAL1 - del_roles.sql: removes the LEGACY APP ROLES from a database that still has them (one time, 2026-11-11).
--   * public."roleTable" and public."userRoleTable" WITH ALL THEIR ROWS (the four standing roles and the roles every user gave himself at login), their indexes, policies and the
--     realtime entries (all go with the tables)
--   * the rows of the permission matrix that mention the two tables (project_permission_profile_crud_table, delivered and the organization's own)
-- Why: the roles were a client-side gate only (nothing in the database read them). Who may do what is now the permission profiles (PART 46 / 47, documentation/PERMISSIONS_WBS.html):
-- the administrator of the organization writes the catalogs, the project manager inserts. The app code that used the roles (Roles / User roles screens, the seeding at login, the
-- roleAppAdmin check of the Country screens) was removed with this file; start1 / start2 / start4 / start5 no longer create or seed the tables.
-- Run it in the Supabase SQL Editor AFTER the new app is deployed (an old app build still reads the tables at login). IRREVERSIBLE: the rows of the two tables are lost - there is nothing
-- else to lose (no other table points at them). Safe to run twice (IF EXISTS everywhere) and on a database that never had them (it only prints NOTICEs).
-- ===============================================================================================

DO $$
DECLARE
  v_roles bigint := 0;
  v_user_roles bigint := 0;
BEGIN
  IF to_regclass('public."roleTable"') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public."roleTable"' INTO v_roles;
  END IF;
  IF to_regclass('public."userRoleTable"') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public."userRoleTable"' INTO v_user_roles;
  END IF;
  RAISE NOTICE 'del_roles: roleTable has % row(s), userRoleTable has % row(s) - dropping both', v_roles, v_user_roles;
END $$;

-- 1. the tables (policies, indexes and the supabase_realtime entries go with them)
DROP TABLE IF EXISTS public."userRoleTable" CASCADE;

DROP TABLE IF EXISTS public."roleTable" CASCADE;

-- 2. the permission matrix no longer lists them (the table exists after PART 46; a database from before PART 46 has nothing to clean)
DO $$
DECLARE
  v_matrix bigint := 0;
BEGIN
  IF to_regclass('public.project_permission_profile_crud_table') IS NOT NULL THEN
    DELETE FROM public.project_permission_profile_crud_table WHERE "rowJSON"->>'permissionTable' IN ('roleTable', 'userRoleTable');
    GET DIAGNOSTICS v_matrix = ROW_COUNT;
  END IF;
  RAISE NOTICE 'del_roles: % matrix row(s) removed', v_matrix;
END $$;

-- 3. the policy that let every user insert his own role rows (start2 PART 47, audit E6) is gone with the table; nothing else refers to the roles.

NOTIFY pgrst, 'reload schema';

-- Check (both must be NULL / 0):
--   SELECT to_regclass('public."roleTable"'), to_regclass('public."userRoleTable"');
--   SELECT count(*) FROM public.project_permission_profile_crud_table WHERE "rowJSON"->>'permissionTable' IN ('roleTable', 'userRoleTable');
