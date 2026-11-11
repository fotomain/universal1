/** @jest-environment node */
// OD2 (documentation/FILE_WITH_OneDrive_WBS.html): the Microsoft OneDrive adapter against an in-memory Graph that enforces what the spike OD0 proved.
import { createOneDriveProvider, oneDriveName, MS_SCOPE } from '../../supabase/functions/files-drive/oneDriveProvider';
import { StorageError } from '../../supabase/functions/files-drive/provider';
import { createFakeGraph } from './filesGraphTestKit';

const CHUNK = 5 * 1048576;
const setup = () => {
  const g = createFakeGraph();
  const sleeps: number[] = [];
  const p = createOneDriveProvider(g.fetchFn, { sleep: async (ms) => { sleeps.push(ms); } });
  return { g, p, sleeps };
};
/** the whole browser side of an upload: fragments to the upload url (NO Authorization header), returns the last answer */
async function put(g: ReturnType<typeof createFakeGraph>, url: string, total: number): Promise<any> {
  let last: Response | null = null;
  for (let start = 0; start < total; start += CHUNK) {
    const end = Math.min(start + CHUNK, total);
    last = await g.fetchFn(url, { method: 'PUT', headers: { 'Content-Range': `bytes ${start}-${end - 1}/${total}` }, body: 'x'.repeat(end - start) });
    if (!last.ok) return { status: last.status, json: await last.json() };
  }
  return { status: last!.status, json: await last!.json() };
}

describe('names OneDrive accepts', () => {
  it('replaces / \\ * < > ? : | # % and control characters, a leading ~ and a trailing dot or space; never empty; at most 200', () => {
    expect(oneDriveName('a/b\\c*d<e>f?g:h|i#j%k.txt')).toBe('a_b_c_d_e_f_g_h_i_j_k.txt');
    expect(oneDriveName('~lead.txt')).toBe('_lead.txt');
    expect(oneDriveName('trail.')).toBe('trail');
    expect(oneDriveName('  ')).toBe('file');
    expect(oneDriveName('x'.repeat(300))).toHaveLength(200);
    expect(oneDriveName('plan with spaces ü é.txt')).toBe('plan with spaces ü é.txt');
  });
});

describe('sign-in and tokens', () => {
  it('builds the v2 consent url: tenant, scope offline_access Files.ReadWrite User.Read, account picker, the state', () => {
    const p = createOneDriveProvider(jest.fn() as any, { tenant: 'organizations' });
    expect(p.id).toBe('oneDrive');
    expect(p.title).toBe('Microsoft OneDrive');
    const u = new URL(p.authUrl({ clientId: 'cid', redirectUri: 'https://fn.test/files-drive', state: 'ST' }));
    expect(u.origin + u.pathname).toBe('https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize');
    expect(Object.fromEntries(u.searchParams)).toEqual({ client_id: 'cid', response_type: 'code', redirect_uri: 'https://fn.test/files-drive', response_mode: 'query', scope: MS_SCOPE, state: 'ST', prompt: 'select_account' });
    expect(new URL(createOneDriveProvider(jest.fn() as any).authUrl({ clientId: 'c', redirectUri: 'r', state: 's' })).pathname).toBe('/common/oauth2/v2.0/authorize');
  });
  it('exchangeCode: tokens; no refresh token and a missing permission are refused in words; an error keeps only its first line', async () => {
    const { g, p } = setup();
    const a = { code: 'C', clientId: 'cid', clientSecret: 'sec', redirectUri: 'r' };
    expect(await p.exchangeCode(a)).toMatchObject({ ok: true, accessToken: 'MS-ACCESS-1', refreshToken: 'MS-REFRESH-1', expiresInSeconds: 3599 });
    const body = new URLSearchParams(g.calls[0].body!);
    expect(Object.fromEntries(body)).toEqual({ grant_type: 'authorization_code', code: 'C', client_id: 'cid', client_secret: 'sec', redirect_uri: 'r', scope: MS_SCOPE });
    g.state.noRefreshTokenOnCode = true;
    expect(await p.exchangeCode(a)).toEqual({ ok: false, error: 'Microsoft sent no refresh token (the offline_access permission was not granted)' });
    g.state.noRefreshTokenOnCode = false; g.state.scope = 'User.Read';
    expect(await p.exchangeCode(a)).toEqual({ ok: false, error: 'the Files.ReadWrite permission was not granted' });
    expect(await p.exchangeCode({ ...a, code: 'BAD' })).toEqual({ ok: false, error: 'invalid_grant' });
  });
  it('refresh: the refresh token ROTATES (a new one comes back, the old one stops working); invalid_grant = revoked; a wrong or expired client secret is NOT a reconnect', async () => {
    const { g, p } = setup();
    await p.exchangeCode({ code: 'C', clientId: 'cid', clientSecret: 's', redirectUri: 'r' });
    const a = { clientId: 'cid', clientSecret: 's' };
    const r1 = await p.refresh({ ...a, refreshToken: 'MS-REFRESH-1' });
    expect(r1).toMatchObject({ ok: true, accessToken: 'MS-ACCESS-2', refreshToken: 'MS-REFRESH-2', expiresInSeconds: 3599 });
    expect(await p.refresh({ ...a, refreshToken: 'MS-REFRESH-1' })).toMatchObject({ ok: false, revoked: true, error: 'AADSTS70008: expired' });
    expect(await p.refresh({ ...a, refreshToken: 'MS-REFRESH-2' })).toMatchObject({ ok: true, refreshToken: 'MS-REFRESH-3' });
    g.state.refreshFails = 'invalid_client';
    expect(await p.refresh({ ...a, refreshToken: 'MS-REFRESH-3' })).toEqual({ ok: false, revoked: false, error: 'AADSTS7000222: The provided client secret keys are expired.', status: 401 });
  });
  it('accountEmail reads /me; revoke does nothing and never throws', async () => {
    const { p } = setup();
    expect(await p.accountEmail('T')).toBe('owner@outlook.test');
    await expect(p.revoke('x')).resolves.toBeUndefined();
  });
});

describe('root, folders, items, ownership', () => {
  it('kit8root: found again (never a second one), made the first time; everything below it is "ours", anything else is not', async () => {
    const { g, p } = setup();
    const root = await p.ensureRoot('T', 'org');
    expect(root).toMatchObject({ isFolder: true, markedOrganization: '*', name: 'kit8root' });
    expect((await p.ensureRoot('T', 'org')).id).toBe(root.id);
    expect([...g.items.values()].filter((i) => i.name === 'kit8root')).toHaveLength(1);
    const f = await p.ensureFolder('T', root.id, { name: 'organization', description: '', marks: {} });
    expect(f.created).toBe(true);
    expect((await p.ensureFolder('T', root.id, { name: 'organization', description: '', marks: {} })).created).toBe(false);
    const inside = g.put(f.id, 'a.txt', 'abc');
    const outside = g.put('ROOT', 'private.txt', 'secret');
    expect(p.isOurs(await p.getItem('T', inside.id), 'org')).toBe(true);
    expect(p.isOurs(await p.getItem('T', outside.id), 'org')).toBe(false); // spike: Files.ReadWrite reaches the whole drive - the check is the PLACE
    expect(await p.getItem('T', inside.id)).toMatchObject({ isFolder: false, size: 3, parentId: f.id, name: 'a.txt' });
  });
  it('a missing item is a StorageError 404; listChildren lists files and folders of one folder', async () => {
    const { g, p } = setup();
    const root = await p.ensureRoot('T', 'org');
    await expect(p.getItem('T', 'NOPE')).rejects.toMatchObject({ status: 404 });
    g.put(root.id, 'one.txt', '1'); g.folder(root.id, 'sub');
    const kids = await p.listChildren('T', root.id);
    expect(kids.map((k) => [k.name, k.isFolder, k.parentId])).toEqual([['one.txt', false, root.id], ['sub', true, root.id]]);
  });
});

describe('upload, finish, replace, download, move, delete', () => {
  async function folderWithFile(size = CHUNK + 100) {
    const { g, p, sleeps } = setup();
    const root = await p.ensureRoot('T', 'org');
    const folder = (await p.ensureFolder('T', root.id, { name: 'files', description: '', marks: {} })).id;
    const url = await p.openUploadSession('T', { name: 'plan#1.pdf', folderId: folder, mime: 'application/pdf', size, uploadId: 'U1', organization: 'org' });
    return { g, p, sleeps, folder, url, size };
  }
  it('the session url takes fragments with NO Authorization header; 5 MiB then the rest; the last answer carries the driveItem', async () => {
    const { g, p, url, size, folder } = await folderWithFile();
    expect(url).toMatch(/^https:\/\/upload\.test\/up\//);
    expect((await g.fetchFn(url, { method: 'PUT', headers: { Authorization: 'Bearer T', 'Content-Range': `bytes 0-${CHUNK - 1}/${size}` }, body: 'x' })).status).toBe(401);
    const r = await put(g, url, size);
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ name: 'plan_1.pdf', size });
    expect(await p.findUploaded('T', { uploadId: 'U1', itemId: r.json.id, folderId: folder, name: 'plan#1.pdf', size })).toMatchObject({ id: r.json.id, size, parentId: folder });
  });
  it('findUploaded by item id is checked against the recorded folder and size; without an id it takes the newest file of that size', async () => {
    const { g, p, url, size, folder } = await folderWithFile();
    const r = await put(g, url, size);
    expect(await p.findUploaded('T', { uploadId: 'U1', itemId: r.json.id, folderId: 'OTHER', name: 'x', size })).toBeNull();
    expect(await p.findUploaded('T', { uploadId: 'U1', itemId: r.json.id, folderId: folder, name: 'x', size: size + 1 })).toBeNull();
    expect(await p.findUploaded('T', { uploadId: 'U1', itemId: 'NOPE', folderId: folder, name: 'x', size })).toBeNull();
    expect((await p.findUploaded('T', { uploadId: 'U1', folderId: folder, name: 'x', size }))!.id).toBe(r.json.id); // the lost-answer fallback
    expect(await p.findUploaded('T', { uploadId: 'U1', folderId: folder, name: 'x', size: 5 })).toBeNull();
  });
  it('a second file with the same name is renamed by OneDrive (conflictBehavior rename), never refused', async () => {
    const { g, p, folder } = await folderWithFile(10);
    const a = await put(g, await p.openUploadSession('T', { name: 'dup.txt', folderId: folder, mime: 't', size: 10, uploadId: 'a', organization: 'o' }), 10);
    const b = await put(g, await p.openUploadSession('T', { name: 'dup.txt', folderId: folder, mime: 't', size: 10, uploadId: 'b', organization: 'o' }), 10);
    expect([a.json.name, b.json.name]).toEqual(['dup.txt', 'dup 1.txt']);
  });
  it('replace: an update session on the same item makes a new version; isUpdateDone sees the new tag and size; versions are oldest first', async () => {
    const { g, p, folder } = await folderWithFile(10);
    const first = await put(g, await p.openUploadSession('T', { name: 'v.txt', folderId: folder, mime: 't', size: 10, uploadId: 'a', organization: 'o' }), 10);
    const before = await p.getItem('T', first.json.id);
    expect(p.isUpdateDone(before, { uploadId: 'u2', oldVersionTag: before.versionTag, size: 20 })).toBe(false);
    const url = await p.openUpdateSession('T', first.json.id, { mime: 't', size: 20, uploadId: 'u2' });
    expect((await put(g, url, 20)).status).toBe(201);
    const after = await p.getItem('T', first.json.id);
    expect(after.id).toBe(first.json.id);
    expect(after.size).toBe(20);
    expect(p.isUpdateDone(after, { uploadId: 'u2', oldVersionTag: before.versionTag, size: 20 })).toBe(true);
    expect(p.isUpdateDone(after, { uploadId: 'u2', oldVersionTag: before.versionTag, size: 21 })).toBe(false);
    expect(await p.versions('T', first.json.id)).toEqual(['1.0', '2.0']);
    await expect(p.keepVersion('T', first.json.id, '1.0')).resolves.toBeUndefined();
  });
  it('download: the pre-authenticated url is read WITHOUT Authorization and with the Range of the browser (206); a missing item passes its 404 on', async () => {
    const { g, p, folder } = await folderWithFile(10);
    const it = g.put(folder, 'd.txt', '0123456789');
    const whole = await p.openMedia('T', it.id);
    expect(whole.status).toBe(200);
    expect(await whole.text()).toBe('0123456789');
    const part = await p.openMedia('T', it.id, 'bytes=2-4');
    expect(part.status).toBe(206);
    expect(await part.text()).toBe('234');
    expect(g.calls.filter((c) => c.url.startsWith('https://dl.test')).every((c) => c.auth === false)).toBe(true);
    expect((await p.openMedia('T', 'NOPE')).status).toBe(404);
  });
  it('move changes the parent (the id stays); delete is permanent and "gone" for a missing item; deleteTree takes a folder with content in ONE call', async () => {
    const { g, p, folder } = await folderWithFile(10);
    const root = await p.ensureRoot('T', 'org');
    const other = (await p.ensureFolder('T', root.id, { name: 'other', description: '', marks: {} })).id;
    const it = g.put(folder, 'm.txt', 'abc');
    await p.moveItem('T', it.id, other, folder);
    expect((await p.getItem('T', it.id)).parentId).toBe(other);
    expect(await p.deleteItem('T', it.id)).toBe('deleted');
    expect(await p.deleteItem('T', it.id)).toBe('gone');
    g.put(other, 'a', '1'); const sub = g.folder(other, 'sub'); g.put(sub.id, 'b', '2');
    const before = g.calls.filter((c) => c.url.includes('permanentDelete')).length;
    expect(await p.deleteTree('T', other)).toEqual({ files: 0, folders: 1 });
    expect(g.calls.filter((c) => c.url.includes('permanentDelete')).length - before).toBe(1);
    expect([...g.items.values()].some((i) => i.parent === other || i.id === other || i.parent === sub.id)).toBe(false);
  });
});

describe('errors and throttling', () => {
  it('429 with Retry-After is waited for (twice), then the call goes through; a third 429 is an error the caller sees', async () => {
    const { g, p, sleeps } = setup();
    g.state.throttle = 2;
    expect((await p.ensureRoot('T', 'org')).name).toBe('kit8root');
    expect(sleeps).toEqual([1000, 1000]);
    g.state.throttle = 3;
    await expect(p.getItem('T', 'x')).rejects.toMatchObject({ status: 429 });
  });
  it('a Retry-After longer than the limit is not waited for', async () => {
    const g = createFakeGraph();
    const sleeps: number[] = [];
    const p = createOneDriveProvider(g.fetchFn, { sleep: async (ms) => { sleeps.push(ms); }, maxWaitMs: 500 });
    g.state.throttle = 1;
    await expect(p.getItem('T', 'x')).rejects.toBeInstanceOf(StorageError);
    expect(sleeps).toEqual([]);
  });
  it('a refused token is a StorageError 401 (the handler refreshes once and retries)', async () => {
    const g = createFakeGraph();
    const p = createOneDriveProvider(((u: string, i: any) => g.fetchFn(u, { ...i, headers: {} })) as any);
    await expect(p.accountEmail('T')).rejects.toMatchObject({ status: 401 });
  });
});
