-- =====================================================================================
-- PM Gantt module - DROP EVERYTHING created by kit8/sql/init/create_pm_tables.sql
--
-- WARNING: irreversible. Deletes all projects, stages, tasks, dependencies and the
-- dependency closure of ALL users. Policies, triggers and indexes go with their tables.
-- Safe to run more than once (IF EXISTS everywhere).
-- =====================================================================================

-- ---- realtime publication (ignore if the tables are not published) --------------------
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['project_table', 'project_task_table', 'project_task_dependencies_table'] LOOP
      IF EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ---- view ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.project_task_schedule_view;

-- ---- tables (children first; CASCADE removes triggers, policies, FKs, indexes) --------
DROP TABLE IF EXISTS public.project_task_dependency_closure_table CASCADE;
DROP TABLE IF EXISTS public.project_task_dependencies_table CASCADE;
DROP TABLE IF EXISTS public.project_task_table CASCADE;
DROP TABLE IF EXISTS public.project_table CASCADE;

-- ---- functions ------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.pm_seed_demo(uuid, date);
DROP FUNCTION IF EXISTS public.pm_task_downstream(uuid);
DROP FUNCTION IF EXISTS public.pm_task_upstream(uuid);
DROP FUNCTION IF EXISTS public.pm_task_after_progress_change();
DROP FUNCTION IF EXISTS public.pm_recalc_project_progress(uuid);
DROP FUNCTION IF EXISTS public.pm_apply_schedule(uuid, jsonb, timestamptz, numeric);
DROP FUNCTION IF EXISTS public.pm_task_dependency_after_delete();
DROP FUNCTION IF EXISTS public.pm_rebuild_dependency_closure(uuid);
DROP FUNCTION IF EXISTS public.pm_task_dependency_after_insert();
DROP FUNCTION IF EXISTS public.pm_task_dependency_before_update();
DROP FUNCTION IF EXISTS public.pm_task_dependency_before_insert();
DROP FUNCTION IF EXISTS public.pm_dependency_creates_cycle(uuid, uuid);
DROP FUNCTION IF EXISTS public.pm_task_after_delete_subtree();
DROP FUNCTION IF EXISTS public.pm_task_after_move();
DROP FUNCTION IF EXISTS public.pm_task_before_write();
DROP FUNCTION IF EXISTS public.pm_touch_updated_at();
DROP FUNCTION IF EXISTS public.pm_owns_project(uuid);
DROP FUNCTION IF EXISTS public.pm_ltree_label(uuid);

-- The ltree extension is left installed on purpose (other schemas may use it).
-- To remove it as well:  DROP EXTENSION IF EXISTS ltree;
