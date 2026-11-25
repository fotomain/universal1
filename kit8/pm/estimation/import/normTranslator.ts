// Translating the texts of a norm book (RU -> EN ...). The importer takes ANY function `(texts, from, to) => translated texts`; this file has the one that asks Google AI (Gemini) with the key of
// the app config (the same key and model as the document reader: .env GOOGLE_AI_API_KEY / GOOGLE_AI_MODEL). The texts of a norm book are public data (names of works and materials), but a
// translation of a whole book is thousands of requests: it runs ONLY when the user switches it on in the import window. The key is sent in a header, never put in a url or an error.
import { geminiUrl } from '../../../../supabase/functions/identification-recognize/handler';

export type NormTranslator = (texts: string[], from: string, to: string) => Promise<string[]>;

export class TranslateError extends Error {
  constructor(message: string, public readonly code: string) { super(message); }
}

const LANGUAGE_NAME: Record<string, string> = { ru: 'Russian', en: 'English', de: 'German', es: 'Spanish', fr: 'French', lv: 'Latvian', lt: 'Lithuanian', et: 'Estonian', zh: 'Chinese', pt: 'Portuguese', nl: 'Dutch' };

export const translationPrompt = (texts: string[], from: string, to: string): string =>
  `Translate every string of the JSON array from ${LANGUAGE_NAME[from] ?? from} to ${LANGUAGE_NAME[to] ?? to}. These are names of construction works, materials, machines and sections of an estimate norm book: `
  + `use the plain professional wording of builders and quantity surveyors, keep numbers, units, codes and brackets as they are, do not explain. `
  + `Answer with a JSON array of exactly ${texts.length} strings in the same order and nothing else.\n${JSON.stringify(texts)}`;

/** the answer of Gemini -> the translated strings (an answer with another length or a non-array is an error: nothing is guessed) */
export function parseTranslation(answer: any, expected: number): string[] {
  const text = answer?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
  let value: unknown;
  try { value = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); } catch { throw new TranslateError('The answer of Google AI is not JSON.', 'bad-answer'); }
  if (!Array.isArray(value) || value.length !== expected || value.some((v) => typeof v !== 'string')) throw new TranslateError(`Google AI returned ${Array.isArray(value) ? value.length : 'no list of'} strings instead of ${expected}.`, 'bad-answer');
  return value as string[];
}

export function geminiTranslator(opts: { apiKey: string; model?: string; fetchFn?: typeof fetch; batch?: number; retries?: number }): NormTranslator {
  const batch = opts.batch ?? 40;
  const retries = opts.retries ?? 2;
  return async (texts, from, to) => {
    const out: string[] = [];
    for (let i = 0; i < texts.length; i += batch) {
      const part = texts.slice(i, i + batch);
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await (opts.fetchFn ?? fetch)(geminiUrl(opts.model), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: translationPrompt(part, from, to) }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
          });
          if (!res.ok) throw new TranslateError(`Google AI answered HTTP ${res.status}.`, res.status === 429 ? 'rate' : 'upstream');
          out.push(...parseTranslation(await res.json(), part.length));
          lastError = undefined;
          break;
        } catch (e) { lastError = e; }
      }
      if (lastError) throw lastError;
    }
    return out;
  };
}
