// Android Google sign-in through our own auth server (server/auth-server.mjs).
// Same pattern as expo-w1: the app only talks to the auth server, the server talks to Google,
// and the app keeps the server's access + refresh tokens in SecureStore
// (kit8/google/auto_refresh_token renews them before they expire, also while the user is idle).
// iOS uses useAuth.native.ts and web uses useAuth.web.ts.
import { useState, useEffect, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import {
  AUTH_BASE_URL,
  GoogleTokens,
  loginWithGoogleTokenAutoRefresh,
  logoutGoogleTokenAutoRefresh,
  onGoogleTokensChanged,
  postAuthJson,
} from '../google/auto_refresh_token/loginWithGoogleTokenAutoRefresh';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { randomUUID } from 'expo-crypto';
import * as jose from 'jose';
import { saveUserData, clearUserData } from '../../kit8/lib/localSecureStorage';
import { useSupabase } from '../providers/WithSupabase';

WebBrowser.maybeCompleteAuthSession();

const BASE_URL = AUTH_BASE_URL;

// Return to the sign-in screen, so the app lands on a real route when Android reopens it.
const REDIRECT_URI = makeRedirectUri({ scheme: 'myapp', path: 'signin' });
// The random "state" of the sign-in in progress. Kept in SecureStore so it survives an app reload,
// and checked when the link comes back so that only a sign-in started here can finish here.
const STATE_KEY = 'auth_pending_state';

// Authorization codes already sent to the auth server (a code can only be used once).
const usedCodes = new Set<string>();

// After Google sign-in the app also signs in to Supabase with Google's ID token, so the phone is the
// same Supabase user as on web (projects and other per-user rows are protected by that user id).
// The Supabase user id is remembered here and used as the app's user id.
const SUPABASE_UID_KEY = 'auth_supabase_uid';
let supabaseUid = '';

const userFromToken = (token: string) => {
  const claims: any = jose.decodeJwt(token);
  return { ...claims, id: supabaseUid || claims.sub, displayName: claims.name || '' };
};

export function useAuthWithGoogle() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { supabase } = useSupabase();

  const applyTokens = useCallback(async (tokens: GoogleTokens) => {
    if (!tokens.accessToken) throw new Error('Auth server returned no access token');
    // Show the user as signed in first; saving the tokens must not hold that up.
    const u = userFromToken(tokens.accessToken);
    setUser(u);
    await loginWithGoogleTokenAutoRefresh(tokens); // saves the tokens and starts the auto refresh
    console.log('Auth tokens saved');
    await saveUserData(u.id || '', u.email || '', u.given_name || '', u.family_name || '');
    return u;
  }, []);

  // Restore the previous sign-in when the app starts, and keep it alive with the auto refresh.
  useEffect(() => {
    let cancelled = false;
    // This hook is used on several screens at once. Whichever copy finishes the sign-in, all copies
    // must show the user - otherwise the sign-in screen does not notice it and stays open.
    // null = signed out, or the refresh token is no longer accepted.
    const stopListening = onGoogleTokensChanged(accessToken => {
      if (cancelled) return;
      if (accessToken) {
        setUser(userFromToken(accessToken));
      } else {
        setUser(null);
        clearUserData();
      }
    });
    (async () => {
      try {
        supabaseUid = (await SecureStore.getItemAsync(SUPABASE_UID_KEY)) || '';
        const access = await loginWithGoogleTokenAutoRefresh();
        console.log('Google sign-in restore:', access ? 'signed in' : 'no saved sign-in');
        if (access && !cancelled) setUser(userFromToken(access));
      } catch (err: any) {
        console.log('Session restore skipped:', err?.message || err);
      }
    })();
    return () => { cancelled = true; stopListening(); };
  }, []);

  const exchangeCode = useCallback(async (code: string) => {
    if (!code || usedCodes.has(code)) return;
    usedCodes.add(code);
    setLoading(true);
    console.log('Google sign-in: sending the code to the auth server');
    try {
      const tokens = await postAuthJson('/api/auth/token', { code, platform: 'native' });
      // Sign in to Supabase as the same Google user. Supabase then keeps and refreshes its own session.
      supabaseUid = '';
      if (tokens.idToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: tokens.idToken });
        if (error) {
          console.warn('Supabase sign-in with the Google token failed - projects and other Supabase data will not load:', error.message);
        } else {
          supabaseUid = data.user?.id || '';
          console.log('Supabase sign-in OK, user:', supabaseUid);
        }
      } else {
        console.warn('Auth server sent no Google ID token (restart the auth server) - no Supabase session');
      }
      if (supabaseUid) await SecureStore.setItemAsync(SUPABASE_UID_KEY, supabaseUid);
      else await SecureStore.deleteItemAsync(SUPABASE_UID_KEY);
      const u = await applyTokens(tokens);
      console.log('✅ Google Sign-In success (android)');
      console.log('User ID (sub):', u.id);
      console.log('Email:', u.email);
    } catch (err: any) {
      console.error('Google sign-in failed:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [applyTokens, supabase]);

  // Finishes sign-in from the link Google sign-in came back with: myapp://signin?code=...&state=...
  const handleReturnUrl = useCallback(async (url: string, fromBrowser: boolean) => {
    // Log every link the app is opened with (without the secret parts), so a lost sign-in can be traced.
    console.log('Google sign-in: app opened with link', url.split('?')[0], fromBrowser ? '(from the browser tab)' : '(from Android)');
    if (!url.startsWith('myapp://')) return;
    const query = url.split('?')[1]?.split('#')[0] || '';
    const params: Record<string, string> = {};
    query.split('&').forEach(pair => {
      const i = pair.indexOf('=');
      if (i > 0) params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    });
    if (params.auth_flow !== 'google') {
      console.log('Google sign-in: link is not a Google sign-in reply, parameters:', Object.keys(params).join(',') || 'none');
      return;
    }
    if (params.code && usedCodes.has(params.code)) return; // already handled by the other path

    const expected = await SecureStore.getItemAsync(STATE_KEY);
    if (!expected || params.state !== expected) {
      // An old or foreign link. Only complain when it is the answer to the sign-in just started.
      if (fromBrowser) console.error('Google sign-in failed: the reply does not belong to this sign-in attempt. Please try again.');
      else console.log('Google sign-in: ignored an old sign-in link');
      return;
    }
    if (params.error) {
      await SecureStore.deleteItemAsync(STATE_KEY);
      console.error('Google sign-in failed:', params.error);
      return;
    }
    if (!params.code || usedCodes.has(params.code)) return;
    await SecureStore.deleteItemAsync(STATE_KEY);
    await exchangeCode(params.code);
  }, [exchangeCode]);

  // If Android reopened or reloaded the app with the sign-in link, finish from that link.
  const openedUrl = Linking.useURL();
  useEffect(() => {
    if (openedUrl) handleReturnUrl(openedUrl, false);
    else console.log('Google sign-in: app started without a link');
  }, [openedUrl, handleReturnUrl]);

  const signIn = async () => {
    setLoading(true);
    try {
      const state = randomUUID();
      await SecureStore.setItemAsync(STATE_KEY, state);
      const authUrl =
        `${BASE_URL}/api/auth/authorize?` +
        [
          ['client_id', 'google'], // tells the auth server which provider to use; the real Google client id lives on the server
          ['redirect_uri', REDIRECT_URI],
          ['scope', 'openid profile email'],
          ['state', state],
        ].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

      // Open the sign-in page in a real browser by package name; otherwise Android can hand the
      // link to Google Play Instant, which shows "Something went wrong. Please go back and try again."
      let browserPackage: string | undefined;
      try {
        const tabs = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
        browserPackage =
          tabs.preferredBrowserPackage || tabs.defaultBrowserPackage || tabs.servicePackages?.[0] || tabs.browserPackages?.[0];
        console.log('Google sign-in browser:', browserPackage || 'none found');
      } catch (_) {}

      console.log('Google sign-in: opening the browser, return address', REDIRECT_URI);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI, browserPackage ? { browserPackage } : undefined);
      if (result.type === 'success' && result.url) {
        await handleReturnUrl(result.url, true);
      } else {
        console.log('Google sign-in not completed:', result.type);
      }
    } catch (err: any) {
      console.error('Google sign-in failed:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const signOutWithGoogle = async () => {
    supabaseUid = '';
    await SecureStore.deleteItemAsync(SUPABASE_UID_KEY);
    await supabase.auth.signOut().catch(() => {});
    await logoutGoogleTokenAutoRefresh();
    await clearUserData();
    setUser(null);
    setLoading(false);
  };

  return { user, loading, signIn, signOutWithGoogle, signOut: signOutWithGoogle };
}

export const useAuth = useAuthWithGoogle;
