/** @jest-environment node */
import { NeedsPasswordError, ProbeOnlyError, readEmrtd, StepLog } from '../../kit8/ui/components/media/nfc/iddocread/emrtd';
import { CardError } from '../../kit8/ui/components/media/nfc/iddocread/apdu';
import { buildFiles, SimCard, TEST_ACCESS, TEST_CAN } from './idCardTestKit';
import * as nc from 'crypto';

const random = (n: number) => new Uint8Array(nc.randomBytes(n));
const last = (steps: StepLog[], id: string) => [...steps].reverse().find((x) => x.id === id);
const run = (card: SimCard, opts: any = {}) => {
  const steps: StepLog[] = [];
  const p = readEmrtd(card, { random, onStep: (s) => steps.push(s), ...opts });
  return p.then((doc) => ({ doc, steps }));
};

describe('reading a travel document (software card)', () => {
  it('PACE with the CAN, AES-128, brainpoolP256r1: the whole card is read and the hashes agree', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, can: TEST_CAN, pace: { cipher: 'aes128', parameterId: 13 }, files: buildFiles({ paceCipher: 'aes128', paceParam: 13 }) });
    const { doc, steps } = await run(card, { can: TEST_CAN });
    expect(card.opened).toBe('pace');
    expect(doc.access).toBe('pace-can');
    expect(doc.protocol).toBe('PACE ECDH-GM AES-128 (curve 13)');
    expect(doc.mrz).toMatchObject({ format: 'TD1', issuingState: 'LVA', surname: 'ZVEJNIEKS', givenNames: 'JANA ANNA', nationality: 'LVA', sex: 'F', allValid: true });
    expect(doc.mrz?.documentNumber.value).toBe('LV1234567');
    expect(doc.details).toMatchObject({ fullName: 'ZVEJNIEKS, JANA ANNA', birthDate: '1985-02-14', placeOfBirth: ['RIGA', 'LATVIA'], address: ['BRIVIBAS IELA 1', 'RIGA', 'LV-1010'] });
    expect(doc.document).toMatchObject({ issuingAuthority: 'PMLP', dateOfIssue: '2022-05-01' });
    expect(doc.photo?.mime).toBe('image/jpeg');
    expect(doc.photo!.bytes.length).toBe(3000);
    expect(doc.com?.dataGroups).toEqual([1, 2, 11, 12]);
    expect(doc.integrity?.results.every((r) => r.ok === true)).toBe(true);
    expect(doc.integrity?.signatureChecked).toBe(false);
    expect(doc.warnings.join(' ')).toContain('signature');
    expect(last(steps, 'pace-can')?.status).toBe('ok');
    // the log never contains the CAN
    expect(JSON.stringify(steps)).not.toContain(TEST_CAN);
  });

  it.each([
    ['tdes', 12], ['aes128', 12], ['aes192', 15], ['aes256', 16], ['aes128', 8], ['aes128', 9], ['aes128', 10], ['aes128', 11], ['aes128', 14], ['aes256', 17], ['aes256', 18],
  ] as const)('PACE with the MRZ: %s on curve %s', async (cipher, param) => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: { cipher, parameterId: param }, files: buildFiles({ paceCipher: cipher, paceParam: param, photoSize: 600 }) });
    const { doc } = await run(card, { mrz: TEST_ACCESS });
    expect(doc.access).toBe('pace-mrz');
    expect(doc.mrz?.surname).toBe('ZVEJNIEKS');
    expect(doc.integrity?.results.every((r) => r.ok)).toBe(true);
  });

  it('AES secure messaging: a card that builds its MAC from PADDED data opens at the first try (ICAO 9303-11); the step list says nothing of a retry', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: { cipher: 'aes128', parameterId: 13 }, files: buildFiles({ paceCipher: 'aes128', paceParam: 13, photoSize: 600 }) });
    const { doc, steps } = await run(card, { mrz: TEST_ACCESS });
    expect(card.paceOpened).toBe(1);
    expect(doc.mrz?.surname).toBe('ZVEJNIEKS');
    expect(last(steps, 'sm-check')).toBeUndefined();
  });

  it('AES secure messaging: a card that refuses the first protected command (the other MAC) is opened AGAIN with the plain MAC and read completely', async () => {
    // the first real PACE passport (2026-11-23): PACE ok, then every file "not available"
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: { cipher: 'aes128', parameterId: 13 }, plainAesMac: true, files: buildFiles({ paceCipher: 'aes128', paceParam: 13, photoSize: 600 }) });
    const { doc, steps } = await run(card, { mrz: TEST_ACCESS });
    expect(card.paceOpened).toBe(2);
    expect(doc.access).toBe('pace-mrz');
    expect(doc.mrz?.surname).toBe('ZVEJNIEKS');
    expect(doc.photo?.bytes.length).toBe(600);
    expect(doc.integrity?.results.every((r) => r.ok === true)).toBe(true);
    const sm = steps.filter((x) => x.id === 'sm-check');
    expect(sm.map((x) => x.status)).toEqual(['fail', 'ok']);
    expect(sm[0].detail).toContain('6988'); // the answer of the card is in the step list
  });

  it('a file that is really missing says the answer of the card in the step list', async () => {
    const files = buildFiles({ paceCipher: 'aes128', paceParam: 13, photoSize: 600 });
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: { cipher: 'aes128', parameterId: 13 }, files });
    const { steps } = await run(card, { mrz: TEST_ACCESS });
    expect(steps.find((x) => x.id.startsWith('file-') && x.status === 'skip')?.detail ?? 'none').toMatch(/^(none|not available \(card answer [0-9a-f]{4}\))/i);
  });

  it('BAC only (an older passport: no EF.CardAccess)', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: buildFiles({ photoSize: 5000 }) });
    const { doc } = await run(card, { mrz: TEST_ACCESS });
    expect(card.opened).toBe('bac');
    expect(doc.access).toBe('bac');
    expect(doc.protocol).toBe('BAC (3DES)');
    expect(doc.photo!.bytes.length).toBe(5000);
  });

  it('a wrong CAN: the reader goes on with the MRZ, and says what failed', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, can: TEST_CAN, pace: { cipher: 'aes128', parameterId: 13 }, files: buildFiles({ paceCipher: 'aes128', paceParam: 13, photoSize: 500 }) });
    const { doc, steps } = await run(card, { can: '000000', mrz: TEST_ACCESS });
    expect(doc.access).toBe('pace-mrz');
    expect(last(steps, 'pace-can')?.status).toBe('fail');
    expect(last(steps, 'pace-mrz')?.status).toBe('ok');
  });

  it('a wrong CAN and no MRZ: a clear error', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, can: TEST_CAN, pace: { cipher: 'aes128', parameterId: 13 }, files: buildFiles({ paceCipher: 'aes128', paceParam: 13 }) });
    await expect(run(card, { can: '000000' })).rejects.toThrow(/could not be opened.*Check the CAN/);
  });

  it('a wrong MRZ value (BAC): refused, the message names the cause', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: buildFiles() });
    await expect(run(card, { mrz: { ...TEST_ACCESS, birthDate: '850215' } })).rejects.toThrow(/document number or a date is wrong/);
  });

  it('no password at all: the document is looked at, and the error carries what it said (it needs a password)', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, can: TEST_CAN, pace: { cipher: 'aes128', parameterId: 13 }, files: buildFiles({ paceCipher: 'aes128', paceParam: 13 }) });
    card.tag = { id: '08A013E2', techTypes: ['IsoDep', 'NfcA'] };
    const err: any = await run(card).catch((e) => e);
    expect(err).toBeInstanceOf(NeedsPasswordError);
    expect(err.probe).toMatchObject({ kind: 'travel-document', icao: true, dg1Open: false, needsPassword: true });
    expect(err.probe.pace[0]).toMatchObject({ mapping: 'ECDH-GM', cipherLabel: 'AES-128', parameterId: 13 });
    const text = err.probe.lines.join(' ');
    expect(text).toContain('CAN');
    expect(text).toContain('08A013E2');
    expect(text).toContain('random id');
    expect(err.probe.applications.map((a: any) => a.name)).toContain('ICAO travel document (passport / ID card chip)');
    // no personal data and no secure session were needed: the protected files stayed closed
    expect(err.probe.openFiles).toEqual([]);
    expect(card.opened).toBe('none');
  });

  it('a BAC only passport without a password: says it needs the MRZ values', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: buildFiles() });
    const err: any = await run(card).catch((e) => e);
    expect(err).toBeInstanceOf(NeedsPasswordError);
    expect(err.probe.pace).toEqual([]);
    expect(err.probe.lines.join(' ')).toContain('BAC only');
  });

  it('a document that needs no password is read without one (no secure session)', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, openAll: true, files: buildFiles({ photoSize: 700 }) });
    const { doc, steps } = await run(card);
    expect(doc.access).toBe('none');
    expect(doc.protocol).toBe('no password needed');
    expect(doc.mrz?.surname).toBe('ZVEJNIEKS');
    expect(doc.photo!.bytes.length).toBe(700);
    expect(doc.warnings[0]).toContain('without a password');
    expect(steps.some((s) => s.id === 'probe')).toBe(true);
    expect(card.opened).toBe('none');
  });

  it('a payment card without a password: reported as a payment card, nothing is read', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: {}, noApplication: true, apps: ['325041592E5359532E4444463031', 'A0000000031010'] });
    const err: any = await run(card).catch((e) => e);
    expect(err).toBeInstanceOf(ProbeOnlyError);
    expect(err).not.toBeInstanceOf(NeedsPasswordError);
    expect(err.probe.kind).toBe('bank-card');
    expect(err.probe.applications.map((a: any) => a.name)).toEqual(['Contactless payment directory (PPSE)', 'Visa payment card']);
    expect(err.message).toContain('payment card');
  });

  it('a card with only national applications (the German eID) and one with nothing', async () => {
    const eid = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: {}, noApplication: true, apps: ['E80704007F00070302'] });
    const e1: any = await run(eid).catch((e) => e);
    expect(e1.probe.kind).toBe('eid-only');
    expect(e1.message).toContain('AusweisApp');
    const none = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: {}, noApplication: true });
    const e2: any = await run(none).catch((e) => e);
    expect(e2.probe.kind).toBe('unknown');
  });

  it('the directory of the card (EF.DIR) lists its applications with their labels', async () => {
    const { encodeTlv } = require('../../kit8/ui/components/media/nfc/iddocread/asn1');
    const { concat, hexToBytes } = require('../../kit8/ui/components/media/nfc/iddocread/crypto/bytes');
    const entry = (aid: string, label: string) => encodeTlv(0x61, concat(encodeTlv(0x4f, hexToBytes(aid)), encodeTlv(0x50, new TextEncoder().encode(label))));
    const files = { 0x2f00: concat(entry('A000000063504B43532D3135', 'eParaksts'), entry('D2760000850101', 'Other')) };
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files, noApplication: true });
    const err: any = await run(card).catch((e) => e);
    expect(err.probe.applications).toEqual([
      { aid: 'A000000063504B43532D3135', label: 'eParaksts', name: 'PKCS#15 (certificates / signature application)', source: 'directory' },
      { aid: 'D2760000850101', label: 'Other', name: '', source: 'directory' },
    ]);
    expect(err.probe.kind).toBe('eid-only');
    // the same directory as a file of records (READ RECORD)
    const cardRecords = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files, noApplication: true, dirRecords: true });
    const e2: any = await run(cardRecords).catch((e) => e);
    expect(e2.probe.applications.map((a: any) => a.label)).toEqual(['eParaksts', 'Other']);
  });

  it('a card without the travel document application (a bank card, a national only ID card)', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: {}, noApplication: true });
    await expect(run(card, { mrz: TEST_ACCESS })).rejects.toThrow(/no ICAO travel document application/);
  });

  it('a card that offers only a protocol this reader does not run (integrated mapping): says so, BAC still works', async () => {
    const files = buildFiles({ photoSize: 300 });
    const { encodeOid, encodeTlv } = require('../../kit8/ui/components/media/nfc/iddocread/asn1');
    const { concat } = require('../../kit8/ui/components/media/nfc/iddocread/crypto/bytes');
    files[0x011c] = encodeTlv(0x31, encodeTlv(0x30, concat(encodeOid('0.4.0.127.0.7.2.2.4.4.2'), encodeTlv(0x02, new Uint8Array([2])), encodeTlv(0x02, new Uint8Array([13])))));
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files });
    const { doc, steps } = await run(card, { mrz: TEST_ACCESS });
    expect(doc.access).toBe('bac');
    expect(steps.find((s) => s.id === 'pace')?.detail).toContain('ECDH-IM');
  });

  it('a data group that was changed does not match the signed hash', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: buildFiles({ tamperDg1: true, photoSize: 300 }) });
    const { doc } = await run(card, { mrz: TEST_ACCESS });
    expect(doc.integrity?.results.find((r) => r.dg === 1)?.ok).toBe(false);
    expect(doc.warnings.join(' ')).toContain('does NOT match');
  });

  it('a card that answers only short pieces (6700): the reader reads on with smaller pieces', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, maxRead: 40, files: buildFiles({ photoSize: 1500 }) });
    const { doc } = await run(card, { mrz: TEST_ACCESS });
    expect(doc.photo!.bytes.length).toBe(1500);
    expect(doc.integrity?.results.every((r) => r.ok)).toBe(true);
  });

  it('a large face image (20 KB) is read completely', async () => {
    const card = new SimCard({ mrzAccess: TEST_ACCESS, can: TEST_CAN, pace: { cipher: 'aes128', parameterId: 12 }, files: buildFiles({ paceCipher: 'aes128', paceParam: 12, photoSize: 20000 }) });
    const { doc } = await run(card, { can: TEST_CAN });
    expect(doc.photo!.bytes.length).toBe(20000);
    expect(doc.files.find((f) => f.dg === 2)?.complete).toBe(true);
    expect(doc.integrity?.results.every((r) => r.ok)).toBe(true);
  });

  it('CardError carries the card answer in its text', () => {
    expect(new CardError('x', 0x6982).message).toBe('x (card answer 6982)');
  });
});
