// Secure messaging of the eMRTD (ICAO 9303 part 11): every command and answer after BAC / PACE is encrypted and has a MAC.
//   3DES: KSenc / KSmac 16 bytes, SSC 8 bytes, IV 0, retail MAC (8 bytes)
//   AES:  KSenc / KSmac 16-32 bytes, SSC 16 bytes, IV = AES(KSenc, SSC), AES-CMAC cut to 8 bytes. The data of the MAC is padded (ISO 9797-1 method 2, 80 00 ..)
//         first (`padMac`, ICAO 9303-11 as read 2026-11-23; the first real PACE passport refused every file with the UNPADDED variant - emrtd.ts tries the other
//         variant when the first file cannot be read)
import { buildApdu, CardError, IsoDepTransport, sendApdu, ApduResponse } from './apdu';
import { concat, equalBytes } from './crypto/bytes';
import { aesCbc, aesCmac, aesEcb, pad, retailMac, tdesCbc, unpad } from './crypto/symmetric';
import { encodeTlv, readTlvs, findTlv } from './asn1';

export type SmKind = 'tdes' | 'aes';

export class SecureMessaging {
  private ssc: Uint8Array;

  constructor(public readonly kind: SmKind, private readonly ksEnc: Uint8Array, private readonly ksMac: Uint8Array, ssc?: Uint8Array, public readonly padMac: boolean = true) {
    this.ssc = ssc ? Uint8Array.from(ssc) : new Uint8Array(kind === 'tdes' ? 8 : 16);
  }

  private get block() {
    return this.kind === 'tdes' ? 8 : 16;
  }

  private increment() {
    for (let i = this.ssc.length - 1; i >= 0; i -= 1) {
      this.ssc[i] = (this.ssc[i] + 1) & 0xff;
      if (this.ssc[i] !== 0) break;
    }
  }

  private mac(data: Uint8Array): Uint8Array {
    return this.kind === 'tdes' ? retailMac(this.ksMac, pad(data, 8)) : aesCmac(this.ksMac, this.padMac ? pad(data, 16) : data).slice(0, 8);
  }

  private encrypt(data: Uint8Array): Uint8Array {
    const padded = pad(data, this.block);
    return this.kind === 'tdes' ? tdesCbc(this.ksEnc, padded, true) : aesCbc(this.ksEnc, aesEcb(this.ksEnc, this.ssc), padded, true);
  }

  private decrypt(data: Uint8Array): Uint8Array {
    return this.kind === 'tdes' ? tdesCbc(this.ksEnc, data, false) : aesCbc(this.ksEnc, aesEcb(this.ksEnc, this.ssc), data, false);
  }

  /** the protected command: DO87 (data) + DO97 (Le) + DO8E (MAC) */
  protect(cla: number, ins: number, p1: number, p2: number, data?: Uint8Array, le = -1): Uint8Array {
    this.increment();
    const maskedCla = cla | 0x0c;
    const header = pad(new Uint8Array([maskedCla, ins, p1, p2]), this.block);
    let body: Uint8Array = new Uint8Array(0);
    if (data && data.length) body = concat(body, encodeTlv(0x87, concat(new Uint8Array([0x01]), this.encrypt(data))));
    if (le >= 0) body = concat(body, encodeTlv(0x97, new Uint8Array([le & 0xff])));
    const cc = this.mac(concat(this.ssc, header, body));
    const all = concat(body, encodeTlv(0x8e, cc));
    return buildApdu(maskedCla, ins, p1, p2, all, 0);
  }

  /** checks the MAC of an answer and returns its data; throws on a wrong MAC (a card or a line that cannot be trusted) */
  unprotect(response: ApduResponse): { data: Uint8Array; sw: number } {
    this.increment();
    if (!response.data.length) return { data: new Uint8Array(0), sw: response.sw };
    const tlvs = readTlvs(response.data);
    const do87 = findTlv(tlvs, 0x87);
    const do99 = findTlv(tlvs, 0x99);
    const do8e = findTlv(tlvs, 0x8e);
    if (!do99 || !do8e) throw new CardError('The card answer has no secure messaging data.', response.sw);
    let signed: Uint8Array = new Uint8Array(0);
    if (do87) signed = concat(signed, encodeTlv(0x87, do87.value));
    signed = concat(signed, encodeTlv(0x99, do99.value));
    if (!equalBytes(this.mac(concat(this.ssc, signed)), do8e.value)) throw new CardError('The MAC of the card answer is wrong (the connection was disturbed).');
    const sw = (do99.value[0] << 8) | do99.value[1];
    let data: Uint8Array = new Uint8Array(0);
    if (do87) data = unpad(this.decrypt(do87.value.slice(1)));
    return { data, sw };
  }

  /** send one protected command through the transport and return the checked answer */
  async send(transport: IsoDepTransport, cla: number, ins: number, p1: number, p2: number, data?: Uint8Array, le = -1): Promise<{ data: Uint8Array; sw: number }> {
    const answer = await sendApdu(transport, this.protect(cla, ins, p1, p2, data, le));
    return this.unprotect(answer);
  }

  /** for tests: the counter */
  get counter(): Uint8Array {
    return Uint8Array.from(this.ssc);
  }
}
