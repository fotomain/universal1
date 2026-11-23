// Google AI reads the TEXT that this phone recognised, ALWAYS and by itself after the photo (owner, 2026-11-23). A single call sometimes comes back empty (the model
// found no complete set of values) or fails for a moment (busy, a lost connection): the user then had to press "Ask Google AI to read the recognised text" himself.
// This tries again by itself - up to `attempts` calls - and stops at once for a refusal that another call cannot change (no key, bad request, blocked).
import type { AiDocument } from './aiRecognize';
import { hasValues } from './confirmedValues';
import type { Recognition } from './identificationTypes';

/** the pauses between the calls (a test sets them to 0) */
export const aiTextRetryConfig = { attempts: 3, delaysMs: [700, 1500] as number[] };

/** a failure that another call cannot repair */
const PERMANENT = new Set(['bad-request', 'key', 'auth', 'not-configured', 'too-big', 'blocked']);

export interface AiTextOutcome {
  /** the best recognition: with values when one call gave them, else the last answer (notes only), null when every call failed */
  recognition: Recognition | null;
  /** the words of the last failure ('' when the last call answered) */
  error: string;
  /** how many calls were made */
  calls: number;
}

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

/**
 * `read` asks Google AI once; `convert` turns its document into a Recognition. `needValues` = a call that answers without a complete set of values is tried again
 * (false when this phone already has a zone with valid check digits: Google AI then only adds the CAN and the printed name).
 */
export async function readTextWithAiRetry(read: () => Promise<AiDocument>, convert: (doc: AiDocument) => Recognition, needValues: boolean): Promise<AiTextOutcome> {
  const attempts = Math.max(1, aiTextRetryConfig.attempts);
  let best: Recognition | null = null;
  let error = '';
  let calls = 0;
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(aiTextRetryConfig.delaysMs[Math.min(i - 1, aiTextRetryConfig.delaysMs.length - 1)] ?? 0);
    calls += 1;
    try {
      const rec = convert(await read());
      error = '';
      best = rec;
      if (!needValues || hasValues(rec.values)) break;
    } catch (e: any) {
      error = String(e?.message ?? 'failed');
      if (PERMANENT.has(String(e?.code ?? ''))) break;
    }
  }
  return { recognition: best, error, calls };
}
