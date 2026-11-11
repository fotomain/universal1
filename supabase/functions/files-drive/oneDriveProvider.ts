// files-drive - the Microsoft OneDrive adapter of the StorageProvider interface (documentation/FILE_WITH_OneDrive_WBS.html, task OD2). Microsoft Graph v1.0, delegated Files.ReadWrite.
// Facts it relies on come from the spike OD0 (documentation/OneDrive/ONEDRIVE_HOW_IT_WORKS.html, 2026-11-11, personal account):
//   * an upload session url takes fragments with NO Authorization header (a header gives 401); the last answer carries the driveItem (id, size, parentReference);
//   * permanentDelete removes a folder with content in ONE call (204); an item id survives rename / move; folders are found by path only for kit8root;
//   * the download url (@microsoft.graph.downloadUrl) is pre-authenticated and takes Range; the refresh token ROTATES: every refresh answer carries a new one.
// OneDrive has no custom properties, so "is this ours" is the place: an item is ours when it lies under kit8root of the connected account.
import { StorageError, type CodeExchange, type FetchFn, type RefreshResult, type StorageItem, type StorageProvider } from './provider.ts';

export const GRAPH = 'https://graph.microsoft.com/v1.0';
export const MS_SCOPE = 'offline_access Files.ReadWrite User.Read';
export const ROOT_NAME = 'kit8root';
const SELECT = 'id,name,size,folder,file,parentReference,eTag,webUrl';
const ROOT_PATH = `/drive/root:/${ROOT_NAME}`;

/** a name OneDrive accepts (personal AND business): no / \ * < > ? : | # %, no leading ~, no trailing dot or space, at most 200 characters */
export function oneDriveName(name: unknown): string {
  let n = String(name ?? '').replace(/[\\/*<>?:|#%\u0000-\u001f"]/g, '_').trim();
  n = n.replace(/^~+/, (m) => '_'.repeat(m.length)).replace(/[. ]+$/, '');
  n = n.slice(0, 200).replace(/[. ]+$/, '');
  return n || 'file';
}

const enc = encodeURIComponent;

export interface OneDriveOptions {
  /** Entra tenant: common (default) | organizations | consumers | a directory id */
  tenant?: string;
  /** how long to wait for Retry-After (milliseconds); injected so a test does not sleep */
  sleep?: (ms: number) => Promise<void>;
  /** a Retry-After longer than this is not waited for: the caller gets 429 */
  maxWaitMs?: number;
}

interface GraphItem {
  id: string;
  name?: string;
  size?: number;
  folder?: unknown;
  file?: unknown;
  eTag?: string;
  webUrl?: string;
  parentReference?: { id?: string; path?: string };
  '@microsoft.graph.downloadUrl'?: string;
}

const toItem = (g: GraphItem): StorageItem => ({
  id: g.id,
  name: g.name,
  isFolder: !!g.folder,
  size: Number(g.size || 0),
  parentId: g.parentReference?.id || '',
  versionTag: g.eTag,
  webUrl: g.webUrl || '',
  // under kit8root of the connected account: the path of the PARENT starts with /drive/root:/kit8root (a listing without a path says nothing)
  markedOrganization: g.parentReference?.path && (g.parentReference.path === ROOT_PATH || g.parentReference.path.startsWith(ROOT_PATH + '/')) ? '*' : '',
});

export function createOneDriveProvider(fetchFn: FetchFn, opts: OneDriveOptions = {}): StorageProvider {
  const tenant = opts.tenant || 'common';
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxWait = opts.maxWaitMs ?? 10_000;
  const authority = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
  const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const bearer = (token: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${token}`, ...extra });

  async function failure(res: Response): Promise<StorageError> {
    let code = '';
    let message = '';
    try {
      const j = await res.json();
      code = j?.error?.code || '';
      message = j?.error?.message || '';
    } catch {
      /* no json */
    }
    return new StorageError(res.status, code, message ? `Microsoft OneDrive: ${message}` : `Microsoft OneDrive answered ${res.status} ${code}`.trim());
  }

  /** a Graph call; a 429 / 503 with Retry-After is waited for (twice), then it is an error the caller sees */
  async function graph(token: string, path: string, init: RequestInit = {}, accept: number[] = []): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchFn(path.startsWith('http') ? path : `${GRAPH}${path}`, { ...init, headers: { ...bearer(token, init.body && !(init.headers as any)?.['Content-Type'] ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as any) } });
      if (res.ok || accept.includes(res.status)) return res;
      if ((res.status === 429 || res.status === 503) && attempt < 2) {
        const wait = Number(res.headers.get('Retry-After')) * 1000;
        if (Number.isFinite(wait) && wait >= 0 && wait <= maxWait) {
          await sleep(wait);
          continue;
        }
      }
      throw await failure(res);
    }
  }
  const getJson = async <T = any>(token: string, path: string, accept: number[] = []): Promise<T | null> => {
    const res = await graph(token, path, {}, accept);
    return res.status === 404 || (res.status !== 200 && accept.includes(res.status)) ? null : ((await res.json()) as T);
  };

  const provider: StorageProvider = {
    id: 'oneDrive',
    title: 'Microsoft OneDrive',

    authUrl: ({ clientId, redirectUri, state }) =>
      `${authority}/authorize?${new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, response_mode: 'query', scope: MS_SCOPE, state, prompt: 'select_account' }).toString()}`,

    async exchangeCode({ code, clientId, clientSecret, redirectUri }): Promise<CodeExchange> {
      const res = await fetchFn(`${authority}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, scope: MS_SCOPE }) });
      const tok: any = await res.json().catch(() => ({}));
      if (!res.ok || !tok.access_token) return { ok: false, error: String(tok.error_description || tok.error || `HTTP ${res.status}`).split('\r\n')[0].slice(0, 300) };
      if (!tok.refresh_token) return { ok: false, error: 'Microsoft sent no refresh token (the offline_access permission was not granted)' };
      if (!String(tok.scope || '').toLowerCase().includes('files.readwrite')) return { ok: false, error: 'the Files.ReadWrite permission was not granted' };
      return { ok: true, accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresInSeconds: Number(tok.expires_in) || 3600, scope: tok.scope };
    },

    async refresh({ refreshToken, clientId, clientSecret }): Promise<RefreshResult> {
      const res = await fetchFn(`${authority}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, scope: MS_SCOPE }) });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok || !body.access_token) {
        // invalid_grant / interaction_required / consent_required: the grant is gone (revoked, password reset, 90 days idle); invalid_client = OUR secret is wrong or expired: not a reconnect
        const revoked = ['invalid_grant', 'interaction_required', 'consent_required'].includes(body.error);
        return { ok: false, revoked, error: String(body.error_description || body.error || `HTTP ${res.status}`).split('\r\n')[0].slice(0, 300), status: res.status };
      }
      // THE REFRESH TOKEN ROTATES: the caller stores the new one
      return { ok: true, accessToken: body.access_token, expiresInSeconds: Number(body.expires_in) || 3600, refreshToken: body.refresh_token || undefined };
    },

    async revoke() {
      /* no per-app revoke endpoint for the v2 endpoint: the token is forgotten by the caller; the administrator removes the app's access in the Microsoft account */
    },

    async accountEmail(token) {
      const j = await getJson<{ mail?: string; userPrincipalName?: string }>(token, '/me?$select=mail,userPrincipalName');
      return j?.mail || j?.userPrincipalName || null;
    },

    async ensureRoot(token, _organization) {
      const found = await getJson<GraphItem>(token, `/me/drive/root:/${ROOT_NAME}?$select=${SELECT}`, [404]);
      if (found) return { ...toItem(found), isFolder: true, markedOrganization: '*' };
      const res = await graph(token, '/me/drive/root/children', { method: 'POST', body: JSON.stringify({ name: ROOT_NAME, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) }, [409]);
      const made: GraphItem | null = res.status === 409 ? await getJson<GraphItem>(token, `/me/drive/root:/${ROOT_NAME}?$select=${SELECT}`) : ((await res.json()) as GraphItem);
      if (!made) throw new StorageError(502, 'noRoot', 'Microsoft OneDrive: the root folder could not be made.');
      return { ...toItem(made), isFolder: true, markedOrganization: '*' };
    },
    rootUrl: (rootId) => `https://onedrive.live.com/?id=${enc(rootId)}`, // the handler prefers the webUrl of the root item

    async ensureFolder(token, parentId, step) {
      const name = oneDriveName(step.name);
      const found = await getJson<GraphItem>(token, `/me/drive/items/${enc(parentId)}:/${enc(name)}?$select=id,folder`, [404]);
      if (found?.id) return { id: found.id, created: false };
      const res = await graph(token, `/me/drive/items/${enc(parentId)}/children`, { method: 'POST', body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) }, [409]);
      if (res.status === 409) {
        // somebody made it a moment ago: take that one
        const again = await getJson<GraphItem>(token, `/me/drive/items/${enc(parentId)}:/${enc(name)}?$select=id`);
        if (again?.id) return { id: again.id, created: false };
        throw new StorageError(409, 'nameAlreadyExists', `Microsoft OneDrive: the folder "${name}" exists but cannot be read.`);
      }
      return { id: ((await res.json()) as GraphItem).id, created: true };
    },

    async getItem(token, id) {
      const j = await getJson<GraphItem>(token, `/me/drive/items/${enc(id)}?$select=${SELECT}`, [404]);
      if (!j) throw new StorageError(404, 'itemNotFound', 'Microsoft OneDrive: no such item.');
      return toItem(j);
    },

    async listChildren(token, folderId) {
      const out: StorageItem[] = [];
      let next: string | null = `/me/drive/items/${enc(folderId)}/children?$select=${SELECT}&$top=200`;
      while (next) {
        const page: { value?: GraphItem[]; '@odata.nextLink'?: string } = (await getJson(token, next)) || {};
        out.push(...(page.value || []).map((g) => ({ ...toItem(g), parentId: g.parentReference?.id || folderId })));
        next = page['@odata.nextLink'] || null;
      }
      return out;
    },

    async findUploaded(token, p) {
      if (p.itemId) {
        const item = await provider.getItem(token, p.itemId).catch((e) => { if (e instanceof StorageError && e.status === 404) return null; throw e; });
        // checked against what the database recorded: the folder it must lie in and the size declared at the start
        return item && !item.isFolder && item.parentId === p.folderId && item.size === p.size ? item : null;
      }
      // the answer of the last fragment was lost: the newest file of that size in the folder (conflictBehavior=rename may have changed the name)
      const kids = (await provider.listChildren(token, p.folderId)).filter((k) => !k.isFolder && k.size === p.size);
      return kids.length ? kids[kids.length - 1] : null;
    },
    isOurs: (item) => item.markedOrganization === '*',
    isUpdateDone: (item, p) => !!item.versionTag && item.versionTag !== p.oldVersionTag && item.size === p.size,

    async openUploadSession(token, p) {
      const res = await graph(token, `/me/drive/items/${enc(p.folderId)}:/${enc(oneDriveName(p.name))}:/createUploadSession`, { method: 'POST', body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }) });
      const url = ((await res.json()) as { uploadUrl?: string }).uploadUrl;
      if (!url) throw new StorageError(502, 'noSessionUrl', 'Microsoft OneDrive gave no upload session url.');
      return url;
    },
    async openUpdateSession(token, itemId) {
      const res = await graph(token, `/me/drive/items/${enc(itemId)}/createUploadSession`, { method: 'POST', body: '{}' });
      const url = ((await res.json()) as { uploadUrl?: string }).uploadUrl;
      if (!url) throw new StorageError(502, 'noSessionUrl', 'Microsoft OneDrive gave no upload session url.');
      return url;
    },
    async openMedia(token, id, range) {
      const j = await graph(token, `/me/drive/items/${enc(id)}?$select=id,@microsoft.graph.downloadUrl`, {}, [404]);
      if (j.status === 404) return j;
      const url = ((await j.json()) as GraphItem)['@microsoft.graph.downloadUrl'];
      if (!url) throw new StorageError(502, 'noDownloadUrl', 'Microsoft OneDrive gave no download url (a folder?).');
      // the download url is pre-authenticated: NO Authorization header; Range works on it
      return fetchFn(url, { headers: range ? { Range: range } : {} });
    },

    async versions(token, id) {
      const j = await getJson<{ value?: { id: string }[] }>(token, `/me/drive/items/${enc(id)}/versions?$select=id`, [404]);
      return (j?.value || []).map((v) => v.id).reverse(); // Graph lists the newest first; the interface says oldest first
    },
    async keepVersion() {
      /* OneDrive keeps the versions itself (work accounts: 500 by default); nothing to ask for */
    },
    async moveItem(token, id, newParentId) {
      await graph(token, `/me/drive/items/${enc(id)}`, { method: 'PATCH', body: JSON.stringify({ parentReference: { id: newParentId } }) });
    },
    async deleteItem(token, id) {
      const res = await graph(token, `/me/drive/items/${enc(id)}/permanentDelete`, { method: 'POST' }, [404]);
      return res.status === 404 ? 'gone' : 'deleted';
    },
    async deleteTree(token, folderId) {
      // spike OD0: permanentDelete takes a folder with everything inside in ONE call
      const r = await provider.deleteItem(token, folderId);
      return { files: 0, folders: r === 'deleted' ? 1 : 0 };
    },
  };
  return provider;
}
