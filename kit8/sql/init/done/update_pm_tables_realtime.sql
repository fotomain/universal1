-- =====================================================================================
-- Non-destructive upgrade: realtime auto refresh of the PM tables.
-- (Fresh installs: create_pm_tables.sql already contains all of this.)
-- Run AFTER create_pm_tables.sql and update_pm_tables_userSettings.sql.
--
-- Without it the app subscribes but Supabase sends no events, so edits made in another
-- browser only show up after a reload.
-- Check afterwards:  SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- =====================================================================================

-- =====================================================================================
-- Realtime (auto refresh in every browser / device of the user)
-- The app listens with supabase.channel(...).on('postgres_changes', ...)
-- (kit8/pm/crud/realtime/useProjectRealtime.ts): INSERT / UPDATE filtered by project / owner,
-- DELETE unfiltered (Supabase cannot filter deletes) and matched on the client by primary key.
-- REPLICA IDENTITY FULL -> UPDATE / DELETE events carry the old row (with RLS on, a DELETE
-- carries only the primary key, which is all the client needs).
-- The closure table is not published: the client refetches it on task / dependency events.
-- Safe to run more than once.
-- =====================================================================================
ALTER TABLE public.project_table                   REPLICA IDENTITY FULL;
ALTER TABLE public.project_task_table              REPLICA IDENTITY FULL;
ALTER TABLE public.project_task_dependencies_table REPLICA IDENTITY FULL;
ALTER TABLE public.project_user_settings_table     REPLICA IDENTITY FULL;

DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY['project_table', 'project_task_table', 'project_task_dependencies_table', 'project_user_settings_table']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
