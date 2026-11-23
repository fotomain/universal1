// PACE - Password Authenticated Connection Establishment (ICAO 9303 part 11, section 4.4; BSI TR-03110 part 2).
// The password is the MRZ information or the CAN (card access number, 6 digits printed on the card). A Diffie-Hellman exchange on an elliptic
// curve, mapped with the secret nonce of the card (generic mapping), gives session keys that nobody can guess from a recording.
// Supported: ECDH with the generic mapping (also the "chip authentication mapping" variant: the exchange is the same), the 3DES and AES
// 128 / 192 / 256 ciphers, the curves of the domain parameters 8..18. NOT supported: the integrated mapping and the modular (DH) groups.
import { buildApdu, CardError, IsoDepTransport, sendApdu, SW_OK } from './apdu';
import { bytesToOid, encodeOid, encodeTlv, readTlv, readTlvs, findTlv, bytesToInt, oidToBytes } from './asn1';
import { asciiBytes, concat, equalBytes } from './crypto/bytes';
import { curveOf, decodePoint, encodePoint, randomScalar, xCoordinate, SUPPORTED_PARAMETER_IDS } from './crypto/ec';
import { digest } from './crypto/hash';
import type { RandomSource } from './crypto/random';
import { adjustParity, aesCbc, aesCmac, retailMac, pad, tdesCbc } from './crypto/symmetric';
import { MrzAccess, mrzKeySeed } from './mrz';
import { SecureMessaging } from './secureMessaging';

/** id-PACE = 0.4.0.127.0.7.2.2.4 */
export const ID_PACE = '0.4.0.127.0.7.2.2.4';
const MAPPINGS: Record<string, { mapping: string; supported: boolean }> = {
  '1': { mapping: 'DH-GM', supported: false },
  '2': { mapping: 'ECDH-GM', supported: true },
  '3': { mapping: 'DH-IM', supported: false },
  '4': { mapping: 'ECDH-IM', supported: false },
  '6': { mapping: 'ECDH-CAM', supported: true },
};
const CIPHERS: Record<string, { cipher: 'tdes' | 'aes'; keyBytes: number; hash: 'sha1' | 'sha256'; label: string }> = {
  '1': { cipher: 'tdes', keyBytes: 16, hash: 'sha1', label: '3DES' },
  '2': { cipher: 'aes', keyBytes: 16, hash: 'sha1', label: 'AES-128' },
  '3': { cipher: 'aes', keyBytes: 24, hash: 'sha256', label: 'AES-192' },
  '4': { cipher: 'aes', keyBytes: 32, hash: 'sha256', label: 'AES-256' },
};

export interface PaceInfo {
  /** the full OID of the protocol, e.g. 0.4.0.127.0.7.2.2.4.2.2 */
  oid: string;
  mapping: string;
  /** a protocol this reader can run */
  supported: boolean;
  cipher: 'tdes' | 'aes';
  keyBytes: number;
  hash: 'sha1' | 'sha256';
  cipherLabel: string;
  /** the id of the standardized domain parameters; null = the card sends its own parameters (not supported) */
  parameterId: number | null;
}

/** reads the PACE protocols a card offers from the SecurityInfos of EF.CardAccess (a SET of SEQUENCEs); other infos (chip authentication ...) are skipped */
export function parsePaceInfos(cardAccess: Uint8Array): PaceInfo[] {
  const out: PaceInfo[] = [];
  const set = readTlv(cardAccess, 0);
  for (const info of readTlvs(set.value)) {
    if (info.tag !== 0x30) continue;
    const parts = readTlvs(info.value);
    if (!parts.length || parts[0].tag !== 0x06) continue;
    const oid = bytesToOid(parts[0].value);
    if (!oid.startsWith(`${ID_PACE}.`)) continue;
    const rest = oid.slice(ID_PACE.length + 1).split('.');
    if (rest.length !== 2) continue; // 4.x without a cipher = PACEDomainParameterInfo
    const map = MAPPINGS[rest[0]];
    const cipher = CIPHERS[rest[1]];
    if (!map || !cipher) continue;
    const idPart = parts.find((p, i) => i >= 2 && p.tag === 0x02);
    out.push({
      oid, mapping: map.mapping, supported: map.supported, cipher: cipher.cipher, keyBytes: cipher.keyBytes, hash: cipher.hash, cipherLabel: cipher.label,
      parameterId: idPart ? bytesToInt(idPart.value) : null,
    });
  }
  return out;
}

/** the best protocol this reader can run (AES before 3DES, ECDH-GM before the CAM variant), or null */
export function pickPace(infos: PaceInfo[]): PaceInfo | null {
  const usable = infos.filter((i) => i.supported && i.parameterId != null && SUPPORTED_PARAMETER_IDS.includes(i.parameterId));
  usable.sort((a, b) => (a.mapping === b.mapping ? 0 : a.mapping === 'ECDH-GM' ? -1 : 1) || b.keyBytes - a.keyBytes);
  return usable[0] ?? null;
}

/** why no protocol fits (for the log and the screen) */
export function whyNoPace(infos: PaceInfo[]): string {
  if (!infos.length) return 'The card does not offer PACE.';
  const names = infos.map((i) => `${i.mapping} ${i.cipherLabel}${i.parameterId != null ? ` (parameters ${i.parameterId})` : ''}`).join(', ');
  return `The card offers ${names}; this reader supports ECDH with the generic mapping on the standard curves.`;
}

/** KDF of ICAO 9303-11: hash(K || 00 00 00 c), cut to the key size (3DES: parity bits set) */
export function paceKdf(info: Pick<PaceInfo, 'hash' | 'keyBytes' | 'cipher'>, k: Uint8Array, counter: number): Uint8Array {
  const out = digest(info.hash, concat(k, new Uint8Array([0, 0, 0, counter]))).slice(0, info.keyBytes);
  return info.cipher === 'tdes' ? adjustParity(out) : out;
}

export type PacePassword = { kind: 'mrz'; access: MrzAccess } | { kind: 'can'; can: string };

/** the K the password stands for: SHA-1 of the MRZ information, or the CAN as ASCII */
export function pacePasswordBytes(password: PacePassword): Uint8Array {
  return password.kind === 'mrz' ? mrzKeySeed(password.access) : asciiBytes(password.can);
}

/** authentication token: the MAC of the public key data object 7F49 { OID, 86 point } */
export function paceToken(info: PaceInfo, ksMac: Uint8Array, point: Uint8Array): Uint8Array {
  const data = encodeTlv(0x7f49, concat(encodeOid(info.oid), encodeTlv(0x86, point)));
  return info.cipher === 'tdes' ? retailMac(ksMac, pad(data, 8)) : aesCmac(ksMac, data).slice(0, 8);
}

const decryptNonce = (info: PaceInfo, kPi: Uint8Array, z: Uint8Array): Uint8Array =>
  info.cipher === 'tdes' ? tdesCbc(kPi, z, false) : aesCbc(kPi, new Uint8Array(16), z, false);

const ga = (transport: IsoDepTransport, chained: boolean, data: Uint8Array) =>
  sendApdu(transport, buildApdu(chained ? 0x10 : 0x00, 0x86, 0x00, 0x00, encodeTlv(0x7c, data), 0x00));

/** the content of the 7C answer: the TLV with the wanted tag */
function answerField(data: Uint8Array, tag: number, what: string): Uint8Array {
  const outer = readTlv(data, 0);
  const inner = findTlv(readTlvs(outer.value), tag);
  if (!inner) throw new CardError(`The PACE answer has no ${what}.`);
  return inner.value;
}

/**
 * The whole PACE. Run it BEFORE the application is selected (the master file): MSE:SET AT, then four GENERAL AUTHENTICATE steps.
 * Returns the secure messaging of the session (counter 0).
 */
export async function performPace(transport: IsoDepTransport, info: PaceInfo, password: PacePassword, random: RandomSource, padMac: boolean = true): Promise<SecureMessaging> {
  if (info.parameterId == null) throw new CardError('The card sends its own curve parameters; this reader needs a standard curve.');
  const curve = curveOf(info.parameterId);
  const passwordKind = password.kind === 'can' ? 0x02 : 0x01;

  // MSE:SET AT - which protocol, which password
  const at = concat(encodeTlv(0x80, oidToBytes(info.oid)), encodeTlv(0x83, new Uint8Array([passwordKind])), encodeTlv(0x84, new Uint8Array([info.parameterId])));
  const mse = await sendApdu(transport, buildApdu(0x00, 0x22, 0xc1, 0xa4, at));
  if (mse.sw !== SW_OK) throw new CardError('The card refused MSE:SET AT (PACE start)', mse.sw);

  // step 1: the encrypted nonce
  const kPi = paceKdf(info, pacePasswordBytes(password), 3);
  const s1 = await ga(transport, true, new Uint8Array(0));
  if (s1.sw !== SW_OK) throw new CardError('PACE step 1 (nonce) failed', s1.sw);
  const nonce = decryptNonce(info, kPi, answerField(s1.data, 0x80, 'nonce'));

  // step 2: mapping - the generator G' = s*G + H, H = the shared point of the two mapping keys
  const x1 = randomScalar(curve, random);
  const X1 = curve.Point.BASE.multiply(x1);
  const s2 = await ga(transport, true, encodeTlv(0x81, encodePoint(curve, X1)));
  if (s2.sw !== SW_OK) throw new CardError('PACE step 2 (mapping) failed', s2.sw);
  const Y1 = decodePoint(curve, answerField(s2.data, 0x82, 'mapping key'));
  const H = Y1.multiply(x1);
  const nonceInt = BigInt(`0x${Array.from(nonce, (b) => b.toString(16).padStart(2, '0')).join('')}`) % curve.n;
  const Gm = nonceInt === 0n ? H : curve.Point.BASE.multiply(nonceInt).add(H);

  // step 3: key agreement on the mapped generator
  const x2 = randomScalar(curve, random);
  const X2 = Gm.multiply(x2);
  const s3 = await ga(transport, true, encodeTlv(0x83, encodePoint(curve, X2)));
  if (s3.sw !== SW_OK) throw new CardError('PACE step 3 (key agreement) failed', s3.sw);
  const Y2bytes = answerField(s3.data, 0x84, 'ephemeral key');
  const Y2 = decodePoint(curve, Y2bytes);
  const K = xCoordinate(curve, Y2.multiply(x2));
  const ksEnc = paceKdf(info, K, 1);
  const ksMac = paceKdf(info, K, 2);

  // step 4: both sides prove the key - T_IFD over the card's key, T_ICC over ours
  const tIfd = paceToken(info, ksMac, Y2bytes);
  const s4 = await ga(transport, false, encodeTlv(0x85, tIfd));
  if (s4.sw !== SW_OK) throw new CardError('PACE step 4 (authentication) failed: the password (CAN / MRZ) is probably wrong', s4.sw);
  const tIcc = answerField(s4.data, 0x86, 'authentication token');
  if (!equalBytes(tIcc, paceToken(info, ksMac, encodePoint(curve, X2)))) throw new CardError('The card did not prove the PACE keys (wrong authentication token).');

  return new SecureMessaging(info.cipher, ksEnc, ksMac, undefined, padMac);
}

export { bytesToOid };
