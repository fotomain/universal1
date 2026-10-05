// The userTable step of every sign-in:
//   1) the user signs in (Google, email code, password - any way)
//   2) the app makes sure the userTable row of that email exists
//   3) userTable.rowGUID -> userState.userGUID -> project.rowOwnerGUID
//
// userTable.rowOwnerGUID = the user's email (lower case, unique) - the only link to Supabase auth.
// userTable.rowGUID      = the user's GUID in the whole app. Users imported from other systems keep
//                          the GUID they had there; a brand-new user gets his Supabase auth uid
//                          (so projects created before this step existed stay his).
// SQL side: kit8/sql/init/done/create_tables.sql ("userTable: THE user record", app_user_guid()).
import * as Crypto from 'expo-crypto';
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

/**
 * Returns the user's GUID (userTable.rowGUID of the email), creating the row on a first sign-in.
 * Needs a signed-in Supabase session of that email (the table is protected per email).
 * Throws when the table cannot be read or written.
 */
export async function loginUserTable(supabase: Pick<SupabaseClient, 'from'>, input: UserTableLoginInput): Promise<string> {
  const email = (input.email || '').trim().toLowerCase();
  if (!email) throw new Error('userTable: the signed-in user has no email');

  const read = async () => {
    const { data, error } = await supabase.from(USER_TABLE).select('rowGUID').eq('rowOwnerGUID', email).maybeSingle();
    if (error) throw new Error('userTable read failed: ' + error.message);
    return (data?.rowGUID as string) || '';
  };

  const existing = await read();
  if (existing) return existing;

  // First sign-in of this email. Try the auth uid first; if that GUID is already taken, a new one.
  const candidates = [isUUID(input.authUID) ? (input.authUID as string) : Crypto.randomUUID(), Crypto.randomUUID()];
  let lastError = '';
  for (const rowGUID of candidates) {
    const { error } = await supabase.from(USER_TABLE).insert({
      rowGUID,
      rowOwnerGUID: email,
      rowJSON: { userEmail: email, userGUID: rowGUID, firstName: input.firstName || '', secondName: input.lastName || '' },
    });
    if (!error) return rowGUID;
    lastError = error.message;
    // Another device / tab of the same user may have created the row a moment ago.
    const now = await read();
    if (now) return now;
  }
  throw new Error('userTable create failed: ' + lastError);
}
