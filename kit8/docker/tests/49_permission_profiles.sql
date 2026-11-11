-- PART 46: permission profiles and the function perm_can (documentation/PERMISSIONS_WBS.html, section 5): the seed of the 11 profiles and the two matrices, the profiles of a user (owner, assignment,
-- RACI), perm_can / perm_require / perm_my_matrix, the creator of a project becomes its project manager, the assignment rules, the derivation of task_user_permission_table, the field check.
-- The policies are switched in PART 47 (tests/53): here the functions and the tables are tested.
BEGIN;
SELECT tt.as_admin();

-- ---- the seed ------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public.project_permission_profile_catalog), 11::bigint, '11 profiles');
SELECT tt.eq((SELECT count(*) FROM public.project_permission_profile_crud_table), 1551::bigint, 'the CRUD matrix: 141 tables x 11 profiles');
SELECT tt.eq((SELECT count(DISTINCT "rowJSON"->>'permissionTable') FROM public.project_permission_profile_crud_table), 141::bigint, '141 tables');
SELECT tt.eq((SELECT count(*) FROM public.project_permission_profile_uxui_table), 297::bigint, 'the interface matrix: 27 objects x 11 profiles');
SELECT tt.eq((SELECT "rowJSON"->>'permissionSet' FROM public.project_permission_profile_crud_table WHERE "rowParentGUID" = 'permissionProjectManager' AND "rowJSON"->>'permissionTable' = 'partnerTable'), 'RC', 'project manager: RC on a catalog (Q21)');
SELECT tt.eq((SELECT "rowJSON"->>'permissionSet' FROM public.project_permission_profile_crud_table WHERE "rowParentGUID" = 'permissionOrganizationAdmin' AND "rowJSON"->>'permissionTable' = 'project_task_table'), 'R', 'administrator: R on the tasks');
SELECT tt.eq((SELECT "rowJSON"->>'permissionSet' FROM public.project_permission_profile_crud_table WHERE "rowParentGUID" = 'permissionTaskResponsible' AND "rowJSON"->>'permissionTable' = 'project_task_table'), 'RU', 'responsible: RU on the tasks ...');
SELECT tt.eq((SELECT "rowJSON"->'permissionWritableFields' FROM public.project_permission_profile_crud_table WHERE "rowParentGUID" = 'permissionTaskResponsible' AND "rowJSON"->>'permissionTable' = 'project_task_table'), '["rowProgress"]'::jsonb, '... the progress only');
SELECT tt.eq((SELECT jsonb_array_length("rowJSON"->'permissionLockedActions') FROM public.project_permission_profile_crud_table WHERE "rowParentGUID" = 'permissionTaskManager' AND "rowJSON"->>'permissionTable' = 'project_task_table'), 6, 'task manager: six disabled actions');
SELECT tt.eq((SELECT "rowJSON"->>'permissionSet' FROM public.project_permission_profile_crud_table WHERE "rowParentGUID" = 'permissionFinancialManagerFact' AND "rowJSON"->>'permissionTable' = 'vendor_invoice_header'), 'CRUD', 'financial manager (fact): the invoices');
SELECT tt.eq((SELECT count(*) FROM public.project_permission_profile_crud_table c WHERE NOT EXISTS (SELECT 1 FROM public.project_permission_profile_catalog p WHERE p."rowGUID" = c."rowParentGUID")), 0::bigint, 'every row names a profile');

-- ---- an organization, three members, an outsider -----------------------------------------------------------------------------------------
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orgA \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT public.organization_ensure_user('boris@acme.test', '22222222-2222-2222-2222-222222222222', 'Boris', 'M');
SELECT public.organization_ensure_user('clara@acme.test', '33333333-3333-3333-3333-333333333333', 'Clara', 'S');
SELECT public.organization_ensure_user('dora@other.test', '44444444-4444-4444-4444-444444444444', 'Dora', 'O') AS dora \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "boris@acme.test"}'), (:'orga', '{"userEmailForInvitation": "clara@acme.test"}');
SELECT tt.as_admin();
-- boris and clara switch to organization A (organization_switch is the ACTIVE organization)
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', :'orga') WHERE "rowOwnerGUID" IN ('boris@acme.test', 'clara@acme.test');

-- ---- a project: its creator becomes its project manager -----------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowParentGUID", "rowJSON")
VALUES ('aaaaaaaa-0000-0000-0000-000000000049', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000049'), '11111111-1111-1111-1111-111111111111', :'orga', '{"name": "P49"}');
SELECT tt.as_admin();
SELECT tt.eq((SELECT "rowJSON"->>'permissionProfileGUID' FROM public.project_permission_profile_user_table WHERE "rowOwnerGUID" = 'aaaaaaaa-0000-0000-0000-000000000049' AND "rowParentGUID" = '11111111-1111-1111-1111-111111111111'),
             'permissionProjectManager', 'the creator of a project is its project manager (trigger)');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
VALUES ('bbbbbbbb-0000-0000-0000-000000000049', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000049') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000049'),
        'aaaaaaaa-0000-0000-0000-000000000049', '11111111-1111-1111-1111-111111111111', '{"taskDescription": "T49", "rowKind": "task"}');

-- ---- perm_can: the owner, the administrator, the stranger ------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.perm_can('project_task_table', 'U', 'aaaaaaaa-0000-0000-0000-000000000049'), true, 'the owner (project manager) updates tasks');
SELECT tt.eq(public.perm_can('project_task_table', 'D', 'aaaaaaaa-0000-0000-0000-000000000049'), true, '... and deletes them');
SELECT tt.eq(public.perm_can('partnerTable', 'D'), true, 'anna is the administrator: CRUD on a catalog');
SELECT tt.eq(public.perm_can('project_table', 'C'), true, 'the administrator may create projects');
SELECT tt.eq(public.perm_can('table_nobody_knows', 'C'), true, 'a table in no row: the administrator has CRUD');
SELECT tt.eq(public.perm_can('project_task_table', 'X', 'aaaaaaaa-0000-0000-0000-000000000049'), false, 'a wrong letter is false');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.perm_can('project_task_table', 'R', 'aaaaaaaa-0000-0000-0000-000000000049'), false, 'boris has no profile in the project: no read');
SELECT tt.eq(public.perm_can('partnerTable', 'R'), true, 'a catalog is read by everybody');
SELECT tt.eq(public.perm_can('partnerTable', 'C'), false, '... but boris cannot create a row of it');
SELECT tt.eq(public.perm_can('project_table', 'C'), false, '... nor a project');
SELECT tt.eq(public.perm_can('table_nobody_knows', 'R'), true, 'a table in no row: read');
SELECT tt.fails($q$SELECT public.perm_require('project_task_table', 'R', 'aaaaaaaa-0000-0000-0000-000000000049')$q$, 'No permission: project_task_table, R', 'perm_require refuses with the table and the letter');
SELECT tt.as_admin();
SELECT tt.eq(public.perm_can('project_task_table', 'R', 'aaaaaaaa-0000-0000-0000-000000000049'), false, 'no session: false');

-- ---- assignments -------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000049', '22222222-2222-2222-2222-222222222222', '{"permissionProfileGUID": "permissionProjectReadOnly"}');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.perm_can('project_task_table', 'R', 'aaaaaaaa-0000-0000-0000-000000000049'), true, 'read only: R ...');
SELECT tt.eq(public.perm_can('project_task_table', 'U', 'aaaaaaaa-0000-0000-0000-000000000049'), false, '... no U');
SELECT tt.eq(public.perm_can('vendor_invoice_header', 'C', 'aaaaaaaa-0000-0000-0000-000000000049'), false, '... no C on the documents');
SELECT tt.eq(public.perm_profiles('aaaaaaaa-0000-0000-0000-000000000049'), ARRAY['permissionProjectReadOnly'], 'his profiles');
SELECT tt.eq(public.perm_can('project_task_table', 'R', 'aaaaaaaa-0000-0000-0000-000000000000'), false, 'an unknown project: false');
SELECT tt.eq((SELECT count(*) FROM public.project_permission_profile_user_table), 1::bigint, 'boris sees only his own assignment');
SELECT tt.fails($q$INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000049', '22222222-2222-2222-2222-222222222222', '{"permissionProfileGUID": "permissionProjectManager"}')$q$, 'row-level security', 'a read only user cannot give himself a profile');
-- the project manager (anna, the owner) assigns; the rules of the guard
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000049', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionOrganizationAdmin"}')$q$, 'not assigned by hand', 'the administrator profile is not assigned here');
SELECT tt.fails($q$INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000049', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionTaskResponsible"}')$q$, 'not assigned by hand', 'a derived profile is not assigned by hand');
SELECT tt.fails($q$INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000049', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionNoSuchThing"}')$q$, 'is not a permission profile', 'an unknown profile is refused');
SELECT tt.fails(format($q$INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000049', %L, '{"permissionProfileGUID": "permissionProjectSponsor"}')$q$, :'dora'::jsonb->>'userGUID'),
                'not an active member', 'a user of another organization cannot be assigned');
SELECT tt.fails($q$INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (current_setting('tt.orga'), '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionProjectSponsor"}')$q$, 'permissionProjectManager or permissionProjectCurator', 'for the whole organization only manager / curator (= may create projects)');
INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('aaaaaaaa-0000-0000-0000-000000000049', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionFinancialManagerFact"}'),
  ('aaaaaaaa-0000-0000-0000-000000000049', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionFinancialManagerPlan"}');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.perm_can('vendor_invoice_header', 'C', 'aaaaaaaa-0000-0000-0000-000000000049'), true, 'two profiles ADD UP: the fact manager creates invoices ...');
SELECT tt.eq(public.perm_can('task_line_table', 'U', 'aaaaaaaa-0000-0000-0000-000000000049'), true, '... the plan manager changes the task lines');
SELECT tt.eq(public.perm_can('project_task_table', 'U', 'aaaaaaaa-0000-0000-0000-000000000049'), false, '... and neither updates a task');
SELECT tt.eq(public.perm_can('vendor_invoice_header', 'C', 'aaaaaaaa-0000-0000-0000-000000000000'), false, 'in another project: nothing');
SELECT tt.eq(public.perm_can('partnerTable', 'C'), false, 'the financial managers have only R on a catalog');
-- the organization level: "may create projects"
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'orga', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionProjectCurator"}');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.perm_can('project_table', 'C'), true, 'an organization level curator may create projects');
SELECT tt.eq(public.perm_can('partnerTable', 'C'), false, '... but a curator reads the catalogs only (RC is on project_table)');
SELECT tt.eq(public.perm_can('project_task_table', 'R', 'aaaaaaaa-0000-0000-0000-000000000049'), true, 'the organization level curator reads the project she was assigned to (the other profiles)');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.perm_can('project_table', 'C'), false, 'a project level assignment does not give the right to create projects');

-- ---- perm_my_matrix ---------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT public.perm_my_matrix('aaaaaaaa-0000-0000-0000-000000000049') AS m \gset
SELECT tt.eq((:'m'::jsonb->'crud'->>'vendor_invoice_header'), 'CDRU', 'the matrix: letters added up, in order (the fact manager)');
SELECT tt.eq((:'m'::jsonb->'crud'->>'task_line_table'), 'CDRU', 'the plan manager: task lines');
SELECT tt.eq((:'m'::jsonb->'crud'->>'project_task_table'), 'R', 'a task: only R');
SELECT tt.eq((:'m'::jsonb->>'isAdmin')::boolean, false, 'not an administrator');
SELECT tt.eq((:'m'::jsonb->>'canCreateProject')::boolean, true, 'may create projects (organization level curator)');
SELECT tt.eq((:'m'::jsonb->'uxui'->>'permissionPurchaseOrder'), 'CDRU', 'the interface matrix: purchase orders (fact manager)');
SELECT tt.eq(jsonb_array_length(:'m'::jsonb->'profiles'), 2, 'two profiles in the project');

-- ---- the organization has its own row of the matrix -------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$INSERT INTO public.project_permission_profile_crud_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('permissionCatalog', 'permissionProjectManager', '{"permissionTable": "x", "permissionSet": "R"}')$q$, 'row-level security', 'the delivered rows are not written by a client');
INSERT INTO public.project_permission_profile_crud_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'orga', 'permissionFinancialManagerFact', '{"permissionTable": "vendor_invoice_header", "permissionSet": "R"}');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.perm_can('vendor_invoice_header', 'C', 'aaaaaaaa-0000-0000-0000-000000000049'), false, 'the organization row wins: the fact manager only reads the invoices of THIS organization');
SELECT tt.fails($q$INSERT INTO public.project_permission_profile_crud_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (current_setting('tt.orga'), 'permissionProjectManager', '{"permissionTable": "x", "permissionSet": "R"}')$q$, 'row-level security', 'only the administrator writes the organization rows');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
DELETE FROM public.project_permission_profile_crud_table WHERE "rowOwnerGUID" = :'orga';
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.perm_can('vendor_invoice_header', 'C', 'aaaaaaaa-0000-0000-0000-000000000049'), true, '... deleted: the delivered row again');

-- ---- RACI -> task_user_permission_table ----------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.task_user_permission_table), 0::bigint, 'nothing derived yet');
INSERT INTO public."personTable" ("rowGUID", "rowJSON") VALUES ('person-boris', '{"personEmail": "Boris@acme.test", "personFirstName": "Boris"}'), ('person-clara', '{"personEmail": "clara@acme.test", "personFirstName": "Clara"}'), ('person-nobody', '{"personEmail": "nobody@acme.test"}');
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000491', 'bbbbbbbb-0000-0000-0000-000000000049', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-boris", "raciItem": "raciResponsibleGUID"}'),
  ('cccccccc-0000-0000-0000-000000000492', 'bbbbbbbb-0000-0000-0000-000000000049', 'timeGenus', '{"taskResourceItem": "person-clara", "raciItem": "raciConsultedGUID"}'),
  ('cccccccc-0000-0000-0000-000000000493', 'bbbbbbbb-0000-0000-0000-000000000049', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-nobody", "raciItem": "raciInformedGUID"}'),
  ('cccccccc-0000-0000-0000-000000000494', 'bbbbbbbb-0000-0000-0000-000000000049', 'materialGenus', '{"taskResourceItem": "person-boris"}');
SELECT tt.eq((SELECT string_agg(("rowParentGUID") || ':' || ("rowJSON"->>'profile'), ',' ORDER BY "rowParentGUID") FROM public.task_user_permission_table WHERE "rowOwnerGUID" = 'bbbbbbbb-0000-0000-0000-000000000049'),
             '22222222-2222-2222-2222-222222222222:permissionTaskResponsible,33333333-3333-3333-3333-333333333333:permissionProjectMember', 'Responsible -> permissionTaskResponsible, Consulted -> permissionProjectMember; a person without a user and a Material line: nothing');
SELECT tt.eq(public.task_user_permission_verify(), 0::bigint, 'verify: the table is what it must be');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.perm_can('project_task_table', 'U', 'aaaaaaaa-0000-0000-0000-000000000049', 'bbbbbbbb-0000-0000-0000-000000000049'), true, 'the responsible updates HIS task ...');
SELECT tt.eq(public.perm_can('project_task_table', 'D', 'aaaaaaaa-0000-0000-0000-000000000049', 'bbbbbbbb-0000-0000-0000-000000000049'), false, '... but does not delete it');
SELECT tt.eq(public.perm_can('task_fact_header', 'C', 'aaaaaaaa-0000-0000-0000-000000000049', 'bbbbbbbb-0000-0000-0000-000000000049'), true, '... and makes fact input');
SELECT tt.eq(public.perm_can('vendor_invoice_header', 'C', 'aaaaaaaa-0000-0000-0000-000000000049', 'bbbbbbbb-0000-0000-0000-000000000049'), false, '... not invoices');
SELECT tt.eq(public.perm_can('project_task_table', 'U', 'aaaaaaaa-0000-0000-0000-000000000049', 'bbbbbbbb-0000-0000-0000-000000000000'), false, 'another task of the project: no update');
SELECT tt.eq(public.perm_can('project_task_table', 'U', 'aaaaaaaa-0000-0000-0000-000000000049'), false, 'no task given: no update');
SELECT tt.eq((SELECT count(*) FROM public.task_user_permission_table), 1::bigint, 'he sees his own derived row');
-- the field check
SELECT tt.eq(public.perm_field_check('project_task_table', 'aaaaaaaa-0000-0000-0000-000000000049', 'bbbbbbbb-0000-0000-0000-000000000049', ARRAY['rowProgress']), NULL, 'the responsible may change the progress');
SELECT tt.eq(public.perm_field_check('project_task_table', 'aaaaaaaa-0000-0000-0000-000000000049', 'bbbbbbbb-0000-0000-0000-000000000049', ARRAY['rowProgress', 'taskDescription']), 'taskDescription', '... and nothing else');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.perm_can('project_task_table', 'R', 'aaaaaaaa-0000-0000-0000-000000000049'), true, 'a consulted person reads the project');
SELECT tt.as_admin();
-- the task is finished: the derived rows go
UPDATE public.project_task_table SET "rowProgress" = 100 WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000049';
SELECT tt.eq((SELECT count(*) FROM public.task_user_permission_table), 0::bigint, 'a finished task (progress 100): no derived rows');
UPDATE public.project_task_table SET "rowProgress" = 50 WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000049';
SELECT tt.eq((SELECT count(*) FROM public.task_user_permission_table), 2::bigint, 'opened again: the rows come back');
-- a Time line changes
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"raciItem": "raciAccountableGUID"}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000491';
SELECT tt.eq((SELECT "rowJSON"->>'profile' FROM public.task_user_permission_table WHERE "rowParentGUID" = '22222222-2222-2222-2222-222222222222'), 'permissionProjectMember', 'responsible -> accountable: the profile follows');
DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000492';
SELECT tt.eq((SELECT count(*) FROM public.task_user_permission_table WHERE "rowParentGUID" = '33333333-3333-3333-3333-333333333333'), 0::bigint, 'a deleted line: the row goes');
-- the e-mail of a person changes
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"personEmail": "clara@acme.test"}' WHERE "rowGUID" = 'person-nobody';
SELECT tt.eq((SELECT "rowJSON"->>'profile' FROM public.task_user_permission_table WHERE "rowParentGUID" = '33333333-3333-3333-3333-333333333333'), 'permissionProjectMember', 'a person gets the e-mail of a user: the row appears');
-- the table can be broken and repaired
DELETE FROM public.task_user_permission_table;
SELECT tt.eq(public.task_user_permission_verify() > 0, true, 'verify sees the damage');
SELECT public.task_user_permission_rebuild();
SELECT tt.eq(public.task_user_permission_verify(), 0::bigint, 'rebuild repairs it');
-- a bulk write (task template fill) is rebuilt once at the end
SELECT set_config('app.task_bulk', 'on', true);
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('cccccccc-0000-0000-0000-000000000495', 'bbbbbbbb-0000-0000-0000-000000000049', 'timeGenus', '{"taskResourceItem": "person-boris", "raciItem": "raciResponsibleGUID"}');
SELECT tt.eq(public.task_user_permission_verify() > 0, true, 'app.task_bulk = on: the triggers wait');
SELECT set_config('app.task_bulk', 'off', true);
SELECT public.task_user_permission_rebuild('aaaaaaaa-0000-0000-0000-000000000049');
SELECT tt.eq(public.task_user_permission_verify(), 0::bigint, '... and one rebuild of the project settles it');
-- the table is never written by a client
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$INSERT INTO public.task_user_permission_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('x', 'y', '{"profile": "permissionTaskManager"}')$q$, 'permission denied', 'no client writes task_user_permission_table');

-- ---- the safety net: an EMPTY matrix (the seed was not run) must not lock an owner out of his own project -----------------------------------------
SELECT tt.as_admin();
DELETE FROM public.project_permission_profile_crud_table;
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.perm_can('project_task_table', 'U', 'aaaaaaaa-0000-0000-0000-000000000049'), true, 'no matrix rows at all: the owner still changes his tasks');
SELECT tt.eq(public.perm_can('vendor_invoice_header', 'D', 'aaaaaaaa-0000-0000-0000-000000000049'), true, '... and deletes his documents');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.perm_can('project_task_table', 'U', 'aaaaaaaa-0000-0000-0000-000000000049'), false, '... while a reader stays a reader');

-- ---- the backfill and the cleanup ---------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.permission_backfill();
SELECT tt.eq(public.permission_backfill(), 0, 'the backfill is idempotent');
DELETE FROM public.project_permission_profile_user_table WHERE "rowOwnerGUID" = 'aaaaaaaa-0000-0000-0000-000000000049';
DELETE FROM public.project_permission_profile_user_table WHERE "rowOwnerGUID" = :'orga' AND "rowParentGUID" = '11111111-1111-1111-1111-111111111111';
SELECT tt.eq(public.permission_backfill() >= 1, true, 'the backfill restores the rows of an owner (project and organization level)');
SELECT tt.eq((SELECT count(*) FROM public.project_permission_profile_user_table WHERE "rowOwnerGUID" = :'orga' AND "rowParentGUID" = '11111111-1111-1111-1111-111111111111'), 1::bigint, 'the owner is an organization level project manager');
DELETE FROM public.project_table WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000049';
SELECT tt.eq((SELECT count(*) FROM public.project_permission_profile_user_table WHERE "rowOwnerGUID" = 'aaaaaaaa-0000-0000-0000-000000000049'), 0::bigint, 'a deleted project takes its assignments');
SELECT tt.eq((SELECT count(*) FROM public.task_user_permission_table), 0::bigint, '... and its derived rows');

ROLLBACK;
