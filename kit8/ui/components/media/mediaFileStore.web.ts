// Web twin of mediaFileStore.ts: a blob url dies with the tab, so the recording is kept in IndexedDB and the post
// stores `kit8media://<id>.<ext>`; resolveMediaUri turns it back into a playable object url.
import { extensionOf, MEDIA_STORE_SCHEME, MediaKind } from './mediaSource';

const DB_NAME = 'kit8media';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

const objectUrls = new Map<string, string>();

function extensionOfBlob(blob: Blob, kind: MediaKind): string {
  const type = (blob.type || '').toLowerCase();
  if (type.includes('mp4')) return kind === 'audio' ? 'm4a' : 'mp4';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('wav')) return 'wav';
  if (type.includes('mpeg')) return 'mp3';
  return 'webm';
}

/** keeps the blob behind a blob: url; returns kit8media://<id>.<ext>, or the blob url itself when IndexedDB is not available */
export async function persistRecording(sourceUri: string, kind: MediaKind): Promise<string> {
  if (typeof indexedDB === 'undefined') return sourceUri;
  const blob = await (await fetch(sourceUri)).blob();
  const ext = extensionOf(sourceUri) || extensionOfBlob(blob, kind);
  const id = `kit8${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  await request('readwrite', (store) => store.put(blob, id));
  return `${MEDIA_STORE_SCHEME}${id}`;
}

export async function resolveMediaUri(uri: string): Promise<string> {
  if (!uri.startsWith(MEDIA_STORE_SCHEME)) return uri;
  const id = uri.substring(MEDIA_STORE_SCHEME.length);
  const cached = objectUrls.get(id);
  if (cached) return cached;
  const blob = await request<Blob | undefined>('readonly', (store) => store.get(id) as IDBRequest<Blob | undefined>);
  if (!blob) throw new Error('The recording is no longer stored in this browser.');
  const url = URL.createObjectURL(blob);
  objectUrls.set(id, url);
  return url;
}

export async function deleteStoredMedia(uri: string): Promise<void> {
  if (!uri.startsWith(MEDIA_STORE_SCHEME)) return;
  const id = uri.substring(MEDIA_STORE_SCHEME.length);
  try {
    await request('readwrite', (store) => store.delete(id));
    const url = objectUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    objectUrls.delete(id);
  } catch {
    // already gone
  }
}
