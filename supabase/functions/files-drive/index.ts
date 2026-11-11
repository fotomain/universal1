// files-drive (Supabase Edge Function, Deno). Deploy it yourself:
//   supabase functions deploy files-drive --no-verify-jwt --project-ref <project ref>
//   (--no-verify-jwt: Google's redirect and a <video src> send NO Authorization header; the function checks the caller itself - the JWT for POST via files_authorize, the signed state / link for GET)
//   supabase secrets set GOOGLE_DRIVE_CLIENT_ID=... GOOGLE_DRIVE_CLIENT_SECRET=... FILES_TOKEN_KEY=<base64 of 32 random bytes> FILES_URL_SECRET=<random text> FILES_APP_RETURN_URL=https://<your app url>/user/files
//   optional: FILES_CLEANUP_SECRET=<random text> (the secret header of the pg_cron tick of start3)
//   OneDrive (Microsoft Entra app, Web redirect uri = the url of this function): MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT (default common), MICROSOFT_CLIENT_SECRET_EXPIRES (YYYY-MM-DD, for the warning)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every function. The logic is handler.ts (tested in Jest).
// The Google redirect is the url of this function: https://<project>.supabase.co/functions/v1/files-drive (registered at the OAuth client "Files Drive (Edge Function)").
// @ts-nocheck - Deno globals and URL imports are not known to the app's TypeScript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { handleFilesDrive } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// one connection table per storage (PART 49 of start1_sql_tables.sql)
const CONNECTIONS: Record<string, string> = { googleDrive: 'files_google_connection_table', oneDrive: 'files_onedrive_connection_table' };
const tableOf = (provider?: string) => CONNECTIONS[provider || 'googleDrive'] || CONNECTIONS.googleDrive;

const config = {
  clientId: Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') || '',
  clientSecret: Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') || '',
  functionUrl: `${url}/functions/v1/files-drive`,
  appReturnUrl: Deno.env.get('FILES_APP_RETURN_URL') || url,
  tokenKey: Deno.env.get('FILES_TOKEN_KEY') || '',
  urlSecret: Deno.env.get('FILES_URL_SECRET') || '',
  cleanupSecret: Deno.env.get('FILES_CLEANUP_SECRET') || '',
  microsoft: Deno.env.get('MICROSOFT_CLIENT_ID') && Deno.env.get('MICROSOFT_CLIENT_SECRET')
    ? { clientId: Deno.env.get('MICROSOFT_CLIENT_ID')!, clientSecret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!, tenant: Deno.env.get('MICROSOFT_TENANT') || 'common', secretExpires: Deno.env.get('MICROSOFT_CLIENT_SECRET_EXPIRES') || '' }
    : undefined,
};

Deno.serve((req: Request) => {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const asCaller = (authorization: string) => createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  return handleFilesDrive(req, {
    config,
    fetchFn: (input, init) => fetch(input, init),
    authorize: async (authorization, action, scope, guid, project) => {
      const { data, error } = await asCaller(authorization).rpc('files_authorize', { p_action: action, p_scope: scope, p_guid: guid, p_project: project });
      if (error || !data) return { allowed: false, reason: error ? 'signIn' : 'denied' };
      return data;
    },
    callerRpc: async (authorization, fn, args) => {
      const { data, error } = await asCaller(authorization).rpc(fn, args);
      return { data, error: error ? error.message : null };
    },
    serviceRpc: async (fn, args) => {
      const { data, error } = await admin.rpc(fn, args);
      if (error) throw new Error(`${fn}: ${error.message}`);
      return data;
    },
    loadConnection: async (organization, provider) => {
      const { data } = await admin.from(tableOf(provider)).select('rowJSON').eq('rowOwnerGUID', organization).filter('rowJSON->>role', 'eq', 'current').maybeSingle();
      return data?.rowJSON ?? null;
    },
    saveConnection: async (organization, patch, provider) => {
      const table = tableOf(provider);
      const { data } = await admin.from(table).select('rowGUID,rowJSON').eq('rowOwnerGUID', organization).filter('rowJSON->>role', 'eq', 'current').maybeSingle();
      if (data) await admin.from(table).update({ rowJSON: { ...data.rowJSON, ...patch } }).eq('rowGUID', data.rowGUID);
      else await admin.from(table).insert({ rowOwnerGUID: organization, rowJSON: { role: 'current', ...patch } });
    },
    deleteConnection: async (organization, provider) => {
      await admin.from(tableOf(provider)).delete().eq('rowOwnerGUID', organization);
    },
    patchOrganization: async (organization, patch) => {
      const { data } = await admin.from('organizationTable').select('rowJSON').eq('rowGUID', organization).maybeSingle();
      if (data) await admin.from('organizationTable').update({ rowJSON: { ...data.rowJSON, ...patch } }).eq('rowGUID', organization);
    },
  });
});
