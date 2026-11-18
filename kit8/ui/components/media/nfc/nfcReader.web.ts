// Web twin of nfcReader.ts: Web NFC (`NDEFReader`, Chrome on Android over https). Other browsers have no NFC: the screen says so.
import type { NfcAvailability, NfcReaderHandle } from './nfcReaderTypes';
import { RawNdefRecord, RawTag, TNF } from './nfcModel';

const utf8Bytes = (text: string): number[] => Array.from(new TextEncoder().encode(text));
const viewBytes = (data?: DataView | ArrayBuffer | null): number[] => (data ? Array.from(new Uint8Array((data as DataView).buffer ? (data as DataView).buffer.slice((data as DataView).byteOffset, (data as DataView).byteOffset + (data as DataView).byteLength) : (data as ArrayBuffer))) : []);

/** a record of Web NFC (`recordType`, `mediaType`, `data`, `lang`) -> the record of react-native-nfc-manager */
export function rawRecordFromWeb(record: { recordType: string; mediaType?: string | null; data?: DataView | null; lang?: string | null }): RawNdefRecord {
  const data = viewBytes(record.data);
  switch (record.recordType) {
    case 'text': {
      const lang = utf8Bytes(record.lang || 'en');
      return { tnf: TNF.wellKnown, type: [0x54], payload: [lang.length, ...lang, ...data] };
    }
    case 'url':
      return { tnf: TNF.wellKnown, type: [0x55], payload: [0, ...data] };
    case 'absolute-url':
      return { tnf: TNF.absoluteUri, type: utf8Bytes(new TextDecoder().decode(new Uint8Array(data))), payload: [] };
    case 'smart-poster':
      return { tnf: TNF.wellKnown, type: [0x53, 0x70], payload: data };
    case 'mime':
      return { tnf: TNF.mime, type: record.mediaType || 'application/octet-stream', payload: data };
    case 'empty':
      return { tnf: TNF.empty, type: [], payload: [] };
    default:
      return { tnf: record.recordType?.includes(':') ? TNF.external : TNF.unknown, type: record.recordType || '', payload: data };
  }
}

export async function nfcAvailability(): Promise<NfcAvailability> {
  return typeof (globalThis as any).NDEFReader === 'function' ? 'ready' : 'unsupported';
}

export async function startNfcReader(onTag: (tag: RawTag) => void, onClosed: (error?: unknown) => void): Promise<NfcReaderHandle> {
  const Reader = (globalThis as any).NDEFReader;
  if (typeof Reader !== 'function') throw new Error('This browser cannot read NFC tags. Use Chrome on an Android phone, or the phone app.');
  const reader = new Reader();
  const controller = new AbortController();
  reader.onreading = (event: any) => {
    onTag({
      id: String(event.serialNumber || '').replace(/:/g, ''),
      techTypes: ['Ndef'],
      ndefMessage: (event.message?.records ?? []).map(rawRecordFromWeb),
    });
  };
  reader.onreadingerror = () => onClosed(new Error('The tag could not be read. Try again.'));
  await reader.scan({ signal: controller.signal });
  return {
    stop: async () => {
      controller.abort();
    },
  };
}

export async function takeBackgroundTag(): Promise<RawTag | null> {
  return null;
}

export function listenBackgroundTags(_onTag: (tag: RawTag) => void): () => void {
  return () => undefined;
}

export async function openNfcSettings(): Promise<void> {
  // a browser has no such screen
}
