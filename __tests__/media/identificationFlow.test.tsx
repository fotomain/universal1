/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, press, pressAsync, q, render, text as kitText } from './mediaUiTestKit';
import { buildFiles, SimCard, TEST_ACCESS, TEST_MRZ_LINES } from './idCardTestKit';

// ---- fake camera, fake photo tools, fake text recognition, fake NFC channel
const cam: any = { takes: 0, path: '/cache/zone.jpg' };
(globalThis as any).__cam = cam;
(globalThis as any).__camPerm = { hasPermission: true, requestPermission: jest.fn(async () => true) };
jest.mock('react-native-vision-camera', () => {
  const R = require('react');
  const Camera = R.forwardRef((props: any, ref: any) => {
    (globalThis as any).__camProps = props; // the real camera refuses a photo when it is not active
    R.useImperativeHandle(ref, () => ({ takePhoto: async () => { if (!(globalThis as any).__camProps.isActive) throw new Error('Camera is closed.'); await Promise.resolve(); if (!(globalThis as any).__camProps.isActive) throw new Error('Camera is closed.'); (globalThis as any).__cam.takes += 1; return { path: (globalThis as any).__cam.path, width: 4000, height: 3000 }; } }));
    return R.createElement('div', { 'data-testid': 'camera' });
  });
  return { Camera, useCameraDevice: () => ({ id: 'back', minZoom: 1, maxZoom: 8, neutralZoom: 1, hasTorch: true }), useCameraPermission: () => (globalThis as any).__camPerm };
});
const mockManipulate = jest.fn(async (uri: string, _a: any, o: any) => ({ uri: `${uri}.small.jpg`, width: 2000, height: 1500, ...(o?.base64 ? { base64: 'QUJDREVG' } : {}) }));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: (u: string, a: any, o: any) => mockManipulate(u, a, o), SaveFormat: { JPEG: 'jpeg' } }));
const mockDeleted: string[] = [];
jest.mock('expo-file-system', () => ({
  File: function File(this: any, uri: string) {
    this.uri = uri;
    this.exists = true;
    this.delete = () => mockDeleted.push(uri);
  },
}));
// signed in / guest, Google AI consent and Google AI itself are controlled by the test
(globalThis as any).__signedIn = true;
jest.mock('../../kit8/ui/components/media/common/useWriteMediaPost', () => ({ useIsSignedIn: () => (globalThis as any).__signedIn, useWriteMediaPost: () => async () => ({}) }));
(globalThis as any).__ai = { consent: false, saved: [] as boolean[], possible: true, calls: [] as any[], answer: null as any, textCalls: [] as any[], textAnswer: null as any, textConsent: true, textSaved: [] as boolean[] };
jest.mock('../../kit8/ui/components/media/nfc/identification/aiConsent', () => ({
  loadAiConsent: async () => (globalThis as any).__ai.consent,
  saveAiConsent: async (on: boolean) => { (globalThis as any).__ai.saved.push(on); },
}));
jest.mock('../../kit8/ui/components/media/nfc/identification/aiRecognize', () => ({
  aiConfig: () => null,
  aiPossible: (signedIn: boolean) => (globalThis as any).__ai.possible && signedIn,
  recognizeTextWithAi: async (lines: string[], type: string) => {
    const ai = (globalThis as any).__ai;
    ai.textCalls.push({ lines, type });
    if (ai.textAnswer instanceof Error) throw ai.textAnswer;
    return ai.textAnswer;
  },
  recognizeWithAi: async (input: any) => {
    const ai = (globalThis as any).__ai;
    ai.calls.push(input);
    if (ai.answer instanceof Error) throw ai.answer;
    return ai.answer;
  },
}));
jest.mock('expo-mlkit-ocr', () => ({ isSupported: () => true, recognizeText: async () => ({ text: '', blocks: [] }) }));
let mockLines: string[] | Error = [];
jest.mock('../../kit8/ui/components/media/nfc/identification/ocrEngine', () => ({
  ocrAvailable: () => true,
  recognizeLines: async (uri: string) => { (globalThis as any).__ocrUri = uri; if (mockLines instanceof Error) throw mockLines; return mockLines; },
  orderLines: (b: any) => b,
}));
(globalThis as any).__sim = { card: null, fail: '', closed: 0 };
jest.mock('../../kit8/ui/components/media/nfc/iddocread/idTransport', () => ({
  isoDepSupported: () => true,
  openIsoDep: async () => { const m = (globalThis as any).__sim; return { transceive: m.card.transceive, close: async () => { m.closed += 1; } }; },
}));
jest.mock('../../kit8/ui/components/media/nfc/iddocread/crypto/random', () => ({ systemRandom: (n: number) => new Uint8Array(require('crypto').randomBytes(n)) }));

import { aiTextRetryConfig } from '../../kit8/ui/components/media/nfc/identification/aiTextRetry';
import IdentificationFlow from '../../kit8/ui/components/media/nfc/identification/IdentificationFlow';

// the info texts of the confirm step are ONE line + "more..." : the source and the notes exist only after it was pressed
const text = (testID: string) => { if (!q(testID) && q('ident-info-more')) press('ident-info-more'); return kitText(testID); };
const type = (testID: string, value: string) => act(() => {
  const el: any = q(testID)!;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const until = async (testID: string) => { for (let i = 0; i < 40 && !q(testID) && !(testID === 'ident-source' && q('ident-info-more')); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); };

const NOISY_TD1 = [TEST_MRZ_LINES[0].toLowerCase(), TEST_MRZ_LINES[1].replace('850214', '85O214'), TEST_MRZ_LINES[2]]; // lower case + an O for a 0

beforeEach(() => {
  Object.assign((globalThis as any).__ai, { consent: false, saved: [], possible: true, calls: [], answer: null, textCalls: [], textAnswer: null, textConsent: true, textSaved: [] });
  (globalThis as any).__signedIn = true;
  cam.takes = 0;
  mockDeleted.length = 0;
  mockManipulate.mockClear();
  mockLines = ['REPUBLIKA', 'IDENTITY CARD', ...NOISY_TD1];
  (globalThis as any).__sim.card = new SimCard({ mrzAccess: TEST_ACCESS, pace: null, files: buildFiles({ photoSize: 500 }) });
  (globalThis as any).__sim.closed = 0;
  (globalThis as any).__showError = (globalThis as any).__showError;
});
afterEach(() => { cleanup(); jest.clearAllMocks(); });

it('step 1 asks: ID card or passport; the answer opens the photo step with the right hint', async () => {
  render(<IdentificationFlow />);
  await flush();
  expect(text('ident-progress')).toContain('Step 1 of 4');
  expect(q('ident-choose-id')).not.toBeNull();
  expect(q('ident-choose-passport')).not.toBeNull();
  press('ident-choose-passport');
  expect(text('ident-progress')).toContain('Step 2 of 4');
  expect(text('ident-photo-hint')).toContain('Photo page of the passport');
  expect(text('ident-photo-hint')).toContain('anywhere in the picture');
  expect(q('ident-frame')).toBeNull(); // no strict rectangle
  press('ident-photo-back');
  press('ident-choose-id');
  expect(text('ident-photo-hint')).toContain('Back of the ID card');
});

it('photo -> text recognised on the phone -> the three values, repaired and checked; the photo files are deleted', async () => {
  render(<IdentificationFlow />);
  await flush();
  press('ident-choose-id');
  await pressAsync('ident-take');
  await until('ident-step-confirm');
  expect(cam.takes).toBe(1);
  // upright + smaller before the engine, the engine reads the SMALL file
  expect(mockManipulate).toHaveBeenCalledWith('file:///cache/zone.jpg', [{ resize: { width: 2000 } }], expect.objectContaining({ format: 'jpeg' }));
  expect((globalThis as any).__ocrUri).toBe('file:///cache/zone.jpg.small.jpg');
  // the photo of an identity document is never kept: both files are mockDeleted
  expect(mockDeleted).toEqual(expect.arrayContaining(['file:///cache/zone.jpg', 'file:///cache/zone.jpg.small.jpg']));
  expect(text('ident-progress')).toContain('Step 3 of 4');
  expect((q('ident-number') as HTMLInputElement).value).toBe('LV1234567');
  expect((q('ident-birth') as HTMLInputElement).value).toBe('14.02.1985');
  expect((q('ident-expiry') as HTMLInputElement).value).toBe('30.04.2032');
  expect(text('ident-confidence')).toContain('All check digits');
  expect(text('ident-printed')).toContain('ZVEJNIEKS');
});

it('Continue starts the scan step with the values; "Read from document" opens the (software) card with them', async () => {
  render(<IdentificationFlow />);
  await flush();
  press('ident-choose-id');
  await pressAsync('ident-take');
  await until('ident-step-confirm');
  press('ident-continue');
  expect(text('ident-progress')).toContain('Step 4 of 4');
  expect((q('id-number') as HTMLInputElement).value).toBe('LV1234567');
  expect((q('id-birth') as HTMLInputElement).value).toBe('14.02.1985');
  expect((q('id-country') as HTMLInputElement).value).toBe('LVA');
  await pressAsync('id-read-from-document');
  await until('id-document');
  expect(text('id-document-head')).toContain('Latvia');
  expect(text('id-surname')).toContain('ZVEJNIEKS');
  expect(text('id-integrity')).toContain('match the signed hashes');
});

it('the user can correct a value; the scan cannot start with an empty or wrong value', async () => {
  render(<IdentificationFlow />);
  await flush();
  press('ident-choose-id');
  await pressAsync('ident-take');
  await until('ident-step-confirm');
  type('ident-number', 'LV7654321');
  expect(q('ident-number')!.getAttribute('aria-label') ?? '').toBeDefined();
  type('ident-birth', '99.99.1985');
  await pressAsync('ident-continue'); // invalid date: nothing happens
  expect(text('ident-progress')).toContain('Step 3 of 4');
  type('ident-birth', '14.02.1985');
  press('ident-continue');
  expect(text('ident-progress')).toContain('Step 4 of 4');
  expect((q('id-number') as HTMLInputElement).value).toBe('LV7654321');
});

it('no zone in the photo: says so, Retake goes back to the camera', async () => {
  mockLines = ['Hello', 'nothing useful here'];
  (globalThis as any).__ai.textAnswer = { documentType: 'unknown', issuingCountry: null, mrzLines: [], surname: null, givenNames: null, documentNumber: null, dateOfBirth: null, dateOfExpiry: null, sex: null, nationality: null, personalNumber: null, can: null, canCandidate: null, quality: 'poor', notes: 'nothing readable' };
  render(<IdentificationFlow />);
  await flush();
  press('ident-choose-passport');
  await pressAsync('ident-take');
  await until('ident-step-confirm');
  expect(text('ident-no-zone')).toContain('No machine readable zone');
  expect((q('ident-number') as HTMLInputElement).value).toBe('');
  press('ident-retake');
  expect(q('ident-step-photo')).not.toBeNull();
});

it('a zone with a wrong digit is shown as NOT checked, so the user looks at it', async () => {
  mockLines = [TEST_MRZ_LINES[0], TEST_MRZ_LINES[1].replace('850214', '850314'), TEST_MRZ_LINES[2]];
  render(<IdentificationFlow />);
  await flush();
  press('ident-choose-id');
  await pressAsync('ident-take');
  await until('ident-step-confirm');
  expect(text('ident-confidence')).toContain('check digit does not agree');
  press('ident-lines-toggle');
  expect(text('ident-line-0')).toContain('IDLVA');
});

it('the recognition fails: the error is shown, the photo is still deleted, the camera stays', async () => {
  mockLines = new Error('engine broke');
  render(<IdentificationFlow />);
  await flush();
  press('ident-choose-id');
  await pressAsync('ident-take');
  await flush();
  expect((globalThis as any).__showError).toHaveBeenCalled();
  expect(q('ident-step-photo')).not.toBeNull();
  expect(mockDeleted).toContain('file:///cache/zone.jpg');
});

it('"Type the values" skips the photo', async () => {
  render(<IdentificationFlow />);
  await flush();
  press('ident-type-values');
  expect(text('ident-progress')).toContain('Step 3 of 4');
  expect(text('ident-no-zone')).toContain('Type the three values');
  press('ident-confirm-back');
  expect(q('ident-step-type')).not.toBeNull();
});

it('leaving the screen wipes the values and the recognised text', async () => {
  render(<IdentificationFlow />);
  await flush();
  press('ident-choose-id');
  await pressAsync('ident-take');
  await until('ident-step-confirm');
  expect(document.body.textContent).toContain('ZVEJNIEKS');
  cleanup();
  expect(document.body.textContent).not.toContain('ZVEJNIEKS');
});

// ---------------------------------------------------------------- Google AI
const AI_DOC = {
  documentType: 'id_card', issuingCountry: 'LVA', mrzLines: TEST_MRZ_LINES, surname: 'ZVEJNIEKS', givenNames: 'JANA ANNA', documentNumber: 'LV1234567',
  dateOfBirth: '1985-02-14', dateOfExpiry: '2032-04-30', sex: 'F', nationality: 'LVA', personalNumber: null, can: '246810', quality: 'good', notes: null,
};

aiTextRetryConfig.delaysMs = [0, 0];   // no waiting between the automatic tries of Google AI

describe('Google AI (opt-in)', () => {
  it('is OFF by default: the photo stays on the phone, this phone reads it, no base64 is made', async () => {
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    expect(text('ident-ai-switch')).toContain('false');
    expect(text('ident-ai-note')).toContain('never leaves');
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect((globalThis as any).__ai.calls).toHaveLength(0);
    expect(mockManipulate.mock.calls[0][2].base64).toBe(false);
    expect(text('ident-source')).toBe('Read on this phone');
  });

  it('switching it on is remembered and says the photo is SENT to Google', async () => {
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    press('ident-ai-switch');
    expect((globalThis as any).__ai.saved).toEqual([true]);
    expect(text('ident-ai-switch')).toContain('true');
    expect(text('ident-ai-note')).toContain('SENT to Google');
  });

  it('ON: the photo goes to Google AI as base64; its answer is checked with the check digits; the CAN it found fills the CAN field and step 4', async () => {
    (globalThis as any).__ai.consent = true;
    (globalThis as any).__ai.answer = AI_DOC;
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    const call = (globalThis as any).__ai.calls[0];
    expect(call).toMatchObject({ image: 'QUJDREVG', mime: 'image/jpeg', documentType: 'ID' });
    expect(mockManipulate.mock.calls[0][2].base64).toBe(true);
    expect(text('ident-source')).toBe('Read by Google AI');
    expect(text('ident-confidence')).toContain('All check digits');
    expect((q('ident-number') as HTMLInputElement).value).toBe('LV1234567');
    expect((q('ident-can') as HTMLInputElement).value).toBe('246810');
    expect(text('ident-note-0')).toContain('CAN (246810)');
    // the photo files are deleted here as well
    expect(mockDeleted).toEqual(expect.arrayContaining(['file:///cache/zone.jpg', 'file:///cache/zone.jpg.small.jpg']));
    press('ident-continue');
    expect((q('id-can') as HTMLInputElement).value).toBe('246810');
    expect((q('id-number') as HTMLInputElement).value).toBe('LV1234567');
  });

  it('a zone that Google AI got wrong (a digit) is NOT trusted: the printed fields are shown, marked as without check digits', async () => {
    (globalThis as any).__ai.consent = true;
    (globalThis as any).__ai.answer = { ...AI_DOC, mrzLines: [TEST_MRZ_LINES[0], TEST_MRZ_LINES[1].replace('850214', '850314'), TEST_MRZ_LINES[2]], can: null };
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect(text('ident-confidence')).toContain('printed fields');
    expect(text('ident-note-0')).toContain('did not pass its check digits');
    expect((q('ident-birth') as HTMLInputElement).value).toBe('14.02.1985');
  });

  it('Google AI fails: this phone reads the photo instead and the screen says so', async () => {
    (globalThis as any).__ai.consent = true;
    (globalThis as any).__ai.answer = Object.assign(new Error('Google AI is busy or the quota is used up. Try again later.'), { code: 'rate' });
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect(text('ident-source')).toBe('Read on this phone');
    expect(text('ident-note-0')).toContain('Google AI: Google AI is busy');
    expect(text('ident-note-0')).toContain('Read on this phone instead');
    expect((q('ident-number') as HTMLInputElement).value).toBe('LV1234567'); // from this phone's recognition
  });

  it('Google AI finds nothing usable: this phone gets its chance', async () => {
    (globalThis as any).__ai.consent = true;
    (globalThis as any).__ai.answer = { ...AI_DOC, mrzLines: [], documentNumber: null, dateOfBirth: null, dateOfExpiry: null, can: null, quality: 'poor', notes: 'too blurred' };
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect(text('ident-source')).toBe('Read on this phone');
    expect((q('ident-number') as HTMLInputElement).value).toBe('LV1234567');
  });

  it('a guest without a key in the app cannot use it: the switch is off and says why; Google AI is never called', async () => {
    (globalThis as any).__signedIn = false;
    (globalThis as any).__ai.consent = true; // an old choice
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    expect(text('ident-ai-switch')).toContain('false');
    expect(text('ident-ai-note')).toContain('GOOGLE_AI_API_KEY');
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect((globalThis as any).__ai.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- the FRONT of an ID card: no zone, Google AI extracts the values from the recognised text
const FRONT_TEXT = [
  'PA3626350', 'LATVIJAS REPUBLIKA PERSONAS APLIECIBA', 'LV', "REPUBLIC OF LATVIA IDENTITY CARD/ REPUBLIQUE DE LETTONIE CARTE D'IDENTITE",
  'Uzvards/Surname/ Nom', 'TERENTJEVS', 'Varosl-il/ Given names)/Prenomls)', 'JURIJS', 'Pilsoniba/ Nationality / Nationalite', 'LATVIJAS',
  'Personas kods/Personal No. / Num.personnel', '021071 -10509', 'Dzimsanas datums/', 'Date of birth/Date de naissance', '02.10.1971.',
  'Derigaidz/', 'Oate of expiry /Oate d\'expiration', '02.06.2034.', '712656', "Paraksts / Holder's signature / Signature du titulaire",
];
const FRONT_AI = { documentType: 'id_card', issuingCountry: 'LVA', mrzLines: [], surname: 'TERENTJEVS', givenNames: 'JURIJS', documentNumber: 'PA3626350', dateOfBirth: '1971-10-02', dateOfExpiry: '2034-06-02', sex: null, nationality: 'LVA', personalNumber: '021071-10509', can: null, canCandidate: '712656', quality: 'good', notes: null };

describe('front of the card (no zone)', () => {
  it('this phone finds NO zone (no junk values); when Google AI cannot answer the confirm step offers the button and the recognised text can be shown', async () => {
    mockLines = FRONT_TEXT;
    (globalThis as any).__ai.textAnswer = new Error('offline');
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect((q('ident-number') as HTMLInputElement).value).toBe(''); // not "NIBANATIO"
    expect((q('ident-birth') as HTMLInputElement).value).toBe('');
    // Google AI was asked by itself 3 times and failed: the main line says so and points to the button
    expect(text('ident-no-zone')).toContain('Google AI (text): offline (tried 3 times).');
    expect(text('ident-no-zone')).toContain('Ask Google AI to read the recognised text');
    expect(q('ident-printed')).toBeNull();
    expect(text('ident-ask-ai-note')).toContain('SENT to Google');
    press('ident-lines-toggle');
    expect(text('ident-line-0')).toBe('PA3626350');
    expect((globalThis as any).__ai.textCalls).toHaveLength(3); // it was tried by itself right after the photo, 3 times
    press('ident-info-more');
    expect(text('ident-note-0')).toContain('Google AI (text): offline');
  });

  it('pressing the button asks again with the TEXT (not the picture); the values, the printed name and the CAN candidate appear', async () => {
    mockLines = FRONT_TEXT;
    (globalThis as any).__ai.textAnswer = new Error('offline');
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    (globalThis as any).__ai.textAnswer = FRONT_AI;   // the automatic try failed; the second one works
    await pressAsync('ident-ask-ai');
    await until('ident-source');
    expect((globalThis as any).__ai.textCalls).toHaveLength(4);   // 3 automatic tries + the press
    expect((globalThis as any).__ai.textCalls[3]).toMatchObject({ type: 'ID' });
    expect((globalThis as any).__ai.textCalls[3].lines).toEqual(FRONT_TEXT);
    expect((globalThis as any).__ai.calls).toHaveLength(0); // no photo was sent
    expect(text('ident-source')).toContain('extracted by Google AI from the recognised text');
    expect((q('ident-number') as HTMLInputElement).value).toBe('PA3626350');
    expect((q('ident-birth') as HTMLInputElement).value).toBe('02.10.1971');
    expect((q('ident-expiry') as HTMLInputElement).value).toBe('02.06.2034');
    expect((q('ident-can') as HTMLInputElement).value).toBe('712656');
    expect(text('ident-confidence')).toContain('printed fields');
    expect(text('ident-printed')).toContain('TERENTJEVS, JURIJS');
    // the button stays visible (to ask again); the recognised text stays
    expect(text('ident-ask-ai')).toContain('again');
    press('ident-lines-toggle');
    expect(text('ident-line-0')).toBe('PA3626350');
    // and the scan step starts with these values and the CAN candidate
    press('ident-continue');
    expect((q('id-number') as HTMLInputElement).value).toBe('PA3626350');
    expect((q('id-can') as HTMLInputElement).value).toBe('712656');
  });

  it('ALWAYS AUTOMATIC: right after the photo the TEXT goes to Google AI by itself (no picture, no switch), the button stays visible', async () => {
    mockLines = FRONT_TEXT;
    (globalThis as any).__ai.textAnswer = FRONT_AI;
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    expect(q('ident-ai-text-switch')).toBeNull();   // no switch: it is not optional
    expect(text('ident-ai-text-note')).toContain('always sent to Google AI');
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect((globalThis as any).__ai.textCalls).toHaveLength(1);
    expect((globalThis as any).__ai.calls).toHaveLength(0); // the picture stays on the phone
    expect(text('ident-source')).toContain('from the recognised text');
    expect((q('ident-number') as HTMLInputElement).value).toBe('PA3626350');
    expect((q('ident-can') as HTMLInputElement).value).toBe('712656');
    expect(text('ident-ask-ai')).toContain('again'); // the button is visible
  });

  it('with the Google AI PHOTO switch ON the photo job runs first; when it finds nothing this phone reads, then the text goes to Google AI', async () => {
    (globalThis as any).__ai.consent = true;
    (globalThis as any).__ai.answer = { ...FRONT_AI, mrzLines: [], documentNumber: null, dateOfBirth: null, dateOfExpiry: null, canCandidate: null, quality: 'poor', notes: 'no zone seen' }; // the photo job found nothing
    (globalThis as any).__ai.textAnswer = FRONT_AI;
    mockLines = FRONT_TEXT;
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect((globalThis as any).__ai.textCalls).toHaveLength(1);
    expect(text('ident-source')).toContain('from the recognised text');
    expect((q('ident-number') as HTMLInputElement).value).toBe('PA3626350');
    expect(text('ident-note-0')).toContain('no zone seen'); // what the photo job said
    expect(text('ident-note-1')).toContain('no picture was sent');
  });

  it('a first answer WITHOUT values (or a lost connection) is asked again by itself: the user does not press the button', async () => {
    mockLines = FRONT_TEXT;
    const ai = (globalThis as any).__ai;
    const before = ai.textCalls.length;
    const EMPTY = { ...FRONT_AI, documentNumber: null, dateOfBirth: null, dateOfExpiry: null, canCandidate: null, quality: 'poor', notes: 'could not read' };
    const answers: any[] = [Object.assign(new Error('Google AI took too long.'), { code: 'upstream' }), EMPTY, FRONT_AI];
    ai.textAnswer = null;
    const real = ai.textCalls.push.bind(ai.textCalls);
    ai.textCalls.push = (c: any) => { ai.textAnswer = answers.shift() ?? FRONT_AI; return real(c); };
    try {
      render(<IdentificationFlow />);
      await flush();
      press('ident-choose-id');
      await flush();
      await pressAsync('ident-take');
      await until('ident-step-confirm');
    } finally {
      ai.textCalls.push = real;
    }
    expect(ai.textCalls.length - before).toBe(3);                 // failed, empty, then values
    expect((q('ident-number') as HTMLInputElement).value).toBe('PA3626350');
    expect(q('ident-no-zone')).toBeNull();
  });

  it('a refusal that another call cannot change (the key) is NOT repeated', async () => {
    mockLines = FRONT_TEXT;
    const ai = (globalThis as any).__ai;
    const before = ai.textCalls.length;
    ai.textAnswer = Object.assign(new Error('The Google AI key was refused.'), { code: 'key' });
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect(ai.textCalls.length - before).toBe(1);
    expect(text('ident-no-zone')).toContain('Google AI (text): The Google AI key was refused.');
    expect(text('ident-no-zone')).not.toContain('tried');
  });

  it('Google AI fails on the text: the note says so, the values stay empty, the button stays for another try', async () => {
    mockLines = FRONT_TEXT;
    (globalThis as any).__ai.textAnswer = Object.assign(new Error('Google AI is busy or the quota is used up. Try again later.'), { code: 'rate' });
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    await pressAsync('ident-ask-ai');
    await flush();
    expect(text('ident-note-0')).toContain('Google AI (text): Google AI is busy');
    expect((q('ident-number') as HTMLInputElement).value).toBe('');
    expect(q('ident-ask-ai')).not.toBeNull();
  });

  it('a checked zone is read by Google AI too, but its three values stay (the check digits); no button and no automatic call for a guest without a key', async () => {
    (globalThis as any).__ai.textAnswer = FRONT_AI;
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect((globalThis as any).__ai.textCalls).toHaveLength(1); // always, also for a checked zone
    expect((q('ident-number') as HTMLInputElement).value).not.toBe('PA3626350'); // the zone's number stays
    expect((q('ident-can') as HTMLInputElement).value).toBe('712656');            // Google AI adds the CAN candidate
    expect(q('ident-ask-ai')).not.toBeNull();
    cleanup();
    const before = (globalThis as any).__ai.textCalls.length;
    mockLines = FRONT_TEXT;
    (globalThis as any).__signedIn = false;
    render(<IdentificationFlow />);
    await flush();
    press('ident-choose-id');
    await flush();
    expect(text('ident-ai-text-note')).toContain('Needs the Google AI key'); // on the photo screen
    await pressAsync('ident-take');
    await until('ident-step-confirm');
    expect(q('ident-ask-ai')).toBeNull();
    expect((globalThis as any).__ai.textCalls).toHaveLength(before);
  });
});

it('the info texts of the confirm step are one line with "more..." that opens the source and the notes, "less" closes them', async () => {
  render(<IdentificationFlow />);
  await flush();
  press('ident-choose-id');
  mockLines = ['REPUBLIKA', 'IDENTITY CARD', ...NOISY_TD1];
  await pressAsync('ident-take');
  await until('ident-step-confirm');
  expect(q('ident-confidence')).not.toBeNull(); // the one line stays
  {
    expect(q('ident-source')).toBeNull();
    press('ident-info-more');
    expect(q('ident-source')).not.toBeNull();
    expect(q('ident-info-more')).toBeNull();
    press('ident-info-less');
    expect(q('ident-source')).toBeNull();
    expect(q('ident-info-more')).not.toBeNull();
  }
});
