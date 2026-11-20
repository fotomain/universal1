/** @jest-environment node */
import { AiError, aiConfig, aiPossible, recognizeTextWithAi, recognizeWithAi } from '../../kit8/ui/components/media/nfc/identification/aiRecognize';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));

const GOOD = { documentType: 'passport', mrzLines: ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'], quality: 'good', documentNumber: 'l898902c3', can: ' 12 34 56 ' };
const answerOf = (d: any) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(d) }] } }] });
const fakeFetch = (res: any, status = 200) => jest.fn(async () => ({ ok: status < 400, status, json: async () => res }) as any);
const KEY = 'SECRET-KEY-XYZ';

describe('the key of the app config (.env GOOGLE_AI_API_KEY -> app.config.js extra)', () => {
  it('read from extra; empty = none; the model is optional', () => {
    expect(aiConfig({ googleAiApiKey: ' K ', googleAiModel: ' m1 ' })).toEqual({ apiKey: 'K', model: 'm1' });
    expect(aiConfig({ googleAiApiKey: 'K', googleAiModel: '' })).toEqual({ apiKey: 'K', model: undefined });
    expect(aiConfig({ googleAiApiKey: '' })).toBeNull();
    expect(aiConfig({})).toBeNull();
    expect(aiConfig(undefined)).toBeNull();
  });
  it('possible with a key, or when signed in (the Edge Function asks for a user)', () => {
    expect(aiPossible(false, { googleAiApiKey: 'K' })).toBe(true);
    expect(aiPossible(true, {})).toBe(true);
    expect(aiPossible(false, {})).toBe(false);
  });
});

describe('direct call of the Gemini API from the app', () => {
  it('the key in a HEADER, not in the url; image first; the prompt of the server file; the answer is cleaned', async () => {
    const f = fakeFetch(answerOf(GOOD));
    const doc = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg', documentType: 'PASSPORT' }, { apiKey: KEY, model: 'gemini-test', fetchFn: f });
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect(url).not.toContain(KEY);
    expect(init.headers['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[0].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'QUJD' });
    expect(body.contents[0].parts[1].text).toContain('passport');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(doc).toMatchObject({ documentType: 'passport', documentNumber: 'L898902C3', can: '123456', quality: 'good' });
    expect(doc.mrzLines).toHaveLength(2);
  });

  it('failures are said in words and NEVER contain the key', async () => {
    const e1: AiError = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg' }, { apiKey: KEY, fetchFn: fakeFetch({}, 429) }).catch((e) => e);
    expect(e1).toBeInstanceOf(AiError);
    expect(e1.code).toBe('rate');
    const e2: AiError = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg' }, { apiKey: KEY, fetchFn: fakeFetch({}, 403) }).catch((e) => e);
    expect(e2.code).toBe('key');
    const e3: AiError = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg' }, { apiKey: KEY, fetchFn: jest.fn(async () => { throw new Error(`failed ${KEY}`); }) }).catch((e) => e);
    expect(e3.message).toContain('could not be reached');
    for (const e of [e1, e2, e3]) expect(e.message).not.toContain(KEY);
    const e4: AiError = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg' }, { apiKey: KEY, fetchFn: fakeFetch({ promptFeedback: { blockReason: 'SAFETY' } }) }).catch((e) => e);
    expect(e4.code).toBe('blocked');
    const e5: AiError = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg' }, { apiKey: KEY, fetchFn: fakeFetch({ candidates: [{ content: { parts: [{ text: 'hello' }] } }] }) }).catch((e) => e);
    expect(e5.code).toBe('not-json');
    const e6: AiError = await recognizeWithAi({ image: '', mime: 'image/jpeg' }, { apiKey: KEY }).catch((e) => e);
    expect(e6.code).toBe('bad-request');
  });

  it('a slow answer is stopped', async () => {
    const f = jest.fn((_u: string, init: any) => new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    const e: AiError = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg' }, { apiKey: KEY, fetchFn: f as any, timeoutMs: 20 }).catch((x) => x);
    expect(e.message).toBe('Google AI took too long.');
  });
});

describe('without a key in the app: the Edge Function (the key stays on the server)', () => {
  it('sends the photo to the function and returns its cleaned document', async () => {
    const invoke = jest.fn(async () => ({ data: { ok: true, document: { documentType: 'passport', mrzLines: [], quality: 'good' } } }));
    const doc = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg', documentType: 'ID' }, { invoke });
    expect(invoke).toHaveBeenCalledWith({ image: 'QUJD', mime: 'image/jpeg', documentType: 'ID' });
    expect(doc.documentType).toBe('passport');
  });
  it('its refusals become AiError with the code (not signed in, rate, key not set)', async () => {
    const refused = { data: null, error: { message: 'non-2xx', context: { json: async () => ({ error: 'Sign in first.', code: 'auth' }) } } };
    const e: AiError = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg' }, { invoke: async () => refused }).catch((x) => x);
    expect(e).toMatchObject({ message: 'Sign in first.', code: 'auth' });
    const e2: AiError = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg' }, { invoke: async () => ({ data: { ok: false, error: 'x', code: 'rate' } }) }).catch((x) => x);
    expect(e2.code).toBe('rate');
    const e3: AiError = await recognizeWithAi({ image: 'QUJD', mime: 'image/jpeg' }, { invoke: async () => { throw new Error('offline'); } }).catch((x) => x);
    expect(e3).toMatchObject({ message: 'offline', code: 'upstream' });
  });
});

describe('the TEXT job (this phone recognised the text, Google AI extracts the values)', () => {
  const LINES = ['PA1234567', 'Date of birth', '01.01.1990.', '123456'];
  it('direct: a text-only request, the key in the header, no picture', async () => {
    const f = fakeFetch(answerOf({ documentType: 'id_card', mrzLines: [], documentNumber: 'PA1234567', dateOfBirth: '1990-01-01', canCandidate: '123456', quality: 'good' }));
    const doc = await recognizeTextWithAi(LINES, 'ID', { apiKey: KEY, fetchFn: f });
    const [url, init] = f.mock.calls[0] as any;
    expect(url).not.toContain(KEY);
    expect(init.headers['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(init.body);
    expect(JSON.stringify(body)).not.toContain('inline_data');
    expect(body.contents[0].parts[0].text).toContain('2: Date of birth');
    expect(doc).toMatchObject({ documentNumber: 'PA1234567', canCandidate: '123456' });
  });
  it('through the Edge Function the lines go as { text }', async () => {
    const invoke = jest.fn(async () => ({ data: { ok: true, document: { documentType: 'id_card', mrzLines: [], quality: 'good' } } }));
    await recognizeTextWithAi(LINES, 'ID', { invoke });
    expect(invoke).toHaveBeenCalledWith({ text: LINES, documentType: 'ID' });
  });
  it('no text, or a refusal, is an AiError without the key', async () => {
    const e1: AiError = await recognizeTextWithAi([], 'ID', { apiKey: KEY }).catch((x) => x);
    expect(e1.code).toBe('bad-request');
    const e2: AiError = await recognizeTextWithAi(LINES, 'ID', { apiKey: KEY, fetchFn: fakeFetch({}, 429) }).catch((x) => x);
    expect(e2.code).toBe('rate');
    expect(e2.message).not.toContain(KEY);
  });
});
