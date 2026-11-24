// "Create user" of an ID card / passport: the user of the document becomes a member of the ACTIVE organization.
// The member row is saved (organizationMemberTable, SQL PART 45: only an administrator of the organization may) and, when nobody has this e-mail yet,
// the invitation is sent by the Edge Function `organization-invite` - Supabase makes the user of that e-mail (inviteUserByEmail); a registered user is active at once.
import { inviteRowOf, ORGANIZATION_MEMBER_TABLE } from '../../../../../catalog/organization/members/organizationMemberModel';
import { sendInvitation } from '../../../../../catalog/organization/members/inviteMember';

export type CreateUserResult =
  | { ok: true; status: 'created'; /** the e-mail could not be sent: the member row is saved, the text says why */ inviteError?: string }
  | { ok: true; status: 'exists' }
  | { ok: false; error: string };

export async function createUserFromIdDocument(args: { supabase: any; organizationGUID: string; email: string }): Promise<CreateUserResult> {
  const { supabase, organizationGUID, email } = args;
  if (!supabase) return { ok: false, error: 'Not connected.' };
  if (!organizationGUID) return { ok: false, error: 'There is no active organization.' };
  try {
    const { data, error } = await supabase.from(ORGANIZATION_MEMBER_TABLE.table).insert(inviteRowOf(organizationGUID, email, true)).select('rowGUID,rowParentGUID').single();
    if (error) {
      // the unique key (organization + e-mail): this e-mail is a member already
      if (error.code === '23505' || /duplicate key|already/i.test(String(error.message ?? ''))) return { ok: true, status: 'exists' };
      return { ok: false, error: String(error.message ?? error) };
    }
    if (data?.rowParentGUID === 'empty') {
      const sent = await sendInvitation(supabase, data.rowGUID);
      if (!sent.ok) return { ok: true, status: 'created', inviteError: sent.error };
    }
    return { ok: true, status: 'created' };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
