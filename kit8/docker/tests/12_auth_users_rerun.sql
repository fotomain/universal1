-- start1_sql_structure.sql run AGAIN on a database that has PART 20 (the organization of a user is obligatory) while Supabase has an auth user without a userTable row:
-- the backfill of PART 1 must not be refused by the guard ("userTable: the organization of the user (rowJSON.userOrganization) is obligatory"); the user gets his organization too.
BEGIN;
SELECT tt.as_admin();
SELECT public.organization_ensure_user('known@acme.test', 'cccccccc-1111-4111-8111-111111111111', 'Kim', 'K') AS known \gset
INSERT INTO auth.users (id, email) VALUES
  ('cccccccc-1111-4111-8111-111111111111', 'Known@Acme.test'),          -- already has his row (any letter case)
  ('dddddddd-2222-4222-8222-222222222222', 'Newbie@Acme.test'),         -- signed up, no userTable row yet
  ('eeeeeeee-3333-4333-8333-333333333333', ''),                         -- no e-mail: skipped
  ('ffffffff-4444-4444-8444-444444444444', NULL);
SELECT tt.eq((SELECT count(*) FROM public."userTable" WHERE "rowOwnerGUID" = 'newbie@acme.test'), 0::bigint, 'before: the new auth user has no userTable row');

\i /sql/start1_sql_structure.sql

SELECT tt.eq((SELECT "rowGUID" FROM public."userTable" WHERE "rowOwnerGUID" = 'newbie@acme.test'), 'dddddddd-2222-4222-8222-222222222222', 'after: he has one, with his auth uid as GUID');
SELECT tt.eq(NULLIF((SELECT "rowJSON"->>'userOrganization' FROM public."userTable" WHERE "rowOwnerGUID" = 'newbie@acme.test'), '') IS NOT NULL, true, '... and an organization');
SELECT tt.eq((SELECT count(*) FROM public."userTable" WHERE "rowOwnerGUID" = 'known@acme.test'), 1::bigint, 'the user who had a row keeps exactly one');
SELECT tt.eq((SELECT "rowJSON"->>'userOrganization' FROM public."userTable" WHERE "rowOwnerGUID" = 'known@acme.test'), :'known'::jsonb->>'organizationGUID', '... with the same organization');
SELECT tt.eq((SELECT count(*) FROM public."userTable" WHERE "rowOwnerGUID" IN ('', 'null')), 0::bigint, 'an auth user without an e-mail gets nothing');
-- a second run changes nothing
SELECT count(*) AS users_before FROM public."userTable" \gset
\i /sql/start1_sql_structure.sql
SELECT tt.eq((SELECT count(*) FROM public."userTable"), :'users_before'::bigint, 'a second run adds no user');
ROLLBACK;
