// A software eMRTD: answers the APDUs of the ID reader like a passport / ID card chip (BAC, PACE with ECDH generic mapping, secure messaging,
// files). The card side uses Node's own crypto for AES / 3DES / SHA and its own point arithmetic call sequence, so the reader and the card
// are not the same code. Tests only (named *TestKit: jest does not run it).
import * as nc from 'crypto';

// jsdom has no TextEncoder / TextDecoder (every phone and browser has)
const nodeUtil = require('util');
(globalThis as any).TextEncoder = (globalThis as any).TextEncoder || nodeUtil.TextEncoder;
(globalThis as any).TextDecoder = (globalThis as any).TextDecoder || nodeUtil.TextDecoder;

import { encodeOid, encodeTlv, oidToBytes, readTlv, readTlvs, findTlv } from '../../kit8/ui/components/media/nfc/iddocread/asn1';
import { bytesToHex, concat, equalBytes, xor } from '../../kit8/ui/components/media/nfc/iddocread/crypto/bytes';
import { curveOf, decodePoint, encodePoint, xCoordinate } from '../../kit8/ui/components/media/nfc/iddocread/crypto/ec';
import { adjustParity, aesCmac, pad, retailMac, unpad } from '../../kit8/ui/components/media/nfc/iddocread/crypto/symmetric';
import { checkDigit, mrzKeySeed, MrzAccess } from '../../kit8/ui/components/media/nfc/iddocread/mrz';
import { ID_PACE, paceToken, PaceInfo } from '../../kit8/ui/components/media/nfc/iddocread/pace';
import { EMRTD_AID } from '../../kit8/ui/components/media/nfc/iddocread/dataGroups';

const u8 = (b: Buffer | Uint8Array) => new Uint8Array(b);
const sha = (alg: string, d: Uint8Array) => u8(nc.createHash(alg).update(d).digest());
const rnd = (n: number) => u8(nc.randomBytes(n));

export const sw = (code: number) => [code >> 8, code & 0xff];

function des3(key: Uint8Array, data: Uint8Array, enc: boolean): Uint8Array {
  const k = key.length === 16 ? concat(key, key.slice(0, 8)) : key;
  const c = enc ? nc.createCipheriv('des-ede3-cbc', k, Buffer.alloc(8)) : nc.createDecipheriv('des-ede3-cbc', k, Buffer.alloc(8));
  c.setAutoPadding(false);
  return u8(Buffer.concat([c.update(data), c.final()]));
}
function aes(key: Uint8Array, iv: Uint8Array, data: Uint8Array, enc: boolean): Uint8Array {
  const name = `aes-${key.length * 8}-cbc`;
  const c = enc ? nc.createCipheriv(name, key, iv) : nc.createDecipheriv(name, key, iv);
  c.setAutoPadding(false);
  return u8(Buffer.concat([c.update(data), c.final()]));
}
function aesEcbBlock(key: Uint8Array, block: Uint8Array): Uint8Array {
  const c = nc.createCipheriv(`aes-${key.length * 8}-ecb`, key, null);
  c.setAutoPadding(false);
  return u8(Buffer.concat([c.update(block), c.final()]));
}

/** a test passport / ID card */
export interface SimCardOptions {
  /** the MRZ the card was made for (BAC password, PACE MRZ password) */
  mrzAccess: MrzAccess;
  can?: string;
  /** PACE: null = the card knows BAC only */
  pace?: { cipher: 'tdes' | 'aes128' | 'aes192' | 'aes256'; parameterId: number; mapping?: 'ECDH-GM' | 'ECDH-IM' } | null;
  files: Record<number, Uint8Array>;
  /** the card answers READ BINARY longer than this with 6700 */
  maxRead?: number;
  /** no eMRTD application (a bank card): SELECT answers 6A82 */
  noApplication?: boolean;
  /** other applications the card knows (hex ids): SELECT answers 9000 for them */
  apps?: string[];
  /** files that answer without a password (EF.CardAccess and EF.DIR always do) */
  publicFiles?: number[];
  /** a card that needs no password at all */
  openAll?: boolean;
  /** EF.DIR is a file of records (READ RECORD), as on most cards */
  dirRecords?: boolean;
}

const CIPHERS = { tdes: { n: '1', kind: 'tdes' as const, key: 16, hash: 'sha1' }, aes128: { n: '2', kind: 'aes' as const, key: 16, hash: 'sha1' }, aes192: { n: '3', kind: 'aes' as const, key: 24, hash: 'sha256' }, aes256: { n: '4', kind: 'aes' as const, key: 32, hash: 'sha256' } };

export class SimCard {
  log: string[] = [];
  tag: { id: string; techTypes: string[] } | null = null;
  /** the method that opened the card */
  opened: 'none' | 'bac' | 'pace' = 'none';
  private appSelected = false;
  private selected = 0;
  private sm: { kind: 'tdes' | 'aes'; enc: Uint8Array; mac: Uint8Array; ssc: Uint8Array } | null = null;
  private challenge: Uint8Array | null = null;
  private pace: any = null;
  private at: { oid: string; kind: number; param: number } | null = null;

  constructor(public opt: SimCardOptions) {}

  transceive = async (apdu: number[]): Promise<number[]> => {
    const a = Uint8Array.from(apdu);
    const r = this.handle(a);
    return [...r.data, ...sw(r.sw)];
  };

  private kdf(k: Uint8Array, counter: number, hash: string, bytes: number, parity: boolean): Uint8Array {
    const d = sha(hash, concat(k, new Uint8Array([0, 0, 0, counter]))).slice(0, bytes);
    return parity ? adjustParity(d) : d;
  }

  private handle(a: Uint8Array): { data: Uint8Array; sw: number } {
    const cla = a[0];
    const ins = a[1];
    // parse lc / data / le (short)
    let data = new Uint8Array(0);
    if (a.length > 5) data = a.slice(5, 5 + a[4]);
    else if (a.length === 5 && false) data = new Uint8Array(0);
    const secure = (cla & 0x0c) === 0x0c && this.sm;
    if (secure) return this.handleSecure(a);
    this.log.push(`${bytesToHex(a.slice(0, 4))}${data.length ? ` [${data.length}]` : ''}`);

    if (ins === 0xa4 && a[2] === 0x04) {
      if (this.opt.apps?.includes(bytesToHex(data))) return { data: new Uint8Array(0), sw: 0x9000 };
      if (this.opt.noApplication || !equalBytes(data, EMRTD_AID)) return { data: new Uint8Array(0), sw: 0x6a82 };
      this.appSelected = true;
      this.sm = null;
      this.opened = 'none';
      return { data: new Uint8Array(0), sw: 0x9000 };
    }
    if (ins === 0xa4 && a[2] === 0x00) return { data: new Uint8Array(0), sw: 0x9000 }; // master file
    if (ins === 0xa4 && a[2] === 0x02) {
      const id = (data[0] << 8) | data[1];
      // a protected file: only through secure messaging (except CardAccess)
      if (!this.isPublic(id) && this.opened === 'none') return { data: new Uint8Array(0), sw: 0x6982 };
      if (!this.opt.files[id]) return { data: new Uint8Array(0), sw: 0x6a82 };
      this.selected = id;
      return { data: new Uint8Array(0), sw: 0x9000 };
    }
    if (ins === 0xb0) {
      if (!this.isPublic(this.selected)) return { data: new Uint8Array(0), sw: 0x6982 };
      return this.read(a[2], a[3], a[4]);
    }
    if (ins === 0xb2) {
      if (!this.opt.dirRecords || this.selected !== 0x2f00) return { data: new Uint8Array(0), sw: 0x6d00 };
      const list = readTlvs(this.opt.files[0x2f00]);
      const t = list[a[2] - 1];
      return t ? { data: this.recordBytes(0x2f00, a[2] - 1), sw: 0x9000 } : { data: new Uint8Array(0), sw: 0x6a83 };
    }
    if (ins === 0x84) {
      this.challenge = rnd(8);
      return { data: this.challenge, sw: 0x9000 };
    }
    if (ins === 0x82) return this.bac(data);
    if (ins === 0x22) return this.mseSetAt(data);
    if (ins === 0x86) return this.generalAuthenticate(data);
    return { data: new Uint8Array(0), sw: 0x6d00 };
  }

  private recordBytes(id: number, index: number): Uint8Array {
    const file = this.opt.files[id];
    let p = 0;
    for (let i = 0; i <= index; i += 1) {
      const t = readTlv(file, p);
      if (i === index) return file.slice(p, t.end);
      p = t.end;
    }
    return new Uint8Array(0);
  }

  private isPublic(id: number): boolean {
    return id === 0x011c || id === 0x2f00 || !!this.opt.openAll || !!this.opt.publicFiles?.includes(id);
  }

  private read(p1: number, p2: number, le: number): { data: Uint8Array; sw: number } {
    const file = this.opt.files[this.selected];
    const offset = ((p1 & 0x7f) << 8) | p2;
    const want = le === 0 ? 256 : le;
    if (this.opt.maxRead && want > this.opt.maxRead) return { data: new Uint8Array(0), sw: 0x6700 };
    if (offset > file.length) return { data: new Uint8Array(0), sw: 0x6b00 };
    return { data: file.slice(offset, offset + want), sw: 0x9000 };
  }

  // ---- BAC
  private bac(data: Uint8Array) {
    if (!this.challenge) return { data: new Uint8Array(0), sw: 0x6985 };
    const seed = mrzKeySeed(this.opt.mrzAccess).slice(0, 16);
    const kEnc = adjustParity(sha('sha1', concat(seed, new Uint8Array([0, 0, 0, 1]))).slice(0, 16));
    const kMac = adjustParity(sha('sha1', concat(seed, new Uint8Array([0, 0, 0, 2]))).slice(0, 16));
    const eIfd = data.slice(0, 32);
    if (!equalBytes(retailMac(kMac, pad(eIfd, 8)), data.slice(32, 40))) return { data: new Uint8Array(0), sw: 0x6300 };
    const s = des3(kEnc, eIfd, false);
    const rndIfd = s.slice(0, 8);
    if (!equalBytes(s.slice(8, 16), this.challenge)) return { data: new Uint8Array(0), sw: 0x6300 };
    const kIfd = s.slice(16, 32);
    const kIcc = rnd(16);
    const eIcc = des3(kEnc, concat(this.challenge, rndIfd, kIcc), true);
    const resp = concat(eIcc, retailMac(kMac, pad(eIcc, 8)));
    const ks = xor(kIfd, kIcc);
    this.sm = {
      kind: 'tdes',
      enc: adjustParity(sha('sha1', concat(ks, new Uint8Array([0, 0, 0, 1]))).slice(0, 16)),
      mac: adjustParity(sha('sha1', concat(ks, new Uint8Array([0, 0, 0, 2]))).slice(0, 16)),
      ssc: concat(this.challenge.slice(4), rndIfd.slice(4)),
    };
    this.opened = 'bac';
    return { data: resp, sw: 0x9000 };
  }

  // ---- PACE
  private mseSetAt(data: Uint8Array) {
    const kids = readTlvs(data);
    const oidTlv = findTlv(kids, 0x80);
    const kind = findTlv(kids, 0x83)?.value[0] ?? 0;
    const param = findTlv(kids, 0x84)?.value[0] ?? -1;
    if (!this.opt.pace || !oidTlv) return { data: new Uint8Array(0), sw: 0x6a80 };
    this.at = { oid: this.oidOf(oidTlv.value), kind, param };
    if (param !== this.opt.pace.parameterId) return { data: new Uint8Array(0), sw: 0x6a88 };
    this.pace = { step: 0 };
    return { data: new Uint8Array(0), sw: 0x9000 };
  }
  private oidOf(b: Uint8Array) { return require('../../kit8/ui/components/media/nfc/iddocread/asn1').bytesToOid(b); }

  private generalAuthenticate(data: Uint8Array) {
    const p = this.opt.pace!;
    if (!this.pace) return { data: new Uint8Array(0), sw: 0x6985 };
    const c = CIPHERS[p.cipher];
    const curve = curveOf(p.parameterId);
    const inner = readTlvs(readTlv(data, 0).value);
    const wrap = (tag: number, v: Uint8Array) => encodeTlv(0x7c, encodeTlv(tag, v));
    const password = this.at!.kind === 2 ? new TextEncoder().encode(this.opt.can ?? '') : mrzKeySeed(this.opt.mrzAccess);
    const kPi = this.kdf(password, 3, c.hash, c.key, c.kind === 'tdes');
    const st = this.pace;
    if (st.step === 0) {
      st.nonce = rnd(16);
      st.step = 1;
      const z = c.kind === 'tdes' ? des3(kPi, st.nonce, true) : aes(kPi, new Uint8Array(16), st.nonce, true);
      return { data: wrap(0x80, z), sw: 0x9000 };
    }
    if (st.step === 1) {
      const X1 = decodePoint(curve, findTlv(inner, 0x81)!.value);
      st.y1 = BigInt('0x' + bytesToHex(rnd(curve.size))) % (curve.n - 1n) + 1n;
      const Y1 = curve.Point.BASE.multiply(st.y1);
      const H = X1.multiply(st.y1);
      const s = BigInt('0x' + bytesToHex(st.nonce)) % curve.n;
      st.Gm = curve.Point.BASE.multiply(s).add(H);
      st.step = 2;
      return { data: wrap(0x82, encodePoint(curve, Y1)), sw: 0x9000 };
    }
    if (st.step === 2) {
      st.X2 = findTlv(inner, 0x83)!.value;
      const X2 = decodePoint(curve, st.X2);
      st.y2 = BigInt('0x' + bytesToHex(rnd(curve.size))) % (curve.n - 1n) + 1n;
      st.Y2 = encodePoint(curve, st.Gm.multiply(st.y2));
      const K = xCoordinate(curve, X2.multiply(st.y2));
      st.ksEnc = this.kdf(K, 1, c.hash, c.key, c.kind === 'tdes');
      st.ksMac = this.kdf(K, 2, c.hash, c.key, c.kind === 'tdes');
      st.step = 3;
      return { data: wrap(0x84, st.Y2), sw: 0x9000 };
    }
    // step 4: tokens
    const info: PaceInfo = { oid: this.at!.oid, mapping: 'ECDH-GM', supported: true, cipher: c.kind, keyBytes: c.key, hash: c.hash as any, cipherLabel: '', parameterId: p.parameterId };
    const tIfd = findTlv(inner, 0x85)!.value;
    if (!equalBytes(tIfd, paceToken(info, st.ksMac, st.Y2))) return { data: new Uint8Array(0), sw: 0x6300 };
    const tIcc = paceToken(info, st.ksMac, st.X2);
    this.sm = { kind: c.kind, enc: st.ksEnc, mac: st.ksMac, ssc: new Uint8Array(c.kind === 'tdes' ? 8 : 16) };
    this.opened = 'pace';
    this.pace = null;
    return { data: wrap(0x86, tIcc), sw: 0x9000 };
  }

  // ---- secure messaging (card side)
  private macOf(d: Uint8Array) {
    const s = this.sm!;
    return s.kind === 'tdes' ? retailMac(s.mac, pad(d, 8)) : aesCmac(s.mac, d).slice(0, 8);
  }
  private inc() {
    const s = this.sm!.ssc;
    for (let i = s.length - 1; i >= 0; i -= 1) { s[i] = (s[i] + 1) & 0xff; if (s[i]) break; }
  }
  private handleSecure(a: Uint8Array): { data: Uint8Array; sw: number } {
    const s = this.sm!;
    const block = s.kind === 'tdes' ? 8 : 16;
    this.inc();
    const body = a.slice(5, 5 + a[4]);
    const tlvs = readTlvs(body);
    const do87 = findTlv(tlvs, 0x87);
    const do97 = findTlv(tlvs, 0x97);
    const do8e = findTlv(tlvs, 0x8e)!;
    const header = pad(a.slice(0, 4), block);
    let signed: Uint8Array = new Uint8Array(0);
    if (do87) signed = concat(signed, encodeTlv(0x87, do87.value));
    if (do97) signed = concat(signed, encodeTlv(0x97, do97.value));
    this.log.push(`SM ${bytesToHex(a.slice(1, 4))}`);
    if (!equalBytes(this.macOf(concat(s.ssc, header, signed)), do8e.value)) return { data: new Uint8Array(0), sw: 0x6988 };
    let plain: Uint8Array = new Uint8Array(0);
    if (do87) {
      const iv = s.kind === 'tdes' ? new Uint8Array(8) : aesEcbBlock(s.enc, s.ssc);
      const dec = s.kind === 'tdes' ? des3(s.enc, do87.value.slice(1), false) : aes(s.enc, iv, do87.value.slice(1), false);
      plain = unpad(dec);
    }
    const ins = a[1];
    let result: { data: Uint8Array; sw: number } = { data: new Uint8Array(0), sw: 0x9000 };
    if (ins === 0xa4) {
      const id = (plain[0] << 8) | plain[1];
      if (this.opt.files[id]) this.selected = id; else result = { data: new Uint8Array(0), sw: 0x6a82 };
    } else if (ins === 0xb0) {
      result = this.read(a[2], a[3], do97 ? do97.value[0] : 0);
    } else result = { data: new Uint8Array(0), sw: 0x6d00 };
    // protect the answer
    this.inc();
    let out: Uint8Array = new Uint8Array(0);
    if (result.data.length) {
      const padded = pad(result.data, block);
      const iv = s.kind === 'tdes' ? new Uint8Array(8) : aesEcbBlock(s.enc, s.ssc);
      const enc = s.kind === 'tdes' ? des3(s.enc, padded, true) : aes(s.enc, iv, padded, true);
      out = concat(out, encodeTlv(0x87, concat(new Uint8Array([1]), enc)));
    }
    out = concat(out, encodeTlv(0x99, new Uint8Array([result.sw >> 8, result.sw & 0xff])));
    const cc = this.macOf(concat(s.ssc, out));
    return { data: concat(out, encodeTlv(0x8e, cc)), sw: 0x9000 };
  }
}

// ---------------------------------------------------------------- test data: a made up Latvian-style ID card (TD1)
const mrzLines = (): string[] => {
  const docNo = 'LV1234567';
  const dob = '850214';
  const doe = '320430';
  const l1 = `IDLVA${docNo}${checkDigit(docNo)}${'<'.repeat(15)}`;
  const body2 = `${dob}${checkDigit(dob)}F${doe}${checkDigit(doe)}LVA${'<'.repeat(11)}`;
  const composite = checkDigit(l1.slice(5, 30) + body2.slice(0, 7) + body2.slice(8, 15) + body2.slice(18, 29));
  const l2 = `${body2}${composite}`;
  const l3 = 'ZVEJNIEKS<<JANA<ANNA'.padEnd(30, '<');
  return [l1, l2, l3];
};
export const TEST_MRZ_LINES = mrzLines();
export const TEST_ACCESS: MrzAccess = { documentNumber: 'LV1234567', birthDate: '850214', expiryDate: '320430' };
export const TEST_CAN = '123456';

export function jpegLike(size: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) out[i] = (i * 31 + 7) & 0xff;
  out.set([0xff, 0xd8, 0xff, 0xe0], 0);
  out.set([0xff, 0xd9], size - 2);
  return out;
}

const ascii = (s: string) => new TextEncoder().encode(s);
const bcd = (digits: string) => new Uint8Array(digits.match(/../g)!.map((h) => parseInt(h, 16)));

export function buildFiles(opts: { photoSize?: number; paceParam?: number; paceCipher?: keyof typeof CIPHERS | null; tamperDg1?: boolean } = {}): Record<number, Uint8Array> {
  const mrz = ascii(TEST_MRZ_LINES.join(''));
  const dg1 = encodeTlv(0x61, encodeTlv(0x5f1f, mrz));
  const photo = jpegLike(opts.photoSize ?? 3000);
  const header = new Uint8Array(46).fill(0x11);
  const dg2 = encodeTlv(0x75, encodeTlv(0x7f61, concat(encodeTlv(0x02, new Uint8Array([1])), encodeTlv(0x7f60, concat(encodeTlv(0xa1, new Uint8Array([0x81, 0x02, 0x01, 0x01])), encodeTlv(0x5f2e, concat(header, photo)))))));
  const dg11 = encodeTlv(0x6b, concat(encodeTlv(0x5c, new Uint8Array([0x5f, 0x0e, 0x5f, 0x2b, 0x5f, 0x11, 0x5f, 0x42])), encodeTlv(0x5f0e, ascii('ZVEJNIEKS<<JANA<ANNA')), encodeTlv(0x5f2b, bcd('19850214')), encodeTlv(0x5f11, ascii('RIGA<LATVIA')), encodeTlv(0x5f42, ascii('BRIVIBAS IELA 1<RIGA<LV-1010'))));
  const dg12 = encodeTlv(0x6c, concat(encodeTlv(0x5c, new Uint8Array([0x5f, 0x19, 0x5f, 0x26])), encodeTlv(0x5f19, ascii('PMLP')), encodeTlv(0x5f26, bcd('20220501'))));
  const com = encodeTlv(0x60, concat(encodeTlv(0x5f01, ascii('0107')), encodeTlv(0x5f36, ascii('040000')), encodeTlv(0x5c, new Uint8Array([0x61, 0x75, 0x6b, 0x6c]))));
  const hashes = [[1, dg1], [2, dg2], [11, dg11], [12, dg12]].map(([n, d]) => encodeTlv(0x30, concat(encodeTlv(0x02, new Uint8Array([n as number])), encodeTlv(0x04, sha('sha256', d as Uint8Array)))));
  const lds = encodeTlv(0x30, concat(encodeTlv(0x02, new Uint8Array([0])), encodeTlv(0x30, concat(encodeOid('2.16.840.1.101.3.4.2.1'), new Uint8Array([0x05, 0x00]))), encodeTlv(0x30, concat(...hashes))));
  const signed = encodeTlv(0x30, concat(encodeTlv(0x02, new Uint8Array([3])), encodeTlv(0x31, new Uint8Array(0)), encodeTlv(0x30, concat(encodeOid('2.23.136.1.1.1'), encodeTlv(0xa0, encodeTlv(0x04, lds))))));
  const sod = encodeTlv(0x77, encodeTlv(0x30, concat(encodeOid('1.2.840.113549.1.7.2'), encodeTlv(0xa0, signed))));
  const files: Record<number, Uint8Array> = { 0x0101: opts.tamperDg1 ? concat(dg1.slice(0, dg1.length - 1), new Uint8Array([0x00])) : dg1, 0x0102: dg2, 0x010b: dg11, 0x010c: dg12, 0x011e: com, 0x011d: sod };
  if (opts.paceCipher) {
    const c = CIPHERS[opts.paceCipher];
    const oid = `${ID_PACE}.2.${c.n}`;
    files[0x011c] = encodeTlv(0x31, encodeTlv(0x30, concat(encodeOid(oid), encodeTlv(0x02, new Uint8Array([2])), encodeTlv(0x02, new Uint8Array([opts.paceParam ?? 13])))));
  }
  return files;
}
export { oidToBytes };
