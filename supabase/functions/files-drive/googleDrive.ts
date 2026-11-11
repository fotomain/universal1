// files-drive - the Google Drive REST calls (scope drive.file only). Pure: the fetch function is injected, so the Jest test drives it with a fake Drive.
// Facts this code relies on come from the live test of 2026-11-11 (documentation/Goolge/GOOGLE_DRIVE_HOW_IT_WORKS.html, section 12):
//   * folders / files are found again by properties; a resumable upload session url carries its own authorization; Range reads give 206;
//   * files.delete on a folder with children gives 403 appNotAuthorizedToChild -> a tree is deleted BOTTOM-UP (deleteTreeBottomUp).
import { StorageError, type FetchFn } from './provider.ts';
export type { FetchFn };

export const DRIVE = 'https://www.googleapis.com/drive/v3';
export const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** the Google Drive flavour of StorageError (the handler catches StorageError) */
export class DriveError extends StorageError {
  constructor(status: number, reason: string, message?: string) {
    super(status, reason, message || `Google Drive answered ${status} ${reason}`.trim());
  }
}

const qEscape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function failure(res: Response): Promise<DriveError> {
  let reason = '';
  let message = '';
  try {
    const j = await res.json();
    reason = j?.error?.errors?.[0]?.reason || j?.error?.status || '';
    message = j?.error?.message || '';
  } catch {
    /* no json */
  }
  return new DriveError(res.status, reason, message || undefined);
}

export interface DriveItem {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  parents?: string[];
  properties?: Record<string, string>;
}

export function createDrive(fetchFn: FetchFn) {
  const auth = (token: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${token}`, ...extra });

  async function json<T = any>(token: string, url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchFn(url, { ...init, headers: { ...auth(token, init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as any) } });
    if (!res.ok) throw await failure(res);
    return (res.status === 204 ? {} : await res.json()) as T;
  }

  async function list(token: string, q: string, fields = 'files(id,name,mimeType,size,parents,properties)'): Promise<DriveItem[]> {
    const out: DriveItem[] = [];
    let pageToken = '';
    do {
      const url = `${DRIVE}/files?q=${encodeURIComponent(q)}&pageSize=1000&fields=${encodeURIComponent(`nextPageToken,${fields}`)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const page = await json<{ files?: DriveItem[]; nextPageToken?: string }>(token, url);
      out.push(...(page.files || []));
      pageToken = page.nextPageToken || '';
    } while (pageToken);
    return out;
  }

  return {
    /** a folder with this property (and optionally this parent) that is not in the trash */
    async findFolderByProperty(token: string, key: string, value: string, parentId?: string): Promise<DriveItem | null> {
      const q = `mimeType = '${FOLDER_MIME}' and trashed = false and properties has { key='${qEscape(key)}' and value='${qEscape(value)}' }${parentId ? ` and '${qEscape(parentId)}' in parents` : ''}`;
      return (await list(token, q))[0] || null;
    },

    /** the kit8root folder of an organization: marked kit8Kind = root AND kit8OrganizationGUID = the organization */
    async findRootFolder(token: string, organization: string): Promise<DriveItem | null> {
      const q = `mimeType = '${FOLDER_MIME}' and trashed = false and properties has { key='kit8Kind' and value='root' } and properties has { key='kit8OrganizationGUID' and value='${qEscape(organization)}' }`;
      return (await list(token, q))[0] || null;
    },

    async findFolderByName(token: string, parentId: string, name: string): Promise<DriveItem | null> {
      const q = `mimeType = '${FOLDER_MIME}' and trashed = false and name = '${qEscape(name)}' and '${qEscape(parentId)}' in parents`;
      return (await list(token, q))[0] || null;
    },

    async createFolder(token: string, name: string, parentId: string | null, description: string, properties: Record<string, string>): Promise<DriveItem> {
      return json<DriveItem>(token, `${DRIVE}/files?fields=id,name,parents,properties`, {
        method: 'POST',
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, description, properties, ...(parentId ? { parents: [parentId] } : {}) }),
      });
    },

    /** the folder `name` inside `parentId`: found by name, else created with the description and the marks */
    async ensureFolder(token: string, parentId: string, name: string, description: string, properties: Record<string, string>): Promise<{ id: string; created: boolean }> {
      const found = await this.findFolderByName(token, parentId, name);
      if (found) return { id: found.id, created: false };
      const made = await this.createFolder(token, name, parentId, description, properties);
      return { id: made.id, created: true };
    },

    list,

    async getItem(token: string, id: string, fields = 'id,name,mimeType,size,parents,properties'): Promise<DriveItem> {
      return json<DriveItem>(token, `${DRIVE}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`);
    },

    async setProperties(token: string, id: string, properties: Record<string, string>): Promise<void> {
      await json(token, `${DRIVE}/files/${encodeURIComponent(id)}?fields=id`, { method: 'PATCH', body: JSON.stringify({ properties }) });
    },

    /** HTTP 204 or 404 (already gone) = done; anything else throws */
    async deleteItem(token: string, id: string): Promise<'deleted' | 'gone'> {
      const res = await fetchFn(`${DRIVE}/files/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth(token) });
      if (res.status === 204 || res.ok) return 'deleted';
      if (res.status === 404) return 'gone';
      throw await failure(res);
    },

    /** files first, then folders from the deepest (one files.delete on a folder gives 403 appNotAuthorizedToChild with drive.file) */
    async deleteTreeBottomUp(token: string, rootId: string, maxItems = 20000): Promise<{ files: number; folders: number }> {
      const order: { id: string; folder: boolean }[] = [];
      const stack: string[] = [rootId];
      while (stack.length) {
        const folder = stack.pop()!;
        order.push({ id: folder, folder: true });
        for (const child of await list(token, `'${qEscape(folder)}' in parents`)) {
          if (child.mimeType === FOLDER_MIME) stack.push(child.id);
          else order.push({ id: child.id, folder: false });
          if (order.length > maxItems) throw new DriveError(413, 'tooManyItems', `More than ${maxItems} items - delete in smaller parts.`);
        }
      }
      // the list is parents-before-children; deleting it reversed removes every child before its parent
      let files = 0;
      let folders = 0;
      for (const item of order.reverse()) {
        await this.deleteItem(token, item.id);
        if (item.folder) folders++;
        else files++;
      }
      return { files, folders };
    },

    /** a resumable upload session: the returned url takes the bytes with NO token. `origin` is the page that will PUT (CORS: Google allows that origin only if it is sent here). */
    async openResumableSession(token: string, meta: { name: string; parentId: string; mime: string; size: number; properties?: Record<string, string> }, origin?: string | null): Promise<string> {
      const res = await fetchFn(`${UPLOAD}/files?uploadType=resumable&fields=id,size`, {
        method: 'POST',
        headers: auth(token, {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': meta.mime || 'application/octet-stream',
          'X-Upload-Content-Length': String(meta.size),
          ...(origin ? { Origin: origin } : {}),
        }),
        body: JSON.stringify({ name: meta.name, parents: [meta.parentId], properties: meta.properties || {} }),
      });
      if (!res.ok) throw await failure(res);
      const url = res.headers.get('Location');
      if (!url) throw new DriveError(502, 'noSessionUrl', 'Google Drive gave no upload session url.');
      return url;
    },

    /** the bytes (or a byte range) of a file as Drive answers: the Response is passed on without buffering */
    async openMedia(token: string, id: string, range?: string | null): Promise<Response> {
      return fetchFn(`${DRIVE}/files/${encodeURIComponent(id)}?alt=media`, { headers: auth(token, range ? { Range: range } : {}) });
    },

    /** an UPDATE session for an existing file (S4 replace): the same Drive file id, a new revision; the properties are applied when the upload completes */
    async openUpdateSession(token: string, fileId: string, meta: { mime: string; size: number; properties?: Record<string, string> }, origin?: string | null): Promise<string> {
      const res = await fetchFn(`${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=resumable&fields=id,size`, {
        method: 'PATCH',
        headers: auth(token, {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': meta.mime || 'application/octet-stream',
          'X-Upload-Content-Length': String(meta.size),
          ...(origin ? { Origin: origin } : {}),
        }),
        body: JSON.stringify({ properties: meta.properties || {} }),
      });
      if (!res.ok) throw await failure(res);
      const url = res.headers.get('Location');
      if (!url) throw new DriveError(502, 'noSessionUrl', 'Google Drive gave no upload session url.');
      return url;
    },

    /** the revision ids of a file, oldest first */
    async revisionIds(token: string, fileId: string): Promise<string[]> {
      const j = await json<{ revisions?: { id: string }[] }>(token, `${DRIVE}/files/${encodeURIComponent(fileId)}/revisions?fields=${encodeURIComponent('revisions(id)')}`);
      return (j.revisions || []).map((r) => r.id);
    },

    /** keep an old revision forever (Drive would drop it after 30 days / 100 versions) */
    async keepRevision(token: string, fileId: string, revisionId: string): Promise<void> {
      await json(token, `${DRIVE}/files/${encodeURIComponent(fileId)}/revisions/${encodeURIComponent(revisionId)}`, { method: 'PATCH', body: JSON.stringify({ keepForever: true }) });
    },

    /** move a file / folder to another folder (the id and the url stay) */
    async moveItem(token: string, id: string, newParent: string, oldParent: string): Promise<void> {
      await json(token, `${DRIVE}/files/${encodeURIComponent(id)}?addParents=${encodeURIComponent(newParent)}&removeParents=${encodeURIComponent(oldParent)}&fields=id,parents`, { method: 'PATCH', body: '{}' });
    },

    async aboutUser(token: string): Promise<string | null> {
      const j = await json<{ user?: { emailAddress?: string } }>(token, `${DRIVE}/about?fields=user(emailAddress)`);
      return j.user?.emailAddress || null;
    },
  };
}

export type Drive = ReturnType<typeof createDrive>;
