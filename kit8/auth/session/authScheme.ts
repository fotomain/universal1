// The scheme a native sign-in (Google through the auth server / Supabase, Microsoft through Supabase) comes back to:
// "<authScheme>://signin". It is the app's OWN scheme (app.config.js: extra.authScheme), so two apps installed on one
// phone never fight over the link (Android would ask which app to open). The four older apps keep the shared 'myapp'.
// Every scheme used here must be in Supabase > Authentication > URL Configuration > Redirect URLs (`<scheme>://**`)
// and in the AUTH_APP_SCHEMES of server/auth-server.mjs (its default lists them).
import Constants from 'expo-constants';

export const DEFAULT_AUTH_SCHEME = 'myapp';

/** extra.authScheme of the app config, else 'myapp'. Pure part: takes the value, so a test needs no Constants. */
export function authSchemeOf(extra: { authScheme?: unknown } | null | undefined): string {
  const s = extra?.authScheme;
  return typeof s === 'string' && /^[a-z][a-z0-9+.-]*$/i.test(s) ? s : DEFAULT_AUTH_SCHEME;
}

export const AUTH_SCHEME: string = authSchemeOf(Constants.expoConfig?.extra as any);
