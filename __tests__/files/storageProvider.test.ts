/** @jest-environment node */
// OD1 (documentation/FILE_WITH_OneDrive_WBS.html): the handler and the token cache talk ONLY to the StorageProvider interface; the Google adapter is the old code behind it.
// The big behaviour suite (filesDriveFunction.test.ts) runs the handler through this adapter unchanged; this file tests the seams: the adapter's own rules and a stub provider.
import { createGoogleProvider } from '../../supabase/functions/files-drive/googleProvider';
import { StorageError, type StorageProvider, type StorageItem } from '../../supabase/functions/files-drive/provider';
import { createTokenProvider, NeedsReconnectError } from '../../supabase/functions/files-drive/token';
import { handleFilesDrive, type FilesDriveDeps } from '../../supabase/functions/files-drive/handler';
import { encryptToken, decryptToken } from '../../supabase/functions/files-drive/crypto';
import { createFakeGoogle } from './filesDriveTestKit';

const KEY = Buffer.from(new Uint8Array(32).map((_, i) => i + 1)).toString('base64');
const ORG = 'org-1';
const resp = (status: number, body: any) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('the Google adapter (provider.ts interface)', () => {
  it('identifies itself and builds the consent url with drive.file only, offline access and the state', () => {
    const p = createGoogleProvider(jest.fn() as any);
    expect(p.id).toBe('googleDrive');
    expect(p.title).toBe('Google Drive');
    const u = new URL(p.authUrl({ clientId: 'cid', redirectUri: 'https://fn.test/files-drive', state: 'ST' }));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(u.searchParams)).toEqual({ client_id: 'cid', redirect_uri: 'https://fn.test/files-drive', response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', state: 'ST' });
  });
  it('exchangeCode: tokens on success; a missing refresh token and a missing scope are refused in words', async () => {
    const mk = (body: any, status = 200) => createGoogleProvider((async () => resp(status, body)) as any);
    const args = { code: 'c', clientId: 'a', clientSecret: 'b', redirectUri: 'r' };
    expect(await mk({ access_token: 'A', refresh_token: 'R', expires_in: 3599, scope: 'https://www.googleapis.com/auth/drive.file' }).exchangeCode(args)).toMatchObject({ ok: true, accessToken: 'A', refreshToken: 'R', expiresInSeconds: 3599 });
    expect(await mk({ access_token: 'A', scope: 'drive.file' }).exchangeCode(args)).toEqual({ ok: false, error: 'Google sent no refresh token - remove the app at myaccount.google.com/permissions and connect again' });
    expect(await mk({ access_token: 'A', refresh_token: 'R', scope: 'email' }).exchangeCode(args)).toEqual({ ok: false, error: 'the drive.file permission was not granted' });
    expect(await mk({ error: 'invalid_grant', error_description: 'Bad code' }, 400).exchangeCode(args)).toEqual({ ok: false, error: 'Bad code' });
  });
  it('refresh: a new access token and NO new refresh token (Google does not rotate); a revoked grant is "revoked", a server error is not', async () => {
    const mk = (status: number, body: any) => createGoogleProvider((async () => resp(status, body)) as any);
    const a = { refreshToken: 'R', clientId: 'a', clientSecret: 'b' };
    const ok = await mk(200, { access_token: 'A2', expires_in: 3600 }).refresh(a);
    expect(ok).toEqual({ ok: true, accessToken: 'A2', expiresInSeconds: 3600 });
    expect(await mk(400, { error: 'invalid_grant' }).refresh(a)).toMatchObject({ ok: false, revoked: true, error: 'invalid_grant', status: 400 });
    expect(await mk(500, {}).refresh(a)).toMatchObject({ ok: false, revoked: false, status: 500 });
  });
  it('revoke posts the token and never throws', async () => {
    const calls: any[] = [];
    await createGoogleProvider((async (u: string, i: any) => { calls.push([u, i.body]); return resp(200, {}); }) as any).revoke('TOK');
    expect(calls).toEqual([['https://oauth2.googleapis.com/revoke', 'token=TOK']]);
    await expect(createGoogleProvider((async () => { throw new Error('offline'); }) as any).revoke('TOK')).resolves.toBeUndefined();
  });
  it('items are neutral: folder flag, numeric size, parent id, the upload mark and the organization mark; isOurs compares the mark', async () => {
    const g = createFakeGoogle();
    const p = createGoogleProvider(g.fetchFn);
    const root = await p.ensureRoot('T', ORG);
    expect(root).toMatchObject({ isFolder: true, markedOrganization: ORG });
    expect((await p.ensureRoot('T', ORG)).id).toBe(root.id); // a reconnect never makes a second kit8root
    expect(p.rootUrl(root.id)).toBe(`https://drive.google.com/drive/folders/${root.id}`);
    expect(p.isOurs(root, ORG)).toBe(true);
    expect(p.isOurs(root, 'other-org')).toBe(false);
    const folder = await p.ensureFolder('T', root.id, { name: 'files', description: 'd', marks: { kit8Kind: 'files', kit8OrganizationGUID: ORG } });
    expect(folder.created).toBe(true);
    expect((await p.ensureFolder('T', root.id, { name: 'files', description: 'd', marks: {} })).created).toBe(false);
    const kids = await p.listChildren('T', root.id);
    expect(kids.map((k) => [k.name, k.isFolder, k.parentId])).toEqual([['files', true, root.id]]);
    expect(await p.findUploaded('T', { uploadId: 'no-such-upload', folderId: root.id, name: 'x', size: 1 })).toBeNull();
  });
  it('deleteTree removes a folder with everything inside (bottom-up for Google) and deleteItem says gone for a missing item', async () => {
    const g = createFakeGoogle();
    const p = createGoogleProvider(g.fetchFn);
    const root = await p.ensureRoot('T', ORG);
    const sub = await p.ensureFolder('T', root.id, { name: 'sub', description: '', marks: { kit8OrganizationGUID: ORG } });
    await p.ensureFolder('T', sub.id, { name: 'deeper', description: '', marks: { kit8OrganizationGUID: ORG } });
    expect(await p.deleteTree('T', root.id)).toEqual({ files: 0, folders: 3 });
    expect(await p.deleteItem('T', root.id)).toBe('gone');
  });
});

describe('token cache: the provider decides, a rotating refresh token is stored', () => {
  const stub = (results: any[]): StorageProvider => {
    const q = [...results];
    return { id: 'oneDrive', title: 'Microsoft OneDrive', refresh: jest.fn(async () => q.shift()) } as unknown as StorageProvider;
  };
  const mk = async (provider: StorageProvider, extra: any = {}) => {
    const marks: string[] = [];
    const saved: string[] = [];
    const p = createTokenProvider({
      fetchFn: jest.fn() as any, provider, clientId: 'c', clientSecret: 's', tokenKey: KEY, now: () => 1_800_000_000_000,
      loadConnection: async () => ({ refreshTokenEncrypted: await encryptToken('RT-0', KEY), state: 'ok' }),
      markNeedsReconnect: async (_o, e) => { marks.push(`reconnect:${e}`); },
      markRefreshed: async () => { marks.push('refreshed'); },
      saveRefreshToken: async (_o, enc) => { saved.push(enc); },
      ...extra,
    });
    return { p, marks, saved };
  };
  it('a NEW refresh token of a rotating storage is saved (encrypted) before the access token is used', async () => {
    const provider = stub([{ ok: true, accessToken: 'A1', expiresInSeconds: 3600, refreshToken: 'RT-1' }]);
    const { p, saved } = await mk(provider);
    expect(await p.getAccessToken(ORG)).toBe('A1');
    expect(saved).toHaveLength(1);
    expect(await decryptToken(saved[0], KEY)).toBe('RT-1');
    expect((provider.refresh as jest.Mock).mock.calls[0][0]).toEqual({ refreshToken: 'RT-0', clientId: 'c', clientSecret: 's' });
  });
  it('a storage that does not rotate (no refreshToken in the answer) saves nothing', async () => {
    const { p, saved } = await mk(stub([{ ok: true, accessToken: 'A1', expiresInSeconds: 3600 }]));
    await p.getAccessToken(ORG);
    expect(saved).toEqual([]);
  });
  it('revoked = needsReconnect (marked); another failure is a plain error that names the storage', async () => {
    const a = await mk(stub([{ ok: false, revoked: true, error: 'interaction_required', status: 400 }]));
    await expect(a.p.getAccessToken(ORG)).rejects.toBeInstanceOf(NeedsReconnectError);
    expect(a.marks).toEqual(['reconnect:interaction_required']);
    const b = await mk(stub([{ ok: false, revoked: false, error: 'x', status: 503 }]));
    await expect(b.p.getAccessToken(ORG)).rejects.toThrow('Microsoft OneDrive token refresh failed (HTTP 503).');
  });
});

describe('the handler asks the injected provider (nothing Google is left inside it)', () => {
  const item = (over: Partial<StorageItem> = {}): StorageItem => ({ id: 'I1', name: 'f', isFolder: false, size: 7, parentId: 'P1', markedOrganization: ORG, ...over });
  function stubDeps() {
    const provider = {
      id: 'googleDrive', title: 'Stub Drive',
      authUrl: jest.fn(({ state }: any) => `https://stub.test/consent?state=${state}`),
      exchangeCode: jest.fn(), refresh: jest.fn(), revoke: jest.fn(), accountEmail: jest.fn(),
      ensureRoot: jest.fn(), rootUrl: jest.fn(), ensureFolder: jest.fn(), getItem: jest.fn(async () => item()), listChildren: jest.fn(), findUploaded: jest.fn(async () => item({ uploadId: 'U1' })),
      isOurs: jest.fn(() => true), isUpdateDone: jest.fn(() => true), openUploadSession: jest.fn(), openUpdateSession: jest.fn(), openMedia: jest.fn(), versions: jest.fn(), keepVersion: jest.fn(), moveItem: jest.fn(), deleteItem: jest.fn(), deleteTree: jest.fn(),
    } as unknown as StorageProvider;
    const deps: FilesDriveDeps = {
      config: { clientId: 'c', clientSecret: 's', functionUrl: 'https://fn.test/files-drive', appReturnUrl: 'https://app.test/user/files', tokenKey: KEY, urlSecret: 'u' },
      fetchFn: jest.fn() as any,
      providers: { googleDrive: provider },
      authorize: async () => ({ allowed: true, organizationGUID: ORG, userGUID: 'u1', scope: 'organization' }),
      callerRpc: jest.fn(async () => ({ data: { rowGUID: 'post1' }, error: null })),
      serviceRpc: jest.fn(async (fn: string) => (fn === 'files_upload_pending_get' ? { organizationGUID: ORG, userGUID: 'u1', scope: 'organization', folderId: 'F1', relativePath: 'organization/files' } : {})),
      loadConnection: async () => null, saveConnection: async () => undefined, deleteConnection: async () => undefined, patchOrganization: async () => undefined,
    };
    return { provider, deps };
  }
  const post = (deps: FilesDriveDeps, body: any) => handleFilesDrive(new Request('https://fn.test/files-drive', { method: 'POST', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), deps);

  it('connect_start returns the url the provider builds', async () => {
    const { provider, deps } = stubDeps();
    const r = await (await post(deps, { action: 'connect_start' })).json();
    expect(r.url).toMatch(/^https:\/\/stub\.test\/consent\?state=/);
    expect(provider.authUrl).toHaveBeenCalledWith({ clientId: 'c', redirectUri: 'https://fn.test/files-drive', state: expect.any(String) });
  });
  it('upload_finish uses findUploaded + isOurs and registers the size and the folder the PROVIDER reports', async () => {
    const { provider, deps } = stubDeps();
    // the connection must exist for a token: prime it through a stored encrypted token and a refresh that works
    deps.loadConnection = async () => ({ refreshTokenEncrypted: await encryptToken('RT', KEY), state: 'ok' });
    (provider.refresh as jest.Mock).mockResolvedValue({ ok: true, accessToken: 'AT', expiresInSeconds: 3600 });
    const r = await post(deps, { action: 'upload_finish', uploadId: 'U1' });
    expect(r.status).toBe(200);
    expect(provider.findUploaded).toHaveBeenCalledWith('AT', { uploadId: 'U1', itemId: undefined, folderId: 'F1', name: '', size: 0 });
    expect(provider.isOurs).toHaveBeenCalledWith(expect.objectContaining({ id: 'I1' }), ORG);
    expect(deps.serviceRpc).toHaveBeenCalledWith('files_upload_pending_verify', { p_upload: 'U1', p_file_id: 'I1', p_size: 7, p_folder_id: 'P1', p_path: 'organization/files' });
  });
  it('a file that is not ours is refused (403) and not registered', async () => {
    const { provider, deps } = stubDeps();
    deps.loadConnection = async () => ({ refreshTokenEncrypted: await encryptToken('RT', KEY), state: 'ok' });
    (provider.refresh as jest.Mock).mockResolvedValue({ ok: true, accessToken: 'AT', expiresInSeconds: 3600 });
    (provider.isOurs as jest.Mock).mockReturnValue(false);
    expect((await post(deps, { action: 'upload_finish', uploadId: 'U1' })).status).toBe(403);
    expect(deps.callerRpc).not.toHaveBeenCalledWith(expect.anything(), 'files_add', expect.anything());
  });
  it('a StorageError of any storage becomes its HTTP status; the "not connected" words carry the provider name', async () => {
    const { provider, deps } = stubDeps();
    deps.loadConnection = async () => ({ refreshTokenEncrypted: await encryptToken('RT', KEY), state: 'ok' });
    (provider.refresh as jest.Mock).mockResolvedValue({ ok: true, accessToken: 'AT', expiresInSeconds: 3600 });
    (provider.findUploaded as jest.Mock).mockRejectedValue(new StorageError(429, 'rateLimit', 'slow down'));
    const r = await post(deps, { action: 'upload_finish', uploadId: 'U1' });
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ error: 'slow down', reason: 'rateLimit' });
    const s2 = stubDeps();
    const nc = await post(s2.deps, { action: 'upload_session', scope: 'organization', size: 10, name: 'a.txt' });
    expect(nc.status).toBe(409);
    expect((await nc.json()).error).toBe('Stub Drive is not connected.');
  });
});
