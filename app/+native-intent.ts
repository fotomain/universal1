// expo-router hook for links that open the app. A share from another app arrives as
// "<scheme>://dataUrl=<scheme>ShareKey": that is not a screen - expo-share-intent reads the shared
// content itself (kit8/providers/WithIntent.tsx), so the app just opens on the home screen.
import { getShareExtensionKey } from 'expo-share-intent';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/home';
    return path;
  } catch {
    return '/home';
  }
}
