// QR code / barcode scanner: what a code says and what to offer for it. Pure: no React, no native module.

/** the names of the code types of Vision Camera `useCodeScanner` (CodeType) */
export const SCAN_CODE_TYPES = [
  'qr', 'aztec', 'data-matrix', 'pdf-417',
  'ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'code-39', 'code-93', 'codabar', 'itf', 'itf-14',
] as const;
export type ScanCodeType = (typeof SCAN_CODE_TYPES)[number];

const FORMAT_LABEL: Record<string, string> = {
  qr: 'QR code', aztec: 'Aztec code', 'data-matrix': 'Data Matrix', 'pdf-417': 'PDF417',
  'ean-13': 'EAN-13', 'ean-8': 'EAN-8', 'upc-a': 'UPC-A', 'upc-e': 'UPC-E',
  'code-128': 'Code 128', 'code-39': 'Code 39', 'code-93': 'Code 93', codabar: 'Codabar', itf: 'ITF', 'itf-14': 'ITF-14',
};

/** the web `BarcodeDetector` names its formats with an underscore ('qr_code', 'ean_13') */
export function normalizeCodeType(raw: string | undefined | null): string {
  const t = String(raw || '').trim().toLowerCase().replace(/_/g, '-');
  if (t === 'qr-code') return 'qr';
  if (t === 'data-matrix' || t === 'datamatrix') return 'data-matrix';
  if (t === 'pdf417') return 'pdf-417';
  if (t === 'code-39' || t === 'code39') return 'code-39';
  if (t === 'code-93' || t === 'code93') return 'code-93';
  if (t === 'code-128' || t === 'code128') return 'code-128';
  if (t === 'ean13') return 'ean-13';
  if (t === 'ean8') return 'ean-8';
  if (t === 'upca') return 'upc-a';
  if (t === 'upce') return 'upc-e';
  return t;
}

export const formatLabel = (raw: string | undefined | null) => FORMAT_LABEL[normalizeCodeType(raw)] ?? (String(raw || '').trim() || 'Code');

/** the one-dimensional product codes (a shop article) */
export const isProductFormat = (raw: string | undefined | null) => ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'itf-14'].includes(normalizeCodeType(raw));

export type ScanKind = 'link' | 'email' | 'phone' | 'sms' | 'wifi' | 'geo' | 'contact' | 'event' | 'product' | 'text';

export interface ScanInfo {
  kind: ScanKind;
  /** 'Link', 'E-mail', 'Wi-Fi network' ... */
  label: string;
  /** the text to show, ONE line per fact ('Network: Home', 'Password: ...') */
  lines: string[];
  /** where "Open" goes (https://, mailto:, tel:, sms:, geo:), '' = nothing to open */
  openUrl: string;
}

const KIND_LABEL: Record<ScanKind, string> = {
  link: 'Link', email: 'E-mail', phone: 'Phone number', sms: 'SMS', wifi: 'Wi-Fi network', geo: 'Location',
  contact: 'Contact card', event: 'Calendar event', product: 'Product code', text: 'Text',
};
export const kindLabel = (kind: ScanKind) => KIND_LABEL[kind];

/** `WIFI:T:WPA;S:Home;P:secret;H:false;;` -> fields (a backslash escapes ; , : " \) */
export function parseWifi(value: string): { ssid: string; password: string; security: string; hidden: boolean } | null {
  const body = /^WIFI:/i.exec(value) ? value.slice(5) : null;
  if (body == null) return null;
  const fields: Record<string, string> = {};
  let key = '';
  let cur = '';
  let inKey = true;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < body.length) {
      cur += body[i + 1];
      i += 1;
    } else if (inKey && ch === ':') {
      key = cur;
      cur = '';
      inKey = false;
    } else if (!inKey && ch === ';') {
      fields[key.toUpperCase()] = cur;
      cur = '';
      key = '';
      inKey = true;
    } else if (inKey && ch === ';') {
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (!inKey && key) fields[key.toUpperCase()] = cur;
  if (!fields.S) return null;
  return { ssid: fields.S, password: fields.P ?? '', security: fields.T || 'nopass', hidden: /^true$/i.test(fields.H ?? '') };
}

/** a vCard / MECARD: name, phone, e-mail, organisation */
function parseContact(value: string): string[] {
  const lines: string[] = [];
  if (/^MECARD:/i.test(value)) {
    for (const part of value.slice(7).split(';')) {
      const i = part.indexOf(':');
      if (i < 1) continue;
      const k = part.slice(0, i).toUpperCase();
      const v = part.slice(i + 1).replace(/,/g, ' ').trim();
      if (!v) continue;
      if (k === 'N') lines.push(`Name: ${v}`);
      else if (k === 'TEL') lines.push(`Phone: ${v}`);
      else if (k === 'EMAIL') lines.push(`E-mail: ${v}`);
      else if (k === 'ORG') lines.push(`Organisation: ${v}`);
      else if (k === 'ADR') lines.push(`Address: ${v}`);
    }
    return lines;
  }
  for (const raw of value.split(/\r?\n/)) {
    const m = /^(FN|N|TEL[^:]*|EMAIL[^:]*|ORG|TITLE|ADR[^:]*|URL)(?:;[^:]*)?:(.*)$/i.exec(raw.trim());
    if (!m || !m[2].trim()) continue;
    const k = m[1].toUpperCase();
    const v = m[2].replace(/;+/g, ' ').trim();
    if (k === 'FN') lines.push(`Name: ${v}`);
    else if (k === 'N' && !lines.some((l) => l.startsWith('Name:'))) lines.push(`Name: ${v}`);
    else if (k.startsWith('TEL')) lines.push(`Phone: ${v}`);
    else if (k.startsWith('EMAIL')) lines.push(`E-mail: ${v}`);
    else if (k === 'ORG') lines.push(`Organisation: ${v}`);
    else if (k === 'TITLE') lines.push(`Title: ${v}`);
    else if (k.startsWith('ADR')) lines.push(`Address: ${v}`);
    else if (k === 'URL') lines.push(`Web: ${v}`);
  }
  return lines;
}

/** what is this code? `format` = the code type ('qr', 'ean-13' ...), used only to tell a product code from text */
export function classifyScan(value: string, format?: string): ScanInfo {
  const text = String(value ?? '').trim();
  const make = (kind: ScanKind, lines: string[], openUrl = ''): ScanInfo => ({ kind, label: KIND_LABEL[kind], lines, openUrl });
  if (!text) return make('text', []);
  if (/^https?:\/\/[^\s]+$/i.test(text)) return make('link', [text], text);
  if (/^www\.[^\s]+\.[a-z]{2,}[^\s]*$/i.test(text)) return make('link', [text], `https://${text}`);
  if (/^mailto:/i.test(text)) return make('email', [text.slice(7).split('?')[0]], text);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) return make('email', [text], `mailto:${text}`);
  if (/^tel:/i.test(text)) return make('phone', [text.slice(4)], text);
  if (/^\+?[0-9][0-9 ()./-]{5,}$/.test(text) && !isProductFormat(format)) return make('phone', [text], `tel:${text.replace(/[^\d+]/g, '')}`);
  if (/^(sms|smsto):/i.test(text)) {
    const body = text.replace(/^(sms|smsto):/i, '');
    const [number, ...rest] = body.split(':');
    return make('sms', [`To: ${number}`, ...(rest.length ? [`Text: ${rest.join(':')}`] : [])], `sms:${number}`);
  }
  const wifi = parseWifi(text);
  if (wifi) {
    return make('wifi', [`Network: ${wifi.ssid}`, `Security: ${wifi.security}`, ...(wifi.password ? [`Password: ${wifi.password}`] : []), ...(wifi.hidden ? ['Hidden network'] : [])]);
  }
  if (/^geo:/i.test(text)) return make('geo', [text.slice(4).split('?')[0]], text);
  if (/^BEGIN:VCARD/i.test(text) || /^MECARD:/i.test(text)) return make('contact', parseContact(text));
  if (/^BEGIN:VEVENT/i.test(text) || /^BEGIN:VCALENDAR/i.test(text)) {
    const pick = (key: string) => new RegExp(`^${key}[^:]*:(.*)$`, 'im').exec(text)?.[1]?.trim();
    const lines = [pick('SUMMARY') && `Title: ${pick('SUMMARY')}`, pick('DTSTART') && `Starts: ${pick('DTSTART')}`, pick('DTEND') && `Ends: ${pick('DTEND')}`, pick('LOCATION') && `Place: ${pick('LOCATION')}`].filter(Boolean) as string[];
    return make('event', lines);
  }
  if (isProductFormat(format) && /^[0-9]+$/.test(text)) return make('product', [text]);
  return make('text', [text]);
}

/** one scan is reported once; the same value is ignored for this long (the camera sees the same code in many frames) */
export const SCAN_REPEAT_MS = 2500;

/** `shouldAccept(previous, next, now)`: false for the same value of the same type seen again within SCAN_REPEAT_MS */
export function shouldAcceptScan(previous: { value: string; type: string; at: number } | null, next: { value: string; type: string }, now: number): boolean {
  if (!next.value) return false;
  if (!previous) return true;
  return !(previous.value === next.value && previous.type === next.type && now - previous.at < SCAN_REPEAT_MS);
}

export interface ScanResult {
  /** the text of the code */
  value: string;
  /** the code type name of the camera ('qr', 'ean-13'), as normalizeCodeType gives it */
  type: string;
  at: number;
}

/** the text of a result for the clipboard / the post: the facts, one per line, else the raw value */
export function scanText(result: Pick<ScanResult, 'value' | 'type'>): string {
  const info = classifyScan(result.value, result.type);
  return info.kind === 'text' || info.kind === 'link' || info.kind === 'product' ? result.value : info.lines.join('\n');
}
