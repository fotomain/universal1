import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../kit8/supabase/supabase';
import { saveUserData, clearUserData } from '../../kit8/lib/localSecureStorage';

WebBrowser.maybeCompleteAuthSession();

// Google sign-in on native goes through Supabase (same account and user id as on web):
// app -> Supabase -> Google -> Supabase -> back to the app at myapp://signin.
// "myapp://signin" must be listed under Supabase > Authentication > URL Configuration > Redirect URLs.
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'myapp', path: 'signin' });

// Reads both "?a=b" and "#a=b" parts of the URL Supabase redirects back to.
const readParams = (url: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const parts = url.split(/[?#]/).slice(1);
  parts.forEach(part =>
    part.split('&').forEach(pair => {
      const i = pair.indexOf('=');
      if (i > 0) out[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
    })
  );
  return out;
};

export function useAuthWithGoogle() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        saveUserData(session.user.id, session.user.email || '');
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ Google Sign-In success (native)');
        console.log('User ID (sub):', session.user.id);
        console.log('Email:', session.user.email);
        setUser(session.user);
        saveUserData(session.user.id, session.user.email || '');
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        clearUserData();
      }
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: REDIRECT_URI, skipBrowserRedirect: true },
      });
      if (error || !data?.url) throw error || new Error('No sign-in URL returned');

      // Open the page in a real browser by package name. Without this, Android can hand the
      // link to Google Play Instant, which shows "Something went wrong. Please go back and try again."
      let browserPackage: string | undefined;
      if (Platform.OS === 'android') {
        try {
          const tabs = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
          browserPackage =
            tabs.preferredBrowserPackage ||
            tabs.defaultBrowserPackage ||
            tabs.servicePackages?.[0] ||
            tabs.browserPackages?.[0];
          console.log('Google sign-in browser:', browserPackage || 'none found', JSON.stringify(tabs));
        } catch (e) {}
      }
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        REDIRECT_URI,
        browserPackage ? { browserPackage } : undefined
      );
      if (result.type !== 'success' || !result.url) {
        console.log('Google sign-in not completed:', result.type);
        return;
      }

      const params = readParams(result.url);
      if (params.error || params.error_description) {
        throw new Error(params.error_description || params.error);
      }
      if (params.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (exchangeError) throw exchangeError;
      } else if (params.access_token && params.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (sessionError) throw sessionError;
      } else {
        throw new Error('Sign-in redirect carried no session (returned to: ' + result.url.split(/[?#]/)[0] + ')');
      }
    } catch (err: any) {
      console.error('Google sign-in failed:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const signOutWithGoogle = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    await clearUserData();
    setUser(null);
    setLoading(false);
  };

  return { user, loading, signIn, signOutWithGoogle, signOut: signOutWithGoogle };
}

export const useAuth = useAuthWithGoogle;
