-- PART 45: the members of an organization (documentation/PERMISSIONS_WBS.html section 4): organizationMemberTable, the administrator rules, invitations, many organizations (organization_switch),
-- the person of a user (autoCreatePerson, person_create_own, organization_member_create_person), the backfill of the old data
BEGIN;
SELECT tt.as_admin();

-- ---- the first user of an organization is its administrator (automatically); a person is made at his first login ---------------------------------
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orgA \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga'), 1::bigint, 'one member row: the creator');
SELECT tt.eq((SELECT ("rowJSON"->>'organizationAdministrator') FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga'), 'true', 'the creator is the administrator');
SELECT tt.eq((SELECT ("rowJSON"->>'memberStatus') || '/' || "rowParentGUID" FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga'), 'active/11111111-1111-1111-1111-111111111111', 'active, linked to the user');
SELECT tt.eq((SELECT ("rowJSON" ? 'registeredAt') FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga'), true, 'registeredAt = the first session');
SELECT tt.eq((SELECT count(*) FROM public."personTable" WHERE ("rowJSON"->>'personEmail') = 'anna@acme.test'), 1::bigint, 'his person was made at the first login (autoCreatePerson is true by default)');
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga'), 1::bigint, 'a second ensure adds no member');
SELECT tt.eq((SELECT count(*) FROM public."personTable" WHERE ("rowJSON"->>'personEmail') = 'anna@acme.test'), 1::bigint, '... and no second person');
SELECT tt.eq(public.organization_is_admin(:'orga'), false, 'no session: not an administrator');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.organization_is_admin(:'orga'), true, 'anna is the administrator');

-- ---- the administrator adds members: a table row ------------------------------------------------------------------------------------------------
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "  Boris@Acme.TEST "}');
SELECT tt.eq((SELECT ("rowJSON"->>'userEmailForInvitation') || '|' || ("rowJSON"->>'memberStatus') || '|' || "rowParentGUID" FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') LIKE 'boris%'),
             'boris@acme.test|invited|empty', 'an unknown e-mail: lower case, INVITED, no user yet');
SELECT tt.eq((SELECT ("rowJSON" ? 'invitedAt') AND ("rowJSON"->>'invitedBy') = 'anna@acme.test' AND ("rowJSON"->>'autoCreatePerson') = 'true' AND ("rowJSON"->>'organizationAdministrator') = 'false'
                FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') = 'boris@acme.test'), true, 'invitedAt, invitedBy, autoCreatePerson true, not an administrator');
SELECT tt.fails($q$INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (current_setting('tt.orga'), '{"userEmailForInvitation": "boris@acme.test"}')$q$, 'already a member', 'the same e-mail twice is refused');
SELECT tt.fails($q$INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (current_setting('tt.orga'), '{"userEmailForInvitation": "not an email"}')$q$, 'is not an e-mail', 'a bad e-mail is refused');
-- the client cannot make a member active or give him a user
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'orga', '99999999-9999-9999-9999-999999999999', '{"userEmailForInvitation": "dora@acme.test", "memberStatus": "active", "registeredAt": "2020-01-01"}');
SELECT tt.eq((SELECT ("rowJSON"->>'memberStatus') || '|' || "rowParentGUID" || '|' || (("rowJSON" ? 'registeredAt')::text) FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') = 'dora@acme.test'),
             'invited|empty|false', 'status, user and registeredAt sent by the client are ignored');
-- a registered user is an ACTIVE member at once
SELECT tt.as_admin();
SELECT public.organization_ensure_user('clara@acme.test', '33333333-3333-3333-3333-333333333333', 'Clara', 'S') AS clara \gset
SELECT :'clara'::jsonb->>'organizationGUID' AS orgC \gset
SELECT set_config('tt.orgc', :'orgc', true);
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "clara@acme.test"}');
SELECT tt.eq((SELECT ("rowJSON"->>'memberStatus') || '|' || "rowParentGUID" FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga' AND ("rowJSON"->>'userEmailForInvitation') = 'clara@acme.test'),
             'active|33333333-3333-3333-3333-333333333333', 'a registered user is an active member at once, linked to his user');
SELECT tt.as_admin();
SELECT tt.eq((SELECT ("rowJSON"->>'userOrganization') FROM public."userTable" WHERE "rowOwnerGUID" = 'clara@acme.test'), :'orgc', 'his ACTIVE organization is still his own');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

-- ---- what the table lets a client edit ------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$UPDATE public."organizationMemberTable" SET "rowJSON" = "rowJSON" || '{"memberStatus": "active"}' WHERE ("rowJSON"->>'userEmailForInvitation') = 'boris@acme.test'$q$, 'only the administrator flag', 'the status is not edited by hand');
SELECT tt.fails($q$UPDATE public."organizationMemberTable" SET "rowJSON" = "rowJSON" || '{"userEmailForInvitation": "other@acme.test"}' WHERE ("rowJSON"->>'userEmailForInvitation') = 'boris@acme.test'$q$, 'only the administrator flag', 'the e-mail is not edited');
SELECT tt.fails($q$UPDATE public."organizationMemberTable" SET "rowParentGUID" = '1' WHERE ("rowJSON"->>'userEmailForInvitation') = 'boris@acme.test'$q$, 'only the administrator flag', 'the user is not edited');
UPDATE public."organizationMemberTable" SET "rowJSON" = "rowJSON" || '{"autoCreatePerson": false}' WHERE ("rowJSON"->>'userEmailForInvitation') = 'boris@acme.test';
SELECT tt.eq((SELECT ("rowJSON"->>'autoCreatePerson') FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') = 'boris@acme.test'), 'false', 'autoCreatePerson can be changed');

-- ---- who sees and writes ---------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga'), 4::bigint, 'the administrator sees the 4 members');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable"), 2::bigint, 'clara sees only her own rows (her own organization and anna''s)');
SELECT tt.fails($q$INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (current_setting('tt.orga'), '{"userEmailForInvitation": "evil@acme.test"}')$q$, 'row-level security', 'a member who is no administrator cannot add');
SELECT tt.eq(tt.rows_of($q$UPDATE public."organizationMemberTable" SET "rowJSON" = "rowJSON" || '{"organizationAdministrator": true}' WHERE "rowOwnerGUID" = current_setting('tt.orga')$q$), 0::bigint, 'nor change a row');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = current_setting('tt.orga')$q$), 0::bigint, 'nor delete one');

-- ---- the first login of an invited user ------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.organization_ensure_user('boris@acme.test', '22222222-2222-2222-2222-222222222222', 'Boris', 'M') AS boris \gset
SELECT tt.eq(:'boris'::jsonb->>'organizationGUID', :'orga', 'he joins the organization that invited him (no organization of his own)');
SELECT tt.eq((SELECT ("rowJSON"->>'memberStatus') || '|' || "rowParentGUID" || '|' || (("rowJSON" ? 'registeredAt')::text) FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') = 'boris@acme.test'),
             'active|22222222-2222-2222-2222-222222222222|true', 'his row is linked, active, registeredAt');
SELECT tt.eq((SELECT count(*) FROM public."personTable" WHERE ("rowJSON"->>'personEmail') = 'boris@acme.test'), 0::bigint, 'autoCreatePerson was false: NO person');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable" WHERE "rowOwnerGUID" = 'boris@acme.test'), 0::bigint, 'and no organization');
-- an invited user with the default flag gets his person
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.organization_invite_user('erik@acme.test') AS inv \gset
SELECT tt.eq(public.organization_invite_user('erik@acme.test'), :'inv', 'inviting twice returns the same invitation');
SELECT tt.fails($q$SELECT public.organization_invite_user('clara@acme.test')$q$, 'already in this organization', 'an active member is not invited again');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('erik@acme.test', '55555555-5555-5555-5555-555555555555', 'Erik', 'P');
SELECT tt.eq((SELECT count(*) FROM public."personTable" WHERE ("rowJSON"->>'personEmail') = 'erik@acme.test'), 1::bigint, 'autoCreatePerson true: his person was made');

-- ---- the person of a user is independent ---------------------------------------------------------------------------------------------------
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT public.person_create_own() AS p1 \gset
SELECT tt.eq(public.person_create_own(), :'p1', 'the user makes his own person from his profile; again = the same person');
SELECT tt.eq((SELECT count(*) FROM public."personTable" WHERE ("rowJSON"->>'personEmail') = 'boris@acme.test'), 1::bigint, 'one person');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('fred@acme.test', '66666666-6666-6666-6666-666666666666', 'Fred', 'N');
DELETE FROM public."personTable" WHERE ("rowJSON"->>'personEmail') = 'fred@acme.test';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.organization_invite_user('fred@acme.test');
SELECT "rowGUID" AS mfred FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') = 'fred@acme.test' AND "rowOwnerGUID" = :'orga' \gset
SELECT public.organization_member_create_person(:'mfred') AS pf \gset
SELECT tt.eq((SELECT "rowGUID" FROM public."personTable" WHERE ("rowJSON"->>'personEmail') = 'fred@acme.test'), :'pf', 'the administrator makes the person of a member from his card');
SELECT tt.eq(public.organization_member_create_person(:'mfred'), :'pf', 'again = the same person');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.organization_member_create_person(%L)$q$, :'mfred'), 'only the administrator', 'a member who is no administrator cannot');

-- ---- the administrator rules ----------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT "rowGUID" AS manna FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga' AND ("rowJSON"->>'userEmailForInvitation') = 'anna@acme.test' \gset
SELECT "rowGUID" AS mboris FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga' AND ("rowJSON"->>'userEmailForInvitation') = 'boris@acme.test' \gset
SELECT tt.fails(format($q$DELETE FROM public."organizationMemberTable" WHERE "rowGUID" = %L$q$, :'manna'), 'cannot delete yourself', 'an administrator cannot delete himself');
SELECT tt.fails(format($q$UPDATE public."organizationMemberTable" SET "rowJSON" = "rowJSON" || '{"organizationAdministrator": false}' WHERE "rowGUID" = %L$q$, :'manna'), 'must keep an administrator', 'the last administrator cannot unmark himself');
UPDATE public."organizationMemberTable" SET "rowJSON" = "rowJSON" || '{"organizationAdministrator": true}' WHERE "rowGUID" = :'mboris';
SELECT tt.eq((SELECT ("rowJSON"->>'organizationAdministrator') FROM public."organizationMemberTable" WHERE "rowGUID" = :'mboris'), 'true', 'he marks another member as administrator');
UPDATE public."organizationMemberTable" SET "rowJSON" = "rowJSON" || '{"organizationAdministrator": false}' WHERE "rowGUID" = :'manna';
SELECT tt.eq((SELECT ("rowJSON"->>'organizationAdministrator') FROM public."organizationMemberTable" WHERE "rowGUID" = :'manna'), 'false', 'with another administrator he can unmark himself');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.organization_is_admin(:'orga'), true, 'boris is the administrator now');
SELECT tt.fails(format($q$DELETE FROM public."organizationMemberTable" WHERE "rowGUID" = %L$q$, :'mboris'), 'cannot delete yourself', 'boris cannot delete himself either');
SELECT tt.fails(format($q$UPDATE public."organizationMemberTable" SET "rowJSON" = "rowJSON" || '{"organizationAdministrator": false}' WHERE "rowGUID" = %L$q$, :'mboris'), 'must keep an administrator', 'the last administrator again');
DELETE FROM public."organizationMemberTable" WHERE "rowGUID" = :'manna';
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowGUID" = :'manna'), 0::bigint, 'ANOTHER administrator deletes anna');

-- a member who owns projects of the organization cannot be removed
SELECT tt.as_admin();
SELECT tt.may_create_projects('erik@acme.test');
SELECT tt.as_user('erik@acme.test', '55555555-5555-5555-5555-555555555555');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
VALUES ('aaaaaaaa-0000-0000-0000-000000000048', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000048'), '55555555-5555-5555-5555-555555555555', '{"name": "Erik project"}');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT "rowGUID" AS merik FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga' AND ("rowJSON"->>'userEmailForInvitation') = 'erik@acme.test' \gset
SELECT tt.fails(format($q$DELETE FROM public."organizationMemberTable" WHERE "rowGUID" = %L$q$, :'merik'), 'owns projects', 'a member who owns projects cannot be removed');

-- an invitation that was not used is withdrawn
SELECT public.organization_invite_user('gita@acme.test') AS ginv \gset
SELECT public.organization_revoke_invitation(:'ginv');
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowGUID" = :'ginv'), 0::bigint, 'revoked = the row is gone');
SELECT tt.fails(format($q$SELECT public.organization_revoke_invitation(%L)$q$, :'merik'), 'no such pending invitation', 'an active member is not an invitation');

-- ---- many organizations: the active one is switched ----------------------------------------------------------------------------------------
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq((SELECT jsonb_array_length(public.organization_my_memberships())), 2::int, 'clara is an active member of 2 organizations');
SELECT tt.eq((SELECT public.organization_my_memberships()->0->>'organizationGUID'), :'orgc', 'the active one first');
SELECT tt.eq((SELECT public.organization_my_memberships()->0->>'isActive'), 'true', '... marked active');
SELECT tt.eq((SELECT public.organization_my_memberships()->1->>'isAdministrator'), 'false', 'she is no administrator of the other');
SELECT tt.fails($q$SELECT public.organization_switch('org-nobody')$q$, 'not a member', 'a switch to a foreign organization is refused');
SELECT public.organization_switch(:'orga');
SELECT tt.eq(public.organization_of_current_user(), :'orga', 'switched');
SELECT tt.as_admin();
SELECT tt.may_create_projects('clara@acme.test');   -- a member of A creates a project there only with the organization level right (PART 46 / 47)
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
VALUES ('cccccccc-0000-0000-0000-000000000048', public.pm_ltree_label('cccccccc-0000-0000-0000-000000000048'), '33333333-3333-3333-3333-333333333333', '{"name": "Clara in A"}');
SELECT tt.eq((SELECT "rowParentGUID" FROM public.project_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000048'), :'orga', 'a new project belongs to the ACTIVE organization');
SELECT tt.eq((SELECT public.organization_my_memberships()->0->>'organizationGUID'), :'orga', 'the list follows the switch');
SELECT tt.fails($q$UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', current_setting('tt.orgc')) WHERE "rowOwnerGUID" = 'clara@acme.test'$q$, 'by an administrator', 'the table itself still cannot be used to change it');

-- accepting = becoming active in the organization and switching to it
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT public.organization_invite_user('hugo@acme.test');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('hugo@acme.test', '77777777-7777-7777-7777-777777777777', 'Hugo', 'V') AS hugo \gset
SELECT tt.eq(:'hugo'::jsonb->>'organizationGUID', :'orga', 'hugo joined by his invitation');

-- ---- the backfill: old data without member rows ---------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
ALTER TABLE public."organizationMemberTable" DISABLE TRIGGER trg_organizationMemberTable_guard;
DELETE FROM public."organizationMemberTable";
ALTER TABLE public."organizationMemberTable" ENABLE TRIGGER trg_organizationMemberTable_guard;
INSERT INTO public."organizationInvitationTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('inv-old-1', :'orgc', '{"inviteEmail": "old1@acme.test", "invitedBy": "clara@acme.test", "status": "pending"}');
INSERT INTO public."organizationInvitationTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('inv-old-2', :'orgc', '{"inviteEmail": "clara@acme.test", "invitedBy": "x@x.test", "status": "revoked"}');
SELECT public.organization_member_backfill();
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orgc' AND ("rowJSON"->>'userEmailForInvitation') = 'clara@acme.test' AND ("rowJSON"->>'organizationAdministrator') = 'true' AND ("rowJSON"->>'memberStatus') = 'active'),
             1::bigint, 'the creator of an old organization is its administrator');
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orga' AND ("rowJSON"->>'userEmailForInvitation') = 'boris@acme.test' AND ("rowJSON"->>'organizationAdministrator') = 'false' AND ("rowJSON"->>'memberStatus') = 'active'),
             1::bigint, 'a user of an old organization is an active member');
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = :'orgc' AND ("rowJSON"->>'userEmailForInvitation') = 'old1@acme.test' AND ("rowJSON"->>'memberStatus') = 'invited'), 1::bigint, 'a pending old invitation is an invited member');
SELECT tt.eq((SELECT ("rowJSON"->>'status') FROM public."organizationInvitationTable" WHERE "rowGUID" = 'inv-old-1'), 'accepted', '... and the old row is marked handled');
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') = 'clara@acme.test' AND "rowOwnerGUID" = :'orgc'), 1::bigint, 'a revoked old invitation makes no row');
SELECT count(*) AS n1 FROM public."organizationMemberTable" \gset
SELECT public.organization_member_backfill();
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable"), :'n1'::bigint, 'the backfill is idempotent');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable" o WHERE NOT EXISTS (SELECT 1 FROM public."organizationMemberTable" m WHERE m."rowOwnerGUID" = o."rowGUID" AND (m."rowJSON"->>'organizationAdministrator') = 'true')),
             0::bigint, 'every organization has an administrator');

-- a deleted organization takes its members with it (also the last administrator)
INSERT INTO public."organizationTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('org-temp', 'temp@x.test', '{"organizationTitle": "Temp", "createdByUser": "temp@x.test"}');
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = 'org-temp'), 1::bigint, 'a new organization gets its creator as the administrator');
DELETE FROM public."organizationTable" WHERE "rowGUID" = 'org-temp';
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = 'org-temp'), 0::bigint, 'deleting the organization deletes its members');

ROLLBACK;
