// files-drive - small crypto helpers (Web Crypto: the same code runs in Deno and in the Jest node environment).
//   * encryptToken / decryptToken: AES-GCM, the key is the function secret FILES_TOKEN_KEY (base64 of 32 bytes). The database only ever holds the cipher text.
//   * signValue / verifyValue: HMAC-SHA256 (url secret) for the connect "state" and the short-lived download urls.
const enc = new TextEncoder() as { encode(s: string): Uint8Array<ArrayBuffer> };
const dec = new TextDecoder();

export function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesKey(keyB64: string): Promise<CryptoKey> {
  const raw = fromB64Url(keyB64.trim());
  if (raw.length !== 32) throw new Error('FILES_TOKEN_KEY must be 32 bytes (base64).');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** 'v1.<iv>.<cipher>' (base64url) */
export async function encryptToken(plain: string, keyB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64), enc.encode(plain)));
  return `v1.${toB64Url(iv)}.${toB64Url(cipher)}`;
}

export async function decryptToken(cipherText: string, keyB64: string): Promise<string> {
  const [version, iv, data] = String(cipherText || '').split('.');
  if (version !== 'v1' || !iv || !data) throw new Error('Unknown token format.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64Url(iv) }, await aesKey(keyB64), fromB64Url(data));
  return dec.decode(plain);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signValue(secret: string, value: string): Promise<string> {
  return toB64Url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(value))));
}

/** constant time check of a signature made by signValue */
export async function verifyValue(secret: string, value: string, signature: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64Url(signature), enc.encode(value));
  } catch {
    return false;
  }
}

/** '<b64url(json)>.<signature>' - used for the connect state (organization, e-mail, expiry) */
export async function signPayload(secret: string, payload: Record<string, any>): Promise<string> {
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await signValue(secret, body)}`;
}

export async function verifyPayload(secret: string, token: string): Promise<Record<string, any> | null> {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !(await verifyValue(secret, body, sig))) return null;
  try {
    return JSON.parse(dec.decode(fromB64Url(body)));
  } catch {
    return null;
  }
}
