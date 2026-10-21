-- PART 36: the TIME SHEET (documentation/TIME_SHEET_WBS.html): the Person of every user, the settings per Person, "Create work center", the header / lines / entered hours, Post -> 'used' movements, "Create based on"
BEGIN;
SELECT tt.as_admin();

-- marko has a Person with his e-mail BEFORE his first login: it must be used, not duplicated and not changed
INSERT INTO public."personTable" ("rowGUID", "rowJSON") VALUES ('p-marko', '{"personFirstName":"Marko","personLastName":"Original","personEmail":"Marko@Acme.test"}');
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.eq((SELECT count(*) FROM public."personTable" WHERE lower("rowJSON"->>'personEmail') = 'anna@acme.test'), 1::bigint, 'the first login made ONE Person for anna');
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT tt.eq((SELECT count(*) FROM public."personTable" WHERE lower("rowJSON"->>'personEmail') = 'anna@acme.test'), 1::bigint, 'a second login makes no second Person');
SELECT tt.eq((SELECT "rowJSON"->>'personFirstName' FROM public."personTable" WHERE lower("rowJSON"->>'personEmail') = 'anna@acme.test'), 'Anna', 'the name comes from the login');
SELECT tt.eq((SELECT count(*) FROM public."personTable" WHERE lower("rowJSON"->>'personEmail') = 'marko@acme.test'), 1::bigint, 'marko had a Person with his e-mail (other case): no second one');
SELECT tt.eq((SELECT "rowJSON"->>'personLastName' FROM public."personTable" WHERE "rowGUID" = 'p-marko'), 'Original', 'the existing Person is not changed');

SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
DELETE FROM public.monitor01_dirty;
SELECT t."rowGUID" AS t3, t."projectGUID" AS p1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT t."rowGUID" AS t4 FROM public.project_task_table t WHERE t."projectGUID" = :'p1' AND t."rowGUID" <> :'t3' AND COALESCE(t."rowJSON"->>'rowKind', 'task') = 'task' ORDER BY t."rowGUID" LIMIT 1 \gset
SELECT t."rowGUID" AS tstage FROM public.project_task_table t WHERE t."projectGUID" = :'p1' AND t."rowJSON"->>'rowKind' = 'stage' ORDER BY t."rowGUID" LIMIT 1 \gset
SELECT t."rowGUID" AS tmarko FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND COALESCE(t."rowJSON"->>'rowKind', 'task') = 'task' ORDER BY t."rowGUID" LIMIT 1 \gset
SELECT tt.eq(:'tstage' <> '', true, 'the demo project has a stage');
SELECT r."rowGUID" AS role1 FROM public."resourceRoleTable" r JOIN public."resourceRoleTypeTable" t ON t."rowGUID" = r."rowOwnerGUID"
 WHERE t."rowJSON"->>'managementGenus' = 'timeGenus' AND COALESCE(t."rowJSON"->>'resourceKind', 'person') = 'person' ORDER BY r."rowGUID" LIMIT 1 \gset
SELECT r."rowGUID" AS role2 FROM public."resourceRoleTable" r JOIN public."resourceRoleTypeTable" t ON t."rowGUID" = r."rowOwnerGUID"
 WHERE t."rowJSON"->>'managementGenus' = 'timeGenus' AND COALESCE(t."rowJSON"->>'resourceKind', 'person') = 'person' AND r."rowGUID" <> :'role1' ORDER BY r."rowGUID" LIMIT 1 \gset
SELECT b."rowGUID" AS bi1 FROM public."budgetItemTable" b WHERE b."rowParentGUID" <> 'empty' AND b."rowJSON"->>'managementGenusItem' = 'timeGenus' ORDER BY b."rowGUID" LIMIT 1 \gset
SELECT b."rowGUID" AS bi2 FROM public."budgetItemTable" b WHERE b."rowParentGUID" <> 'empty' AND b."rowJSON"->>'managementGenusItem' = 'timeGenus' AND b."rowGUID" <> :'bi1' ORDER BY b."rowGUID" LIMIT 1 \gset
SELECT "rowGUID" AS bu1 FROM public."businessUnitTable" ORDER BY "rowGUID" LIMIT 1 \gset
SELECT "rowGUID" AS bu2 FROM public."businessUnitTable" WHERE "rowGUID" <> :'bu1' ORDER BY "rowGUID" LIMIT 1 \gset
SELECT tt.eq(:'role2' <> '' AND :'bi2' <> '' AND :'bu2' <> '', true, 'the seeds have two Time roles of a person, two Time budget items, two business units');

-- 1. the settings: Person -> Organization -> built-in default ---------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.timesheet_all_work_centers(), false, 'timesheetAllWorkCenterInputAvailable is false by default');
SELECT tt.eq(public.timesheet_only_current_month(), true, 'timesheetOnlyCurrentMonthInputEnabled is true by default');
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"timesheetAllWorkCenterInputAvailable": true, "timesheetOnlyCurrentMonthInputEnabled": false}' WHERE "rowGUID" = public.organization_of_user('11111111-1111-1111-1111-111111111111');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.timesheet_all_work_centers(), true, 'the Organization value is the default of the user');
SELECT tt.eq(public.timesheet_only_current_month(), false, '... also the second switch');
SELECT tt.as_admin();
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"timesheetAllWorkCenterInputAvailable": false}' WHERE lower("rowJSON"->>'personEmail') = 'anna@acme.test';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.timesheet_all_work_centers(), false, 'the value of the Person wins over the Organization');
SELECT tt.eq(public.timesheet_only_current_month(), false, '... a Person without a value still follows the Organization');
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" - 'timesheetAllWorkCenterInputAvailable' - 'timesheetOnlyCurrentMonthInputEnabled' WHERE "rowGUID" = public.organization_of_user('11111111-1111-1111-1111-111111111111');
UPDATE public."personTable" SET "rowJSON" = "rowJSON" - 'timesheetAllWorkCenterInputAvailable' WHERE lower("rowJSON"->>'personEmail') = 'anna@acme.test';

-- 2. "Create work center" --------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.timesheet_my_work_center(), NULL::text, 'a new user has a Person and no work center');
SELECT tt.eq(public.timesheet_create_my_work_center()->>'status', 'needsBusinessUnit', 'no business unit known: the screen must ask for one');
SELECT public.timesheet_create_my_work_center(:'bu1')->>'workCenter' AS wc_anna \gset
SELECT tt.eq((SELECT "rowJSON"->>'workCenterKind' FROM public."workCenterTable" WHERE "rowGUID" = :'wc_anna'), 'person', 'the work center is of kind Person');
SELECT tt.eq((SELECT "rowJSON"->>'workCenterBase' = public.timesheet_user_person() FROM public."workCenterTable" WHERE "rowGUID" = :'wc_anna'), true, '... and its base is the Person of the user');
SELECT tt.eq(public.timesheet_my_work_center(), :'wc_anna', 'it is the work center of the user now');
SELECT tt.eq(public.timesheet_create_my_work_center(:'bu1')->>'status', 'exists', 'a second one is not made');
SELECT tt.as_admin();
INSERT INTO public."workCenterTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('wc-marko', :'bu1', '{"workCenterKind":"person","workCenterBase":"p-marko"}');
INSERT INTO public."equipmentTable" ("rowGUID", "rowJSON") VALUES ('e-crane', '{"equipmentTitle":"Crane"}');
INSERT INTO public."workCenterTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('wc-crane', :'bu1', '{"workCenterKind":"equipment","workCenterBase":"e-crane"}');

-- 3. the sheet: header ----------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.timesheet_create() AS d1 \gset
SELECT tt.eq((SELECT "timesheetWorkCenter" FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), :'wc_anna', 'a new sheet gets the work center of the user');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'documentNumber' ~ '^TS-[0-9]{5}$' FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), true, 'document numbers TS-nnnnn');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'documentStatus' FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), 'draft', 'a draft');
SELECT tt.eq((SELECT "rowOrganizationGUID" FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), public.organization_of_current_user(), 'the organization is the one of the user');
SELECT tt.eq((SELECT ("startDate" = date_trunc('month', now())::date AND "finishDate" = (date_trunc('month', now()) + interval '1 month - 1 day')::date) FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), true, 'the period is the current month');
SELECT tt.fails($q$INSERT INTO public.project_timesheet_header ("startDate", "finishDate", "rowOrganizationGUID") VALUES (now()::date, now()::date, 'x')$q$, 'permission denied', 'a user cannot write a header (only the RPCs)');
SELECT tt.fails(format($q$SELECT public.timesheet_set_header(%L, '{"timesheetWorkCenter": "wc-marko"}')$q$, :'d1'), 'not allowed for you', 'switch off: only the own Person work center');
SELECT tt.fails(format($q$SELECT public.timesheet_set_header(%L, '{"timesheetWorkCenter": "wc-crane"}')$q$, :'d1'), 'not allowed for you', '... also not an equipment');
SELECT tt.fails(format($q$SELECT public.timesheet_set_header(%L, jsonb_build_object('startDate', (now() - interval '40 days')::date))$q$, :'d1'), 'inside the current month', 'switch on (default): a period outside the current month is refused');
SELECT tt.fails(format($q$SELECT public.timesheet_set_header(%L, jsonb_build_object('startDate', (now())::date, 'finishDate', (now() - interval '1 day')::date))$q$, :'d1'), 'project_timesheet_header_dates_chk', 'the finish date before the start date is refused');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_header), 0::bigint, 'another organization sees no sheet of anna');
SELECT tt.fails(format($q$SELECT public.timesheet_set_header(%L, '{}')$q$, :'d1'), 'does not exist', 'marko cannot change anna''s sheet');
SELECT tt.as_admin();
-- the switches
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"timesheetAllWorkCenterInputAvailable": true, "timesheetOnlyCurrentMonthInputEnabled": false}' WHERE lower("rowJSON"->>'personEmail') = 'anna@acme.test';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.timesheet_set_header(:'d1', '{"timesheetWorkCenter": "wc-crane"}');
SELECT tt.eq((SELECT "timesheetWorkCenter" FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), 'wc-crane', 'switch on: any work center');
SELECT public.timesheet_set_header(:'d1', jsonb_build_object('timesheetWorkCenter', :'wc_anna', 'startDate', (now() - interval '40 days')::date, 'finishDate', (now() - interval '10 days')::date));
SELECT tt.eq((SELECT "finishDate" - "startDate" + 1 FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), 31, 'month switch off: any period (31 days)');
SELECT tt.fails(format($q$SELECT public.timesheet_set_header(%L, jsonb_build_object('startDate', (now() - interval '100 days')::date, 'finishDate', (now() - interval '37 days')::date))$q$, :'d1'), 'at most 62 days', 'a period of 64 days is refused');
SELECT public.timesheet_set_header(:'d1', jsonb_build_object('startDate', (now() - interval '40 days')::date, 'finishDate', (now() - interval '40 days' + interval '61 days')::date));
SELECT tt.eq((SELECT "finishDate" - "startDate" + 1 FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), 62, '62 days are fine');
SELECT tt.as_admin();
UPDATE public."personTable" SET "rowJSON" = "rowJSON" - 'timesheetAllWorkCenterInputAvailable' - 'timesheetOnlyCurrentMonthInputEnabled' WHERE lower("rowJSON"->>'personEmail') = 'anna@acme.test';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.timesheet_set_header(:'d1', jsonb_build_object('startDate', date_trunc('month', now())::date, 'finishDate', (date_trunc('month', now()) + interval '1 month - 1 day')::date));

-- 4. the lines: project -> task -> role -> budget item -> business unit; the cost of an hour from the Time line of the task ------------------------------------------------------
SELECT tt.as_admin();
INSERT INTO public.task_line_table ("rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
VALUES ('dddddddd-0000-0000-0000-000000000011', :'p1', :'t3', 'timeGenus', 1,
        jsonb_build_object('taskResourceKind', 'workCenter', 'taskResourceItem', :'wc_anna', 'resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 10,
                           'sumForBudget', 1000, 'sumForContract', 900, 'sumForAccounting', 950, 'budgetItemTaskLine', :'bi1', 'businessUnitTaskLine', :'bu1'));
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT array_agg(x) FROM public.timesheet_possible_roles(:'t3', :'wc_anna') x), ARRAY[:'role1']::text[], 'a task WITH a Time line offers the roles of its Time lines');
SELECT tt.eq((SELECT count(*) > 1 FROM public.timesheet_possible_roles(:'t4', :'wc_anna')), true, 'a task with NO Time line offers all the Time roles of the kind');
SELECT tt.eq((SELECT array_agg(x) FROM public.timesheet_possible_budget_items(:'t3', :'role1') x), ARRAY[:'bi1']::text[], 'budget items: those of the Time lines with that role');
SELECT tt.eq((SELECT count(*) > 1 FROM public.timesheet_possible_budget_items(:'t4', :'role1')), true, '... no Time line: the Time budget items of the catalog');
SELECT tt.eq((SELECT array_agg(x) FROM public.timesheet_possible_business_units(:'t3', :'wc_anna') x), ARRAY[:'bu1']::text[], 'business units: only those of the task lines that book the work center');
SELECT tt.eq((SELECT count(*) FROM public.timesheet_possible_business_units(:'t4', :'wc_anna')), 0::bigint, '... no such task line: none (the unit of the work center counts)');

SELECT public.timesheet_add_line(:'d1') AS l0 \gset
SELECT tt.eq((SELECT "timesheetLineHours" FROM public.project_timesheet_lines WHERE "rowGUID" = :'l0'), 0::numeric, 'a new line has no hours');
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_lines_data_entered WHERE "rowHeaderGUID" = :'d1'), 0::bigint, '... and the sheet has no entered row at the start');
SELECT tt.fails(format($q$SELECT public.timesheet_set_line(%L, jsonb_build_object('timesheetLineTask', %L))$q$, :'l0', :'t3'), 'choose the project before the task', 'the task needs the project first');
SELECT tt.fails(format($q$SELECT public.timesheet_set_line(%L, jsonb_build_object('timesheetLineProject', %L, 'timesheetLineTask', %L))$q$, :'l0', :'p1', :'tstage'), 'only a normal task', 'a stage is refused');
SELECT tt.fails(format($q$SELECT public.timesheet_set_line(%L, jsonb_build_object('timesheetLineProject', %L, 'timesheetLineTask', %L))$q$, :'l0', :'p1', :'tmarko'), 'not a task of the project', 'a task of another project is refused');
SELECT tt.as_admin();
SELECT "projectGUID" AS pmarko FROM public.project_task_table WHERE "rowGUID" = :'tmarko' \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails(format($q$SELECT public.timesheet_set_line(%L, jsonb_build_object('timesheetLineProject', %L, 'timesheetLineTask', %L))$q$, :'l0', :'pmarko', :'tmarko'), 'not a project of your organization', 'a project of another organization is refused');
SELECT public.timesheet_set_line(:'l0', jsonb_build_object('timesheetLineProject', :'p1', 'timesheetLineTask', :'t3'));
SELECT tt.fails(format($q$SELECT public.timesheet_set_line(%L, jsonb_build_object('timesheetLineRole', %L))$q$, :'l0', :'role2'), 'role is not possible', 'a role the task does not offer is refused (its Time line has another role)');
SELECT public.timesheet_set_line(:'l0', jsonb_build_object('timesheetLineRole', :'role1'));
SELECT tt.eq((SELECT ("unitSumForBudget", "unitSumForContract", "unitSumForAccounting")::text FROM public.project_timesheet_lines WHERE "rowGUID" = :'l0'), '(100.000000,90.000000,95.000000)', 'the cost of an hour = the unit sums of the Time line of the task');
SELECT tt.fails(format($q$SELECT public.timesheet_set_line(%L, jsonb_build_object('timesheetLineBudgetItem', %L))$q$, :'l0', :'bi2'), 'budget item is not possible', 'another budget item is refused');
SELECT tt.fails(format($q$SELECT public.timesheet_set_line(%L, jsonb_build_object('timesheetLineBusinessUnit', %L))$q$, :'l0', :'bu2'), 'business unit can only be', 'another business unit is refused');
SELECT public.timesheet_set_line(:'l0', jsonb_build_object('timesheetLineBudgetItem', :'bi1', 'timesheetLineBusinessUnit', :'bu1'));
SELECT public.timesheet_set_line(:'l0', jsonb_build_object('timesheetLineTask', :'t4'));
SELECT tt.eq((SELECT ("timesheetLineRole" IS NULL AND "timesheetLineBudgetItem" IS NULL AND "timesheetLineBusinessUnit" IS NULL AND "unitSumForBudget" IS NULL) FROM public.project_timesheet_lines WHERE "rowGUID" = :'l0'), true, 'a changed task clears the role, the budget item, the business unit and the rate');
SELECT tt.fails(format($q$SELECT public.timesheet_set_line(%L, jsonb_build_object('timesheetLineBusinessUnit', %L))$q$, :'l0', :'bu1'), 'business unit can only be', 'task t4 has no task line that books the work center: no business unit');
SELECT public.timesheet_set_line(:'l0', jsonb_build_object('timesheetLineProject', :'p1', 'timesheetLineTask', :'t3', 'timesheetLineRole', :'role1', 'timesheetLineBudgetItem', :'bi1', 'timesheetLineBusinessUnit', :'bu1'));
SELECT tt.fails(format($q$SELECT public.timesheet_add_line(%L, jsonb_build_object('timesheetLineProject', %L, 'timesheetLineTask', %L, 'timesheetLineRole', %L, 'timesheetLineBudgetItem', %L, 'timesheetLineBusinessUnit', %L))$q$, :'d1', :'p1', :'t3', :'role1', :'bi1', :'bu1'), 'idx_project_timesheet_lines_key', 'the same project + task + role + budget item + business unit twice is refused');
SELECT public.timesheet_add_line(:'d1', jsonb_build_object('timesheetLineProject', :'p1', 'timesheetLineTask', :'t4')) AS l2 \gset

-- 5. the entered hours: empty at the start, only entered cells are rows -----------------------------------------------------------------------------------------------------------
SELECT (date_trunc('month', now())::date + 2) AS day1 \gset
SELECT (date_trunc('month', now())::date + 3) AS day2 \gset
SELECT (date_trunc('month', now())::date + 4) AS day3 \gset
SELECT public.timesheet_set_hours(:'l0', :'day1'::date, 8);
SELECT tt.eq((SELECT "timesheetHours" FROM public.project_timesheet_lines_data_entered WHERE "rowLineGUID" = :'l0' AND "timesheetDay" = :'day1'), 8::numeric, 'an entered cell is a row of project_timesheet_lines_data_entered');
SELECT tt.eq((SELECT "timesheetLineHours" FROM public.project_timesheet_lines WHERE "rowGUID" = :'l0'), 8::numeric, 'the total of the line follows');
SELECT public.timesheet_set_hours(:'l0', :'day1'::date, 6.5);
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_lines_data_entered WHERE "rowLineGUID" = :'l0'), 1::bigint, 'the same cell again: updated, not a second row');
SELECT tt.eq((SELECT "timesheetLineHours" FROM public.project_timesheet_lines WHERE "rowGUID" = :'l0'), 6.5, '... total 6.5');
SELECT public.timesheet_set_hours(:'l0', :'day2'::date, 0);
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_lines_data_entered WHERE "rowLineGUID" = :'l0' AND "timesheetDay" = :'day2'), 0::bigint, 'a typed 0 saves no row');
SELECT public.timesheet_set_hours(:'l0', :'day1'::date, NULL);
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_lines_data_entered WHERE "rowLineGUID" = :'l0'), 0::bigint, 'a cleared cell removes the row');
SELECT tt.eq((SELECT "timesheetLineHours" FROM public.project_timesheet_lines WHERE "rowGUID" = :'l0'), 0::numeric, '... total 0');
SELECT tt.fails(format($q$SELECT public.timesheet_set_hours(%L, %L::date, 25)$q$, :'l0', :'day1'), 'more than 24 hours', 'more than 24 hours in a cell is refused');
SELECT tt.fails(format($q$SELECT public.timesheet_set_hours(%L, (now() + interval '80 days')::date, 1)$q$, :'l0'), 'outside the period', 'a day outside the period is refused');
SELECT public.timesheet_set_hours(:'l0', :'day1'::date, 16);
SELECT tt.fails(format($q$SELECT public.timesheet_set_hours(%L, %L::date, 9)$q$, :'l2', :'day1'), 'more than 24 hours', 'the hours of one day over the lines of a sheet are at most 24');
SELECT public.timesheet_set_hours(:'l2', :'day1'::date, 8);
SELECT public.timesheet_set_hours(:'l0', :'day2'::date, 4);
SELECT public.timesheet_set_hours(:'l0', :'day3'::date, 2);
-- moving the finish date drops the days outside
SELECT public.timesheet_set_header(:'d1', jsonb_build_object('finishDate', :'day2'::date));
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_lines_data_entered WHERE "rowHeaderGUID" = :'d1'), 3::bigint, 'a shorter period drops the entered hours of the days that are gone (day3)');
SELECT tt.eq((SELECT "timesheetLineHours" FROM public.project_timesheet_lines WHERE "rowGUID" = :'l0'), 20::numeric, '... and the total follows (16 + 4)');
SELECT public.timesheet_set_header(:'d1', jsonb_build_object('finishDate', (date_trunc('month', now()) + interval '1 month - 1 day')::date));

-- 6. Post --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT public.post_timesheet(:'d1') AS r1 \gset
SELECT tt.eq(:'r1'::jsonb->>'status', 'refused', 'Post is refused: line 2 has hours but no role');
SELECT tt.eq((SELECT count(*) FROM jsonb_array_elements(:'r1'::jsonb->'problems') p WHERE p->>'problem' = 'roleMissing' AND p->>'lineGUID' = :'l2'), 1::bigint, '... the problem names the line');
SELECT public.timesheet_set_line(:'l2', jsonb_build_object('timesheetLineRole', :'role1', 'timesheetLineBudgetItem', :'bi1'));
SELECT public.post_timesheet(:'d1') AS r2 \gset
SELECT tt.eq((SELECT count(*) FROM jsonb_array_elements(:'r2'::jsonb->'problems') p WHERE p->>'problem' = 'noContractRate' AND p->>'lineGUID' = :'l2' AND p->>'day' = :'day1'), 1::bigint, 'no Time line of the task, no contract of the person, no role rate: Post is refused and names the line AND the day (the money of the cost: tests/94)');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1'), 0::bigint, 'nothing was written');
-- give task t4 a Time line of the same role (the plan) -> the rate (200 an hour) is found at Post, also for a line filled before
SELECT tt.as_admin();
INSERT INTO public.task_line_table ("rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
VALUES ('dddddddd-0000-0000-0000-000000000012', :'p1', :'t4', 'timeGenus', 1,
        jsonb_build_object('taskResourceKind', 'workCenter', 'taskResourceItem', :'wc_anna', 'resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 5, 'sumForBudget', 1000, 'sumForContract', 1000, 'sumForAccounting', 1000, 'budgetItemTaskLine', :'bi1'));
DELETE FROM public.monitor01_dirty;
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.post_timesheet(:'d1') AS r3 \gset
SELECT tt.eq(:'r3'::jsonb->>'status', 'posted', 'Post: the rate is read again now and the sheet is posted');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'documentStatus' FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), 'posted', 'the sheet is posted');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1' AND "rowMovementKind" = 'used' AND "rowRegistratorType" = 'timesheetHeader'), 3::bigint, 'one used movement for every ENTERED cell (2 on line 1 + 1 on line 2; the cell of the day that was cut off is gone)');
SELECT tt.eq((SELECT sum("qtyProjectStatus") FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1'), 28::numeric, 'the quantity is the entered hours (16 + 4 + 8)');
SELECT tt.eq((SELECT ("qtyProjectStatus", "sumForBudget", "sumForContract", "sumForAccounting", "resourceRoleGUID", "measureUnit", "genusGUID", "businessUnitGUID")::text FROM public.project_status_movements
               WHERE "rowRegistratorGUID" = :'d1' AND "rowOwnerGUID" = :'t3' AND "rowTurnoverDay" = :'day1'::date),
             '(16.00,1600.00,1440.00,1520.00,' || :'role1' || ',unit_hour,timeGenus,' || :'bu1' || ')', 'a movement: hours x the rate of an hour in the three moneys, role, unit hour, the genus Time, the business unit of the line');
SELECT tt.eq((SELECT "businessUnitGUID" FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1' AND "rowOwnerGUID" = :'t4' LIMIT 1), (SELECT "rowJSON"->>'businessUnit' FROM public."workCenterTable" WHERE "rowGUID" = :'wc_anna'), 'a line without its own business unit takes that of the work center');
SELECT tt.eq((SELECT "rowJSON"->>'ownCost' FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1' LIMIT 1), 'true', 'the hours of a Person work center are own cost (never invoiced)');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty WHERE "rowOwnerGUID" IN (:'t3'::uuid, :'t4'::uuid)), 2::bigint, 'the tasks are queued for Monitor01');
SELECT public.monitor01_sum_sources('used', jsonb_build_object('taskGUID', :'t3')) AS s1 \gset
SELECT tt.eq((:'s1'::jsonb->>'totalCount')::int, 2, 'Monitor01: the source rows of Used list the entered hours of the posted sheet');
SELECT tt.eq((:'s1'::jsonb->>'sum')::numeric, 20::numeric, '... their sum is 16 + 4 hours');
SELECT tt.eq(:'s1'::jsonb->'rows'->0->>'sourceName', 'projectTimesheetLinesDataEntered', '... named by their source table');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails(format($q$SELECT public.timesheet_set_hours(%L, %L::date, 1)$q$, :'l0', :'day3'), 'POSTED', 'a posted sheet: no hours can be entered');
SELECT tt.fails(format($q$SELECT public.timesheet_set_header(%L, '{"startDate": "2020-01-01"}')$q$, :'d1'), 'POSTED', 'a posted sheet: the header is frozen');
SELECT tt.fails(format($q$SELECT public.timesheet_delete(%L)$q$, :'d1'), 'POSTED', 'a posted sheet cannot be deleted');
DELETE FROM public.project_timesheet_header WHERE "rowGUID" = :'d1';
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_header WHERE "rowGUID" = :'d1'), 1::bigint, '... also not directly (the policy)');
SELECT tt.eq(public.post_timesheet(:'d1')->>'status', 'refused', 'Post of a posted sheet is refused');

-- 7. never more than 24 hours a day for a work center: this sheet + the other POSTED sheets -------------------------------------------------------------------------------------
SELECT public.timesheet_create() AS d2 \gset
SELECT public.timesheet_add_line(:'d2', jsonb_build_object('timesheetLineProject', :'p1', 'timesheetLineTask', :'t3', 'timesheetLineRole', :'role1', 'timesheetLineBudgetItem', :'bi1')) AS l3 \gset
SELECT public.timesheet_set_hours(:'l3', :'day1'::date, 10);
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_header WHERE "timesheetWorkCenter" = :'wc_anna'), 2::bigint, 'two sheets of the same work center with the same period: allowed');
SELECT public.post_timesheet(:'d2') AS r4 \gset
SELECT tt.eq(:'r4'::jsonb->>'status', 'refused', 'day1 already has 24 posted hours: 10 more are refused');
SELECT tt.eq((SELECT p->>'problem' FROM jsonb_array_elements(:'r4'::jsonb->'problems') p LIMIT 1), 'dayOver24', '... dayOver24');
SELECT tt.eq((SELECT p->>'day' FROM jsonb_array_elements(:'r4'::jsonb->'problems') p LIMIT 1), :'day1', '... it names the day');
SELECT tt.eq((SELECT p->>'otherSheet' FROM jsonb_array_elements(:'r4'::jsonb->'problems') p LIMIT 1) ~ '^TS-', true, '... and the other sheet');
SELECT public.timesheet_set_hours(:'l3', :'day1'::date, NULL);
SELECT public.timesheet_set_hours(:'l3', :'day2'::date, 3);
SELECT tt.eq(public.post_timesheet(:'d2')->>'status', 'posted', 'on another day the second sheet is posted (overlapping periods are allowed)');

-- 8. Unpost ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.unpost_timesheet(:'d2')->>'status', 'draft', 'Unpost');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d2'), 0::bigint, 'the movements are taken back');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.timesheet_set_hours(:'l3', :'day2'::date, 2);
SELECT tt.eq((SELECT "timesheetHours" FROM public.project_timesheet_lines_data_entered WHERE "rowLineGUID" = :'l3' AND "timesheetDay" = :'day2'), 2::numeric, 'an unposted sheet can be corrected');
SELECT tt.eq(public.unpost_timesheet(:'d1')->>'status', 'draft', 'the first sheet is unposted too');
SELECT public.timesheet_delete(:'d2');
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_lines_data_entered WHERE "rowHeaderGUID" = :'d2'), 0::bigint, 'a draft is deleted with its lines and its entered hours');

-- 8b. the context menu of a line: add above / below, move up / down / first / last, duplicate --------------------------------------------------------------------------------------------------
SELECT public.timesheet_create() AS d9 \gset
SELECT public.timesheet_add_line(:'d9') AS m1 \gset
SELECT public.timesheet_insert_line(:'d9', :'m1', false) AS m2 \gset
SELECT public.timesheet_insert_line(:'d9', :'m1', true) AS m0 \gset
SELECT public.timesheet_insert_line(:'d9', :'m2', false, jsonb_build_object('timesheetLineProject', :'p1', 'timesheetLineTask', :'t3')) AS m3 \gset
SELECT tt.eq((SELECT string_agg(l."rowGUID"::text, ',' ORDER BY l."orderInList") FROM public.project_timesheet_lines l WHERE l."rowHeaderGUID" = :'d9'), :'m0' || ',' || :'m1' || ',' || :'m2' || ',' || :'m3', 'add above / below: the new lines stand next to their reference');
SELECT tt.eq((SELECT ("timesheetLineProject", "timesheetLineTask")::text FROM public.project_timesheet_lines WHERE "rowGUID" = :'m3'), '(' || :'p1' || ',' || :'t3' || ')', 'Duplicate: the new line starts with the project and the task');
SELECT public.timesheet_move_line(:'m3', 'up');
SELECT tt.eq((SELECT string_agg(l."rowGUID"::text, ',' ORDER BY l."orderInList") FROM public.project_timesheet_lines l WHERE l."rowHeaderGUID" = :'d9'), :'m0' || ',' || :'m1' || ',' || :'m3' || ',' || :'m2', 'move up swaps with the neighbour');
SELECT public.timesheet_move_line(:'m0', 'down');
SELECT tt.eq((SELECT string_agg(l."rowGUID"::text, ',' ORDER BY l."orderInList") FROM public.project_timesheet_lines l WHERE l."rowHeaderGUID" = :'d9'), :'m1' || ',' || :'m0' || ',' || :'m3' || ',' || :'m2', 'move down');
SELECT public.timesheet_move_line(:'m2', 'first');
SELECT tt.eq((SELECT (array_agg(l."rowGUID"::text ORDER BY l."orderInList"))[1] FROM public.project_timesheet_lines l WHERE l."rowHeaderGUID" = :'d9'), :'m2'::text, 'make first');
SELECT public.timesheet_move_line(:'m2', 'last');
SELECT tt.eq((SELECT (array_agg(l."rowGUID"::text ORDER BY l."orderInList"))[4] FROM public.project_timesheet_lines l WHERE l."rowHeaderGUID" = :'d9'), :'m2'::text, 'make last');
SELECT public.timesheet_move_line(:'m1', 'up');
SELECT tt.eq((SELECT (array_agg(l."rowGUID"::text ORDER BY l."orderInList"))[1] FROM public.project_timesheet_lines l WHERE l."rowHeaderGUID" = :'d9'), :'m1'::text, 'a line that is already first stays first');
SELECT tt.fails(format($q$SELECT public.timesheet_move_line(%L, 'sideways')$q$, :'m1'), 'unknown move', 'an unknown move is refused');
SELECT tt.fails(format($q$SELECT public.timesheet_insert_line(%L, %L, true)$q$, :'d1', :'m1'), 'does not exist', 'a reference line of another sheet is refused');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.timesheet_move_line(%L, 'up')$q$, :'m1'), 'does not exist', 'another organization cannot move the lines');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.timesheet_delete(:'d9');

-- 9. Create based on / the list ---------------------------------------------------------------------------------------------------------------------------------------------------
SELECT public.create_timesheet_from_task(:'t3') AS c1 \gset
SELECT tt.eq(:'c1'::jsonb->>'status', 'created', 'Create based on: a new draft');
SELECT (:'c1'::jsonb->>'documentGUID')::uuid AS d3 \gset
SELECT tt.eq((SELECT ("timesheetLineProject", "timesheetLineTask", "timesheetLineRole", "timesheetLineBudgetItem", "timesheetLineBusinessUnit")::text FROM public.project_timesheet_lines WHERE "rowHeaderGUID" = :'d3'),
             '(' || :'p1' || ',' || :'t3' || ',' || :'role1' || ',' || :'bi1' || ',' || :'bu1' || ')', 'one line: the project and the task; role, budget item and business unit where there is exactly one choice');
SELECT tt.eq((SELECT "timesheetWorkCenter" FROM public.project_timesheet_header WHERE "rowGUID" = :'d3'), :'wc_anna', '... for the work center of the user');
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_lines_data_entered WHERE "rowHeaderGUID" = :'d3'), 0::bigint, '... with no hours');
SELECT tt.eq(public.create_timesheet_from_task(:'t3')->>'status', 'created', 'again: ALWAYS a new draft');
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_header WHERE "rowJSON"->'documentHeader'->>'documentStatus' = 'draft'), 3::bigint, '... three drafts in all (the unposted first sheet, and the two made from the task)');
-- from the LINE menu of a Time line: filled as far as the line allows (work center, role, budget item, business unit); the hours stay empty
SELECT public.create_timesheet_from_task(:'t3', 'dddddddd-0000-0000-0000-000000000011') AS cl \gset
SELECT (:'cl'::jsonb->>'documentGUID')::uuid AS d4 \gset
SELECT tt.eq((SELECT h."timesheetWorkCenter" FROM public.project_timesheet_header h WHERE h."rowGUID" = :'d4'), :'wc_anna', 'from a line: the work center the line books');
SELECT tt.eq((SELECT ("timesheetLineProject", "timesheetLineTask", "timesheetLineRole", "timesheetLineBudgetItem", "timesheetLineBusinessUnit")::text FROM public.project_timesheet_lines WHERE "rowHeaderGUID" = :'d4'),
             '(' || :'p1' || ',' || :'t3' || ',' || :'role1' || ',' || :'bi1' || ',' || :'bu1' || ')', 'from a line: project, task, role, budget item and business unit of THAT line');
SELECT tt.eq((SELECT count(*) FROM public.project_timesheet_lines_data_entered WHERE "rowHeaderGUID" = :'d4'), 0::bigint, 'from a line: the hours are empty (they are facts)');
-- a line that books ANOTHER work center: the user's own is used while the switch is off, the line's when it is on
SELECT tt.as_admin();
INSERT INTO public.task_line_table ("rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
VALUES ('dddddddd-0000-0000-0000-000000000013', :'p1', :'t3', 'timeGenus', 3, jsonb_build_object('taskResourceKind', 'workCenter', 'taskResourceItem', 'wc-crane', 'resourceRoleItem', 'eqr_crane', 'measureUnitTaskLine', 'unit_hour', 'budgetItemTaskLine', :'bi1'));
INSERT INTO public.task_line_table ("rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
VALUES ('dddddddd-0000-0000-0000-000000000014', :'p1', :'t3', 'timeGenus', 4, jsonb_build_object('taskResourceKind', 'equipment', 'taskResourceItem', 'e-crane', 'resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_hour'));
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT (public.create_timesheet_from_task(:'t3', 'dddddddd-0000-0000-0000-000000000013')->>'workCenter') AS w1 \gset
SELECT tt.eq(:'w1'::text, 'wc-crane'::text, 'switch off: a line of ANOTHER work center still gives a sheet of THAT work center (the user chose the line)');
SELECT (public.create_timesheet_from_task(:'t3', 'dddddddd-0000-0000-0000-000000000013')->>'documentGUID')::uuid AS d5 \gset
SELECT tt.eq((SELECT ("timesheetLineRole", "timesheetLineBudgetItem")::text FROM public.project_timesheet_lines WHERE "rowHeaderGUID" = :'d5'), '(eqr_crane,' || :'bi1' || ')', '... with the role and budget item of that line');
SELECT tt.fails(format($q$SELECT public.timesheet_set_header(%L, '{"timesheetWorkCenter": "wc-marko"}')$q$, :'d5'), 'not allowed for you', 'the exception is only for THAT work center: another one is refused as before');
SELECT public.timesheet_set_header(:'d5', jsonb_build_object('timesheetWorkCenter', :'wc_anna'));
SELECT public.timesheet_set_header(:'d5', '{"timesheetWorkCenter": "wc-crane"}');
SELECT tt.eq((SELECT "timesheetWorkCenter" FROM public.project_timesheet_header WHERE "rowGUID" = :'d5'), 'wc-crane', 'the user may change it to his own and back to the work center of the line');
SELECT tt.as_admin();
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"timesheetAllWorkCenterInputAvailable": true}' WHERE lower("rowJSON"->>'personEmail') = 'anna@acme.test';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT (public.create_timesheet_from_task(:'t3', 'dddddddd-0000-0000-0000-000000000013')->>'workCenter') AS w2 \gset
SELECT tt.eq(:'w2'::text, 'wc-crane'::text, 'switch on: the work center of the line');
SELECT (public.create_timesheet_from_task(:'t3', 'dddddddd-0000-0000-0000-000000000014')->>'workCenter') AS w3 \gset
SELECT tt.eq(:'w3'::text, 'wc-crane'::text, 'an old equipment line (no work center): the work center whose base is that equipment');
SELECT tt.as_admin();
UPDATE public."personTable" SET "rowJSON" = "rowJSON" - 'timesheetAllWorkCenterInputAvailable' WHERE lower("rowJSON"->>'personEmail') = 'anna@acme.test';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
-- the Time line is the BASE of the sheet line: role, budget item, business unit and cost are taken AS THEY ARE (a role that is not "possible" for the work center, a line with no work center)
SELECT tt.as_admin();
INSERT INTO public."personTable" ("rowGUID","rowJSON") VALUES ('p-boris', '{"personFirstName":"Boris","personLastName":"M"}');
INSERT INTO public.task_line_table ("rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
VALUES ('dddddddd-0000-0000-0000-000000000015', :'p1', :'t3', 'timeGenus', 5, jsonb_build_object('taskResourceKind', 'person', 'taskResourceItem', 'p-boris', 'resourceRoleItem', 'eqr_crane', 'budgetItemTaskLine', :'bi2', 'businessUnitTaskLine', :'bu2',
        'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 4, 'sumForBudget', 400, 'sumForContract', 400, 'sumForAccounting', 400));
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT (public.create_timesheet_from_task(:'t3', 'dddddddd-0000-0000-0000-000000000015')->>'documentGUID')::uuid AS d6 \gset
SELECT tt.eq((SELECT ("timesheetLineRole", "timesheetLineBudgetItem", "timesheetLineBusinessUnit")::text FROM public.project_timesheet_lines WHERE "rowHeaderGUID" = :'d6'), '(eqr_crane,' || :'bi2' || ',' || :'bu2' || ')',
             'from a line: role, budget item and business unit are taken from the ORIGINAL task line as they are (the role is not possible for the work center, the line has no work center)');
SELECT tt.eq((SELECT "timesheetBaseTaskLine"::text FROM public.project_timesheet_lines WHERE "rowHeaderGUID" = :'d6'), 'dddddddd-0000-0000-0000-000000000015', '... the task line is the base of the sheet line');
SELECT tt.eq((SELECT ("rateSource", "unitSumForBudget")::text FROM public.project_timesheet_lines WHERE "rowHeaderGUID" = :'d6'), '(taskLine,100.000000)', '... and its numbers are the cost of an hour');
SELECT "rowGUID" AS l6 FROM public.project_timesheet_lines WHERE "rowHeaderGUID" = :'d6' \gset
SELECT tt.fails(format($q$SELECT public.timesheet_set_line(%L, jsonb_build_object('timesheetLineRole', %L))$q$, :'l6', :'role2'), 'role is not possible', 'another role is checked as usual');
SELECT public.timesheet_set_line(:'l6', jsonb_build_object('timesheetLineTask', :'t4'));
SELECT tt.eq((SELECT ("timesheetBaseTaskLine" IS NULL AND "timesheetLineRole" IS NULL AND "timesheetLineBudgetItem" IS NULL)::text FROM public.project_timesheet_lines WHERE "rowGUID" = :'l6'), 'true', 'another task: the base and what came from it go');
SELECT (public.create_timesheet_from_task(:'t3', 'dddddddd-0000-0000-0000-000000000015')) ->>'documentGUID' AS d7_text \gset
SELECT tt.as_admin();
UPDATE public.project_timesheet_header SET "timesheetWorkCenter" = 'wc-marko' WHERE "rowGUID" = :'d7_text'::uuid;
SELECT tt.eq((SELECT "timesheetLineRole" FROM public.project_timesheet_lines WHERE "rowHeaderGUID" = :'d7_text'::uuid), 'eqr_crane', 'a changed work center keeps what came from the base task line');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.create_timesheet_from_task(:'tstage')->'skipped'->0->>'reason', 'taskNotNormal', 'a stage: skipped');
SELECT tt.eq(public.create_timesheet_from_task(:'tmarko')->'skipped'->0->>'reason', 'taskNotFound', 'a task of another organization: skipped');
SELECT tt.eq(jsonb_array_length(public.timesheet_list(jsonb_build_object('taskGUID', :'t3'))), 9, 'the list filtered by the task: the sheets that have a line of it');
SELECT tt.eq(jsonb_array_length(public.timesheet_list(jsonb_build_object('taskGUID', :'tstage'))), 0, '... another task: none');
SELECT tt.eq(public.timesheet_list(jsonb_build_object('timesheetWorkCenter', :'wc_anna', 'status', 'draft'))->0->>'documentStatus', 'draft', 'the list filters by work center and status');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(jsonb_array_length(public.timesheet_list()), 0, 'another organization lists nothing');
SELECT tt.as_admin();

ROLLBACK;
