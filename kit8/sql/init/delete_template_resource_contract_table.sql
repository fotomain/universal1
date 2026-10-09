-- =====================================================================================
-- UNIVERSAL1 - TEMPLATE RESOURCE CONTRACT: kit8/sql/init/delete_template_resource_contract_table.sql
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
