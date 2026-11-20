// Is Supabase answering? Asked BEFORE a sign-in starts (Google / Microsoft send the whole page to Supabase: while the project restarts
// or its server hangs, the user would land on a bare Cloudflare "522 Connection timed out" page with no way back).
// Probe = GET <url>/auth/v1/settings with the public key: the Auth service itself answers it (the edge alone answers 401 to a request WITHOUT a key,
// so a probe without the key proves nothing). Pure: fetch and timer are passed in.

export type SupabaseAvailability =
  | { ok: true }
  | { ok: false; reason: 'timeout' | 'network' | 'http'; status?: number; message: string };

/** Cloudflare answers 520-524 when the project behind it does not respond (restart, overload, paused). */
export const isGatewayDown = (status: number): boolean => status >= 500;

export function unavailableMessage(reason: 'timeout' | 'network' | 'http', status?: number): string {
  const what = reason === 'http' ? `HTTP ${status}` : reason === 'timeout' ? 'no answer in time' : 'no connection';
  return `Supabase is not available right now (${what}). If the project is restarting, wait 2-5 minutes and try again.`;
}

export async function checkSupabaseAvailable(opts: {
  url: string;
  key: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<SupabaseAvailability> {
  const { url, key, timeoutMs = 7000 } = opts;
  const fetchFn = opts.fetchFn ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchFn || !url) return { ok: true }; // nothing to ask with: do not block the sign-in
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
      method: 'GET',
      headers: { apikey: key },
      signal: controller?.signal,
    });
    if (isGatewayDown(res.status)) return { ok: false, reason: 'http', status: res.status, message: unavailableMessage('http', res.status) };
    return { ok: true }; // 200, or a 4xx the Auth service itself gave: it is alive
  } catch (e: any) {
    // a 522 page has no CORS headers, so a browser reports it as a plain network error: also "not available"
    const reason = e?.name === 'AbortError' ? 'timeout' : 'network';
    return { ok: false, reason, message: unavailableMessage(reason) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
