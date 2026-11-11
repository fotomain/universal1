// files-drive (Supabase Edge Function, Deno). Deploy it yourself:
//   supabase functions deploy files-drive --no-verify-jwt --project-ref <project ref>
//   (--no-verify-jwt: Google's redirect and a <video src> send NO Authorization header; the function checks the caller itself - the JWT for POST via files_authorize, the signed state / link for GET)
//   supabase secrets set GOOGLE_DRIVE_CLIENT_ID=... GOOGLE_DRIVE_CLIENT_SECRET=... FILES_TOKEN_KEY=<base64 of 32 random bytes> FILES_URL_SECRET=<random text> FILES_APP_RETURN_URL=https://<your app url>/user/files
//   optional: FILES_CLEANUP_SECRET=<random text> (the secret header of the pg_cron tick of start3)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every function. The logic is handler.ts (tested in Jest).
// The Google redirect is the url of this function: https://<project>.supabase.co/functions/v1/files-drive (registered at the OAuth client "Files Drive (Edge Function)").
// @ts-nocheck - Deno globals and URL imports are not known to the app's TypeScript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { handleFilesDrive } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CONNECTIONS = 'files_google_connection_table';

const config = {
  clientId: Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') || '',
  clientSecret: Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') || '',
  functionUrl: `${url}/functions/v1/files-drive`,
  appReturnUrl: Deno.env.get('FILES_APP_RETURN_URL') || url,
  tokenKey: Deno.env.get('FILES_TOKEN_KEY') || '',
  urlSecret: Deno.env.get('FILES_URL_SECRET') || '',
  cleanupSecret: Deno.env.get('FILES_CLEANUP_SECRET') || '',
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
    loadConnection: async (organization) => {
      const { data } = await admin.from(CONNECTIONS).select('rowJSON').eq('rowOwnerGUID', organization).filter('rowJSON->>role', 'eq', 'current').maybeSingle();
      return data?.rowJSON ?? null;
    },
    saveConnection: async (organization, patch) => {
      const { data } = await admin.from(CONNECTIONS).select('rowGUID,rowJSON').eq('rowOwnerGUID', organization).filter('rowJSON->>role', 'eq', 'current').maybeSingle();
      if (data) await admin.from(CONNECTIONS).update({ rowJSON: { ...data.rowJSON, ...patch } }).eq('rowGUID', data.rowGUID);
      else await admin.from(CONNECTIONS).insert({ rowOwnerGUID: organization, rowJSON: { role: 'current', ...patch } });
    },
    deleteConnection: async (organization) => {
      await admin.from(CONNECTIONS).delete().eq('rowOwnerGUID', organization);
    },
    patchOrganization: async (organization, patch) => {
      const { data } = await admin.from('organizationTable').select('rowJSON').eq('rowGUID', organization).maybeSingle();
      if (data) await admin.from('organizationTable').update({ rowJSON: { ...data.rowJSON, ...patch } }).eq('rowGUID', organization);
    },
  });
});
