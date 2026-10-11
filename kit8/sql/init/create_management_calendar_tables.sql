-- =====================================================================================
-- UNIVERSAL1 - MANAGEMENT CALENDARS: kit8/sql/init/create_management_calendar_tables.sql
-- (Supabase / PostgreSQL 15+. Remove again with delete_management_calendar_tables.sql.)
--
-- managementCalendarTable: the calendars of the business, two levels in one table (the shape of managementGenusTable / budgetItemTable):
--   FOLDERS   (level 1, rowParentGUID 'empty')   projectCalendarFolder · resourceRoleCalendarFolder · personCalendarFolder
--   CALENDARS (level 2, rowParentGUID = folder)  projectCalendarFolder > workingDaysCalendar  (the default: Mon-Fri, no holidays)
--   rowGUID (TEXT = the code) · rowOwnerGUID 'managementCalendarCatalog' (the business - the abstract entity; no business table exists yet)
--   rowParentGUID (folder | 'empty') · orderInList · rowJSON { title, description }
--
-- managementCalendarDaysTable: ONE ROW PER CALENDAR DAY of a calendar:
--   rowGUID       '<calendar rowGUID>:<YYYY-MM-DD>'  (so a fill is an idempotent upsert)
--   rowOwnerGUID  managementCalendarTable.rowGUID
--   rowParentGUID the YEAR as text ('2026'): a table of one calendar and one year is a page of at most 366 rows
--   orderInList   the day as a number (days since 1970-01-01)
--   rowJSON       { day: 'YYYY-MM-DD', isActive: boolean, reason: 'fill' | 'weekend' | 'holiday' | 'manual', note }
-- isActive=false = the day is EXCLUDED (the calendar does not work on it): a task plan gets no row and no money for it.
-- The user excludes (or includes) any day by switching isActive (reason becomes 'manual', so a later Fill does not overwrite it unless asked).
--
-- fill_management_calendar(calendar, year, mode, overwrite_manual) writes a whole year in one statement:
--   mode 'workingDays' Mon-Fri active, Sat+Sun off; days flagged 'holiday' stay off
--        'fiveDays'    Mon-Fri active, Sat+Sun off (holiday flags are cleared)
--        'sixDays'     Mon-Sat active, Sun off
--        'allDays'     all 7 days active
--   Days with reason 'manual' are kept unless p_overwrite_manual is true.
-- The default calendar workingDaysCalendar is filled for the previous, the current and the next year (only when it has no days yet).
-- project_table.rowJSON.calendarForTaskPlan = the calendar that divides the timeline of a task plan (default workingDaysCalendar).
-- Screen: Management calendars (kit8/catalog/management/calendar, route /catalog/management/calendar/list).
-- IDEMPOTENT + NON-DESTRUCTIVE: CREATE ... IF NOT EXISTS, seeds ON CONFLICT DO NOTHING.
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;

-- one helper for every catalog / generic table: RLS on + touch trigger + REPLICA IDENTITY FULL
CREATE OR REPLACE FUNCTION public.kit8_setup_def_table(p_table text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.%I', p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || p_table || '_touch', p_table);
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at()',
                 'trg_' || p_table || '_touch', p_table);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING GIN ("rowJSON" jsonb_path_ops)', 'idx_' || p_table || '_rowJSON', p_table);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I ("orderInList")', 'idx_' || p_table || '_order', p_table);
END;
$$;

CREATE TABLE IF NOT EXISTS public."managementCalendarTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'managementCalendarCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_managementCalendarTable_owner_order" ON public."managementCalendarTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_managementCalendarTable_parent" ON public."managementCalendarTable" ("rowParentGUID");
SELECT public.kit8_setup_def_table('managementCalendarTable');

CREATE TABLE IF NOT EXISTS public."managementCalendarDaysTable" (
  "rowGUID"       TEXT        NOT NULL,
  "rowOwnerGUID"  TEXT        NOT NULL REFERENCES public."managementCalendarTable"("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT management_calendar_day_chk CHECK (
    "rowJSON"->>'day' ~ '^\d{4}-\d{2}-\d{2}$' AND jsonb_typeof("rowJSON"->'isActive') = 'boolean')
);
CREATE INDEX IF NOT EXISTS "idx_managementCalendarDaysTable_owner_order" ON public."managementCalendarDaysTable" ("rowOwnerGUID", "orderInList");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_managementCalendarDaysTable_owner_day" ON public."managementCalendarDaysTable" ("rowOwnerGUID", ("rowJSON"->>'day'));
SELECT public.kit8_setup_def_table('managementCalendarDaysTable');

-- security: full CRUD for signed-in users (as managementGenusTable)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['managementCalendarTable', 'managementCalendarDaysTable'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)', t || '_delete', t);
  END LOOP;
END $$;

-- folders and the default calendar
INSERT INTO public."managementCalendarTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('projectCalendarFolder',      'managementCalendarCatalog', 'empty', 1000, '{"title": "Project", "description": "Folder: calendars a project plans its tasks with (project.calendarForTaskPlan)."}'::jsonb),
  ('resourceRoleCalendarFolder', 'managementCalendarCatalog', 'empty', 2000, '{"title": "Resource role", "description": "Folder: calendars of resource roles."}'::jsonb),
  ('personCalendarFolder',       'managementCalendarCatalog', 'empty', 3000, '{"title": "Person", "description": "Folder: calendars of persons."}'::jsonb),
  ('workingDaysCalendar',        'managementCalendarCatalog', 'projectCalendarFolder', 1100, '{"title": "Working days", "description": "Monday to Friday, without holidays (the default calendar of a project plan)."}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- -------------------------------------------------------------------------------------
-- fill_management_calendar: one year of days in one statement. Returns the number of day rows written.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fill_management_calendar(
  p_calendar text, p_year integer, p_mode text, p_overwrite_manual boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_mode NOT IN ('workingDays', 'fiveDays', 'sixDays', 'allDays') THEN
    RAISE EXCEPTION 'fill_management_calendar: unknown mode "%" (workingDays | fiveDays | sixDays | allDays)', p_mode;
  END IF;
  IF p_year < 1970 OR p_year > 2200 THEN
    RAISE EXCEPTION 'fill_management_calendar: year % is out of range', p_year;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."managementCalendarTable" c WHERE c."rowGUID" = p_calendar AND c."rowParentGUID" <> 'empty') THEN
    RAISE EXCEPTION 'fill_management_calendar: calendar "%" does not exist (or is a folder)', p_calendar;
  END IF;

  INSERT INTO public."managementCalendarDaysTable" AS t ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
  SELECT p_calendar || ':' || to_char(d, 'YYYY-MM-DD'), p_calendar, p_year::text, (d - DATE '1970-01-01')::numeric,
         jsonb_build_object(
           'day', to_char(d, 'YYYY-MM-DD'),
           'isActive', CASE p_mode WHEN 'allDays' THEN true WHEN 'sixDays' THEN extract(isodow FROM d) <= 6 ELSE extract(isodow FROM d) <= 5 END,
           'reason', CASE WHEN p_mode = 'allDays' THEN 'fill'
                          WHEN p_mode = 'sixDays' AND extract(isodow FROM d) = 7 THEN 'weekend'
                          WHEN p_mode IN ('workingDays', 'fiveDays') AND extract(isodow FROM d) >= 6 THEN 'weekend'
                          ELSE 'fill' END)
    FROM (SELECT make_date(p_year, 1, 1) + i AS d
            FROM generate_series(0, make_date(p_year, 12, 31) - make_date(p_year, 1, 1)) AS s(i)) AS g
  ON CONFLICT ("rowGUID") DO UPDATE
     SET "rowJSON" = EXCLUDED."rowJSON", "orderInList" = EXCLUDED."orderInList", "rowParentGUID" = EXCLUDED."rowParentGUID"
   WHERE (p_overwrite_manual OR COALESCE(t."rowJSON"->>'reason', '') <> 'manual')
     AND NOT (p_mode = 'workingDays' AND COALESCE(t."rowJSON"->>'reason', '') = 'holiday');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fill_management_calendar(text, integer, text, boolean) TO authenticated;

-- the default calendar: previous, current and next year (only when it has no days yet - a second run changes nothing)
DO $$
DECLARE
  y integer := extract(year FROM current_date)::integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."managementCalendarDaysTable" WHERE "rowOwnerGUID" = 'workingDaysCalendar') THEN
    PERFORM public.fill_management_calendar('workingDaysCalendar', y - 1, 'workingDays');
    PERFORM public.fill_management_calendar('workingDaysCalendar', y,     'workingDays');
    PERFORM public.fill_management_calendar('workingDaysCalendar', y + 1, 'workingDays');
  END IF;
END $$;

-- realtime: both tables in the supabase_realtime publication
DO $$
DECLARE
  v_all boolean;
  t text;
BEGIN
  SELECT puballtables INTO v_all FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
    RETURN;
  END IF;
  IF v_all THEN
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY['managementCalendarTable', 'managementCalendarDaysTable'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT "rowGUID", "rowParentGUID", "rowJSON"->>'title' FROM public."managementCalendarTable" ORDER BY "orderInList";
--   SELECT count(*), count(*) FILTER (WHERE ("rowJSON"->>'isActive')::boolean) FROM public."managementCalendarDaysTable" WHERE "rowOwnerGUID" = 'workingDaysCalendar';
