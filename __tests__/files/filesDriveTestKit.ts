// A tiny in-memory Google Drive + Google token endpoint for the tests of the Edge Function files-drive (helper: *TestKit.ts is ignored by jest).
// It enforces the two rules found in the live test of 2026-11-11: a folder with children cannot be deleted (403 appNotAuthorizedToChild),
// and a resumable session url takes the bytes with no token.
export interface FakeItem { id: string; name: string; mimeType: string; parents: string[]; properties: Record<string, string>; size?: string; data?: string }

export function createFakeGoogle(opts: { now?: () => number } = {}) {
  const items = new Map<string, FakeItem>();
  const calls: { method: string; url: string; headers: Record<string, string>; body?: string }[] = [];
  const state = { keptRevisions: [] as string[], refreshCalls: 0, codeCalls: 0, refreshFails: false, nextRefreshToken: 'REFRESH-TOKEN-1', scope: 'https://www.googleapis.com/auth/drive.file', accessSeq: 0, revoked: [] as string[], email: 'drive@gmail.test', unauthorizedOnce: false };
  let seq = 0;
  const j = (status: number, body: any, headers: Record<string, string> = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  const err = (status: number, reason: string) => j(status, { error: { code: status, message: reason, errors: [{ reason }] } });
  const children = (id: string) => [...items.values()].filter((i) => i.parents.includes(id));

  function matches(item: FakeItem, q: string): boolean {
    const parent = /'([^']+)' in parents/.exec(q);
    if (parent && !item.parents.includes(parent[1])) return false;
    const name = /name = '((?:[^'\\]|\\.)*)'/.exec(q);
    if (name && item.name !== name[1].replace(/\\'/g, "'")) return false;
    for (const m of q.matchAll(/properties has \{ key='([^']+)' and value='((?:[^'\\]|\\.)*)' \}/g)) if (item.properties[m[1]] !== m[2].replace(/\\'/g, "'")) return false;
    if (/mimeType = 'application\/vnd\.google-apps\.folder'/.test(q) && item.mimeType !== 'application/vnd.google-apps.folder') return false;
    return true;
  }

  const fetchFn = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(input);
    const method = (init.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init.headers as any).forEach((v, k) => { headers[k] = v; });
    calls.push({ method, url: input, headers, body: typeof init.body === 'string' ? init.body : undefined });
    if (url.host === 'oauth2.googleapis.com' && url.pathname === '/token') {
      const p = new URLSearchParams(String(init.body));
      if (p.get('grant_type') === 'refresh_token') {
        state.refreshCalls++;
        if (state.refreshFails) return j(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
        return j(200, { access_token: `ACCESS-${++state.accessSeq}`, expires_in: 3599, scope: state.scope });
      }
      state.codeCalls++;
      if (p.get('code') === 'BAD') return j(400, { error: 'invalid_grant' });
      return j(200, { access_token: `ACCESS-${++state.accessSeq}`, expires_in: 3599, scope: state.scope, ...(state.nextRefreshToken ? { refresh_token: state.nextRefreshToken } : {}) });
    }
    if (url.host === 'oauth2.googleapis.com' && url.pathname === '/revoke') { state.revoked.push(new URLSearchParams(String(init.body)).get('token') || ''); return j(200, {}); }
    if (url.host === 'upload.googleapis.com' || url.pathname.startsWith('/session/')) return j(200, { id: 'x' });
    if (url.pathname === '/upload/drive/v3/files') return new Response('{}', { status: 200, headers: { Location: `https://www.googleapis.com/session/${++seq}` } });
    const upd = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    if (upd && method === 'PATCH') return items.has(decodeURIComponent(upd[1])) ? new Response('{}', { status: 200, headers: { Location: `https://www.googleapis.com/session/${++seq}` } }) : err(404, 'notFound');
    const rev = /^\/drive\/v3\/files\/([^/]+)\/revisions(?:\/([^/]+))?$/.exec(url.pathname);
    if (rev) {
      if (method === 'GET') return j(200, { revisions: [{ id: 'rev1' }, { id: 'rev2' }] });
      if (method === 'PATCH') { state.keptRevisions.push(rev[2]); return j(200, {}); }
    }
    if (url.pathname === '/drive/v3/about') return j(200, { user: { emailAddress: state.email } });
    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q') || '';
      return j(200, { files: [...items.values()].filter((i) => matches(i, q)).map((i) => ({ id: i.id, name: i.name, mimeType: i.mimeType, parents: i.parents, properties: i.properties, size: i.size })) });
    }
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const b = JSON.parse(String(init.body));
      const id = `id${++seq}`;
      items.set(id, { id, name: b.name, mimeType: b.mimeType, parents: b.parents || [], properties: b.properties || {} });
      return j(200, { id, name: b.name, parents: b.parents || [], properties: b.properties || {} });
    }
    const one = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    if (one) {
      const id = decodeURIComponent(one[1]);
      const item = items.get(id);
      if (!item) return err(404, 'notFound');
      if (state.unauthorizedOnce && method === 'GET') { state.unauthorizedOnce = false; return err(401, 'authError'); }
      if (method === 'GET' && url.searchParams.get('alt') === 'media') {
        const data = item.data || '';
        const range = headers['range'];
        if (range) { const [a, b] = range.replace('bytes=', '').split('-').map(Number); const part = data.slice(a, b + 1); return new Response(part, { status: 206, headers: { 'Content-Range': `bytes ${a}-${a + part.length - 1}/${data.length}`, 'Content-Length': String(part.length), 'Content-Type': 'application/octet-stream' } }); }
        return new Response(data, { status: 200, headers: { 'Content-Length': String(data.length), 'Content-Type': 'application/octet-stream' } });
      }
      if (method === 'GET') return j(200, { id: item.id, name: item.name, mimeType: item.mimeType, parents: item.parents, properties: item.properties, size: item.size });
      if (method === 'PATCH') {
        const b = JSON.parse(String(init.body || '{}'));
        item.properties = { ...item.properties, ...(b.properties || {}) };
        const add = url.searchParams.get('addParents'); const rem = url.searchParams.get('removeParents');
        if (add) item.parents = [...item.parents.filter((x) => x !== rem), add];
        return j(200, { id });
      }
      if (method === 'DELETE') {
        if (children(id).length) return err(403, 'appNotAuthorizedToChild');
        items.delete(id);
        return new Response(null, { status: 204 });
      }
    }
    return err(404, 'unknownRoute');
  };

  const add = (o: Partial<FakeItem> & { name: string }): FakeItem => {
    const id = o.id || `id${++seq}`;
    const item: FakeItem = { id, mimeType: 'application/octet-stream', parents: [], properties: {}, ...o };
    items.set(id, item);
    return item;
  };
  return { fetchFn, items, calls, state, add, children };
}
