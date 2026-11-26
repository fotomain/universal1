// The bytes of a kept recording as a Blob (for the upload to the file storage). Pure of React / redux.
import { resolveMediaUri } from './mediaFileStore';

/** the bytes of a kept file as a Blob: a recording of this browser lives in IndexedDB (object url), a phone file is read by its address */
export async function readRecordingBlob(uri: string, fetchFn: typeof fetch = fetch, resolve: (u: string) => Promise<string> = resolveMediaUri): Promise<Blob> {
  const blob = await (await fetchFn(await resolve(uri))).blob();
  if (!blob || !(blob.size > 0)) throw new Error('The recorded file is empty.');
  return blob;
}
