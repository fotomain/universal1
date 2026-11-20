/** @jest-environment node */
// The Edge Function identification-recognize (supabase/functions/identification-recognize): the pure handler with injected doubles, and the parts the app uses for the direct call.
import {
  ALLOWED_MIME, buildGeminiBody, buildGeminiTextBody, cleanTextLines, textPrompt, MAX_TEXT_CHARS, DEFAULT_MODEL, geminiHttpError, geminiUrl, handleRecognize, MAX_IMAGE_BASE64, normalizeDocument, parseGeminiAnswer, RESPONSE_SCHEMA, SYSTEM_PROMPT, userPrompt,
} from '../../supabase/functions/identification-recognize/handler';

const answerOf = (doc: any) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(doc) }] }, finishReason: 'STOP' }] });
const GOOD = { documentType: 'id_card', issuingCountry: 'LVA', mrzLines: ['i<lva lv1234567<<<<<<<<<<<<<<<<', '8502147F3204305LVA<<<<<<<<<<<0', 'ZVEJNIEKS<<JANA<ANNA<<<<<<<<<<'], surname: 'Zvejnieks', givenNames: 'Jana Anna', documentNumber: 'lv1234567', dateOfBirth: '1985-02-14', dateOfExpiry: '2032-04-30', sex: 'F', nationality: 'LVA', can: '123 456', quality: 'good', notes: null, extra: 'ignored' };

const post = (body: any, headers: Record<string, string> = { Authorization: 'Bearer t' }) =>
  new Request('https://f.test/identification-recognize', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const read = async (r: Response) => ({ status: r.status, body: await r.json() });
const fakeFetch = (res: any, status = 200) => jest.fn(async () => ({ ok: status < 400, status, json: async () => res }) as any);
const deps = (over: any = {}) => ({ caller: jest.fn(async () => 'user-1'), apiKey: 'KEY-123', ...over });
const IMAGE = 'QUJD'.repeat(20);

describe('the prompt is fixed on the server and tells the model to copy, not guess', () => {
  it('says what to copy and how', () => {
    expect(SYSTEM_PROMPT).toMatch(/Never guess/);
    expect(SYSTEM_PROMPT).toContain('machine readable zone');
    expect(SYSTEM_PROMPT).toContain('"<"');
    expect(SYSTEM_PROMPT).toMatch(/CAN/);
    expect(userPrompt('ID')).toContain('ID card');
    expect(userPrompt('PASSPORT')).toContain('passport');
    expect(userPrompt()).toContain('identity document');
  });
  it('the schema has the fields the app needs', () => {
    expect(Object.keys(RESPONSE_SCHEMA.properties)).toEqual(expect.arrayContaining(['mrzLines', 'documentNumber', 'dateOfBirth', 'dateOfExpiry', 'can', 'quality']));
    expect(RESPONSE_SCHEMA.required).toContain('mrzLines');
  });
});

describe('the request to the Gemini API', () => {
  it('image first, then the text; JSON by schema; temperature 0; the key in a header and NOT in the url', async () => {
    const f = fakeFetch(answerOf(GOOD));
    const r = await handleRecognize(post({ image: IMAGE, mime: 'image/jpeg', documentType: 'ID' }), deps({ fetchFn: f, model: 'gemini-test-1' }));
    expect(r.status).toBe(200);
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test-1:generateContent');
    expect(url).not.toContain('KEY-123');
    expect(init.headers['x-goog-api-key']).toBe('KEY-123');
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[0]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: IMAGE } });
    expect(body.contents[0].parts[1].text).toContain('ID card');
    expect(body.systemInstruction.parts[0].text).toBe(SYSTEM_PROMPT);
    expect(body.generationConfig).toMatchObject({ temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA });
    expect(geminiUrl()).toContain(`/${DEFAULT_MODEL}:generateContent`);
    expect(buildGeminiBody('x', 'image/png').contents[0].parts[0].inline_data.mime_type).toBe('image/png');
  });
  it('a data: url prefix of the photo is accepted and cut', async () => {
    const f = fakeFetch(answerOf(GOOD));
    await handleRecognize(post({ image: `data:image/jpeg;base64,${IMAGE}`, mime: 'image/jpeg' }), deps({ fetchFn: f }));
    expect(JSON.parse((f.mock.calls[0] as any)[1].body).contents[0].parts[0].inline_data.data).toBe(IMAGE);
  });
});

describe('the answer is cleaned', () => {
  it('only the known fields; upper case, no spaces; dates and codes checked; the CAN digits only', async () => {
    const r = await read(await handleRecognize(post({ image: IMAGE, mime: 'image/jpeg' }), deps({ fetchFn: fakeFetch(answerOf(GOOD)) })));
    expect(r.status).toBe(200);
    const d = r.body.document;
    expect(d).toMatchObject({ documentType: 'id_card', issuingCountry: 'LVA', documentNumber: 'LV1234567', dateOfBirth: '1985-02-14', dateOfExpiry: '2032-04-30', sex: 'F', nationality: 'LVA', can: '123456', quality: 'good' });
    expect(d.mrzLines[0]).toBe('I<LVALV1234567<<<<<<<<<<<<<<<<');
    expect(d.extra).toBeUndefined();
  });
  it('odd values become null instead of wrong data', () => {
    const d = normalizeDocument({ documentType: 'spaceship', issuingCountry: 'D', mrzLines: ['short', 5, null], dateOfBirth: '14.02.1985', dateOfExpiry: '2032-13-40', sex: 'Q', can: '12', nationality: 'Latvia', quality: 'wow' });
    expect(d).toMatchObject({ documentType: 'unknown', issuingCountry: 'DEU', mrzLines: [], dateOfBirth: null, dateOfExpiry: null, sex: null, can: null, nationality: null, quality: 'fair' });
    expect(normalizeDocument(null).mrzLines).toEqual([]);
  });
  it('a blocked or unreadable answer is said in words', () => {
    expect(parseGeminiAnswer({ promptFeedback: { blockReason: 'SAFETY' } })).toMatchObject({ ok: false, code: 'blocked', status: 422 });
    expect(parseGeminiAnswer({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })).toMatchObject({ ok: false, code: 'not-json' });
    expect(parseGeminiAnswer({})).toMatchObject({ ok: false, code: 'not-json' });
    expect(parseGeminiAnswer(answerOf(GOOD))).toMatchObject({ ok: true });
  });
  it('http failures of the Gemini API', () => {
    expect(geminiHttpError(429).code).toBe('rate');
    expect(geminiHttpError(503).code).toBe('rate'); // "high demand"
    expect(geminiHttpError(403).code).toBe('key');
    expect(geminiHttpError(500).error).toContain('500');
  });
});

describe('who may call it, and what is refused', () => {
  it('CORS preflight, POST only', async () => {
    expect((await handleRecognize(new Request('https://f.test/x', { method: 'OPTIONS' }), deps())).status).toBe(204);
    expect((await handleRecognize(new Request('https://f.test/x', { method: 'GET' }), deps())).status).toBe(405);
  });
  it('no sign in: 401 and Gemini is never called', async () => {
    const f = fakeFetch(answerOf(GOOD));
    expect((await handleRecognize(post({ image: IMAGE }, {}), deps({ fetchFn: f }))).status).toBe(401);
    expect((await handleRecognize(post({ image: IMAGE }), deps({ fetchFn: f, caller: async () => null }))).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });
  it('no key on the server, bad json, no photo, wrong type, too big', async () => {
    const f = fakeFetch(answerOf(GOOD));
    expect(await read(await handleRecognize(post({ image: IMAGE }), deps({ fetchFn: f, apiKey: '' })))).toMatchObject({ status: 500, body: { code: 'not-configured' } });
    expect((await handleRecognize(post('{nope'), deps({ fetchFn: f }))).status).toBe(400);
    expect((await handleRecognize(post({}), deps({ fetchFn: f }))).status).toBe(400);
    expect((await handleRecognize(post({ image: IMAGE, mime: 'application/pdf' }), deps({ fetchFn: f }))).status).toBe(400);
    expect(ALLOWED_MIME).toContain('image/webp');
    expect((await handleRecognize(post({ image: 'A'.repeat(MAX_IMAGE_BASE64 + 1) }), deps({ fetchFn: f }))).status).toBe(413);
    expect(f).not.toHaveBeenCalled();
  });
  it('Gemini failing or unreachable: 502 with a code, never the key', async () => {
    const r1 = await read(await handleRecognize(post({ image: IMAGE }), deps({ fetchFn: fakeFetch({}, 429) })));
    expect(r1).toMatchObject({ status: 502, body: { code: 'rate' } });
    const r2 = await read(await handleRecognize(post({ image: IMAGE }), deps({ fetchFn: jest.fn(async () => { throw new Error('KEY-123 network'); }) })));
    expect(r2.status).toBe(502);
    expect(JSON.stringify(r2.body)).not.toContain('KEY-123');
  });
});

describe('the TEXT mode: the app sends the lines an OCR engine read, not the picture', () => {
  const FRONT = ['PA1234567', 'Uzvards/Surname/ Nom', 'EXAMPLEJS', 'Dzimsanas datums/ Date of birth', '01.01.1990.', '123456'];
  it('the prompt carries the numbered lines and says: only what the text says, null otherwise', () => {
    const p = textPrompt(FRONT, 'ID');
    expect(p).toContain('an ID card');
    expect(p).toContain('1: PA1234567');
    expect(p).toContain('5: 01.01.1990.');
    expect(p).toMatch(/never guess or invent/);
    expect(SYSTEM_PROMPT).toContain('canCandidate');
  });
  it('the Gemini body has NO picture part, the same schema and temperature 0', () => {
    const b = buildGeminiTextBody(FRONT, 'ID');
    expect(b.contents[0].parts).toHaveLength(1);
    expect(JSON.stringify(b)).not.toContain('inline_data');
    expect(b.generationConfig).toMatchObject({ temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA });
  });
  it('a request with text goes to Gemini as text; the answer is cleaned incl. the lone 6 digit candidate', async () => {
    const f = fakeFetch(answerOf({ documentType: 'id_card', mrzLines: [], documentNumber: 'pa1234567', dateOfBirth: '1990-01-01', dateOfExpiry: '2030-01-01', can: null, canCandidate: ' 123 456 ', quality: 'good' }));
    const r = await read(await handleRecognize(post({ text: FRONT, documentType: 'ID' }), deps({ fetchFn: f })));
    expect(r.status).toBe(200);
    expect(r.body.document).toMatchObject({ documentNumber: 'PA1234567', can: null, canCandidate: '123456' });
    const sent = JSON.parse((f.mock.calls[0] as any)[1].body);
    expect(sent.contents[0].parts[0].text).toContain('3: EXAMPLEJS');
    expect(JSON.stringify(sent)).not.toContain('inline_data');
  });
  it('a candidate that is not exactly 6 digits is dropped', () => {
    expect(normalizeDocument({ canCandidate: '12345' }).canCandidate).toBeNull();
    expect(normalizeDocument({ canCandidate: 'ABC123' }).canCandidate).toBeNull();
    expect(normalizeDocument({ canCandidate: '123456' }).canCandidate).toBe('123456');
  });
  it('bad text is refused before Gemini is called: not a list, empty, too long', async () => {
    const f = fakeFetch(answerOf(GOOD));
    expect((await handleRecognize(post({ text: 'hello' }), deps({ fetchFn: f }))).status).toBe(400);
    expect((await handleRecognize(post({ text: [] }), deps({ fetchFn: f }))).status).toBe(400);
    expect((await handleRecognize(post({ text: [5, null, '   '] }), deps({ fetchFn: f }))).status).toBe(400);
    expect((await handleRecognize(post({ text: Array.from({ length: 60 }, () => 'x'.repeat(200)) }), deps({ fetchFn: f }))).status).toBe(413);
    expect(MAX_TEXT_CHARS).toBe(8000);
    expect(cleanTextLines(['  a   b  ', 'c'])).toEqual(['a b', 'c']);
    expect(f).not.toHaveBeenCalled();
  });
  it('still needs a signed-in user', async () => {
    const f = fakeFetch(answerOf(GOOD));
    expect((await handleRecognize(post({ text: FRONT }, {}), deps({ fetchFn: f }))).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });
});
