// The files of a recording / a photo -> the file storage of the organization (Google Drive / OneDrive) through the files-drive function:
//   <kit8 root> / media / video | audio | photo / <media post guid>[-n].<ext>          (scope `recording`, SQL files_authorize: p_guid = the media post, rowJSON.recordingFolder)
// Only the AUTHOR of the post adds / reads the files. The post keeps the address of every file (`googleDriveURLToFile` = the first, `mediaDriveFiles` = all, in the order of the
// parts of the recording) and the guid of the file row, which is what the player asks the function for (a Drive page address cannot be played by a <video>; the function streams the file).
import { uploadPickedFile, deleteFileRow, type ApiResult, type PickedFile } from './filesDriveApi';
import type { FileRow } from './fileModel';

export type RecordingFolder = 'audio' | 'video' | 'photo';

/** what the post keeps of one uploaded file */
export interface DriveFileRef {
  /** the guid of the file row (mediaPostTable, fileSourceKind recording): the player asks `download_url` with it */
  fileRowGUID: string;
  /** the address of the file in the storage (Google Drive: https://drive.google.com/file/d/<id>/view) */
  googleDriveURLToFile: string;
}

export interface RecordingFileInput {
  /** where the file is on this device / browser (file://, kit8media://, blob:) */
  uri: string;
  /** used when the blob has no type */
  fallbackMime: string;
  /** extension without the dot */
  ext: string;
}

/** `<post guid>.mp4` for the first part, `<post guid>-2.mp4` for the second ... (the function keeps a name that starts with the post guid) */
export const recordingFileName = (postGUID: string, index: number, ext: string): string => `${postGUID}${index > 0 ? `-${index + 1}` : ''}.${(ext || 'bin').toLowerCase()}`;

/** the words for the folder, for the messages */
export const recordingPath = (folder: RecordingFolder): string => `media/${folder}`;

/** the address of the file in its storage, from the file row the function made */
export const driveUrlOfFileRow = (row: FileRow): string => String(row.rowJSON?.oneDriveWebUrl || row.rowJSON?.mediaPostOrigin || '');

export const driveRefOfFileRow = (row: FileRow): DriveFileRef => ({ fileRowGUID: row.rowGUID, googleDriveURLToFile: driveUrlOfFileRow(row) });

/** the Drive files of a post row, in the order of its parts ([] = nothing uploaded) */
export function driveFilesOfPost(rowJSON: Record<string, any> | null | undefined): DriveFileRef[] {
  const list = rowJSON?.mediaDriveFiles;
  if (!Array.isArray(list)) return [];
  return list.filter((f: any) => f && typeof f.fileRowGUID === 'string' && f.fileRowGUID).map((f: any) => ({ fileRowGUID: String(f.fileRowGUID), googleDriveURLToFile: String(f.googleDriveURLToFile || '') }));
}

/** the rowJSON of the post after a successful upload */
export function recordingDriveUploaded(rowJSON: Record<string, any>, refs: DriveFileRef[]): Record<string, any> {
  const { mediaDriveError: _error, ...rest } = rowJSON;
  return { ...rest, googleDriveURLToFile: refs[0]?.googleDriveURLToFile || '', mediaDriveFiles: refs, mediaDriveState: 'uploaded', mediaDriveUploadedAt: new Date().toISOString() };
}

/** the rowJSON of the post after a failed upload: the post stays playable from the file of the device */
export function recordingDriveFailed(rowJSON: Record<string, any>, error: string): Record<string, any> {
  return { ...rowJSON, mediaDriveState: 'failed', mediaDriveError: String(error || 'The upload failed.').slice(0, 300) };
}

export interface UploadRecordingDeps {
  /** the bytes of a file of this device / browser as a Blob */
  readBlob: (uri: string) => Promise<Blob>;
  upload?: typeof uploadPickedFile;
  remove?: typeof deleteFileRow;
  sleep?: (ms: number) => Promise<void>;
  /** how many times the FIRST upload is tried while the post is not yet visible to the database (reason `scope`) */
  attempts?: number;
  delayMs?: number;
  onProgress?: (fraction: number) => void;
}

/**
 * Uploads every part of the recording; all or nothing: when a part fails, the parts that already went are removed again (best effort) and the first error is returned.
 * A post written through the saga appears in the database a moment AFTER the form closes: while the answer is `scope` (no such post yet) the upload is tried again.
 */
export async function uploadRecordingFiles(postGUID: string, files: RecordingFileInput[], deps: UploadRecordingDeps): Promise<ApiResult<{ refs: DriveFileRef[] }>> {
  const { upload = uploadPickedFile, remove = deleteFileRow, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)), attempts = 4, delayMs = 1500 } = deps;
  if (!files.length) return { ok: false, error: 'There is no file to upload.' };
  const done: FileRow[] = [];
  const rollback = async () => { for (const row of done) { try { await remove(row.rowGUID); } catch { /* the cleanup of the database queue does the rest */ } } };
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const blob = await deps.readBlob(f.uri);
      const mime = String(blob.type || f.fallbackMime || 'application/octet-stream').split(';')[0].trim();
      const picked: PickedFile = { name: recordingFileName(postGUID, i, f.ext), mime, size: blob.size, blob };
      let result: ApiResult<{ file: FileRow }> = { ok: false, error: 'The file was not uploaded.' };
      for (let a = 0; a < (i === 0 ? attempts : 1); a++) {
        if (a > 0) await sleep(delayMs);
        result = await upload({ scope: 'recording', guid: postGUID }, picked, { onProgress: (x) => deps.onProgress?.((i + x) / files.length) });
        if (result.ok || (result as any).code !== 'scope') break;
      }
      if (!result.ok) { await rollback(); return result; }
      done.push(result.file);
    }
  } catch (e: any) {
    await rollback();
    return { ok: false, error: e?.message || String(e) };
  }
  return { ok: true, refs: done.map(driveRefOfFileRow) };
}
