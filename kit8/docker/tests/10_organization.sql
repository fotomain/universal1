-- WP A1-A6: userOrganization, organization_ensure_user, project_table.rowParentGUID, invitations
BEGIN;
SELECT tt.as_admin();

-- A1: a user is created WITH an organization, in one step; a second call changes nothing
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT tt.eq(:'anna'::jsonb->>'userGUID', '11111111-1111-1111-1111-111111111111', 'the user GUID is the auth uid');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable" WHERE "rowOwnerGUID" = 'anna@acme.test'), 1::bigint, 'one organization owned by anna');
SELECT tt.eq((SELECT "rowJSON"->>'userOrganization' FROM public."userTable" WHERE "rowOwnerGUID" = 'anna@acme.test'), :'anna'::jsonb->>'organizationGUID', 'userOrganization = the organization');
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna2 \gset
SELECT tt.eq(:'anna2'::jsonb, :'anna'::jsonb, 'a second ensure returns the same user and organization');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable" WHERE "rowOwnerGUID" = 'anna@acme.test'), 1::bigint, 'still one organization');

-- a signed-in user can ensure only himself
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$SELECT public.organization_ensure_user('someone@else.test')$q$, 'only ensure your own', 'ensure another e-mail');
SELECT tt.fails($q$INSERT INTO public."userTable" ("rowGUID","rowOwnerGUID","rowJSON") VALUES ('x1','x@x.test','{}')$q$, 'permission denied', 'the client cannot insert into userTable');
SELECT tt.fails($q$UPDATE public."userTable" SET "rowJSON" = "rowJSON" || '{"userOrganization": "other"}' WHERE "rowOwnerGUID" = 'anna@acme.test'$q$, 'does not exist', 'a user cannot point to an organization that does not exist');
SELECT tt.as_admin();
INSERT INTO public."organizationTable" ("rowGUID","rowOwnerGUID","rowJSON") VALUES ('org-other','other@x.test','{"organizationTitle":"Other","createdByUser":"other@x.test"}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$UPDATE public."userTable" SET "rowJSON" = "rowJSON" || '{"userOrganization": "org-other"}' WHERE "rowOwnerGUID" = 'anna@acme.test'$q$, 'by an administrator', 'a user cannot change his organization');
SELECT tt.fails($q$UPDATE public."userTable" SET "rowJSON" = "rowJSON" - 'userOrganization' WHERE "rowOwnerGUID" = 'anna@acme.test'$q$, 'obligatory', 'a user cannot empty his organization');
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || '{"firstName": "Anna2"}' WHERE "rowOwnerGUID" = 'anna@acme.test';
SELECT tt.eq((SELECT "rowJSON"->>'firstName' FROM public."userTable" WHERE "rowOwnerGUID" = 'anna@acme.test'), 'Anna2', 'other keys of the user row are still editable');

-- A1: the database refuses a user row without an organization
SELECT tt.as_admin();
SELECT tt.fails($q$INSERT INTO public."userTable" ("rowGUID","rowOwnerGUID","rowJSON") VALUES ('x2','x2@x.test','{"userEmail":"x2@x.test"}')$q$, 'obligatory', 'no user without an organization');

-- A3: the project gets the organization of its owner, whatever the client sends; it is never changed
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.project_table ("rowGUID","treePath","rowOwnerGUID","rowParentGUID","rowJSON")
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000001'::uuid), '11111111-1111-1111-1111-111111111111', 'org-other', '{"name":"P1"}');
SELECT tt.eq((SELECT "rowParentGUID" FROM public.project_table WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), :'anna'::jsonb->>'organizationGUID', 'the project has the organization of its owner (the sent value is ignored)');
SELECT tt.fails($q$UPDATE public.project_table SET "rowParentGUID" = 'org-other' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 'cannot be changed', 'the organization of a project is never changed');
UPDATE public.project_table SET "rowParentGUID" = "rowParentGUID", "rowProgress" = 5 WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT "rowProgress" FROM public.project_table WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 5::numeric, 'an update that keeps the organization is fine');
SELECT tt.as_admin();
SELECT tt.fails(format($q$DELETE FROM public."organizationTable" WHERE "rowGUID" = %L$q$, :'anna'::jsonb->>'organizationGUID'), 'violates foreign key', 'an organization with projects cannot be deleted');

-- pm_seed_demo (the app creates the demo projects for the signed-in user) keeps working
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.pm_seed_demo();
SELECT tt.eq((SELECT count(*) FROM public.project_table WHERE "rowParentGUID" IS NULL), 0::bigint, 'the seeded projects have an organization');

-- A6: invitations
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.organization_invite_user('boris@acme.test') AS inv \gset
SELECT tt.eq(public.organization_invite_user('boris@acme.test'), :'inv', 'inviting twice returns the same pending invitation');
SELECT tt.fails($q$SELECT public.organization_invite_user('not an email')$q$, 'not an e-mail', 'a bad e-mail is refused');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('boris@acme.test', '22222222-2222-2222-2222-222222222222', 'Boris', 'M') AS boris \gset
SELECT tt.eq(:'boris'::jsonb->>'organizationGUID', :'anna'::jsonb->>'organizationGUID', 'a new user with an invitation joins the organization of the inviter');
SELECT tt.eq((SELECT "rowJSON"->>'status' FROM public."organizationInvitationTable" WHERE "rowGUID" = :'inv'), 'accepted', 'the invitation is accepted');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable" WHERE "rowOwnerGUID" = 'boris@acme.test'), 0::bigint, 'boris got NO organization of his own');
-- boris is not the admin
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails($q$SELECT public.organization_invite_user('clara@acme.test')$q$, 'only the administrator', 'only the admin invites');
-- two users, one organization: both see projects only of their own (RLS unchanged), but both are in the organization of the projects
SELECT tt.eq((SELECT count(*) FROM public.project_table), 0::bigint, 'boris sees no project of anna (access is still by owner)');
SELECT tt.eq(public.organization_of_current_user(), :'anna'::jsonb->>'organizationGUID', 'boris is in the organization of anna');

-- an existing user (clara has an organization of her own) accepts an invitation: only she can, and her old projects keep their organization
SELECT tt.as_admin();
SELECT public.organization_ensure_user('clara@acme.test', '33333333-3333-3333-3333-333333333333', 'Clara', 'S') AS clara \gset
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
INSERT INTO public.project_table ("rowGUID","treePath","rowOwnerGUID","rowJSON")
VALUES ('cccccccc-0000-0000-0000-000000000001', public.pm_ltree_label('cccccccc-0000-0000-0000-000000000001'::uuid), '33333333-3333-3333-3333-333333333333', '{"name":"Clara old"}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.organization_invite_user('clara@acme.test') AS inv2 \gset
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.organization_accept_invitation(%L)$q$, :'inv2'), 'no pending invitation for you', 'only the invited person accepts');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT public.organization_accept_invitation(:'inv2');
SELECT tt.eq(public.organization_of_current_user(), :'anna'::jsonb->>'organizationGUID', 'clara is now in the organization of anna');
SELECT tt.eq((SELECT "rowParentGUID" FROM public.project_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001'), :'clara'::jsonb->>'organizationGUID', 'her old project keeps its old organization');
INSERT INTO public.project_table ("rowGUID","treePath","rowOwnerGUID","rowJSON")
VALUES ('cccccccc-0000-0000-0000-000000000002', public.pm_ltree_label('cccccccc-0000-0000-0000-000000000002'::uuid), '33333333-3333-3333-3333-333333333333', '{"name":"Clara new"}');
SELECT tt.eq((SELECT "rowParentGUID" FROM public.project_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000002'), :'anna'::jsonb->>'organizationGUID', 'her new project has the new organization');
ROLLBACK;
