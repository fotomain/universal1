-- =====================================================================================
-- UNIVERSAL1 - DELETE TASK LINE PLAN: kit8/sql/init/delete_task_line_plan_table.sql
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
