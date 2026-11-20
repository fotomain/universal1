// The files of an eMRTD (ICAO 9303 part 10, the logical data structure): what is in them. Pure: bytes in, readable data out.
import { bytesToOid, findTlv, readTlv, readTlvs, Tlv } from './asn1';
import { bytesToAscii, bytesToHex, utf8Decode } from './crypto/bytes';
import { HASH_OIDS, HashName } from './crypto/hash';
import { MrzData, parseMrz } from './mrz';

/** file ids (short and long) of the files this reader knows */
export const FILE_IDS = {
  cardAccess: 0x011c,
  com: 0x011e,
  sod: 0x011d,
  dg: (n: number) => 0x0100 + n,
} as const;

/** the application id of the ICAO travel document application (LDS1) */
export const EMRTD_AID = new Uint8Array([0xa0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01]);

/** the first tag of data group n (EF.COM lists these) */
export const DG_TAGS: Record<number, number> = { 1: 0x61, 2: 0x75, 3: 0x63, 4: 0x76, 5: 0x65, 6: 0x66, 7: 0x67, 8: 0x68, 9: 0x69, 10: 0x6a, 11: 0x6b, 12: 0x6c, 13: 0x6d, 14: 0x6e, 15: 0x6f, 16: 0x70 };
const TAG_TO_DG = Object.fromEntries(Object.entries(DG_TAGS).map(([n, t]) => [t, Number(n)]));

export const DG_NAMES: Record<number, string> = {
  1: 'Machine readable zone', 2: 'Face image', 3: 'Fingerprints (protected)', 4: 'Iris (protected)', 5: 'Displayed portrait', 6: 'Reserved',
  7: 'Displayed signature', 8: 'Data features', 9: 'Structure features', 10: 'Substance features', 11: 'Additional personal details',
  12: 'Additional document details', 13: 'Optional details', 14: 'Security options', 15: 'Active authentication key', 16: 'Persons to notify',
};

export interface EfCom {
  ldsVersion: string;
  unicodeVersion: string;
  /** the data groups the document says it has */
  dataGroups: number[];
}

/** EF.COM: 60 { 5F01 LDS version, 5F36 unicode version, 5C tag list } */
export function parseEfCom(bytes: Uint8Array): EfCom {
  const root = readTlv(bytes, 0);
  const kids = readTlvs(root.value);
  const list = findTlv(kids, 0x5c);
  return {
    ldsVersion: bytesToAscii(findTlv(kids, 0x5f01)?.value ?? []),
    unicodeVersion: bytesToAscii(findTlv(kids, 0x5f36)?.value ?? []),
    dataGroups: Array.from(list?.value ?? [])
      .map((t) => TAG_TO_DG[t])
      .filter((n) => n != null),
  };
}

/** DG1: 61 { 5F1F the MRZ as text } */
export function parseDg1(bytes: Uint8Array): { raw: string; mrz: MrzData | null } {
  const root = readTlv(bytes, 0);
  const mrz = findTlv(readTlvs(root.value), 0x5f1f);
  const raw = mrz ? bytesToAscii(mrz.value) : '';
  return { raw, mrz: raw ? parseMrz(raw) : null };
}

export interface FaceImage {
  mime: 'image/jpeg' | 'image/jp2';
  bytes: Uint8Array;
}

/** where an image starts inside the biometric data block (after the ISO 19794-5 header): JPEG, JPEG 2000 file or codestream */
export function findImage(block: Uint8Array): FaceImage | null {
  for (let i = 0; i + 4 < block.length; i += 1) {
    if (block[i] === 0xff && block[i + 1] === 0xd8 && block[i + 2] === 0xff) return { mime: 'image/jpeg', bytes: block.slice(i) };
    if (block[i] === 0x00 && block[i + 1] === 0x00 && block[i + 2] === 0x00 && block[i + 3] === 0x0c && block[i + 4] === 0x6a) return { mime: 'image/jp2', bytes: block.slice(i) };
    if (block[i] === 0xff && block[i + 1] === 0x4f && block[i + 2] === 0xff && block[i + 3] === 0x51) return { mime: 'image/jp2', bytes: block.slice(i) };
  }
  return null;
}

/** DG2 (and DG5 / DG7 with the same layout): 75 { 7F61 { 02 count, 7F60 { A1 header, 5F2E data block } ... } } */
export function parseFaceImage(bytes: Uint8Array): FaceImage | null {
  const root = readTlv(bytes, 0);
  const group = findTlv(readTlvs(root.value), 0x7f61);
  if (!group) return findImage(root.value);
  for (const entry of readTlvs(group.value)) {
    if (entry.tag !== 0x7f60) continue;
    const block = findTlv(readTlvs(entry.value), 0x5f2e) ?? findTlv(readTlvs(entry.value), 0x5f2d);
    if (block) return findImage(block.value);
  }
  return null;
}

const clean = (s: string) => s.replace(/\u0000/g, '').trim();

/** a name of DG11: SURNAME<<GIVEN<NAMES -> 'SURNAME, GIVEN NAMES' */
export function dgName(raw: string): string {
  const [surname, ...given] = raw.split('<<');
  const g = given.join(' ').replace(/</g, ' ').replace(/ +/g, ' ').trim();
  const s = surname.replace(/</g, ' ').trim();
  return g ? `${s}, ${g}` : s;
}

/** BCD (4 bytes) or ASCII (8 bytes) date of DG11 / DG12 -> YYYY-MM-DD; '' when it is none */
export function dgDate(value: Uint8Array): string {
  let digits = '';
  if (value.length === 4) digits = bytesToHex(value);
  else if (value.length === 8) digits = bytesToAscii(value);
  return /^\d{8}$/.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : '';
}

export interface Dg11 {
  fullName: string;
  otherNames: string[];
  personalNumber: string;
  birthDate: string;
  placeOfBirth: string[];
  address: string[];
  telephone: string;
  profession: string;
  title: string;
  summary: string;
  citizenship: string;
  otherDocuments: string;
  custodian: string;
}

const parts = (raw: string) => raw.split('<').map((p) => p.trim()).filter(Boolean);

/** DG11: 6B { 5C tag list, 5F0E full name, 5F0F other names, 5F10 personal number, 5F2B date of birth, 5F11 place of birth, 5F42 address ... } */
export function parseDg11(bytes: Uint8Array): Dg11 {
  const root = readTlv(bytes, 0);
  const kids = readTlvs(root.value);
  const text = (tag: number) => clean(utf8Decode(findTlv(kids, tag)?.value ?? []));
  const others: string[] = [];
  for (const k of kids) {
    if (k.tag === 0x5f0f) others.push(dgName(clean(utf8Decode(k.value))));
    if (k.tag === 0xa0) for (const inner of readTlvs(k.value)) if (inner.tag === 0x5f0f) others.push(dgName(clean(utf8Decode(inner.value))));
  }
  return {
    fullName: dgName(text(0x5f0e)),
    otherNames: others,
    personalNumber: text(0x5f10),
    birthDate: dgDate(findTlv(kids, 0x5f2b)?.value ?? new Uint8Array(0)),
    placeOfBirth: parts(text(0x5f11)),
    address: parts(text(0x5f42)),
    telephone: text(0x5f12),
    profession: text(0x5f13),
    title: text(0x5f14),
    summary: text(0x5f15),
    citizenship: text(0x5f16),
    otherDocuments: text(0x5f17),
    custodian: text(0x5f18),
  };
}

export interface Dg12 {
  issuingAuthority: string;
  dateOfIssue: string;
  endorsements: string;
  taxExitRequirements: string;
  serialNumber: string;
  personalizationTime: string;
  otherPersons: string[];
}

/** DG12: 6C { 5C list, 5F19 issuing authority, 5F26 date of issue, A0 other persons, 5F1B endorsements, 5F1C tax / exit, 5F55 time, 5F56 serial number } */
export function parseDg12(bytes: Uint8Array): Dg12 {
  const root = readTlv(bytes, 0);
  const kids = readTlvs(root.value);
  const text = (tag: number) => clean(utf8Decode(findTlv(kids, tag)?.value ?? []));
  const persons: string[] = [];
  for (const k of kids) if (k.tag === 0xa0) for (const inner of readTlvs(k.value)) if (inner.tag === 0x5f1a) persons.push(dgName(clean(utf8Decode(inner.value))));
  return {
    issuingAuthority: text(0x5f19),
    dateOfIssue: dgDate(findTlv(kids, 0x5f26)?.value ?? new Uint8Array(0)),
    endorsements: text(0x5f1b),
    taxExitRequirements: text(0x5f1c),
    serialNumber: text(0x5f56),
    personalizationTime: text(0x5f55),
    otherPersons: persons,
  };
}

export interface SodHashes {
  algorithm: HashName | null;
  algorithmOid: string;
  /** data group number -> its hash as the issuer signed it */
  hashes: Record<number, Uint8Array>;
}

/** looks for a TLV that is a LDSSecurityObject: SEQUENCE { INTEGER version, SEQUENCE { OID hash }, SEQUENCE OF SEQUENCE { INTEGER dg, OCTET STRING hash } } */
function findSecurityObject(bytes: Uint8Array, depth: number): SodHashes | null {
  if (depth > 12) return null;
  let kids: Tlv[];
  try {
    kids = readTlvs(bytes);
  } catch {
    return null;
  }
  for (const t of kids) {
    if (t.tag === 0x30) {
      const c = safeChildren(t.value);
      if (c.length >= 3 && c[0].tag === 0x02 && c[1].tag === 0x30 && c[2].tag === 0x30) {
        const algo = safeChildren(c[1].value)[0];
        const entries = safeChildren(c[2].value);
        if (algo?.tag === 0x06 && entries.length && entries.every((e) => e.tag === 0x30)) {
          const oid = bytesToOid(algo.value);
          const hashes: Record<number, Uint8Array> = {};
          for (const e of entries) {
            const [num, hash] = safeChildren(e.value);
            if (num?.tag === 0x02 && hash?.tag === 0x04) hashes[num.value[num.value.length - 1]] = hash.value;
          }
          if (Object.keys(hashes).length) return { algorithm: HASH_OIDS[oid] ?? null, algorithmOid: oid, hashes };
        }
      }
    }
    // go inside constructed values and inside OCTET STRINGs (the signed content is an OCTET STRING with a DER structure)
    if (t.constructed || t.tag === 0x04) {
      const hit = findSecurityObject(t.value, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function safeChildren(bytes: Uint8Array): Tlv[] {
  try {
    return readTlvs(bytes);
  } catch {
    return [];
  }
}

/** EF.SOD (77 { signed data }): the hashes of the data groups. The signature itself is NOT checked here (see emrtd.ts). */
export function parseSod(bytes: Uint8Array): SodHashes | null {
  return findSecurityObject(bytes, 0);
}
