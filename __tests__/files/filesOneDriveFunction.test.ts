/** @jest-environment node */
// OD3 (documentation/FILE_WITH_OneDrive_WBS.html): the handler of files-drive with the OneDrive adapter and an in-memory Microsoft Graph. The organization has BOTH storages;
// a request is routed by the storage of the scope (files_authorize) or of the file row.
import { handleFilesDrive, scopeKeyFor, parseProvider, organizationKeys, type FilesDriveDeps, type ConnectionRow, type AuthResult } from '../../supabase/functions/files-drive/handler';
import { decryptToken } from '../../supabase/functions/files-drive/crypto';
import { createFakeGraph } from './filesGraphTestKit';
import { createFakeGoogle } from './filesDriveTestKit';

const KEY = Buffer.alloc(32, 7).toString('base64');
const ORG = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const TASK = '33333333-3333-4333-8333-333333333333';
const FN_URL = 'https://proj.supabase.co/functions/v1/files-drive';
const CHUNK = 5 * 1048576;

function setup(over: { microsoft?: boolean; provider?: string } = {}) {
  const g = createFakeGraph();
  const google = createFakeGoogle();
  // one fetch for everything: Microsoft hosts go to the Graph kit, the rest to the Google kit
  const fetchFn = (u: string, i?: RequestInit) => (/graph\.microsoft\.com|login\.microsoftonline\.com|upload\.test|dl\.test/.test(u) ? g.fetchFn(u, i) : google.fetchFn(u, i));
  const db = {
    conns: new Map<string, ConnectionRow>(), orgs: new Map<string, Record<string, any>>([[ORG, {}]]), pending: new Map<string, Record<string, any>>(), folders: new Map<string, Record<string, any>>(),
    files: new Map<string, { rowGUID: string; rowOwnerGUID: string; rowParentGUID: string; rowJSON: Record<string, any> }>(), cleanup: [] as any[], rpc: [] as { fn: string; args: any }[],
  };
  let seq = 0;
  const storageOfScope = { provider: over.provider ?? 'oneDrive' };
  const deps: FilesDriveDeps = {
    config: { clientId: 'gcid', clientSecret: 'gsec', functionUrl: FN_URL, appReturnUrl: 'https://app.test/user/files', tokenKey: KEY, urlSecret: 'url-secret', cleanupSecret: 'tick',
      microsoft: over.microsoft === false ? undefined : { clientId: 'mcid', clientSecret: 'msec', tenant: 'common', secretExpires: '2028-11-10' } },
    fetchFn: fetchFn as any,
    now: () => 1_800_000_000_000,
    authorize: async (_a: string, action: string, scope: string, guid?: string | null, project?: string | null): Promise<AuthResult> => ({ allowed: true, organizationGUID: ORG, userGUID: 'u1', projectGUID: scope === 'project' ? guid : project || null, scope, guid: guid || null, provider: action === 'connect' ? undefined : storageOfScope.provider }),
    callerRpc: async (_a: string, fn: string, args: Record<string, any>) => {
      db.rpc.push({ fn, args });
      if (fn === 'files_cleanup_counts') return { data: { waiting: 0, failed: 0 }, error: null };
      if (fn === 'files_get') { const r = db.files.get(args.p_post); return r ? { data: r, error: null } : { data: null, error: 'no such file' }; }
      if (fn === 'files_add') {
        const p = db.pending.get(args.p_upload_id)!;
        const prov = p.provider || 'googleDrive';
        const row = { rowGUID: `post${++seq}`, rowOwnerGUID: ORG, rowParentGUID: args.p_guid || ORG, rowJSON: { fileSourceKind: p.scope, fileStorageProvider: prov, ...(prov === 'oneDrive' ? { oneDriveItemId: p.fileId, oneDriveFolderId: p.folderId, oneDriveRelativePath: p.relativePath } : { googleDriveFileId: p.fileId, googleDriveFolderId: p.folderId }), fileName: p.name, fileSizeBytes: p.fileSize, mediaPostMIME: p.mime } };
        db.files.set(row.rowGUID, row); db.pending.delete(args.p_upload_id);
        return { data: row, error: null };
      }
      if (fn === 'files_replace') { const row = db.files.get(args.p_post)!; const p = db.pending.get(args.p_upload_id)!; row.rowJSON = { ...row.rowJSON, fileVersionNumber: 2, fileSizeBytes: p.fileSize }; db.pending.delete(args.p_upload_id); return { data: row, error: null }; }
      if (fn === 'files_move') { const row = db.files.get(args.p_post)!; row.rowJSON = { ...row.rowJSON, fileSourceKind: args.p_scope, oneDriveFolderId: args.p_folder_id, oneDriveRelativePath: args.p_relative_path }; return { data: row, error: null }; }
      if (fn === 'files_delete') { const r = db.files.get(args.p_post)!; db.files.delete(args.p_post); const id = r.rowJSON.oneDriveItemId || r.rowJSON.googleDriveFileId; db.cleanup.push({ id: `c${++seq}`, org: ORG, itemId: id, provider: r.rowJSON.fileStorageProvider || 'googleDrive', kind: 'file', state: 'waiting', allowRoot: false }); return { data: { deleted: true }, error: null }; }
      if (fn === 'files_health_rows') return { data: { files: [...db.files.values()].filter((r) => r.rowJSON.fileStorageProvider === (args.p_provider || 'googleDrive')).map((r) => ({ post: r.rowGUID, fileId: r.rowJSON.oneDriveItemId || r.rowJSON.googleDriveFileId, folderId: r.rowJSON.oneDriveFolderId, name: r.rowJSON.fileName })), folders: [...db.folders.values()].filter((f) => f.provider === args.p_provider).map((f) => ({ filesFolderId: f.driveFilesFolderId })) }, error: null };
      if (fn === 'files_delete_row_only') { db.files.delete(args.p_post); return { data: null, error: null }; }
      if (fn === 'files_storage_used') return { data: { totalBytes: 0 }, error: null };
      return { data: null, error: `unknown rpc ${fn}` };
    },
    serviceRpc: async (fn: string, args: Record<string, any>) => {
      db.rpc.push({ fn, args });
      const k = args.p_provider === 'oneDrive' ? organizationKeys('oneDrive') : organizationKeys('googleDrive');
      switch (fn) {
        case 'files_org_facts': { const o = db.orgs.get(args.p_org) || {}; return { rootFolderId: o[k.rootId], rootFolderUrl: o[k.rootUrl], accountEmail: o[k.email] }; }
        case 'files_folder_get': return db.folders.get(`${args.p_org}|${args.p_scope_key}`) || null;
        case 'files_folder_set': { const key = `${args.p_org}|${args.p_scope_key}`; if (!db.folders.has(key)) db.folders.set(key, args.p_json); return db.folders.get(key); }
        case 'files_upload_pending_add': db.pending.set(args.p_upload, { organizationGUID: args.p_org, userGUID: args.p_user, uploadId: args.p_upload, state: 'pending', ...args.p_json }); return null;
        case 'files_upload_pending_get': return db.pending.get(args.p_upload) || null;
        case 'files_upload_pending_verify': { const p = db.pending.get(args.p_upload)!; Object.assign(p, { state: 'verified', fileId: args.p_file_id, fileSize: args.p_size, folderId: args.p_folder_id, relativePath: args.p_path, webUrl: args.p_web_url }); return p; }
        case 'files_cleanup_pending': { const take = db.cleanup.filter((c) => c.state === 'waiting'); take.forEach((c) => { c.state = 'running'; }); return take.map((c) => ({ id: c.id, organizationGUID: c.org, driveItemId: c.itemId, itemKind: c.kind, provider: c.provider, allowRoot: c.allowRoot })); }
        case 'files_cleanup_done': db.cleanup.find((c) => c.id === args.p_id)!.state = 'done'; return null;
        case 'files_cleanup_failed': db.cleanup.find((c) => c.id === args.p_id)!.state = 'waiting'; return null;
        default: throw new Error(`unknown service rpc ${fn}`);
      }
    },
    loadConnection: async (org, provider) => db.conns.get(`${org}|${provider || 'googleDrive'}`) || null,
    saveConnection: async (org, patch, provider) => { const k = `${org}|${provider || 'googleDrive'}`; db.conns.set(k, { ...(db.conns.get(k) || {}), ...patch }); },
    deleteConnection: async (org, provider) => { db.conns.delete(`${org}|${provider || 'googleDrive'}`); },
    patchOrganization: async (org, patch) => { db.orgs.set(org, { ...(db.orgs.get(org) || {}), ...patch }); },
  };
  const call = (body: Record<string, any>, extra: Record<string, string> = {}) => handleFilesDrive(new Request(FN_URL, { method: 'POST', headers: { Authorization: 'Bearer anna', 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) }), deps);
  const get = (qs: string, headers: Record<string, string> = {}) => handleFilesDrive(new Request(`${FN_URL}?${qs}`, { method: 'GET', headers }), deps);
  const connect = async (provider = 'oneDrive') => {
    const start = await (await call({ action: 'connect_start', provider })).json();
    return get(`code=GOOD&state=${encodeURIComponent(new URL(start.url).searchParams.get('state')!)}`);
  };
  /** the browser side: fragments straight to the upload url (no token), returns the answer of the last one */
  const browserPut = async (url: string, total: number) => {
    let last: Response | null = null;
    for (let s = 0; s < total; s += CHUNK) { const e = Math.min(s + CHUNK, total); last = await g.fetchFn(url, { method: 'PUT', headers: { 'Content-Range': `bytes ${s}-${e - 1}/${total}` }, body: 'x'.repeat(e - s) }); }
    return last!.json();
  };
  return { g, google, db, deps, call, get, connect, browserPut, storageOfScope };
}

describe('provider helpers', () => {
  it('an unknown or missing provider is Google Drive; the OneDrive keys of the organization row and of the folder table are apart from Google\'s', () => {
    expect(parseProvider(undefined)).toBe('googleDrive');
    expect(parseProvider('nonsense')).toBe('googleDrive');
    expect(parseProvider('oneDrive')).toBe('oneDrive');
    expect(scopeKeyFor('task', 'T')).toBe('task:T');
    expect(scopeKeyFor('task', 'T', 'oneDrive')).toBe('oneDrive:task:T');
    expect(scopeKeyFor('organization', '', 'oneDrive')).toBe('oneDrive:organization');
    expect(organizationKeys('oneDrive').state).toBe('organizationOneDriveState');
    expect(organizationKeys('googleDrive').state).toBe('organizationGoogleDriveState');
  });
});

describe('connect Microsoft OneDrive', () => {
  it('connect_start sends the administrator to the Microsoft consent page with the state naming the storage; not configured = 409 providerNotConfigured', async () => {
    const t = setup();
    const r = await (await t.call({ action: 'connect_start', provider: 'oneDrive' })).json();
    const u = new URL(r.url);
    expect(u.origin + u.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(u.searchParams.get('client_id')).toBe('mcid');
    expect(u.searchParams.get('redirect_uri')).toBe(FN_URL);
    const off = setup({ microsoft: false });
    const res = await off.call({ action: 'connect_start', provider: 'oneDrive' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'providerNotConfigured', error: 'Microsoft OneDrive is not configured on this server.' });
  });
  it('the consent comes back: the refresh token is stored ENCRYPTED in the OneDrive connection, kit8root is made, the organization row shows it; Google is untouched', async () => {
    const t = setup();
    const back = await t.connect();
    expect(back.status).toBe(302);
    expect(new URL(back.headers.get('Location')!).searchParams.get('filesConnect')).toBe('ok');
    const conn = t.db.conns.get(`${ORG}|oneDrive`)!;
    expect(conn).toMatchObject({ state: 'ok', accountEmail: 'owner@outlook.test' });
    expect(conn.refreshTokenEncrypted).not.toContain('REFRESH');
    expect(await decryptToken(conn.refreshTokenEncrypted!, KEY)).toBe('MS-REFRESH-1');
    expect(t.db.conns.has(`${ORG}|googleDrive`)).toBe(false);
    const o = t.db.orgs.get(ORG)!;
    expect(o).toMatchObject({ organizationOneDriveState: 'ok', organizationOneDriveAccountEmail: 'owner@outlook.test', organizationOneDriveMode: 'adminProxy' });
    expect(o.organizationOneDriveRootFolderId).toBeTruthy();
    expect(o.organizationOneDriveRootFolderUrl).toMatch(/^https:\/\/onedrive\.test\//);
    expect(o.organizationGoogleDriveState).toBeUndefined();
    expect([...t.g.items.values()].filter((i) => i.name === 'kit8root')).toHaveLength(1);
    await t.connect(); // a reconnect never makes a second root
    expect([...t.g.items.values()].filter((i) => i.name === 'kit8root')).toHaveLength(1);
  });
  it('a refused consent shows its reason and stores nothing', async () => {
    const t = setup();
    const start = await (await t.call({ action: 'connect_start', provider: 'oneDrive' })).json();
    const state = encodeURIComponent(new URL(start.url).searchParams.get('state')!);
    const back = await t.get(`code=BAD&state=${state}`);
    expect(new URL(back.headers.get('Location')!).searchParams.get('filesConnect')).toBe('error');
    expect(t.db.conns.size).toBe(0);
  });
  it('a consent that Microsoft answers with an error: its explanation (first line) and the storage reach the return page', async () => {
    const t = setup();
    const start = await (await t.call({ action: 'connect_start', provider: 'oneDrive' })).json();
    const state = encodeURIComponent(new URL(start.url).searchParams.get('state')!);
    const back = await t.get(`error=server_error&error_description=AADSTS500000%3A+Something+went+wrong.%0D%0ATrace+ID%3A+abc&state=${state}`);
    const to = new URL(back.headers.get('Location')!);
    expect(to.searchParams.get('filesConnect')).toBe('error');
    expect(to.searchParams.get('provider')).toBe('oneDrive');
    expect(to.searchParams.get('reason')).toBe('server_error: AADSTS500000: Something went wrong.');
    // without a readable state the page says Google Drive (the old default) and still gets the error code
    const bare = new URL((await t.get('error=access_denied')).headers.get('Location')!);
    expect(bare.searchParams.has('provider')).toBe(false); // a Google return url is unchanged
    expect(bare.searchParams.get('reason')).toBe('access_denied');
  });
  it('status of one storage, and "all" = both in one answer with the Microsoft secret expiry', async () => {
    const t = setup();
    const all = await (await t.call({ action: 'status', provider: 'all' })).json();
    expect(all.oneDrive).toMatchObject({ provider: 'oneDrive', state: 'notConnected', providerConfigured: true, secretExpires: '2028-11-10' });
    expect(all.googleDrive).toMatchObject({ provider: 'googleDrive', state: 'notConnected', secretExpires: null });
    await t.connect();
    expect(await (await t.call({ action: 'status', provider: 'oneDrive' })).json()).toMatchObject({ state: 'ok', accountEmail: 'owner@outlook.test' });
    expect((await (await setup({ microsoft: false }).call({ action: 'status', provider: 'oneDrive' })).json()).providerConfigured).toBe(false);
  });
  it('the rotating refresh token is stored after every refresh; a revoked grant = needsReconnect on the OneDrive connection and organization row', async () => {
    const t = setup();
    await t.connect();
    t.deps.now = () => 1_800_000_000_000 + 2 * 3600 * 1000; // the access token of the consent has expired: the next call refreshes
    const r = await t.call({ action: 'upload_session', scope: 'organization', name: 'a.txt', mime: 'text/plain', size: 1 });
    expect(r.status).toBe(200);
    expect(await decryptToken(t.db.conns.get(`${ORG}|oneDrive`)!.refreshTokenEncrypted!, KEY)).toBe('MS-REFRESH-2');
    t.g.state.refreshFails = 'invalid_grant';
    t.deps.now = () => 1_800_000_000_000 + 5 * 3600 * 1000;
    const bad = await t.call({ action: 'upload_session', scope: 'organization', name: 'a.txt', mime: 'text/plain', size: 1 });
    expect(bad.status).toBe(409);
    expect(await bad.json()).toMatchObject({ code: 'needsReconnect' });
    expect(t.db.conns.get(`${ORG}|oneDrive`)!.state).toBe('needsReconnect');
    expect(t.db.orgs.get(ORG)!.organizationOneDriveState).toBe('needsReconnect');
  });
  it('disconnect forgets the OneDrive token only', async () => {
    const t = setup();
    await t.connect();
    await t.connect('googleDrive');
    expect(t.db.conns.size).toBe(2);
    expect(await (await t.call({ action: 'disconnect', provider: 'oneDrive' })).json()).toEqual({ disconnected: true });
    expect([...t.db.conns.keys()]).toEqual([`${ORG}|googleDrive`]);
    expect(t.db.orgs.get(ORG)!.organizationOneDriveState).toBe('notConnected');
    expect(t.db.orgs.get(ORG)!.organizationGoogleDriveState).toBe('ok');
  });
});

describe('upload, finish, view, replace, move, delete on OneDrive', () => {
  async function uploaded(size = CHUNK + 50) {
    const t = setup();
    await t.connect();
    const s = await (await t.call({ action: 'upload_session', scope: 'task', guid: TASK, projectGUID: PROJECT, name: 'plan.pdf', mime: 'application/pdf', size })).json();
    const last = await t.browserPut(s.sessionUrl, size);
    const fin = await (await t.call({ action: 'upload_finish', uploadId: s.uploadId, itemId: last.id, file: { title: 'plan.pdf' } })).json();
    return { t, s, last, fin, size };
  }
  it('the folders are made under kit8root with the OneDrive scope key; the session url is Microsoft\'s and takes no token; the pending row names the storage', async () => {
    const t = setup();
    await t.connect();
    const s = await (await t.call({ action: 'upload_session', scope: 'task', guid: TASK, projectGUID: PROJECT, name: 'plan.pdf', mime: 'application/pdf', size: 10 })).json();
    expect(s.sessionUrl).toMatch(/^https:\/\/upload\.test\/up\//);
    expect(s.path).toBe(`project/${PROJECT}/task/${TASK}/files`);
    expect(t.db.folders.has(`${ORG}|oneDrive:task:${TASK}`)).toBe(true);
    expect(t.db.folders.has(`${ORG}|task:${TASK}`)).toBe(false);
    expect(t.db.pending.get(s.uploadId)).toMatchObject({ provider: 'oneDrive', scope: 'task', name: 'plan.pdf' });
    expect([...t.g.items.values()].find((i) => i.name === 'files')!.parent).not.toBe('ROOT');
  });
  it('finish by the item id the browser read from the last answer: verified (folder + size), registered with the web url; the row is a OneDrive row', async () => {
    const { t, last, fin, size } = await uploaded();
    expect(fin.file.rowJSON).toMatchObject({ fileStorageProvider: 'oneDrive', oneDriveItemId: last.id, fileSizeBytes: size, mediaPostMIME: 'application/pdf' });
    const verify = t.db.rpc.find((r) => r.fn === 'files_upload_pending_verify')!.args;
    expect(verify).toMatchObject({ p_file_id: last.id, p_size: size, p_web_url: expect.stringMatching(/^https:\/\/onedrive\.test\//) });
  });
  it('finish with a lost answer (no item id) falls back to the newest file of the declared size; a file of another size is "not finished" (404)', async () => {
    const t = setup();
    await t.connect();
    const s = await (await t.call({ action: 'upload_session', scope: 'organization', name: 'a.bin', mime: 'application/octet-stream', size: 40 })).json();
    expect((await t.call({ action: 'upload_finish', uploadId: s.uploadId })).status).toBe(404);
    await t.browserPut(s.sessionUrl, 40);
    expect((await t.call({ action: 'upload_finish', uploadId: s.uploadId })).status).toBe(200);
  });
  it('a file outside kit8root is never registered, even with its id (the place is the mark): 404 for a wrong folder / size, 403 when it is not under kit8root', async () => {
    const t = setup();
    await t.connect();
    const s = await (await t.call({ action: 'upload_session', scope: 'organization', name: 'a.bin', mime: 'application/octet-stream', size: 7 })).json();
    const folder = t.db.pending.get(s.uploadId)!.folderId;
    const stray = t.g.put('ROOT', 'secret.bin', '1234567'); // right size, wrong place: the id of a private file of the account
    expect((await t.call({ action: 'upload_finish', uploadId: s.uploadId, itemId: stray.id })).status).toBe(404);
    const inFolder = t.g.put(folder, 'ok.bin', '1234567');
    expect((await t.call({ action: 'upload_finish', uploadId: s.uploadId, itemId: inFolder.id })).status).toBe(200);
  });
  it('view: the signed link names the storage and the content type; Range gives 206; a generic type is replaced by the row\'s image / pdf type; a Google link is still signed the old way', async () => {
    const { t, fin } = await uploaded();
    const r = await (await t.call({ action: 'download_url', postGUID: fin.file.rowGUID })).json();
    const u = new URL(r.url);
    expect(u.searchParams.get('prov')).toBe('oneDrive');
    expect(u.searchParams.get('ct')).toBe('application/pdf');
    const whole = await t.get(u.searchParams.toString());
    expect(whole.status).toBe(200);
    expect(whole.headers.get('content-type')).toBe('application/pdf'); // OneDrive said application/octet-stream
    expect(whole.headers.get('content-disposition')).toBe('inline');
    const part = await t.get(u.searchParams.toString(), { Range: 'bytes=0-3' });
    expect(part.status).toBe(206);
    expect(await part.text()).toBe('xxxx');
    const forged = new URLSearchParams(u.searchParams.toString()); forged.set('ct', 'text/html');
    expect((await t.get(forged.toString())).status).toBe(403); // the content type is signed
    const noProv = new URLSearchParams(u.searchParams.toString()); noProv.delete('prov');
    expect((await t.get(noProv.toString())).status).toBe(403);
  });
  it('replace: an update session on the same item, finish by the version tag and size, the row gets version 2; no new bytes = "not finished"', async () => {
    const { t, fin } = await uploaded(10);
    const post = fin.file.rowGUID;
    const s = await (await t.call({ action: 'replace_session', postGUID: post, name: 'plan.pdf', mime: 'application/pdf', size: 20 })).json();
    expect((await t.call({ action: 'replace_finish', uploadId: s.uploadId })).status).toBe(404);
    await t.browserPut(s.sessionUrl, 20);
    const done = await t.call({ action: 'replace_finish', uploadId: s.uploadId });
    expect(done.status).toBe(200);
    expect(t.db.files.get(post)!.rowJSON).toMatchObject({ fileVersionNumber: 2, fileSizeBytes: 20 });
    expect(t.db.pending.get(s.uploadId)).toBeUndefined();
  });
  it('move: the target folder is made in the FILE\'s storage and the item moves (the id stays)', async () => {
    const { t, fin, last } = await uploaded(10);
    const r = await t.call({ action: 'move', postGUID: fin.file.rowGUID, scope: 'organization' });
    expect(r.status).toBe(200);
    const row = t.db.files.get(fin.file.rowGUID)!;
    expect(row.rowJSON.oneDriveFolderId).toBe(t.db.folders.get(`${ORG}|oneDrive:organization`)!.driveFilesFolderId);
    expect(t.g.items.get(last.id)!.parent).toBe(row.rowJSON.oneDriveFolderId);
  });
  it('delete: the row goes, the queue line knows its storage, the cleanup permanently deletes the OneDrive item (one call) and a folder with content in ONE call', async () => {
    const { t, fin, last } = await uploaded(10);
    const r = await (await t.call({ action: 'delete_file', postGUID: fin.file.rowGUID })).json();
    expect(r.cleanup).toMatchObject({ done: 1, failed: 0 });
    expect(t.db.cleanup[0]).toMatchObject({ provider: 'oneDrive', state: 'done' });
    expect(t.g.items.has(last.id)).toBe(false);
    const folder = [...t.g.items.values()].find((i) => i.name === 'files')!;
    t.g.put(folder.id, 'x', '1');
    t.db.cleanup.push({ id: 'cf', org: ORG, itemId: t.db.folders.get(`${ORG}|oneDrive:task:${TASK}`)!.driveFolderId, provider: 'oneDrive', kind: 'folder', state: 'waiting', allowRoot: false });
    const before = t.g.calls.filter((c) => c.url.includes('permanentDelete')).length;
    expect((await (await t.call({ action: 'cleanup' })).json())).toMatchObject({ done: 1 });
    expect(t.g.calls.filter((c) => c.url.includes('permanentDelete')).length - before).toBe(1);
  });
  it('health: only the OneDrive rows and folders are compared with OneDrive; repair removes a row whose item is gone and an orphan that lies under kit8root', async () => {
    const { t, fin, last } = await uploaded(10);
    const folderId = fin.file.rowJSON.oneDriveFolderId;
    t.g.put(folderId, 'orphan.bin', 'zz');
    t.g.items.delete(last.id); // the item vanished from OneDrive
    const h = await (await t.call({ action: 'health', provider: 'oneDrive' })).json();
    expect(h.missing.map((m: any) => m.post)).toEqual([fin.file.rowGUID]);
    expect(h.orphans.map((o: any) => o.name)).toEqual(['orphan.bin']);
    const fix = await (await t.call({ action: 'health_repair', provider: 'oneDrive', missing: h.missing.map((m: any) => m.post), orphans: h.orphans.map((o: any) => o.fileId) })).json();
    expect(fix).toEqual({ rowsDeleted: 1, orphansDeleted: 1 });
    expect(t.db.files.size).toBe(0);
  });
  it('a Google project and a OneDrive project side by side: the scope decides, the Google flow is not touched', async () => {
    const t = setup();
    await t.connect('oneDrive');
    await t.connect('googleDrive');
    t.storageOfScope.provider = 'googleDrive';
    const gs = await (await t.call({ action: 'upload_session', scope: 'organization', name: 'g.txt', mime: 'text/plain', size: 3 })).json();
    expect(gs.sessionUrl).toMatch(/googleapis|google/);
    expect(t.db.pending.get(gs.uploadId)!.provider).toBe('googleDrive');
    t.storageOfScope.provider = 'oneDrive';
    const os = await (await t.call({ action: 'upload_session', scope: 'organization', name: 'o.txt', mime: 'text/plain', size: 3 })).json();
    expect(os.sessionUrl).toMatch(/^https:\/\/upload\.test/);
    expect(t.db.pending.get(os.uploadId)!.provider).toBe('oneDrive');
    expect([...t.db.folders.keys()].sort()).toEqual([`${ORG}|oneDrive:organization`, `${ORG}|organization`].sort());
  });
  it('an unconnected OneDrive says so with the storage\'s name (409 notConnected) and Google is not asked', async () => {
    const t = setup();
    const r = await t.call({ action: 'upload_session', scope: 'organization', name: 'a.txt', mime: 'text/plain', size: 1 });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ code: 'notConnected', error: 'Microsoft OneDrive is not connected.' });
  });
});
