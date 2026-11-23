-- PART 53: THE TIME-OF-DAY MODEL, part one (documentation/RESOURCE_LEVELING_HOURS_WBS.html): the windows of a calendar day, the capacity windows of a resource, the minute keys of a task,
-- the inputs of an hour leveling run (capacity windows + the posted hours of the OTHER projects as slices), apply / clear / undo in minutes, the template strip, the server plan on the
-- virtual axis of the steps (problem v = 2).
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.organization_invite_user('marko@acme.test');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
INSERT INTO public."personTable" ("rowGUID","rowJSON") VALUES ('p-boris', '{"personFirstName":"Boris","personLastName":"M"}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_admin(); SELECT tt.may_create_projects('marko@acme.test');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT t."rowGUID" AS ta1, t."projectGUID" AS pa FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT t."rowGUID" AS tm1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT tt.line(:'tm1', 'person', 'p-boris') AS lm1 \gset

-- 1. the windows of a calendar day -------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.organization_calendar_day_windows('standardWorkWeekCalendar', '2026-10-05'), '[[480, 960]]'::jsonb, 'a day without windows = ONE window from the workFrom of the calendar (08:00) for its hours');
SELECT tt.eq(public.organization_calendar_day_windows('standardWorkWeekCalendar', '2026-10-10'), '[]'::jsonb, 'a Saturday is a known closed day: no window');
SELECT tt.eq(public.organization_calendar_day_windows('standardWorkWeekCalendar', '2099-01-01') IS NULL, true, 'a day without a row is unknown (NULL), never guessed');
SELECT tt.eq(public.organization_calendar_day_windows('partTime4hCalendar', '2026-10-05'), '[[480, 720]]'::jsonb, 'the part time calendar: 08:00-12:00');
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"windows": [{"from": "09:00", "to": "13:00"}, {"from": "14:00", "to": "18:00"}]}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14';
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14'), 8::numeric, 'the hours of the day are the sum of its windows');
SELECT tt.eq((SELECT "rowJSON"->>'isActive' FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14'), 'true', 'and the day is active');
SELECT tt.eq(public.organization_calendar_day_windows('standardWorkWeekCalendar', '2026-10-14'), '[[540, 780], [840, 1080]]'::jsonb, 'two windows with a lunch break');
SELECT tt.eq(public.organization_resource_capacity_windows('person', 'p-boris', '2026-10-14'), '[[540, 780], [840, 1080]]'::jsonb, 'the resource that has no calendar of its own takes the windows of the standard week');
SELECT tt.eq(public.organization_resource_capacity_windows('person', 'p-boris', '2099-01-01') IS NULL, true, 'unknown stays unknown for a resource');
SELECT tt.fails($q$UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"windows": [{"from": "09:00", "to": "13:00"}, {"from": "12:00", "to": "18:00"}]}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-15'$q$, 'must not overlap', 'overlapping windows are refused');
SELECT tt.fails($q$UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"windows": [{"from": "14:00", "to": "13:00"}]}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-15'$q$, 'to" after "from', 'a window that ends before it starts is refused');
SELECT tt.fails($q$UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"windows": [{"from": "09:00:30", "to": "13:00"}]}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-15'$q$, 'HH:MM', 'seconds do not exist');
SELECT tt.fails($q$UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"windows": "x"}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-15'$q$, 'list of', 'windows must be a list');
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"windows": []}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-15';
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric || '/' || ("rowJSON"->>'isActive') FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-15'), '0/false', 'an empty list of windows is a closed day');
-- a hand-typed change of the hours that leaves the windows as they were DROPS them: the hours win (a manual day), and the day is one window from the workFrom again
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"windows": [{"from": "09:00", "to": "13:00"}, {"from": "14:00", "to": "18:00"}]}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-16';
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 6}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-16';
SELECT tt.eq((SELECT "rowJSON" ? 'windows' FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-16'), false, 'the windows are dropped when the hours are typed');
SELECT tt.eq(public.organization_calendar_day_windows('standardWorkWeekCalendar', '2026-10-16'), '[[480, 840]]'::jsonb, '... the day is 6 hours from 08:00');
SELECT tt.eq(public.hm_clock_minutes('09:15'), 555, 'hm_clock_minutes');
SELECT tt.eq(public.hm_clock_minutes('24:00'), 1440, 'hm_clock_minutes: the end of the day');
SELECT tt.eq(public.hm_clock_minutes('24:30') IS NULL, true, 'hm_clock_minutes: past the end of the day');
SELECT tt.eq(public.hm_clock_minutes('09:15:30') IS NULL, true, 'hm_clock_minutes: no seconds');

-- the daily pattern of the CALENDAR (rowJSON.workWindows): used by a day without windows of its own when the hours of the day equal its minutes
UPDATE public."managementCalendarTable" SET "rowJSON" = "rowJSON" || '{"workWindows": [{"from": "09:00", "to": "13:00"}, {"from": "14:00", "to": "18:00"}]}' WHERE "rowGUID" = 'standardWorkWeekCalendar';
SELECT tt.eq(public.organization_calendar_day_windows('standardWorkWeekCalendar', '2026-10-13'), '[[540, 780], [840, 1080]]'::jsonb, 'a day of 8 hours takes the pattern of the calendar (two windows)');
SELECT tt.eq(public.organization_calendar_day_windows('standardWorkWeekCalendar', '2026-10-16'), '[[480, 840]]'::jsonb, 'a day of 6 hours (not the 8 of the pattern) is one window from the workFrom');
SELECT tt.eq(public.organization_calendar_day_windows('standardWorkWeekCalendar', '2026-10-10'), '[]'::jsonb, 'a closed day has no window, pattern or not');
SELECT tt.eq(public.organization_calendar_day_windows('partTime4hCalendar', '2026-10-13'), '[[480, 720]]'::jsonb, 'another calendar has its own pattern (none): 08:00-12:00');

-- 2. the minute keys of a task -------------------------------------------------------------------------------------------------------------------------------------------------
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskStartMinute": 555, "taskDurationMinutes": 90, "taskLevelingDelayMinutes": 30}' WHERE "rowGUID" = :'ta1';
SELECT tt.eq((SELECT "rowJSON"->>'taskDurationMinutes' FROM public.project_task_table WHERE "rowGUID" = :'ta1'), '90', 'whole minutes are accepted');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskStartMinute": 1440}' WHERE "rowGUID" = %L$q$, :'ta1'), '0 to 1439', 'a start time past the day is refused');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDurationMinutes": 0}' WHERE "rowGUID" = %L$q$, :'ta1'), '1 minute or more', 'a duration of 0 minutes is refused (a milestone is a kind, not a duration)');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDurationMinutes": 1.5}' WHERE "rowGUID" = %L$q$, :'ta1'), 'whole number of minutes', 'a fraction of a minute is refused');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskLevelingDelayMinutes": -5}' WHERE "rowGUID" = %L$q$, :'ta1'), '0 or more', 'a negative delay is refused');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskLevelingDelayMinutes": "x"}' WHERE "rowGUID" = %L$q$, :'ta1'), 'must be a number', 'a text is refused');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" - 'taskStartMinute' - 'taskDurationMinutes' - 'taskLevelingDelayMinutes' WHERE "rowGUID" = :'ta1';
SELECT tt.eq(public.task_template_clean_task('{"taskLevelingDelayMinutes": 30, "taskLevelingDelayDays": 2, "taskDurationMinutes": 90}'::jsonb) ? 'taskLevelingDelayMinutes', false, 'a template does not keep the leveling delay in minutes');
SELECT tt.eq(public.task_template_clean_task('{"taskLevelingDelayMinutes": 30, "taskDurationMinutes": 90}'::jsonb) ? 'taskDurationMinutes', true, '... but keeps the duration');

-- 3. the inputs of an hour leveling run ----------------------------------------------------------------------------------------------------------------------------------------
-- Marko posts 8 hours of Boris on 2026-10-14 (a day with two windows); Anna asks for the inputs of HER project
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.post(:'tm1', format('[{"line": "%s", "days": {"2026-10-14": 8}}]', :'lm1')::jsonb) AS r1 \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT w."rowGUID" AS wcb FROM public."workCenterTable" w WHERE w."rowJSON"->>'workCenterBase' = 'p-boris' \gset
SELECT public.project_resource_leveling_inputs_hours(:'pa', '2026-10-12', '2026-10-16', jsonb_build_array(jsonb_build_object('k', 'workCenter', 'g', :'wcb'))) AS inp \gset
SELECT tt.eq((SELECT e->'w' FROM jsonb_array_elements(:'inp'::jsonb->'capacity') e WHERE e->>'d' = '2026-10-14'), '[[540, 780], [840, 1080]]'::jsonb, 'the capacity of a day is its windows');
SELECT tt.eq((SELECT e->'w' FROM jsonb_array_elements(:'inp'::jsonb->'capacity') e WHERE e->>'d' = '2026-10-13'), '[[540, 780], [840, 1080]]'::jsonb, 'a day without windows of its own: the pattern of the calendar (set in section 1)');
SELECT tt.eq((SELECT e->'w' FROM jsonb_array_elements(:'inp'::jsonb->'capacity') e WHERE e->>'d' = '2026-10-15'), '[]'::jsonb, 'a closed day is [] (known), not missing');
SELECT tt.eq(jsonb_array_length(:'inp'::jsonb->'foreign'), 2, 'the other project holds the person: its day hours are spread over the two windows (a line that has only day rows)');
SELECT tt.eq((:'inp'::jsonb->'foreign'->0)::text, jsonb_build_object('e', '2026-10-14T13:00:00', 'g', :'wcb', 'h', 4.000000, 'k', 'workCenter', 's', '2026-10-14T09:00:00')::text, 'the first slice: 09:00-13:00, 4 hours');
SELECT tt.eq((:'inp'::jsonb->'foreign'->1->>'s'), '2026-10-14T14:00:00', 'the second slice starts at 14:00');
SELECT tt.eq((SELECT sum((e->>'h')::numeric) FROM jsonb_array_elements(:'inp'::jsonb->'foreign') e), 8::numeric, 'together 8 hours: nothing is lost');
SELECT tt.eq(:'inp'::jsonb::text LIKE '%Task 111%', false, 'no title, no project, no task of a colleague is in the answer');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_inputs_hours(%L, '2026-10-16', '2026-10-12', '[]')$q$, :'pa'), 'give the first and the last day', 'a backwards range is refused');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_inputs_hours(%L, '2026-01-01', '2031-01-01', '[]')$q$, :'pa'), 'longer than 1500', 'a range over 1500 days is refused');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_inputs_hours(%L, '2026-10-12', '2026-10-16', '[]')$q$, :'pa'), 'not yours', 'the inputs of a project that is not yours are refused');

-- 4. apply / clear / undo in MINUTES ------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.project_resource_leveling_apply(:'pa', jsonb_build_object('kind', 'level', 'mode', 'manual', 'method', 'leveling', 'options', jsonb_build_object('delayUnit', 'minutes', 'stepMinutes', 15),
  'tasks', jsonb_build_array(jsonb_build_object('task', :'ta1', 'delayBefore', 0, 'delayAfter', 240, 'reason', 'idYield')))) AS run1 \gset
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayMinutes' FROM public.project_task_table WHERE "rowGUID" = :'ta1'), '240', 'the delay of a time-of-day run is written in MINUTES');
SELECT tt.eq((SELECT "rowJSON" ? 'taskLevelingDelayDays' FROM public.project_task_table WHERE "rowGUID" = :'ta1'), false, '... and not in days');
SELECT tt.eq((SELECT "runOptions"->>'delayUnit' FROM public.project_resource_leveling_run WHERE "rowGUID" = :'run1'), 'minutes', 'the run says the unit');
SELECT public.project_resource_leveling_undo(:'run1') AS u1 \gset
SELECT tt.eq((SELECT "rowJSON" ? 'taskLevelingDelayMinutes' FROM public.project_task_table WHERE "rowGUID" = :'ta1'), false, 'undo gives the minutes back (no delay before)');
SELECT public.project_resource_leveling_apply(:'pa', jsonb_build_object('kind', 'level', 'options', jsonb_build_object('delayUnit', 'minutes'),
  'tasks', jsonb_build_array(jsonb_build_object('task', :'ta1', 'delayBefore', 0, 'delayAfter', 90)))) AS run2 \gset
SELECT public.project_resource_leveling_apply(:'pa', jsonb_build_object('kind', 'level', 'options', jsonb_build_object('delayUnit', 'minutes'),
  'tasks', jsonb_build_array(jsonb_build_object('task', :'ta1', 'delayBefore', 90, 'delayAfter', 150)))) AS run3 \gset
SELECT public.project_resource_leveling_undo(:'run3') AS u3 \gset
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayMinutes' FROM public.project_task_table WHERE "rowGUID" = :'ta1'), '90', 'undo of the second run restores the 90 minutes of the first');
SELECT public.project_resource_leveling_clear(:'pa') AS c1 \gset
SELECT tt.eq((SELECT "rowJSON" ? 'taskLevelingDelayMinutes' FROM public.project_task_table WHERE "rowGUID" = :'ta1'), false, 'clear removes the delay in minutes too');
SELECT tt.eq((SELECT "runOptions"->>'delayUnit' FROM public.project_resource_leveling_run WHERE "rowGUID" = :'c1'), 'minutes', 'the clear run knows its unit');
SELECT tt.eq((SELECT "delayBefore" FROM public.project_resource_leveling_task WHERE "rowRunGUID" = :'c1' AND "rowTaskGUID" = :'ta1'), 90, 'and the delay it removed');
SELECT public.project_resource_leveling_undo(:'c1') AS uc \gset
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayMinutes' FROM public.project_task_table WHERE "rowGUID" = :'ta1'), '90', 'undo of a clear restores the minutes');
-- a day-model run is unchanged: the key is days
SELECT public.project_resource_leveling_apply(:'pa', jsonb_build_object('kind', 'level', 'tasks', jsonb_build_array(jsonb_build_object('task', :'ta1', 'delayBefore', 0, 'delayAfter', 2)))) AS run4 \gset
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayDays' FROM public.project_task_table WHERE "rowGUID" = :'ta1'), '2', 'a run without a unit writes days, as before');

-- 5. the server plan on the virtual axis (problem v = 2): a day is a STEP of working time -----------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT set_config('tt.pa', :'pa', false);
CREATE FUNCTION tt.srv2(p_leaves jsonb, p_cons jsonb DEFAULT '[]', p_opts jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.project_resource_leveling_server_plan(current_setting('tt.pa')::uuid,
    jsonb_build_object('v', 2, 'method', 'leveling', 'order', 'standard', 'period', 'day', 'direction', 'forward', 'skipWeekends', false, 'projectStart', '2000-01-01',
                       'delays', '{}'::jsonb, 'maxSearch', 200, 'lastSlot', 99, 'cap', jsonb_build_array(jsonb_build_array('person:p-boris', 0, 99, 0.25)), 'for', '[]'::jsonb,
                       'leaves', p_leaves, 'cons', p_cons, 'members', '{}'::jsonb) || p_opts) $$;
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
-- two tasks of 16 steps (15 min each = 4 hours) that book 4 hours of one person who has 0.25 h in every step
SELECT jsonb_build_array(jsonb_build_object('g', 'A', 'o', 0, 'd', 16, 'l', jsonb_build_array(jsonb_build_array('person:p-boris', 4))),
                         jsonb_build_object('g', 'B', 'o', 1, 'd', 16, 'l', jsonb_build_array(jsonb_build_array('person:p-boris', 4)))) AS two \gset
SELECT tt.srv2(:'two') AS s1 \gset
SELECT tt.eq((:'s1'::jsonb)->>'supported', 'true', 'v = 2: supported');
SELECT tt.eq((:'s1'::jsonb)->'delays', '{"B": 16}'::jsonb, 'two equal tasks on one person: the second yields 16 steps');
SELECT tt.eq((:'s1'::jsonb)->>'conflictsBefore', '16', 'sixteen steps over-allocated before');
SELECT tt.eq((:'s1'::jsonb)->>'conflictsAfter', '0', 'none after');
SELECT tt.eq((:'s1'::jsonb)->>'finish', '2000-02-02', 'the finish is the virtual date of step 32 (2000-01-01 + 32 days)');
SELECT tt.eq((:'s1'::jsonb)#>>'{moves,0,bucket}', '2000-01-01', 'the bucket of a conflict is a virtual date');
-- the other projects hold the first 16 steps: both tasks move
SELECT tt.eq((tt.srv2(:'two', '[]', '{"for": [["person:p-boris", 0, 15, 0.25]]}'))->'delays', '{"A": 32, "B": 16}'::jsonb, 'foreign load of 4 hours in the first 16 steps: B (the weaker) takes the free steps 16-31, A goes behind it (the rule of the engine)');
-- a gap in the capacity: steps 16..31 are unknown (no row): the task cannot stand there
SELECT tt.eq((tt.srv2(:'two', '[]', '{"cap": [["person:p-boris", 0, 15, 0.25], ["person:p-boris", 32, 99, 0.25]]}'))->'delays', '{"B": 32}'::jsonb, 'unknown steps are never used: B goes behind the gap');
-- a link: B behind A already
SELECT tt.eq((tt.srv2(:'two', '[["B","A","FS",0]]'))->'delays', '{}'::jsonb, 'Finish-to-Start in steps: nothing to move');
SELECT tt.eq((tt.srv2(:'two', '[]', '{"method": "smoothing"}'))->'delays', '{}'::jsonb, 'Smoothing: the finish may not move');
SELECT tt.eq((tt.srv2(:'two', '[]', '{"maxSearch": 8}'))#>>'{unresolved,0,code}' IS NOT NULL, true, 'a short search leaves the conflict with a code');
SELECT tt.eq((tt.srv2(:'two', '[]', '{"skipWeekends": true}'))->'reasons', '["options"]'::jsonb, 'weekends do not exist on the virtual axis');
SELECT tt.eq((tt.srv2(:'two', '[]', '{"period": "week"}'))->'reasons', '["options"]'::jsonb, 'nor the week grain');
SELECT tt.eq((tt.srv2(:'two', '[]', '{"lastSlot": null}'))->'reasons', '["size"]'::jsonb, 'no last step: not calculated');
SELECT tt.eq((tt.srv2(:'two', '[]', '{"lastSlot": 100000}'))->'reasons', '["size"]'::jsonb, 'a horizon over 30 000 steps is not calculated');
-- the day problem (v = 1) is not changed by the new search length: it still stops at 800 days
SELECT tt.eq((public.project_resource_leveling_server_plan(:'pa', jsonb_build_object('v', 1, 'method', 'leveling', 'order', 'standard', 'period', 'day', 'direction', 'forward', 'skipWeekends', true,
  'projectStart', '2026-10-05', 'from', '2026-09-28', 'to', '2026-12-31', 'delays', '{}'::jsonb, 'leaves', '[]'::jsonb)))->>'supported', 'true', 'a day problem is still calculated');

ROLLBACK;
