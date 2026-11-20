// 3DES (BAC, old PACE), AES (PACE), the MACs of the secure messaging. Pure JS: node-forge for DES, noble ciphers for AES.
// Padding of the protocol is ISO 9797-1 method 2 (0x80, then zeros), done HERE by the caller of the raw block functions.
import { cbc, ecb } from '@noble/ciphers/aes';
import { concat, xor } from './bytes';

// node-forge: only the base + DES modules (the whole library is big)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const forge: any = require('node-forge/lib/forge');
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('node-forge/lib/des');

const toBin = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i += 1) s += String.fromCharCode(b[i]);
  return s;
};
const fromBin = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};
const NO_PADDING = () => true; // forge adds PKCS#7 unless the finish filter says no: the protocol pads by itself

/** ISO 9797-1 padding method 2 */
export function pad(data: Uint8Array, block: number): Uint8Array {
  const n = block - (data.length % block);
  const out = new Uint8Array(data.length + n);
  out.set(data);
  out[data.length] = 0x80;
  return out;
}

/** removes method 2 padding; throws when there is none */
export function unpad(data: Uint8Array): Uint8Array {
  let i = data.length - 1;
  while (i >= 0 && data[i] === 0x00) i -= 1;
  if (i < 0 || data[i] !== 0x80) throw new Error('bad padding');
  return data.slice(0, i);
}

/** sets the odd parity bit of every key byte (DES keys; the ICAO test vectors show keys with parity) */
export function adjustParity(key: Uint8Array): Uint8Array {
  const out = new Uint8Array(key.length);
  for (let i = 0; i < key.length; i += 1) {
    let b = key[i] & 0xfe;
    let ones = 0;
    for (let k = 1; k < 8; k += 1) ones += (b >> k) & 1;
    if (ones % 2 === 0) b |= 1;
    out[i] = b;
  }
  return out;
}

const key24 = (key: Uint8Array): Uint8Array => (key.length === 16 ? concat(key, key.slice(0, 8)) : key);

function desRun(algorithm: string, key: Uint8Array, iv: Uint8Array | null, data: Uint8Array, encrypt: boolean): Uint8Array {
  const k = forge.util.createBuffer(toBin(key));
  const c = encrypt ? forge.cipher.createCipher(algorithm, k) : forge.cipher.createDecipher(algorithm, k);
  c.start(iv ? { iv: forge.util.createBuffer(toBin(iv)) } : {});
  c.update(forge.util.createBuffer(toBin(data)));
  if (!c.finish(NO_PADDING)) throw new Error('DES failed');
  return fromBin(c.output.getBytes());
}

/** 3DES (EDE, 2 or 3 keys) in CBC mode, data = whole blocks of 8, IV = 0 unless given */
export function tdesCbc(key: Uint8Array, data: Uint8Array, encrypt: boolean, iv: Uint8Array = new Uint8Array(8)): Uint8Array {
  if (data.length % 8) throw new Error('3DES needs whole blocks');
  return desRun('3DES-CBC', key24(key), iv, data, encrypt);
}

/** ISO 9797-1 MAC algorithm 3 ("retail MAC", DES with a final 3DES step), key = K1 || K2, `padded` = whole blocks, result 8 bytes */
export function retailMac(key: Uint8Array, padded: Uint8Array): Uint8Array {
  const k1 = key.slice(0, 8);
  const k2 = key.slice(8, 16);
  const cbcOut = desRun('DES-CBC', k1, new Uint8Array(8), padded, true);
  const last = cbcOut.slice(cbcOut.length - 8);
  const mid = desRun('DES-ECB', k2, null, last, false);
  return desRun('DES-ECB', k1, null, mid, true);
}

/** AES in CBC mode without padding */
export function aesCbc(key: Uint8Array, iv: Uint8Array, data: Uint8Array, encrypt: boolean): Uint8Array {
  if (data.length % 16) throw new Error('AES needs whole blocks');
  const c = cbc(key, iv, { disablePadding: true });
  return encrypt ? c.encrypt(data) : c.decrypt(data);
}

/** one AES block (ECB) - the IV of the secure messaging is E(KSenc, SSC) */
export function aesEcb(key: Uint8Array, data: Uint8Array): Uint8Array {
  return ecb(key, { disablePadding: true }).encrypt(data);
}

const dbl = (block: Uint8Array): Uint8Array => {
  const out = new Uint8Array(16);
  let carry = 0;
  for (let i = 15; i >= 0; i -= 1) {
    out[i] = ((block[i] << 1) | carry) & 0xff;
    carry = (block[i] >> 7) & 1;
  }
  if (block[0] & 0x80) out[15] ^= 0x87;
  return out;
};

/** AES-CMAC (RFC 4493), 16 bytes */
export function aesCmac(key: Uint8Array, message: Uint8Array): Uint8Array {
  const l = aesEcb(key, new Uint8Array(16));
  const k1 = dbl(l);
  const k2 = dbl(k1);
  const blocks = Math.max(1, Math.ceil(message.length / 16));
  const complete = message.length > 0 && message.length % 16 === 0;
  const last = new Uint8Array(16);
  const start = (blocks - 1) * 16;
  if (complete) {
    last.set(xor(message.slice(start, start + 16), k1));
  } else {
    const rest = message.slice(start);
    const padded = new Uint8Array(16);
    padded.set(rest);
    padded[rest.length] = 0x80;
    last.set(xor(padded, k2));
  }
  let x: Uint8Array = new Uint8Array(16);
  for (let i = 0; i < blocks - 1; i += 1) x = aesEcb(key, xor(x, message.slice(i * 16, i * 16 + 16)));
  return aesEcb(key, xor(x, last));
}
