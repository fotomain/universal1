-- WP C1-C5: the calendar lock. A change that lowers a capacity under the POSTED hours is refused; raising is always allowed.
BEGIN;
SELECT tt.as_admin();
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
INSERT INTO public."personTable" ("rowGUID","rowJSON") VALUES
  ('p-boris', '{"personFirstName":"Boris","personLastName":"M"}'),
  ('p-clara', '{"personFirstName":"Clara","personLastName":"S","resourceCalendar":"sixDayWeekCalendar"}'),
  ('p-dan',   '{"personFirstName":"Dan","personLastName":"V"}');
INSERT INTO public."equipmentTable" ("rowGUID","rowJSON") VALUES ('e-crane', '{"equipmentTitle":"Tower crane","resourceCalendar":"sixDayWeekCalendar"}');
INSERT INTO public."contractTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES
  ('c-dan-7d', 'p-dan', 'person', '{"contractPartyType":"person","contractSumBeforeVAT":1,"contractStartDate":"2026-10-01","contractFinishDate":null,"contractNumber":"7","resourceCalendar":"sevenDayWeekCalendar"}');
SELECT t."rowGUID" AS t1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT tt.line(:'t1', 'person', 'p-boris') AS lb \gset
SELECT tt.line(:'t1', 'person', 'p-clara') AS lc \gset
SELECT tt.line(:'t1', 'person', 'p-dan')   AS ld \gset
SELECT tt.line(:'t1', 'equipment', 'e-crane') AS lk \gset
-- posted bookings (the mode is capacityModeOff: Post does not check, the lock still counts):
--   Boris (standard)    Wed 14 Oct 8 h, Fri 16 Oct 12 h (already OVER the 8 h)
--   Clara (6-day)       Sat 17 Oct 6 h
--   Dan (contract 7-day) Sun 18 Oct 4 h
--   crane (6-day)       Sat 17 Oct 5 h
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(:'t1', format('[{"line":"%s","days":{"2026-10-14":8,"2026-10-16":12}},{"line":"%s","days":{"2026-10-17":6}},{"line":"%s","days":{"2026-10-18":4}},{"line":"%s","days":{"2026-10-17":5}}]', :'lb', :'lc', :'ld', :'lk')::jsonb);
SELECT tt.as_admin();

-- the screen: which days are locked, and down to how many hours
SELECT tt.eq((SELECT min_hours FROM public.organization_calendar_lock_info('standardWorkWeekCalendar', '2026-10-12', '2026-10-18') WHERE day = '2026-10-14'), 8::numeric, 'lock info: Wednesday of the standard calendar is locked down to 8 h');
SELECT tt.eq((SELECT count(*) FROM public.organization_calendar_lock_info('standardWorkWeekCalendar', '2026-10-12', '2026-10-18')), 2::bigint, 'lock info: only the two days with Boris (Wed, Fri) - not Saturday of Clara');
SELECT tt.eq((SELECT example FROM public.organization_calendar_lock_info('sixDayWeekCalendar', '2026-10-17', '2026-10-17') WHERE day = '2026-10-17'), 'Clara S', 'lock info names a resource of the day');

-- day rows ----------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 6}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14'$q$, 'capacity cannot be less than 8', 'lowering Wednesday under the 8 posted hours is refused');
SELECT tt.fails($q$UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"isActive": false}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14'$q$, 'Boris M has 8', 'switching the booked day off is refused, with the name');
SELECT tt.fails($q$DELETE FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14'$q$, 'capacity cannot be less', 'deleting the booked day is refused');
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 10}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14';
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14'), 10::numeric, 'raising the booked day is allowed');
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 8}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14';
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 2}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-15';
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-15'), 2::numeric, 'a day nobody booked can be lowered');
-- an already-over day (Friday: 12 h of 8 h): raising is allowed even if still under, lowering is not
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 9}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-16';
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-16'), 9::numeric, 'an over-booked day can be repaired step by step (8 -> 9 of 12 booked)');
SELECT tt.fails($q$UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 7}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-16'$q$, 'capacity cannot be less than 12', '... but not lowered again (9 -> 7)');
-- a project calendar has no capacity: nothing is checked
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"isActive": false, "reason": "holiday"}' WHERE "rowGUID" = 'workingDaysCalendar:2026-10-14';
SELECT tt.eq((SELECT "rowJSON"->>'reason' FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'workingDaysCalendar:2026-10-14'), 'holiday', 'a day of a project calendar is not guarded');

-- Fill: ONE statement, refused as a whole -------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$SELECT public.fill_management_calendar('standardWorkWeekCalendar', 2026, 'fiveDays', true, 6)$q$, 'capacity cannot be less', 'a Fill with 6 h would lower Wednesday under 8 h: refused');
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-20'), 8::numeric, '... as a whole: a free day of the same year is untouched');
SELECT public.fill_management_calendar('standardWorkWeekCalendar', 2026, 'fiveDays', true, 9);
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-20'), 9::numeric, 'a Fill that only raises is allowed');
SELECT tt.fails($q$SELECT public.fill_management_calendar('standardWorkWeekCalendar', 2026, 'fiveDays', true, 8)$q$, 'capacity cannot be less than 12', 'a Fill with 8 h lowers the over-booked Friday (9 -> 8 of 12): refused');
-- the preview for the screen
SELECT tt.eq((SELECT count(*) FROM public.organization_calendar_change_conflicts('standardWorkWeekCalendar', '2026-10-12', '2026-10-18', '{"2026-10-14": 6, "2026-10-16": 13, "2026-10-17": 0}'::jsonb)), 1::bigint, 'preview: only Wednesday 6 h would break (Friday 13 h raises, Saturday has no booking of the standard calendar)');

-- the pointer of a resource -----------------------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "partTime4hCalendar"}' WHERE "rowGUID" = 'p-boris'$q$, 'capacity cannot be less than 8', 'Boris on a 4 h calendar: refused');
SELECT tt.fails($q$UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "sevenDayWeekCalendar"}' WHERE "rowGUID" = 'p-boris'$q$, 'capacity cannot be less than 12', 'Boris on the 7-day week: Friday would fall from 9 to 8 h under the 12 posted: refused');
-- the same hours on the booked Saturday: allowed
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "sevenDayWeekCalendar"}' WHERE "rowGUID" = 'p-clara';
SELECT tt.eq(public.organization_resource_capacity('person','p-clara','2026-10-17'), 8::numeric, 'Clara from the 6-day to the 7-day week (Saturday 8 h either way): allowed');
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "sixDayWeekCalendar"}' WHERE "rowGUID" = 'p-clara';
SELECT tt.fails($q$UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "standardWorkWeekCalendar"}' WHERE "rowGUID" = 'p-clara'$q$, 'capacity cannot be less than 6', 'Clara from the 6-day week to the standard one (Saturday 0 h): refused');
SELECT tt.fails($q$UPDATE public."equipmentTable" SET "rowJSON" = "rowJSON" - 'resourceCalendar' WHERE "rowGUID" = 'e-crane'$q$, 'Tower crane', 'the crane without its 6-day calendar: refused, with its name');
-- a resource whose calendar nobody uses on the booked days can change
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "partTime4hCalendar"}' WHERE "rowGUID" = 'p-dan';
SELECT tt.eq(public.organization_resource_capacity('person','p-dan','2026-10-18'), 8::numeric, 'Dan: the contract calendar wins, so his own pointer does not change his Sunday');

-- the contracts of a person --------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$DELETE FROM public."contractTable" WHERE "rowGUID" = 'c-dan-7d'$q$, 'capacity cannot be less than 4', 'deleting the contract whose 7-day calendar covers the booked Sunday: refused');
SELECT tt.fails($q$UPDATE public."contractTable" SET "rowJSON" = "rowJSON" || '{"contractFinishDate": "2026-10-17"}' WHERE "rowGUID" = 'c-dan-7d'$q$, 'capacity cannot be less than 4', 'ending the contract the day before the booked Sunday: refused');
SELECT tt.fails($q$UPDATE public."contractTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar": "partTime4hCalendar"}' WHERE "rowGUID" = 'c-dan-7d'$q$, 'capacity cannot be less than 4', 'another calendar of the contract (Sunday 0 h): refused');
SELECT tt.fails($q$INSERT INTO public."contractTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('c-dan-pt','p-dan','person','{"contractPartyType":"person","contractSumBeforeVAT":1,"contractStartDate":"2026-10-18","contractFinishDate":"2026-10-18","contractNumber":"8","resourceCalendar":"partTime4hCalendar"}')$q$, 'capacity cannot be less than 4', 'a new contract that covers the booked Sunday with a worse calendar: refused');
INSERT INTO public."contractTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('c-dan-late','p-dan','person','{"contractPartyType":"person","contractSumBeforeVAT":1,"contractStartDate":"2026-11-01","contractFinishDate":null,"contractNumber":"9","resourceCalendar":"partTime4hCalendar"}');
SELECT tt.eq(public.organization_resource_capacity('person','p-dan','2026-11-02'), 4::numeric, 'a contract that starts after every booking is allowed (Monday 2 Nov: its part-time calendar, 4 h)');
UPDATE public."contractTable" SET "rowJSON" = "rowJSON" || '{"contractNumber": "7b"}' WHERE "rowGUID" = 'c-dan-7d';
SELECT tt.eq((SELECT "rowJSON"->>'contractNumber' FROM public."contractTable" WHERE "rowGUID" = 'c-dan-7d'), '7b', 'a change of an unrelated key of the contract is not guarded');

-- an Organization-independent fact: the lock does not depend on the mode of the organization (it is capacityModeOff here)
SELECT tt.eq((SELECT coalesce("rowJSON"->>'resourceCapacityStrongMode','capacityModeOff') FROM public."organizationTable" WHERE "rowOwnerGUID" = 'anna@acme.test'), 'capacityModeOff', 'the lock works although the organization is in capacityModeOff');
ROLLBACK;
