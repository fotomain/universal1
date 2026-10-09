-- =====================================================================================
-- UNIVERSAL1 - RESOURCE ROLE CATALOG: kit8/sql/init/delete_resource_role_tables.sql
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
  DELETE FROM public."descriptorValueTable" WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."descriptorGenusTable" WHERE "rowJSON"->'targetKinds' = '["resourceRoleType"]'::jsonb);
  DELETE FROM public."descriptorGenusTable" WHERE "rowJSON"->'targetKinds' = '["resourceRoleType"]'::jsonb;
  DELETE FROM public."priceTypeTable" WHERE "rowJSON"->'appliesTo' = '["resourceRoleType"]'::jsonb;

  FOREACH t IN ARRAY ARRAY['resourceRoleTypeTable', 'resourceRoleFolderTable', 'resourceRoleTable', 'rolePriceTable'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t)
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
