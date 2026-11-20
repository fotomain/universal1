-- PART 54: the APPLICATION ADMINISTRATOR (permissionApplicationAdmin) and the visibility of the organizations (documentation/PERMISSIONS_WBS.html section 13):
-- a user sees only the organizations he is a member of; an application administrator (application_permission_table) sees ALL of them; start4 seeds foto888999@gmail.com.
BEGIN;
SELECT tt.as_admin();

SELECT tt.eq((SELECT ("rowJSON"->>'permissionApplicationAdmin') FROM public.application_permission_table WHERE "rowOwnerGUID" = 'foto888999@gmail.com'), 'true', 'start4 seeded foto888999@gmail.com as an application administrator');

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orgA \gset
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T') AS marko \gset
SELECT :'marko'::jsonb->>'organizationGUID' AS orgB \gset
SELECT public.organization_ensure_user('zed@acme.test', '33333333-3333-3333-3333-333333333333', 'Zed', 'Z') AS zed \gset
SELECT :'zed'::jsonb->>'organizationGUID' AS orgZ \gset
SELECT public.organization_ensure_user('foto888999@gmail.com', '44444444-4444-4444-4444-444444444444', 'Foto', 'F') AS foto \gset
SELECT :'foto'::jsonb->>'organizationGUID' AS orgF \gset
SELECT set_config('tt.orga', :'orga', true), set_config('tt.orgb', :'orgb', true), set_config('tt.orgz', :'orgz', true), set_config('tt.orgf', :'orgf', true);

-- 1. every user sees ONLY his own organization (the catalog is no longer public)
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable")::int, 1, 'anna sees one organization');
SELECT tt.eq((SELECT "rowGUID" FROM public."organizationTable"), :'orga', '... her own');
SELECT tt.eq(public.permission_application_admin(), false, 'anna is no application administrator');
SELECT tt.eq((public.perm_my_matrix()->>'isApplicationAdmin'), 'false', 'perm_my_matrix: isApplicationAdmin false');
SELECT tt.eq(((public.perm_my_matrix()->'profiles') ? 'permissionApplicationAdmin'), false, 'the profile is not in her list');
SELECT tt.eq(public.organization_visible(:'orgb'), false, 'organization_visible: not marko''s organization');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable" WHERE "rowGUID" = :'orgb')::int, 0, 'marko''s organization is invisible to her');

-- 2. a MEMBERSHIP makes another organization visible (marko is the administrator of B and adds anna)
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable")::int, 1, 'marko sees one organization');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orgb', '{"userEmailForInvitation": "anna@acme.test"}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable")::int, 2, 'anna is a member of B now: she sees A and B');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable" WHERE "rowGUID" = :'orgz')::int, 0, '... but not zed''s organization');
-- an INVITED person (no active membership) does not see the organization
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orgb', '{"userEmailForInvitation": "stranger@acme.test"}');
SELECT tt.eq((SELECT ("rowJSON"->>'memberStatus') FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') = 'stranger@acme.test'), 'invited', 'stranger is only INVITED');

-- 3. the application administrator sees ALL organizations
SELECT tt.as_user('foto888999@gmail.com', '44444444-4444-4444-4444-444444444444');
SELECT tt.eq(public.permission_application_admin(), true, 'foto888999@gmail.com holds permissionApplicationAdmin');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable")::int, 4, 'he sees all 4 organizations');
SELECT tt.eq((public.perm_my_matrix()->>'isApplicationAdmin'), 'true', 'perm_my_matrix: isApplicationAdmin true');
SELECT tt.eq(((public.perm_my_matrix()->'profiles') ? 'permissionApplicationAdmin'), true, 'the profile name is in his list');
-- ... but the permission alone changes nothing: a foreign organization is read only
SELECT tt.eq(tt.rows_of($q$UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"notes": "x"}' WHERE "rowGUID" = current_setting('tt.orga')$q$), 0::bigint, 'he cannot edit a foreign organization');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."organizationTable" WHERE "rowGUID" = current_setting('tt.orgz')$q$), 0::bigint, 'nor delete it');
-- he is no member of the others: organization_my_memberships lists his own only
SELECT tt.eq((SELECT jsonb_array_length(public.organization_my_memberships())), 1, 'his memberships: only his own organization');

-- 4. the table itself is closed to every client
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$SELECT * FROM public.application_permission_table$q$, 'permission denied', 'no client reads the list of the application administrators');
SELECT tt.fails($q$INSERT INTO public.application_permission_table ("rowOwnerGUID", "rowJSON") VALUES ('anna@acme.test', '{"permissionApplicationAdmin": true}')$q$, 'permission denied', 'nobody makes himself an application administrator');
-- a key typed into her own user row means nothing: the flag is in application_permission_table only
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || '{"permissionApplicationAdmin": true}' WHERE "rowOwnerGUID" = 'anna@acme.test';
SELECT tt.eq(public.permission_application_admin(), false, 'a key in her own user row does not make her an application administrator');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable")::int, 2, '... and she still sees only her organizations');
ROLLBACK;
