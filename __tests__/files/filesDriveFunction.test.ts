/** @jest-environment node */
// The Edge Function files-drive (supabase/functions/files-drive): the pure handler, the token provider, the crypto helpers and the Drive calls, driven by an in-memory Google
// (filesDriveTestKit) and an in-memory database (the files_ RPCs of PART 49 as doubles - the SQL itself is tested in Docker, tests/55 and 56). The Deno wiring (index.ts) needs the
// Supabase project of the owner; what is NOT tested here is the real Google (see documentation/Goolge/f0).
import { handleFilesDrive, chainFor, safeFileName, scopeKeyFor, type FilesDriveDeps, type ConnectionRow, type AuthResult } from '../../supabase/functions/files-drive/handler';
import { encryptToken, decryptToken, signPayload, verifyPayload, signValue, verifyValue } from '../../supabase/functions/files-drive/crypto';
import { createTokenProvider, NeedsReconnectError } from '../../supabase/functions/files-drive/token';
import { createFakeGoogle } from './filesDriveTestKit';

const KEY = Buffer.alloc(32, 7).toString('base64');
const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '99999999-9999-4999-8999-999999999999';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const TASK = '33333333-3333-4333-8333-333333333333';
const FN_URL = 'https://proj.supabase.co/functions/v1/files-drive';
const USERS: Record<string, { user: string; org: string; manager: boolean }> = {
  'Bearer anna': { user: 'u-anna', org: ORG, manager: true },
  'Bearer boris': { user: 'u-boris', org: ORG, manager: false },
  'Bearer eve': { user: 'u-eve', org: OTHER_ORG, manager: true },
};

function setup(over: Partial<FilesDriveDeps> = {}, clock = { t: 1_800_000_000_000 }) {
  const g = createFakeGoogle();
  const db = {
    connections: new Map<string, ConnectionRow>(),
    orgs: new Map<string, Record<string, any>>([[ORG, {}], [OTHER_ORG, {}]]),
    pending: new Map<string, Record<string, any>>(),
    folders: new Map<string, Record<string, any>>(),
    cleanup: [] as { id: string; org: string; itemId: string; kind: string; allowRoot: boolean; state: string; attempts: number; error?: string }[],
    files: new Map<string, { rowGUID: string; rowOwnerGUID: string; rowParentGUID: string; rowJSON: Record<string, any> }>(),
    rpcCalls: [] as string[],
    switchOff: false,
    storage: { totalBytes: 0 } as Record<string, any>,
    versions: [] as any[],
  };
  let seq = 0;
  const who = (a: string) => USERS[a];
  const deps: FilesDriveDeps = {
    config: { clientId: 'cid', clientSecret: 'csecret', functionUrl: FN_URL, appReturnUrl: 'https://app.test/user/files', tokenKey: KEY, urlSecret: 'url-secret', cleanupSecret: 'tick-secret' },
    fetchFn: g.fetchFn,
    now: () => clock.t,
    authorize: jest.fn(async (a: string, action: string, scope: string, guid?: string | null, project?: string | null): Promise<AuthResult> => {
      const u = who(a);
      if (!u) return { allowed: false, reason: 'signIn' };
      if (action !== 'connect' && action !== 'read' && !['organization', 'project', 'stage', 'task', 'document'].includes(scope)) return { allowed: false, reason: 'scope' };
      if (db.switchOff && ['project', 'task', 'stage'].includes(scope) && action !== 'connect') return { allowed: false, reason: 'switchOff' };
      const write = action !== 'read';
      if (write && !u.manager) return { allowed: false, reason: 'noPermission' };
      return { allowed: true, organizationGUID: u.org, userGUID: u.user, projectGUID: scope === 'project' ? guid : project || null, scope, guid: guid || null };
    }),
    callerRpc: jest.fn(async (a: string, fn: string, args: Record<string, any>) => {
      db.rpcCalls.push(fn);
      const u = who(a);
      if (!u) return { data: null, error: 'signIn' };
      if (fn === 'files_cleanup_counts') return { data: { waiting: db.cleanup.filter((c) => c.org === u.org && ['waiting', 'running'].includes(c.state)).length, failed: db.cleanup.filter((c) => c.org === u.org && c.state === 'failed').length }, error: null };
      if (fn === 'files_get') {
        const row = db.files.get(args.p_post);
        return row && row.rowOwnerGUID === u.org ? { data: row, error: null } : { data: null, error: 'files_get: no such file' };
      }
      if (fn === 'files_delete') {
        const row = db.files.get(args.p_post);
        if (!row || row.rowOwnerGUID !== u.org) return { data: null, error: 'files_delete: no such file' };
        if (!u.manager) return { data: null, error: 'No permission: files, delete (noPermission)' };
        db.files.delete(args.p_post);
        const id = row.rowJSON.googleDriveFileId;
        if (id) db.cleanup.push({ id: `c${++seq}`, org: u.org, itemId: id, kind: 'file', allowRoot: false, state: 'waiting', attempts: 0 });
        return { data: { deleted: true, driveFileId: id || null }, error: null };
      }
      if (fn === 'files_add') {
        const p = db.pending.get(args.p_upload_id);
        if (!p || p.state !== 'verified' || p.organizationGUID !== u.org || p.userGUID !== u.user) return { data: null, error: 'files_add: the upload is not finished, or it is not yours, or it has expired' };
        const row = { rowGUID: `post${++seq}`, rowOwnerGUID: u.org, rowParentGUID: args.p_guid || u.org, rowJSON: { fileSourceKind: p.scope, googleDriveFileId: p.fileId, fileName: p.name, fileSizeBytes: p.fileSize, mediaPostMIME: p.mime, googleDriveFolderId: p.folderId, ...(args.p_file || {}) } };
        db.files.set(row.rowGUID, row);
        db.pending.delete(args.p_upload_id);
        return { data: row, error: null };
      }
      if (fn === 'files_storage_used') return { data: db.storage, error: null };
      if (fn === 'files_replace') {
        const p = db.pending.get(args.p_upload_id);
        const row = db.files.get(args.p_post);
        if (!p || p.state !== 'verified' || p.replaceOf !== args.p_post || !row) return { data: null, error: 'files_replace: the new version is not finished, or it is not yours' };
        db.versions.push({ post: args.p_post, version: row.rowJSON.fileVersionNumber || 1, driveRevisionId: p.oldRevisionId, fileSizeBytes: row.rowJSON.fileSizeBytes });
        row.rowJSON = { ...row.rowJSON, fileVersionNumber: (row.rowJSON.fileVersionNumber || 1) + 1, fileSizeBytes: p.fileSize, fileName: p.name };
        db.pending.delete(args.p_upload_id);
        return { data: row, error: null };
      }
      if (fn === 'files_move') {
        const row = db.files.get(args.p_post)!;
        row.rowParentGUID = args.p_scope === 'organization' ? u.org : args.p_guid;
        row.rowJSON = { ...row.rowJSON, fileSourceKind: args.p_scope, fileSourceProjectGUID: args.p_project, googleDriveFolderId: args.p_folder_id, googleDriveRelativePath: args.p_relative_path };
        return { data: row, error: null };
      }
      if (fn === 'files_health_rows') return { data: { files: [...db.files.values()].filter((r) => r.rowJSON.googleDriveFileId).map((r) => ({ post: r.rowGUID, fileId: r.rowJSON.googleDriveFileId, folderId: r.rowJSON.googleDriveFolderId, name: r.rowJSON.fileName })), folders: [...db.folders.values()].map((f) => ({ scopeKey: f.scopeKey, folderId: f.driveFolderId, filesFolderId: f.driveFilesFolderId })), rootFolderId: db.orgs.get(u.org)?.organizationGoogleDriveRootFolderId }, error: null };
      if (fn === 'files_delete_row_only') { db.files.delete(args.p_post); return { data: null, error: null }; }
      return { data: null, error: `unknown rpc ${fn}` };
    }),
    serviceRpc: jest.fn(async (fn: string, args: Record<string, any>) => {
      db.rpcCalls.push(fn);
      switch (fn) {
        case 'files_org_facts': return { rootFolderId: db.orgs.get(args.p_org)?.organizationGoogleDriveRootFolderId, rootFolderUrl: db.orgs.get(args.p_org)?.organizationGoogleDriveRootFolderUrl, accountEmail: db.orgs.get(args.p_org)?.organizationGoogleDriveAccountEmail };
        case 'files_folder_get': return db.folders.get(`${args.p_org}|${args.p_scope_key}`) || null;
        case 'files_folder_set': { const k = `${args.p_org}|${args.p_scope_key}`; if (!db.folders.has(k)) db.folders.set(k, args.p_json); return db.folders.get(k); }
        case 'files_upload_pending_add': db.pending.set(args.p_upload, { organizationGUID: args.p_org, userGUID: args.p_user, uploadId: args.p_upload, state: 'pending', ...args.p_json }); return null;
        case 'files_upload_pending_get': return db.pending.get(args.p_upload) || null;
        case 'files_upload_pending_verify': { const p = db.pending.get(args.p_upload)!; Object.assign(p, { state: 'verified', fileId: args.p_file_id, fileSize: args.p_size, folderId: args.p_folder_id, relativePath: args.p_path }); return p; }
        case 'files_cleanup_pending': { const take = db.cleanup.filter((c) => c.state === 'waiting').slice(0, args.p_limit); take.forEach((c) => { c.state = 'running'; c.attempts++; }); return take.map((c) => ({ id: c.id, organizationGUID: c.org, driveItemId: c.itemId, itemKind: c.kind, allowRoot: c.allowRoot, attempts: c.attempts })); }
        case 'files_cleanup_done': db.cleanup.find((c) => c.id === args.p_id)!.state = 'done'; return null;
        case 'files_cleanup_failed': { const c = db.cleanup.find((x) => x.id === args.p_id)!; c.error = args.p_error; c.state = c.attempts >= 5 ? 'failed' : 'waiting'; return null; }
        default: throw new Error(`unknown service rpc ${fn}`);
      }
    }),
    loadConnection: jest.fn(async (org: string) => db.connections.get(org) || null),
    saveConnection: jest.fn(async (org: string, patch: Record<string, any>) => { db.connections.set(org, { ...(db.connections.get(org) || {}), ...patch }); }),
    deleteConnection: jest.fn(async (org: string) => { db.connections.delete(org); }),
    patchOrganization: jest.fn(async (org: string, patch: Record<string, any>) => { db.orgs.set(org, { ...(db.orgs.get(org) || {}), ...patch }); }),
    ...over,
  };
  const call = (body: Record<string, any>, who2 = 'Bearer anna', extra: Record<string, string> = {}) =>
    handleFilesDrive(new Request(FN_URL, { method: 'POST', headers: { ...(who2 ? { Authorization: who2 } : {}), 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) }), deps);
  const get = (qs: string, headers: Record<string, string> = {}) => handleFilesDrive(new Request(`${FN_URL}?${qs}`, { method: 'GET', headers }), deps);
  const connect = async () => {
    const start = await (await call({ action: 'connect_start' })).json();
    const state = new URL(start.url).searchParams.get('state')!;
    return get(`code=GOOD&state=${encodeURIComponent(state)}`);
  };
  /** a connected organization and a verified-ready upload of a file into a task */
  const upload = async (name = 'plan.pdf', who2 = 'Bearer anna', extra: Record<string, any> = {}) => {
    const s = await (await call({ action: 'upload_session', scope: 'task', guid: TASK, projectGUID: PROJECT, name, mime: 'application/pdf', size: 12, ...extra }, who2, { Origin: 'https://app.test' })).json();
    return s;
  };
  /** Google made the file when the bytes arrived (the property written at session creation) */
  const bytesArrive = (s: any, data = 'hello world!') => {
    const sent = JSON.parse(g.calls.filter((c) => c.url.includes('uploadType=resumable')).pop()!.body!);
    return g.add({ name: sent.name, parents: sent.parents, properties: sent.properties, size: String(data.length), data });
  };
  return { g, db, deps, call, get, connect, upload, bytesArrive, clock };
}

describe('crypto helpers', () => {
  it('encrypts a token so the cipher text is not the token, and decrypts it back', async () => {
    const c = await encryptToken('1//refresh-token', KEY);
    expect(c.startsWith('v1.')).toBe(true);
    expect(c).not.toContain('refresh');
    expect(await decryptToken(c, KEY)).toBe('1//refresh-token');
    expect(await encryptToken('1//refresh-token', KEY)).not.toBe(c);
  });
  it('refuses a wrong key and a damaged cipher text', async () => {
    const c = await encryptToken('abc', KEY);
    await expect(decryptToken(c, Buffer.alloc(32, 9).toString('base64'))).rejects.toBeDefined();
    await expect(decryptToken(c.slice(0, -4) + 'AAAA', KEY)).rejects.toBeDefined();
    await expect(encryptToken('x', Buffer.alloc(8).toString('base64'))).rejects.toThrow('32 bytes');
  });
  it('signs and verifies values and payloads; a changed value or secret fails', async () => {
    const sig = await signValue('s', 'a|b|1');
    expect(await verifyValue('s', 'a|b|1', sig)).toBe(true);
    expect(await verifyValue('s', 'a|b|2', sig)).toBe(false);
    expect(await verifyValue('other', 'a|b|1', sig)).toBe(false);
    expect(await verifyValue('s', 'a|b|1', 'not-a-signature')).toBe(false);
    const p = await signPayload('s', { org: 'o', exp: 5 });
    expect(await verifyPayload('s', p)).toEqual({ org: 'o', exp: 5 });
    expect(await verifyPayload('s', p.replace(/.$/, 'x'))).toBeNull();
    expect(await verifyPayload('other', p)).toBeNull();
  });
});

describe('token provider: auto refresh', () => {
  async function provider(now: () => number, g = createFakeGoogle(), saved: any = {}) {
    const stored = { refreshTokenEncrypted: await encryptToken('REFRESH-TOKEN-1', KEY), state: 'ok' };
    const marks: string[] = [];
    const p = createTokenProvider({
      fetchFn: g.fetchFn, clientId: 'cid', clientSecret: 'csecret', tokenKey: KEY, now,
      loadConnection: async () => ({ ...stored, ...saved }),
      markNeedsReconnect: async (_o, e) => { marks.push(`reconnect:${e}`); },
      markRefreshed: async (_o, iso) => { marks.push(`refreshed:${iso}`); },
    });
    return { p, g, marks };
  }
  it('refreshes once and uses the cache while the token has more than 5 minutes left', async () => {
    const clock = { t: 1_800_000_000_000 };
    const { p, g } = await provider(() => clock.t);
    expect(await p.getAccessToken(ORG)).toBe('ACCESS-1');
    clock.t += 30 * 60 * 1000;
    expect(await p.getAccessToken(ORG)).toBe('ACCESS-1');
    expect(g.state.refreshCalls).toBe(1);
  });
  it('refreshes by itself after the hour is nearly over (no user action)', async () => {
    const clock = { t: 1_800_000_000_000 };
    const { p, g } = await provider(() => clock.t);
    await p.getAccessToken(ORG);
    clock.t += 56 * 60 * 1000;
    expect(await p.getAccessToken(ORG)).toBe('ACCESS-2');
    expect(g.state.refreshCalls).toBe(2);
  });
  it('one refresh at a time: ten parallel callers make ONE refresh call', async () => {
    const { p, g } = await provider(() => 1_800_000_000_000);
    const tokens = await Promise.all(Array.from({ length: 10 }, () => p.getAccessToken(ORG)));
    expect(new Set(tokens).size).toBe(1);
    expect(g.state.refreshCalls).toBe(1);
  });
  it('force ignores the cache (after a Drive 401)', async () => {
    const { p, g } = await provider(() => 1_800_000_000_000);
    await p.getAccessToken(ORG);
    expect(await p.getAccessToken(ORG, true)).toBe('ACCESS-2');
    expect(g.state.refreshCalls).toBe(2);
  });
  it('sends the decrypted refresh token with the client id and secret', async () => {
    const { p, g } = await provider(() => 1_800_000_000_000);
    await p.getAccessToken(ORG);
    const body = new URLSearchParams(g.calls.find((c) => c.url.includes('/token'))!.body);
    expect(Object.fromEntries(body)).toEqual({ grant_type: 'refresh_token', refresh_token: 'REFRESH-TOKEN-1', client_id: 'cid', client_secret: 'csecret' });
  });
  it('invalid_grant marks the connection needsReconnect and throws NeedsReconnectError', async () => {
    const g = createFakeGoogle();
    g.state.refreshFails = true;
    const { p, marks } = await provider(() => 1_800_000_000_000, g);
    await expect(p.getAccessToken(ORG)).rejects.toBeInstanceOf(NeedsReconnectError);
    expect(marks[0]).toMatch(/^reconnect:Token has been expired or revoked/);
  });
  it('a connection already marked needsReconnect, or none, does not call Google', async () => {
    const { p, g } = await provider(() => 1, createFakeGoogle(), { state: 'needsReconnect' });
    await expect(p.getAccessToken(ORG)).rejects.toBeInstanceOf(NeedsReconnectError);
    expect(g.state.refreshCalls).toBe(0);
  });
});

describe('connect', () => {
  it('connect_start needs a caller and the connect permission (files_authorize)', async () => {
    const t = setup();
    expect((await t.call({ action: 'connect_start' }, '')).status).toBe(401);
    expect((await t.call({ action: 'connect_start' }, 'Bearer nobody')).status).toBe(401);
    const denied = await t.call({ action: 'connect_start' }, 'Bearer boris');
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ reason: 'noPermission' });
  });
  it('connect_start builds the consent url: drive.file only, offline, consent prompt, the function as redirect, a signed state with the organization the DATABASE says', async () => {
    const t = setup();
    const r = await t.call({ action: 'connect_start', organizationGUID: OTHER_ORG });
    expect(r.status).toBe(200);
    const u = new URL((await r.json()).url);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const q = u.searchParams;
    expect([q.get('client_id'), q.get('redirect_uri'), q.get('response_type'), q.get('scope'), q.get('access_type'), q.get('prompt')])
      .toEqual(['cid', FN_URL, 'code', 'https://www.googleapis.com/auth/drive.file', 'offline', 'consent']);
    expect(await verifyPayload('url-secret', q.get('state')!)).toMatchObject({ org: ORG, user: 'u-anna' }); // a body value is ignored
  });
  it('the callback stores the ENCRYPTED refresh token, makes kit8root once and writes the organization keys, then goes back to the app', async () => {
    const t = setup();
    const r = await t.connect();
    expect(r.status).toBe(302);
    expect(r.headers.get('Location')).toBe('https://app.test/user/files?filesConnect=ok');
    const conn = t.db.connections.get(ORG)!;
    expect(conn.state).toBe('ok');
    expect(conn.accountEmail).toBe('drive@gmail.test');
    expect(conn.refreshTokenEncrypted).not.toContain('REFRESH-TOKEN-1');
    expect(await decryptToken(conn.refreshTokenEncrypted!, KEY)).toBe('REFRESH-TOKEN-1');
    const roots = [...t.g.items.values()].filter((i) => i.name === 'kit8root');
    expect(roots).toHaveLength(1);
    expect(roots[0].properties).toEqual({ kit8Kind: 'root', kit8OrganizationGUID: ORG });
    expect(t.db.orgs.get(ORG)).toMatchObject({
      organizationGoogleDriveMode: 'adminProxy', organizationGoogleDriveState: 'ok', organizationGoogleDriveAccountEmail: 'drive@gmail.test',
      organizationGoogleDriveRootFolderId: roots[0].id, organizationGoogleDriveRootFolderUrl: `https://drive.google.com/drive/folders/${roots[0].id}`,
    });
  });
  it('a second connect (reconnect, or a second administrator) FINDS the same kit8root - no duplicate folder', async () => {
    const t = setup();
    await t.connect();
    const first = t.db.orgs.get(ORG)!.organizationGoogleDriveRootFolderId;
    await t.connect();
    expect([...t.g.items.values()].filter((i) => i.name === 'kit8root')).toHaveLength(1);
    expect(t.db.orgs.get(ORG)!.organizationGoogleDriveRootFolderId).toBe(first);
  });
  it('refuses an expired or forged state, a denied consent, a missing refresh token and a missing scope', async () => {
    const t = setup();
    const state = await signPayload('url-secret', { org: ORG, user: 'u-anna', exp: t.clock.t + 1000 });
    t.clock.t += 5000;
    expect((await t.get(`code=GOOD&state=${encodeURIComponent(state)}`)).headers.get('Location')).toContain('filesConnect=error');
    expect((await t.get('code=GOOD&state=forged.abc')).headers.get('Location')).toContain('filesConnect=error');
    expect((await t.get('error=access_denied')).headers.get('Location')).toContain('reason=access_denied');
    const fresh = await signPayload('url-secret', { org: ORG, user: 'u-anna', exp: t.clock.t + 60000 });
    t.g.state.nextRefreshToken = '';
    expect((await t.get(`code=GOOD&state=${encodeURIComponent(fresh)}`)).headers.get('Location')).toContain('no+refresh+token');
    t.g.state.nextRefreshToken = 'R';
    t.g.state.scope = 'https://www.googleapis.com/auth/userinfo.email';
    expect((await t.get(`code=GOOD&state=${encodeURIComponent(fresh)}`)).headers.get('Location')).toContain('drive.file');
    expect(t.db.connections.size).toBe(0);
  });
});

describe('status', () => {
  it('notConnected before, the state after; every member sees it, a stranger gets 401', async () => {
    const t = setup();
    expect(await (await t.call({ action: 'status' }, 'Bearer boris')).json()).toMatchObject({ state: 'notConnected', accountEmail: null, cleanup: { waiting: 0, failed: 0 } });
    await t.connect();
    expect(await (await t.call({ action: 'status' }, 'Bearer boris')).json()).toMatchObject({ state: 'ok', accountEmail: 'drive@gmail.test' });
    expect((await t.call({ action: 'status' }, 'Bearer nobody')).status).toBe(401);
  });
});

describe('folders, names and keys', () => {
  it('the folder chain of every scope follows the layout of the plan', () => {
    expect(chainFor(ORG, 'organization', '', '')!.map((s) => s.name)).toEqual(['organization', 'files']);
    expect(chainFor(ORG, 'project', PROJECT, '')!.map((s) => s.name)).toEqual(['project', PROJECT, 'files']);
    expect(chainFor(ORG, 'task', TASK, PROJECT)!.map((s) => s.name)).toEqual(['project', PROJECT, 'task', TASK, 'files']);
    expect(chainFor(ORG, 'stage', TASK, PROJECT)!.map((s) => s.name)).toEqual(['project', PROJECT, 'task', TASK, 'files']);
    expect(chainFor(ORG, 'document', 'inv-1/../x', '')!.map((s) => s.name)).toEqual(['document', 'inv-1_.._x', 'files']);
    expect(chainFor(ORG, 'project', 'not-a-guid', '')).toBeNull();
    expect(chainFor(ORG, 'task', TASK, '')).toBeNull();
    expect(chainFor(ORG, 'galaxy', TASK, PROJECT)).toBeNull();
    for (const s of chainFor(ORG, 'task', TASK, PROJECT)!) expect(s.properties.kit8OrganizationGUID).toBe(ORG);
  });
  it('scope keys match the keys the SQL delete triggers look for', () => {
    expect(scopeKeyFor('organization', '')).toBe('organization');
    expect(scopeKeyFor('project', PROJECT)).toBe(`project:${PROJECT}`);
    expect(scopeKeyFor('task', TASK)).toBe(`task:${TASK}`);
    expect(scopeKeyFor('stage', TASK)).toBe(`task:${TASK}`);
  });
  it('a file name is cleaned of paths and control characters', () => {
    expect(safeFileName('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(safeFileName('  ')).toBe('file');
    expect(safeFileName('a\nb')).toBe('a_b');
    expect(safeFileName('x'.repeat(300))).toHaveLength(200);
  });
});

describe('upload: session, bytes, finish', () => {
  it('upload_session needs the add permission of the scope (a plain member and a stranger are refused, the switch is honoured)', async () => {
    const t = setup();
    await t.connect();
    const body = { action: 'upload_session', scope: 'task', guid: TASK, projectGUID: PROJECT, name: 'a.pdf', size: 5 };
    expect((await t.call(body, '')).status).toBe(401);
    expect((await t.call(body, 'Bearer boris')).status).toBe(403);
    t.db.switchOff = true;
    expect(await (await t.call(body)).json()).toMatchObject({ reason: 'switchOff' });
  });
  it('makes the chain once, caches the folders in files_folder_table, passes the Origin and records a pending upload', async () => {
    const t = setup();
    await t.connect();
    const s = await t.upload();
    expect(s.sessionUrl).toMatch(/^https:\/\/www\.googleapis\.com\/session\/\d+$/);
    expect(s.path).toBe(`project/${PROJECT}/task/${TASK}/files`);
    expect(s.uploadId).toMatch(/^[0-9a-f-]{36}$/);
    const named = (n: string) => [...t.g.items.values()].filter((i) => i.name === n);
    expect(named('files')).toHaveLength(1);
    expect(named(TASK)[0].properties).toMatchObject({ kit8Kind: 'task', kit8TaskGUID: TASK, kit8ProjectGUID: PROJECT, kit8OrganizationGUID: ORG });
    const folder = t.db.folders.get(`${ORG}|task:${TASK}`)!;
    expect(folder).toMatchObject({ driveFolderId: named(TASK)[0].id, driveFilesFolderId: named('files')[0].id, projectGUID: PROJECT });
    const session = t.g.calls.find((c) => c.url.includes('uploadType=resumable'))!;
    expect(session.headers['origin']).toBe('https://app.test');
    expect(session.headers['x-upload-content-length']).toBe('12');
    expect(JSON.parse(session.body!)).toMatchObject({ parents: [folder.driveFilesFolderId], properties: { kit8Kind: 'file', kit8OrganizationGUID: ORG, kit8Upload: s.uploadId } });
    expect(t.db.pending.get(s.uploadId)).toMatchObject({ organizationGUID: ORG, userGUID: 'u-anna', scope: 'task', scopeGUID: TASK, projectGUID: PROJECT, name: 'plan.pdf', state: 'pending', size: 12 });
    const foldersBefore = t.g.items.size;
    await t.upload('second.pdf');
    expect(t.g.items.size).toBe(foldersBefore); // the cached folder is reused: no Drive folder call at all
  });
  it('refuses without a connection, for a bad scope and a bad size', async () => {
    const t = setup();
    const ok = { action: 'upload_session', scope: 'organization', name: 'a.txt', size: 5 };
    expect(await (await t.call(ok)).json()).toMatchObject({ code: 'notConnected' });
    await t.connect();
    expect((await t.call({ ...ok, scope: 'galaxy' })).status).toBe(403);
    expect((await t.call({ ...ok, scope: 'task', guid: 'bad', projectGUID: 'bad' })).status).toBe(400);
    expect((await t.call({ ...ok, size: 0 })).status).toBe(400);
  });
  it('upload_finish finds the file by its uploadId, has the database verify and register it, and returns the file row', async () => {
    const t = setup();
    await t.connect();
    const s = await t.upload();
    expect((await t.call({ action: 'upload_finish', uploadId: s.uploadId })).status).toBe(404); // the bytes have not arrived
    t.bytesArrive(s);
    const r = await t.call({ action: 'upload_finish', uploadId: s.uploadId, file: { paperDocumentPlace: 'Cabinet 3' } });
    expect(r.status).toBe(200);
    const { file } = await r.json();
    expect(file.rowOwnerGUID).toBe(ORG);
    expect(file.rowJSON).toMatchObject({ fileSourceKind: 'task', fileName: 'plan.pdf', fileSizeBytes: 12, paperDocumentPlace: 'Cabinet 3' });
    expect(t.db.rpcCalls).toContain('files_upload_pending_verify');
    expect(t.db.pending.size).toBe(0);
  });
  it('upload_finish is for the person who opened the upload, in a scope he may add to', async () => {
    const t = setup();
    await t.connect();
    const s = await t.upload();
    t.bytesArrive(s);
    expect((await t.call({ action: 'upload_finish', uploadId: s.uploadId }, 'Bearer boris')).status).toBe(403);
    expect((await t.call({ action: 'upload_finish', uploadId: s.uploadId }, 'Bearer eve')).status).toBe(403);
    expect((await t.call({ action: 'upload_finish', uploadId: 'no-such-upload' })).status).toBe(404);
    expect((await t.call({ action: 'upload_finish' })).status).toBe(400);
  });
});

describe('signed download with Range', () => {
  async function withFile() {
    const t = setup();
    await t.connect();
    const s = await t.upload('movie.bin');
    t.bytesArrive(s, '0123456789abcdefghij');
    const file = (await (await t.call({ action: 'upload_finish', uploadId: s.uploadId })).json()).file;
    const r = await (await t.call({ action: 'download_url', postGUID: file.rowGUID }, 'Bearer boris')).json();
    return { t, file, url: new URL(r.url), r };
  }
  it('download_url is for every member who may read the post and gives a signed url on the function that expires', async () => {
    const { t, r, url } = await withFile();
    expect(url.origin + url.pathname).toBe(FN_URL);
    expect(r.expiresAt).toBe(t.clock.t + 10 * 60 * 1000);
    expect(r).toMatchObject({ name: 'movie.bin' });
    expect((await t.call({ action: 'download_url', postGUID: 'x' }, 'Bearer eve')).status).toBe(403);
    expect((await t.call({ action: 'download_url', postGUID: 'x' }, '')).status).toBe(401);
    expect((await t.call({ action: 'download_url' }, 'Bearer boris')).status).toBe(400);
  });
  it('streams the whole file, and a byte range as HTTP 206 with the same bytes (seeking)', async () => {
    const { t, url } = await withFile();
    const full = await t.get(url.searchParams.toString());
    expect(full.status).toBe(200);
    expect(await full.text()).toBe('0123456789abcdefghij');
    expect(full.headers.get('Content-Disposition')).toBe('inline'); // shown by the browser, never saved
    const part = await t.get(url.searchParams.toString(), { Range: 'bytes=5-9' });
    expect(part.status).toBe(206);
    expect(part.headers.get('Content-Range')).toBe('bytes 5-9/20');
    expect(part.headers.get('Accept-Ranges')).toBe('bytes');
    expect(await part.text()).toBe('56789');
    expect(t.g.calls.filter((c) => c.url.includes('alt=media')).pop()!.headers['range']).toBe('bytes=5-9');
  });
  it('refuses a changed file, a changed organization, a forged signature and an expired link', async () => {
    const { t, url } = await withFile();
    const q = (k: string, v: string) => { const p = new URLSearchParams(url.searchParams.toString()); p.set(k, v); return p.toString(); };
    expect((await t.get(q('file', 'other'))).status).toBe(403);
    expect((await t.get(q('org', OTHER_ORG))).status).toBe(403);
    expect((await t.get(q('sig', 'abc'))).status).toBe(403);
    t.clock.t += 11 * 60 * 1000;
    expect(await (await t.get(url.searchParams.toString())).json()).toEqual({ error: 'The link has expired.' });
  });
  it('a link post (no Drive file) gets no download url', async () => {
    const t = setup();
    t.db.files.set('lnk', { rowGUID: 'lnk', rowOwnerGUID: ORG, rowParentGUID: TASK, rowJSON: { fileSourceKind: 'task', mediaPostOriginType: 'url' } });
    expect((await t.call({ action: 'download_url', postGUID: 'lnk' }, 'Bearer boris')).status).toBe(400);
  });
  it('a 401 from Drive forces one token refresh and one retry', async () => {
    const { t, url } = await withFile();
    const before = t.g.state.refreshCalls;
    t.g.state.unauthorizedOnce = true;
    const r = await t.get(url.searchParams.toString());
    expect(r.status).toBe(200);
    expect(t.g.state.refreshCalls).toBeGreaterThanOrEqual(before);
  });
});

describe('delete and the cleanup queue (bottom-up)', () => {
  function tree(t: ReturnType<typeof setup>) {
    const mark = { kit8OrganizationGUID: ORG };
    const folder = (name: string, parent?: string, extra = {}) => t.g.add({ name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : [], properties: { ...mark, ...extra } });
    const root = folder('kit8root', undefined, { kit8Kind: 'root' });
    const project = folder('project', root.id);
    const p1 = folder(PROJECT, project.id);
    const task = folder(TASK, p1.id);
    const files = folder('files', task.id);
    const f1 = t.g.add({ name: 'a.txt', parents: [files.id], properties: mark });
    const f2 = t.g.add({ name: 'b.txt', parents: [files.id], properties: mark });
    return { root, project, p1, task, files, f1, f2 };
  }
  const queue = (t: ReturnType<typeof setup>, itemId: string, kind: string, allowRoot = false, org = ORG) => t.db.cleanup.push({ id: `q${t.db.cleanup.length + 1}`, org, itemId, kind, allowRoot, state: 'waiting', attempts: 0 });

  it('delete_file removes the row, queues the Drive file and works the queue at once', async () => {
    const t = setup();
    await t.connect();
    const s = await t.upload();
    const gfile = t.bytesArrive(s);
    const file = (await (await t.call({ action: 'upload_finish', uploadId: s.uploadId })).json()).file;
    expect((await t.call({ action: 'delete_file', postGUID: file.rowGUID }, 'Bearer boris')).status).toBe(403);
    const r = await t.call({ action: 'delete_file', postGUID: file.rowGUID });
    expect(await r.json()).toMatchObject({ deleted: true, driveFileId: gfile.id, cleanup: { done: 1, failed: 0 } });
    expect(t.db.files.size).toBe(0);
    expect(t.g.items.has(gfile.id)).toBe(false);
    expect(t.db.cleanup[0].state).toBe('done');
  });
  it('the cleanup deletes a task folder: files first, then the folders from the deepest (Drive refuses a folder that still has children)', async () => {
    const t = setup();
    await t.connect();
    const x = tree(t);
    queue(t, x.task.id, 'folder');
    const r = await t.call({ action: 'cleanup' });
    expect(await r.json()).toEqual({ done: 1, failed: 0, skipped: 0 });
    expect([x.task.id, x.files.id, x.f1.id, x.f2.id].some((id) => t.g.items.has(id))).toBe(false);
    expect(t.g.items.has(x.p1.id)).toBe(true);
    const order = t.g.calls.filter((c) => c.method === 'DELETE').map((c) => c.url.split('/').pop());
    expect(order.indexOf(x.f1.id)).toBeLessThan(order.indexOf(x.files.id));
    expect(order.indexOf(x.files.id)).toBeLessThan(order.indexOf(x.task.id));
  });
  it('an item that is already gone counts as done; an item that is not ours is refused and marked failed later', async () => {
    const t = setup();
    await t.connect();
    queue(t, 'unknown-id', 'file');
    const foreign = t.g.add({ name: 'f', properties: { kit8OrganizationGUID: OTHER_ORG } });
    queue(t, foreign.id, 'file');
    expect(await (await t.call({ action: 'cleanup' })).json()).toEqual({ done: 1, failed: 1, skipped: 0 });
    expect(t.g.items.has(foreign.id)).toBe(true);
    expect(t.db.cleanup.map((c) => c.state)).toEqual(['done', 'waiting']);
    expect(t.db.cleanup[1].error).toMatch(/does not belong/);
  });
  it('while Google is disconnected the lines wait (skipped), nothing is lost', async () => {
    const t = setup();
    await t.connect();
    const x = tree(t);
    queue(t, x.f1.id, 'file');
    t.g.state.refreshFails = true;
    t.clock.t += 2 * 60 * 60 * 1000;
    expect(await (await t.call({ action: 'cleanup' })).json()).toEqual({ done: 0, failed: 0, skipped: 1 });
    expect(t.g.items.has(x.f1.id)).toBe(true);
  });
  it('an organization delete: the root folder named in the url goes (allowRoot), then the token is revoked and forgotten', async () => {
    const t = setup();
    await t.connect();
    const x = tree(t);
    queue(t, x.root.id, 'folder', true);
    const r = await t.call({ action: 'cleanup' });
    expect(await r.json()).toEqual({ done: 1, failed: 0, skipped: 0 });
    expect(t.g.items.has(x.root.id)).toBe(false);
    expect(t.g.items.has(x.f1.id)).toBe(false);
    expect(t.g.state.revoked).toEqual(['REFRESH-TOKEN-1']);
    expect(t.db.connections.has(ORG)).toBe(false);
  });
  it('the pg_cron tick uses the secret header; a wrong secret falls back to the user rules', async () => {
    const t = setup();
    await t.connect();
    const x = tree(t);
    queue(t, x.f1.id, 'file');
    expect((await t.call({ action: 'cleanup' }, '', { 'x-files-cleanup-secret': 'wrong' })).status).toBe(401);
    const ok = await t.call({ action: 'cleanup' }, '', { 'x-files-cleanup-secret': 'tick-secret' });
    expect(await ok.json()).toEqual({ done: 1, failed: 0, skipped: 0 });
    expect((await t.call({ action: 'cleanup' }, 'Bearer boris')).status).toBe(403);
  });
});

describe('needs reconnect and disconnect', () => {
  it('after Google refuses the refresh every Drive action answers 409 needsReconnect and the organization shows it', async () => {
    const t = setup();
    await t.connect();
    t.g.state.refreshFails = true;
    t.clock.t += 2 * 60 * 60 * 1000;
    const r = await t.call({ action: 'upload_session', scope: 'organization', name: 'a', size: 1 });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ code: 'needsReconnect' });
    expect(t.db.connections.get(ORG)!.state).toBe('needsReconnect');
    expect(t.db.orgs.get(ORG)!.organizationGoogleDriveState).toBe('needsReconnect');
    expect(await (await t.call({ action: 'status' }, 'Bearer boris')).json()).toMatchObject({ state: 'needsReconnect' });
    t.g.state.refreshFails = false;
    await t.connect(); // Reconnect restores everything
    expect(t.db.connections.get(ORG)!.state).toBe('ok');
    expect((await t.call({ action: 'upload_session', scope: 'organization', name: 'a', size: 1 })).status).toBe(200);
  });
  it('disconnect revokes the token at Google, deletes the stored token and marks the organization notConnected', async () => {
    const t = setup();
    await t.connect();
    expect((await t.call({ action: 'disconnect' }, 'Bearer boris')).status).toBe(403);
    expect(await (await t.call({ action: 'disconnect' })).json()).toEqual({ disconnected: true });
    expect(t.g.state.revoked).toEqual(['REFRESH-TOKEN-1']);
    expect(t.db.connections.has(ORG)).toBe(false);
    expect(t.db.orgs.get(ORG)!.organizationGoogleDriveState).toBe('notConnected');
  });
  it('basic request rules: OPTIONS, unknown action, other methods, a GET that is neither a redirect nor a download', async () => {
    const t = setup();
    expect((await handleFilesDrive(new Request(FN_URL, { method: 'OPTIONS' }), t.deps)).status).toBe(204);
    expect((await t.call({ action: 'nope' })).status).toBe(400);
    expect((await handleFilesDrive(new Request(FN_URL, { method: 'DELETE' }), t.deps)).status).toBe(405);
    expect((await t.get('hello=1')).status).toBe(400);
  });
});

describe('the storage limit, replace (S4), move (S7) and the health check (S1)', () => {
  async function filed(t: ReturnType<typeof setup>, name = 'plan.pdf') {
    await t.connect();
    const s = await t.upload(name);
    t.bytesArrive(s, 'hello world!');
    return (await (await t.call({ action: 'upload_finish', uploadId: s.uploadId })).json()).file;
  }

  it('upload_session is refused BEFORE a session is opened when the organization limit would be exceeded', async () => {
    const t = setup();
    await t.connect();
    t.db.storage = { totalBytes: 900, limitMegabytes: 0.001 }; // about 1048 bytes
    const r = await t.call({ action: 'upload_session', scope: 'organization', name: 'a.bin', size: 500 });
    expect(r.status).toBe(413);
    expect(await r.json()).toMatchObject({ code: 'storageLimit' });
    expect(t.g.calls.some((c) => c.url.includes('uploadType=resumable'))).toBe(false);
    expect((await t.call({ action: 'upload_session', scope: 'organization', name: 'a.bin', size: 100 })).status).toBe(200);
  });

  it('replace: an UPDATE session on the same Drive file, the old revision is kept, the version goes up and the old one is in the history', async () => {
    const t = setup();
    const file = await filed(t);
    const fileId = file.rowJSON.googleDriveFileId;
    expect((await t.call({ action: 'replace_session', postGUID: file.rowGUID, size: 50 }, 'Bearer boris')).status).toBe(403);
    const s = await (await t.call({ action: 'replace_session', postGUID: file.rowGUID, name: 'plan-v2.pdf', mime: 'application/pdf', size: 50 }, 'Bearer anna', { Origin: 'https://app.test' })).json();
    expect(s.sessionUrl).toMatch(/session/);
    const sess = t.g.calls.filter((c) => c.url.includes('/upload/drive/v3/files/') && c.method === 'PATCH').pop()!;
    expect(sess.url).toContain(fileId);
    expect(sess.headers['origin']).toBe('https://app.test');
    expect(JSON.parse(sess.body!).properties.kit8Upload).toBe(s.uploadId);
    expect((await t.call({ action: 'replace_finish', uploadId: s.uploadId })).status).toBe(404); // the new bytes have not arrived
    t.g.items.get(fileId)!.properties.kit8Upload = s.uploadId; // Google applies the property when the upload completes
    t.g.items.get(fileId)!.size = '50';
    const done = await t.call({ action: 'replace_finish', uploadId: s.uploadId });
    expect(done.status).toBe(200);
    const { file: row } = await done.json();
    expect(row.rowJSON).toMatchObject({ fileVersionNumber: 2, fileSizeBytes: 50, fileName: 'plan-v2.pdf', googleDriveFileId: fileId });
    expect(t.g.state.keptRevisions).toEqual(['rev2']); // the old (head) revision is kept forever
    expect(t.db.versions).toEqual([{ post: file.rowGUID, version: 1, driveRevisionId: 'rev2', fileSizeBytes: 12 }]);
  });

  it('move: the Drive file goes to the folder of the target (made if needed) with the same id, then the row follows', async () => {
    const t = setup();
    const file = await filed(t);
    const fileId = file.rowJSON.googleDriveFileId;
    const before = t.g.items.get(fileId)!.parents[0];
    expect((await t.call({ action: 'move', postGUID: file.rowGUID, scope: 'project', guid: PROJECT }, 'Bearer boris')).status).toBe(403);
    const r = await t.call({ action: 'move', postGUID: file.rowGUID, scope: 'project', guid: PROJECT });
    expect(r.status).toBe(200);
    const { file: row } = await r.json();
    const newParent = t.g.items.get(fileId)!.parents[0];
    expect(newParent).not.toBe(before);
    expect(t.g.items.get(newParent)!.name).toBe('files');
    expect(row).toMatchObject({ rowParentGUID: PROJECT, rowJSON: { fileSourceKind: 'project', googleDriveFolderId: newParent, googleDriveRelativePath: `project/${PROJECT}/files`, googleDriveFileId: fileId } });
    expect(t.db.folders.get(`${ORG}|project:${PROJECT}`)).toMatchObject({ driveFilesFolderId: newParent });
  });

  it('move refuses a file that is not of this organization', async () => {
    const t = setup();
    const file = await filed(t);
    t.g.items.get(file.rowJSON.googleDriveFileId)!.properties.kit8OrganizationGUID = OTHER_ORG;
    expect((await t.call({ action: 'move', postGUID: file.rowGUID, scope: 'project', guid: PROJECT })).status).toBe(403);
  });

  it('the health check finds a row whose Drive file is gone and a Drive file that has no row; repair deletes the row and the orphan (ours only)', async () => {
    const t = setup();
    const kept = await filed(t, 'kept.pdf');
    const lost = await filed(t, 'lost.pdf');
    t.g.items.delete(lost.rowJSON.googleDriveFileId); // someone deleted it in Drive by hand
    const folderId = kept.rowJSON.googleDriveFolderId;
    const orphan = t.g.add({ name: 'orphan.txt', parents: [folderId], properties: { kit8OrganizationGUID: ORG } });
    const foreign = t.g.add({ name: 'theirs.txt', parents: [folderId], properties: { kit8OrganizationGUID: OTHER_ORG } });
    expect((await t.call({ action: 'health' }, 'Bearer boris')).status).toBe(403);
    const h = await (await t.call({ action: 'health' })).json();
    expect(h.missing).toEqual([{ post: lost.rowGUID, fileId: lost.rowJSON.googleDriveFileId, name: 'lost.pdf' }]);
    expect(h.orphans.map((o: any) => o.fileId).sort()).toEqual([foreign.id, orphan.id].sort());
    const rep = await (await t.call({ action: 'health_repair', missing: [lost.rowGUID], orphans: [orphan.id, foreign.id] })).json();
    expect(rep).toEqual({ rowsDeleted: 1, orphansDeleted: 1 });
    expect(t.db.files.has(lost.rowGUID)).toBe(false);
    expect(t.g.items.has(orphan.id)).toBe(false);
    expect(t.g.items.has(foreign.id)).toBe(true); // not ours: never deleted
    expect((await t.call({ action: 'health_repair', missing: [] }, 'Bearer boris')).status).toBe(403);
  });
});
