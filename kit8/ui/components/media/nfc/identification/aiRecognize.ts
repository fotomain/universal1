// Google AI (Gemini) reads the photo of the document. Called straight from the app when the key is in the app config (.env GOOGLE_AI_API_KEY ->
// app.config.js `extra.googleAiApiKey`), else through the Supabase Edge Function `identification-recognize` (the key then stays on the server).
// The prompt, the schema and the cleaning of the answer are the ones of that function (supabase/functions/identification-recognize/handler.ts).
// The photo is sent only after the user switched "Read with Google AI" on (aiConsent.ts), and is never stored here. The key is never logged or put in an error.
import Constants from 'expo-constants';
import { buildGeminiBody, buildGeminiTextBody, cleanTextLines, geminiHttpError, geminiUrl, parseGeminiAnswer, type AiDocument } from '../../../../../../supabase/functions/identification-recognize/handler';

export type { AiDocument };

export class AiError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export interface AiInput {
  /** base64 of the JPEG / PNG / WebP photo, without a data: prefix */
  image: string;
  mime: string;
  documentType?: 'ID' | 'PASSPORT';
}

export interface AiOptions {
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
  /** the Edge Function call (supabase.functions.invoke); used when there is no key */
  invoke?: (body: Record<string, any>) => Promise<{ data?: any; error?: any }>;
  timeoutMs?: number;
}

/** the key and the model of the app config, or null when no key is set */
export function aiConfig(extra: Record<string, any> | undefined = (Constants as any)?.expoConfig?.extra): { apiKey: string; model?: string } | null {
  const apiKey = typeof extra?.googleAiApiKey === 'string' ? extra.googleAiApiKey.trim() : '';
  return apiKey ? { apiKey, model: typeof extra?.googleAiModel === 'string' && extra.googleAiModel.trim() ? extra.googleAiModel.trim() : undefined } : null;
}

/** can Google AI be used now: a key in the app, or a signed-in user (the Edge Function asks for one) */
export const aiPossible = (signedIn: boolean, extra?: Record<string, any>): boolean => !!aiConfig(extra) || signedIn;

const defaultInvoke = async (body: Record<string, any>) => require('../../../../../supabase/supabase').supabase.functions.invoke('identification-recognize', { body });

/** the two jobs: a PHOTO, or the TEXT of it (what the Edge Function and the direct call both understand) */
type Job = { kind: 'photo'; input: AiInput } | { kind: 'text'; lines: string[]; documentType?: 'ID' | 'PASSPORT' };

async function runJob(job: Job, options: AiOptions): Promise<AiDocument> {
  const cfg = options.apiKey ? { apiKey: options.apiKey, model: options.model } : aiConfig();
  const functionBody: Record<string, any> = job.kind === 'photo' ? { image: job.input.image, mime: job.input.mime, documentType: job.input.documentType } : { text: job.lines, documentType: job.documentType };
  const geminiBody = job.kind === 'photo' ? buildGeminiBody(job.input.image, job.input.mime, job.input.documentType) : buildGeminiTextBody(job.lines, job.documentType);

  if (!cfg) {
    // no key in the app: the Edge Function (the key is a secret of the server)
    let res: { data?: any; error?: any };
    try {
      res = await (options.invoke ?? defaultInvoke)(functionBody);
    } catch (e: any) {
      throw new AiError(String(e?.message ?? 'Google AI could not be reached.'), 'upstream');
    }
    let body: any = res?.data;
    if (res?.error && !body) {
      try {
        body = await res.error?.context?.json?.();
      } catch {
        body = null;
      }
    }
    if (res?.error || !body?.ok) throw new AiError(String(body?.error ?? res?.error?.message ?? 'Google AI could not be reached.'), String(body?.code ?? 'upstream'));
    return body.document as AiDocument;
  }

  // the key travels in a header, never in the url
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs ?? 30000) : null;
  let res: Response;
  try {
    res = await (options.fetchFn ?? fetch)(geminiUrl(cfg.model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
      body: JSON.stringify(geminiBody),
      signal: controller?.signal,
    });
  } catch (e: any) {
    throw new AiError(e?.name === 'AbortError' ? 'Google AI took too long.' : 'Google AI could not be reached (is the phone online?).', 'upstream');
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    const e = geminiHttpError(res.status);
    throw new AiError(e.error, e.code);
  }
  let answer: any;
  try {
    answer = await res.json();
  } catch {
    throw new AiError('Google AI sent an unreadable answer.', 'upstream');
  }
  const parsed = parseGeminiAnswer(answer);
  if (!parsed.ok) throw new AiError(parsed.error, parsed.code);
  return parsed.document;
}

/** Google AI reads the PHOTO */
export async function recognizeWithAi(input: AiInput, options: AiOptions = {}): Promise<AiDocument> {
  if (!input.image) throw new AiError('No photo to read.', 'bad-request');
  return runJob({ kind: 'photo', input }, options);
}

/** Google AI extracts the values from the TEXT that this phone already recognised (no picture is sent; the text still holds the names, numbers and dates) */
export async function recognizeTextWithAi(lines: string[], documentType: 'ID' | 'PASSPORT' | undefined, options: AiOptions = {}): Promise<AiDocument> {
  const clean = cleanTextLines(lines);
  if (!clean) throw new AiError('No text to read.', 'bad-request');
  return runJob({ kind: 'text', lines: clean, documentType }, options);
}
