-- WP A2/A3: an OLD database (users without an organization, projects without rowParentGUID) is repaired by running start1_sql_tables.sql + start2_sql_code.sql again
BEGIN;
SELECT tt.as_admin();
-- make the database look like before PART 20
ALTER TABLE public."userTable" DISABLE TRIGGER USER;
ALTER TABLE public."userTable" DROP CONSTRAINT "userTable_userOrganization_chk";
ALTER TABLE public.project_table DISABLE TRIGGER trg_project_table_organization;
ALTER TABLE public.project_table ALTER COLUMN "rowParentGUID" DROP NOT NULL;
-- a user who had an organization before the rule (owned by the catalog), a user who had none, and a user nobody knows
INSERT INTO public."organizationTable" ("rowGUID","rowOwnerGUID","orderInList","rowJSON")
VALUES ('org-legacy', 'organizationCatalog', 1, '{"organizationTitle":"Legacy org","createdByUser":"Legacy@Old.test"}');
INSERT INTO public."userTable" ("rowGUID","rowOwnerGUID","rowJSON") VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', 'legacy@old.test', '{"userEmail":"legacy@old.test","firstName":"Leo"}'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'plain@old.test',  '{"userEmail":"plain@old.test","firstName":"Pia"}');
INSERT INTO public.project_table ("rowGUID","treePath","rowOwnerGUID","rowJSON") VALUES
  ('aaaaaaaa-0000-0000-0000-0000000000a1', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-0000000000a1'::uuid), 'aaaaaaaa-1111-1111-1111-111111111111', '{"name":"old 1"}'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', public.pm_ltree_label('bbbbbbbb-0000-0000-0000-0000000000b1'::uuid), 'bbbbbbbb-2222-2222-2222-222222222222', '{"name":"old 2"}'),
  ('dddddddd-0000-0000-0000-0000000000d1', public.pm_ltree_label('dddddddd-0000-0000-0000-0000000000d1'::uuid), 'dddddddd-3333-3333-3333-333333333333', '{"name":"nobody"}');

\i /sql/start1_sql_tables.sql
\i /sql/start2_sql_code.sql

SELECT tt.eq((SELECT "rowJSON"->>'userOrganization' FROM public."userTable" WHERE "rowOwnerGUID" = 'legacy@old.test'), 'org-legacy', 'the user gets the older organization he created');
SELECT tt.eq((SELECT "rowOwnerGUID" FROM public."organizationTable" WHERE "rowGUID" = 'org-legacy'), 'legacy@old.test', 'which becomes his own (owner = e-mail)');
SELECT tt.eq((SELECT count(*) FROM public."organizationTable" WHERE "rowOwnerGUID" = 'plain@old.test'), 1::bigint, 'a user with none gets a new organization');
SELECT tt.eq((SELECT count(*) FROM public."userTable" WHERE COALESCE("rowJSON"->>'userOrganization','') = ''), 0::bigint, 'no user is left without an organization');
SELECT tt.eq((SELECT "rowParentGUID" FROM public.project_table WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'org-legacy', 'a project gets the organization of its owner');
SELECT tt.eq((SELECT "rowParentGUID" FROM public.project_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-0000000000b1'), (SELECT "rowJSON"->>'userOrganization' FROM public."userTable" WHERE "rowOwnerGUID" = 'plain@old.test'), 'also for the user who had none');
SELECT tt.eq((SELECT "rowParentGUID" FROM public.project_table WHERE "rowGUID" = 'dddddddd-0000-0000-0000-0000000000d1') IS NULL, true, 'a project of an unknown owner stays empty (reported, not invented)');
SELECT tt.eq((SELECT is_nullable FROM information_schema.columns WHERE table_name = 'project_table' AND column_name = 'rowParentGUID'), 'YES', 'so NOT NULL is not set while one is empty');
-- once the orphan is gone the next run sets NOT NULL
DELETE FROM public.project_table WHERE "rowGUID" = 'dddddddd-0000-0000-0000-0000000000d1';
\i /sql/start1_sql_tables.sql
\i /sql/start2_sql_code.sql
SELECT tt.eq((SELECT is_nullable FROM information_schema.columns WHERE table_name = 'project_table' AND column_name = 'rowParentGUID'), 'NO', 'NOT NULL is set when every project has an organization');
ROLLBACK;
