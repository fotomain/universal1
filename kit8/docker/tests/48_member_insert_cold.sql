-- PART 45: a USER (role authenticated) adds a member row as the FIRST guard call of its transaction (a real request).
-- Why its own file: PostgreSQL checks EXECUTE of a function only when it first builds the expression in a transaction; test 48 warms the guard as postgres
-- (organization_ensure_user), so a REVOKEd helper called by the guard is not noticed there ("permission denied for function organization_member_user_guid" on Supabase).
BEGIN;
SELECT tt.as_admin();
SET LOCAL session_replication_role = replica;   -- setup without the guard trigger: nothing may call it as postgres before the user does
SELECT public.organization_ensure_user('anna@cold.test', '11111111-1111-1111-1111-1111111111a1', 'Anna', 'K') AS anna \gset
SELECT public.organization_ensure_user('clara@cold.test', '33333333-3333-3333-3333-3333333333c3', 'Clara', 'K') AS clara \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orga \gset
UPDATE public."organizationMemberTable" SET "rowJSON" = "rowJSON" || '{"organizationAdministrator": true}' WHERE "rowOwnerGUID" = :'orga' AND "rowJSON"->>'userEmailForInvitation' = 'anna@cold.test';
SET LOCAL session_replication_role = origin;
SELECT set_config('tt.orga', :'orga', true);
SELECT tt.as_user('anna@cold.test', '11111111-1111-1111-1111-1111111111a1');
SELECT tt.eq(public.organization_is_admin(:'orga'), true, 'anna is the administrator');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "newbie@cold.test"}');
SELECT tt.eq((SELECT ("rowJSON"->>'memberStatus') || '|' || "rowParentGUID" FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') = 'newbie@cold.test'),
             'invited|empty', 'a cold insert by the administrator: an unknown e-mail is INVITED');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "clara@cold.test"}');
SELECT tt.eq((SELECT ("rowJSON"->>'memberStatus') || '|' || "rowParentGUID" FROM public."organizationMemberTable" WHERE ("rowJSON"->>'userEmailForInvitation') = 'clara@cold.test'),
             'active|33333333-3333-3333-3333-3333333333c3', 'a registered user is ACTIVE at once');
-- the lookup is for an administrator only: a stranger gets nothing
SELECT tt.as_user('clara@cold.test', '33333333-3333-3333-3333-3333333333c3');
SELECT tt.eq(public.organization_member_lookup_user(:'orga', 'clara@cold.test'), NULL, 'a non administrator gets no user from the lookup');
SELECT tt.fails($q$SELECT public.organization_member_user_guid('clara@cold.test')$q$, 'permission denied', 'the raw helper stays closed to a user');
ROLLBACK;
