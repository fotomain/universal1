/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, press, pressAsync, q, render, text } from './mediaUiTestKit';
import { buildFiles, SimCard, TEST_ACCESS, TEST_CAN, TEST_MRZ_LINES } from './idCardTestKit';

const mockSim: { card: SimCard | null; fail: string; closed: number } = { card: null, fail: '', closed: 0 };
jest.mock('../../kit8/ui/components/media/nfc/iddocread/idTransport', () => ({
  cancelIsoDepWait: async () => undefined,
  isoDepSupported: () => !(globalThis as any).__noIso,
  openIsoDep: async () => {
    const m = (globalThis as any).__sim;
    if (m.fail) throw new Error(m.fail);
    return { transceive: m.card.transceive, close: async () => { m.closed += 1; } };
  },
}));
(globalThis as any).__sim = mockSim;
// the random source of the reader: the test runs in jsdom, which has no crypto.getRandomValues of its own on every version
jest.mock('../../kit8/ui/components/media/nfc/iddocread/crypto/random', () => ({ systemRandom: (n: number) => new Uint8Array(require('crypto').randomBytes(n)) }));
// the post of the result: signed in, the written row is kept for the test (the database / redux are not needed here)
(globalThis as any).__idPosts = [] as any[];
jest.mock('../../kit8/ui/components/media/common/useWriteMediaPost', () => ({
  useIsSignedIn: () => (globalThis as any).__idSignedIn !== false,
  useWriteMediaPost: () => async (build: any) => { const post = build({ ownerGUID: 'u1', rowGUID: 'r1', platform: 'android' }); (globalThis as any).__idPosts.push(post); return post; },
}));
// the owner photo goes to the file storage through this call (mocked: what it was given is kept)
(globalThis as any).__idUploads = [] as any[];
(globalThis as any).__idUploadAnswer = { ok: true };
jest.mock('../../kit8/files/common/identificationPhoto', () => ({
  ...jest.requireActual('../../kit8/files/common/identificationPhoto'),
  uploadIdentificationPhoto: async (postGUID: string, photo: any) => { (globalThis as any).__idUploads.push({ postGUID, mime: photo.mime, size: photo.bytes.length }); return (globalThis as any).__idUploadAnswer; },
}));
const { bytesToHex } = require('../../kit8/ui/components/media/nfc/iddocread/crypto/bytes');
const mockClosedCount = () => (globalThis as any).__sim.closed;

import IdCardReader, { applyMrzLines, EMPTY_FORM, formToOptions } from '../../kit8/ui/components/media/nfc/iddocread/IdCardReader';
import { FILE_IDS } from '../../kit8/ui/components/media/nfc/iddocread/dataGroups';
import { friendlyIdError } from '../../kit8/ui/components/media/nfc/iddocread/useIdReader';

const type = (testID: string, value: string) => act(() => {
  const el: any = q(testID)!;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

beforeEach(() => {
  mockSim.card = new SimCard({ mrzAccess: TEST_ACCESS, can: TEST_CAN, pace: { cipher: 'aes128', parameterId: 13 }, files: buildFiles({ paceCipher: 'aes128', paceParam: 13, photoSize: 800 }) });
  mockSim.fail = '';
  mockSim.closed = 0;
  (globalThis as any).__noIso = false;
});
afterEach(() => { cleanup(); jest.clearAllMocks(); (globalThis as any).__idUploads.length = 0; (globalThis as any).__idPosts.length = 0; });

describe('the form', () => {
  it('needs the CAN or the three MRZ values; says what is wrong', () => {
    // nothing typed is fine: the document is looked at without a password
    expect(formToOptions(EMPTY_FORM)).toEqual({ options: {}, problems: [] });
    expect(formToOptions({ ...EMPTY_FORM, can: '123456' }).options).toEqual({ can: '123456' });
    const r = formToOptions({ ...EMPTY_FORM, documentNumber: 'LV1234567', birthDate: '14.02.1985', expiryDate: '30.04.2032' });
    expect(r.options).toEqual({ mrz: { documentNumber: 'LV1234567', birthDate: '850214', expiryDate: '320430' } });
    const bad = formToOptions({ ...EMPTY_FORM, documentNumber: 'LV1', birthDate: 'x', expiryDate: '' });
    expect(bad.options).toBeNull();
    expect(bad.problems).toHaveLength(2);
    expect(formToOptions({ ...EMPTY_FORM, can: '12' }).problems[0]).toContain('CAN');
    // both given: both go to the reader (it tries the CAN first)
    expect(formToOptions({ ...EMPTY_FORM, can: '123456', documentNumber: 'LV1234567', birthDate: '850214', expiryDate: '320430' }).options).toMatchObject({ can: '123456', mrz: expect.any(Object) });
  });
  it('pasted MRZ lines fill the fields and the country', () => {
    const f = applyMrzLines(EMPTY_FORM, TEST_MRZ_LINES.join('\n'));
    expect(f).toMatchObject({ documentNumber: 'LV1234567', birthDate: '14.02.1985', expiryDate: '30.04.2032', country: 'LVA' });
    expect(applyMrzLines(EMPTY_FORM, 'garbage').documentNumber).toBe('');
  });
  it('errors of the phone in plain words', () => {
    expect(friendlyIdError(new Error('Tag was lost.'))).toContain('moved away');
    expect(friendlyIdError(new Error('Transceive failed'))).toContain('moved away');
    expect(friendlyIdError(new Error('timeout'))).toContain('too long');
    expect(friendlyIdError(new Error('The card refused the BAC authentication: the document number or a date is wrong (card answer 6300)'))).toContain('BAC');
  });
});

describe('the screen', () => {
  it('ReadFromDocumentButton is the FIRST control of the screen, and says no input is needed', async () => {
    render(<IdCardReader />);
    await flush();
    const button = q('id-read-from-document')!;
    for (const other of ['id-country', 'id-can', 'id-number', 'id-birth', 'id-expiry', 'id-mrz-lines', 'id-clear']) {
      expect(button.compareDocumentPosition(q(other)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // the other control comes AFTER it
    }
    expect(text('id-read-hint')).toContain('No input needed');
  });

  it('pressed with NOTHING typed: the document is looked at, it says what it is and that it needs its password', async () => {
    render(<IdCardReader />);
    await flush();
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-probe'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(text('id-probe-kind')).toContain('Travel document');
    expect(text('id-probe')).toContain('CAN');
    expect(text('id-probe-app-0')).toContain('ICAO travel document');
    expect(text('id-password-title')).toBe('This document needs its password');
    expect(q('id-error')).toBeNull(); // not an error
    expect(q('id-document')).toBeNull();
    // the same button, with the CAN typed, reads the whole document
    type('id-can', TEST_CAN);
    expect(text('id-read-hint')).toContain('with the password below');
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-document'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(q('id-document')).not.toBeNull();
    expect(q('id-probe')).toBeNull();
    expect(mockClosedCount()).toBe(2);
  });

  it('a payment card pressed with nothing typed: reported as such', async () => {
    mockSim.card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: {}, noApplication: true, apps: ['A0000000031010'] });
    render(<IdCardReader />);
    await flush();
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-probe'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(text('id-probe-kind')).toBe('Payment card');
    expect(text('id-password-title')).toContain('only if it asks');
  });

  it('the country shows its name and note (Latvia)', async () => {
    render(<IdCardReader />);
    await flush();
    type('id-country', 'lva');
    expect(text('id-country-name')).toBe('Latvia');
    expect(text('id-country-note')).toContain('eID karte');
    expect(q('id-problem-0')).toBeNull(); // nothing is required
  });

  it('reads the card with the CAN: the steps, the data, the integrity; the CAN is not in the log', async () => {
    render(<IdCardReader />);
    await flush();
    type('id-can', TEST_CAN);
    expect(q('id-problem-0')).toBeNull();
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-document'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(q('id-document')).not.toBeNull();
    expect(text('id-document-head')).toContain('Latvia');
    expect(text('id-document-head')).toContain('PACE ECDH-GM AES-128');
    expect(text('id-surname')).toContain('ZVEJNIEKS');
    expect(text('id-checkdigits')).toContain('all correct');
    expect(text('id-integrity')).toContain('match the signed hashes');
    expect(q('id-photo')).not.toBeNull();
    expect(text('id-steps')).toContain('PACE with the CAN');
    expect(text('id-steps')).not.toContain(TEST_CAN);
    expect(text('id-warning-0')).toContain('signature');
    expect(mockSim.closed).toBe(1); // the NFC channel is always closed
  });

  it('after a read the user can create a media post: its title is the owner, its sub title the document number (nothing is made before the press)', async () => {
    render(<IdCardReader />);
    await flush();
    type('id-can', TEST_CAN);
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-document'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect((globalThis as any).__idPosts).toHaveLength(0);
    await pressAsync('id-post-create');
    const [post] = (globalThis as any).__idPosts;
    expect(post.rowJSON.mediaPostTitle).toMatch(/ZVEJNIEKS/);
    expect(post.rowJSON.mediaPostSubTitle).toMatch(/^(ID card|Passport) · No\. \S+/);
    expect(post.rowJSON.idCardNumber).toBe(post.rowJSON.mediaPostSubTitle.split('No. ')[1]);
    expect(q('id-post-saved')).not.toBeNull();
    // the owner photo of the chip went to identification/<idcard | passport>/<post guid>
    const [up] = (globalThis as any).__idUploads;
    expect(up).toMatchObject({ postGUID: post.rowGUID, mime: expect.stringMatching(/^image\//) });
    expect(up.size).toBeGreaterThan(0);
    expect(post.rowJSON.idCardFolder).toMatch(/^(idcard|passport)$/);
    expect(text('id-post-note')).toContain(`identification/${post.rowJSON.idCardFolder}/${post.rowGUID}`);
  });

  it('when the reading is finished the screen scrolls down to the Create media post button (once, not before)', async () => {
    const scrolled: any[] = [];
    (Element.prototype as any).scrollIntoView = function (o: any) { scrolled.push({ id: (this as any).getAttribute('data-testid'), o }); };
    render(<IdCardReader />);
    await flush();
    type('id-can', TEST_CAN);
    expect(scrolled).toHaveLength(0);
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-document'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].id).toBe('id-post-anchor');
    expect(q('id-post-anchor')!.contains(q('id-post-create'))).toBe(true);
    delete (Element.prototype as any).scrollIntoView;
  });

  it('a chip that opens but gives no file: the screen says so (no empty result card without a reason)', async () => {
    const all = buildFiles({ paceCipher: 'aes128', paceParam: 13, photoSize: 300 });
    const onlyAccess: Record<number, Uint8Array> = { [FILE_IDS.cardAccess]: all[FILE_IDS.cardAccess] }; // PACE opens, every other file is missing
    mockSim.card = new SimCard({ mrzAccess: TEST_ACCESS, can: TEST_CAN, pace: { cipher: 'aes128', parameterId: 13 }, files: onlyAccess });
    render(<IdCardReader />);
    await flush();
    type('id-can', TEST_CAN);
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-empty-reading'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(text('id-empty-reading')).toContain('none of its files could be read');
    expect(q('id-post-create')).toBeNull();
  });

  it('the post stays when the photo cannot be saved, and the screen says why (no second post is offered)', async () => {
    (globalThis as any).__idUploadAnswer = { ok: false, error: 'Google Drive is not connected.' };
    render(<IdCardReader />);
    await flush();
    type('id-can', TEST_CAN);
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-document'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    await pressAsync('id-post-create');
    expect(q('id-post-saved')).not.toBeNull();
    expect(text('id-post-note')).toContain('NOT saved: Google Drive is not connected.');
    (globalThis as any).__idUploadAnswer = { ok: true };
  });

  it('a guest is offered to sign in instead (no post button)', async () => {
    (globalThis as any).__idSignedIn = false;
    render(<IdCardReader />);
    await flush();
    type('id-can', TEST_CAN);
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-document'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(q('id-post-create')).toBeNull();
    expect(q('id-post-signin')).not.toBeNull();
    (globalThis as any).__idSignedIn = true;
  });

  it('Clear wipes the data from the screen', async () => {
    render(<IdCardReader />);
    await flush();
    type('id-can', TEST_CAN);
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-document'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(q('id-document')).not.toBeNull();
    press('id-clear');
    expect(q('id-document')).toBeNull();
    expect(q('id-steps')).toBeNull();
  });

  it('leaving the screen wipes the data too', async () => {
    render(<IdCardReader />);
    await flush();
    type('id-can', TEST_CAN);
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-document'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    cleanup();
    expect(document.body.textContent).not.toContain('ZVEJNIEKS');
  });

  it('a wrong CAN: the error and the failed step are shown, and the channel is closed', async () => {
    render(<IdCardReader />);
    await flush();
    type('id-can', '000000');
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-error'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(text('id-error')).toContain('could not be opened');
    expect(text('id-step-pace-can')).toContain('✗');
    expect(q('id-document')).toBeNull();
    expect(mockSim.closed).toBe(1);
  });

  it('the phone says the tag was lost: a plain message', async () => {
    mockSim.fail = 'Tag was lost.';
    render(<IdCardReader />);
    await flush();
    type('id-can', TEST_CAN);
    await pressAsync('id-read-from-document');
    for (let i = 0; i < 30 && !q('id-error'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(text('id-error')).toContain('moved away');
  });

  it('in a browser the screen says it cannot read, and Read stays off', async () => {
    (globalThis as any).__noIso = true;
    render(<IdCardReader />);
    await flush();
    expect(q('id-unsupported')).not.toBeNull();
  });

  it('the limits are always shown', async () => {
    render(<IdCardReader />);
    await flush();
    expect(text('id-limits')).toContain('Never read: fingerprints');
    expect(bytesToHex([1])).toBe('01');
  });
});
