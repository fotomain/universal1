// The ISO-DEP (ISO 14443-4) channel of iOS / Android: react-native-nfc-manager `requestTechnology(IsoDep)`. The web twin says it is not possible.
import { Platform } from 'react-native';
import NfcManager, { NfcAdapter, NfcTech } from 'react-native-nfc-manager';
import type { IsoDepTransport } from './apdu';
import { tagIdHex } from '../nfcModel';

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
  // Android: READER MODE, not the foreground dispatch of the default. A document that already lies on the phone when the button is pressed (or that the
  // system took as a background tag a moment before) is NOT offered again by the foreground dispatch: the first hold read nothing and the user had to take
  // the document away and hold it again (2026-11-23). Enabling the reader mode restarts the polling of the antenna, so the document in the field is found.
  // A passport / ID card is ISO-DEP of type A or B; no NDEF check (faster, and the chip is not an NDEF tag).
  await NfcManager.requestTechnology(
    NfcTech.IsoDep,
    Platform.OS === 'android'
      ? {
          alertMessage,
          isReaderModeEnabled: true,
          readerModeFlags: NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
        }
      : { alertMessage },
  );
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
    },
  };
}

export const isoDepSupported = (): boolean => true;
