-- =====================================================================================
-- PM Kanban tables (kit8/sql/defTable.md pattern) - run AFTER create_pm_tables.sql
-- (needs project_table, project_task_table, pm_touch_updated_at, pm_owns_project).
-- Non-destructive, safe to run more than once. Remove: delete_pm_kanban_tables.sql.
--
--   kanban_stage_table               catalog of default Kanban stages (shared)
--                                    RN: kanbanStageTable = "kanban_stage_table"
--   project_kanban_stage_table       the Kanban stages (columns) of ONE project
--                                    RN: projectKanbanStageTable = "project_kanban_stage_table"
--   project_task_kanban_state_table  the Kanban stage of ONE task of a project
--                                    RN: projectTaskKanbanStateTable = "project_task_kanban_state_table"
--
-- Every task of a project uses the SAME stage set (the project's stages). A task without a state
-- row is in the project's FIRST stage (lowest orderInList) - no rows are created for new tasks.
-- The Kanban stage is independent of the task progress % (project_task_table."rowProgress").
--
-- Auto refresh: all three tables are in the supabase_realtime publication (REPLICA IDENTITY FULL);
-- the app listens in kit8/pm/crud/realtime/useProjectRealtime.ts.
-- =====================================================================================

-- =====================================================================================
-- kanban_stage_table - default stages copied into a project the first time its Kanban opens
--   "rowGUID"       text    own id (uuid text)
--   "rowOwnerGUID"  text    'kanbanStageCatalog' (the catalog is shared)
--   "rowParentGUID" text    'empty'
--   "orderInList"   numeric column order
--   "rowJSON"       jsonb   { stageCode, stageName, stageColor, isActive }
-- RLS: every signed-in user may read the catalog and change it (like currencyTable).
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.kanban_stage_table (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'kanbanStageCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS idx_kanban_stage_owner ON public.kanban_stage_table ("rowOwnerGUID", "orderInList");
CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_stage_code ON public.kanban_stage_table ("rowOwnerGUID", lower("rowJSON"->>'stageCode'));

DROP TRIGGER IF EXISTS trg_kanban_stage_touch ON public.kanban_stage_table;
CREATE TRIGGER trg_kanban_stage_touch BEFORE UPDATE ON public.kanban_stage_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.kanban_stage_table ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kanban_stage_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_stage_table TO authenticated;
DROP POLICY IF EXISTS kanban_stage_select ON public.kanban_stage_table;
DROP POLICY IF EXISTS kanban_stage_insert ON public.kanban_stage_table;
DROP POLICY IF EXISTS kanban_stage_update ON public.kanban_stage_table;
DROP POLICY IF EXISTS kanban_stage_delete ON public.kanban_stage_table;
CREATE POLICY kanban_stage_select ON public.kanban_stage_table FOR SELECT TO authenticated USING (true);
CREATE POLICY kanban_stage_insert ON public.kanban_stage_table FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY kanban_stage_update ON public.kanban_stage_table FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY kanban_stage_delete ON public.kanban_stage_table FOR DELETE TO authenticated USING (true);

-- seed: projectTaskKanbanStages = Waiting, Plan, Analyse, Construct, Execute (existing codes are kept)
INSERT INTO public.kanban_stage_table ("orderInList", "rowJSON")
SELECT v.ord, jsonb_build_object('stageCode', v.code, 'stageName', v.name, 'stageColor', v.color, 'isActive', true)
  FROM (VALUES
    (1024, 'waiting',   'Waiting',   '#94A3B8'),
    (2048, 'plan',      'Plan',      '#6366F1'),
    (3072, 'analyse',   'Analyse',   '#0EA5E9'),
    (4096, 'construct', 'Construct', '#F59E0B'),
    (5120, 'execute',   'Execute',   '#22C55E')
  ) AS v(ord, code, name, color)
 WHERE NOT EXISTS (SELECT 1 FROM public.kanban_stage_table k
                    WHERE k."rowOwnerGUID" = 'kanbanStageCatalog' AND lower(k."rowJSON"->>'stageCode') = v.code);

-- =====================================================================================
-- project_kanban_stage_table - the Kanban columns of a project
--   "rowGUID"       uuid    own id (= the stage id stored in the task states)
--   "rowOwnerGUID"  uuid    = project_table."rowGUID" (deleted with the project)
--   "rowParentGUID" text    = kanban_stage_table."rowGUID" it was copied from, or 'empty' (custom stage)
--   "orderInList"   numeric column order (first column = default stage of every task)
--   "rowJSON"       jsonb   { stageCode, stageName, stageColor, wipLimit }
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.project_kanban_stage_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS idx_project_kanban_stage_project ON public.project_kanban_stage_table ("rowOwnerGUID", "orderInList");

DROP TRIGGER IF EXISTS trg_project_kanban_stage_touch ON public.project_kanban_stage_table;
CREATE TRIGGER trg_project_kanban_stage_touch BEFORE UPDATE ON public.project_kanban_stage_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- =====================================================================================
-- project_task_kanban_state_table - the stage of one task (one row per task, only when moved)
--   "rowGUID"       uuid    own id
--   "rowOwnerGUID"  uuid    = project_table."rowGUID" (one realtime filter per project)
--   "rowParentGUID" uuid    = project_task_table."rowGUID" (the task; deleted with it)
--   "orderInList"   numeric card order inside its column
--   "rowJSON"       jsonb   { stageGUID }   stageGUID = project_kanban_stage_table."rowGUID"
--                           (unknown / deleted stage -> the client shows the task in the first stage)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.project_task_kanban_state_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" UUID        NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT project_task_kanban_state_unique UNIQUE ("rowOwnerGUID", "rowParentGUID")
);
CREATE INDEX IF NOT EXISTS idx_project_task_kanban_state_task ON public.project_task_kanban_state_table ("rowParentGUID");

DROP TRIGGER IF EXISTS trg_project_task_kanban_state_touch ON public.project_task_kanban_state_table;
CREATE TRIGGER trg_project_task_kanban_state_touch BEFORE UPDATE ON public.project_task_kanban_state_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- deleting a project stage moves its tasks back to the first remaining stage (their rows are removed)
CREATE OR REPLACE FUNCTION public.pm_kanban_stage_after_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.project_task_kanban_state_table s
   WHERE s."rowOwnerGUID" = OLD."rowOwnerGUID" AND s."rowJSON"->>'stageGUID' = OLD."rowGUID"::text;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_project_kanban_stage_after_delete ON public.project_kanban_stage_table;
CREATE TRIGGER trg_project_kanban_stage_after_delete AFTER DELETE ON public.project_kanban_stage_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_kanban_stage_after_delete();

-- pm_kanban_ensure_project_stages(project): the project's stages; the first call copies the catalog
-- (active stages, in catalog order) into project_kanban_stage_table. Serialized per project with an
-- advisory lock, so two browsers opening the Kanban at once never create the stages twice.
-- SECURITY INVOKER: RLS applies (only the project's owner gets / creates rows).
CREATE OR REPLACE FUNCTION public.pm_kanban_ensure_project_stages(p_project uuid)
RETURNS SETOF public.project_kanban_stage_table
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.pm_owns_project(p_project) THEN
    RAISE EXCEPTION 'pm_gantt: project not found';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('pm_kanban_stages:' || p_project::text));
  IF NOT EXISTS (SELECT 1 FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = p_project) THEN
    INSERT INTO public.project_kanban_stage_table ("rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
    SELECT p_project, k."rowGUID", k."orderInList",
           jsonb_build_object('stageCode', k."rowJSON"->>'stageCode', 'stageName', k."rowJSON"->>'stageName',
                              'stageColor', k."rowJSON"->>'stageColor')
      FROM public.kanban_stage_table k
     WHERE k."rowOwnerGUID" = 'kanbanStageCatalog' AND coalesce((k."rowJSON"->>'isActive')::boolean, true)
     ORDER BY k."orderInList";
  END IF;
  RETURN QUERY SELECT * FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = p_project ORDER BY "orderInList";
END;
$$;
REVOKE ALL ON FUNCTION public.pm_kanban_ensure_project_stages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pm_kanban_ensure_project_stages(uuid) TO authenticated;

-- ---- RLS: only the owner of the project -------------------------------------------------
ALTER TABLE public.project_kanban_stage_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_kanban_state_table ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_kanban_stage_table, public.project_task_kanban_state_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_kanban_stage_table, public.project_task_kanban_state_table TO authenticated;

DROP POLICY IF EXISTS project_kanban_stage_all ON public.project_kanban_stage_table;
CREATE POLICY project_kanban_stage_all ON public.project_kanban_stage_table FOR ALL TO authenticated
  USING (public.pm_owns_project("rowOwnerGUID")) WITH CHECK (public.pm_owns_project("rowOwnerGUID"));

DROP POLICY IF EXISTS project_task_kanban_state_all ON public.project_task_kanban_state_table;
CREATE POLICY project_task_kanban_state_all ON public.project_task_kanban_state_table FOR ALL TO authenticated
  USING (public.pm_owns_project("rowOwnerGUID"))
  WITH CHECK (
    public.pm_owns_project("rowOwnerGUID")
    AND EXISTS (SELECT 1 FROM public.project_task_table t
                 WHERE t."rowGUID" = project_task_kanban_state_table."rowParentGUID"
                   AND t."projectGUID" = project_task_kanban_state_table."rowOwnerGUID")
  );

-- ---- realtime (auto refresh in every browser / device) ------------------------------------
ALTER TABLE public.kanban_stage_table              REPLICA IDENTITY FULL;
ALTER TABLE public.project_kanban_stage_table      REPLICA IDENTITY FULL;
ALTER TABLE public.project_task_kanban_state_table REPLICA IDENTITY FULL;
DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY['kanban_stage_table', 'project_kanban_stage_table', 'project_task_kanban_state_table']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Check:  SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
