-- PART 51: the READ-ONLY PROJECT (project_table.rowJSON.projectIsReadonly). While it is true a signed-in user changes ONLY the switch: no create / change / delete of the project,
-- its tasks, links, lines, Kanban, documents; the SQL editor / the workers (no session) pass. Off again: everything works as before.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
DELETE FROM public.monitor01_dirty;
SELECT p."rowGUID" AS p1 FROM public.project_table p WHERE p."rowJSON"->>'name' = 'Project 1' \gset
SELECT p."rowGUID" AS p2 FROM public.project_table p WHERE p."rowJSON"->>'name' = 'Project 2' \gset
SELECT t."rowGUID" AS t1 FROM public.project_task_table t WHERE t."projectGUID" = :'p1' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT t."rowGUID" AS t2 FROM public.project_task_table t WHERE t."projectGUID" = :'p1' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT t."rowGUID" AS t3 FROM public.project_task_table t WHERE t."projectGUID" = :'p1' AND t."rowJSON"->>'taskDescription' = 'Task 113' \gset
SELECT t."rowGUID" AS s1 FROM public.project_task_table t WHERE t."projectGUID" = :'p1' AND t."rowJSON"->>'taskDescription' = 'Stage 1' \gset
SELECT t."rowGUID" AS o1 FROM public.project_task_table t WHERE t."projectGUID" = :'p2' AND t."rowJSON"->>'taskDescription' = 'Task 211' \gset
SELECT r."rowGUID" AS role1 FROM public."resourceRoleTable" r ORDER BY r."rowGUID" LIMIT 1 \gset
INSERT INTO public."legalEntityTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('le-1', 'empty', '{"title": "Acme SIA", "isActive": true}');
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES ('vp-1', '{"partnerTitle": "Acme Supplies", "partnerKind": "company", "isActive": true, "partnerIsSupplier": true}');
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('vc-1', 'vp-1', 'partner', '{"contractPartyType": "partner", "contractNumber": "S-1", "contractTitle": "Supply", "contractCurrency": "EUR", "contractSumBeforeVAT": 0, "legalEntityGUID": "le-1"}');

-- 0. the switch is FALSE while never saved; before it is on everything works -----------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.project_is_readonly(:'p1'), false, 'a project that never saved the switch is NOT read-only');
SELECT tt.eq((public.perm_my_matrix(:'p1')->>'projectIsReadonly')::boolean, false, 'perm_my_matrix says so too');
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000001', :'t2', 'materialGenus', 1, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 10, 'priceTaskLine', 5, 'vatRatioTaskLine', 21, 'taskLinePartnerItem', 'vp-1', 'taskLinePartnerContract', 'vc-1', 'sumForBudget', 100, 'sumForAccounting', 80));
SELECT public.vendor_invoice_candidates(:'t2') AS cand \gset
SELECT jsonb_agg(jsonb_build_object('partnerGUID', r->>'partnerGUID', 'contractGUID', r->>'contractGUID', 'lineGUIDs', r->'lineGUIDs')) AS sel FROM jsonb_array_elements(:'cand'::jsonb->'rows') r \gset
SELECT public.create_vendor_invoices(:'t2', :'sel'::jsonb) AS made \gset
SELECT h."rowGUID" AS d1 FROM public.vendor_invoice_header h LIMIT 1 \gset
SELECT public.vendor_invoice_set_header(:'d1', '{"vendorInvoiceNumber": "INV-1", "vendorInvoiceDateTime": "2026-09-15T00:00:00Z"}'::jsonb);
SELECT public.task_fact_document_create(:'t1') AS f1 \gset
SELECT count(*) FROM public.pm_kanban_ensure_project_stages(:'p1');
SELECT k."rowGUID" AS k1 FROM public.project_kanban_stage_table k WHERE k."rowOwnerGUID" = :'p1' ORDER BY k."orderInList" LIMIT 1 \gset
-- a version, a chat of a task with a message, a member, a media post of the project - all made while the project is open
SELECT public.pm_version_save(:'p1', 'v1');
SELECT v."rowVersionGUID" AS v1 FROM public.version_project_table v WHERE v."rowGUID" = :'p1' LIMIT 1 \gset
SELECT (public.chat_task_ensure(:'t1')->>'themeGUID') AS th1 \gset
SELECT gen_random_uuid()::text AS m1 \gset
SELECT tt.eq(public.chat_message_send(:'m1', :'th1', 'hello')->>'rowGUID', :'m1', 'a message in the chat of a task of the open project');
INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('mp-1', '11111111-1111-1111-1111-111111111111', :'p1', '{"mediaPostTitle": "Site photo"}');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('boris@acme.test', '33333333-3333-3333-3333-333333333333', 'Boris', 'B');
INSERT INTO public.project_permission_profile_user_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('ppu-1', :'p1', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionProjectReadOnly"}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

-- 1. turn it on ------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.project_set_readonly(:'p1', true), true, 'the owner turns the switch on');
SELECT tt.eq(public.project_is_readonly(:'p1'), true, 'the project is read-only');
SELECT tt.eq((public.perm_my_matrix(:'p1')->>'projectIsReadonly')::boolean, true, 'perm_my_matrix tells the interface');
SELECT tt.eq((public.perm_my_matrix(:'p2')->>'projectIsReadonly')::boolean, false, 'the other project is not');

-- 2. the project row: only the switch --------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"name": "Renamed"}' WHERE "rowGUID" = %L$q$, :'p1'), 'Read-only project', 'the name of a read-only project is not changed');
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"name": "Renamed", "projectIsReadonly": false}' WHERE "rowGUID" = %L$q$, :'p1'), 'only the switch', 'the switch together with another change is refused');
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowProgress" = 55 WHERE "rowGUID" = %L$q$, :'p1'), 'Read-only project', 'another column of the project is not changed');
SELECT tt.fails(format($q$DELETE FROM public.project_table WHERE "rowGUID" = %L$q$, :'p1'), 'cannot be deleted', 'a read-only project is not deleted');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"name": "Two"}' WHERE "rowGUID" = %L$q$, :'p2')), 1::bigint, 'the other project of the user is changed as before');

-- 3. tasks, links ----------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDescription": "X"}' WHERE "rowGUID" = %L$q$, :'t1'), 'Read-only project', 'a task is not changed');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowProgress" = 50 WHERE "rowGUID" = %L$q$, :'t1'), 'project_task_table', 'the progress of a task is not changed');
SELECT tt.fails(format($q$DELETE FROM public.project_task_table WHERE "rowGUID" = %L$q$, :'t1'), 'Read-only project', 'a task is not deleted');
SELECT tt.fails(format($q$INSERT INTO public.project_task_table ("rowGUID", "projectGUID", "treePath", "rowOwnerGUID", "rowJSON")
  SELECT 'dddddddd-0000-0000-0000-000000000001', t."projectGUID", t."treePath" || public.pm_ltree_label('dddddddd-0000-0000-0000-000000000001'::uuid), t."rowOwnerGUID", '{"rowKind": "task", "taskDescription": "New"}'::jsonb
    FROM public.project_task_table t WHERE t."rowGUID" = %L$q$, :'s1'), 'Read-only project', 'a task is not created');
SELECT tt.fails(format($q$DELETE FROM public.project_task_dependencies_table WHERE "projectGUID" = %L$q$, :'p1'), 'project_task_dependencies_table', 'a link is not deleted');
SELECT tt.fails(format($q$INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID") VALUES (%L, %L, %L)$q$, :'t2', :'t1', :'p1'), 'Read-only project', 'a link is not created');
-- the automatic writes of an open dashboard are quiet: nothing changes, no error
SELECT tt.eq(public.pm_apply_schedule(:'p1', jsonb_build_array(jsonb_build_object('rowGUID', :'t1', 'startAt', '2031-01-01T00:00:00Z', 'finishAt', '2031-01-05T00:00:00Z')), '2031-02-01T00:00:00Z'::timestamptz, 10), 0, 'the schedule write-back changes nothing and does not fail');
SELECT tt.eq((SELECT COALESCE(t."rowJSON"->>'startAt', '') LIKE '2031%' FROM public.project_task_table t WHERE t."rowGUID" = :'t1'), false, '... the dates of the task stay');
SELECT tt.eq(public.pm_set_task_last_edit_place(:'t1', '{"surface": "x"}'::jsonb), 0, 'the last edit place is quietly not saved');

-- 4. task lines, payment plan, Kanban --------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 11}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001'$q$, 'task_line_table', 'a task line is not changed');
SELECT tt.fails($q$DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001'$q$, 'Read-only project', 'a task line is not deleted');
SELECT tt.fails(format($q$INSERT INTO public.task_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'expenseGenus', '{"qtyTaskLine": 1}')$q$, :'t1'), 'Read-only project', 'a task line is not created');
SELECT tt.fails(format($q$SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', %L, 'timeZone', 'Europe/Riga', 'lines', '[]'::jsonb))$q$, :'t2'), 'Read-only project', 'Post of a task is refused');
SELECT tt.fails(format($q$UPDATE public.project_kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageName": "Z"}' WHERE "rowGUID" = %L$q$, :'k1'), 'project_kanban_stage_table', 'a Kanban stage of the project is not changed');
SELECT tt.fails(format($q$INSERT INTO public.project_task_kanban_state_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, %L, jsonb_build_object('stageGUID', %L))$q$, :'p1', :'t1', :'k1'), 'Read-only project', 'a Kanban card is not moved');
SELECT tt.eq((SELECT count(*) > 0 FROM public.pm_kanban_ensure_project_stages(:'p1')), true, 'opening the Kanban view still reads the stages');

-- 5. documents -------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails(format($q$SELECT public.task_fact_document_create(%L)$q$, :'t1'), 'Read-only project', 'a fact input document is not created');
SELECT tt.fails(format($q$DELETE FROM public.task_fact_header WHERE "rowGUID" = %L$q$, :'f1'), 'Read-only project', 'a draft fact input document is not deleted');
SELECT tt.fails(format($q$DELETE FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = %L$q$, :'d1'), 'vendor_invoice_lines', 'a line of a draft vendor invoice in the project is not deleted');
SELECT tt.fails(format($q$SELECT public.post_vendor_invoice(%L)$q$, :'d1'), 'Read-only project', 'a vendor invoice with a line in the project is not posted');
SELECT tt.fails(format($q$SELECT public.vendor_invoice_set_header(%L, '{"vendorInvoiceNumber": "INV-2"}'::jsonb)$q$, :'d1'), 'Read-only project', '... and its header is not changed');
SELECT tt.fails(format($q$SELECT public.delete_vendor_invoice(%L)$q$, :'d1'), 'Read-only project', '... and it is not deleted');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements m WHERE m."rowProjectGUID" = :'p1' AND m."rowJSON"->>'kind' IS DISTINCT FROM 'plan'), 0::bigint, 'no fact movement was written');

-- 5b. members, versions, chat, files -----------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails(format($q$INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, '11111111-1111-1111-1111-111111111111', '{"permissionProfileGUID": "permissionProjectSponsor"}')$q$, :'p1'), 'Read-only project', 'a member is not added to the project');
SELECT tt.fails($q$UPDATE public.project_permission_profile_user_table SET "rowJSON" = '{"permissionProfileGUID": "permissionProjectManager"}' WHERE "rowGUID" = 'ppu-1'$q$, 'project_permission_profile_user_table', 'the profile of a member is not changed');
SELECT tt.fails($q$DELETE FROM public.project_permission_profile_user_table WHERE "rowGUID" = 'ppu-1'$q$, 'Read-only project', 'a member is not removed');
SELECT tt.fails(format($q$SELECT public.pm_version_save(%L, 'v2')$q$, :'p1'), 'Read-only project', 'a version is not saved');
SELECT tt.fails(format($q$SELECT public.pm_version_set_title(%L, 'renamed')$q$, :'v1'), 'Read-only project', 'a version is not renamed');
SELECT tt.fails(format($q$SELECT public.pm_version_restore(%L)$q$, :'v1'), 'Read-only project', 'a version is not restored');
SELECT tt.fails(format($q$DELETE FROM public.version_project_table WHERE "rowVersionGUID" = %L$q$, :'v1'), 'version_project_table', 'a version is not deleted');
SELECT tt.fails(format($q$SELECT public.chat_message_send(gen_random_uuid()::text, %L, 'more')$q$, :'th1'), 'Read-only project', 'no message into the chat of a task of the project');
SELECT tt.fails(format($q$SELECT public.chat_message_edit(%L, 'changed')$q$, :'m1'), 'Read-only project', 'a message is not edited');
SELECT tt.fails(format($q$SELECT public.chat_message_delete(%L)$q$, :'m1'), 'Read-only project', 'a message is not deleted');
SELECT tt.fails(format($q$SELECT public.chat_member_add(%L, ARRAY['33333333-3333-3333-3333-333333333333'])$q$, :'th1'), 'Read-only project', 'a chat member is not added');
SELECT tt.fails(format($q$SELECT public.chat_task_ensure(%L)$q$, :'t2'), 'Read-only project', 'the chat of another task is not made');
SELECT tt.eq(public.chat_task_ensure(:'t1')->>'themeGUID', :'th1', 'the existing chat still opens');
SELECT tt.eq(jsonb_typeof(to_jsonb(public.chat_mark_read(:'th1'))), 'boolean', 'the read mark of the user is his own: no refusal');
SELECT tt.eq((SELECT (e->>'projectIsReadonly')::boolean FROM jsonb_array_elements(public.chat_theme_list()) e WHERE e->>'themeGUID' = :'th1'), true, 'the theme list tells the interface');
SELECT tt.eq(public.files_authorize('add', 'task', :'t1', :'p1')->>'reason', 'projectReadonly', 'files: add to a task of the project is refused');
SELECT tt.eq(public.files_authorize('delete', 'project', :'p1')->>'reason', 'projectReadonly', 'files: delete of a project file is refused');
SELECT tt.eq(public.files_authorize('add', 'chat', :'th1')->>'reason', 'projectReadonly', 'files: add to the chat of a task of the project is refused');
SELECT tt.eq((public.files_authorize('read', 'task', :'t1', :'p1')->>'allowed')::boolean, true, 'files: reading stays');
SELECT tt.fails(format($q$INSERT INTO public."mediaPostTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('11111111-1111-1111-1111-111111111111', %L, '{"mediaPostTitle": "New"}')$q$, :'p1'), 'Read-only project', 'a media post of the project is not created');
SELECT tt.fails($q$UPDATE public."mediaPostTable" SET "rowJSON" = "rowJSON" || '{"mediaPostTitle": "Z"}' WHERE "rowGUID" = 'mp-1'$q$, 'mediaPostTable', 'a media post of the project is not changed');
SELECT tt.fails($q$DELETE FROM public."mediaPostTable" WHERE "rowGUID" = 'mp-1'$q$, 'Read-only project', 'a media post of the project is not deleted');
SELECT tt.eq(tt.rows_of($q$INSERT INTO public."mediaPostTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('11111111-1111-1111-1111-111111111111', 'empty', '{"mediaPostTitle": "Mine"}')$q$), 1::bigint, 'a media post outside the project is saved as before');
-- a NEW project is never read-only (a copy / template / file of a read-only project)
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('eeeeeeee-0000-0000-0000-00000000000e', public.pm_ltree_label('eeeeeeee-0000-0000-0000-00000000000e'::uuid), '11111111-1111-1111-1111-111111111111', '{"name": "Copy", "projectIsReadonly": true}');
SELECT tt.eq(public.project_is_readonly('eeeeeeee-0000-0000-0000-00000000000e'), false, 'a new project starts open, whatever the inserted row says');

-- 6. reading works; the other project works ----------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) > 0 FROM public.project_task_table t WHERE t."projectGUID" = :'p1'), true, 'the tasks are read');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDescription": "Other"}' WHERE "rowGUID" = %L$q$, :'o1')), 1::bigint, 'a task of ANOTHER project of the user is changed as before');
-- the personal view settings are not project data
SELECT tt.eq(tt.rows_of(format($q$INSERT INTO public.project_user_settings_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, '11111111-1111-1111-1111-111111111111', '{"uxuiSettings": {}}')$q$, :'p1')), 1::bigint, 'the own view settings of the user are still saved');

-- 7. the SQL editor / the workers (no session) pass ---------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"note": "maintenance"}' WHERE "rowGUID" = %L$q$, :'t3')), 1::bigint, 'the SQL editor (no session) changes a task of a read-only project');

-- 8. off again: everything works ---------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.project_set_readonly(:'p1', false), false, 'the owner turns the switch off');
SELECT tt.eq(public.project_is_readonly(:'p1'), false, 'the project is open again');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDescription": "X"}' WHERE "rowGUID" = %L$q$, :'t1')), 1::bigint, 'a task is changed again');
SELECT tt.eq(tt.rows_of($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 11}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001'$q$), 1::bigint, 'a task line is changed again');
SELECT tt.eq(public.post_vendor_invoice(:'d1')->>'status', 'posted', 'the vendor invoice is posted');
SELECT public.pm_version_save(:'p1', 'v2');
SELECT tt.eq((SELECT count(*) FROM public.version_project_table v WHERE v."rowGUID" = :'p1'), 2::bigint, 'a version is saved again');
SELECT tt.eq(jsonb_typeof(public.chat_message_send(gen_random_uuid()::text, :'th1', 'back')), 'object', 'a message is sent again');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.project_permission_profile_user_table WHERE "rowGUID" = 'ppu-1'$q$), 1::bigint, 'a member is removed again');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."mediaPostTable" WHERE "rowGUID" = 'mp-1'$q$), 1::bigint, 'the media post is deleted again');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"name": "Renamed", "projectIsReadonly": true}' WHERE "rowGUID" = %L$q$, :'p1')), 1::bigint, 'an OPEN project takes the switch together with other changes (the Save of the settings window)');
SELECT tt.eq(public.project_is_readonly(:'p1'), true, '... and is read-only from then on');
-- a plain UPDATE that changes only the switch is the same as the RPC
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectIsReadonly": false}' WHERE "rowGUID" = %L$q$, :'p1')), 1::bigint, 'an UPDATE that changes only the switch is accepted');

-- 9. somebody else cannot turn the switch ----------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.organization_ensure_user('marko@other.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('marko@other.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.project_set_readonly(%L, true)$q$, :'p1'), 'No permission', 'a user of another organization cannot turn the switch');

ROLLBACK;
