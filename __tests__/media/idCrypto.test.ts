/** @jest-environment node */
import * as nodeCrypto from 'crypto';
import { aesCmac, adjustParity, pad, retailMac, tdesCbc, unpad } from '../../kit8/ui/components/media/nfc/iddocread/crypto/symmetric';
import { bytesToHex, hexToBytes } from '../../kit8/ui/components/media/nfc/iddocread/crypto/bytes';
import { digest } from '../../kit8/ui/components/media/nfc/iddocread/crypto/hash';
import { curveOf, decodePoint, encodePoint, SUPPORTED_PARAMETER_IDS, xCoordinate } from '../../kit8/ui/components/media/nfc/iddocread/crypto/ec';

describe('hashes', () => {
  it('SHA-1 / SHA-2 of "abc"', () => {
    const abc = new Uint8Array([0x61, 0x62, 0x63]);
    expect(bytesToHex(digest('sha1', abc))).toBe('A9993E364706816ABA3E25717850C26C9CD0D89D');
    expect(bytesToHex(digest('sha256', abc))).toBe('BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD');
  });
});

describe('AES-CMAC (RFC 4493 vectors)', () => {
  const key = hexToBytes('2b7e151628aed2a6abf7158809cf4f3c');
  it.each([
    ['', 'BB1D6929E95937287FA37D129B756746'],
    ['6bc1bee22e409f96e93d7e117393172a', '070A16B46B4D4144F79BDD9DD04A287C'],
    ['6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411', 'DFA66747DE9AE63030CA32611497C827'],
    ['6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710', '51F0BEBF7E3B9D92FC49741779363CFE'],
  ])('message %#', (msg, mac) => expect(bytesToHex(aesCmac(key, hexToBytes(msg)))).toBe(mac));
});

describe('3DES / retail MAC (ICAO 9303-11 appendix D, BAC example)', () => {
  // the example of the ICAO document: MRZ L898902C<3 6908061 9406236
  const kEnc = hexToBytes('AB94FDECF2674FDFB9B391F85D7F76F2');
  const kMac = hexToBytes('7962D9ECE03D1ACD4C76089DCE131543');
  it('keys from the MRZ information', () => {
    const seed = digest('sha1', new TextEncoder().encode('L898902C<369080619406236')).slice(0, 16);
    expect(bytesToHex(seed)).toBe('239AB9CB282DAF66231DC5A4DF6BFBAE');
    const kd = (c: number) => adjustParity(digest('sha1', new Uint8Array([...seed, 0, 0, 0, c])).slice(0, 16));
    expect(bytesToHex(kd(1))).toBe('AB94FDECF2674FDFB9B391F85D7F76F2');
    expect(bytesToHex(kd(2))).toBe('7962D9ECE03D1ACD4C76089DCE131543');
  });
  it('the mutual authentication command: E_IFD and M_IFD', () => {
    const s = hexToBytes('781723860C06C2264608F91988702212' + '0B795240CB7049B01C19B33E32804F0B');
    const eIfd = tdesCbc(kEnc, s, true);
    expect(bytesToHex(eIfd)).toBe('72C29C2371CC9BDB65B779B8E8D37B29ECC154AA56A8799FAE2F498F76ED92F2');
    expect(bytesToHex(retailMac(kMac, pad(eIfd, 8)))).toBe('5F1448EEA8AD90A7');
    expect(bytesToHex(tdesCbc(kEnc, eIfd, false))).toBe(bytesToHex(s));
  });
  it('padding round trip', () => {
    expect(bytesToHex(pad(new Uint8Array([1, 2, 3]), 8))).toBe('0102038000000000');
    expect(bytesToHex(unpad(pad(new Uint8Array([1, 2, 3]), 8)))).toBe('010203');
    expect(bytesToHex(pad(new Uint8Array(8), 8)).length).toBe(32);
    expect(() => unpad(new Uint8Array(8))).toThrow('bad padding');
  });
});

describe('curves of the PACE domain parameters', () => {
  const names: Record<number, string> = { 8: 'prime192v1', 9: 'brainpoolP192r1', 10: 'secp224r1', 11: 'brainpoolP224r1', 12: 'prime256v1', 13: 'brainpoolP256r1', 14: 'brainpoolP320r1', 15: 'secp384r1', 16: 'brainpoolP384r1', 17: 'brainpoolP512r1', 18: 'secp521r1' };
  it('all eleven are there', () => expect(SUPPORTED_PARAMETER_IDS.sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]));
  it.each(Object.entries(names))('id %s (%s): the public key and the shared secret agree with OpenSSL', (id, name) => {
    const curve = curveOf(Number(id));
    const a = nodeCrypto.createECDH(name);
    const b = nodeCrypto.createECDH(name);
    a.generateKeys();
    b.generateKeys();
    // our point arithmetic: private key of a times the public key of b
    const priv = BigInt(`0x${a.getPrivateKey('hex')}`);
    const pubB = decodePoint(curve, new Uint8Array(b.getPublicKey()));
    const ours = xCoordinate(curve, pubB.multiply(priv));
    expect(bytesToHex(ours)).toBe(a.computeSecret(b.getPublicKey()).toString('hex').toUpperCase());
    // and the base point times the private key is the public key
    expect(bytesToHex(encodePoint(curve, curve.Point.BASE.multiply(priv)))).toBe(a.getPublicKey('hex').toUpperCase());
  });
  it('a point that is not on the curve is refused', () => {
    const curve = curveOf(12);
    const bad = new Uint8Array(65);
    bad[0] = 4;
    bad[64] = 1;
    expect(() => decodePoint(curve, bad)).toThrow();
    expect(() => curveOf(3)).toThrow('does not support');
  });
});
