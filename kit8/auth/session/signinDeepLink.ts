// The link a sign-in comes back with on iOS / Android is "<scheme>://signin?..." (Google through the auth server,
// Google / Microsoft through Supabase, the e-mail link): that address is registered at the providers and must not change.
// The SCREEN of the app is /user/signin, so expo-router has no route "/signin" and showed the 404 page (app/+not-found.tsx)
// after a successful sign-in. app/+native-intent.ts sends such a link to the real screen; the hooks still read the
// code / tokens from the original link (Linking), so the query and the hash only have to survive. Pure: no React.
export const SIGNIN_SCREEN = '/user/signin';

/** 'myapp://signin?code=1' | '/signin#access_token=…' | 'signin' -> '/user/signin…'; any other path -> null */
export function signinDeepLinkPath(path: string | null | undefined): string | null {
  const raw = String(path || '');
  const noScheme = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '').replace(/^\/+/, '');
  const cut = noScheme.search(/[?#]/);
  const route = (cut < 0 ? noScheme : noScheme.slice(0, cut)).replace(/\/+$/, '');
  if (route !== 'signin') return null;
  return SIGNIN_SCREEN + (cut < 0 ? '' : noScheme.slice(cut));
}
