-- PART 49 (first slice): the Google Drive connection of an organization (documentation/FILE_ATTACHMENT_WBS.html, way C): files_google_connection_table has NO policy and NO grant for a client role,
-- files_connection_status() tells a member the state of HIS organization and never the token.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@files.test', '55555555-5555-5555-5555-555555555501', 'Anna', 'F') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orga \gset
SELECT public.organization_ensure_user('boris@other.test', '55555555-5555-5555-5555-555555555502', 'Boris', 'O') AS boris \gset
SELECT :'boris'::jsonb->>'organizationGUID' AS orgb \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT set_config('tt.orgb', :'orgb', true);

-- the service role (the Edge Function) makes the connection row
INSERT INTO public.files_google_connection_table ("rowOwnerGUID", "rowJSON")
VALUES (:'orga', '{"role":"current","state":"ok","accountEmail":"drive@gmail.test","refreshTokenEncrypted":"SECRET-CIPHERTEXT","lastRefreshAt":"2026-11-11T10:00:00Z"}');
SELECT tt.eq((SELECT count(*) FROM public.files_google_connection_table), 1::bigint, 'one connection row');
SELECT tt.fails($q$INSERT INTO public.files_google_connection_table ("rowOwnerGUID", "rowJSON") VALUES (current_setting('tt.orga'), '{"role":"current"}')$q$, 'duplicate key', 'one current connection per organization');
INSERT INTO public.files_google_connection_table ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"role":"old","state":"ok"}');
SELECT tt.eq((SELECT count(*) FROM public.files_google_connection_table WHERE "rowOwnerGUID" = :'orga'), 2::bigint, '... but a second row with the role old is allowed (the move to another account, later)');

-- a signed-in member: no read, no write, no delete of the table; the state through the function only
SELECT tt.as_user('anna@files.test', '55555555-5555-5555-5555-555555555501');
SELECT tt.fails('SELECT count(*) FROM public.files_google_connection_table', 'permission denied', 'a member cannot read the connection table (no grant)');
SELECT tt.fails($q$UPDATE public.files_google_connection_table SET "rowJSON" = '{}'$q$, 'permission denied', '... nor change it');
SELECT tt.fails($q$DELETE FROM public.files_google_connection_table$q$, 'permission denied', '... nor delete it');
SELECT tt.eq(public.files_connection_status()->>'state', 'ok', 'the member sees the state of his organization');
SELECT tt.eq(public.files_connection_status()->>'accountEmail', 'drive@gmail.test', '... and the account e-mail');
SELECT tt.eq(public.files_connection_status() ? 'refreshTokenEncrypted', false, '... and never the token');
SELECT tt.eq(public.files_connection_status(:'orgb')->>'state', 'notConnected', 'asking for ANOTHER organization gives notConnected');

-- a user of another organization sees notConnected for his own, never the first organization's account
SELECT tt.as_user('boris@other.test', '55555555-5555-5555-5555-555555555502');
SELECT tt.eq(public.files_connection_status()->>'state', 'notConnected', 'another organization: notConnected');
SELECT tt.eq(public.files_connection_status(:'orga')->>'state', 'notConnected', '... also when he asks for the first organization');

-- nobody signed in
SELECT tt.as_admin();
SET LOCAL ROLE anon;
SELECT tt.fails('SELECT count(*) FROM public.files_google_connection_table', 'permission denied', 'anon cannot read the table');
RESET ROLE;

ROLLBACK;
