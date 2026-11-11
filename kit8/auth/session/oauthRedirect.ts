// Reads the URL Supabase redirects back to after an OAuth sign-in (Google, Microsoft ...) opened in a browser tab
// on iOS / Android, and turns it into a Supabase session. Pure logic, no React (tested in __tests__/auth/session).
import type { SupabaseClient } from '@supabase/supabase-js';

/** Reads both "?a=b" and "#a=b" parts of a URL (Supabase uses "?code=" with PKCE, "#access_token=" with the implicit flow). */
export function readOAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = (url || '').split(/[?#]/).slice(1);
  parts.forEach((part) =>
    part.split('&').forEach((pair) => {
      const i = pair.indexOf('=');
      if (i <= 0) return;
      try {
        out[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
      } catch {
        // a malformed escape: skip this pair
      }
    })
  );
  return out;
}

/** Makes the session from the redirect URL. Throws an Error (with the provider's words when it sent an error) when there is no session in it. */
export async function sessionFromOAuthRedirect(supabase: Pick<SupabaseClient, 'auth'>, url: string): Promise<void> {
  const params = readOAuthParams(url);
  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error);
  }
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return;
  }
  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
    if (error) throw error;
    return;
  }
  throw new Error('Sign-in redirect carried no session (returned to: ' + (url || '').split(/[?#]/)[0] + ')');
}
