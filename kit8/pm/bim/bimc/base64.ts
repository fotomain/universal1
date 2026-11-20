// base64 -> ArrayBuffer without atob / Buffer (the demo viewer reads its chunks from a json file; every platform).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const clean = b64.replace(/[\r\n\s]/g, '');
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)];
    const b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = clean.charCodeAt(i + 2) === 61 ? 0 : LOOKUP[clean.charCodeAt(i + 2)];
    const d = clean.charCodeAt(i + 3) === 61 ? 0 : LOOKUP[clean.charCodeAt(i + 3)];
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('Not base64.');
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out.buffer;
}
