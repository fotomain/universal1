// Web: a browser cannot be started by a tag; nothing to listen for in the background (the NFC screen reads while it is open).
export const NFC_ROUTE = '/media/nfc';

export default function NfcBackgroundHandler() {
  return null;
}
