-- =====================================================================================
-- PM Gantt module schema (Supabase / PostgreSQL 15+)
--
--   project_table                          projects                     (RN: projectTable)
--   project_task_table                     stages + tasks (ltree tree)  (RN: projectTaskTable)
--   project_task_dependencies_table        DAG edges (the dependencies)
--   project_task_dependency_closure_table  transitive closure of the DAG (trigger-maintained)
--   project_user_settings_table            per user settings of a project (RN: projectUserSettingsTable)
--
-- Three structures, three jobs (never mix them):
--   1. TREE  (Project -> Stage -> Task)   = ltree "treePath". Only answers "what contains what".
--   2. DAG   (Task/Stage -> Task/Stage)   = edge table. Answers "what must happen first",
--                                           with MS-Project link types FS/SS/FF/SF + lag.
--   3. CLOSURE (all upstream/downstream)  = precomputed from the DAG for O(1)
--                                           "is X blocked by Y" and "all blockers" lookups.
--
-- Improvements over the plain edge+closure pattern:
--   * "projectGUID" is a real, FK-backed column on every child table -> ON DELETE CASCADE,
--     cheap per-project reads, per-project realtime filters, per-project closure rebuilds.
--   * treePath integrity is enforced (first label = project, last label = own rowGUID,
--     parent must exist) and moves/deletes of a stage rewrite/delete its whole subtree.
--   * cycle detection is tree-aware: a link to a stage constrains every task inside it,
--     so "A in Stage S, S after B, B after A" is rejected too (pm_dependency_creates_cycle).
--   * inserts on one project are serialized with an advisory lock -> no concurrent cycles.
--   * closure deletes rebuild only the affected project (not the whole table).
--   * trigger functions are SECURITY DEFINER so clients never need write access to the
--     closure table, while RLS still guards every client-visible table.
--   * scheduler write-back RPC (pm_apply_schedule) updates start/finish of many rows in
--     one round-trip; the schedule is always queryable in SQL (project_task_schedule_view).
--   * project / stage progress = duration-weighted earned progress, kept up to date by the
--     stored procedure pm_recalc_project_progress + trigger on every task % change.
--   * project_user_settings_table = Gantt look per project AND user (rowJSON.uxuiSettings, see
--     kit8/pm/model/types.ts); replaces project_table.rowJSON.uxuiSettings (still read as a fallback).
--
-- Dates: rowJSON.startAt = computed start, "rowDuration" (timestamptz) = END of the
-- duration (exclusive finish). duration = "rowDuration" - startAt. All UTC midnights.
--
-- ltree labels allow [A-Za-z0-9_] only -> labels are the rowGUID with '-' replaced by
-- '_' (kit8/pm/scheduling.ts toLtreeLabel() does the same on the client).
--
-- WARNING: this is an init script - it DROPs and recreates the PM tables.
-- File: kit8/sql/init/create_pm_tables.sql   (drop everything: delete_pm_tables.sql)
--
-- rowJSON (free-form JSONB) exists on EVERY PM table:
--   project_table / project_task_table  name, rowKind, durationDays, taskColor, notes, ...
--   project_task_dependencies_table      dependencyColor, notes, ...  (client-editable)
--   project_task_dependency_closure_table  written by the triggers (currently '{}')
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS ltree;

CREATE OR REPLACE FUNCTION public.pm_ltree_label(p_guid uuid) RETURNS ltree
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT text2ltree(replace(lower(p_guid::text), '-', '_'));
$$;

DROP TABLE IF EXISTS public.project_user_settings_table CASCADE;
DROP TABLE IF EXISTS public.project_task_dependency_closure_table CASCADE;
DROP TABLE IF EXISTS public.project_task_dependencies_table CASCADE;
DROP TABLE IF EXISTS public.project_task_table CASCADE;
DROP TABLE IF EXISTS public.project_table CASCADE;

-- -------------------------------------------------------------------------------------
-- 1) project_table
-- -------------------------------------------------------------------------------------
CREATE TABLE public.project_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,                       -- project finish (end of duration)
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,    -- fractional ordering
  "rowJSON"      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT project_table_progress_chk CHECK ("rowProgress" BETWEEN 0 AND 100),
  CONSTRAINT project_table_path_chk CHECK ("treePath" = public.pm_ltree_label("rowGUID"))
);
CREATE INDEX idx_project_table_owner_order ON public.project_table ("rowOwnerGUID", "orderInList");
CREATE INDEX idx_project_table_treePath ON public.project_table USING GIST ("treePath");
CREATE INDEX idx_project_table_rowJSON ON public.project_table USING GIN ("rowJSON" jsonb_path_ops);

-- -------------------------------------------------------------------------------------
-- 2) project_task_table - stages AND tasks. rowJSON->>'rowKind' = 'stage'|'task'|'milestone'
--    treePath = <project>.<stage>.<task>
-- -------------------------------------------------------------------------------------
CREATE TABLE public.project_task_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "projectGUID"  UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,                       -- finish (end of duration), written by the scheduler
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,    -- fractional ordering among siblings
  "rowJSON"      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT project_task_progress_chk CHECK ("rowProgress" BETWEEN 0 AND 100),
  CONSTRAINT project_task_path_depth_chk CHECK (nlevel("treePath") >= 2),
  CONSTRAINT project_task_path_root_chk CHECK (subpath("treePath", 0, 1) = public.pm_ltree_label("projectGUID")),
  CONSTRAINT project_task_path_self_chk CHECK (subpath("treePath", nlevel("treePath") - 1, 1) = public.pm_ltree_label("rowGUID")),
  CONSTRAINT project_task_path_unique UNIQUE ("treePath")
);
CREATE INDEX idx_project_task_project_order ON public.project_task_table ("projectGUID", "orderInList");
CREATE INDEX idx_project_task_owner ON public.project_task_table ("rowOwnerGUID");
CREATE INDEX idx_project_task_treePath ON public.project_task_table USING GIST ("treePath");
CREATE INDEX idx_project_task_rowJSON ON public.project_task_table USING GIN ("rowJSON" jsonb_path_ops);

-- -------------------------------------------------------------------------------------
-- 3) project_task_dependencies_table - the DAG. rowGUID waits for rowDependsOnGUID.
-- -------------------------------------------------------------------------------------
CREATE TABLE public.project_task_dependencies_table (
  "rowGUID"          UUID        NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "rowDependsOnGUID" UUID        NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"      UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID"     UUID        NOT NULL,
  "linkType"         TEXT        NOT NULL DEFAULT 'FS',
  "lagDays"          NUMERIC     NOT NULL DEFAULT 0,  -- lag (>0) / lead (<0) in working days
  "rowJSON"          JSONB       NOT NULL DEFAULT '{}'::jsonb, -- dependencyColor, notes, ...
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID", "rowDependsOnGUID"),
  CONSTRAINT project_task_dep_self_chk CHECK ("rowGUID" <> "rowDependsOnGUID"),
  CONSTRAINT project_task_dep_type_chk CHECK ("linkType" IN ('FS', 'SS', 'FF', 'SF'))
);
CREATE INDEX idx_task_deps_dependsOn ON public.project_task_dependencies_table ("rowDependsOnGUID");
CREATE INDEX idx_task_deps_project ON public.project_task_dependencies_table ("projectGUID");
CREATE INDEX idx_task_deps_rowJSON ON public.project_task_dependencies_table USING GIN ("rowJSON" jsonb_path_ops);

-- -------------------------------------------------------------------------------------
-- 4) project_task_dependency_closure_table - every (ancestor ⇝ descendant) pair of the
--    DAG with the SHORTEST path length. Written only by triggers below.
-- -------------------------------------------------------------------------------------
CREATE TABLE public.project_task_dependency_closure_table (
  "ancestorGUID"   UUID NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "descendantGUID" UUID NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"    UUID NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "depthLevel"     INT  NOT NULL,
  "rowJSON"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY ("ancestorGUID", "descendantGUID"),
  CONSTRAINT project_task_dep_closure_self_chk CHECK ("ancestorGUID" <> "descendantGUID")
);
CREATE INDEX idx_task_dep_closure_descendant ON public.project_task_dependency_closure_table ("descendantGUID");
CREATE INDEX idx_task_dep_closure_project ON public.project_task_dependency_closure_table ("projectGUID");

-- =====================================================================================
-- Generic helpers
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.pm_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_table_touch BEFORE UPDATE ON public.project_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
CREATE TRIGGER trg_project_task_table_touch BEFORE UPDATE ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- =====================================================================================
-- TREE integrity (ltree)
-- =====================================================================================

-- parent must exist inside the same project; a row cannot be moved under itself.
CREATE OR REPLACE FUNCTION public.pm_task_before_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_parent ltree;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."projectGUID" <> OLD."projectGUID" THEN
      RAISE EXCEPTION 'pm_gantt: a row cannot be moved to another project' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW."treePath" = OLD."treePath" THEN
      RETURN NEW;
    END IF;
    IF NEW."treePath" <@ OLD."treePath" THEN
      RAISE EXCEPTION 'pm_gantt: a row cannot be moved inside its own subtree' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- rows re-pathed by pm_task_after_move (trigger depth > 1) are validated by the outer move
  IF nlevel(NEW."treePath") > 2 AND pg_trigger_depth() = 1 THEN
    v_parent := subpath(NEW."treePath", 0, nlevel(NEW."treePath") - 1);
    IF NOT EXISTS (
      SELECT 1 FROM public.project_task_table p
      WHERE p."treePath" = v_parent AND p."projectGUID" = NEW."projectGUID"
    ) THEN
      RAISE EXCEPTION 'pm_gantt: parent % does not exist in project %', v_parent, NEW."projectGUID"
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_task_before_write
  BEFORE INSERT OR UPDATE OF "treePath", "projectGUID" ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_before_write();

-- moving a stage rewrites the paths of its whole subtree (one statement, one round-trip)
CREATE OR REPLACE FUNCTION public.pm_task_after_move() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- the outer move already re-paths the entire subtree in one statement
  IF pg_trigger_depth() = 1 AND NEW."treePath" IS DISTINCT FROM OLD."treePath" THEN
    UPDATE public.project_task_table
       SET "treePath" = NEW."treePath" || subpath("treePath", nlevel(OLD."treePath"))
     WHERE "projectGUID" = NEW."projectGUID"
       AND "treePath" <@ OLD."treePath"
       AND "rowGUID" <> NEW."rowGUID";
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_project_task_after_move
  AFTER UPDATE OF "treePath" ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_after_move();

-- deleting a stage deletes its subtree (edges + closure follow through FK cascades)
CREATE OR REPLACE FUNCTION public.pm_task_after_delete_subtree() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.project_task_table
   WHERE "projectGUID" = OLD."projectGUID"
     AND "treePath" <@ OLD."treePath"
     AND "rowGUID" <> OLD."rowGUID";
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_project_task_after_delete_subtree
  AFTER DELETE ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_after_delete_subtree();

-- =====================================================================================
-- DAG integrity + closure maintenance
-- =====================================================================================

-- Tree-aware reachability: does succ already (transitively) come before pred?
-- A link on a stage applies to all rows inside it, so from a row we may continue through
-- the links of its ancestors and of its descendants.
CREATE OR REPLACE FUNCTION public.pm_dependency_creates_cycle(p_pred uuid, p_succ uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE
  pred AS (SELECT "treePath" AS path, "projectGUID" AS project FROM public.project_task_table WHERE "rowGUID" = p_pred),
  reach(guid) AS (            -- uuid only: ltree is not hashable for a recursive UNION
    SELECT p_succ
    UNION
    SELECT e."rowGUID"
      FROM reach r
      JOIN public.project_task_table rt ON rt."rowGUID" = r.guid
      JOIN public.project_task_table rel
        ON rel."projectGUID" = rt."projectGUID"
       AND (rel."treePath" @> rt."treePath" OR rel."treePath" <@ rt."treePath")
      JOIN public.project_task_dependencies_table e ON e."rowDependsOnGUID" = rel."rowGUID"
  )
  SELECT p_pred = p_succ
      OR EXISTS (
        SELECT 1 FROM reach r
          JOIN public.project_task_table rt ON rt."rowGUID" = r.guid
          CROSS JOIN pred
         WHERE rt."treePath" @> pred.path OR rt."treePath" <@ pred.path
      );
$$;

CREATE OR REPLACE FUNCTION public.pm_task_dependency_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_succ public.project_task_table%ROWTYPE;
  v_pred public.project_task_table%ROWTYPE;
BEGIN
  SELECT * INTO v_succ FROM public.project_task_table WHERE "rowGUID" = NEW."rowGUID";
  SELECT * INTO v_pred FROM public.project_task_table WHERE "rowGUID" = NEW."rowDependsOnGUID";
  IF v_succ."rowGUID" IS NULL OR v_pred."rowGUID" IS NULL THEN
    RAISE EXCEPTION 'pm_gantt: dependency references a missing task' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_succ."projectGUID" <> v_pred."projectGUID" THEN
    RAISE EXCEPTION 'pm_gantt: dependencies must stay inside one project' USING ERRCODE = 'check_violation';
  END IF;
  NEW."projectGUID" := v_succ."projectGUID";

  IF v_succ."treePath" @> v_pred."treePath" OR v_succ."treePath" <@ v_pred."treePath" THEN
    RAISE EXCEPTION 'pm_gantt: a row cannot depend on its own stage or sub-rows' USING ERRCODE = 'check_violation';
  END IF;

  -- serialize DAG writes per project so two concurrent inserts cannot close a cycle
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."projectGUID"::text, 0));

  IF public.pm_dependency_creates_cycle(NEW."rowDependsOnGUID", NEW."rowGUID") THEN
    RAISE EXCEPTION 'pm_gantt: dependency % -> % would create a cycle', NEW."rowDependsOnGUID", NEW."rowGUID"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_task_dependency_before_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."rowGUID" <> OLD."rowGUID" OR NEW."rowDependsOnGUID" <> OLD."rowDependsOnGUID"
     OR NEW."projectGUID" <> OLD."projectGUID" THEN
    RAISE EXCEPTION 'pm_gantt: dependency endpoints are immutable (delete + insert instead)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- incremental closure insert: (all ancestors of pred + pred) x (succ + all descendants of succ)
CREATE OR REPLACE FUNCTION public.pm_task_dependency_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_task_dependency_closure_table ("ancestorGUID", "descendantGUID", "projectGUID", "depthLevel", "rowJSON")
  SELECT a.anc, d.dsc, NEW."projectGUID", a.depth + d.depth + 1, '{}'::jsonb
    FROM (
      SELECT NEW."rowDependsOnGUID" AS anc, 0 AS depth
      UNION ALL
      SELECT c."ancestorGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
       WHERE c."descendantGUID" = NEW."rowDependsOnGUID"
    ) a
   CROSS JOIN (
      SELECT NEW."rowGUID" AS dsc, 0 AS depth
      UNION ALL
      SELECT c."descendantGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
       WHERE c."ancestorGUID" = NEW."rowGUID"
    ) d
   WHERE a.anc <> d.dsc
  ON CONFLICT ("ancestorGUID", "descendantGUID") DO UPDATE
    SET "depthLevel" = LEAST(public.project_task_dependency_closure_table."depthLevel", EXCLUDED."depthLevel");
  RETURN NULL;
END;
$$;

-- a DAG can have several paths between two nodes, so a delete cannot be undone locally;
-- rebuild the closure of THAT project only (tiny at PM scale, always correct).
CREATE OR REPLACE FUNCTION public.pm_rebuild_dependency_closure(p_project uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.project_task_dependency_closure_table WHERE "projectGUID" = p_project;
  INSERT INTO public.project_task_dependency_closure_table ("ancestorGUID", "descendantGUID", "projectGUID", "depthLevel", "rowJSON")
  WITH RECURSIVE walk(anc, dsc, depth) AS (
    SELECT e."rowDependsOnGUID", e."rowGUID", 1
      FROM public.project_task_dependencies_table e WHERE e."projectGUID" = p_project
    UNION
    SELECT w.anc, e."rowGUID", w.depth + 1
      FROM walk w
      JOIN public.project_task_dependencies_table e
        ON e."rowDependsOnGUID" = w.dsc AND e."projectGUID" = p_project
     WHERE w.depth < 10000
  )
  SELECT anc, dsc, p_project, MIN(depth), '{}'::jsonb FROM walk WHERE anc <> dsc GROUP BY anc, dsc;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_task_dependency_after_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- skip when the whole project is being deleted (FK cascade already cleans up)
  IF EXISTS (SELECT 1 FROM public.project_table WHERE "rowGUID" = OLD."projectGUID") THEN
    PERFORM public.pm_rebuild_dependency_closure(OLD."projectGUID");
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_pm_task_dependency_before_insert
  BEFORE INSERT ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_before_insert();
CREATE TRIGGER trg_pm_task_dependency_before_update
  BEFORE UPDATE ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_before_update();
CREATE TRIGGER trg_pm_task_dependency_after_insert
  AFTER INSERT ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_after_insert();
CREATE TRIGGER trg_pm_task_dependency_after_delete
  AFTER DELETE ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_after_delete();

-- =====================================================================================
-- Scheduler write-back + read helpers
-- =====================================================================================

-- p_rows: [{"rowGUID": uuid, "startAt": timestamptz, "finishAt": timestamptz, "rowProgress"?: numeric}]
-- SECURITY INVOKER -> RLS applies, callers can only touch their own rows.
CREATE OR REPLACE FUNCTION public.pm_apply_schedule(
  p_project_guid uuid,
  p_rows jsonb,
  p_project_finish timestamptz DEFAULT NULL,
  p_project_progress numeric DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.project_task_table t
     SET "rowJSON"     = jsonb_set(t."rowJSON", '{startAt}', to_jsonb(r."startAt")),
         "rowDuration" = r."finishAt",
         "rowProgress" = COALESCE(r."rowProgress", t."rowProgress")
    FROM jsonb_to_recordset(p_rows) AS r("rowGUID" uuid, "startAt" timestamptz, "finishAt" timestamptz, "rowProgress" numeric)
   WHERE t."rowGUID" = r."rowGUID" AND t."projectGUID" = p_project_guid;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF p_project_finish IS NOT NULL OR p_project_progress IS NOT NULL THEN
    UPDATE public.project_table
       SET "rowDuration" = COALESCE(p_project_finish, "rowDuration"),
           "rowProgress" = COALESCE(p_project_progress, "rowProgress")
     WHERE "rowGUID" = p_project_guid;
  END IF;
  -- the DB formula is the source of truth for summary / project progress
  PERFORM public.pm_recalc_project_progress(p_project_guid);
  RETURN v_count;
END;
$$;

-- =====================================================================================
-- Project / stage progress (stored procedure + trigger)
--
--   progress(summary or project) = round1( Σ wᵢ·pᵢ / Σ wᵢ )   over its LEAF rows i
--   wᵢ = max(rowJSON.durationDays, 1)        pᵢ = "rowProgress" clamped to 0..100
--
-- "Duration-weighted earned progress": a 10-day task at 50 % moves the project 10x more
-- than a 1-day task at 50 %. Milestones (0 days) count as 1 day. Leaves = rows without
-- children that are not (empty) stages. No leaves -> 0. Same formula on the client
-- (kit8/pm/scheduling.ts computeProjectProgress / roll-up), so the UI never jumps.
--
-- pm_recalc_project_progress(project) rewrites every summary row's "rowProgress" and
-- project_table."rowProgress"; the trigger below calls it whenever a task's progress,
-- duration, kind or position changes, or a task is inserted / deleted.
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.pm_recalc_project_progress(p_project uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_progress numeric;
BEGIN
  -- callers with a JWT may only recalc their own projects (SQL editor / triggers: no JWT check needed)
  IF auth.uid() IS NOT NULL AND NOT public.pm_owns_project(p_project) THEN
    RAISE EXCEPTION 'pm_gantt: project % is not yours', p_project USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- summaries (stages / any row with children)
  WITH rows AS (
    SELECT "rowGUID", "treePath", "rowProgress", "rowJSON"
      FROM public.project_task_table WHERE "projectGUID" = p_project
  ), leaves AS (
    SELECT r."rowGUID", r."treePath",
           GREATEST(CASE WHEN r."rowJSON"->>'durationDays' ~ '^-?[0-9]+(\.[0-9]+)?$'
                         THEN (r."rowJSON"->>'durationDays')::numeric ELSE 0 END, 1) AS w,
           LEAST(GREATEST(COALESCE(r."rowProgress", 0), 0), 100) AS p
      FROM rows r
     WHERE COALESCE(r."rowJSON"->>'rowKind', 'task') <> 'stage'
       AND NOT EXISTS (SELECT 1 FROM rows c WHERE c."treePath" <@ r."treePath" AND c."rowGUID" <> r."rowGUID")
  ), summaries AS (
    SELECT s."rowGUID", ROUND(SUM(l.w * l.p) / SUM(l.w), 1) AS prog
      FROM rows s
      JOIN leaves l ON l."treePath" <@ s."treePath" AND l."rowGUID" <> s."rowGUID"
     GROUP BY s."rowGUID"
  )
  UPDATE public.project_task_table t
     SET "rowProgress" = s.prog
    FROM summaries s
   WHERE t."rowGUID" = s."rowGUID" AND t."rowProgress" IS DISTINCT FROM s.prog;

  -- the project
  WITH rows AS (
    SELECT "rowGUID", "treePath", "rowProgress", "rowJSON"
      FROM public.project_task_table WHERE "projectGUID" = p_project
  ), leaves AS (
    SELECT GREATEST(CASE WHEN r."rowJSON"->>'durationDays' ~ '^-?[0-9]+(\.[0-9]+)?$'
                         THEN (r."rowJSON"->>'durationDays')::numeric ELSE 0 END, 1) AS w,
           LEAST(GREATEST(COALESCE(r."rowProgress", 0), 0), 100) AS p
      FROM rows r
     WHERE COALESCE(r."rowJSON"->>'rowKind', 'task') <> 'stage'
       AND NOT EXISTS (SELECT 1 FROM rows c WHERE c."treePath" <@ r."treePath" AND c."rowGUID" <> r."rowGUID")
  )
  SELECT COALESCE(ROUND(SUM(w * p) / NULLIF(SUM(w), 0), 1), 0) INTO v_progress FROM leaves;

  UPDATE public.project_table
     SET "rowProgress" = v_progress
   WHERE "rowGUID" = p_project AND "rowProgress" IS DISTINCT FROM v_progress;
  RETURN v_progress;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_task_after_progress_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project uuid := COALESCE(NEW."projectGUID", OLD."projectGUID");
BEGIN
  -- rows written by the recalc itself / by subtree triggers run at depth > 1
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;
  -- skip when the whole project is being deleted (FK cascade)
  IF NOT EXISTS (SELECT 1 FROM public.project_table WHERE "rowGUID" = v_project) THEN
    RETURN NULL;
  END IF;
  PERFORM public.pm_recalc_project_progress(v_project);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_zz_progress_ins_del ON public.project_task_table;
DROP TRIGGER IF EXISTS trg_project_task_zz_progress_upd ON public.project_task_table;
-- "zz": runs after the subtree triggers (triggers of one event fire in name order)
CREATE TRIGGER trg_project_task_zz_progress_ins_del
  AFTER INSERT OR DELETE ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_after_progress_change();
CREATE TRIGGER trg_project_task_zz_progress_upd
  AFTER UPDATE OF "rowProgress", "rowJSON", "treePath" ON public.project_task_table
  FOR EACH ROW
  WHEN (OLD."rowProgress" IS DISTINCT FROM NEW."rowProgress"
        OR (OLD."rowJSON"->>'durationDays') IS DISTINCT FROM (NEW."rowJSON"->>'durationDays')
        OR (OLD."rowJSON"->>'rowKind') IS DISTINCT FROM (NEW."rowJSON"->>'rowKind')
        OR OLD."treePath" IS DISTINCT FROM NEW."treePath")
  EXECUTE FUNCTION public.pm_task_after_progress_change();

GRANT EXECUTE ON FUNCTION public.pm_recalc_project_progress(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.project_task_schedule_view
WITH (security_invoker = true) AS
SELECT t."rowGUID",
       t."projectGUID",
       t."treePath",
       nlevel(t."treePath") - 1                        AS "treeDepth",
       t."rowJSON"->>'name'                            AS "name",
       t."rowJSON"->>'rowKind'                         AS "rowKind",
       (t."rowJSON"->>'startAt')::timestamptz          AS "startAt",
       t."rowDuration"                                 AS "finishAt",
       t."rowDuration" - (t."rowJSON"->>'startAt')::timestamptz AS "duration",
       t."rowProgress",
       t."orderInList"
  FROM public.project_task_table t;

-- "all blockers of X" / "everything X blocks" straight from the closure table
CREATE OR REPLACE FUNCTION public.pm_task_upstream(p_task uuid)
RETURNS TABLE ("rowGUID" uuid, "depthLevel" int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c."ancestorGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
   WHERE c."descendantGUID" = p_task ORDER BY c."depthLevel";
$$;

CREATE OR REPLACE FUNCTION public.pm_task_downstream(p_task uuid)
RETURNS TABLE ("rowGUID" uuid, "depthLevel" int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c."descendantGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
   WHERE c."ancestorGUID" = p_task ORDER BY c."depthLevel";
$$;

-- =====================================================================================
-- Row Level Security + CRUD permissions
--
-- Ownership: "rowOwnerGUID" = auth.uid() (the app's activeUserGUID is the Supabase uid).
-- Child rows additionally require that the parent project belongs to the same user, so
-- nobody can attach tasks/edges to someone else's project.
--
--   table                                   SELECT  INSERT  UPDATE  DELETE
--   project_table                           owner   owner   owner   owner
--   project_task_table                      owner   owner   owner   owner
--   project_task_dependencies_table         owner   owner   owner*  owner   (*linkType/lagDays/rowJSON only)
--   project_task_dependency_closure_table   owner   -       -       -       (triggers only)
-- =====================================================================================
ALTER TABLE public.project_table                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_table                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_dependencies_table       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_dependency_closure_table ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_table                         FROM anon, authenticated;
REVOKE ALL ON public.project_task_table                    FROM anon, authenticated;
REVOKE ALL ON public.project_task_dependencies_table       FROM anon, authenticated;
REVOKE ALL ON public.project_task_dependency_closure_table FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_table                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_table              TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.project_task_dependencies_table TO authenticated;
GRANT UPDATE ("linkType", "lagDays", "rowJSON") ON public.project_task_dependencies_table TO authenticated;
GRANT SELECT                         ON public.project_task_dependency_closure_table TO authenticated;
GRANT SELECT                         ON public.project_task_schedule_view      TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_owns_project(p_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_table p WHERE p."rowGUID" = p_project AND p."rowOwnerGUID" = auth.uid());
$$;

-- project_table
CREATE POLICY project_table_select ON public.project_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_table_insert ON public.project_table FOR INSERT TO authenticated
  WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_table_update ON public.project_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_table_delete ON public.project_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid());

-- project_task_table
CREATE POLICY project_task_select ON public.project_task_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_task_insert ON public.project_task_table FOR INSERT TO authenticated
  WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_update ON public.project_task_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid())
  WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_delete ON public.project_task_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid());

-- project_task_dependencies_table
CREATE POLICY project_task_dep_select ON public.project_task_dependencies_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_task_dep_insert ON public.project_task_dependencies_table FOR INSERT TO authenticated
  WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_dep_update ON public.project_task_dependencies_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_task_dep_delete ON public.project_task_dependencies_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid());

-- project_task_dependency_closure_table (read-only for clients)
CREATE POLICY project_task_dep_closure_select ON public.project_task_dependency_closure_table FOR SELECT TO authenticated
  USING (public.pm_owns_project("projectGUID"));

REVOKE ALL ON FUNCTION public.pm_rebuild_dependency_closure(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_apply_schedule(uuid, jsonb, timestamptz, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_dependency_creates_cycle(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_task_upstream(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_task_downstream(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_owns_project(uuid) TO authenticated;

-- ---- DEV ONLY: uncomment to let the anon key read/write everything (no sign-in) ------
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_table, public.project_task_table,
--       public.project_task_dependencies_table TO anon;
-- GRANT SELECT ON public.project_task_dependency_closure_table TO anon;
-- CREATE POLICY project_table_dev_anon ON public.project_table FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY project_task_dev_anon ON public.project_task_table FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY project_task_dep_dev_anon ON public.project_task_dependencies_table FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY project_task_dep_closure_dev_anon ON public.project_task_dependency_closure_table FOR SELECT TO anon USING (true);

-- =====================================================================================
-- Realtime (React Query invalidation on other clients' changes). REPLICA IDENTITY FULL
-- lets DELETE events carry "projectGUID" so per-project channel filters also match them.
-- =====================================================================================
ALTER TABLE public.project_table                   REPLICA IDENTITY FULL;
ALTER TABLE public.project_task_table              REPLICA IDENTITY FULL;
ALTER TABLE public.project_task_dependencies_table REPLICA IDENTITY FULL;

DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['project_table', 'project_task_table', 'project_task_dependencies_table'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- =====================================================================================
-- Demo data (the TRD use case). Run as a signed-in user:  select public.pm_seed_demo();
-- or from the SQL editor:                                select public.pm_seed_demo('<user uuid>');
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.pm_seed_demo(p_owner uuid DEFAULT auth.uid(), p_start date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_project jsonb;
  v_stage jsonb;
  v_task jsonb;
  v_p uuid; v_s uuid; v_t uuid;
  v_p_order numeric := COALESCE((SELECT MAX("orderInList") FROM public.project_table WHERE "rowOwnerGUID" = p_owner), 0);
  v_s_order numeric; v_t_order numeric;
  v_ids uuid[];
  v_after int;
  v_start timestamptz := (p_start::timestamp AT TIME ZONE 'UTC');
  v_demo jsonb := '[
    {"name":"Project 1","stages":[
      {"name":"Stage 1","tasks":[{"name":"Task 111","days":3},{"name":"Task 112","days":5},{"name":"Task 113","days":2,"after":[1,2]}]},
      {"name":"Stage 2","tasks":[{"name":"Task 121","days":3},{"name":"Task 122","days":5},{"name":"Task 123","days":2,"after":[1,2]}]}]},
    {"name":"Project 2","stages":[
      {"name":"Stage 21","tasks":[{"name":"Task 211","days":6},{"name":"Task 212","days":7},{"name":"Task 213","days":3,"after":[1,2]}]},
      {"name":"Stage 22","tasks":[{"name":"Task 221","days":6},{"name":"Task 222","days":7},{"name":"Task 223","days":3,"after":[1,2]}]}]}
  ]'::jsonb;
BEGIN
  IF p_owner IS NULL THEN
    RAISE EXCEPTION 'pm_seed_demo: pass an owner uuid or call it as a signed-in user';
  END IF;
  FOR v_project IN SELECT * FROM jsonb_array_elements(v_demo) LOOP
    v_p := gen_random_uuid();
    v_p_order := v_p_order + 1024;
    INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "orderInList", "rowJSON")
    VALUES (v_p, public.pm_ltree_label(v_p), p_owner, v_p_order,
            jsonb_build_object('rowKind', 'project', 'name', v_project->>'name', 'durationDays', 0,
                               'projectStartAt', v_start, 'skipWeekends', false));
    v_s_order := 0;
    FOR v_stage IN SELECT * FROM jsonb_array_elements(v_project->'stages') LOOP
      v_s := gen_random_uuid();
      v_s_order := v_s_order + 1024;
      INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "orderInList", "rowJSON")
      VALUES (v_s, public.pm_ltree_label(v_p) || public.pm_ltree_label(v_s), v_p, p_owner, v_s_order,
              jsonb_build_object('rowKind', 'stage', 'name', v_stage->>'name', 'durationDays', 0));
      v_t_order := 0;
      v_ids := ARRAY[]::uuid[];
      FOR v_task IN SELECT * FROM jsonb_array_elements(v_stage->'tasks') LOOP
        v_t := gen_random_uuid();
        v_t_order := v_t_order + 1024;
        v_ids := v_ids || v_t;
        INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "orderInList", "rowJSON")
        VALUES (v_t, public.pm_ltree_label(v_p) || public.pm_ltree_label(v_s) || public.pm_ltree_label(v_t), v_p, p_owner, v_t_order,
                jsonb_build_object('rowKind', 'task', 'name', v_task->>'name', 'durationDays', (v_task->>'days')::int));
        FOR v_after IN SELECT jsonb_array_elements_text(COALESCE(v_task->'after', '[]'::jsonb))::int LOOP
          INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID", "rowOwnerGUID", "linkType", "lagDays", "rowJSON")
          VALUES (v_t, v_ids[v_after], v_p, p_owner, 'FS', 0, '{}'::jsonb);
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pm_seed_demo(uuid, date) TO authenticated;

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
