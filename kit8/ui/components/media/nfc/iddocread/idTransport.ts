// The ISO-DEP (ISO 14443-4) channel of iOS / Android: react-native-nfc-manager `requestTechnology(IsoDep)`. The web twin says it is not possible.
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
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
  await NfcManager.requestTechnology(NfcTech.IsoDep, { alertMessage });
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
