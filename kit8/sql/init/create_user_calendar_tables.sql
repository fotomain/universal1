-- =====================================================================================
-- UNIVERSAL1 - USER CALENDAR: kit8/sql/init/create_user_calendar_tables.sql
-- (run AFTER kit8/sql/init/done/create_tables.sql; idempotent - safe to run twice)
--
-- App code: kit8/register/user_calendar (model, CRUD, recurrence, Google sync, reminders,
--           e-mail invitations) + kit8/catalog/user/calendar (screens), route /user/calendar.
--
-- Tables (prefix user_calendar_, kit8/sql/defTable.md pattern, UUID ids, owner RLS):
--   user_calendar_table             the user's calendars ("My calendar", "Tasks", "Birthdays", "Project tasks")
--       rowOwnerGUID  = the user (public.app_user_guid() = userState.userGUID)
--       rowParentGUID = 'empty'
--       rowJSON       = { calendarCode, calendarTitle, calendarColor, isVisible }
--   user_calendar_event_table       events, calendar tasks, birthdays and the copies of project tasks
--       rowOwnerGUID  = the user
--       rowParentGUID = user_calendar_table.rowGUID (text) or 'empty'
--       orderInList   = start, milliseconds since 1970 (ascending = oldest first)
--       rowJSON       = { kind: 'event'|'task'|'birthday'|'projectTask', title, allDay, startAt, endAt,
--                         startDate, endDate, recurrence, exDates, notifications, guests, location,
--                         description, color, done, deadline, googleEventId, intent,
--                         projectGUID, projectTaskGUID, projectTitle, rowProgress }
--   user_calendar_invitation_table  e-mail invitations sent for an event / task / birthday
--       rowOwnerGUID  = the user who invited
--       rowParentGUID = user_calendar_event_table.rowGUID (text)
--       rowJSON       = { email, status: 'sent'|'failed', sentAt, error, resendId }
--
-- PROJECT TASKS: every task / milestone of project_task_table is mirrored automatically into
-- user_calendar_event_table (kind 'projectTask') by triggers: insert, update and delete of a
-- project task do the same to its calendar row. The calendar row belongs to the task's owner.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.user_calendar_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS idx_user_calendar_table_owner ON public.user_calendar_table ("rowOwnerGUID", "orderInList");
-- one calendar of each code per user ("my", "tasks", "birthdays", "projectTasks")
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_calendar_table_owner_code
  ON public.user_calendar_table ("rowOwnerGUID", ("rowJSON"->>'calendarCode'))
  WHERE ("rowJSON"->>'calendarCode') IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_calendar_event_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS idx_user_calendar_event_owner ON public.user_calendar_event_table ("rowOwnerGUID", "orderInList");
-- one calendar row per project task (the mirror trigger upserts on it)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_calendar_event_project_task
  ON public.user_calendar_event_table (("rowJSON"->>'projectTaskGUID'))
  WHERE ("rowJSON"->>'projectTaskGUID') IS NOT NULL;
-- one calendar row per Google event per user (Google sync upserts on it)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_calendar_event_google
  ON public.user_calendar_event_table ("rowOwnerGUID", ("rowJSON"->>'googleEventId'))
  WHERE ("rowJSON"->>'googleEventId') IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_calendar_invitation_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS idx_user_calendar_invitation_owner ON public.user_calendar_invitation_table ("rowOwnerGUID", "rowParentGUID");

-- ---- updated_at trigger, RLS (every row belongs to app_user_guid()), grants -----------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_calendar_table', 'user_calendar_event_table', 'user_calendar_invitation_table'] LOOP
    PERFORM public.kit8_setup_def_table(t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ("rowOwnerGUID" = (SELECT public.app_user_guid()))', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ("rowOwnerGUID" = (SELECT public.app_user_guid()))', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ("rowOwnerGUID" = (SELECT public.app_user_guid())) WITH CHECK ("rowOwnerGUID" = (SELECT public.app_user_guid()))', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ("rowOwnerGUID" = (SELECT public.app_user_guid()))', t || '_delete', t);
  END LOOP;
END $$;

-- =====================================================================================
-- Project tasks -> calendar (automatic create / update / delete)
-- =====================================================================================
-- Calendar rowJSON of one project task. Day plans = all-day (the finish is exclusive, so the
-- last day is finish - 1 day); hour / minute / second plans = timed.
CREATE OR REPLACE FUNCTION public.user_calendar_project_task_json(p_task public.project_task_table)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE
  v_project public.project_table%ROWTYPE;
  v_start   timestamptz;
  v_finish  timestamptz;
  v_sub_day boolean;
BEGIN
  SELECT * INTO v_project FROM public.project_table WHERE "rowGUID" = p_task."projectGUID";
  v_start := COALESCE(
    NULLIF(p_task."rowJSON"->>'startAt', '')::timestamptz,
    NULLIF(p_task."rowJSON"->>'manualStartAt', '')::timestamptz,
    NULLIF(v_project."rowJSON"->>'projectStartAt', '')::timestamptz,
    date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  v_finish := COALESCE(p_task."rowDuration", v_start);
  IF v_finish < v_start THEN v_finish := v_start; END IF;
  v_sub_day := COALESCE((v_project."rowJSON"->>'planHour')::boolean, false)
            OR COALESCE((v_project."rowJSON"->>'planMinute')::boolean, false)
            OR COALESCE((v_project."rowJSON"->>'planSecond')::boolean, false);
  RETURN jsonb_build_object(
    'kind', 'projectTask',
    'title', COALESCE(NULLIF(p_task."rowJSON"->>'name', ''), 'Task'),
    'allDay', NOT v_sub_day,
    'startAt', to_char(v_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'endAt', to_char((CASE WHEN v_finish > v_start THEN v_finish ELSE v_start + (CASE WHEN v_sub_day THEN INTERVAL '1 hour' ELSE INTERVAL '1 day' END) END) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'startDate', to_char(v_start AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
    'endDate', to_char((CASE WHEN v_finish > v_start THEN v_finish - INTERVAL '1 second' ELSE v_start END) AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
    'description', COALESCE(p_task."rowJSON"->>'notes', ''),
    'color', p_task."rowJSON"->>'taskColor',
    'rowKind', p_task."rowJSON"->>'rowKind',
    'rowProgress', p_task."rowProgress",
    'done', p_task."rowProgress" >= 100,
    'projectGUID', p_task."projectGUID",
    'projectTaskGUID', p_task."rowGUID",
    'projectTitle', COALESCE(v_project."rowJSON"->>'name', ''),
    'notifications', '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_calendar_project_task_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_json jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_calendar_event_table WHERE "rowJSON"->>'projectTaskGUID' = OLD."rowGUID"::text;
    RETURN OLD;
  END IF;
  -- stages are summary rows: only tasks and milestones are calendar entries
  IF COALESCE(NEW."rowJSON"->>'rowKind', 'task') NOT IN ('task', 'milestone') THEN
    DELETE FROM public.user_calendar_event_table WHERE "rowJSON"->>'projectTaskGUID' = NEW."rowGUID"::text;
    RETURN NEW;
  END IF;
  v_json := public.user_calendar_project_task_json(NEW);
  UPDATE public.user_calendar_event_table e
     -- keep what the user added in the calendar (reminders, guests, Google link ...); the task wins on its own fields
     SET "rowJSON" = e."rowJSON" || (v_json - 'notifications'),
         "rowOwnerGUID" = NEW."rowOwnerGUID",
         "orderInList" = EXTRACT(EPOCH FROM (v_json->>'startAt')::timestamptz) * 1000
   WHERE e."rowJSON"->>'projectTaskGUID' = NEW."rowGUID"::text
     AND (e."rowJSON" || (v_json - 'notifications')) IS DISTINCT FROM e."rowJSON";
  IF NOT EXISTS (SELECT 1 FROM public.user_calendar_event_table e WHERE e."rowJSON"->>'projectTaskGUID' = NEW."rowGUID"::text) THEN
    INSERT INTO public.user_calendar_event_table ("rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
    VALUES (NEW."rowOwnerGUID", 'empty', EXTRACT(EPOCH FROM (v_json->>'startAt')::timestamptz) * 1000, v_json)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_zzz_user_calendar ON public.project_task_table;
CREATE TRIGGER trg_project_task_zzz_user_calendar
  AFTER INSERT OR UPDATE OR DELETE ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.user_calendar_project_task_sync();

-- project renamed / planning units changed -> refresh the calendar rows of its tasks
CREATE OR REPLACE FUNCTION public.user_calendar_project_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF (NEW."rowJSON"->>'name') IS DISTINCT FROM (OLD."rowJSON"->>'name')
     OR (NEW."rowJSON"->>'planHour') IS DISTINCT FROM (OLD."rowJSON"->>'planHour')
     OR (NEW."rowJSON"->>'planMinute') IS DISTINCT FROM (OLD."rowJSON"->>'planMinute')
     OR (NEW."rowJSON"->>'planSecond') IS DISTINCT FROM (OLD."rowJSON"->>'planSecond') THEN
    UPDATE public.user_calendar_event_table e
       SET "rowJSON" = e."rowJSON" || (public.user_calendar_project_task_json(t) - 'notifications')
      FROM public.project_task_table t
     WHERE t."projectGUID" = NEW."rowGUID"
       AND e."rowJSON"->>'projectTaskGUID' = t."rowGUID"::text;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_project_table_zzz_user_calendar ON public.project_table;
CREATE TRIGGER trg_project_table_zzz_user_calendar
  AFTER UPDATE OF "rowJSON" ON public.project_table
  FOR EACH ROW EXECUTE FUNCTION public.user_calendar_project_sync();

-- ---- backfill: the project tasks that exist already ---------------------------------------
INSERT INTO public.user_calendar_event_table ("rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT t."rowOwnerGUID", 'empty',
       EXTRACT(EPOCH FROM (j.v->>'startAt')::timestamptz) * 1000, j.v
  FROM public.project_task_table t
  CROSS JOIN LATERAL (SELECT public.user_calendar_project_task_json(t) AS v) j
 WHERE COALESCE(t."rowJSON"->>'rowKind', 'task') IN ('task', 'milestone')
   AND NOT EXISTS (SELECT 1 FROM public.user_calendar_event_table e WHERE e."rowJSON"->>'projectTaskGUID' = t."rowGUID"::text)
ON CONFLICT DO NOTHING;

-- ---- realtime (the calendar refreshes itself in every browser / phone of the user) --------
DO $$
DECLARE
  t text;
  v_all boolean;
BEGIN
  SELECT puballtables INTO v_all FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND OR v_all THEN RETURN; END IF;
  FOREACH t IN ARRAY ARRAY['user_calendar_table', 'user_calendar_event_table', 'user_calendar_invitation_table'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Remove everything again:
--   DROP TRIGGER IF EXISTS trg_project_task_zzz_user_calendar ON public.project_task_table;
--   DROP TRIGGER IF EXISTS trg_project_table_zzz_user_calendar ON public.project_table;
--   DROP FUNCTION IF EXISTS public.user_calendar_project_task_sync(), public.user_calendar_project_sync(),
--                           public.user_calendar_project_task_json(public.project_task_table);
--   DROP TABLE IF EXISTS public.user_calendar_invitation_table, public.user_calendar_event_table, public.user_calendar_table;
