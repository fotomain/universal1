// expo-router hook for links that open the app. A share from another app arrives as
// "<scheme>://dataUrl=<scheme>ShareKey": that is not a screen - expo-share-intent reads the shared
// content itself (kit8/providers/WithIntent.tsx), so the app just opens on the home screen.
// The return link of a sign-in ("<scheme>://signin") is sent to the sign-in screen /user/signin.
import { getShareExtensionKey } from 'expo-share-intent';
import { signinDeepLinkPath } from '../kit8/auth/session/signinDeepLink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/home';
    // a sign-in comes back to "<scheme>://signin?...": the screen is /user/signin (no route /signin = the 404 page)
    return signinDeepLinkPath(path) ?? path;
  } catch {
    return '/home';
  }
}
