// The invitation e-mail of a member: the Supabase Edge Function `organization-invite` (supabase/functions/organization-invite). The service role key stays in the function.
// Without the function deployed the call fails and the screen says so; the member row itself is already saved (the invited person can still sign up with that e-mail).
export type InviteResult =
  | { ok: true; sent: boolean; reason?: 'active' | 'registered' }
  | { ok: false; error: string };

export const INVITE_FUNCTION = 'organization-invite';

/** the answer of supabase.functions.invoke({ data, error }) as one result */
export function inviteResultOf(res: { data?: any; error?: any } | null | undefined): InviteResult {
  if (!res) return { ok: false, error: 'No answer from the invitation function.' };
  if (res.error) {
    const detail = res.data?.error ?? res.error?.context?.error ?? res.error?.message ?? String(res.error);
    return { ok: false, error: String(detail) };
  }
  if (res.data?.error) return { ok: false, error: String(res.data.error) };
  return { ok: true, sent: res.data?.sent === true, ...(res.data?.reason ? { reason: res.data.reason } : {}) };
}

export async function sendInvitation(supabase: any, memberGUID: string): Promise<InviteResult> {
  try {
    const res = await supabase.functions.invoke(INVITE_FUNCTION, { body: { memberGUID } });
    return inviteResultOf(res);
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
