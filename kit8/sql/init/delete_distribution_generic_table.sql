-- =====================================================================================
-- UNIVERSAL1 - DISTRIBUTION: kit8/sql/init/delete_distribution_generic_table.sql
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
