// BER / DER TLV reading and writing (the data of an eMRTD: files, security infos, the SOD). Pure.
import { bytesToHex, concat } from './crypto/bytes';

export interface Tlv {
  /** the whole tag, 1-3 bytes, as a number (0x61, 0x5F1F, 0x7F61) */
  tag: number;
  /** the tag has the constructed bit: its value is a list of TLVs */
  constructed: boolean;
  value: Uint8Array;
  /** where the TLV ends in the source (the next TLV starts here) */
  end: number;
}

/** reads ONE TLV at `offset`; throws on a broken length */
export function readTlv(bytes: Uint8Array, offset = 0): Tlv {
  if (offset >= bytes.length) throw new Error('TLV: no data');
  let p = offset;
  let tag = bytes[p++];
  const constructed = (tag & 0x20) !== 0;
  if ((tag & 0x1f) === 0x1f) {
    // multi byte tag: more bytes follow while bit 8 is set
    let b: number;
    do {
      if (p >= bytes.length) throw new Error('TLV: broken tag');
      b = bytes[p++];
      tag = (tag << 8) | b;
    } while (b & 0x80);
  }
  if (p >= bytes.length) throw new Error('TLV: no length');
  let len = bytes[p++];
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || p + n > bytes.length) throw new Error('TLV: bad length');
    len = 0;
    for (let i = 0; i < n; i += 1) len = len * 256 + bytes[p++];
  }
  if (p + len > bytes.length) throw new Error('TLV: the value is longer than the data');
  return { tag, constructed, value: bytes.slice(p, p + len), end: p + len };
}

/** all the TLVs one after the other (the children of a constructed one) */
export function readTlvs(bytes: Uint8Array): Tlv[] {
  const out: Tlv[] = [];
  let p = 0;
  while (p < bytes.length) {
    const t = readTlv(bytes, p);
    out.push(t);
    p = t.end;
  }
  return out;
}

/** the first child with this tag, or null */
export const findTlv = (children: Tlv[], tag: number): Tlv | null => children.find((c) => c.tag === tag) ?? null;

export function lengthBytes(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len]);
  if (len < 0x100) return new Uint8Array([0x81, len]);
  if (len < 0x10000) return new Uint8Array([0x82, len >> 8, len & 0xff]);
  return new Uint8Array([0x83, len >> 16, (len >> 8) & 0xff, len & 0xff]);
}

export function tagBytes(tag: number): Uint8Array {
  if (tag > 0xffff) return new Uint8Array([tag >> 16, (tag >> 8) & 0xff, tag & 0xff]);
  if (tag > 0xff) return new Uint8Array([tag >> 8, tag & 0xff]);
  return new Uint8Array([tag]);
}

export const encodeTlv = (tag: number, value: Uint8Array): Uint8Array => concat(tagBytes(tag), lengthBytes(value.length), value);

/** 1.3.14.3.2.26 -> the DER value bytes of the OID */
export function oidToBytes(oid: string): Uint8Array {
  const parts = oid.split('.').map(Number);
  const out: number[] = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    const stack = [part & 0x7f];
    let rest = Math.floor(part / 128);
    while (rest > 0) {
      stack.unshift((rest & 0x7f) | 0x80);
      rest = Math.floor(rest / 128);
    }
    out.push(...stack);
  }
  return new Uint8Array(out);
}

/** the DER value bytes of an OID -> '1.3.14.3.2.26' */
export function bytesToOid(bytes: Uint8Array): string {
  if (!bytes.length) return '';
  const parts: number[] = [Math.floor(bytes[0] / 40), bytes[0] % 40];
  let value = 0;
  for (let i = 1; i < bytes.length; i += 1) {
    value = value * 128 + (bytes[i] & 0x7f);
    if (!(bytes[i] & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join('.');
}

export const encodeOid = (oid: string): Uint8Array => encodeTlv(0x06, oidToBytes(oid));

/** an unsigned INTEGER value as a JS number (small values: versions, ids) */
export function bytesToInt(bytes: Uint8Array): number {
  let n = 0;
  for (const b of bytes) n = n * 256 + b;
  return n;
}

/** for the log: '61 (12 bytes)' */
export const describeTlv = (t: Tlv): string => `${bytesToHex(tagBytes(t.tag))} (${t.value.length} bytes)`;
