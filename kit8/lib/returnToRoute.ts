// "returnTo" route parameter: a screen opened FROM another place (e.g. the "…" of a table cell) gets the
// place to go back to, so the app's Back button returns exactly there instead of to the previous drawer screen.
//   buildReturnToRoute('/demo/reusabletable', { tab: 'a' }, { focusRowGUID: 'r1' }) -> '/demo/reusabletable?tab=a&focusRowGUID=r1'
//   safeReturnToRoute(params.returnTo) -> the path, or null when it is missing / not an in-app path

/** only in-app absolute paths ("/x/y?..."); never another site ("//host", "https://…") */
export function safeReturnToRoute(v: unknown): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && /^\/(?!\/)/.test(s) && !s.includes('\\') ? s : null;
}

/** current path + its parameters (without an older returnTo) + extra parameters of the place to return to */
export function buildReturnToRoute(pathname: string | null | undefined, params?: Record<string, unknown> | null, extra?: Record<string, string | null | undefined>): string {
  // (no URLSearchParams: it is not available in every runtime the app runs in)
  const parts: string[] = [];
  const add = (k: string, v: string) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (k === 'returnTo' || k in (extra || {})) continue;
    const one = Array.isArray(v) ? v[0] : v;
    if (typeof one === 'string' && one !== '') add(k, one);
  }
  for (const [k, v] of Object.entries(extra || {})) if (v) add(k, v);
  const qs = parts.join('&');
  return `${pathname && pathname.startsWith('/') ? pathname : '/'}${qs ? `?${qs}` : ''}`;
}
