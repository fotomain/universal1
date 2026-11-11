// files-drive - the Google Drive adapter of the StorageProvider interface (provider.ts). It is the code that used to sit in handler.ts / token.ts, moved here
// WITHOUT a change of behaviour: scope drive.file only, folders and files marked with properties, bottom-up delete, revisions kept forever.
import { createDrive, DriveError, FOLDER_MIME, type DriveItem } from './googleDrive.ts';
import type { FetchFn, StorageItem, StorageProvider } from './provider.ts';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const qEscape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

const toItem = (d: DriveItem): StorageItem => ({
  id: d.id,
  name: d.name,
  isFolder: d.mimeType === FOLDER_MIME,
  size: Number(d.size || 0),
  parentId: d.parents?.[0] || '',
  uploadId: d.properties?.kit8Upload,
  markedOrganization: d.properties?.kit8OrganizationGUID || '',
});

export function createGoogleProvider(fetchFn: FetchFn): StorageProvider {
  const drive = createDrive(fetchFn);
  const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const post = (url: string, body: string) => fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });

  return {
    id: 'googleDrive',
    title: 'Google Drive',

    authUrl: ({ clientId, redirectUri, state }) =>
      `${GOOGLE_AUTH_URL}?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: DRIVE_FILE_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'false',
        state,
      }).toString()}`,

    async exchangeCode({ code, clientId, clientSecret, redirectUri }) {
      const res = await post(GOOGLE_TOKEN_URL, form({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }));
      const tok: any = await res.json().catch(() => ({}));
      if (!res.ok || !tok.access_token) return { ok: false, error: String(tok.error_description || tok.error || `HTTP ${res.status}`) };
      if (!tok.refresh_token) return { ok: false, error: 'Google sent no refresh token - remove the app at myaccount.google.com/permissions and connect again' };
      if (!String(tok.scope || '').includes('drive.file')) return { ok: false, error: 'the drive.file permission was not granted' };
      return { ok: true, accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresInSeconds: Number(tok.expires_in) || 3600, scope: tok.scope };
    },

    async refresh({ refreshToken, clientId, clientSecret }) {
      const res = await post(GOOGLE_TOKEN_URL, form({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }));
      let body: any = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }
      if (!res.ok || !body.access_token) {
        return { ok: false, revoked: body.error === 'invalid_grant' || res.status === 400 || res.status === 401, error: String(body.error_description || body.error || `HTTP ${res.status}`), status: res.status };
      }
      // Google does not rotate the refresh token: none comes back
      return { ok: true, accessToken: body.access_token, expiresInSeconds: Number(body.expires_in) || 3600 };
    },

    async revoke(refreshToken) {
      try {
        await post(GOOGLE_REVOKE_URL, form({ token: refreshToken }));
      } catch {
        /* best effort */
      }
    },

    accountEmail: (token) => drive.aboutUser(token),

    async ensureRoot(token, organization) {
      let root = await drive.findRootFolder(token, organization);
      if (!root) root = await drive.createFolder(token, 'kit8root', null, 'kit8 root folder of the organization', { kit8Kind: 'root', kit8OrganizationGUID: organization });
      return { ...toItem(root), isFolder: true }; // createFolder does not ask Drive for mimeType: it is a folder by construction
    },
    rootUrl: folderUrl,

    ensureFolder: (token, parentId, step) => drive.ensureFolder(token, parentId, step.name, step.description, step.marks),
    async getItem(token, id) {
      return toItem(await drive.getItem(token, id));
    },
    async listChildren(token, folderId) {
      return (await drive.list(token, `'${qEscape(folderId)}' in parents and trashed = false`)).map(toItem);
    },
    async findUploaded(token, { uploadId }) {
      const found = await drive.list(token, `properties has { key='kit8Upload' and value='${qEscape(uploadId)}' } and trashed = false`);
      if (!found.length) return null;
      return toItem(await drive.getItem(token, found[0].id));
    },
    isOurs: (item, organization) => item.markedOrganization === organization,
    isUpdateDone: (item, p) => item.uploadId === p.uploadId,

    openUploadSession: (token, p) =>
      drive.openResumableSession(token, { name: p.name, parentId: p.folderId, mime: p.mime, size: p.size, properties: { kit8Kind: 'file', kit8OrganizationGUID: p.organization, kit8Upload: p.uploadId } }, p.origin),
    openUpdateSession: (token, itemId, p) => drive.openUpdateSession(token, itemId, { mime: p.mime, size: p.size, properties: { kit8Upload: p.uploadId } }, p.origin),
    openMedia: (token, id, range) => drive.openMedia(token, id, range),

    versions: (token, id) => drive.revisionIds(token, id),
    keepVersion: (token, id, versionId) => drive.keepRevision(token, id, versionId),
    moveItem: (token, id, newParentId, oldParentId) => drive.moveItem(token, id, newParentId, oldParentId),
    deleteItem: (token, id) => drive.deleteItem(token, id),
    deleteTree: (token, folderId) => drive.deleteTreeBottomUp(token, folderId),
  };
}

export { DriveError };
