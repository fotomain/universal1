-- =====================================================================================
-- UNIVERSAL1 - MANAGEMENT GENUS: kit8/sql/init/delete_management_genus_table.sql
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
