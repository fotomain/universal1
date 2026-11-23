// Web: a browser cannot talk to a smart card over NFC (Web NFC reads NDEF tags only), so the ID reader is not available.
import type { IsoDepTransport } from './apdu';

export interface OpenTransport extends IsoDepTransport {
  close: () => Promise<void>;
}

export async function openIsoDep(): Promise<OpenTransport> {
  throw new Error('A browser cannot read an ID card or passport over NFC. Use the phone app.');
}

export async function cancelIsoDepWait(): Promise<void> {
  // nothing waits in a browser
}

export const isoDepSupported = (): boolean => false;
