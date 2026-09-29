// Finishes "confirm via web link" sign-ins, mounted once in app/_layout.tsx (SupabaseAuthSync).
//  * iOS / Android: the email link redirects to  <scheme>://signin#access_token=...  (deep link)
//    -> setSession() / exchangeCodeForSession(). Cold start (getInitialURL) and warm start ('url' event).
//  * Web: supabase-js reads the session from the URL itself (detectSessionInUrl); here we only pick up
//    link ERRORS (expired / already used link: #error_code=otp_expired) so the sign-in form can show them.
// Errors are published to subscribers (SignInWithEmailOtp shows them).
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EmailOtpError, completeAuthRedirect, parseAuthRedirectUrl } from '../auth/emailOtp';

// captured at import time, before supabase-js may rewrite the address bar
const initialWebUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null;

type Listener = (error: EmailOtpError | null) => void;
const listeners = new Set<Listener>();
let lastError: EmailOtpError | null = null;

export function publishAuthRedirectError(error: EmailOtpError | null) {
  lastError = error;
  listeners.forEach((l) => l(error));
}

/** Current link error + updates; returns unsubscribe. */
export function subscribeAuthRedirectError(listener: Listener): () => void {
  listeners.add(listener);
  listener(lastError);
  return () => { listeners.delete(listener); };
}

/** Deep link the email should open on this platform (web: <origin>/signin, native: <scheme>://signin). */
export function emailLinkRedirectTo(): string | undefined {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && /^https?:/.test(window.location.origin || '')
      ? `${window.location.origin}/signin`
      : undefined;
  }
  try {
    return Linking.createURL('signin');
  } catch {
    return undefined;
  }
}

const handled = new Set<string>();

export function useAuthRedirectHandler(supabase: Pick<SupabaseClient, 'auth'>) {
  useEffect(() => {
    if (Platform.OS === 'web') {
      const parsed = parseAuthRedirectUrl(initialWebUrl);
      if (parsed?.kind === 'error') {
        publishAuthRedirectError(parsed.error);
        try {
          // drop "#error=..." so a reload does not show it again
          window.history.replaceState(window.history.state, '', window.location.pathname);
        } catch { /* ignore */ }
      }
      return;
    }

    let alive = true;
    const handle = async (url: string | null) => {
      if (!url || handled.has(url) || !parseAuthRedirectUrl(url)) return;
      handled.add(url); // tokens are single use - never apply the same URL twice
      const res = await completeAuthRedirect(supabase, url);
      if (!alive) return;
      publishAuthRedirectError(res.ok ? null : res.error);
      // success: onAuthStateChange(SIGNED_IN) in SupabaseAuthSync stores the user
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => { handle(url); });
    return () => { alive = false; sub.remove(); };
  }, [supabase]);
}

export default useAuthRedirectHandler;
