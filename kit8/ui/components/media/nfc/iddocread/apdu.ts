// Smart card commands (ISO 7816-4). The transport = the phone's NFC (idTransport.ts) or a software card (tests).
import { bytesToHex, concat } from './crypto/bytes';

/** sends raw APDU bytes, returns the raw answer (data + SW1 SW2) */
export interface IsoDepTransport {
  transceive: (apdu: number[]) => Promise<number[]>;
  /** what the NFC layer knows of the tag (id, technologies), when it can tell */
  tag?: { id: string; techTypes: string[] } | null;
}

export interface ApduResponse {
  data: Uint8Array;
  sw: number;
}

export const SW_OK = 0x9000;
export const swHex = (sw: number) => sw.toString(16).toUpperCase().padStart(4, '0');

export class CardError extends Error {
  constructor(message: string, public readonly sw?: number) {
    super(sw != null ? `${message} (card answer ${swHex(sw)})` : message);
  }
}

/** a command: header, data (optional), Le (optional: -1 = none, 0 = 256) */
export function buildApdu(cla: number, ins: number, p1: number, p2: number, data?: Uint8Array, le = -1): Uint8Array {
  const parts: number[] = [cla, ins, p1, p2];
  if (data && data.length) {
    if (data.length > 255) throw new Error('APDU data over 255 bytes');
    parts.push(data.length);
  }
  const head = new Uint8Array(parts);
  const tail = data && data.length ? data : new Uint8Array(0);
  const out = concat(head, tail);
  return le >= 0 ? concat(out, new Uint8Array([le & 0xff])) : out;
}

/** sends a command; follows `61xx` (more data: GET RESPONSE) and `6Cxx` (wrong Le: the same command with the right one) */
export async function sendApdu(transport: IsoDepTransport, apdu: Uint8Array): Promise<ApduResponse> {
  let raw: Uint8Array = Uint8Array.from(await transport.transceive(Array.from(apdu)));
  if (raw.length < 2) throw new CardError('The card sent no answer.');
  let sw = (raw[raw.length - 2] << 8) | raw[raw.length - 1];
  let data: Uint8Array = raw.slice(0, raw.length - 2);
  if ((sw & 0xff00) === 0x6c00) {
    const retry = Uint8Array.from(apdu);
    // a case 2 command (header + Le) or case 4: the last byte is Le
    retry[retry.length - 1] = sw & 0xff;
    raw = Uint8Array.from(await transport.transceive(Array.from(retry)));
    sw = (raw[raw.length - 2] << 8) | raw[raw.length - 1];
    data = raw.slice(0, raw.length - 2);
  }
  while ((sw & 0xff00) === 0x6100) {
    const more = Uint8Array.from(await transport.transceive([0x00, 0xc0, 0x00, 0x00, sw & 0xff]));
    data = concat(data, more.slice(0, more.length - 2));
    sw = (more[more.length - 2] << 8) | more[more.length - 1];
  }
  return { data, sw };
}

export const hex = bytesToHex;
