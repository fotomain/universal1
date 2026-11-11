// "Sign in with Microsoft" (Supabase provider azure).
//   web:    the page goes to Microsoft and comes back to <origin>/user/signin; supabase-js reads the code in the URL by itself.
//   native: app -> Supabase -> Microsoft -> Supabase -> back to myapp://signin in a browser tab (same way and same scheme as Google on native);
//           the app makes the session from the returned url.
// The signed-in user is NOT kept here: the session raises SIGNED_IN and the Sign in screen reacts to it (like for Google).
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { microsoftSignInArgs, microsoftWebRedirectTo } from './microsoftOAuth';
import { sessionFromOAuthRedirect } from '../session/oauthRedirect';

/** The same scheme Google uses on native (app.config.js lists 'myapp'); "myapp://signin" must be a Redirect URL of Supabase. */
const NATIVE_SCHEME = 'myapp';
const NATIVE_PATH = 'signin';

export function useAuthWithMicrosoft(supabase: Pick<SupabaseClient, 'auth'>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (Platform.OS === 'web') {
        const redirectTo = microsoftWebRedirectTo(typeof window !== 'undefined' ? window.location.origin : undefined);
        const { error: oauthError } = await supabase.auth.signInWithOAuth(microsoftSignInArgs(redirectTo) as any);
        if (oauthError) throw oauthError;
        return; // the browser leaves the page; loading stays on until it does
      }

      // native: loaded here so the web bundle and the tests do not need them
      const WebBrowser = require('expo-web-browser');
      const AuthSession = require('expo-auth-session');
      WebBrowser.maybeCompleteAuthSession();
      const redirectUri: string = AuthSession.makeRedirectUri({ scheme: NATIVE_SCHEME, path: NATIVE_PATH });

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth(microsoftSignInArgs(redirectUri, true) as any);
      if (oauthError || !data?.url) throw oauthError || new Error('No sign-in URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type !== 'success' || !result.url) {
        setLoading(false); // closed by the user
        return;
      }
      await sessionFromOAuthRedirect(supabase, result.url);
      setLoading(false);
    } catch (e: any) {
      console.error('Microsoft sign-in failed:', e?.message || e);
      setError(e?.message || 'Microsoft sign-in failed');
      setLoading(false);
    }
  }, [supabase]);

  return { loading, error, signIn };
}

export default useAuthWithMicrosoft;
