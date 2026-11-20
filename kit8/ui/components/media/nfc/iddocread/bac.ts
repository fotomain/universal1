// Basic Access Control (ICAO 9303 part 11, section 4.3): the keys come from the MRZ (document number, birth date, expiry date) that the
// holder shows; a mutual authentication with 3DES gives the session keys. Every ePassport since 2006 knows it; newer documents prefer PACE.
import { buildApdu, CardError, IsoDepTransport, SW_OK, sendApdu } from './apdu';
import { concat, equalBytes, xor } from './crypto/bytes';
import { digest } from './crypto/hash';
import type { RandomSource } from './crypto/random';
import { adjustParity, pad, retailMac, tdesCbc } from './crypto/symmetric';
import { MrzAccess, mrzKeySeed } from './mrz';
import { SecureMessaging } from './secureMessaging';

/** Kenc (counter 1) / Kmac (counter 2) of a 16 byte seed: SHA-1(seed || 00 00 00 c), 16 bytes, odd parity */
export function bacKey(seed: Uint8Array, counter: number): Uint8Array {
  return adjustParity(digest('sha1', concat(seed, new Uint8Array([0, 0, 0, counter]))).slice(0, 16));
}

export interface BacKeys {
  kEnc: Uint8Array;
  kMac: Uint8Array;
}

export function bacKeysFromMrz(access: MrzAccess): BacKeys {
  const seed = mrzKeySeed(access).slice(0, 16);
  return { kEnc: bacKey(seed, 1), kMac: bacKey(seed, 2) };
}

/** the command data of the mutual authentication (E_IFD || M_IFD), the part a test can compare with the ICAO example */
export function bacAuthenticateData(keys: BacKeys, rndIfd: Uint8Array, rndIcc: Uint8Array, kIfd: Uint8Array): Uint8Array {
  const eIfd = tdesCbc(keys.kEnc, concat(rndIfd, rndIcc, kIfd), true);
  return concat(eIfd, retailMac(keys.kMac, pad(eIfd, 8)));
}

/** reads the answer of the card; returns the session keys and the counter, throws when the card did not prove the same MRZ */
export function bacSession(keys: BacKeys, answer: Uint8Array, rndIfd: Uint8Array, rndIcc: Uint8Array, kIfd: Uint8Array): SecureMessaging {
  if (answer.length !== 40) throw new CardError('The card answer to the BAC authentication has the wrong length.');
  const eIcc = answer.slice(0, 32);
  const mIcc = answer.slice(32);
  if (!equalBytes(retailMac(keys.kMac, pad(eIcc, 8)), mIcc)) throw new CardError('The BAC answer of the card has a wrong MAC.');
  const r = tdesCbc(keys.kEnc, eIcc, false);
  if (!equalBytes(r.slice(0, 8), rndIcc) || !equalBytes(r.slice(8, 16), rndIfd)) throw new CardError('The BAC answer does not contain our random numbers.');
  const kIcc = r.slice(16, 32);
  const seed = xor(kIfd, kIcc);
  const ssc = concat(rndIcc.slice(4, 8), rndIfd.slice(4, 8));
  return new SecureMessaging('tdes', bacKey(seed, 1), bacKey(seed, 2), ssc);
}

/** the whole BAC: GET CHALLENGE, MUTUAL AUTHENTICATE. The application must be selected. */
export async function performBac(transport: IsoDepTransport, access: MrzAccess, random: RandomSource): Promise<SecureMessaging> {
  const keys = bacKeysFromMrz(access);
  const challenge = await sendApdu(transport, buildApdu(0x00, 0x84, 0x00, 0x00, undefined, 0x08));
  if (challenge.sw !== SW_OK || challenge.data.length !== 8) throw new CardError('GET CHALLENGE failed', challenge.sw);
  const rndIfd = random(8);
  const kIfd = random(16);
  const data = bacAuthenticateData(keys, rndIfd, challenge.data, kIfd);
  const answer = await sendApdu(transport, buildApdu(0x00, 0x82, 0x00, 0x00, data, 0x28));
  // a wrong MRZ (document number / dates) is answered with 6300 / 6982 / 6A80: the card cannot tell which value was wrong
  if (answer.sw !== SW_OK) throw new CardError('The card refused the BAC authentication: the document number or a date is wrong', answer.sw);
  return bacSession(keys, answer.data, rndIfd, challenge.data, kIfd);
}
