// Google sign-in tokens with auto refresh (mobile pattern, same as expo-w1 WithAuthNative):
// the app signs in through our auth server (server/auth-server.mjs) and keeps the server's
// access + refresh tokens in SecureStore. The access token is short-lived, so it is renewed
// AUTO_REFRESH_TOKENS_BEFORE_EXPIRED_MINUTES before it expires, also while the user is idle.
import * as SecureStore from 'expo-secure-store';
import * as jose from 'jose';
import {
  AUTO_REFRESH_TOKENS_BEFORE_EXPIRED_MINUTES,
  startAutoRefreshLoop,
  tokenNeedsRefresh,
} from '../../auth/autoRefreshTokens';

export { AUTO_REFRESH_TOKENS_BEFORE_EXPIRED_MINUTES };

export const AUTH_BASE_URL = (process.env.EXPO_PUBLIC_AUTH_BASE_URL || 'http://localhost:8089').replace(/\/$/, '');
const ACCESS_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';

export type GoogleTokens = { accessToken?: string; refreshToken?: string; idToken?: string };

/** POST to the auth server. Gives up after 20s so a sign-in button never spins forever. */
export const postAuthJson = async (path: string, body: Record<string, string>) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${AUTH_BASE_URL}${path}`, {
      signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    console.log('Auth server', path, '->', res.status);
    if (!res.ok) {
      const err: any = new Error(data.error_description || data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data as GoogleTokens;
  } finally {
    clearTimeout(timer);
  }
};

const expiresAt = (token: string) => {
  try {
    return (jose.decodeJwt(token) as any).exp || 0;
  } catch (_) {
    return 0;
  }
};

// Screens listen here: a new access token after a refresh, or null when the sign-in has ended.
const listeners = new Set<(accessToken: string | null) => void>();
export const onGoogleTokensChanged = (listener: (accessToken: string | null) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = (accessToken: string | null) => listeners.forEach(l => l(accessToken));

let stopLoop: (() => void) | null = null;
let refreshing: Promise<string | null> | null = null;

const saveTokens = async (tokens: GoogleTokens) => {
  if (tokens.accessToken) await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
};

const clearTokens = async () => {
  stopLoop?.();
  stopLoop = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
};

/**
 * Gets new access + refresh tokens from the auth server. Returns the access token to use.
 * Only one refresh runs at a time (the screens share it).
 * If the server says the refresh token is no longer valid, the sign-in ends (listeners get null).
 * If the server just cannot be reached, the current token is kept and the next check tries again.
 */
export function refreshGoogleTokens(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const access = await SecureStore.getItemAsync(ACCESS_KEY);
    const stillValid = access && expiresAt(access) * 1000 > Date.now() ? access : null;
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) return stillValid;
    try {
      const tokens = await postAuthJson('/api/auth/refresh', { platform: 'native', refreshToken });
      if (!tokens.accessToken) throw new Error('Auth server returned no access token');
      await saveTokens(tokens);
      console.log('Google sign-in tokens refreshed automatically');
      notify(tokens.accessToken);
      return tokens.accessToken;
    } catch (err: any) {
      if (err?.status === 401) {
        console.log('Google sign-in has expired, please sign in again');
        await clearTokens();
        notify(null);
        return null;
      }
      console.log('Google token refresh failed, will try again:', err?.message || err);
      return stillValid;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * Call with the tokens right after a Google sign-in, or with nothing when the app starts
 * (restores the previous sign-in). Starts the idle auto refresh.
 * Returns a valid access token, or null when the user is not signed in.
 */
export async function loginWithGoogleTokenAutoRefresh(tokens?: GoogleTokens): Promise<string | null> {
  if (tokens) {
    await saveTokens(tokens);
    // Tell every screen: the hook is used in several places and all of them must see the new sign-in.
    if (tokens.accessToken) notify(tokens.accessToken);
  }
  let access = await SecureStore.getItemAsync(ACCESS_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!access && !refreshToken) return null;
  if (!access || tokenNeedsRefresh(expiresAt(access))) access = await refreshGoogleTokens();
  if (!stopLoop && (await SecureStore.getItemAsync(REFRESH_KEY))) {
    stopLoop = startAutoRefreshLoop(async () => {
      const current = await SecureStore.getItemAsync(ACCESS_KEY);
      if (!current || tokenNeedsRefresh(expiresAt(current))) await refreshGoogleTokens();
    });
  }
  return access;
}

/** Sign out: stops the auto refresh, removes the tokens from the device and tells every screen. */
export const logoutGoogleTokenAutoRefresh = async () => {
  await clearTokens();
  notify(null);
};

/** fetch() with the access token; on a 401 answer refreshes the token once and tries again. */
export async function fetchWithGoogleAuth(url: string, options: RequestInit = {}) {
  const withToken = (token: string | null) =>
    fetch(url, { ...options, headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const res = await withToken(await SecureStore.getItemAsync(ACCESS_KEY));
  if (res.status !== 401) return res;
  const fresh = await refreshGoogleTokens();
  return fresh ? withToken(fresh) : res;
}
