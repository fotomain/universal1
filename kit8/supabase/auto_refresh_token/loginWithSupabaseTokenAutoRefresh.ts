// Supabase sign-in with token auto refresh (web pattern: Supabase + Google; also covers
// Supabase email code / password sign-in on every platform).
//
// 1. supabaseAuthOptions keeps the session on the device, so a reload or app restart stays signed in.
// 2. loginWithSupabaseTokenAutoRefresh renews the session AUTO_REFRESH_TOKENS_BEFORE_EXPIRED_MINUTES
//    before it expires, also when the user is idle or the browser tab is hidden
//    (Supabase's own refresh stops while the tab is hidden).
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AUTO_REFRESH_TOKENS_BEFORE_EXPIRED_MINUTES,
  startAutoRefreshLoop,
  tokenNeedsRefresh,
} from '../../auth/autoRefreshTokens';

export { AUTO_REFRESH_TOKENS_BEFORE_EXPIRED_MINUTES };

/** Pass as the third argument of createClient(url, key, supabaseAuthOptions). */
export const supabaseAuthOptions = {
  auth: {
    // Web keeps the session in localStorage by default; phones need AsyncStorage or the session is lost on restart.
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    persistSession: true,
    autoRefreshToken: true,
  },
};

const started = new WeakMap<SupabaseClient, () => void>();

/**
 * Starts the idle auto refresh for this Supabase client. Safe to call many times.
 * Returns a function that stops it.
 */
export function loginWithSupabaseTokenAutoRefresh(supabase: SupabaseClient) {
  // Nothing to refresh while the web pages are pre-rendered on the server.
  if (Platform.OS === 'web' && typeof window === 'undefined') return () => {};
  const existing = started.get(supabase);
  if (existing) return existing;

  const stopLoop = startAutoRefreshLoop(async () => {
    // getSession reads the stored session (another tab may have refreshed it already).
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session || !tokenNeedsRefresh(session.expires_at)) return;
    const { error } = await supabase.auth.refreshSession();
    if (error) console.log('Supabase token auto refresh failed:', error.message);
    else console.log('Supabase token refreshed automatically');
  });
  const stop = () => {
    started.delete(supabase);
    stopLoop();
  };
  started.set(supabase, stop);
  return stop;
}
