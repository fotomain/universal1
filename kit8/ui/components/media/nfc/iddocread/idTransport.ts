// The ISO-DEP (ISO 14443-4) channel of iOS / Android: react-native-nfc-manager `requestTechnology(IsoDep)`. The web twin says it is not possible.
import { Platform } from 'react-native';
import NfcManager, { NfcAdapter, NfcTech } from 'react-native-nfc-manager';
import type { IsoDepTransport } from './apdu';
import { tagIdHex } from '../nfcModel';

/** the first look again after the request is made, then every ... while nothing is found (ms) */
export const NUDGE_FIRST_MS = 300;
export const NUDGE_EVERY_MS = 2500;

export interface OpenTransport extends IsoDepTransport {
  close: () => Promise<void>;
}

/** waits for a card, opens the channel. The caller MUST close it (also on an error). */
export async function openIsoDep(alertMessage = 'Hold the document against the back of the phone and keep it still.'): Promise<OpenTransport> {
  await NfcManager.start();
  // the tag reader of the NFC screen must not hold the antenna
  try {
    await NfcManager.unregisterTagEvent();
  } catch {
    // it was not running
  }
  // Android: READER MODE, not the foreground dispatch of the default (a document that lies on the phone is not offered again by the foreground dispatch).
  // A passport / ID card is ISO-DEP of type A or B; no NDEF check (faster, and the chip is not an NDEF tag).
  // THE FIRST-HOLD RACE (2026-11-23): `requestTechnology` of the library first switches the reader mode on and only THEN tells the native side that a technology
  // is wanted. A document that already lies on the phone is found in that gap, when nobody waits for it yet: the finding is dropped, the request stays open and
  // the user had to take the document away and hold it again. So the reader mode is switched on HERE, the request is made, and the reader mode is switched on
  // AGAIN with other flags: new flags = new discovery parameters = the antenna looks again, and the document in the field is found while the request waits.
  // The same nudge repeats every few seconds while nothing is found. iOS has its own session: nothing of this.
  let nudgeTimer: ReturnType<typeof setInterval> | null = null;
  let nudgeFirst: ReturnType<typeof setTimeout> | null = null;
  let readerModeOn = false;
  try {
    if (Platform.OS === 'android') {
      const base = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK;
      const options = (flags: number) => ({ alertMessage, isReaderModeEnabled: true, readerModeFlags: flags });
      await NfcManager.registerTagEvent(options(base));
      readerModeOn = true;
      const request = NfcManager.requestTechnology(NfcTech.IsoDep, options(base));
      let flip = false;
      const nudge = () => {
        flip = !flip;
        void NfcManager.registerTagEvent(options(flip ? base | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS : base)).catch(() => undefined);
      };
      nudgeFirst = setTimeout(nudge, NUDGE_FIRST_MS);
      nudgeTimer = setInterval(nudge, NUDGE_EVERY_MS);
      await request;
    } else {
      await NfcManager.requestTechnology(NfcTech.IsoDep, { alertMessage });
    }
  } catch (e) {
    if (readerModeOn) await NfcManager.unregisterTagEvent().catch(() => undefined);
    throw e;
  } finally {
    if (nudgeFirst) clearTimeout(nudgeFirst);
    if (nudgeTimer) clearInterval(nudgeTimer);
  }
  // the card computes an elliptic curve exchange: give it time (the Android default is under a second)
  try {
    await (NfcManager as any).setTimeout?.(6000);
  } catch {
    // iOS has no such call
  }
  // what the system knows of the tag (the id of a privacy card is random: it changes with every tap)
  let tag: { id: string; techTypes: string[] } | null = null;
  try {
    const t: any = await NfcManager.getTag();
    if (t) tag = { id: tagIdHex(t.id), techTypes: (t.techTypes ?? []).map((x: string) => String(x).replace(/^android\.nfc\.tech\./, '')) };
  } catch {
    tag = null;
  }
  return {
    tag,
    transceive: (apdu) => NfcManager.isoDepHandler.transceive(apdu),
    close: async () => {
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {
        // already closed
      }
      // the reader mode was switched on by openIsoDep itself (the library only switches off what it switched on)
      if (Platform.OS === 'android') await NfcManager.unregisterTagEvent().catch(() => undefined);
    },
  };
}

/** stops a reading that waits for the document (the screen was left, the flow was wiped): the pending request must not stay, a new one would be refused */
export async function cancelIsoDepWait(): Promise<void> {
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    // nothing was waiting
  }
  if (Platform.OS === 'android') await NfcManager.unregisterTagEvent().catch(() => undefined);
}

export const isoDepSupported = (): boolean => true;
