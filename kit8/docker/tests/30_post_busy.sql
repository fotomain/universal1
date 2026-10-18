-- WP 1, 3, 4: the occupancy view, organization_resource_busy_check and the check inside create_task_line_plan (the three modes, planMovementStatus)
BEGIN;
SELECT tt.as_admin();


-- the world: organization ACME with anna (admin) and marko (invited), a second organization with eva; persons, a crane, tasks ----------------------------
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.organization_invite_user('marko@acme.test');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT public.organization_ensure_user('eva@other.test', '33333333-3333-3333-3333-333333333333', 'Eva', 'V') AS eva \gset
INSERT INTO public."personTable" ("rowGUID","rowJSON") VALUES ('p-boris', '{"personFirstName":"Boris","personLastName":"M"}'), ('p-clara', '{"personFirstName":"Clara","personLastName":"S","resourceCalendar":"partTime4hCalendar"}');
INSERT INTO public."equipmentTable" ("rowGUID","rowJSON") VALUES ('e-crane', '{"equipmentTitle":"Tower crane"}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_user('eva@other.test', '33333333-3333-3333-3333-333333333333'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
-- three tasks of ACME (two projects of anna, one of marko) and one task of the other organization
SELECT t."rowGUID" AS ta1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT t."rowGUID" AS ta2 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT t."rowGUID" AS tm1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT t."rowGUID" AS te1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '33333333-3333-3333-3333-333333333333' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT tt.line(:'ta1', 'person', 'p-boris') AS la1 \gset
SELECT tt.line(:'tm1', 'person', 'p-boris') AS lm1 \gset
SELECT tt.line(:'ta2', 'person', 'p-boris') AS la2 \gset
SELECT tt.line(:'te1', 'person', 'p-boris') AS le1 \gset

-- 1. capacityModeOff (the default): nothing is checked, nothing changes ----------------------------------------------------------------------------
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.post(:'tm1', format('[{"line": "%s", "days": {"2026-10-14": 8}}]', :'lm1')::jsonb) AS r1 \gset
SELECT tt.eq(:'r1'::jsonb->>'mode', 'capacityModeOff', 'the default mode is capacityModeOff');
SELECT tt.eq(:'r1'::jsonb->'busy', '[]'::jsonb, 'off: nothing to report');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 8}}]', :'la1')::jsonb) AS r2 \gset
SELECT tt.eq((:'r2'::jsonb->>'rows')::int, 1, 'off: a second booking of Boris on the same day is posted (16 h of 8 h)');
SELECT tt.eq((SELECT count(*) FROM public.task_line_plan_movements WHERE NOT "planMovementStatus"), 0::bigint, 'off: no row waits for a check');
SELECT tt.eq((SELECT "periodDay" FROM public.task_line_plan_movements WHERE "rowParentGUID" = :'la1'), '2026-10-14'::date, 'periodDay is the day of the post');
SELECT tt.fails($q$SELECT * FROM public.resource_occupancy_x_movement$q$, 'permission denied', 'nobody reads the view directly');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.resource_occupancy_x_movement WHERE "statusOfLine" = 'posted'), 2::bigint, 'the occupancy view shows both posted rows');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

-- 2. capacityModeWarn: reported, kept -----------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"resourceCapacityStrongMode": "capacityModeWarn"}' WHERE "rowGUID" = :'anna'::jsonb->>'organizationGUID';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 8}}]', :'la1')::jsonb) AS r3 \gset
SELECT tt.eq(:'r3'::jsonb->>'mode', 'capacityModeWarn', 'warn: the mode of the organization');
SELECT tt.eq(jsonb_array_length(:'r3'::jsonb->'busy'), 1, 'warn: one conflict is reported');
SELECT tt.eq((:'r3'::jsonb->'busy'->0->>'overHours')::numeric, 8::numeric, 'warn: over by 8 h');
SELECT tt.eq(:'r3'::jsonb->'busy'->0->'others'->0->>'taskGUID', :'tm1', 'warn: the other booking is named by task GUID ...');
SELECT tt.eq(:'r3'::jsonb->'busy'->0->'others'->0->>'projectGUID' IS NOT NULL, true, '... and project GUID');
SELECT tt.eq((:'r3'::jsonb->>'rows')::int, 1, 'warn: the rows are kept');
SELECT tt.eq((SELECT "rowJSON"->>'taskIsPosted' FROM public.task_line_table WHERE "rowGUID" = :'la1'), 'true', 'warn: the line is posted');

-- 3. capacityModeBlock: the busy line loses its rows, the others are posted ------------------------------------------------------------------------
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"resourceCapacityStrongMode": "capacityModeBlock"}' WHERE "rowGUID" = :'anna'::jsonb->>'organizationGUID';
SELECT tt.line(:'ta1', 'person', 'p-clara') AS la1c \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 4, "2026-10-15": 4}}, {"line": "%s", "days": {"2026-10-14": 4}}]', :'la1', :'la1c')::jsonb) AS r4 \gset
SELECT tt.eq(jsonb_array_length(:'r4'::jsonb->'busy'), 1, 'block: one conflict (Boris on Wednesday); Thursday fits but the whole line goes');
SELECT tt.eq((SELECT count(*) FROM public.task_line_plan_movements WHERE "rowParentGUID" = :'la1'), 0::bigint, 'block: the rows of the busy line are deleted');
SELECT tt.eq((SELECT "rowJSON"->>'taskIsPosted' FROM public.task_line_table WHERE "rowGUID" = :'la1'), 'false', 'block: the busy line is "Post needed"');
SELECT tt.eq((SELECT count(*) FROM public.task_line_plan_movements WHERE "rowParentGUID" = :'la1c'), 1::bigint, 'block: the other line of the task is posted');
SELECT tt.eq((SELECT "rowJSON"->>'taskIsPosted' FROM public.task_line_table WHERE "rowGUID" = :'la1c'), 'true', '... and marked posted');
SELECT tt.eq((:'r4'::jsonb->>'lines')::int, 1, 'block: the answer counts one posted line');
SELECT tt.eq((SELECT count(*) FROM public.task_line_plan_timeline WHERE "taskLineGUID" = :'la1'), 0::bigint, 'block: the timeline has nothing of the busy line');
SELECT tt.eq((SELECT count(*) FROM public.task_line_plan_movements WHERE NOT "planMovementStatus"), 0::bigint, 'block: no committed row is left with planMovementStatus = false');
-- Clara: part-time 4 h: exactly 4 is not busy, more is
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 4}}]', :'la1c')::jsonb) AS r5 \gset
SELECT tt.eq(:'r5'::jsonb->'busy', '[]'::jsonb, 'exactly the capacity (4 of 4 h) is not busy');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 5}}]', :'la1c')::jsonb) AS r6 \gset
SELECT tt.eq((:'r6'::jsonb->'busy'->0->>'capacityHours')::numeric, 4::numeric, 'more than the part-time capacity is busy');
SELECT tt.eq((:'r6'::jsonb->'busy'->0->>'overHours')::numeric, 1::numeric, '... by 1 h');
-- the day with capacity 0 (Saturday)
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-17": 2}}]', :'la1')::jsonb) AS r7 \gset
SELECT tt.eq((:'r7'::jsonb->'busy'->0->>'capacityHours')::numeric, 0::numeric, 'Saturday: capacity 0 -> busy');
-- a re-post of the same task does not collide with its own old rows; free days are fine
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-15": 8}}]', :'la1')::jsonb) AS r8 \gset
SELECT tt.eq(:'r8'::jsonb->'busy', '[]'::jsonb, 'Thursday is free');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-15": 8}}]', :'la1')::jsonb) AS r9 \gset
SELECT tt.eq(:'r9'::jsonb->'busy', '[]'::jsonb, 'a re-post does not collide with the rows of the same task');
-- two lines of ONE task add up
SELECT tt.line(:'ta1', 'person', 'p-boris') AS la1b \gset
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-16": 5}}, {"line": "%s", "days": {"2026-10-16": 5}}]', :'la1', :'la1b')::jsonb) AS r10 \gset
SELECT tt.eq(jsonb_array_length(:'r10'::jsonb->'busy'), 1, 'two lines of one task on one day add up (10 h of 8 h)');
SELECT tt.eq(jsonb_array_length(:'r10'::jsonb->'busy'->0->'lines'), 2, '... and both lines are named');
SELECT tt.eq((:'r10'::jsonb->>'lines')::int, 0, '... and both are left out');

-- another organization never counts; and a stale row (taskIsPosted = false) does not count
SELECT tt.as_user('eva@other.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.post(:'te1', format('[{"line": "%s", "days": {"2026-10-20": 8}}]', :'le1')::jsonb);
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-20": 8}}]', :'la1')::jsonb) AS r11 \gset
SELECT tt.eq(:'r11'::jsonb->'busy', '[]'::jsonb, 'the booking of another organization is ignored');
SELECT tt.as_admin();
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"taskIsPosted": false}' WHERE "rowGUID" = :'lm1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 8}}]', :'la1')::jsonb) AS r12 \gset
SELECT tt.eq(:'r12'::jsonb->'busy', '[]'::jsonb, 'a stale booking (taskIsPosted = false) does not count');


-- Q5/Q17: the conflict names the managers of the projects that hold the booking and of the project being posted (the Share button writes to them)
SELECT tt.as_admin();
INSERT INTO public."personTable" ("rowGUID","rowJSON") VALUES ('p-pm-anna', '{"personFirstName":"Petra","personLastName":"N","personEmail":"petra@acme.test"}'), ('p-pm-marko', '{"personFirstName":"Rok","personLastName":"T","personEmail":"rok@acme.test"}');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectManagerPerson": "p-pm-anna"}' WHERE "rowGUID" = (SELECT "projectGUID" FROM public.project_task_table WHERE "rowGUID" = :'ta1');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectManagerPerson": "p-pm-marko"}' WHERE "rowGUID" = (SELECT "projectGUID" FROM public.project_task_table WHERE "rowGUID" = :'tm1');
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"taskIsPosted": true}' WHERE "rowGUID" = :'lm1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 8}}]', :'la1')::jsonb) AS r14 \gset
SELECT tt.eq(:'r14'::jsonb->'busy'->0->'others'->0->>'managerEmail', 'rok@acme.test', 'the other booking carries the e-mail of the manager of ITS project');
SELECT tt.eq(:'r14'::jsonb->'busy'->0->>'postingManagerEmail', 'petra@acme.test', '... and the conflict the manager of the project being posted (cc)');

-- the answer of a user of another organization is refused; a day nobody filled is a conflict, never a guess
SELECT tt.fails(format($q$SELECT * FROM public.organization_resource_busy_check(%L, %L)$q$, :'ta1', :'eva'::jsonb->>'organizationGUID'), 'not yours', 'the check is for your own organization');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2035-03-01": 2}}]', :'la1')::jsonb) AS r13 \gset
SELECT tt.eq(:'r13'::jsonb->'busy'->0->>'notFilled', 'true', 'a year nobody filled: the calendar is not filled -> not posted');
SELECT tt.fails($q$SELECT * FROM public.organization_resource_busy_check(gen_random_uuid(), (SELECT public.organization_of_current_user()), 'hour')$q$, 'not possible yet', 'hour / minute grain: not yet');
ROLLBACK;
