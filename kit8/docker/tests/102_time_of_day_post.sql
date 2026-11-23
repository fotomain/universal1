-- PART 53, part two: POST in the time-of-day model: the slices are written with the day rows (and must add up to them), the busy check is exact to the MINUTE (it catches what the day check
-- lets through), the posted slices of one project are the foreign load of another, a changed start TIME unposts (documentation/RESOURCE_LEVELING_HOURS_WBS.html 4.5).
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
SELECT t."rowGUID" AS tm1, t."projectGUID" AS pm FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT t."rowGUID" AS tm2 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT tt.line(:'ta1', 'person', 'p-boris') AS la1 \gset
SELECT tt.line(:'tm1', 'person', 'p-boris') AS lm1 \gset
SELECT tt.line(:'tm2', 'person', 'p-boris') AS lm2 \gset
-- both projects plan by the clock; Boris works 09:00-13:00 and 14:00-18:00 on 2026-10-14 (a day of the standard week, 8 hours)
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"resourceOptimizationMode": "hourByHourModel"}' WHERE "rowGUID" IN (:'pa', :'pm');
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"windows": [{"from": "09:00", "to": "13:00"}, {"from": "14:00", "to": "18:00"}]}' WHERE "rowGUID" = 'standardWorkWeekCalendar:2026-10-14';

CREATE FUNCTION tt.post_h(p_task uuid, p_line uuid, p_qty numeric, p_days jsonb, p_hours jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', p_task, 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
    jsonb_build_object('lineGUID', p_line, 'qtyTaskLine', p_qty, 'sumForBudget', p_qty * 10, 'sumForContract', p_qty * 10, 'baseOfDistribution', 1, 'days', p_days) ||
    CASE WHEN p_hours IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('hours', p_hours) END))) $$;

-- 1. the slices are written with the day rows --------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post_h(:'ta1', :'la1', 8, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 540, "t": 780, "c": 0.5}, {"d": "2026-10-14", "f": 840, "t": 1080, "c": 0.5}]') AS r1 \gset
SELECT tt.eq((SELECT count(*)::int FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1'), 2, 'two slices are written (one per window)');
SELECT tt.eq((SELECT sum("qtyTaskLine") FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1'), 8::numeric, 'their hours add up to the hours of the line');
SELECT tt.eq((SELECT sum("minutes") FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1'), 480::bigint, 'their minutes add up to the working minutes of the day');
SELECT tt.eq((SELECT "minuteFrom" || '-' || "minuteTo" FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1' ORDER BY "minuteFrom" LIMIT 1), '540-780', 'the first slice is 09:00-13:00');
SELECT tt.eq((SELECT ("periodStart" AT TIME ZONE 'Europe/Riga')::text FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1' ORDER BY "minuteFrom" LIMIT 1), '2026-10-14 09:00:00', 'periodStart is the wall clock in the zone of the post');
SELECT tt.eq((SELECT "resourceKind" || ':' || "resourceGUID" FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1' LIMIT 1),
             'workCenter:' || (SELECT w."rowGUID" FROM public."workCenterTable" w WHERE w."rowJSON"->>'workCenterBase' = 'p-boris'), 'the resource (the work center of the person) is on the slice');
SELECT tt.eq((SELECT count(*)::int FROM public.task_line_plan_movements WHERE "rowParentGUID" = :'la1'), 1, 'the day row is still there: every report reads it');
SELECT tt.eq((:'r1'::jsonb->>'rows')::int, 1, 'the answer of Post counts the day rows as before');
-- Post again: the earlier slices are replaced
SELECT tt.post_h(:'ta1', :'la1', 8, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 540, "t": 780, "c": 1}]') AS r2 \gset
SELECT tt.eq((SELECT count(*)::int FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1'), 1, 'a new Post replaces the slices of the earlier one');
-- no slices sent: a line without hour rows (its day hours count as spread over the windows)
SELECT tt.post_h(:'ta1', :'la1', 8, '[{"d": "2026-10-14", "c": 1}]', NULL) AS r3 \gset
SELECT tt.eq((SELECT count(*)::int FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1'), 0, 'a Post without slices writes none (and removes the old ones)');

-- 2. consistency: the slices must add up -----------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails(format($q$SELECT tt.post_h(%L, %L, 8, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 540, "t": 780, "c": 0.5}]')$q$, :'ta1', :'la1'), 'add up to 0.5', 'slices that do not add up to the base are refused');
SELECT tt.fails(format($q$SELECT tt.post_h(%L, %L, 8, '[{"d": "2026-10-14", "c": 0.5}, {"d": "2026-10-15", "c": 0.5}]', '[{"d": "2026-10-14", "f": 540, "t": 780, "c": 0.75}, {"d": "2026-10-15", "f": 540, "t": 780, "c": 0.25}]')$q$, :'ta1', :'la1'), 'the day row has 0.5', 'slices of a day that differ from its day row are refused');
SELECT tt.fails(format($q$SELECT tt.post_h(%L, %L, 8, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-16", "f": 540, "t": 780, "c": 1}]')$q$, :'ta1', :'la1'), 'no day row', 'a slice on a day the line does not have is refused');
SELECT tt.fails(format($q$SELECT tt.post_h(%L, %L, 8, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 780, "t": 540, "c": 1}]')$q$, :'ta1', :'la1'), 'f < t', 'a slice that ends before it starts is refused');
SELECT tt.fails(format($q$SELECT tt.post_h(%L, %L, 8, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 540, "t": 1500, "c": 1}]')$q$, :'ta1', :'la1'), 'within the day', 'a slice past the end of the day is refused');
SELECT tt.eq((SELECT count(*)::int FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1'), 0, 'a refused Post leaves nothing behind (one transaction)');

-- 3. the day model ignores the slices ----------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'resourceOptimizationMode' WHERE "rowGUID" = :'pa';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post_h(:'ta1', :'la1', 8, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 540, "t": 780, "c": 1}]') AS r4 \gset
SELECT tt.eq((SELECT count(*)::int FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'la1'), 0, 'dayByDayModel: no slice is written, whatever the client sends');
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"resourceOptimizationMode": "hourByHourModel"}' WHERE "rowGUID" = :'pa';

-- 4. the minute check: 4 hours of Anna in the morning window; Marko books 2 hours INSIDE it ----------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post_h(:'ta1', :'la1', 4, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 540, "t": 780, "c": 1}]') AS r5 \gset
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"resourceCapacityStrongMode": "capacityModeBlock"}' WHERE "rowGUID" = :'anna'::jsonb->>'organizationGUID';
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
-- 4 h at 11:00-13:00: the DAY total is 8 h (Anna 4 + Marko 4) = the 8 h of the day, the day check passes; the minutes 11:00-13:00 hold 1 + 2 h per hour of 1: over
SELECT tt.post_h(:'tm1', :'lm1', 4, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 660, "t": 780, "c": 1}]') AS r6 \gset
SELECT tt.eq(:'r6'::jsonb->>'mode', 'capacityModeBlock', 'block: the mode of the organization');
SELECT tt.eq(jsonb_array_length(:'r6'::jsonb->'busy'), 1, 'the minutes are over: one conflict (the day check would have said nothing: 8 h of 8 h)');
SELECT tt.eq(:'r6'::jsonb->'busy'->0->'intervals'->0->>'from', '11:00', 'the over interval starts at 11:00');
SELECT tt.eq(:'r6'::jsonb->'busy'->0->'intervals'->0->>'to', '13:00', 'and ends at 13:00');
SELECT tt.eq((:'r6'::jsonb->'busy'->0->'intervals'->0->>'overHours')::numeric, 4::numeric, 'over by 4 h: in those two hours Marko books 4 h and Anna 2 h (half of her 4 h), the capacity is 2 h');
SELECT tt.eq((:'r6'::jsonb->'busy'->0->>'bookedOthers')::numeric, 4::numeric, 'the day totals: Anna''s 4 h are the others');
SELECT tt.eq((:'r6'::jsonb->>'rows')::int, 0, 'block: the busy line has no rows: nothing is posted');
SELECT tt.eq((SELECT count(*)::int FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'lm1'), 0, '... and no slices');
-- 4 h in the afternoon window: fits
SELECT tt.post_h(:'tm1', :'lm1', 4, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 840, "t": 1080, "c": 1}]') AS r7 \gset
SELECT tt.eq(jsonb_array_length(:'r7'::jsonb->'busy'), 0, '14:00-18:00 is free: no conflict');
SELECT tt.eq((SELECT count(*)::int FROM public.task_line_plan_hour_movements WHERE "rowParentGUID" = :'lm1' AND "planMovementStatus"), 1, 'the slice is active after the check');
-- touching is not overlapping: 13:00-14:00 is a break (capacity 0), a booking there is over
SELECT tt.post_h(:'tm2', :'lm2', 1, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 780, "t": 840, "c": 1}]') AS r8 \gset
SELECT tt.eq(jsonb_array_length(:'r8'::jsonb->'busy'), 1, 'a booking in the lunch break (no window) is over');
SELECT tt.eq((:'r8'::jsonb->'busy'->0->>'notFilled')::boolean, false, 'it is not an unknown day, the capacity is 0');

-- 5. the posted slices of one project are the foreign load of the other -------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT w."rowGUID" AS wcb FROM public."workCenterTable" w WHERE w."rowJSON"->>'workCenterBase' = 'p-boris' \gset
SELECT public.project_resource_leveling_inputs_hours(:'pa', '2026-10-12', '2026-10-16', jsonb_build_array(jsonb_build_object('k', 'workCenter', 'g', :'wcb'))) AS inp \gset
SELECT tt.eq(jsonb_array_length(:'inp'::jsonb->'foreign'), 1, 'Marko''s posted slice is Anna''s foreign load (one slice, not spread: it has hour rows)');
SELECT tt.eq((:'inp'::jsonb->'foreign'->0->>'s') || ' ' || (:'inp'::jsonb->'foreign'->0->>'e') || ' ' || (:'inp'::jsonb->'foreign'->0->>'h'), '2026-10-14T14:00:00 2026-10-14T18:00:00 4.000000', '14:00-18:00, 4 hours');

-- 6. a changed start TIME unposts a task of the time-of-day model, the same day does not in the day model ----------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq((SELECT "rowJSON"->>'taskIsPosted' FROM public.task_line_table WHERE "rowGUID" = :'la1'), 'true', 'the line of Anna is posted');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"startAt": "2026-10-14T09:00:00Z"}' WHERE "rowGUID" = :'ta1';
SELECT tt.eq((SELECT "rowJSON"->>'taskIsPosted' FROM public.task_line_table WHERE "rowGUID" = :'la1'), 'false', 'a first start date unposts (as before)');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post_h(:'ta1', :'la1', 4, '[{"d": "2026-10-14", "c": 1}]', '[{"d": "2026-10-14", "f": 540, "t": 780, "c": 1}]') AS r9 \gset
SELECT tt.as_admin();
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"startAt": "2026-10-14T09:15:00Z"}' WHERE "rowGUID" = :'ta1';
SELECT tt.eq((SELECT "rowJSON"->>'taskIsPosted' FROM public.task_line_table WHERE "rowGUID" = :'la1'), 'false', 'the time-of-day model: the start moved by 15 minutes on the same day: unposted');
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'resourceOptimizationMode' WHERE "rowGUID" = :'pa';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post_h(:'ta1', :'la1', 4, '[{"d": "2026-10-14", "c": 1}]', NULL) AS r10 \gset
SELECT tt.as_admin();
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"startAt": "2026-10-14T10:30:00Z"}' WHERE "rowGUID" = :'ta1';
SELECT tt.eq((SELECT "rowJSON"->>'taskIsPosted' FROM public.task_line_table WHERE "rowGUID" = :'la1'), 'true', 'the day model: a new time on the same day does not unpost (as before)');

ROLLBACK;
