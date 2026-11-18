// NFC tags: what an NDEF record says. Pure: no React, no native module (react-native-nfc-manager hands the plain data of a tag).

/** the shape of `TagEvent` / `NdefRecord` of react-native-nfc-manager (copied: this file must not import the native module) */
export interface RawNdefRecord {
  id?: number[] | string;
  tnf: number;
  type: number[] | string;
  payload: number[] | Uint8Array;
}
export interface RawTag {
  id?: string;
  type?: string;
  techTypes?: string[];
  maxSize?: number;
  isWritable?: boolean;
  ndefMessage?: RawNdefRecord[];
}

/** Type Name Format of an NDEF record */
export const TNF = { empty: 0, wellKnown: 1, mime: 2, absoluteUri: 3, external: 4, unknown: 5, unchanged: 6 } as const;

const URI_PREFIX = [
  '', 'http://www.', 'https://www.', 'http://', 'https://', 'tel:', 'mailto:', 'ftp://anonymous:anonymous@', 'ftp://ftp.', 'ftps://', 'sftp://',
  'smb://', 'nfs://', 'ftp://', 'dav://', 'news:', 'telnet://', 'imap:', 'rtsp://', 'urn:', 'pop:', 'sip:', 'sips:', 'tftp:', 'btspp://',
  'btl2cap://', 'btgoep://', 'tcpobex://', 'irdaobex://', 'file://', 'urn:epc:id:', 'urn:epc:tag:', 'urn:epc:pat:', 'urn:epc:raw:', 'urn:epc:', 'urn:nfc:',
];

export type NfcRecordKind = 'text' | 'uri' | 'smartPoster' | 'mime' | 'external' | 'empty' | 'unknown';

export interface NfcRecordInfo {
  kind: NfcRecordKind;
  /** 'Text', 'Link', 'Phone number' ... */
  label: string;
  /** the readable content ('' when there is none) */
  text: string;
  /** where "Open" goes ('' = nothing) */
  openUrl: string;
  /** language of a text record */
  lang?: string;
  /** the mime type / external type, for the details */
  typeName?: string;
  /** how many bytes the payload has */
  size: number;
}

const bytesOf = (v: number[] | Uint8Array | undefined): number[] => (v ? Array.from(v).map((n) => n & 0xff) : []);

/** the type of a record as text ('T', 'U', 'Sp', 'text/plain') */
export function typeText(type: number[] | string | undefined): string {
  if (typeof type === 'string') return type;
  return bytesOf(type).map((b) => String.fromCharCode(b)).join('');
}

/** UTF-8 bytes -> text (no TextDecoder in every JS engine of a phone: a small decoder) */
export function utf8(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i += 1; }
    else if (b >= 0xc0 && b < 0xe0 && i + 1 < bytes.length) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if (b >= 0xe0 && b < 0xf0 && i + 2 < bytes.length) { out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    else if (b >= 0xf0 && i + 3 < bytes.length) {
      const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(cp);
      i += 4;
    } else { out += '�'; i += 1; }
  }
  return out;
}

function utf16(bytes: number[], littleEndian: boolean): string {
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode(littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
  return out;
}

/** payload of a well known Text record: status byte (bit 7 = UTF-16, bits 0-5 = length of the language code), language, text */
export function decodeTextPayload(payload: number[]): { text: string; lang: string } {
  if (!payload.length) return { text: '', lang: '' };
  const status = payload[0];
  const langLength = status & 0x3f;
  const lang = payload.slice(1, 1 + langLength).map((b) => String.fromCharCode(b)).join('');
  const body = payload.slice(1 + langLength);
  if (status & 0x80) {
    // UTF-16 with or without a byte order mark
    if (body[0] === 0xff && body[1] === 0xfe) return { text: utf16(body.slice(2), true), lang };
    if (body[0] === 0xfe && body[1] === 0xff) return { text: utf16(body.slice(2), false), lang };
    return { text: utf16(body, false), lang };
  }
  return { text: utf8(body), lang };
}

/** payload of a well known URI record: one byte = a prefix of the table, then the rest */
export function decodeUriPayload(payload: number[]): string {
  if (!payload.length) return '';
  const prefix = URI_PREFIX[payload[0]] ?? '';
  return prefix + utf8(payload.slice(1));
}

function uriLabel(uri: string): string {
  if (/^tel:/i.test(uri)) return 'Phone number';
  if (/^mailto:/i.test(uri)) return 'E-mail';
  if (/^sms:/i.test(uri)) return 'SMS';
  if (/^geo:/i.test(uri)) return 'Location';
  if (/^https?:\/\//i.test(uri)) return 'Link';
  return 'Address';
}

/** the records of an embedded NDEF message (a Smart Poster holds a URI + a title) */
export function decodeEmbeddedMessage(bytes: number[]): RawNdefRecord[] {
  const out: RawNdefRecord[] = [];
  let i = 0;
  while (i < bytes.length) {
    const header = bytes[i++];
    const shortRecord = !!(header & 0x10);
    const hasId = !!(header & 0x08);
    const typeLength = bytes[i++] ?? 0;
    let payloadLength = 0;
    if (shortRecord) payloadLength = bytes[i++] ?? 0;
    else { payloadLength = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0; i += 4; }
    const idLength = hasId ? bytes[i++] ?? 0 : 0;
    const type = bytes.slice(i, i + typeLength); i += typeLength;
    const id = bytes.slice(i, i + idLength); i += idLength;
    const payload = bytes.slice(i, i + payloadLength); i += payloadLength;
    out.push({ tnf: header & 0x07, type, id, payload });
    if (header & 0x40) break; // message end
  }
  return out;
}

export function describeRecord(record: RawNdefRecord): NfcRecordInfo {
  const payload = bytesOf(record.payload);
  const type = typeText(record.type);
  const base = { size: payload.length };
  if (record.tnf === TNF.empty) return { ...base, kind: 'empty', label: 'Empty record', text: '', openUrl: '' };
  if (record.tnf === TNF.wellKnown) {
    if (type === 'T') {
      const { text, lang } = decodeTextPayload(payload);
      return { ...base, kind: 'text', label: 'Text', text, lang, openUrl: '' };
    }
    if (type === 'U') {
      const uri = decodeUriPayload(payload);
      return { ...base, kind: 'uri', label: uriLabel(uri), text: uri, openUrl: uri };
    }
    if (type === 'Sp') {
      const inner = decodeEmbeddedMessage(payload).map(describeRecord);
      const uri = inner.find((r) => r.kind === 'uri');
      const title = inner.find((r) => r.kind === 'text');
      return { ...base, kind: 'smartPoster', label: 'Smart poster', text: [title?.text, uri?.text].filter(Boolean).join('\n'), openUrl: uri?.openUrl ?? '' };
    }
  }
  if (record.tnf === TNF.absoluteUri) {
    const uri = type ? type : utf8(payload);
    return { ...base, kind: 'uri', label: uriLabel(uri), text: uri, openUrl: uri };
  }
  if (record.tnf === TNF.mime) {
    const printable = /^(text\/|application\/(json|xml|vnd\.wfa\.wsc))/i.test(type) && !/vnd\.wfa\.wsc/i.test(type);
    return { ...base, kind: 'mime', label: type || 'Data', typeName: type, text: printable ? utf8(payload) : '', openUrl: '' };
  }
  if (record.tnf === TNF.external) return { ...base, kind: 'external', label: 'External record', typeName: type, text: utf8(payload).replace(/[^\x20-\x7e -￿]/g, ''), openUrl: '' };
  return { ...base, kind: 'unknown', label: 'Unknown record', typeName: type, text: '', openUrl: '' };
}

export interface NfcTagInfo {
  /** hex of the tag id, upper case, '' when the system does not give it */
  id: string;
  /** 'Ndef', 'NfcA' ... joined for the list */
  techTypes: string[];
  /** 'MIFARE Ultralight', 'NFC Forum Type 2' ... from `tag.type`, else '' */
  typeName: string;
  records: NfcRecordInfo[];
  /** bytes the tag can hold, 0 = unknown */
  capacity: number;
  /** a tag with an NDEF message that could be read */
  hasMessage: boolean;
  writable: boolean | null;
  /** the first thing to open (link / phone / mail) */
  openUrl: string;
  /** one line for a list: 'Link · https://…' */
  summary: string;
  /** every readable line of the tag, one per line (the media post) */
  text: string;
}

const shortId = (id: string) => (id.length > 8 ? `${id.slice(0, 8)}…` : id);

/** the tag id as hex: Android gives a hex string, iOS may give bytes */
export function tagIdHex(id: unknown): string {
  if (Array.isArray(id)) return id.map((b) => (Number(b) & 0xff).toString(16).padStart(2, '0')).join('').toUpperCase();
  return String(id ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

export function describeTag(tag: RawTag | null | undefined): NfcTagInfo {
  const records = (tag?.ndefMessage ?? []).map(describeRecord);
  const id = tagIdHex(tag?.id);
  const first = records.find((r) => r.text || r.openUrl);
  const firstUrl = records.find((r) => r.openUrl)?.openUrl ?? '';
  const readable = records.filter((r) => r.text).map((r) => (r.kind === 'text' ? r.text : `${r.label}: ${r.text}`));
  const summary = first ? `${first.label} · ${first.text.split('\n')[0].slice(0, 80)}` : id ? `Tag ${shortId(id)} · no readable message` : 'Tag with no readable message';
  return {
    id,
    techTypes: (tag?.techTypes ?? []).map((t) => String(t).replace(/^android\.nfc\.tech\./, '').replace(/^NFC/, 'Nfc')),
    typeName: String(tag?.type ?? ''),
    records,
    capacity: Number(tag?.maxSize) || 0,
    hasMessage: records.length > 0,
    writable: typeof tag?.isWritable === 'boolean' ? tag.isWritable : null,
    openUrl: firstUrl,
    summary,
    text: [id ? `Tag id: ${id}` : '', ...readable].filter(Boolean).join('\n'),
  };
}

/** a tag that was read: what the screen keeps */
export interface NfcReceived {
  /** local id of this read (a tag read twice = two entries) */
  key: string;
  at: number;
  /** 'foreground' = the screen was open, 'background' = the tag started the app / was read while the app was not on this screen */
  source: 'foreground' | 'background';
  info: NfcTagInfo;
}

let counter = 0;
export function makeReceived(tag: RawTag, source: NfcReceived['source'], now: number = Date.now()): NfcReceived {
  counter += 1;
  return { key: `nfc-${now}-${counter}`, at: now, source, info: describeTag(tag) };
}

/** the same tag read again within this time is one read (the reader reports a tag that stays on the phone many times) */
export const NFC_REPEAT_MS = 2000;
export function isRepeatRead(previous: NfcReceived | undefined, next: NfcTagInfo, now: number): boolean {
  if (!previous) return false;
  return previous.info.id === next.id && previous.info.text === next.text && now - previous.at < NFC_REPEAT_MS;
}

/** the list keeps this many reads; older ones fall off */
export const NFC_INBOX_LIMIT = 50;
