-- =====================================================================================
-- UNIVERSAL1 - DROP EVERYTHING created by kit8/sql/init/done/create_tables.sql
--
-- WARNING: IRREVERSIBLE. Deletes the data of ALL users: projects, tasks, dependencies,
-- templates, Kanban, catalogs (countries, currencies, rates, organizations, departaments,
-- persons, partners, contracts) and the generic app tables (themeStore, raciMember, mediaPost...).
-- Make a backup first (Supabase Dashboard -> Database -> Backups, or pg_dump).
--
-- Safe to run more than once (IF EXISTS everywhere). Re-create with create_tables.sql.
-- Extensions (ltree, pgcrypto) are left installed on purpose.
-- =====================================================================================

-- ---- 1. realtime publication ----------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
    FOR t IN
      SELECT tablename FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
         AND tablename = ANY (ARRAY[
           'googleDriveCommandTable', 'raciMemberTable', 'themeStoreTable', 'mediaPostTable', 'mediaPostTableArchive',
           'userTable', 'userAuthTable', 'aiSessionTable',
           'dtcTaskFinishedTable', 'dtcCatalogExecutiveTable', 'dtcTaskRegisteredTable',
           'dtcTaskWaitingTable', 'dtcTaskProgressTable', 'dtcFreeExecutiveTable',
           'countryTable', 'currencyTable', 'currencyExchangeRateTable', 'organizationTable',
           'departamentTable', 'personTable', 'partnerTable', 'contractTable', 'roleTable', 'userRoleTable',
           'project_table', 'project_task_table', 'project_task_dependencies_table',
           'project_task_dependency_closure_table', 'project_user_settings_table',
           'kanban_stage_table', 'project_kanban_stage_table', 'project_task_kanban_state_table',
           'templates_project_table', 'templates_project_task_table', 'templates_project_task_dependencies_table',
           'templates_project_task_dependency_closure_table', 'templates_project_kanban_stage_table',
           'templates_project_user_settings_table'])
    LOOP
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END LOOP;
  END IF;
END $$;

-- ---- 2. views ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.project_task_schedule_view;
DROP VIEW IF EXISTS public.templates_project_task_schedule_view;   -- older scripts

-- ---- 3. PM templates (children first; CASCADE removes triggers, policies, FKs, indexes) --
DROP TABLE IF EXISTS public.templates_project_user_settings_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_kanban_stage_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_task_dependency_closure_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_task_dependencies_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_task_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_table CASCADE;

-- ---- 4. PM Kanban + Gantt ---------------------------------------------------------------
DROP TABLE IF EXISTS public.project_task_kanban_state_table CASCADE;
DROP TABLE IF EXISTS public.project_kanban_stage_table CASCADE;
DROP TABLE IF EXISTS public.kanban_stage_table CASCADE;
DROP TABLE IF EXISTS public.project_user_settings_table CASCADE;
DROP TABLE IF EXISTS public.project_task_dependency_closure_table CASCADE;
DROP TABLE IF EXISTS public.project_task_dependencies_table CASCADE;
DROP TABLE IF EXISTS public.project_task_table CASCADE;
DROP TABLE IF EXISTS public.project_table CASCADE;

DROP TABLE IF EXISTS public."userRoleTable" CASCADE;
DROP TABLE IF EXISTS public."roleTable" CASCADE;
DROP TABLE IF EXISTS public."contractTable" CASCADE;
DROP TABLE IF EXISTS public."partnerTable" CASCADE;
DROP TABLE IF EXISTS public."personTable" CASCADE;
DROP TABLE IF EXISTS public."departamentTable" CASCADE;
DROP TABLE IF EXISTS public."organizationTable" CASCADE;
DROP TABLE IF EXISTS public."currencyExchangeRateTable" CASCADE;
DROP TABLE IF EXISTS public."currencyTable" CASCADE;
DROP TABLE IF EXISTS public."countryTable" CASCADE;

-- ---- 6. generic app tables --------------------------------------------------------------
DROP TABLE IF EXISTS public."googleDriveCommandTable" CASCADE;
DROP TABLE IF EXISTS public."raciMemberTable" CASCADE;
DROP TABLE IF EXISTS public."themeStoreTable" CASCADE;
DROP TABLE IF EXISTS public."mediaPostTable" CASCADE;
DROP TABLE IF EXISTS public."mediaPostTableArchive" CASCADE;
DROP TABLE IF EXISTS public."userTable" CASCADE;
DROP TABLE IF EXISTS public."userAuthTable" CASCADE;
DROP TABLE IF EXISTS public."aiSessionTable" CASCADE;
DROP TABLE IF EXISTS public."dtcTaskFinishedTable" CASCADE;
DROP TABLE IF EXISTS public."dtcCatalogExecutiveTable" CASCADE;
DROP TABLE IF EXISTS public."dtcTaskRegisteredTable" CASCADE;
DROP TABLE IF EXISTS public."dtcTaskWaitingTable" CASCADE;
DROP TABLE IF EXISTS public."dtcTaskProgressTable" CASCADE;
DROP TABLE IF EXISTS public."dtcFreeExecutiveTable" CASCADE;

-- ---- 7. functions -----------------------------------------------------------------------
-- A function still used by a table this script does not own (e.g. set_updated_at on some
-- other table) is kept, with a NOTICE, instead of aborting the whole script.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    -- PM templates
    'public.pm_template_task_dependency_after_delete()',
    'public.pm_template_rebuild_dependency_closure(uuid)',
    'public.pm_template_task_dependency_after_insert()',
    'public.pm_template_task_dependency_before_update()',
    'public.pm_template_task_dependency_before_insert()',
    'public.pm_template_dependency_creates_cycle(uuid, uuid)',
    'public.pm_template_task_after_delete_subtree()',
    'public.pm_template_task_after_move()',
    'public.pm_template_task_before_write()',
    'public.pm_owns_template(uuid)',
    -- PM Kanban
    'public.pm_kanban_ensure_project_stages(uuid)',
    'public.pm_kanban_stage_after_delete()',
    -- PM Gantt
    'public.pm_seed_demo(uuid, date)',
    'public.pm_task_downstream(uuid)',
    'public.pm_task_upstream(uuid)',
    'public.pm_apply_schedule(uuid, jsonb, timestamptz, numeric)',
    'public.pm_task_after_progress_change()',
    'public.pm_recalc_project_progress(uuid)',
    'public.pm_task_dependency_after_delete()',
    'public.pm_rebuild_dependency_closure(uuid)',
    'public.pm_task_dependency_after_insert()',
    'public.pm_task_dependency_before_update()',
    'public.pm_task_dependency_before_insert()',
    'public.pm_dependency_creates_cycle(uuid, uuid)',
    'public.pm_task_after_delete_subtree()',
    'public.pm_task_after_move()',
    'public.pm_task_before_write()',
    'public.pm_owns_project(uuid)',
    'public.pm_ltree_label(uuid)',
    -- shared helpers
    'public.kit8_setup_def_table(text)',
    'public.pm_touch_updated_at()',
    'public.kit8_touch_updated_at()',
    'public.set_updated_at()'
  ] LOOP
    BEGIN
      EXECUTE 'DROP FUNCTION IF EXISTS ' || f;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'kept % (still used by another object)', f;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check (expect no rows from this app):
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
