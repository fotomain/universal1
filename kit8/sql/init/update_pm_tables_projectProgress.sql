-- =====================================================================================
-- Non-destructive upgrade: project / stage progress stored procedure + trigger.
-- (Fresh installs: create_pm_tables.sql already contains all of this.)
-- Run AFTER create_pm_tables.sql / update_pm_tables_rowJSON.sql.
-- =====================================================================================
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

-- pm_apply_schedule: keep the client write-back, then let the DB formula win
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
  PERFORM public.pm_recalc_project_progress(p_project_guid);
  RETURN v_count;
END;
$$;

-- recalc every existing project once
SELECT public.pm_recalc_project_progress("rowGUID") FROM public.project_table;

-- move the old top-level view keys into rowJSON.uxuiSettings
UPDATE public.project_table
   SET "rowJSON" = ("rowJSON" - 'showCriticalPath' - 'ganttArrowsForm' - 'showTaskProgressOnGantt')
       || jsonb_build_object('uxuiSettings',
            COALESCE("rowJSON"->'uxuiSettings', '{}'::jsonb)
            || jsonb_strip_nulls(jsonb_build_object(
                 'showCriticalPath', "rowJSON"->'showCriticalPath',
                 'ganttArrowsForm', "rowJSON"->'ganttArrowsForm',
                 'showTaskProgressOnGantt', "rowJSON"->'showTaskProgressOnGantt')))
 WHERE "rowJSON" ?| ARRAY['showCriticalPath', 'ganttArrowsForm', 'showTaskProgressOnGantt'];
