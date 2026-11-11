// Microsoft sign-in through Supabase (provider "azure"). Pure helpers, no React (tested in __tests__/auth/microsoft).
// Setup (done by hand, once): Azure portal > Entra ID > App registrations > client id + secret > Supabase > Authentication > Providers > Azure.
// See README.md in this folder.

/** The name Supabase gives to Microsoft sign-in. */
export const MICROSOFT_PROVIDER = 'azure' as const;

/** The Supabase Azure provider needs the "email" scope, otherwise a personal Microsoft account comes back without its address. */
export const MICROSOFT_SCOPES = 'email';

/** The page the browser comes back to on web: <origin>/user/signin (must match a Redirect URL of Supabase, e.g. http://localhost:8088/**). */
export function microsoftWebRedirectTo(origin: string | undefined | null): string | undefined {
  return origin && /^https?:/.test(origin) ? `${origin}/user/signin` : undefined;
}

/** The arguments of supabase.auth.signInWithOAuth. `skipBrowserRedirect` is for native: the app opens the url itself in a browser tab. */
export function microsoftSignInArgs(redirectTo: string | undefined, skipBrowserRedirect = false) {
  return {
    provider: MICROSOFT_PROVIDER,
    options: { redirectTo, scopes: MICROSOFT_SCOPES, ...(skipBrowserRedirect ? { skipBrowserRedirect: true } : {}) },
  };
}
