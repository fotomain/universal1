// A tiny in-memory Microsoft OneDrive (Graph v1.0) + Microsoft token endpoint for the tests of the Edge Function files-drive (helper: *TestKit.ts is ignored by jest).
// It enforces the rules proved by the spike OD0 (documentation/OneDrive/ONEDRIVE_HOW_IT_WORKS.html): upload fragments in order and (but the last) a multiple of 320 KiB, NO Authorization
// header on the upload url (401), the last answer is the driveItem, permanentDelete takes a folder with content, the refresh token ROTATES, names with / \ * < > ? : | are refused.
export interface GItem { id: string; name: string; parent: string; isFolder: boolean; data: string; etag: number; versions: { id: string; data: string }[]; created: number }

export function createFakeGraph() {
  const items = new Map<string, GItem>();
  const sessions = new Map<string, { parent?: string; name?: string; itemId?: string; size?: number; received: number; data: string; conflict: string }>();
  const calls: { method: string; url: string; auth: boolean; body?: string; range?: string }[] = [];
  const state = {
    refresh: 'MS-REFRESH-1', accessSeq: 0, refreshCalls: 0, codeCalls: 0, refreshFails: '' as '' | 'invalid_grant' | 'invalid_client', allowOldRefresh: false, email: 'owner@outlook.test',
    throttle: 0, scope: 'Files.ReadWrite User.Read', noRefreshTokenOnCode: false, lastAnswerLost: false, clock: 1,
  };
  let seq = 0;
  const j = (status: number, body: any, headers: Record<string, string> = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  const gerr = (status: number, code: string) => j(status, { error: { code, message: code } });
  items.set('ROOT', { id: 'ROOT', name: 'root', parent: '', isFolder: true, data: '', etag: 1, versions: [], created: 0 });

  const pathOf = (id: string): string => {
    const parts: string[] = [];
    let cur = items.get(id)!;
    while (cur && cur.id !== 'ROOT') { parts.unshift(cur.name); cur = items.get(cur.parent)!; }
    return '/' + parts.join('/');
  };
  const view = (it: GItem) => {
    const parent = items.get(it.parent);
    return {
      id: it.id, name: it.name, size: it.isFolder ? 0 : it.data.length, eTag: `"{${it.id}},${it.etag}"`, webUrl: `https://onedrive.test/${it.id}`,
      ...(it.isFolder ? { folder: { childCount: 0 } } : { file: { mimeType: 'application/octet-stream' } }),
      parentReference: { id: it.parent, path: parent ? (parent.id === 'ROOT' ? '/drive/root:' : '/drive/root:' + pathOf(parent.id)) : undefined },
    };
  };
  const child = (parent: string, name: string) => [...items.values()].find((i) => i.parent === parent && i.name.toLowerCase() === name.toLowerCase());
  const badName = (n: string) => /[\\/*<>?:|]/.test(n) || /\.$/.test(n);
  const make = (parent: string, name: string, isFolder: boolean, data = '') => {
    const id = `IT${++seq}`;
    const it: GItem = { id, name, parent, isFolder, data, etag: 1, versions: [], created: ++state.clock };
    items.set(id, it);
    return it;
  };
  const uniqueName = (parent: string, name: string) => {
    if (!child(parent, name)) return name;
    const dot = name.lastIndexOf('.');
    for (let n = 1; ; n++) { const cand = dot > 0 ? `${name.slice(0, dot)} ${n}${name.slice(dot)}` : `${name} ${n}`; if (!child(parent, cand)) return cand; }
  };
  const removeTree = (id: string) => { for (const k of [...items.values()].filter((i) => i.parent === id)) removeTree(k.id); items.delete(id); };

  async function fetchFn(input: string, init: RequestInit = {}): Promise<Response> {
    const method = (init.method || 'GET').toUpperCase();
    const h = Object.fromEntries(Object.entries((init.headers as Record<string, string>) || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const body = typeof init.body === 'string' ? init.body : init.body instanceof URLSearchParams ? init.body.toString() : undefined;
    calls.push({ method, url: input, auth: !!h.authorization, body, range: h.range || h['content-range'] });
    const u = new URL(input);

    // ---- the token endpoint
    if (u.host === 'login.microsoftonline.com' && u.pathname.endsWith('/oauth2/v2.0/token')) {
      const f = new URLSearchParams(body || '');
      if (f.get('grant_type') === 'authorization_code') {
        state.codeCalls++;
        if (f.get('code') === 'BAD') return j(400, { error: 'invalid_grant' }); // the token endpoint's own error shape
        state.refresh = 'MS-REFRESH-1';
        return j(200, { access_token: `MS-ACCESS-${++state.accessSeq}`, ...(state.noRefreshTokenOnCode ? {} : { refresh_token: state.refresh }), expires_in: 3599, scope: state.scope });
      }
      state.refreshCalls++;
      if (state.refreshFails === 'invalid_client') return j(401, { error: 'invalid_client', error_description: 'AADSTS7000222: The provided client secret keys are expired.\r\nTrace ID: x' });
      if (state.refreshFails === 'invalid_grant' || (f.get('refresh_token') !== state.refresh && !state.allowOldRefresh)) return j(400, { error: 'invalid_grant', error_description: 'AADSTS70008: expired' });
      const n = Number(state.refresh.split('-').pop()) + 1;
      state.refresh = `MS-REFRESH-${n}`;
      return j(200, { access_token: `MS-ACCESS-${++state.accessSeq}`, refresh_token: state.refresh, expires_in: 3599, scope: state.scope });
    }

    // ---- the upload host: NO Authorization header allowed (spike: 401)
    if (u.host === 'upload.test') {
      const s = sessions.get(u.pathname.slice(4));
      if (h.authorization) return gerr(401, 'unauthenticated');
      if (!s) return gerr(404, 'itemNotFound');
      if (method === 'GET') return j(200, { nextExpectedRanges: [`${s.received}-${(s.size || 0) - 1}`] });
      if (method === 'DELETE') { sessions.delete(u.pathname.slice(4)); return j(204, {}); }
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(h['content-range'] || '');
      if (!m) return gerr(400, 'invalidRequest');
      const [start, end, total] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (start !== s.received) return gerr(416, 'invalidRange');
      const len = end - start + 1;
      if (end + 1 < total && len % 327680 !== 0) return gerr(400, 'invalidRange'); // the 320 KiB rule (the spike showed OneDrive may accept it; the kit is strict on purpose)
      s.size = total;
      s.data += (typeof init.body === 'string' ? init.body : 'x'.repeat(len)).slice(0, len);
      s.received = end + 1;
      if (s.received < total) return j(202, { nextExpectedRanges: [`${s.received}-${total - 1}`] });
      let it: GItem;
      if (s.itemId) {
        it = items.get(s.itemId)!;
        it.versions.push({ id: `${it.versions.length + 1}.0`, data: it.data });
        it.data = s.data; it.etag++;
      } else {
        it = make(s.parent!, s.conflict === 'rename' ? uniqueName(s.parent!, s.name!) : s.name!, false, s.data);
      }
      sessions.delete(u.pathname.slice(4));
      if (state.lastAnswerLost) throw new TypeError('Failed to fetch');
      return j(201, view(it));
    }

    // ---- downloads (pre-authenticated, Range)
    if (u.host === 'dl.test') {
      if (h.authorization) return gerr(401, 'unauthenticated');
      const it = items.get(u.pathname.slice(1));
      if (!it) return gerr(404, 'itemNotFound');
      const r = /bytes=(\d+)-(\d*)/.exec(h.range || '');
      if (!r) return new Response(it.data, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(it.data.length) } });
      const a = Number(r[1]); const b = r[2] ? Number(r[2]) : it.data.length - 1;
      return new Response(it.data.slice(a, b + 1), { status: 206, headers: { 'Content-Range': `bytes ${a}-${b}/${it.data.length}` } });
    }

    if (u.host !== 'graph.microsoft.com') return gerr(404, 'unknownHost');
    if (!h.authorization) return gerr(401, 'InvalidAuthenticationToken');
    if (state.throttle > 0) { state.throttle--; return new Response(JSON.stringify({ error: { code: 'TooManyRequests' } }), { status: 429, headers: { 'Retry-After': '1', 'Content-Type': 'application/json' } }); }
    const path = decodeURIComponent(u.pathname.replace('/v1.0', ''));

    if (path === '/me') return j(200, { mail: state.email, userPrincipalName: state.email });
    let m: RegExpExecArray | null;
    if ((m = /^\/me\/drive\/root:\/(.+)$/.exec(path))) { const it = child('ROOT', m[1]); return it ? j(200, view(it)) : gerr(404, 'itemNotFound'); }
    if (path === '/me/drive/root/children' && method === 'POST') {
      const b = JSON.parse(body!); if (child('ROOT', b.name)) return gerr(409, 'nameAlreadyExists');
      return j(201, view(make('ROOT', b.name, true)));
    }
    // upload sessions
    if ((m = /^\/me\/drive\/items\/([^/:]+):\/(.+):\/createUploadSession$/.exec(path))) {
      if (!items.has(m[1])) return gerr(404, 'itemNotFound');
      if (badName(m[2])) return gerr(400, 'invalidRequest');
      const b = body ? JSON.parse(body) : {}; const conflict = b.item?.['@microsoft.graph.conflictBehavior'] || 'fail';
      if (child(m[1], m[2]) && conflict === 'fail') return gerr(409, 'nameAlreadyExists');
      const sid = `S${++seq}`; sessions.set(sid, { parent: m[1], name: m[2], received: 0, data: '', conflict, size: undefined });
      return j(200, { uploadUrl: `https://upload.test/up/${sid}`, expirationDateTime: '2099-01-01T00:00:00Z' });
    }
    if ((m = /^\/me\/drive\/items\/([^/:]+)\/createUploadSession$/.exec(path))) {
      if (!items.has(m[1])) return gerr(404, 'itemNotFound');
      const sid = `S${++seq}`; sessions.set(sid, { itemId: m[1], received: 0, data: '', conflict: 'replace' });
      return j(200, { uploadUrl: `https://upload.test/up/${sid}`, expirationDateTime: '2099-01-01T00:00:00Z' });
    }
    if ((m = /^\/me\/drive\/items\/([^/:]+):\/(.+)$/.exec(path)) && method === 'GET') { const it = child(m[1], m[2]); return it ? j(200, view(it)) : gerr(404, 'itemNotFound'); }
    if ((m = /^\/me\/drive\/items\/([^/]+)\/children$/.exec(path))) {
      if (!items.has(m[1])) return gerr(404, 'itemNotFound');
      if (method === 'POST') {
        const b = JSON.parse(body!); if (badName(b.name)) return gerr(400, 'invalidRequest'); if (child(m[1], b.name)) return gerr(409, 'nameAlreadyExists');
        return j(201, view(make(m[1], b.name, !!b.folder)));
      }
      return j(200, { value: [...items.values()].filter((i) => i.parent === m![1]).sort((a, b) => a.created - b.created).map(view) });
    }
    if ((m = /^\/me\/drive\/items\/([^/]+)\/permanentDelete$/.exec(path)) && method === 'POST') { if (!items.has(m[1])) return gerr(404, 'itemNotFound'); removeTree(m[1]); return j(204, {}); }
    if ((m = /^\/me\/drive\/items\/([^/]+)\/versions$/.exec(path))) { const it = items.get(m[1]); if (!it) return gerr(404, 'itemNotFound'); return j(200, { value: [{ id: `${it.versions.length + 1}.0` }, ...[...it.versions].reverse().map((v) => ({ id: v.id }))] }); }
    if ((m = /^\/me\/drive\/items\/([^/]+)$/.exec(path))) {
      const it = items.get(m[1]); if (!it) return gerr(404, 'itemNotFound');
      if (method === 'PATCH') { const b = JSON.parse(body!); if (b.parentReference?.id) { if (!items.has(b.parentReference.id)) return gerr(404, 'itemNotFound'); it.parent = b.parentReference.id; } return j(200, view(it)); }
      if (u.searchParams.get('$select')?.includes('downloadUrl')) return j(200, { id: it.id, '@microsoft.graph.downloadUrl': `https://dl.test/${it.id}` });
      return j(200, view(it));
    }
    return gerr(404, 'unknownRoute');
  }

  return {
    fetchFn: fetchFn as unknown as (input: string, init?: RequestInit) => Promise<Response>,
    items, sessions, calls, state,
    /** put a file straight into a folder (test setup) */
    put: (parent: string, name: string, data: string) => make(parent, name, false, data),
    folder: (parent: string, name: string) => make(parent, name, true),
  };
}
