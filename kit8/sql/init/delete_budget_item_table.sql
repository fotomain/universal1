-- =====================================================================================
-- UNIVERSAL1 - BUDGET ITEMS: kit8/sql/init/delete_budget_item_table.sql
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
