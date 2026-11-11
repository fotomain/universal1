// File attachments - the pure model (documentation/FILE_ATTACHMENT_WBS.html, sections 6, 7, 9): no React, no network, so a Jest test and the Edge Function tests share its rules.
export const FILES_TAB_ID = 'TabFiles';
export const FILES_FUNCTION = 'files-drive';

export type FileScope = 'organization' | 'project' | 'stage' | 'task' | 'document';
export type FileKind = 'text' | 'markdown' | 'audio' | 'video' | 'pdf' | 'image' | 'other';
export type DriveState = 'notConnected' | 'ok' | 'needsReconnect';

export interface FileRowJSON {
  fileSourceKind?: FileScope;
  fileSourceProjectGUID?: string;
  mediaPostTitle?: string;
  mediaPostDescription?: string;
  paperDocumentPlace?: string;
  fileDocumentTypeGUID?: string;
  mediaPostOriginType?: 'googleDrive' | 'url' | 'file';
  mediaPostOrigin?: string;
  googleDriveFileId?: string;
  fileName?: string;
  mediaPostMIME?: string;
  fileSizeBytes?: number;
  fileKind?: FileKind;
  fileUploadedByGUID?: string;
  fileUploadedAt?: string;
  fileVersionNumber?: number;
  [key: string]: any;
}

export interface FileRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: FileRowJSON;
}

/** the project switch: TRUE unless it is stored false (the same rule as the SQL vendor_project_setting) */
export const filesEnabledOfProject = (projectJSON: Record<string, any> | null | undefined): boolean => projectJSON?.filesFunctionalityEnabled !== false;

/** the kind of a file from its MIME type / name - the same rule as the SQL function files_kind_of */
export function fileKindOf(mime: string | null | undefined, name: string | null | undefined): FileKind {
  const m = String(mime || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  if (/\.(md|markdown)$/.test(n)) return 'markdown';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (m.startsWith('text/') || /\.(txt|csv|json|log|xml)$/.test(n)) return 'text';
  return 'other';
}

export const FILE_KIND_ICON: Record<FileKind, string> = {
  text: 'description', markdown: 'description', audio: 'audiotrack', video: 'videocam', pdf: 'picture_as_pdf', image: 'image', other: 'attach_file',
};

export function formatBytes(bytes: number | null | undefined): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;
  return `${(n / 1073741824).toFixed(1)} GB`;
}

export const fileTitleOf = (row: FileRow): string => row.rowJSON.mediaPostTitle || row.rowJSON.fileName || row.rowJSON.mediaPostOrigin || '';

/** a link row (an address, no Drive file) */
export const isLinkRow = (row: FileRow): boolean => row.rowJSON.mediaPostOriginType === 'url' || !row.rowJSON.googleDriveFileId;

/** the biggest file phase 1 sends (the file is read into memory by a phone): 100 MB, Q6 of the plan */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** a chunk of an upload: a multiple of 256 KB (Google's rule); 4 MB */
export const UPLOAD_CHUNK_BYTES = 16 * 262144;

export interface ChunkRange { start: number; end: number; contentRange: string }

/** the pieces of a file with the Content-Range header of each: [start, end) */
export function chunkRanges(total: number, chunk = UPLOAD_CHUNK_BYTES): ChunkRange[] {
  const out: ChunkRange[] = [];
  if (!(total > 0)) return out;
  for (let start = 0; start < total; start += chunk) {
    const end = Math.min(start + chunk, total);
    out.push({ start, end, contentRange: `bytes ${start}-${end - 1}/${total}` });
  }
  return out;
}

/** the words of the connection state for the Files tab (English; pmT translates where it is shown) */
export function driveStateText(state: DriveState | string | null | undefined, accountEmail?: string | null): string {
  if (state === 'ok') return accountEmail ? `Google Drive: connected as ${accountEmail}` : 'Google Drive: connected';
  if (state === 'needsReconnect') return 'Google Drive is disconnected - reconnect';
  return 'Google Drive is not connected';
}

/** the sentence of a refusal of the database / the function, for people */
export function filesErrorText(reason: string | null | undefined, fallback = 'The action was refused.'): string {
  switch (reason) {
    case 'noPermission': return 'You have no permission to change files here.';
    case 'switchOff': return 'The files function is switched off in the settings of this project.';
    case 'signIn': return 'Sign in first.';
    case 'notConnected': return 'Google Drive is not connected - ask the administrator.';
    case 'needsReconnect': return 'Google Drive is disconnected - an administrator must reconnect it.';
    default: return fallback;
  }
}
