-- WP B1-B8: hours per day, week modes, Fill with hours / pattern / follow project holidays, the key resourceCalendar, the priority of the contract calendar
BEGIN;
SELECT tt.as_admin();

-- the seeded week modes: Mon-Fri 8 h, Sat/Sun 0 h; the project calendar is untouched (no hours key)
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14'), 8::numeric, 'standard: Wednesday 8 h');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-17'), 0::numeric, 'standard: Saturday 0 h');
SELECT tt.eq((SELECT "rowJSON"->>'reason' FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-17'), 'weekend', 'standard: Saturday is a weekend');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'sixDayWeekCalendar:2026-10-17'), 8::numeric, '6-day week: Saturday 8 h');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'sixDayWeekCalendar:2026-10-18'), 0::numeric, '6-day week: Sunday 0 h');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'sevenDayWeekCalendar:2026-10-18'), 8::numeric, '7-day week: Sunday 8 h');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'partTime4hCalendar:2026-10-14'), 4::numeric, 'part-time: 4 h');
SELECT tt.eq((SELECT count(*) FROM public."managementCalendarDaysTable" WHERE "rowOwnerGUID" = 'workingDaysCalendar' AND "rowJSON" ? 'hours'), 0::bigint, 'the project calendar has no hours (unchanged)');

-- Fill: hours, exceptions are kept, pattern, limits
INSERT INTO public."managementCalendarTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES
  ('testShift', 'managementCalendarCatalog', 'personCalendarFolder', '{"title":"Shift Tue-Sat","kind":"resource","hoursPerDay":8,"weekPattern":{"mon":0,"tue":8,"wed":8,"thu":8,"fri":8,"sat":6,"sun":0}}'),
  ('testOwn',   'managementCalendarCatalog', 'personCalendarFolder', '{"title":"Own","kind":"resource","hoursPerDay":8}');
SELECT public.fill_management_calendar('testOwn', 2026, 'fiveDays', false, 6);
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testOwn:2026-10-14'), 6::numeric, 'Fill with 6 h a day');
SELECT public.fill_management_calendar('testOwn', 2026, 'fiveDays');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testOwn:2026-10-14'), 8::numeric, 'Fill without hours = hoursPerDay of the calendar');
SELECT tt.fails($q$SELECT public.fill_management_calendar('testOwn', 2026, 'fiveDays', false, 25)$q$, 'out of range', 'more than 24 h a day is refused');
SELECT tt.fails($q$SELECT public.fill_management_calendar('testOwn', 2026, 'pattern')$q$, 'no weekPattern', 'pattern mode needs a weekPattern');
SELECT tt.fails($q$SELECT public.fill_management_calendar('workingDaysCalendar', 2026, 'fiveDays', false, NULL, true)$q$, 'resource calendars only', 'follow project holidays is for resource calendars');
-- an exception day: vacation, 0 h; a later Fill keeps it, "overwrite" replaces it
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"isActive": false, "reason": "vacation", "note": "holiday"}' WHERE "rowGUID" = 'testOwn:2026-10-15';
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testOwn:2026-10-15'), 0::numeric, 'switching a day off sets its hours to 0');
SELECT public.fill_management_calendar('testOwn', 2026, 'fiveDays');
SELECT tt.eq((SELECT "rowJSON"->>'reason' FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testOwn:2026-10-15'), 'vacation', 'a Fill keeps the vacation');
SELECT public.fill_management_calendar('testOwn', 2026, 'fiveDays', true);
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testOwn:2026-10-15'), 8::numeric, 'overwrite replaces the vacation');
-- hours and isActive stay in step both ways
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 3}' WHERE "rowGUID" = 'testOwn:2026-10-17';
SELECT tt.eq((SELECT "rowJSON"->>'isActive' FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testOwn:2026-10-17'), 'true', 'hours > 0 on a Saturday make the day active');
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"isActive": true}' WHERE "rowGUID" = 'testOwn:2026-10-18';
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testOwn:2026-10-18'), 8::numeric, 'switching a day on gives it the hours per day');
SELECT tt.fails($q$UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 30}' WHERE "rowGUID" = 'testOwn:2026-10-14'$q$, 'hours_chk', 'more than 24 h in a day row is refused');
-- the custom week
SELECT public.fill_management_calendar('testShift', 2026, 'pattern');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testShift:2026-10-17'), 6::numeric, 'pattern: Saturday 6 h');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testShift:2026-10-12'), 0::numeric, 'pattern: Monday 0 h');
SELECT tt.eq((SELECT "rowJSON"->>'reason' FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testShift:2026-10-12'), 'weekend', 'pattern: a day with no hours is a weekend');

-- the key resourceCalendar must point to a RESOURCE calendar
INSERT INTO public."personTable" ("rowGUID","rowJSON") VALUES ('p-anna', '{"personFirstName":"Anna","personLastName":"K"}'), ('p-boris', '{"personFirstName":"Boris","personLastName":"M"}');
SELECT tt.fails($q$UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "workingDaysCalendar"}' WHERE "rowGUID" = 'p-anna'$q$, 'not a resource calendar', 'a project calendar cannot be a resource calendar');
SELECT tt.fails($q$UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "nope"}' WHERE "rowGUID" = 'p-anna'$q$, 'not a resource calendar', 'an unknown calendar is refused');
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "testOwn"}' WHERE "rowGUID" = 'p-anna';
SELECT tt.fails($q$DELETE FROM public."managementCalendarTable" WHERE "rowGUID" = 'testOwn'$q$, 'is the resourceCalendar', 'a calendar in use is not deleted');
SELECT tt.fails($q$DELETE FROM public."managementCalendarTable" WHERE "rowGUID" = 'standardWorkWeekCalendar'$q$, 'cannot be deleted', 'the standard work week is not deleted');

-- capacity: contract > resource > standard
SELECT tt.eq((SELECT source FROM public.organization_resource_capacity_info('person','p-boris','2026-10-14')), 'standard', 'no calendar anywhere = standard');
SELECT tt.eq(public.organization_resource_capacity('person','p-boris','2026-10-14'), 8::numeric, 'standard: 8 h');
SELECT tt.eq(public.organization_resource_capacity('person','p-boris','2026-10-17'), 0::numeric, 'standard: Saturday 0 h');
SELECT tt.eq((SELECT source FROM public.organization_resource_capacity_info('person','p-anna','2026-10-14')), 'resource', 'the calendar of the resource');
SELECT tt.eq(public.organization_resource_capacity('person','p-anna','2026-10-14'), 8::numeric, 'her own calendar: 8 h');
INSERT INTO public."contractTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES
  ('c-anna-1', 'p-anna', 'person', '{"contractPartyType":"person","contractSumBeforeVAT":1,"contractStartDate":"2025-01-01","contractFinishDate":"2026-10-18","contractNumber":"1"}'),
  ('c-anna-2', 'p-anna', 'person', '{"contractPartyType":"person","contractSumBeforeVAT":1,"contractStartDate":"2026-10-19","contractFinishDate":null,"contractNumber":"2","resourceCalendar":"partTime4hCalendar"}'),
  ('c-anna-3', 'p-anna', 'person', '{"contractPartyType":"person","contractSumBeforeVAT":1,"contractStartDate":"2026-10-21","contractFinishDate":"2026-10-21","contractNumber":"3","resourceCalendar":"sevenDayWeekCalendar"}');
SELECT tt.eq((SELECT source FROM public.organization_resource_capacity_info('person','p-anna','2026-10-14')), 'resource', 'a contract without a calendar does not count');
SELECT tt.eq(public.organization_resource_capacity('person','p-anna','2026-10-19'), 4::numeric, 'the contract calendar in force wins: part-time 4 h');
SELECT tt.eq((SELECT hours_without_contract FROM public.organization_resource_capacity_info('person','p-anna','2026-10-19')), 8::numeric, '... and the capacity without the contract calendar is told too (8 h)');
SELECT tt.eq((SELECT calendar FROM public.organization_resource_capacity_info('person','p-anna','2026-10-21')), 'sevenDayWeekCalendar', 'two contracts in force: the latest start wins');
SELECT tt.eq((SELECT calendar FROM public.organization_resource_capacity_info('person','p-anna','2026-10-22')), 'partTime4hCalendar', 'the day after the short contract: the open one again');
-- equipment: its calendar, else the standard; a year nobody filled is NOT guessed
INSERT INTO public."equipmentTable" ("rowGUID","rowJSON") VALUES ('e-crane', '{"equipmentTitle":"Crane","resourceCalendar":"sixDayWeekCalendar"}'), ('e-exc', '{"equipmentTitle":"Excavator"}');
SELECT tt.eq(public.organization_resource_capacity('equipment','e-crane','2026-10-17'), 8::numeric, 'equipment on the 6-day calendar works on Saturday');
SELECT tt.eq(public.organization_resource_capacity('equipment','e-exc','2026-10-17'), 0::numeric, 'equipment without a calendar: standard');
SELECT tt.eq(public.organization_resource_capacity('person','p-boris','2035-03-01') IS NULL, true, 'a year that nobody filled: NULL (not filled), never a guess');
SELECT tt.fails($q$SELECT public.organization_resource_capacity('room','x','2026-10-14')$q$, 'unknown resource kind', 'only person | equipment');

-- the "Own calendar" button: a private copy (the row and all the days), independent of the source
SELECT public.organization_copy_calendar('partTime4hCalendar', 'Clara own', 'personCalendarFolder') AS own \gset
SELECT tt.eq((SELECT "rowJSON"->>'title' FROM public."managementCalendarTable" WHERE "rowGUID" = :'own'), 'Clara own', 'the copy has the title given');
SELECT tt.eq((SELECT "rowJSON"->>'copyOf' FROM public."managementCalendarTable" WHERE "rowGUID" = :'own'), 'partTime4hCalendar', '... and remembers its source');
SELECT tt.eq((SELECT count(*) FROM public."managementCalendarDaysTable" WHERE "rowOwnerGUID" = :'own'), (SELECT count(*) FROM public."managementCalendarDaysTable" WHERE "rowOwnerGUID" = 'partTime4hCalendar'), 'all the days are copied');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = :'own' || ':2026-10-14'), 4::numeric, 'with their hours');
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"isActive": false, "reason": "vacation"}' WHERE "rowGUID" = :'own' || ':2026-10-14';
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'partTime4hCalendar:2026-10-14'), 4::numeric, 'a vacation in the copy does not touch the shared calendar');
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('resourceCalendar', :'own') WHERE "rowGUID" = 'p-boris';
SELECT tt.eq(public.organization_resource_capacity('person','p-boris','2026-10-14'), 0::numeric, 'a person on the copy has the vacation');
SELECT tt.fails($q$SELECT public.organization_copy_calendar('workingDaysCalendar')$q$, 'not a resource calendar', 'a project calendar is not copied this way');
SELECT tt.fails($q$SELECT public.organization_copy_calendar('standardWorkWeekCalendar', 'x', 'nope')$q$, 'not a calendar folder', 'the folder must exist');

-- Fill "follow project holidays" + the consistency report: a project of an organization with a 6-day calendar and a company holiday
SELECT public.organization_ensure_user('pm@acme.test', '44444444-4444-4444-4444-444444444444', 'Pm', 'X') AS pm \gset
INSERT INTO public."managementCalendarTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('testProject6', 'managementCalendarCatalog', 'projectCalendarFolder', '{"title":"Project 6 days"}');
SELECT public.fill_management_calendar('testProject6', 2026, 'sixDays');
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"isActive": false, "reason": "holiday"}' WHERE "rowGUID" = 'testProject6:2026-10-21';
INSERT INTO public.project_table ("rowGUID","treePath","rowOwnerGUID","rowJSON")
VALUES ('aaaaaaaa-0000-0000-0000-0000000000f1', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-0000000000f1'::uuid), '44444444-4444-4444-4444-444444444444', '{"name":"PM project","calendarForTaskPlan":"testProject6"}');
SELECT tt.as_user('pm@acme.test', '44444444-4444-4444-4444-444444444444');
SELECT tt.eq((SELECT count(*) FROM public.organization_holiday_days(public.organization_of_current_user(), 2026)), 1::bigint, 'the holidays of the project calendars of the organization');
SELECT tt.eq((SELECT difference FROM public.organization_calendar_consistency('standardWorkWeekCalendar', 2026) WHERE day = '2026-10-17'), 'projectWorksResourceOff', 'the project works on Saturday, the standard calendar does not');
SELECT tt.eq((SELECT difference FROM public.organization_calendar_consistency('standardWorkWeekCalendar', 2026) WHERE day = '2026-10-21'), 'projectClosedResourceWorks', 'the project is closed (holiday), the standard calendar works');
SELECT tt.eq((SELECT is_holiday FROM public.organization_calendar_consistency('standardWorkWeekCalendar', 2026) WHERE day = '2026-10-21'), true, '... and the day is flagged as a holiday');
SELECT tt.eq((SELECT count(*) FROM public.organization_calendar_consistency('sevenDayWeekCalendar', 2026) WHERE day = '2026-10-18'), 1::bigint, 'Sunday: the project is off, the 7-day calendar works');
INSERT INTO public."managementCalendarTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('testFollow', 'managementCalendarCatalog', 'personCalendarFolder', '{"title":"Follow","kind":"resource","hoursPerDay":8}');
SELECT public.fill_management_calendar('testFollow', 2026, 'fiveDays', false, NULL, true);
SELECT tt.eq((SELECT "rowJSON"->>'reason' FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testFollow:2026-10-21'), 'holiday', 'follow project holidays: the day is a holiday');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testFollow:2026-10-21'), 0::numeric, '... with 0 h');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'testFollow:2026-10-20'), 8::numeric, 'the other days are untouched');
SELECT tt.eq((SELECT count(*) FROM public.organization_calendar_consistency('testFollow', 2026) WHERE day = '2026-10-21'), 0::bigint, 'after the Fill the holiday is no difference any more');
ROLLBACK;
