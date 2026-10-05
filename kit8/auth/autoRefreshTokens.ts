// Shared "idle mode" token auto refresh, used by both sign-in patterns:
//   kit8/google/auto_refresh_token   (mobile: expo-auth-session + Google through our auth server)
//   kit8/supabase/auto_refresh_token (web: Supabase + Google, and Supabase email sign-in)
// The user does nothing: a background check renews the tokens shortly before they expire,
// so an open but idle app never gets disconnected.
import { AppState } from 'react-native';

/** Renew the tokens this many minutes before the access token expires. */
export const AUTO_REFRESH_TOKENS_BEFORE_EXPIRED_MINUTES = 5;

/** How often the idle check looks at the expiry time. */
const AUTO_REFRESH_CHECK_EVERY_MS = 30 * 1000;

/** True when the token (expiry in seconds since 1970, as in a JWT "exp") is expired or about to expire. */
export const tokenNeedsRefresh = (expiresAtSec?: number | null) =>
  !expiresAtSec || expiresAtSec * 1000 - Date.now() <= AUTO_REFRESH_TOKENS_BEFORE_EXPIRED_MINUTES * 60 * 1000;

/**
 * Runs `check` now, then every 30 seconds, and again each time the app / browser tab comes back
 * to the foreground (timers are paused while a phone app is in the background).
 * Returns a function that stops it.
 */
export function startAutoRefreshLoop(check: () => Promise<void>) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await check();
    } catch (e: any) {
      console.log('Token auto refresh check failed:', e?.message || e);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(run, AUTO_REFRESH_CHECK_EVERY_MS);
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') run();
  });
  run();
  return () => {
    clearInterval(timer);
    appState.remove();
  };
}
