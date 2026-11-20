// identification-recognize - reads the data of an identity document from a PHOTO with the Google Gemini API (Identification flow, step 2).
//   1. the caller must be signed in (the Supabase gateway checks the JWT; this handler asks for the user as well);
//   2. the photo is checked (type, size) and sent to Gemini with the FIXED prompt and schema of prompt.ts;
//   3. the answer is cleaned (only the known fields, dates / codes / the MRZ alphabet checked) and returned.
// The photo and the answer are NEVER stored or logged here. The API key stays in this function (secret GOOGLE_AI_API_KEY, copied from the .env of the app: see README.md).
// This file is PURE (no Deno): index.ts injects the user check and the key; the Jest test (__tests__/media/identificationFunction.test.ts) injects doubles.

// ---------------------------------------------------------------- the prompt and the answer schema (FIXED on the server: the app sends only the photo, so
// this function cannot be used as a free general purpose proxy to the paid API). Kept in this file: a Deno function bundles ONE file.

export const SYSTEM_PROMPT = `You read the printed data of ONE identity document (a passport or an ID card) from a photo, for the person who holds it, so that he does not have to type it.
Rules:
- Copy what is PRINTED. Never guess, never complete, never "correct" a character. If a value is not visible or not readable, return null for it.
- The machine readable zone (MRZ) is the block of 2 or 3 lines at the bottom of the passport photo page or on the back of an ID card, made of capital letters A-Z, digits 0-9 and the filler character "<".
  Return its lines EXACTLY as printed, one array entry per line, with the filler "<" kept, without spaces. A passport zone has 2 lines of 44 characters, an ID card zone has 3 lines of 30 (or 2 lines of 36). Do not invent the check digits.
  The runs of "<" are long: count them so that every line has EXACTLY 30 characters (ID card) or 44 (passport) or 36 (2-line ID card); the last characters of a line are check digits.
  Pay attention to the letter O versus the digit 0, the letter I versus the digit 1, B versus 8, S versus 5: in the MRZ the dates and the check digits are digits.
- Dates are returned as YYYY-MM-DD (read two-digit years of the MRZ as: birth date - the most recent past year, expiry date - a year in the future or the near past).
- "can" is the card access number: a short number of 4 to 8 digits printed on the FRONT of some ID cards, usually labelled CAN or "Card access number". Return it only when it is clearly labelled, else null.
- "canCandidate": on the FRONT of an ID card, a number of exactly 6 digits that stands alone WITHOUT a label (often near the holder's signature or in a corner) may be the CAN. Return it there only when it is not a date, not the personal number and not part of another number; else null. Never put it in "can".
- Country codes are three capital letters as in the MRZ (for example LVA, DEU, USA); Germany is "D" in its MRZ, return DEU.
- Do not describe the person, the photo of the face, or anything else. Do not add text outside the JSON.`;

export const userPrompt = (documentType?: 'ID' | 'PASSPORT'): string =>
  `Read this ${documentType === 'ID' ? 'ID card' : documentType === 'PASSPORT' ? 'passport' : 'identity document'} and return the JSON of the schema. ` +
  'If the picture is not an identity document, or is too blurred to read, set quality to "poor", leave the other fields null (mrzLines empty) and say why in notes.';

/** the same job on TEXT: an OCR engine already read the photo (the app sends the lines, not the picture) */
export const textPrompt = (lines: string[], documentType?: 'ID' | 'PASSPORT'): string =>
  `Below is the text that an OCR engine read from a photo of ${documentType === 'ID' ? 'an ID card' : documentType === 'PASSPORT' ? 'a passport' : 'an identity document'}, one line per entry, in reading order. ` +
  'The OCR may contain mistakes, split or merged lines, and labels in several languages (for example "Date of birth / Dzimsanas datums"); the value stands after its label. ' +
  'Extract the data of the document as the JSON of the schema. Use ONLY what the text says: never guess or invent; if a value is not in the text, return null. ' +
  'Machine readable zone lines (capital letters, digits and "<") are returned in "mrzLines" exactly as written; if the text has none, return an empty list.\n\nTEXT:\n' +
  lines.map((l, i) => `${i + 1}: ${l}`).join('\n');

/** the schema of the answer (Gemini structured output) */
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    documentType: { type: 'STRING', enum: ['passport', 'id_card', 'residence_permit', 'other', 'unknown'] },
    issuingCountry: { type: 'STRING', nullable: true },
    mrzLines: { type: 'ARRAY', items: { type: 'STRING' } },
    surname: { type: 'STRING', nullable: true },
    givenNames: { type: 'STRING', nullable: true },
    documentNumber: { type: 'STRING', nullable: true },
    dateOfBirth: { type: 'STRING', nullable: true },
    dateOfExpiry: { type: 'STRING', nullable: true },
    sex: { type: 'STRING', nullable: true, enum: ['M', 'F', 'X'] },
    nationality: { type: 'STRING', nullable: true },
    personalNumber: { type: 'STRING', nullable: true },
    can: { type: 'STRING', nullable: true },
    canCandidate: { type: 'STRING', nullable: true },
    quality: { type: 'STRING', enum: ['good', 'fair', 'poor'] },
    notes: { type: 'STRING', nullable: true },
  },
  required: ['documentType', 'mrzLines', 'quality'],
} as const;

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

/** base64 characters of the photo: about 4.5 MB of image (the app sends about 0.5 - 1 MB) */
export const MAX_IMAGE_BASE64 = 6_000_000;
/** the text mode: at most this many lines / characters (a document has about 30 lines) */
export const MAX_TEXT_LINES = 120;
export const MAX_TEXT_CHARS = 8000;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
// the FAST model: measured 2026-11-19 on the real API - gemini-flash-lite-latest answers in about 2 s, the gemini-flash-latest alias took minutes / 503 "high demand"
export const DEFAULT_MODEL = 'gemini-flash-lite-latest';
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface RecognizeDeps {
  /** the e-mail / id of the signed-in caller from the Authorization header (null = not signed in / bad token) */
  caller: (authorization: string) => Promise<string | null>;
  apiKey: string;
  /** the Gemini model id (secret GOOGLE_AI_MODEL; default gemini-flash-lite-latest) */
  model?: string;
  fetchFn?: typeof fetch;
}

export interface AiDocument {
  documentType: 'passport' | 'id_card' | 'residence_permit' | 'other' | 'unknown';
  issuingCountry: string | null;
  mrzLines: string[];
  surname: string | null;
  givenNames: string | null;
  documentNumber: string | null;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  dateOfExpiry: string | null;
  sex: 'M' | 'F' | 'X' | null;
  nationality: string | null;
  personalNumber: string | null;
  can: string | null;
  /** an unlabelled lone 6 digit number of the front of an ID card: maybe the CAN (the user must try / check it) */
  canCandidate: string | null;
  quality: 'good' | 'fair' | 'poor';
  notes: string | null;
}

const json = (status: number, body: Record<string, any>): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const country = (v: unknown): string | null => {
  const s = str(v, 8)?.toUpperCase().replace(/[^A-Z]/g, '') ?? '';
  return s === 'D' ? 'DEU' : /^[A-Z]{3}$/.test(s) ? s : null;
};
const date = (v: unknown): string | null => {
  const s = str(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number(s.slice(5, 7)) >= 1 && Number(s.slice(5, 7)) <= 12 && Number(s.slice(8, 10)) >= 1 && Number(s.slice(8, 10)) <= 31 ? s : null;
};

/** the answer of the model -> the known fields only, each checked; anything odd becomes null (the app checks the MRZ with its check digits anyway) */
export function normalizeDocument(raw: any): AiDocument {
  const types = ['passport', 'id_card', 'residence_permit', 'other', 'unknown'] as const;
  const lines = (Array.isArray(raw?.mrzLines) ? raw.mrzLines : [])
    .map((l: unknown) => String(l ?? '').toUpperCase().replace(/[^A-Z0-9<]/g, ''))
    .filter((l: string) => l.length >= 15 && l.length <= 50)
    .slice(0, 3);
  const can = typeof raw?.can === 'string' ? raw.can.replace(/\s/g, '') : '';
  return {
    documentType: types.includes(raw?.documentType) ? raw.documentType : 'unknown',
    issuingCountry: country(raw?.issuingCountry),
    mrzLines: lines,
    surname: str(raw?.surname),
    givenNames: str(raw?.givenNames),
    documentNumber: str(raw?.documentNumber, 30)?.toUpperCase().replace(/[^A-Z0-9<]/g, '') || null,
    dateOfBirth: date(raw?.dateOfBirth),
    dateOfExpiry: date(raw?.dateOfExpiry),
    sex: raw?.sex === 'M' || raw?.sex === 'F' || raw?.sex === 'X' ? raw.sex : null,
    nationality: country(raw?.nationality),
    personalNumber: str(raw?.personalNumber, 40),
    can: /^\d{4,8}$/.test(can) ? can : null,
    canCandidate: /^\d{6}$/.test(typeof raw?.canCandidate === 'string' ? raw.canCandidate.replace(/\s/g, '') : '') ? raw.canCandidate.replace(/\s/g, '') : null,
    quality: raw?.quality === 'good' || raw?.quality === 'fair' || raw?.quality === 'poor' ? raw.quality : 'fair',
    notes: str(raw?.notes, 300),
  };
}

/** the request of the Gemini REST API (generateContent): image first, then the text; JSON answer by schema; temperature 0 */
/** the request for the TEXT mode: no picture, the lines of the OCR engine in the prompt */
export function buildGeminiTextBody(lines: string[], documentType?: 'ID' | 'PASSPORT') {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: textPrompt(lines, documentType) }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
}

/** the text lines of a request, cleaned (strings only, trimmed, limited); null when the request has none */
export function cleanTextLines(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const lines = raw.filter((l) => typeof l === 'string').map((l) => (l as string).replace(/\s+/g, ' ').trim().slice(0, 300)).filter((l) => l.length > 0).slice(0, MAX_TEXT_LINES);
  return lines.length ? lines : null;
}

export function buildGeminiBody(image: string, mime: string, documentType?: 'ID' | 'PASSPORT') {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: image } }, { text: userPrompt(documentType) }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
}

export type GeminiParsed = { ok: true; document: AiDocument } | { ok: false; status: number; error: string; code: string };

/** the JSON a generateContent call answered -> the cleaned document, or the reason it cannot be used (shared by this function and by the direct call of the app) */
export function parseGeminiAnswer(answer: any): GeminiParsed {
  if (answer?.promptFeedback?.blockReason || answer?.candidates?.[0]?.finishReason === 'SAFETY') {
    return { ok: false, status: 422, error: 'Google AI refused to read this picture.', code: 'blocked' };
  }
  const text = answer?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: 'Google AI did not answer in the expected form.', code: 'not-json' };
  }
  return { ok: true, document: normalizeDocument(raw) };
}

/** the words of an HTTP failure of the Gemini API */
export function geminiHttpError(status: number): { error: string; code: string } {
  const code = status === 429 || status === 503 ? 'rate' : status === 401 || status === 403 ? 'key' : 'upstream';
  return {
    code,
    error: code === 'rate' ? 'Google AI is busy or the quota is used up. Try again later.' : code === 'key' ? 'The Google AI key was refused.' : `Google AI answered ${status}.`,
  };
}

/** the URL of the generateContent call (the key goes in a header, never in the URL) */
export const geminiUrl = (model?: string): string => `${GEMINI_BASE}/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent`;

export async function handleRecognize(req: Request, deps: RecognizeDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const authorization = req.headers.get('Authorization') || '';
  const who = authorization ? await deps.caller(authorization) : null;
  if (!who) return json(401, { error: 'Sign in first.', code: 'auth' });
  if (!deps.apiKey) return json(500, { error: 'The Google AI key is not set on the server (secret GOOGLE_AI_API_KEY).', code: 'not-configured' });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'The request is not JSON.', code: 'bad-request' });
  }
  const documentType = body?.documentType === 'ID' || body?.documentType === 'PASSPORT' ? body.documentType : undefined;
  // two modes: a PHOTO (image + mime) or the TEXT an OCR engine read from it (text: string[])
  const textLines = body?.text !== undefined ? cleanTextLines(body.text) : null;
  let requestBody: Record<string, any>;
  if (body?.text !== undefined) {
    if (!textLines) return json(400, { error: 'No text was sent.', code: 'bad-request' });
    if (textLines.join('\n').length > MAX_TEXT_CHARS) return json(413, { error: 'The text is too long.', code: 'too-big' });
    requestBody = buildGeminiTextBody(textLines, documentType);
  } else {
    const image = typeof body?.image === 'string' ? body.image.replace(/^data:[^,]*,/, '') : '';
    const mime = String(body?.mime ?? 'image/jpeg');
    if (!image || !/^[A-Za-z0-9+/=\s]+$/.test(image.slice(0, 2000))) return json(400, { error: 'No photo was sent.', code: 'bad-request' });
    if (!(ALLOWED_MIME as readonly string[]).includes(mime)) return json(400, { error: 'The photo must be a JPEG, PNG or WebP picture.', code: 'bad-request' });
    if (image.length > MAX_IMAGE_BASE64) return json(413, { error: 'The photo is too big. Take it again with a lower resolution.', code: 'too-big' });
    requestBody = buildGeminiBody(image, mime, documentType);
  }

  const doFetch = deps.fetchFn ?? fetch;
  let res: Response;
  try {
    // the key travels in a header, never in the URL (URLs end up in logs)
    res = await doFetch(geminiUrl(deps.model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': deps.apiKey },
      body: JSON.stringify(requestBody),
    });
  } catch {
    return json(502, { error: 'Google AI could not be reached.', code: 'upstream' });
  }
  if (!res.ok) {
    const e = geminiHttpError(res.status);
    return json(502, { error: e.error, code: e.code });
  }
  let answer: any;
  try {
    answer = await res.json();
  } catch {
    return json(502, { error: 'Google AI sent an unreadable answer.', code: 'upstream' });
  }
  const parsed = parseGeminiAnswer(answer);
  return parsed.ok ? json(200, { ok: true, document: parsed.document }) : json(parsed.status, { error: parsed.error, code: parsed.code });
}
