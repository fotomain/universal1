// Keeps a finished recording: native = a file in the document directory of the app (the camera / recorder writes into
// the cache, which the system may empty). The web twin is mediaFileStore.web.ts (IndexedDB).
import { Directory, File, Paths } from 'expo-file-system';
import { extensionOf, MediaKind } from './mediaSource';

const MEDIA_DIR = 'media';

// the native classes of expo-file-system; their typings differ between the web and the native build (tsconfig moduleSuffixes)
type NativeFile = { uri: string; exists: boolean; copy(destination: unknown): void; delete(): void };
type NativeDirectory = { create(options?: { intermediates?: boolean; idempotent?: boolean }): void };

function storedName(kind: MediaKind, ext: string): string {
  return `kit8${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
}

/** copies the recording out of the cache and returns the uri of the kept file */
export async function persistRecording(sourceUri: string, kind: MediaKind): Promise<string> {
  const ext = extensionOf(sourceUri) || (kind === 'audio' ? 'm4a' : 'mp4');
  const dir = new Directory(Paths.document, MEDIA_DIR) as unknown as NativeDirectory;
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir as never, storedName(kind, ext)) as unknown as NativeFile;
  (new File(sourceUri) as unknown as NativeFile).copy(target);
  return target.uri;
}

/** a stored uri -> something a player can open (native: the same uri) */
export async function resolveMediaUri(uri: string): Promise<string> {
  return uri;
}

/** removes a kept recording (a post was deleted); never throws */
export async function deleteStoredMedia(uri: string): Promise<void> {
  try {
    const file = new File(uri) as unknown as NativeFile;
    if (file.exists) file.delete();
  } catch {
    // already gone
  }
}
