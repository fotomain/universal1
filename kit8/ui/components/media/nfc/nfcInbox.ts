// The reads of the NFC tags of this run of the app, newest first. A tiny store (no redux): the live reader of the NFC screen AND the
// background handler (a tag that started the app) put reads in; NFCReceivedInfo shows them. Not saved: a read is kept by "Create media post".
import { isRepeatRead, NFC_INBOX_LIMIT, NfcReceived } from './nfcModel';

type Listener = () => void;
let items: NfcReceived[] = [];
const listeners = new Set<Listener>();

export const getNfcInbox = (): NfcReceived[] => items;

export const subscribeNfcInbox = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** adds a read at the top; returns false when it is the same tag read again a moment ago */
export function pushNfcRead(read: NfcReceived): boolean {
  if (isRepeatRead(items[0], read.info, read.at)) return false;
  items = [read, ...items].slice(0, NFC_INBOX_LIMIT);
  listeners.forEach((l) => l());
  return true;
}

export function removeNfcRead(key: string) {
  items = items.filter((i) => i.key !== key);
  listeners.forEach((l) => l());
}

export function clearNfcInbox() {
  items = [];
  listeners.forEach((l) => l());
}
