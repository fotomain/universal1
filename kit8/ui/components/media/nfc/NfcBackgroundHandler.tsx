// Mounted ONCE in app/_layout.tsx (iOS / Android): "data scan at the background".
//   - a tag that STARTED the app (Android intent filter, see the config plugin in app.config.js) is put into the inbox and the NFC screen opens;
//   - a tag that touches the phone while the app runs but another screen is open (Android hands it over as a background tag) goes
//     into the inbox too, and the red dot of the Scan menu is the number of unseen reads (nfcInbox).
// Not while the ID reading is on the screen (nfcSuppress.ts).
// Nothing is saved without the user: the reads wait in the inbox until "Create media post" or Clear.
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { makeReceived } from './nfcModel';
import { pushNfcRead } from './nfcInbox';
import { listenBackgroundTags, takeBackgroundTag } from './nfcReader';
import { isBackgroundNfcSuppressed } from './nfcSuppress';

export const NFC_ROUTE = '/media/nfc';

export default function NfcBackgroundHandler() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let alive = true;
    const take = async () => {
      const tag = await takeBackgroundTag();
      if (!alive || !tag) return;
      if (isBackgroundNfcSuppressed()) return; // the ID reading is on the screen: the tag is taken (so it does not stay) and ignored
      if (pushNfcRead(makeReceived(tag, 'background'))) router.push(NFC_ROUTE as any);
    };
    void take(); // the app was started by a tag
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void take(); // the app came back to the front because of a tag
    });
    const off = listenBackgroundTags((tag) => {
      if (isBackgroundNfcSuppressed()) return;
      if (pushNfcRead(makeReceived(tag, 'background'))) router.push(NFC_ROUTE as any);
    });
    return () => {
      alive = false;
      sub.remove();
      off();
    };
  }, [router]);

  return null;
}
