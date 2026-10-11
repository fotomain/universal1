-- =====================================================================================
-- UNIVERSAL1 - TASK LINE PLAN: kit8/sql/init/create_task_line_plan_table.sql
-- (run AFTER create_pm_task_line_table.sql; IDEMPOTENT + NON-DESTRUCTIVE. Remove again with delete_task_line_plan_table.sql.)
--
-- task_line_plan - the POSTED days of the task lines: one row per line and active calendar day (document "W1 Post Task", Part 1.2).
--   rowProjectGUID     project_table.rowGUID      = task.rowProjectGUID   (FK, cascade)
--   rowOwnerGUID       project_task_table.rowGUID = task.rowGUID          (FK, cascade)
--   rowParentGUID      task_line_table.rowGUID    = the LINE the day belongs to (FK, cascade: a deleted line takes its days with it)
--   orderInList        (position of the line in the call) * 100000 + the day number: the lines one after the other, each by date
--   rowPeriodDatetime  the start of the day (00:00:00) - unique with the line
--   rowCoefficient     the share of the day, NORMALIZED: the coefficients of a line add up to baseOfDistribution (1)
--   qtyTaskLine · sumForBudget · sumForContract     the result of the distribution, rounded to 2 digits
--   rowJSON            { budgetItemTaskLine, taskManagementGenusLine } copied from the line, so a report needs no join
-- The app only READS this table. Rows are written by ONE procedure, in ONE transaction:
--   create_task_line_plan("taskLinePlanJSON")   (see below)
--
-- Correct033 effect (document "0333 Effect"): every row is rounded on its own, so 100.00 split on 3 equal days gives 33.33 + 33.33 + 33.33 = 99.99.
-- The procedure adds the difference (original - distributed: +0.01 here) to the LAST row of the distribution (the last day with a non-zero
-- coefficient) -> 33.33 + 33.33 + 33.34 = 100.00. The same for rowCoefficient against baseOfDistribution (10 digits).
--
-- Also here: a trigger on project_task_table - when the start or the finish DAY of a task changes, its posted lines get taskIsPosted = false
-- ("Post needed"); the old rows stay until the next post.
-- =====================================================================================

DO $$
BEGIN
  IF to_regclass('public.task_line_table') IS NULL THEN
    RAISE EXCEPTION 'Run kit8/sql/init/create_pm_task_line_table.sql first (task_line_plan points at task_line_table)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_line_plan (
  "rowGUID"           UUID          NOT NULL DEFAULT gen_random_uuid(),
  "rowProjectGUID"    UUID          NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID"      UUID          NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID"     UUID          NOT NULL REFERENCES public.task_line_table("rowGUID") ON DELETE CASCADE,
  "orderInList"       NUMERIC       NOT NULL DEFAULT 0,
  "rowPeriodDatetime" TIMESTAMPTZ   NOT NULL,
  "rowCoefficient"    NUMERIC(14,10) NOT NULL,
  "qtyTaskLine"       NUMERIC(18,2),
  "sumForBudget"      NUMERIC(18,2),
  "sumForContract"    NUMERIC(18,2),
  "rowJSON"           JSONB         NOT NULL DEFAULT '{}'::jsonb,
  "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT task_line_plan_coefficient_chk CHECK ("rowCoefficient" >= 0),
  CONSTRAINT task_line_plan_line_period_uq UNIQUE ("rowParentGUID", "rowPeriodDatetime")
);
CREATE INDEX IF NOT EXISTS idx_task_line_plan_task    ON public.task_line_plan ("rowOwnerGUID", "rowPeriodDatetime");
CREATE INDEX IF NOT EXISTS idx_task_line_plan_project ON public.task_line_plan ("rowProjectGUID", "rowPeriodDatetime");

DROP TRIGGER IF EXISTS trg_task_line_plan_touch ON public.task_line_plan;
CREATE TRIGGER trg_task_line_plan_touch BEFORE UPDATE ON public.task_line_plan
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.task_line_plan REPLICA IDENTITY FULL;

-- access: the owner of the project READS; nobody writes directly (no insert / update / delete policy) - only create_task_line_plan does
ALTER TABLE public.task_line_plan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_line_plan FROM anon, authenticated;
GRANT SELECT ON public.task_line_plan TO authenticated;
DROP POLICY IF EXISTS task_line_plan_select ON public.task_line_plan;
CREATE POLICY task_line_plan_select ON public.task_line_plan FOR SELECT TO authenticated
  USING (public.pm_owns_project("rowProjectGUID"));

-- realtime
DO $$
DECLARE
  v_all boolean;
BEGIN
  SELECT puballtables INTO v_all FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
  ELSIF NOT v_all AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_line_plan') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_line_plan;
  END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- RPC create_task_line_plan("taskLinePlanJSON") - ONE transaction: replaces the posted days of a task.
--
--   { "taskGUID": "<uuid>",
--     "timeZone": "UTC",                                  -- optional: the zone the day starts in (default UTC)
--     "lines": [ { "lineGUID": "<uuid>", "baseOfDistribution": 1,
--                  "qtyTaskLine": 10, "sumForBudget": 100, "sumForContract": 100,       -- the totals of the line (null = none)
--                  "days": [ { "d": "2026-10-12", "c": 0.3333333333 }, ... ] } ] }       -- the days and their coefficients
--
-- Steps: lock the task and check the owner -> validate -> delete the earlier rows of the task -> insert round(total * c, 2) per day ->
-- Correct033 (last row) for the coefficients and the three amounts -> verify the totals -> taskIsPosted = true + baseOfDistribution on the lines.
-- Any error rolls EVERYTHING back. SECURITY DEFINER because the app has no write policy on task_line_plan; the owner of the project is checked first.
-- Returns { "lines": n, "rows": n }.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_task_line_plan("taskLinePlanJSON" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_task     uuid;
  v_project  uuid;
  v_tz       text;
  v_line     jsonb;
  v_guid     uuid;
  v_ids      uuid[] := ARRAY[]::uuid[];
  v_days     jsonb;
  v_n        integer;
  v_base     numeric;
  v_csum     numeric;
  v_last     uuid;
  v_genus    text;
  v_item     jsonb;
  v_col      text;
  v_total    numeric;
  v_sum      numeric;
  v_diff     numeric;
  v_rows     integer := 0;
  v_idx      integer := 0;
BEGIN
  IF "taskLinePlanJSON" IS NULL OR jsonb_typeof("taskLinePlanJSON") <> 'object' THEN
    RAISE EXCEPTION 'create_task_line_plan: taskLinePlanJSON must be an object';
  END IF;
  v_task := ("taskLinePlanJSON"->>'taskGUID')::uuid;
  v_tz   := COALESCE(NULLIF("taskLinePlanJSON"->>'timeZone', ''), 'UTC');

  -- lock the task (two Post presses cannot interleave) and check the owner
  SELECT t."projectGUID" INTO v_project FROM public.project_task_table t WHERE t."rowGUID" = v_task FOR UPDATE;
  IF v_project IS NULL OR NOT public.pm_owns_project(v_project) THEN
    RAISE EXCEPTION 'create_task_line_plan: task % does not exist or is not yours', v_task USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof("taskLinePlanJSON"->'lines') <> 'array' THEN
    RAISE EXCEPTION 'create_task_line_plan: "lines" must be an array';
  END IF;

  -- the earlier days of the task are replaced
  DELETE FROM public.task_line_plan WHERE "rowOwnerGUID" = v_task;

  FOR v_line IN SELECT value FROM jsonb_array_elements("taskLinePlanJSON"->'lines') LOOP
    v_guid := (v_line->>'lineGUID')::uuid;
    v_idx  := v_idx + 1;
    SELECT l."rowParentGUID", jsonb_build_object('budgetItemTaskLine', l."rowJSON"->'budgetItemTaskLine', 'taskManagementGenusLine', l."rowParentGUID")
      INTO v_genus, v_item
      FROM public.task_line_table l WHERE l."rowGUID" = v_guid AND l."rowOwnerGUID" = v_task;
    IF v_genus IS NULL THEN
      RAISE EXCEPTION 'create_task_line_plan: line % is not a line of task %', v_guid, v_task;
    END IF;

    v_days := v_line->'days';
    IF jsonb_typeof(v_days) <> 'array' OR jsonb_array_length(v_days) = 0 THEN
      RAISE EXCEPTION 'create_task_line_plan: line % has no days', v_guid;
    END IF;
    v_n    := jsonb_array_length(v_days);
    v_base := COALESCE((v_line->>'baseOfDistribution')::numeric, 1);
    IF v_base <= 0 THEN RAISE EXCEPTION 'create_task_line_plan: baseOfDistribution of line % must be > 0', v_guid; END IF;

    SELECT COALESCE(SUM(round((e.value->>'c')::numeric, 10)), 0) INTO v_csum FROM jsonb_array_elements(v_days) e;
    IF abs(v_csum - v_base) > 0.000001 THEN
      RAISE EXCEPTION 'create_task_line_plan: the coefficients of line % add up to %, not to %', v_guid, v_csum, v_base;
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_days) e WHERE (e.value->>'c')::numeric < 0) THEN
      RAISE EXCEPTION 'create_task_line_plan: a coefficient of line % is negative', v_guid;
    END IF;

    -- one row per day: coefficient rounded to 10 digits, amounts = round(total * coefficient, 2) (null total = null amount)
    INSERT INTO public.task_line_plan ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowPeriodDatetime", "rowCoefficient",
                                       "qtyTaskLine", "sumForBudget", "sumForContract", "rowJSON")
    SELECT v_project, v_task, v_guid, v_idx * 100000 + e.ord,
           ((e.value->>'d')::date)::timestamp AT TIME ZONE v_tz,
           round((e.value->>'c')::numeric, 10),
           CASE WHEN jsonb_typeof(v_line->'qtyTaskLine')       = 'number' THEN round((v_line->>'qtyTaskLine')::numeric       * round((e.value->>'c')::numeric, 10), 2) END,
           CASE WHEN jsonb_typeof(v_line->'sumForBudget')      = 'number' THEN round((v_line->>'sumForBudget')::numeric      * round((e.value->>'c')::numeric, 10), 2) END,
           CASE WHEN jsonb_typeof(v_line->'sumForContract')    = 'number' THEN round((v_line->>'sumForContract')::numeric    * round((e.value->>'c')::numeric, 10), 2) END,
           v_item
      FROM jsonb_array_elements(v_days) WITH ORDINALITY AS e(value, ord);
    v_rows := v_rows + v_n;

    -- ---- Correct033: the last row of the distribution = the last day with a non-zero coefficient (else the last day) ----
    SELECT p."rowGUID" INTO v_last FROM public.task_line_plan p
     WHERE p."rowParentGUID" = v_guid ORDER BY (p."rowCoefficient" > 0) DESC, p."rowPeriodDatetime" DESC LIMIT 1;

    SELECT v_base - COALESCE(SUM("rowCoefficient"), 0) INTO v_diff FROM public.task_line_plan WHERE "rowParentGUID" = v_guid;
    IF v_diff <> 0 THEN
      UPDATE public.task_line_plan SET "rowCoefficient" = "rowCoefficient" + v_diff WHERE "rowGUID" = v_last;
    END IF;

    FOREACH v_col IN ARRAY ARRAY['qtyTaskLine', 'sumForBudget', 'sumForContract'] LOOP
      IF jsonb_typeof(v_line->v_col) <> 'number' THEN CONTINUE; END IF;
      v_total := round((v_line->>v_col)::numeric, 2);
      EXECUTE format('SELECT COALESCE(SUM(%I), 0) FROM public.task_line_plan WHERE "rowParentGUID" = $1', v_col) INTO v_sum USING v_guid;
      v_diff := v_total - v_sum;
      -- the rounding of n rows cannot lose more than n * 0.005: more is a bug, not a rounding
      IF abs(v_diff) > v_n * 0.005 + 0.000001 THEN
        RAISE EXCEPTION 'create_task_line_plan: % of line % differs by % after rounding (more than % rows can lose)', v_col, v_guid, v_diff, v_n;
      END IF;
      IF v_diff <> 0 THEN
        EXECUTE format('UPDATE public.task_line_plan SET %I = %I + $1 WHERE "rowGUID" = $2', v_col, v_col) USING v_diff, v_last;
      END IF;
      -- verify
      EXECUTE format('SELECT COALESCE(SUM(%I), 0) FROM public.task_line_plan WHERE "rowParentGUID" = $1', v_col) INTO v_sum USING v_guid;
      IF v_sum <> v_total THEN
        RAISE EXCEPTION 'create_task_line_plan: % of line % adds up to %, not to %', v_col, v_guid, v_sum, v_total;
      END IF;
    END LOOP;
    SELECT COALESCE(SUM("rowCoefficient"), 0) INTO v_sum FROM public.task_line_plan WHERE "rowParentGUID" = v_guid;
    IF v_sum <> v_base THEN
      RAISE EXCEPTION 'create_task_line_plan: the coefficients of line % add up to %, not to %', v_guid, v_sum, v_base;
    END IF;

    v_ids := v_ids || v_guid;
  END LOOP;

  -- posted lines: taskIsPosted + the base (a merge, no other key of the line is lost)
  UPDATE public.task_line_table l
     SET "rowJSON" = l."rowJSON" || jsonb_build_object('taskIsPosted', true, 'baseOfDistribution',
           COALESCE((SELECT (x.value->>'baseOfDistribution')::numeric FROM jsonb_array_elements("taskLinePlanJSON"->'lines') x WHERE (x.value->>'lineGUID')::uuid = l."rowGUID"), 1))
   WHERE l."rowGUID" = ANY (v_ids);
  -- a line of the task that was not sent has no days any more (its budget item was cleared): it is not posted
  UPDATE public.task_line_table l
     SET "rowJSON" = (l."rowJSON" - 'baseOfDistribution') || '{"taskIsPosted": false}'::jsonb
   WHERE l."rowOwnerGUID" = v_task AND NOT (l."rowGUID" = ANY (v_ids)) AND jsonb_exists(l."rowJSON", 'baseOfDistribution');

  RETURN jsonb_build_object('lines', COALESCE(array_length(v_ids, 1), 0), 'rows', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.create_task_line_plan(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_task_line_plan(jsonb) TO authenticated;

-- -------------------------------------------------------------------------------------
-- The start or the finish DAY of a task changed (the scheduler writes rowJSON.startAt and rowDuration): its posted lines need a new post.
-- A write of the same days (the scheduler runs often) changes nothing.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.task_line_plan_unpost_on_dates() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF (NEW."rowDuration")::date IS DISTINCT FROM (OLD."rowDuration")::date
     OR NULLIF(NEW."rowJSON"->>'startAt', '')::timestamptz::date IS DISTINCT FROM NULLIF(OLD."rowJSON"->>'startAt', '')::timestamptz::date THEN
    UPDATE public.task_line_table l
       SET "rowJSON" = l."rowJSON" || '{"taskIsPosted": false}'::jsonb
     WHERE l."rowOwnerGUID" = NEW."rowGUID" AND l."rowJSON" @> '{"taskIsPosted": true}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_task_line_plan_unpost_on_dates ON public.project_task_table;
CREATE TRIGGER trg_task_line_plan_unpost_on_dates
  AFTER UPDATE OF "rowJSON", "rowDuration" ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.task_line_plan_unpost_on_dates();

NOTIFY pgrst, 'reload schema';

-- Check (empty is right until the first Post):
--   SELECT count(*) FROM public.task_line_plan;
--   SELECT "rowParentGUID", sum("rowCoefficient"), sum("sumForBudget") FROM public.task_line_plan GROUP BY 1;   -- 1.0000000000 and the line sums
