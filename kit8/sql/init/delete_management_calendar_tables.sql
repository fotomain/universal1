-- =====================================================================================
-- UNIVERSAL1 - DELETE MANAGEMENT CALENDARS: kit8/sql/init/delete_management_calendar_tables.sql
-- Drops managementCalendarDaysTable, managementCalendarTable and fill_management_calendar (the calendars and their days are lost).
-- Run delete_task_line_plan_table.sql first if you also created task_line_plan (it does not point at the calendars, but a project may
-- still name a calendar in rowJSON.calendarForTaskPlan).
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['managementCalendarDaysTable', 'managementCalendarTable'] LOOP
      IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.fill_management_calendar(text, integer, text, boolean);
DROP TABLE IF EXISTS public."managementCalendarDaysTable" CASCADE;
DROP TABLE IF EXISTS public."managementCalendarTable" CASCADE;

NOTIFY pgrst, 'reload schema';
