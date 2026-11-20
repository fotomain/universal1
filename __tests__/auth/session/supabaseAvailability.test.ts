import { checkSupabaseAvailable, unavailableMessage } from '../../../kit8/auth/session/supabaseAvailability';

const ok = (status: number) => (jest.fn(async () => ({ status })) as unknown) as typeof fetch;

describe('checkSupabaseAvailable', () => {
  it('asks the Auth service with the public key', async () => {
    const f = jest.fn(async () => ({ status: 200 }));
    expect(await checkSupabaseAvailable({ url: 'https://x.supabase.co/', key: 'K', fetchFn: f as any })).toEqual({ ok: true });
    expect(f).toHaveBeenCalledWith('https://x.supabase.co/auth/v1/settings', expect.objectContaining({ headers: { apikey: 'K' } }));
  });
  it('a 4xx from the service itself means it is alive', async () => {
    expect(await checkSupabaseAvailable({ url: 'u', key: 'k', fetchFn: ok(401) })).toEqual({ ok: true });
  });
  it.each([500, 502, 521, 522, 523, 524])('HTTP %i = not available', async (status) => {
    const r = await checkSupabaseAvailable({ url: 'u', key: 'k', fetchFn: ok(status) });
    expect(r).toMatchObject({ ok: false, reason: 'http', status });
    expect((r as any).message).toContain(`HTTP ${status}`);
    expect((r as any).message).toContain('restarting');
  });
  it('a network error (a 522 page has no CORS headers) = not available', async () => {
    const f = jest.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await checkSupabaseAvailable({ url: 'u', key: 'k', fetchFn: f as any })).toMatchObject({ ok: false, reason: 'network' });
  });
  it('a request that never answers ends as a timeout', async () => {
    const f = jest.fn((_u: string, init: any) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    expect(await checkSupabaseAvailable({ url: 'u', key: 'k', fetchFn: f as any, timeoutMs: 20 })).toMatchObject({ ok: false, reason: 'timeout' });
  });
  it('does not block when there is nothing to ask with', async () => {
    expect(await checkSupabaseAvailable({ url: '', key: '', fetchFn: ok(522) })).toEqual({ ok: true });
  });
  it('the message says what and what to do', () => {
    expect(unavailableMessage('timeout')).toMatch(/no answer in time.*wait 2-5 minutes/);
  });
});
