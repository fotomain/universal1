// Files of a smart card: SELECT a file, READ BINARY in pieces (plain, or through the secure messaging of BAC / PACE). Pure logic over a transport.
import { buildApdu, IsoDepTransport, SW_OK, sendApdu } from './apdu';
import { concat } from './crypto/bytes';
import type { SecureMessaging } from './secureMessaging';

const CHUNK = 0xc0;
const MAX_OFFSET = 0x7fff;

export async function selectEf(transport: IsoDepTransport, sm: SecureMessaging | null, id: number): Promise<number> {
  const data = new Uint8Array([id >> 8, id & 0xff]);
  if (!sm) return (await sendApdu(transport, buildApdu(0x00, 0xa4, 0x02, 0x0c, data))).sw;
  return (await sm.send(transport, 0x00, 0xa4, 0x02, 0x0c, data)).sw;
}

export async function readBinary(transport: IsoDepTransport, sm: SecureMessaging | null, offset: number, length: number): Promise<{ data: Uint8Array; sw: number }> {
  const p1 = (offset >> 8) & 0x7f;
  const p2 = offset & 0xff;
  if (!sm) {
    const r = await sendApdu(transport, buildApdu(0x00, 0xb0, p1, p2, undefined, length & 0xff));
    return { data: r.data, sw: r.sw };
  }
  return sm.send(transport, 0x00, 0xb0, p1, p2, undefined, length & 0xff);
}

/** reads a whole file: the first bytes tell the TLV length, then the rest in pieces. null = the file is not there / not allowed */
export async function readFile(transport: IsoDepTransport, sm: SecureMessaging | null, id: number): Promise<{ data: Uint8Array; complete: boolean } | null> {
  const sel = await selectEf(transport, sm, id);
  if (sel !== SW_OK) return null;
  const head = await readBinary(transport, sm, 0, 4);
  if (head.sw !== SW_OK && head.sw !== 0x6282) return null;
  if (head.data.length < 2) return null;
  // total = tag bytes + length bytes + value length
  let p = 1;
  if ((head.data[0] & 0x1f) === 0x1f) p += 1;
  let len = head.data[p++];
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i += 1) len = len * 256 + (head.data[p++] ?? 0);
  }
  const total = p + len;
  let out = head.data;
  let chunk = CHUNK;
  let guard = 0;
  while (out.length < total && out.length <= MAX_OFFSET && guard < 4000) {
    guard += 1;
    const want = Math.min(chunk, total - out.length, MAX_OFFSET + 1 - out.length);
    const r = await readBinary(transport, sm, out.length, want);
    if (r.sw === 0x6700 || (r.sw & 0xff00) === 0x6c00) {
      if (chunk <= 16) break;
      chunk = Math.floor(chunk / 2); // the card answers shorter pieces only
      continue;
    }
    if (r.sw !== SW_OK && r.sw !== 0x6282) break;
    if (!r.data.length) break;
    out = concat(out, r.data);
  }
  return { data: out.slice(0, Math.min(out.length, total)), complete: out.length >= total };
}

