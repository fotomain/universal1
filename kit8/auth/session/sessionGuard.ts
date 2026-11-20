// The app keeps TWO notions of "signed in": the saved user in redux (activeUserState: the e-mail on the profile page, the menu)
// and the Supabase session (what the database sees: every RPC, the BIM importer, usePMOwnerGUID).
// The saved user outlives the session (the token could not be renewed, the refresh token was revoked, a 522 outage during the renewal):
// the profile then shows an e-mail while every request is refused. This guard drops the saved user when Supabase REALLY has no session.
import type { SupabaseClient } from '@supabase/supabase-js';

/** Auth events after which "no session" can mean the sign-in is gone (a plain null session of another event proves nothing). */
export const SESSION_LOSS_EVENTS = ['INITIAL_SESSION', 'SIGNED_OUT'] as const;

/**
 * True when the saved user must be dropped: Supabase answered AND said there is no session.
 * An error (offline, 522, timeout) is "unknown": the session may still be in storage and be renewed later - keep the user.
 */
export function sessionIsReallyGone(result: { data?: { session?: unknown } | null; error?: unknown } | null | undefined): boolean {
  if (!result) return false;
  if (result.error) return false;
  return !result.data?.session;
}

/** Runs after an auth event with a null session; `onGone` is called only when the session is really gone. */
export async function dropSavedUserWhenSessionGone(
  supabase: Pick<SupabaseClient, 'auth'>,
  event: string,
  session: unknown,
  isLoggedIn: () => boolean,
  onGone: () => void,
): Promise<boolean> {
  if (session) return false;
  if (!(SESSION_LOSS_EVENTS as readonly string[]).includes(event)) return false;
  if (!isLoggedIn()) return false;
  try {
    const result = await supabase.auth.getSession();
    if (!sessionIsReallyGone(result)) return false;
    if (!isLoggedIn()) return false; // the user signed in again while we asked
    onGone();
    return true;
  } catch {
    return false; // could not ask: keep the user
  }
}
