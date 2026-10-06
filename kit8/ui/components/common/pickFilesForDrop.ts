// "Choose file…" fallback of ReceiveDraggableFilesComponent (phones, or no drag source at hand).
//   web:            a hidden <input type="file"> - the File objects come back as DroppedFileItem.blob
//   iOS / Android:  expo-document-picker (copied to the cache, so the uri stays readable)
import { Platform } from 'react-native';
import type { DroppedFileItem } from './ReceiveDraggableFilesComponent.types';

export interface PickFilesOptions {
  /** web <input accept>, e.g. ".json,application/json" */
  accept?: string;
  /** native picker types, e.g. ["application/json"] (default: any file) */
  mimeTypes?: string[];
  multiple?: boolean;
}

export async function pickFilesForDrop(options: PickFilesOptions = {}): Promise<DroppedFileItem[]> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return [];
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (options.accept) input.accept = options.accept;
      input.multiple = !!options.multiple;
      input.style.display = 'none';
      input.onchange = () => {
        const files = Array.from(input.files || []);
        input.remove();
        resolve(files.map((file) => ({ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, blob: file })));
      };
      document.body.appendChild(input);
      input.click();
    });
  }
  const DocumentPicker = require('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({
    type: options.mimeTypes?.length ? options.mimeTypes : '*/*',
    multiple: !!options.multiple,
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets) return [];
  return res.assets.map((a: any) => ({ name: a.name, uri: a.uri, mimeType: a.mimeType || 'application/octet-stream', size: a.size }));
}
