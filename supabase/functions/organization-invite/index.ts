// organization-invite (Supabase Edge Function, Deno). Deploy it yourself:
//   supabase functions deploy organization-invite
//   supabase secrets set INVITE_REDIRECT_URL=https://<your app url>        (where the e-mail link opens the app)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every function. The logic is handler.ts (tested in Jest).
// @ts-nocheck - Deno globals and URL imports are not known to the app's TypeScript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { handleInvite } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const redirectTo = Deno.env.get('INVITE_REDIRECT_URL') || undefined;
const TABLE = 'organizationMemberTable';

Deno.serve((req: Request) => {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  return handleInvite(req, {
    redirectTo,
    callerEmail: async (authorization) => {
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
      const { data, error } = await caller.auth.getUser();
      return error ? null : (data?.user?.email ?? null);
    },
    loadMember: async (memberGUID) => {
      const { data } = await admin.from(TABLE).select('rowGUID,rowOwnerGUID,rowParentGUID,rowJSON').eq('rowGUID', memberGUID).maybeSingle();
      return data ?? null;
    },
    isAdministrator: async (organizationGUID, email) => {
      const { data } = await admin.from(TABLE).select('rowJSON').eq('rowOwnerGUID', organizationGUID).filter('rowJSON->>userEmailForInvitation', 'eq', email).maybeSingle();
      return data?.rowJSON?.memberStatus === 'active' && data?.rowJSON?.organizationAdministrator === true;
    },
    sendInvitation: async (email, redirect) => {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, redirect ? { redirectTo: redirect } : undefined);
      return error ? String(error.message || error) : null;
    },
    patchMember: async (memberGUID, patch) => {
      const { data } = await admin.from(TABLE).select('rowJSON').eq('rowGUID', memberGUID).maybeSingle();
      if (!data) return;
      await admin.from(TABLE).update({ rowJSON: { ...data.rowJSON, ...patch } }).eq('rowGUID', memberGUID);
    },
  });
});
