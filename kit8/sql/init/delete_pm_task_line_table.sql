-- =====================================================================================
-- UNIVERSAL1 - PM TASK LINES: kit8/sql/init/delete_pm_task_line_table.sql
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
