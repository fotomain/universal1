// File attachments - the file picker: web = a hidden <input type=file>, phone = expo-document-picker (the file is read as a Blob: phase 1 keeps it in memory, MAX_UPLOAD_BYTES).
import { Platform } from 'react-native';
import type { PickedFile } from './filesDriveApi';

export const fromWebFile = (f: { name: string; type?: string; size: number }): PickedFile => ({ name: f.name, mime: f.type || '', size: f.size, blob: f as unknown as Blob });

export async function pickFiles(): Promise<PickedFile[]> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // Firefox: the input must be IN the document (a detached one is garbage collected before "change" fires, or click() is ignored) and stay there until it answers
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
      let done = false;
      const finish = (files: PickedFile[]) => {
        if (done) return;
        done = true;
        input.remove();
        resolve(files);
      };
      input.addEventListener('change', () => finish(Array.from(input.files || []).map((f) => fromWebFile(f))));
      input.addEventListener('cancel', () => finish([]));
      document.body.appendChild(input);
      input.click();
    });
  }
  const DocumentPicker = await import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
  if (res.canceled) return [];
  return Promise.all(res.assets.map(async (a: any) => {
    const blob = await (await fetch(a.uri)).blob();
    return { name: a.name, mime: a.mimeType || blob.type || '', size: a.size ?? blob.size, blob } as PickedFile;
  }));
}
