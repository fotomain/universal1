// File attachments - the app side of the Edge Function files-drive and of the files_ RPCs (kit8/sql/start PART 49). The Supabase client is loaded when a call is made, so importing this
// file (a screen, a test) never creates it. The function answers { error, code | reason }; every call here returns { ok, ... } and never throws.
import { chunkRanges, filesErrorText, fileKindOf, MAX_UPLOAD_BYTES, FILES_FUNCTION, type FileRow, type FileScope, type FileStorageProvider } from './fileModel';

// require, not import(): Jest cannot run a dynamic import, and the client is still created only when a call is made
const client = async () => require('../supabase/supabase').supabase;

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

/** the answer of supabase.functions.invoke({ data, error }): a refusal carries the JSON of the function in error.context (a Response) */
export async function functionResultOf(res: { data?: any; error?: any } | null | undefined): Promise<ApiResult<{ data: any }>> {
  if (!res) return { ok: false, error: 'No answer from the files function.' };
  if (res.error) {
    let body: any = res.data;
    try {
      if (!body && typeof res.error?.context?.json === 'function') body = await res.error.context.json();
    } catch {
      body = null;
    }
    const code = body?.code || body?.reason;
    return { ok: false, error: filesErrorText(code, body?.error || res.error?.message || String(res.error)), code };
  }
  if (res.data?.error) return { ok: false, error: filesErrorText(res.data.code || res.data.reason, String(res.data.error)), code: res.data.code || res.data.reason };
  return { ok: true, data: res.data };
}

export async function invokeFiles(action: string, body: Record<string, any> = {}): Promise<ApiResult<{ data: any }>> {
  try {
    const sb = await client();
    return await functionResultOf(await sb.functions.invoke(FILES_FUNCTION, { body: { action, ...body } }));
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function rpc<T = any>(fn: string, args: Record<string, any>): Promise<ApiResult<{ data: T }>> {
  try {
    const sb = await client();
    const { data, error } = await sb.rpc(fn, args);
    if (error) return { ok: false, error: filesErrorText(/\(([A-Za-z]+)\)/.exec(error.message || '')?.[1], error.message || String(error)) };
    return { ok: true, data: data as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export interface DriveStatus {
  state: 'notConnected' | 'ok' | 'needsReconnect'; accountEmail: string | null; lastRefreshAt: string | null; rootFolderUrl: string | null; cleanup: { waiting: number; failed: number };
  /** which storage this is about; providerConfigured = the server has its client id; secretExpires = the date of the Microsoft client secret (YYYY-MM-DD) */
  provider?: FileStorageProvider; providerConfigured?: boolean; secretExpires?: string | null;
}

/** the connection of ONE storage (default Google Drive: the function's default) */
export const fetchDriveStatus = (provider?: FileStorageProvider) => invokeFiles('status', provider ? { provider } : {}) as Promise<ApiResult<{ data: DriveStatus }>>;
/** both storages in one answer */
export const fetchAllDriveStatus = () => invokeFiles('status', { provider: 'all' }) as Promise<ApiResult<{ data: { googleDrive: DriveStatus; oneDrive: DriveStatus } }>>;
export const startDriveConnect = (provider?: FileStorageProvider) => invokeFiles('connect_start', provider ? { provider } : {}) as Promise<ApiResult<{ data: { url: string } }>>;
export const disconnectDrive = (provider?: FileStorageProvider) => invokeFiles('disconnect', provider ? { provider } : {});
export const runDriveCleanup = () => invokeFiles('cleanup');
export const fetchDownloadUrl = (postGUID: string) => invokeFiles('download_url', { postGUID }) as Promise<ApiResult<{ data: { url: string; name?: string; mimeType?: string; size?: number } }>>;
export const deleteFileRow = (postGUID: string) => invokeFiles('delete_file', { postGUID });

export interface FileTarget { scope: FileScope; guid?: string | null; projectGUID?: string | null }

export const listFiles = (t: FileTarget) => rpc<FileRow[]>('files_list', { p_scope: t.scope, p_guid: t.guid ?? null, p_project: t.projectGUID ?? null });
export const authorizeFiles = (action: string, t: FileTarget) => rpc<{ allowed: boolean; reason?: string }>('files_authorize', { p_action: action, p_scope: t.scope, p_guid: t.guid ?? null, p_project: t.projectGUID ?? null });
export const addLink = (t: FileTarget, url: string, title?: string) => rpc<FileRow>('files_add_link', { p_scope: t.scope, p_guid: t.guid ?? null, p_project: t.projectGUID ?? null, p_url: url, p_title: title ?? null });
export const updateFile = (postGUID: string, patch: Record<string, any>) => rpc<FileRow>('files_update', { p_post: postGUID, p_patch: patch });
export const reorderFiles = (postGUIDs: string[]) => rpc<null>('files_reorder', { p_posts: postGUIDs });
export const countFilesForDelete = (kind: 'task' | 'project' | 'organization', guid?: string | null) => rpc<number>('files_count_for_delete', { p_kind: kind, p_guid: guid ?? null });

/** a file the user picked: a web File / Blob, or a phone file read as a Blob (phase 1: the whole file is in memory, at most MAX_UPLOAD_BYTES) */
export interface PickedFile { name: string; mime: string; size: number; blob: Blob }

export interface UploadHooks { onProgress?: (fraction: number) => void; signal?: { aborted: boolean } }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** the id of the item in the answer of the last fragment (OneDrive and Google both answer the driveItem / file); undefined when the answer cannot be read */
async function itemIdOf(res: Response): Promise<string | undefined> {
  try {
    const j = await res.clone().json();
    return typeof j?.id === 'string' ? j.id : undefined;
  } catch {
    return undefined;
  }
}

/** session (function) -> chunks straight to Google (no token) -> finish (function: the file is found by its uploadId, verified, registered) */
export async function uploadPickedFile(target: FileTarget, file: PickedFile, hooks: UploadHooks = {}, fetchFn: typeof fetch = fetch): Promise<ApiResult<{ file: FileRow }>> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'The file is bigger than 100 MB.' };
  if (!(file.size > 0)) return { ok: false, error: 'The file is empty.' };
  const mime = file.mime || 'application/octet-stream';
  const session = await invokeFiles('upload_session', { scope: target.scope, guid: target.guid ?? null, projectGUID: target.projectGUID ?? null, name: file.name, mime, size: file.size });
  if (!session.ok) return session;
  const { sessionUrl, uploadId } = session.data as { sessionUrl: string; uploadId: string };
  let itemId: string | undefined;
  try {
    for (const r of chunkRanges(file.size)) {
      if (hooks.signal?.aborted) return { ok: false, error: 'Cancelled.' };
      const res = await fetchFn(sessionUrl, { method: 'PUT', headers: { 'Content-Range': r.contentRange }, body: file.blob.slice(r.start, r.end) });
      // Google: 308 = more is expected; OneDrive: 202 (ok); 200 / 201 = the last chunk. The answer of the last chunk may be unreadable in a browser: Google finds the file by its uploadId
      if (res.status !== 308 && !res.ok) return { ok: false, error: `The storage refused the upload (HTTP ${res.status}).` };
      if (res.status === 200 || res.status === 201) itemId = await itemIdOf(res); // OneDrive: the driveItem of the last answer - the function verifies it (folder + size)
      hooks.onProgress?.(r.end / file.size);
    }
  } catch (e: any) {
    // the last chunk may have reached Google although the browser could not read the answer: finish decides
    if (!(e instanceof TypeError)) return { ok: false, error: e?.message || String(e) };
  }
  let last: ApiResult<{ data: any }> = { ok: false, error: 'The upload is not finished.' };
  for (let i = 0; i < 4; i++) {
    last = await invokeFiles('upload_finish', { uploadId, ...(itemId ? { itemId } : {}), file: { title: file.name, kind: fileKindOf(mime, file.name) } });
    if (last.ok || (last.code !== 'notFinished')) break;
    await sleep(1000 * (i + 1));
  }
  if (!last.ok) return last;
  return { ok: true, file: last.data.file as FileRow };
}

// ---- S4 replace, S7 move, S1 health check, S8 storage, document types (S5) ---------------------------------------------------------------------------------------------------------

export interface FileVersion { rowGUID: string; rowJSON: { version: number; driveRevisionId?: string; fileName?: string; fileSizeBytes?: number; replacedAt?: string } }
export const listVersions = (postGUID: string) => rpc<FileVersion[]>('files_versions_list', { p_post: postGUID });

export interface StorageUsed { files: number; bytes: number; oldVersionBytes: number; totalBytes: number; limitMegabytes: number | null }
export const fetchStorageUsed = (scope: 'organization' | 'project' = 'organization', guid?: string | null) => rpc<StorageUsed>('files_storage_used', { p_scope: scope, p_guid: guid ?? null });

/** a new version of a file: an UPDATE session on the same Drive file -> chunks straight to Google -> finish (the old revision is kept, the version goes up) */
export async function replacePickedFile(row: FileRow, file: PickedFile, hooks: UploadHooks = {}, fetchFn: typeof fetch = fetch): Promise<ApiResult<{ file: FileRow }>> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'The file is bigger than 100 MB.' };
  if (!(file.size > 0)) return { ok: false, error: 'The file is empty.' };
  const session = await invokeFiles('replace_session', { postGUID: row.rowGUID, name: file.name, mime: file.mime || 'application/octet-stream', size: file.size });
  if (!session.ok) return session;
  const { sessionUrl, uploadId } = session.data as { sessionUrl: string; uploadId: string };
  let itemId: string | undefined;
  try {
    for (const r of chunkRanges(file.size)) {
      if (hooks.signal?.aborted) return { ok: false, error: 'Cancelled.' };
      const res = await fetchFn(sessionUrl, { method: 'PUT', headers: { 'Content-Range': r.contentRange }, body: file.blob.slice(r.start, r.end) });
      if (res.status !== 308 && !res.ok) return { ok: false, error: `The storage refused the upload (HTTP ${res.status}).` };
      if (res.status === 200 || res.status === 201) itemId = await itemIdOf(res);
      hooks.onProgress?.(r.end / file.size);
    }
  } catch (e: any) {
    if (!(e instanceof TypeError)) return { ok: false, error: e?.message || String(e) };
  }
  let last: ApiResult<{ data: any }> = { ok: false, error: 'The upload is not finished.' };
  for (let i = 0; i < 4; i++) {
    last = await invokeFiles('replace_finish', { uploadId, ...(itemId ? { itemId } : {}) });
    if (last.ok || last.code !== 'notFinished') break;
    await sleep(1000 * (i + 1));
  }
  if (!last.ok) return last;
  return { ok: true, file: last.data.file as FileRow };
}

/** move a file to another scope (task / stage / project / organization / document): the Drive file moves too, the id and the url stay */
export const moveFile = (postGUID: string, to: FileTarget) => invokeFiles('move', { postGUID, scope: to.scope, guid: to.guid ?? null, projectGUID: to.projectGUID ?? null }) as Promise<ApiResult<{ data: { file: FileRow } }>>;

export interface HealthReport { checkedFolders: number; missing: { post: string; fileId: string; name: string }[]; orphans: { fileId: string; name: string; folderId: string }[]; unreadableFolders: string[] }
export const runHealthCheck = (provider?: FileStorageProvider) => invokeFiles('health', provider ? { provider } : {}) as Promise<ApiResult<{ data: HealthReport }>>;
export const repairHealth = (missing: string[], orphans: string[], provider?: FileStorageProvider) => invokeFiles('health_repair', { missing, orphans, ...(provider ? { provider } : {}) }) as Promise<ApiResult<{ data: { rowsDeleted: number; orphansDeleted: number } }>>;

export interface DocumentType { rowGUID: string; rowOwnerGUID: string; rowJSON: { title: string } }
export async function listDocumentTypes(): Promise<ApiResult<{ data: DocumentType[] }>> {
  try {
    const sb = await client();
    const { data, error } = await sb.from('files_document_type_catalog').select('rowGUID,rowOwnerGUID,rowJSON,orderInList').order('orderInList');
    if (error) return { ok: false, error: error.message || String(error) };
    return { ok: true, data: (data || []) as DocumentType[] };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
