// files-drive (Supabase Edge Function, Deno) - way C of documentation/FILE_ATTACHMENT_WBS.html: the ONE place that talks to Google Drive.
// Every action starts with files_authorize (SQL, the caller's JWT): the app permission decides, never the body of the request. The organization is the one the
// database says (organization_of_current_user), not a value the client sends. Rights: projectMediaPostManager (files of a project / stage / task), projectFileManager (files of the
// organization and of documents, the Google Drive connection); every member reads.
// This file is PURE (no Deno, no network of its own): index.ts injects the Supabase clients and fetch; __tests__/files/filesDriveFunction.test.ts injects doubles.
import { signPayload, verifyPayload, signValue, verifyValue, encryptToken, decryptToken } from './crypto.ts';
import { createDrive, DriveError, FOLDER_MIME, type FetchFn } from './googleDrive.ts';
import { createTokenProvider, NeedsReconnectError, GOOGLE_TOKEN_URL } from './token.ts';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const STATE_TTL_MS = 10 * 60 * 1000;
export const DOWNLOAD_TTL_MS = 10 * 60 * 1000;
export const UPLOAD_TTL_MS = 6 * 60 * 60 * 1000;

export interface FilesDriveConfig {
  clientId: string;
  clientSecret: string;
  /** the url of THIS function: the Google redirect, and the base of the signed download urls */
  functionUrl: string;
  /** where the browser goes after the consent step (the app) */
  appReturnUrl: string;
  tokenKey: string;
  urlSecret: string;
  /** the secret header of the pg_cron tick (empty = the tick is off) */
  cleanupSecret?: string;
}

export interface ConnectionRow {
  refreshTokenEncrypted?: string;
  state?: string;
  accountEmail?: string;
  lastRefreshAt?: string;
  lastError?: string;
}

export interface AuthResult {
  allowed: boolean;
  reason?: string | null;
  organizationGUID?: string;
  userGUID?: string;
  projectGUID?: string | null;
  scope?: string;
  guid?: string | null;
}

export interface FilesDriveDeps {
  config: FilesDriveConfig;
  fetchFn: FetchFn;
  now?: () => number;
  /** files_authorize with the caller's JWT */
  authorize: (authorization: string, action: string, scope: string, guid?: string | null, project?: string | null) => Promise<AuthResult>;
  /** an RPC as the caller (files_add, files_delete, files_get): his rights apply; an error text comes back as error */
  callerRpc: (authorization: string, fn: string, args: Record<string, any>) => Promise<{ data: any; error: string | null }>;
  /** an RPC as the service role (pending uploads, folders, the cleanup queue, organization facts) */
  serviceRpc: (fn: string, args: Record<string, any>) => Promise<any>;
  loadConnection: (organization: string) => Promise<ConnectionRow | null>;
  /** merge into the connection row (creates it when missing); null patch value is stored as null */
  saveConnection: (organization: string, patch: Record<string, any>) => Promise<void>;
  deleteConnection: (organization: string) => Promise<void>;
  patchOrganization: (organization: string, patch: Record<string, any>) => Promise<void>;
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, x-files-cleanup-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-range, accept-ranges, content-length',
} as const;

const json = (status: number, body: Record<string, any>): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/** a file name Drive and every file system accept: no path parts, no control characters, not empty, at most 200 characters */
export function safeFileName(name: unknown): string {
  const cleaned = String(name ?? '').replace(/[\\/\u0000-\u001f]/g, '_').trim().slice(0, 200);
  return cleaned || 'file';
}

export interface FolderStep {
  name: string;
  description: string;
  properties: Record<string, string>;
}

/** the folders under kit8root for a scope (section 5 of the plan); every folder carries the marks of S2 */
export function chainFor(organization: string, scope: string, guid: string, projectGUID: string): FolderStep[] | null {
  const mark = (kind: string, extra: Record<string, string> = {}) => ({ kit8Kind: kind, kit8OrganizationGUID: organization, ...extra });
  const files = (): FolderStep => ({ name: 'files', description: 'kit8 files', properties: mark('files') });
  if (scope === 'organization') {
    return [{ name: 'organization', description: 'kit8 · organization', properties: mark('organization') }, files()];
  }
  if (scope === 'project' && GUID_RE.test(guid)) {
    return [{ name: 'project', description: 'kit8 · projects', properties: mark('projects') },
      { name: guid, description: `kit8 · project ${guid}`, properties: mark('project', { kit8ProjectGUID: guid }) }, files()];
  }
  if ((scope === 'task' || scope === 'stage') && GUID_RE.test(guid) && GUID_RE.test(projectGUID)) {
    return [{ name: 'project', description: 'kit8 · projects', properties: mark('projects') },
      { name: projectGUID, description: `kit8 · project ${projectGUID}`, properties: mark('project', { kit8ProjectGUID: projectGUID }) },
      { name: 'task', description: 'kit8 · tasks', properties: mark('tasks', { kit8ProjectGUID: projectGUID }) },
      { name: guid, description: `kit8 · task ${guid}`, properties: mark('task', { kit8ProjectGUID: projectGUID, kit8TaskGUID: guid }) }, files()];
  }
  if (scope === 'document' && guid) {
    const safe = guid.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
    return [{ name: 'document', description: 'kit8 · documents', properties: mark('documents') },
      { name: safe, description: `kit8 · document ${safe}`, properties: mark('doc', { kit8DocumentGUID: safe }) }, files()];
  }
  return null;
}

/** the key of files_folder_table for a scope */
export function scopeKeyFor(scope: string, guid: string): string {
  if (scope === 'organization') return 'organization';
  if (scope === 'project') return `project:${guid}`;
  if (scope === 'document') return `document:${guid}`;
  return `task:${guid}`;
}

export async function handleFilesDrive(req: Request, deps: FilesDriveDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  const now = deps.now || Date.now;
  const cfg = deps.config;
  const drive = createDrive(deps.fetchFn);
  const tokens = createTokenProvider({
    fetchFn: deps.fetchFn,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    tokenKey: cfg.tokenKey,
    now,
    loadConnection: (org) => deps.loadConnection(org),
    markNeedsReconnect: async (org, error) => {
      await deps.saveConnection(org, { state: 'needsReconnect', lastError: error });
      await deps.patchOrganization(org, { organizationGoogleDriveState: 'needsReconnect' });
    },
    markRefreshed: async (org, iso) => {
      await deps.saveConnection(org, { state: 'ok', lastRefreshAt: iso, lastError: null });
    },
  });

  // a Drive call with the organization's token; one forced refresh and one retry after a 401
  const withDrive = async <T>(organization: string, fn: (token: string) => Promise<T>): Promise<T> => {
    try {
      return await fn(await tokens.getAccessToken(organization));
    } catch (e) {
      if (e instanceof DriveError && e.status === 401) return fn(await tokens.getAccessToken(organization, true));
      throw e;
    }
  };

  /** the `files` folder of a scope: cached in files_folder_table, else made (the whole chain, with marks) and recorded - the first writer wins */
  const filesFolderFor = async (org: string, scope: string, guid: string, project: string, token: string): Promise<{ folderId: string; path: string } | { error: Response }> => {
    const chain = chainFor(org, scope, guid, project);
    if (!chain) return { error: json(400, { error: 'scope must be organization, project, task, stage or document with valid GUIDs.' }) };
    const facts = await deps.serviceRpc('files_org_facts', { p_org: org });
    const rootId = String(facts?.rootFolderId || '');
    if (!rootId) return { error: json(409, { error: 'Google Drive is not connected.', code: 'notConnected' }) };
    const key = scopeKeyFor(scope, guid);
    const path = chain.map((s) => s.name).join('/');
    const known = await deps.serviceRpc('files_folder_get', { p_org: org, p_scope_key: key });
    if (known?.driveFilesFolderId) return { folderId: String(known.driveFilesFolderId), path };
    let parent = rootId;
    const ids: string[] = [];
    for (const step of chain) {
      parent = (await drive.ensureFolder(token, parent, step.name, step.description, step.properties)).id;
      ids.push(parent);
    }
    const saved = await deps.serviceRpc('files_folder_set', { p_org: org, p_scope_key: key, p_json: { driveFolderId: ids[ids.length - 2], driveFilesFolderId: ids[ids.length - 1], projectGUID: project || null, rootFolderId: rootId } });
    return { folderId: String(saved?.driveFilesFolderId || ids[ids.length - 1]), path };
  };

  const url = new URL(req.url);
  try {
    // ---- GET: the Google redirect (code + state) and the signed download -------------------------------------------------------------------------------
    if (req.method === 'GET') {
      if (url.searchParams.has('state') || url.searchParams.has('error')) return await connectCallback(url);
      if (url.searchParams.has('sig')) return await download(url, req);
      return json(400, { error: 'Unknown request.' });
    }
    if (req.method !== 'POST') return json(405, { error: 'GET or POST only' });

    let body: Record<string, any> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const action = String(body.action || '');

    // ---- the pg_cron tick: the secret header instead of a user --------------------------------------------------------------------------------------
    const tickSecret = req.headers.get('x-files-cleanup-secret') || '';
    if (action === 'cleanup' && cfg.cleanupSecret && tickSecret === cfg.cleanupSecret) return json(200, await runCleanup());

    const authorization = req.headers.get('Authorization') || '';
    if (!authorization) return json(401, { error: 'Sign in first.' });
    const ask = async (act: string, scope: string, guid?: string | null, project?: string | null): Promise<AuthResult | Response> => {
      const a = await deps.authorize(authorization, act, scope, guid ?? null, project ?? null);
      if (a.allowed) return a;
      if (a.reason === 'signIn') return json(401, { error: 'Sign in first.' });
      return json(403, { error: `No permission (${a.reason || 'denied'}).`, reason: a.reason || 'denied' });
    };
    const scope = String(body.scope || '');
    const guid = body.guid == null ? null : String(body.guid);
    const projectGUID = body.projectGUID == null ? null : String(body.projectGUID);

    switch (action) {
      case 'connect_start': {
        const a = await ask('connect', 'organization');
        if (a instanceof Response) return a;
        const state = await signPayload(cfg.urlSecret, { org: a.organizationGUID, user: a.userGUID, exp: now() + STATE_TTL_MS });
        const params = new URLSearchParams({
          client_id: cfg.clientId,
          redirect_uri: cfg.functionUrl,
          response_type: 'code',
          scope: DRIVE_FILE_SCOPE,
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'false',
          state,
        });
        return json(200, { url: `${GOOGLE_AUTH_URL}?${params.toString()}` });
      }

      case 'status': {
        const a = await ask('read', 'organization');
        if (a instanceof Response) return a;
        const org = a.organizationGUID!;
        const conn = await deps.loadConnection(org);
        const facts = await deps.serviceRpc('files_org_facts', { p_org: org });
        const counts = await deps.callerRpc(authorization, 'files_cleanup_counts', {});
        return json(200, {
          state: conn ? conn.state || 'ok' : 'notConnected',
          accountEmail: conn?.accountEmail || null,
          lastRefreshAt: conn?.lastRefreshAt || null,
          rootFolderUrl: facts?.rootFolderUrl || null,
          cleanup: counts.data || { waiting: 0, failed: 0 },
        });
      }

      case 'upload_session': {
        const size = Number(body.size);
        if (!Number.isFinite(size) || size <= 0) return json(400, { error: 'size (bytes) is required.' });
        const a = await ask('add', scope, guid, projectGUID);
        if (a instanceof Response) return a;
        const org = a.organizationGUID!;
        if (!chainFor(org, scope, guid || '', projectGUID || '')) return json(400, { error: 'scope must be organization, project, task, stage or document with valid GUIDs.' });
        const facts0 = await deps.serviceRpc('files_org_facts', { p_org: org });
        if (!facts0?.rootFolderId) return json(409, { error: 'Google Drive is not connected.', code: 'notConnected' });
        // the storage limit of the organization is asked BEFORE a session is opened (files_add asks again)
        const used = await deps.callerRpc(authorization, 'files_storage_used', { p_scope: 'organization', p_guid: null });
        const limitMb = Number(used.data?.limitMegabytes);
        if (Number.isFinite(limitMb) && limitMb > 0 && Number(used.data?.totalBytes || 0) + size > limitMb * 1048576) {
          return json(413, { error: `The storage limit of ${limitMb} MB of the organization would be exceeded.`, code: 'storageLimit' });
        }
        const uploadId = crypto.randomUUID();
        const out = await withDrive(org, async (token) => {
          const f = await filesFolderFor(org, scope, guid || '', a.projectGUID || projectGUID || '', token);
          if ('error' in f) return f;
          const sessionUrl = await drive.openResumableSession(
            token,
            { name: safeFileName(body.name), parentId: f.folderId, mime: String(body.mime || 'application/octet-stream'), size, properties: { kit8Kind: 'file', kit8OrganizationGUID: org, kit8Upload: uploadId } },
            req.headers.get('Origin'),
          );
          return { sessionUrl, folderId: f.folderId, path: f.path };
        });
        if ('error' in out) return out.error;
        await deps.serviceRpc('files_upload_pending_add', {
          p_org: org, p_user: a.userGUID, p_upload: uploadId,
          p_json: { scope, scopeGUID: guid || '', projectGUID: a.projectGUID || projectGUID || '', name: safeFileName(body.name), mime: String(body.mime || 'application/octet-stream'), size, folderId: out.folderId, relativePath: out.path, expiresAt: new Date(now() + UPLOAD_TTL_MS).toISOString() },
        });
        return json(200, { sessionUrl: out.sessionUrl, parentFolderId: out.folderId, uploadId, path: out.path });
      }

      case 'upload_finish': {
        const uploadId = String(body.uploadId || '');
        if (!uploadId) return json(400, { error: 'uploadId is required.' });
        const pend = await deps.serviceRpc('files_upload_pending_get', { p_upload: uploadId });
        if (!pend) return json(404, { error: 'No such upload.', code: 'noUpload' });
        // the caller must be allowed to add in the scope the upload was opened for, and must be the person who opened it
        const a = await ask('add', String(pend.scope), pend.scopeGUID || null, pend.projectGUID || null);
        if (a instanceof Response) return a;
        if (pend.organizationGUID !== a.organizationGUID || pend.userGUID !== a.userGUID) return json(403, { error: 'That upload is not yours.' });
        const found = await withDrive(a.organizationGUID!, (token) => drive.list(token, `properties has { key='kit8Upload' and value='${uploadId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' } and trashed = false`));
        if (!found.length) return json(404, { error: 'The upload is not finished (no file yet).', code: 'notFinished' });
        const item = await withDrive(a.organizationGUID!, (token) => drive.getItem(token, found[0].id));
        if (item.properties?.kit8OrganizationGUID !== a.organizationGUID) return json(403, { error: 'That file does not belong to this organization.' });
        await deps.serviceRpc('files_upload_pending_verify', { p_upload: uploadId, p_file_id: item.id, p_size: Number(item.size || 0), p_folder_id: item.parents?.[0] || pend.folderId || '', p_path: pend.relativePath || '' });
        const added = await deps.callerRpc(authorization, 'files_add', { p_upload_id: uploadId, p_scope: String(pend.scope), p_guid: pend.scopeGUID || null, p_project: pend.projectGUID || null, p_file: body.file || {} });
        if (added.error) return json(409, { error: added.error });
        return json(200, { file: added.data });
      }

      case 'download_url': {
        const postGUID = String(body.postGUID || '');
        if (!postGUID) return json(400, { error: 'postGUID is required.' });
        const row = await deps.callerRpc(authorization, 'files_get', { p_post: postGUID });
        if (row.error || !row.data) return json(403, { error: row.error || 'No such file.' });
        const org = String(row.data.rowOwnerGUID);
        const fileId = String(row.data.rowJSON?.googleDriveFileId || '');
        if (!fileId) return json(400, { error: 'That post has no Google Drive file (a link).' });
        const exp = now() + DOWNLOAD_TTL_MS;
        const sig = await signValue(cfg.urlSecret, `${org}|${fileId}|${exp}`);
        const q = new URLSearchParams({ org, file: fileId, exp: String(exp), sig });
        return json(200, { url: `${cfg.functionUrl}?${q.toString()}`, name: row.data.rowJSON?.fileName, mimeType: row.data.rowJSON?.mediaPostMIME, size: Number(row.data.rowJSON?.fileSizeBytes || 0), expiresAt: exp });
      }

      case 'replace_session': {
        const postGUID = String(body.postGUID || '');
        const size = Number(body.size);
        if (!postGUID || !Number.isFinite(size) || size <= 0) return json(400, { error: 'postGUID and size are required.' });
        const row = await deps.callerRpc(authorization, 'files_get', { p_post: postGUID });
        if (row.error || !row.data) return json(403, { error: row.error || 'No such file.' });
        const rj = row.data.rowJSON || {};
        const fileId = String(rj.googleDriveFileId || '');
        if (!fileId) return json(400, { error: 'A link has no file to replace.' });
        const a = await ask('update', String(rj.fileSourceKind), rj.fileSourceKind === 'organization' ? null : String(row.data.rowParentGUID), rj.fileSourceProjectGUID || null);
        if (a instanceof Response) return a;
        const uploadId = crypto.randomUUID();
        const out = await withDrive(a.organizationGUID!, async (token) => {
          const revisions = await drive.revisionIds(token, fileId);
          const sessionUrl = await drive.openUpdateSession(token, fileId, { mime: String(body.mime || rj.mediaPostMIME || 'application/octet-stream'), size, properties: { kit8Upload: uploadId } }, req.headers.get('Origin'));
          return { sessionUrl, oldRevisionId: revisions[revisions.length - 1] || '' };
        });
        await deps.serviceRpc('files_upload_pending_add', {
          p_org: a.organizationGUID, p_user: a.userGUID, p_upload: uploadId,
          p_json: { replaceOf: postGUID, scope: String(rj.fileSourceKind), scopeGUID: rj.fileSourceKind === 'organization' ? '' : String(row.data.rowParentGUID), projectGUID: rj.fileSourceProjectGUID || '', name: safeFileName(body.name || rj.fileName), mime: String(body.mime || rj.mediaPostMIME || 'application/octet-stream'), size, folderId: rj.googleDriveFolderId || '', relativePath: rj.googleDriveRelativePath || '', oldRevisionId: out.oldRevisionId, fileId, expiresAt: new Date(now() + UPLOAD_TTL_MS).toISOString() },
        });
        return json(200, { sessionUrl: out.sessionUrl, uploadId });
      }

      case 'replace_finish': {
        const uploadId = String(body.uploadId || '');
        const pend = uploadId ? await deps.serviceRpc('files_upload_pending_get', { p_upload: uploadId }) : null;
        if (!pend || !pend.replaceOf) return json(404, { error: 'No such upload.', code: 'noUpload' });
        const a = await ask('update', String(pend.scope), pend.scopeGUID || null, pend.projectGUID || null);
        if (a instanceof Response) return a;
        if (pend.organizationGUID !== a.organizationGUID || pend.userGUID !== a.userGUID) return json(403, { error: 'That upload is not yours.' });
        const item = await withDrive(a.organizationGUID!, (token) => drive.getItem(token, String(pend.fileId), 'id,size,mimeType,parents,properties'));
        if (item.properties?.kit8Upload !== uploadId) return json(404, { error: 'The new version is not finished (no new bytes yet).', code: 'notFinished' });
        if (pend.oldRevisionId) await withDrive(a.organizationGUID!, (token) => drive.keepRevision(token, String(pend.fileId), String(pend.oldRevisionId))).catch(() => undefined);
        await deps.serviceRpc('files_upload_pending_verify', { p_upload: uploadId, p_file_id: item.id, p_size: Number(item.size || 0), p_folder_id: item.parents?.[0] || pend.folderId || '', p_path: pend.relativePath || '' });
        const r = await deps.callerRpc(authorization, 'files_replace', { p_upload_id: uploadId, p_post: String(pend.replaceOf) });
        if (r.error) return json(409, { error: r.error });
        return json(200, { file: r.data });
      }

      case 'move': {
        const postGUID = String(body.postGUID || '');
        if (!postGUID) return json(400, { error: 'postGUID is required.' });
        const row = await deps.callerRpc(authorization, 'files_get', { p_post: postGUID });
        if (row.error || !row.data) return json(403, { error: row.error || 'No such file.' });
        const rj = row.data.rowJSON || {};
        const from = await ask('move', String(rj.fileSourceKind), rj.fileSourceKind === 'organization' ? null : String(row.data.rowParentGUID), rj.fileSourceProjectGUID || null);
        if (from instanceof Response) return from;
        const to = await ask('add', scope, guid, projectGUID);
        if (to instanceof Response) return to;
        const org = from.organizationGUID!;
        const moved = await withDrive(org, async (token) => {
          const f = await filesFolderFor(org, scope, guid || '', to.projectGUID || projectGUID || '', token);
          if ('error' in f) return f;
          const fileId = String(rj.googleDriveFileId || '');
          if (fileId) {
            const item = await drive.getItem(token, fileId);
            if (item.properties?.kit8OrganizationGUID !== org) throw new DriveError(403, 'notOurs', 'That file does not belong to this organization.');
            const oldParent = item.parents?.[0] || String(rj.googleDriveFolderId || '');
            if (oldParent && oldParent !== f.folderId) await drive.moveItem(token, fileId, f.folderId, oldParent);
          }
          return f;
        });
        if ('error' in moved) return moved.error;
        const r = await deps.callerRpc(authorization, 'files_move', { p_post: postGUID, p_scope: scope, p_guid: guid, p_project: projectGUID, p_folder_id: moved.folderId, p_relative_path: moved.path });
        if (r.error) return json(409, { error: r.error });
        return json(200, { file: r.data });
      }

      case 'health': {
        const a = await ask('connect', 'organization');
        if (a instanceof Response) return a;
        const org = a.organizationGUID!;
        const rows = await deps.callerRpc(authorization, 'files_health_rows', {});
        if (rows.error || !rows.data) return json(409, { error: rows.error || 'No answer.' });
        const known = new Map<string, any>((rows.data.files as any[]).map((f) => [String(f.fileId), f]));
        const folderIds = new Set<string>();
        for (const f of rows.data.folders as any[]) if (f.filesFolderId) folderIds.add(String(f.filesFolderId));
        for (const f of rows.data.files as any[]) if (f.folderId) folderIds.add(String(f.folderId));
        const seen = new Set<string>();
        const orphans: { fileId: string; name: string; folderId: string }[] = [];
        const unreadable = new Set<string>();
        await withDrive(org, async (token) => {
          for (const folderId of folderIds) {
            try {
              for (const item of await drive.list(token, `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`)) {
                if (item.mimeType === FOLDER_MIME) continue;
                seen.add(item.id);
                if (!known.has(item.id)) orphans.push({ fileId: item.id, name: String(item.name || ''), folderId });
              }
            } catch (e) {
              if (e instanceof DriveError && (e.status === 404 || e.status === 403)) unreadable.add(folderId);
              else throw e;
            }
          }
        });
        const missing = (rows.data.files as any[]).filter((f) => !seen.has(String(f.fileId)) && !unreadable.has(String(f.folderId))).map((f) => ({ post: f.post, fileId: f.fileId, name: f.name }));
        return json(200, { checkedFolders: folderIds.size, missing, orphans, unreadableFolders: [...unreadable] });
      }

      case 'health_repair': {
        const a = await ask('connect', 'organization');
        if (a instanceof Response) return a;
        const org = a.organizationGUID!;
        let rowsDeleted = 0;
        let orphansDeleted = 0;
        for (const post of (Array.isArray(body.missing) ? body.missing : []).slice(0, 500)) {
          const r = await deps.callerRpc(authorization, 'files_delete_row_only', { p_post: String(post) });
          if (!r.error) rowsDeleted++;
        }
        const ids = (Array.isArray(body.orphans) ? body.orphans : []).slice(0, 500).map(String);
        if (ids.length) {
          await withDrive(org, async (token) => {
            for (const id of ids) {
              const item = await drive.getItem(token, id).catch(() => null);
              if (item && item.properties?.kit8OrganizationGUID === org && item.mimeType !== FOLDER_MIME) {
                await drive.deleteItem(token, id);
                orphansDeleted++;
              }
            }
          });
        }
        return json(200, { rowsDeleted, orphansDeleted });
      }

      case 'delete_file': {
        const postGUID = String(body.postGUID || '');
        if (!postGUID) return json(400, { error: 'postGUID is required.' });
        const r = await deps.callerRpc(authorization, 'files_delete', { p_post: postGUID });
        if (r.error) return json(403, { error: r.error });
        // the row is gone and the Drive file is queued: work the queue now so the user does not wait for the tick
        const cleaned = await runCleanup();
        return json(200, { deleted: true, driveFileId: r.data?.driveFileId || null, cleanup: cleaned });
      }

      case 'cleanup': {
        const a = await ask('connect', 'organization');
        if (a instanceof Response) return a;
        return json(200, await runCleanup());
      }

      case 'disconnect': {
        const a = await ask('connect', 'organization');
        if (a instanceof Response) return a;
        await dropConnection(a.organizationGUID!);
        await deps.patchOrganization(a.organizationGUID!, { organizationGoogleDriveState: 'notConnected' });
        return json(200, { disconnected: true });
      }

      default:
        return json(400, { error: `Unknown action "${action}".` });
    }
  } catch (e) {
    if (e instanceof NeedsReconnectError) return json(409, { error: e.message, code: 'needsReconnect' });
    if (e instanceof DriveError) return json(e.status >= 400 && e.status < 600 ? e.status : 502, { error: e.message, reason: e.reason });
    return json(500, { error: String((e as Error)?.message || e).slice(0, 300) });
  }

  // ---- revoke the token at Google, forget it ------------------------------------------------------------------------------------------------------
  async function dropConnection(organization: string): Promise<void> {
    const conn = await deps.loadConnection(organization);
    if (conn?.refreshTokenEncrypted) {
      try {
        const refresh = await decryptToken(conn.refreshTokenEncrypted, cfg.tokenKey);
        await deps.fetchFn(GOOGLE_REVOKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refresh }).toString() });
      } catch {
        /* revoking is best effort: the stored token is deleted anyway */
      }
    }
    await deps.deleteConnection(organization);
    tokens.forget(organization);
  }

  // ---- the cleanup queue: delete what the database queued (bottom-up), mark done / failed; after an organization delete revoke and forget the token --------------------
  async function runCleanup(): Promise<{ done: number; failed: number; skipped: number }> {
    const lines: any[] = (await deps.serviceRpc('files_cleanup_pending', { p_limit: 20 })) || [];
    let done = 0;
    let failed = 0;
    let skipped = 0;
    const rootsDone = new Set<string>();
    for (const line of lines) {
      const org = String(line.organizationGUID);
      try {
        await withDrive(org, async (token) => {
          let item;
          try {
            item = await drive.getItem(token, line.driveItemId);
          } catch (e) {
            if (e instanceof DriveError && e.status === 404) return; // already gone = done
            throw e;
          }
          if (item.properties?.kit8OrganizationGUID !== org) throw new DriveError(403, 'notOurs', 'That item does not belong to this organization.');
          if (item.mimeType === FOLDER_MIME) await drive.deleteTreeBottomUp(token, line.driveItemId);
          else await drive.deleteItem(token, line.driveItemId);
        });
        await deps.serviceRpc('files_cleanup_done', { p_id: line.id });
        done++;
        if (line.allowRoot) rootsDone.add(org);
      } catch (e) {
        const waits = e instanceof NeedsReconnectError;
        await deps.serviceRpc('files_cleanup_failed', { p_id: line.id, p_error: String((e as Error)?.message || e) });
        if (waits) skipped++;
        else failed++;
      }
    }
    for (const org of rootsDone) await dropConnection(org); // the organization is gone: no token is kept
    return { done, failed, skipped };
  }

  // ---- the consent step comes back here: ?code=...&state=... ------------------------------------------------------------------------------------------
  async function connectCallback(u: URL): Promise<Response> {
    const back = (status: string, reason = '') => {
      const target = new URL(cfg.appReturnUrl);
      target.searchParams.set('filesConnect', status);
      if (reason) target.searchParams.set('reason', reason.slice(0, 120));
      return new Response(null, { status: 302, headers: { Location: target.toString() } });
    };
    if (u.searchParams.get('error')) return back('error', u.searchParams.get('error') || 'denied');
    const state = await verifyPayload(cfg.urlSecret, u.searchParams.get('state') || '');
    if (!state || typeof state.exp !== 'number' || state.exp < now()) return back('error', 'state expired - try again');
    const organization = String(state.org || '');
    const code = u.searchParams.get('code') || '';
    if (!organization || !code) return back('error', 'no code');

    const res = await deps.fetchFn(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.functionUrl }).toString(),
    });
    const tok: any = await res.json().catch(() => ({}));
    if (!res.ok || !tok.access_token) return back('error', String(tok.error_description || tok.error || `HTTP ${res.status}`));
    if (!tok.refresh_token) return back('error', 'Google sent no refresh token - remove the app at myaccount.google.com/permissions and connect again');
    if (!String(tok.scope || '').includes('drive.file')) return back('error', 'the drive.file permission was not granted');

    const accountEmail = (await drive.aboutUser(tok.access_token).catch(() => null)) || '';
    const iso = new Date(now()).toISOString();
    await deps.saveConnection(organization, {
      role: 'current', state: 'ok', accountEmail, refreshTokenEncrypted: await encryptToken(tok.refresh_token, cfg.tokenKey), lastRefreshAt: iso, lastError: null, connectedBy: String(state.user || ''),
    });
    tokens.prime(organization, tok.access_token, Number(tok.expires_in) || 3600);

    // kit8root: found by its marks (a reconnect never makes a second one), else created
    let root = await drive.findRootFolder(tok.access_token, organization);
    if (!root) root = await drive.createFolder(tok.access_token, 'kit8root', null, 'kit8 root folder of the organization', { kit8Kind: 'root', kit8OrganizationGUID: organization });
    await deps.patchOrganization(organization, {
      organizationGoogleDriveMode: 'adminProxy',
      organizationGoogleDriveState: 'ok',
      organizationGoogleDriveAccountEmail: accountEmail,
      organizationGoogleDriveLastRefreshAt: iso,
      organizationGoogleDriveRootFolderId: root.id,
      organizationGoogleDriveRootFolderUrl: folderUrl(root.id),
    });
    return back('ok');
  }

  // ---- the signed download: validate, then stream the file (Range passed through) ---------------------------------------------------------------------
  async function download(u: URL, request: Request): Promise<Response> {
    const organization = u.searchParams.get('org') || '';
    const fileId = u.searchParams.get('file') || '';
    const exp = Number(u.searchParams.get('exp'));
    const sig = u.searchParams.get('sig') || '';
    if (!organization || !fileId || !Number.isFinite(exp) || !(await verifyValue(cfg.urlSecret, `${organization}|${fileId}|${exp}`, sig))) return json(403, { error: 'The link is not valid.' });
    if (exp < now()) return json(403, { error: 'The link has expired.' });
    const range = request.headers.get('Range');
    const upstream = await drive.openMedia(await tokens.getAccessToken(organization), fileId, range);
    if (upstream.status === 401) return pass(await drive.openMedia(await tokens.getAccessToken(organization, true), fileId, range));
    return pass(upstream);
  }

  function pass(upstream: Response): Response {
    const headers = new Headers(CORS_HEADERS as any);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'content-disposition', 'etag', 'last-modified']) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes');
    return new Response(upstream.body, { status: upstream.status, headers });
  }
}
