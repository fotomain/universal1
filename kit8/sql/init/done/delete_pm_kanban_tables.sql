-- =====================================================================================
-- PM Kanban - DROP EVERYTHING created by kit8/sql/init/create_pm_kanban_tables.sql
-- WARNING: irreversible (all Kanban stages and task states of ALL users). Safe to run more than once.
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['kanban_stage_table', 'project_kanban_stage_table', 'project_task_kanban_state_table'] LOOP
      IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

DROP TABLE IF EXISTS public.project_task_kanban_state_table CASCADE;
DROP TABLE IF EXISTS public.project_kanban_stage_table CASCADE;
DROP TABLE IF EXISTS public.kanban_stage_table CASCADE;
DROP FUNCTION IF EXISTS public.pm_kanban_stage_after_delete();
DROP FUNCTION IF EXISTS public.pm_kanban_ensure_project_stages(uuid);
