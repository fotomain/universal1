// NFC reader of iOS and Android: react-native-nfc-manager (the best maintained NFC package for Expo: config plugin, NDEF read / write,
// tag technologies; no Expo module reads tags). The web twin is nfcReader.web.ts (Web NFC, Chrome on Android).
//
//   Android: reader mode - every tag that touches the phone while the screen is open arrives (many tags, one after the other, no button).
//            A tag that touches the phone while the app is closed / in the background starts the app (intent filter of the config plugin in
//            app.config.js) and `takeBackgroundTag()` gives it.
//   iOS:     a read session (the system sheet "Ready to scan"); it ends after the system time limit and is started again by the screen.
//            The system reads tags with a URL in the background by itself and opens the app (needs a universal link / associated domain).
import { Platform } from 'react-native';
import NfcManager, { NfcAdapter, NfcEvents } from 'react-native-nfc-manager';
import type { RawTag } from './nfcModel';

import type { NfcAvailability, NfcReaderHandle } from './nfcReaderTypes';

export type { NfcAvailability, NfcReaderHandle };

let started = false;
async function ensureStarted() {
  if (started) return;
  await NfcManager.start();
  started = true;
}

export async function nfcAvailability(): Promise<NfcAvailability> {
  try {
    if (!(await NfcManager.isSupported())) return 'unsupported';
    await ensureStarted();
    return (await NfcManager.isEnabled()) ? 'ready' : 'disabled';
  } catch {
    return 'unsupported';
  }
}

/**
 * Starts reading. `onTag` is called for EVERY tag read; `onClosed(error)` when the system ended the session (iOS: time limit, the user
 * pressed Cancel; Android: never by itself). The returned handle stops the reader.
 */
export async function startNfcReader(onTag: (tag: RawTag) => void, onClosed: (error?: unknown) => void): Promise<NfcReaderHandle> {
  await ensureStarted();
  NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag) => onTag(tag as RawTag));
  NfcManager.setEventListener(NfcEvents.SessionClosed, (error) => onClosed(error));
  try {
    await NfcManager.registerTagEvent(
      Platform.OS === 'android'
        ? {
            isReaderModeEnabled: true,
            // all the common tag families; the NDEF message is read for us (no SKIP_NDEF_CHECK)
            readerModeFlags: NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V,
          }
        : { alertMessage: 'Hold the top of your iPhone near the NFC tag.', invalidateAfterFirstRead: false },
    );
  } catch (error) {
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    throw error;
  }
  return {
    stop: async () => {
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      NfcManager.setEventListener(NfcEvents.SessionClosed, null);
      try {
        await NfcManager.unregisterTagEvent();
      } catch {
        // the session is already closed
      }
    },
  };
}

/**
 * ONE call at a time. The Android side of react-native-nfc-manager hands its cached tag object to JavaScript ONCE; a second `getBackgroundTag`
 * before `clearBackgroundTag` has finished crashes the whole app (`ObjectAlreadyConsumedException` in `NfcManager.getBackgroundTag`, seen on the Samsung right
 * after pressing Scan: the app came to the front twice in a row and the handler asked twice). So callers that arrive while a call is running share its answer.
 */
let taking: Promise<RawTag | null> | null = null;

/** the tag that STARTED the app (Android intent filter); null when the app was not started by a tag. The tag is taken once and cleared. */
export function takeBackgroundTag(): Promise<RawTag | null> {
  if (taking) return taking;
  taking = (async () => {
    try {
      await ensureStarted();
      const tag = (await NfcManager.getBackgroundTag()) as RawTag | null;
      // always clear what was taken (also when something below fails): a tag left in the native cache is the next crash
      if (tag) {
        try {
          await NfcManager.clearBackgroundTag();
        } catch {
          // nothing to clear
        }
      }
      return tag ?? null;
    } catch {
      return null;
    } finally {
      taking = null;
    }
  })();
  return taking;
}

/** a tag that touches the phone while the app is running but another screen is open (Android delivers it as a background tag) */
export function listenBackgroundTags(onTag: (tag: RawTag) => void): () => void {
  try {
    NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag, (tag) => onTag(tag as RawTag));
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag, null);
    } catch {
      // nothing to remove
    }
  };
}

/** Android: the system NFC switch */
export async function openNfcSettings(): Promise<void> {
  try {
    await (NfcManager as any).goToNfcSetting?.();
  } catch {
    // no such screen
  }
}
