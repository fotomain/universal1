// The userTable step of every sign-in:
//   1) the user signs in (Google, email code, password - any way)
//   2) the app calls the SQL function organization_ensure_user: ONE transaction makes the organization of the user (the one he owns, else the one
//      he was invited to, else a new one) and the userTable row of that email with userOrganization - a user without an organization cannot exist
//   3) userTable.rowGUID -> userState.userGUID -> project.rowOwnerGUID, and userOrganization -> userState.userOrganization.rowGUID -> project.rowParentGUID
//
// userTable.rowOwnerGUID = the user's email (lower case, unique) - the only link to Supabase auth.
// userTable.rowGUID      = the user's GUID in the whole app. Users imported from other systems keep
//                          the GUID they had there; a brand-new user gets his Supabase auth uid
//                          (so projects created before this step existed stay his).
// SQL side: kit8/sql/start/start_sql_structure.sql (PART 20 create_organization_scope.sql). The client can no longer insert into userTable.
import type { SupabaseClient } from '@supabase/supabase-js';

export const USER_TABLE = 'userTable';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUUID = (value: string | null | undefined) => UUID_RE.test(value || '');

export type UserTableLoginInput = {
  email: string;
  /** Supabase auth uid of the session - used only as the GUID of a user who has no row yet */
  authUID?: string;
  firstName?: string;
  lastName?: string;
};

/** the organization of the signed-in user (userState.userOrganization) */
export type UserOrganization = { rowGUID: string; title: string };

export type UserLogin = { userGUID: string; organization: UserOrganization };

/**
 * Returns the user's GUID (userTable.rowGUID of the email) and his organization, creating both on a first sign-in (organization_ensure_user).
 * Needs a signed-in Supabase session of that email (a user can only ensure himself).
 * Throws when the function fails or answers without a user / an organization: a user without an organization must never be used.
 */
export async function loginUserTable(supabase: Pick<SupabaseClient, 'rpc'>, input: UserTableLoginInput): Promise<UserLogin> {
  const email = (input.email || '').trim().toLowerCase();
  if (!email) throw new Error('userTable: the signed-in user has no email');

  const { data, error } = await supabase.rpc('organization_ensure_user', {
    p_email: email,
    p_auth_uid: input.authUID ?? null,
    p_first_name: input.firstName ?? null,
    p_last_name: input.lastName ?? null,
  });
  if (error) throw new Error('organization_ensure_user failed: ' + error.message);
  const userGUID = String((data as any)?.userGUID || '');
  const organizationGUID = String((data as any)?.organizationGUID || '');
  if (!userGUID || !organizationGUID) throw new Error('organization_ensure_user returned no user or no organization');
  return { userGUID, organization: { rowGUID: organizationGUID, title: String((data as any)?.organizationTitle || '') } };
}
