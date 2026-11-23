// The automatic tries of Google AI after the photo (aiTextRetry.ts): a failure or an answer without values is asked again, a permanent refusal is not.
import { aiTextRetryConfig, readTextWithAiRetry } from '../../kit8/ui/components/media/nfc/identification/aiTextRetry';
import type { Recognition } from '../../kit8/ui/components/media/nfc/identification/identificationTypes';

aiTextRetryConfig.delaysMs = [0, 0];

const rec = (number: string): Recognition => ({ source: 'ai-text', lines: [], result: null, values: { documentNumber: number, birthDate: number ? '01.01.1990' : '', expiryDate: number ? '01.01.2030' : '', country: '', can: '' }, confidence: 'fields', notes: [] });
const doc = (n: string) => ({ n }) as any;
const convert = (d: any) => rec(d.n);

describe('readTextWithAiRetry', () => {
  it('the first answer with values ends it', async () => {
    const read = jest.fn(async () => doc('A1'));
    const out = await readTextWithAiRetry(read, convert, true);
    expect(read).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ calls: 1, error: '' });
    expect(out.recognition!.values.documentNumber).toBe('A1');
  });

  it('a failure or an empty answer is asked again; the later answer wins', async () => {
    const answers: any[] = [new Error('busy'), doc(''), doc('B2')];
    const read = jest.fn(async () => { const a = answers.shift(); if (a instanceof Error) throw a; return a; });
    const out = await readTextWithAiRetry(read, convert, true);
    expect(read).toHaveBeenCalledTimes(3);
    expect(out.recognition!.values.documentNumber).toBe('B2');
    expect(out.error).toBe('');
  });

  it('three failures: no recognition, the last words, the number of calls', async () => {
    const read = jest.fn(async () => { throw new Error('offline'); });
    const out = await readTextWithAiRetry(read, convert, true);
    expect(out).toEqual({ recognition: null, error: 'offline', calls: 3 });
  });

  it('three empty answers: the last answer (its notes) is returned', async () => {
    const read = jest.fn(async () => doc(''));
    const out = await readTextWithAiRetry(read, convert, true);
    expect(read).toHaveBeenCalledTimes(3);
    expect(out.recognition!.values.documentNumber).toBe('');
  });

  it('a permanent refusal (key, bad request, blocked ...) is not repeated', async () => {
    for (const code of ['key', 'bad-request', 'auth', 'not-configured', 'too-big', 'blocked']) {
      const read = jest.fn(async () => { throw Object.assign(new Error('no'), { code }); });
      const out = await readTextWithAiRetry(read, convert, true);
      expect(read).toHaveBeenCalledTimes(1);
      expect(out.calls).toBe(1);
    }
    const rate = jest.fn(async () => { throw Object.assign(new Error('busy'), { code: 'rate' }); });
    expect((await readTextWithAiRetry(rate, convert, true)).calls).toBe(3);   // a busy Google AI is worth another try
  });

  it('when the zone of the phone already passed its check digits an empty answer is accepted at once (needValues = false)', async () => {
    const read = jest.fn(async () => doc(''));
    const out = await readTextWithAiRetry(read, convert, false);
    expect(read).toHaveBeenCalledTimes(1);
    expect(out.recognition).not.toBeNull();
  });
});
