// The owner photo of an ID card / passport -> the file storage of the organization (Google Drive / OneDrive), through the files-drive function:
//   <kit8 root> / identification / idcard | passport / <media post guid>.<jpg | jp2>
// The scope `identification` (SQL files_authorize): p_guid = the media post made from the reading; only its author adds / reads it. Pure helpers + one upload call.
import { uploadPickedFile, type ApiResult, type PickedFile } from './filesDriveApi';
import type { FileRow } from './fileModel';

export interface IdentificationPhoto {
  mime: string;
  bytes: Uint8Array;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/jp2': 'jp2', 'image/png': 'png', 'image/webp': 'webp' };

/** `<post guid>.jpg` - the file is named by the post */
export const identificationFileName = (postGUID: string, mime: string): string => `${postGUID}.${EXT[mime.toLowerCase()] ?? 'jpg'}`;

/** the folder the photo goes to, for the words shown to the user */
export const identificationPath = (folder: 'idcard' | 'passport'): string => `identification/${folder}`;

/**
 * React Native cannot build a Blob from a typed array, and Android cannot `fetch` a data address (the owner photo of the real card never reached the storage,
 * 2026-11-23: no upload session was even opened). What works on a phone is the way the Files tab reads a picked file: write the bytes to a file of the cache,
 * `fetch(file uri)`, take the blob, delete the file.
 */
export async function blobViaTempFile(bytes: Uint8Array, mime: string, fetchFn: typeof fetch = fetch): Promise<Blob> {
  const { File, Paths } = require('expo-file-system') as any; // lazy: a web build / a node test never needs it
  const file = new File(Paths.cache, `idphoto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.bin`);
  try {
    if (!file.exists) file.create?.();
    file.write(bytes);
    const blob: Blob = await (await fetchFn(file.uri)).blob();
    if (!blob || !(blob.size > 0)) throw new Error('The photo file could not be read.');
    return mime ? (blob.type === mime ? blob : (blob as any).slice(0, blob.size, mime)) : blob;
  } finally {
    try { file.delete(); } catch { /* already gone */ }
  }
}

/** a Blob of the bytes: a browser makes it directly; on a phone it goes through a file of the cache, the last resort is a data address */
export async function blobOfBytes(
  bytes: Uint8Array,
  mime: string,
  toBase64: (b: Uint8Array) => string,
  fetchFn: typeof fetch = fetch,
  viaFile: (b: Uint8Array, m: string, f: typeof fetch) => Promise<Blob> = blobViaTempFile,
): Promise<Blob> {
  try {
    return new Blob([bytes as any], { type: mime });
  } catch {
    // not a browser
  }
  try {
    return await viaFile(bytes, mime, fetchFn);
  } catch {
    return (await fetchFn(`data:${mime};base64,${toBase64(bytes)}`)).blob();
  }
}

/** uploads the face image of the document; never throws, answers { ok, file } or { ok: false, error } */
export async function uploadIdentificationPhoto(
  postGUID: string,
  photo: IdentificationPhoto,
  toBase64: (b: Uint8Array) => string,
  upload: typeof uploadPickedFile = uploadPickedFile,
): Promise<ApiResult<{ file: FileRow }>> {
  try {
    if (!photo.bytes?.length) return { ok: false, error: 'The photo is empty.' };
    const blob = await blobOfBytes(photo.bytes, photo.mime, toBase64);
    const file: PickedFile = { name: identificationFileName(postGUID, photo.mime), mime: photo.mime, size: photo.bytes.length, blob };
    return await upload({ scope: 'identification', guid: postGUID }, file);
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * A post made with the Add form is written to the database a moment AFTER the form closes (optimistic list, the saga writes it): the upload of its photo is refused until the
 * post exists ("files_authorize": the post is read by its guid). So the upload is tried again a few times; the first answer that is ok (or the last one) is returned.
 */
export async function uploadIdentificationPhotoWithRetry(
  postGUID: string,
  photo: IdentificationPhoto,
  toBase64: (b: Uint8Array) => string,
  opts: { attempts?: number; delayMs?: number; upload?: typeof uploadIdentificationPhoto; sleep?: (ms: number) => Promise<void> } = {},
): Promise<ApiResult<{ file: FileRow }>> {
  const { attempts = 4, delayMs = 1500, upload = uploadIdentificationPhoto, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = opts;
  let last: ApiResult<{ file: FileRow }> = { ok: false, error: 'The photo was not uploaded.' };
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(delayMs);
    last = await upload(postGUID, photo, toBase64);
    if (last.ok) return last;
  }
  return last;
}
