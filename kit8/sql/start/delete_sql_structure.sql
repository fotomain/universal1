-- ===============================================================================================
-- UNIVERSAL1 - delete_sql_structure.sql: DELETES EVERYTHING that start_sql_structure.sql created - tables WITH ALL THEIR DATA (of ALL users),
-- default data, indexes, triggers, policies, functions (stored procedures), realtime publication entries.
-- IRREVERSIBLE: make a backup first (Supabase -> Database -> Backups, or pg_dump). Safe to run twice (IF EXISTS everywhere).
-- Extensions (pgcrypto, ltree) and Supabase's own schemas (auth, storage ...) are NOT touched. Re-create with start_sql_structure.sql.
-- Parts, in this order (reverse of the install order):
--
--    1. user calendars - user_calendar_table / _event_table / _invitation_table + the sync triggers on the project tables
--    2. delete_task_line_plan_table.sql - drops task_line_plan + create_task_line_plan + the unpost trigger
--    3. delete_management_calendar_tables.sql - drops the management calendars and their days
--    4. delete_pm_task_line_table.sql - drops task_line_table + pm_set_task_last_edit_place
--    5. delete_template_resource_contract_table.sql - drops templateResourceContractTable
--    6. delete_person_descriptors.sql - removes the person descriptors, variants, certificates and the demo contracts
--    7. delete_person_type_table.sql - drops personTypeTable
--    8. delete_resource_role_tables.sql - drops the resource role tables + their rows in the shared descriptor tables
--    9. delete_product_tables.sql - drops the product catalog and the shared descriptor / variant / price tables
--   10. delete_budget_item_table.sql - drops budgetItemTable
--   11. delete_management_genus_table.sql - drops managementGenusTable
--   12. delete_distribution_generic_table.sql - drops distributionGenericTable
--   13. delete_tables.sql - drops EVERYTHING of done/create_tables.sql: all projects, tasks, catalogs, persons, contracts, rates (all users!)
--   14. helper function kit8_touch_updated_at
-- ===============================================================================================



-- =====================================================================================
-- PART 1: user calendars (user_calendar_table, user_calendar_event_table, user_calendar_invitation_table + the sync triggers on the project tables)
-- =====================================================================================

DROP TRIGGER IF EXISTS trg_project_task_zzz_user_calendar ON public.project_task_table;
DROP TRIGGER IF EXISTS trg_project_table_zzz_user_calendar ON public.project_table;
DROP FUNCTION IF EXISTS public.user_calendar_project_task_sync();
DROP FUNCTION IF EXISTS public.user_calendar_project_sync();

DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['user_calendar_invitation_table', 'user_calendar_event_table', 'user_calendar_table'] LOOP
      IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

DROP TABLE IF EXISTS public.user_calendar_invitation_table CASCADE;
DROP TABLE IF EXISTS public.user_calendar_event_table CASCADE;
DROP TABLE IF EXISTS public.user_calendar_table CASCADE;
DROP FUNCTION IF EXISTS public.user_calendar_project_task_json(public.project_task_table);


-- ===============================================================================================
-- PART 2: delete_task_line_plan_table.sql
-- drops task_line_plan + create_task_line_plan + the unpost trigger
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - DELETE TASK LINE PLAN: delete_task_line_plan_table.sql
-- Drops task_line_plan (the posted days - data included!), create_task_line_plan and the unpost trigger.
-- The lines keep taskIsPosted = true until their next change: edit one (or press Post after create_task_line_plan_table.sql again).
-- =====================================================================================
DROP TRIGGER IF EXISTS trg_task_line_plan_unpost_on_dates ON public.project_task_table;
DROP FUNCTION IF EXISTS public.task_line_plan_unpost_on_dates();
DROP FUNCTION IF EXISTS public.create_task_line_plan(jsonb);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_line_plan')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.task_line_plan;
  END IF;
  DROP TABLE IF EXISTS public.task_line_plan CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 3: delete_management_calendar_tables.sql
-- drops the management calendars and their days
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - DELETE MANAGEMENT CALENDARS: delete_management_calendar_tables.sql
-- Drops managementCalendarDaysTable, managementCalendarTable and fill_management_calendar (the calendars and their days are lost).
-- Run delete_task_line_plan_table.sql first if you also created task_line_plan (it does not point at the calendars, but a project may
-- still name a calendar in rowJSON.calendarForTaskPlan).
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['managementCalendarDaysTable', 'managementCalendarTable'] LOOP
      IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.fill_management_calendar(text, integer, text, boolean);
DROP TABLE IF EXISTS public."managementCalendarDaysTable" CASCADE;
DROP TABLE IF EXISTS public."managementCalendarTable" CASCADE;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 4: delete_pm_task_line_table.sql
-- drops task_line_table + pm_set_task_last_edit_place
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - PM TASK LINES: delete_pm_task_line_table.sql
-- Drops task_line_table (data included!) and pm_set_task_last_edit_place. project_task_table.rowJSON.lastEditPlace stays as it is
-- (the app ignores a place it does not know).
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_line_table')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.task_line_table;
  END IF;
  DROP TABLE IF EXISTS public.task_line_table CASCADE;
END $$;

DROP FUNCTION IF EXISTS public.task_line_set_project();
DROP FUNCTION IF EXISTS public.pm_set_task_last_edit_place(uuid, jsonb);

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 5: delete_template_resource_contract_table.sql
-- drops templateResourceContractTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - TEMPLATE RESOURCE CONTRACT: delete_template_resource_contract_table.sql
-- Drops templateResourceContractTable (data included!). task_line_table.rowJSON.resourceContractTemplateTaskLine keeps the old GUID
-- (the task line then marks the missing template).
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'templateResourceContractTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."templateResourceContractTable";
  END IF;
  DROP TABLE IF EXISTS public."templateResourceContractTable" CASCADE;
END $$;
NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 6: delete_person_descriptors.sql
-- removes the person descriptors, variants, certificates and the demo contracts
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - PERSON DESCRIPTORS: delete_person_descriptors.sql
-- Removes what create_person_descriptors.sql added: the person sets / plan lines, the property values and variants of persons, the
-- experienceYears descriptor, 'personType' from the targets of the shared descriptors, and the demo contracts 'contract_<person>'.
-- =====================================================================================
DO $guard$
BEGIN
  IF to_regclass('public."variantValueTable"') IS NOT NULL AND to_regclass('public."contractTable"') IS NOT NULL THEN
    EXECUTE $q$
DELETE FROM public."variantValueTable" WHERE "rowGUID" LIKE 'pvv\_%' ESCAPE '\';
DELETE FROM public."variantTable"      WHERE "rowGUID" LIKE 'pvar\_%' ESCAPE '\';
DELETE FROM public."propertyValueTable" WHERE "rowGUID" LIKE 'pp\_exp\_%' ESCAPE '\' OR "rowGUID" LIKE 'pp\_cert\_%' ESCAPE '\';
DELETE FROM public."descriptorPlanTable" WHERE "rowGUID" LIKE 'dp\_emp\_%' ESCAPE '\' OR "rowGUID" LIKE 'dp\_con\_%' ESCAPE '\';
DELETE FROM public."descriptorDestinationTable" WHERE "rowGUID" IN ('ds_emp_prop', 'ds_emp_var', 'ds_con_prop', 'ds_con_var');
DELETE FROM public."descriptorGenusTable" WHERE "rowGUID" = 'experienceYears';
UPDATE public."descriptorGenusTable" g
   SET "rowJSON" = jsonb_set(g."rowJSON", '{targetKinds}', COALESCE((SELECT jsonb_agg(k) FROM jsonb_array_elements(g."rowJSON"->'targetKinds') k WHERE k <> '"personType"'::jsonb), '[]'::jsonb))
 WHERE g."rowGUID" IN ('seniority', 'workLanguage', 'certification');
UPDATE public."descriptorGenusTable" g SET "rowJSON" = g."rowJSON" - 'multiple' WHERE g."rowGUID" = 'certification';
DELETE FROM public."contractTable" WHERE "rowGUID" LIKE 'contract\_%' ESCAPE '\' AND "rowParentGUID" = 'person';
NOTIFY pgrst, 'reload schema';
    $q$;
  END IF;
END $guard$;


-- ===============================================================================================
-- PART 7: delete_person_type_table.sql
-- drops personTypeTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - PERSON TYPES: delete_person_type_table.sql
-- Drops personTypeTable (data included!). personTable.rowJSON.personType stays as it is; the person descriptor data
-- (create_person_descriptors.sql) is removed by delete_person_descriptors.sql.
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'personTypeTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."personTypeTable";
  END IF;
  DROP TABLE IF EXISTS public."personTypeTable" CASCADE;
END $$;
NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 8: delete_resource_role_tables.sql
-- drops the resource role tables + their rows in the shared descriptor tables
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - RESOURCE ROLE CATALOG: delete_resource_role_tables.sql
-- Removes everything create_resource_role_tables.sql adds (data included!):
--   1. the rows the role side keeps in the SHARED tables: descriptor sets + plan lines of role types, property values of roles,
--      variants (+ variant values) of role types / roles, descriptors meant only for role types (+ their values), price lists used only for roles
--   2. the four role tables (resourceRoleTypeTable, resourceRoleFolderTable, resourceRoleTable, rolePriceTable)
-- The product catalog is not touched. Shared helpers (kit8_setup_def_table, kit8_touch_updated_at) are kept.
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  IF to_regclass('public."resourceRoleTypeTable"') IS NOT NULL AND to_regclass('public."resourceRoleTable"') IS NOT NULL THEN
    -- variant values -> variants -> property values -> plan lines -> sets (children first)
    DELETE FROM public."variantValueTable" WHERE "rowOwnerGUID" IN (
      SELECT "rowGUID" FROM public."variantTable"
       WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTypeTable") OR "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTable"));
    DELETE FROM public."variantTable"
     WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTypeTable") OR "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTable");
    DELETE FROM public."propertyValueTable" WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTable");
    DELETE FROM public."descriptorPlanTable" WHERE "rowOwnerGUID" IN (
      SELECT "rowGUID" FROM public."descriptorDestinationTable" WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTypeTable"));
    DELETE FROM public."descriptorDestinationTable" WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTypeTable");
  END IF;
  -- descriptors and price lists that only roles use
  IF to_regclass('public."descriptorValueTable"') IS NOT NULL AND to_regclass('public."descriptorGenusTable"') IS NOT NULL AND to_regclass('public."priceTypeTable"') IS NOT NULL THEN
    DELETE FROM public."descriptorValueTable" WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."descriptorGenusTable" WHERE "rowJSON"->'targetKinds' = '["resourceRoleType"]'::jsonb);
    DELETE FROM public."descriptorGenusTable" WHERE "rowJSON"->'targetKinds' = '["resourceRoleType"]'::jsonb;
    DELETE FROM public."priceTypeTable" WHERE "rowJSON"->'appliesTo' = '["resourceRoleType"]'::jsonb;
  END IF;

  FOREACH t IN ARRAY ARRAY['resourceRoleTypeTable', 'resourceRoleFolderTable', 'resourceRoleTable', 'rolePriceTable'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t)
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 9: delete_product_tables.sql
-- drops the product catalog and the shared descriptor / variant / price tables
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - PRODUCT CATALOG: delete_product_tables.sql
-- Drops every table create_product_tables.sql creates (data included!). Shared helpers
-- (kit8_setup_def_table, kit8_touch_updated_at) are kept: other tables use them.
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['valueAddedTaxTable', 'measureUnitTable', 'descriptorGenusTable', 'descriptorValueTable', 'descriptorModeTable', 'descriptorDestinationTable', 'descriptorPlanTable', 'productTypeTable', 'productFolderTable', 'productTable', 'propertyValueTable', 'variantTable', 'variantValueTable', 'productPackageTable', 'productSeriesTable', 'productBarcodeTable', 'priceTypeTable', 'productPriceTable'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t)
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 10: delete_budget_item_table.sql
-- drops budgetItemTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - BUDGET ITEMS: delete_budget_item_table.sql
-- Drops budgetItemTable (data included!) and its genus check function. managementGenusTable is not touched.
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budgetItemTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."budgetItemTable";
  END IF;
  DROP TABLE IF EXISTS public."budgetItemTable" CASCADE;
END $$;

DROP FUNCTION IF EXISTS public.kit8_budget_item_check_genus();

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 11: delete_management_genus_table.sql
-- drops managementGenusTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - MANAGEMENT GENUS: delete_management_genus_table.sql
-- Drops managementGenusTable (data included!). resourceRoleTypeTable.rowJSON.managementGenus is left as it is (the Checks panel of the
-- resource roles then reports a genus that does not exist).
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'managementGenusTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."managementGenusTable";
  END IF;
  DROP TABLE IF EXISTS public."managementGenusTable" CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 12: delete_distribution_generic_table.sql
-- drops distributionGenericTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - DISTRIBUTION: delete_distribution_generic_table.sql
-- Drops distributionGenericTable (data included!). task_line_table.rowJSON.distributionForBudgetTaskLine is left as it is (the line then shows a
-- distribution that does not exist).
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'distributionGenericTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."distributionGenericTable";
  END IF;
  DROP TABLE IF EXISTS public."distributionGenericTable" CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 13: delete_tables.sql
-- drops EVERYTHING of done/create_tables.sql: all projects, tasks, catalogs, persons, contracts, rates (all users!)
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - DROP EVERYTHING created by create_tables.sql
--
-- WARNING: IRREVERSIBLE. Deletes the data of ALL users: projects, tasks, dependencies,
-- templates, project versions, Kanban, catalogs (countries, currencies, rates, organizations, departaments,
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

-- ---- 2b. PM project versions (children first) -------------------------------------------
DROP TABLE IF EXISTS public.version_project_task_kanban_state_table CASCADE;
DROP TABLE IF EXISTS public.version_project_kanban_stage_table CASCADE;
DROP TABLE IF EXISTS public.version_project_task_dependencies_table CASCADE;
DROP TABLE IF EXISTS public.version_project_task_table CASCADE;
DROP TABLE IF EXISTS public.version_project_table CASCADE;

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
DROP FUNCTION IF EXISTS public.app_user_guid() CASCADE;
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
    -- PM project versions
    'public.pm_version_restore(uuid, text)',
    'public.pm_version_save(uuid, text)',
    'public.pm_version_set_title(uuid, text)',
    'public.pm_owns_version(uuid)',
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


-- =====================================================================================
-- PART 14: helpers that no table uses any more
-- =====================================================================================

DROP FUNCTION IF EXISTS public.kit8_touch_updated_at();

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- END of delete_sql_structure.sql
-- ===============================================================================================
