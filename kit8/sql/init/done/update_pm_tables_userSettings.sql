-- =====================================================================================
-- Non-destructive upgrade: project_user_settings_table (per user Gantt settings of a project).
-- (Fresh installs: create_pm_tables.sql already contains all of this.)
-- Run AFTER create_pm_tables.sql (needs project_table, pm_touch_updated_at, pm_owns_project).
-- Safe to run more than once.
--
-- It also copies every project's old project_table.rowJSON.uxuiSettings into a settings row of the
-- project's owner (existing rows are kept). project_table.rowJSON.uxuiSettings is left in place:
-- the client reads it as a fallback until the user saves his own settings.
-- =====================================================================================

-- =====================================================================================
-- project_user_settings_table - per USER settings of a project (visualisation), kit8/sql/defTable.md pattern
--   (RN: projectUserSettingsTable, kit8/pm/model/constants.ts)
--
--   "rowGUID"       uuid   own id
--   "rowOwnerGUID"  uuid   = project_table."rowGUID"   (the project; deleted with it)
--   "rowParentGUID" uuid   = the user (auth.uid(), the Supabase user id)
--   "orderInList"   float  unused (0)
--   "rowJSON"       jsonb  user specified data for visualisations:
--                          { "uxuiSettings": { showCriticalPath, criticalPathTaskColor, ganttArrowsForm, showTaskProgressOnGantt,
--                            task/projectProgressLinePosition + Color, ganttVsNetworkView, networkViewMode,
--                            networkDiagramVariant, networkScheduleVariant, showTreeHierarchyNumbers,
--                            treeColumnsOrder, treeColumnsWidths, projectTreeContextCommandsMode,
--                            projectGanttChartContextCommandsMode } }        (see kit8/pm/model/types.ts)
--   created_at / updated_at
--
-- One row per (project, user) - UNIQUE ("rowOwnerGUID", "rowParentGUID"); the client upserts on it.
-- Replaces project_table.rowJSON.uxuiSettings (still read as a fallback by the client).
-- RLS: a user sees / writes only his own rows, and only for projects he may open (pm_owns_project).
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.project_user_settings_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" UUID        NOT NULL,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT project_user_settings_unique UNIQUE ("rowOwnerGUID", "rowParentGUID")
);
CREATE INDEX IF NOT EXISTS idx_project_user_settings_user ON public.project_user_settings_table ("rowParentGUID");

DROP TRIGGER IF EXISTS trg_project_user_settings_touch ON public.project_user_settings_table;
CREATE TRIGGER trg_project_user_settings_touch BEFORE UPDATE ON public.project_user_settings_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.project_user_settings_table ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_user_settings_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_user_settings_table TO authenticated;

DROP POLICY IF EXISTS project_user_settings_select ON public.project_user_settings_table;
DROP POLICY IF EXISTS project_user_settings_insert ON public.project_user_settings_table;
DROP POLICY IF EXISTS project_user_settings_update ON public.project_user_settings_table;
DROP POLICY IF EXISTS project_user_settings_delete ON public.project_user_settings_table;
CREATE POLICY project_user_settings_select ON public.project_user_settings_table FOR SELECT TO authenticated
  USING ("rowParentGUID" = auth.uid());
CREATE POLICY project_user_settings_insert ON public.project_user_settings_table FOR INSERT TO authenticated
  WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_owns_project("rowOwnerGUID"));
CREATE POLICY project_user_settings_update ON public.project_user_settings_table FOR UPDATE TO authenticated
  USING ("rowParentGUID" = auth.uid()) WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_owns_project("rowOwnerGUID"));
CREATE POLICY project_user_settings_delete ON public.project_user_settings_table FOR DELETE TO authenticated
  USING ("rowParentGUID" = auth.uid());

-- ---- copy the old per-project settings to the owner's row ---------------------------
INSERT INTO public.project_user_settings_table ("rowOwnerGUID", "rowParentGUID", "rowJSON")
SELECT p."rowGUID", p."rowOwnerGUID", jsonb_build_object('uxuiSettings', p."rowJSON"->'uxuiSettings')
  FROM public.project_table p
 WHERE jsonb_typeof(p."rowJSON"->'uxuiSettings') = 'object'
ON CONFLICT ("rowOwnerGUID", "rowParentGUID") DO NOTHING;
