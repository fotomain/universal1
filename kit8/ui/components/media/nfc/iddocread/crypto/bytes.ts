// Byte helpers of the ID reader. Pure. Everything is a Uint8Array; hex is upper case without spaces.
export const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2) throw new Error('odd hex length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
};

export const bytesToHex = (bytes: ArrayLike<number>): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += (bytes[i] & 0xff).toString(16).padStart(2, '0');
  return s.toUpperCase();
};

export const concat = (...parts: ArrayLike<number>[]): Uint8Array => {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p as ArrayLike<number> as Uint8Array, o);
    o += p.length;
  }
  return out;
};

export const xor = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i += 1) out[i] = a[i] ^ b[i];
  return out;
};

export const equalBytes = (a: ArrayLike<number>, b: ArrayLike<number>): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
};

export const asciiBytes = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

export const bytesToAscii = (bytes: ArrayLike<number>): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i] & 0xff);
  return s;
};

/** a big endian unsigned integer as bytes, at least `size` long (0 = as short as possible) */
export const bigToBytes = (value: bigint, size = 0): Uint8Array => {
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const raw = hexToBytes(hex);
  if (size <= raw.length) return raw;
  return concat(new Uint8Array(size - raw.length), raw);
};

export const bytesToBig = (bytes: ArrayLike<number>): bigint => (bytes.length ? BigInt(`0x${bytesToHex(bytes)}`) : 0n);

/** UTF-8 bytes -> text (the DG11 / DG12 text fields) */
export function utf8Decode(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i += 1; }
    else if (b >= 0xc0 && b < 0xe0 && i + 1 < bytes.length) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if (b >= 0xe0 && b < 0xf0 && i + 2 < bytes.length) { out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    else if (b >= 0xf0 && i + 3 < bytes.length) { out += String.fromCodePoint(((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f)); i += 4; }
    else { out += '�'; i += 1; }
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 of bytes (a data: uri for the face image; no btoa / Buffer on every engine) */
export function bytesToBase64(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
}
