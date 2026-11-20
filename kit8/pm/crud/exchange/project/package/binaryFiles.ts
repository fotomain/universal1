// Binary files of the project package: save a zip for the user, read a dropped / picked one.
//   web:      download (Blob + <a download>) / File.arrayBuffer
//   iOS:      written to the app cache (expo-file-system) and handed to the share sheet ("Save to Files", AirDrop ...)
//   Android:  the user picks a folder once (Storage Access Framework) and the file is written there (Share cannot carry a binary file without expo-sharing)
// NOT tried on a real phone (2026-11-20); the whole package is held in memory, so a very large model is a web job.
import { Platform, Share } from 'react-native';
import type { DroppedFileItem } from '../../../../../ui/components/common/ReceiveDraggableFilesComponent.types';
import { base64ToArrayBuffer } from '../../../../bim/bimc/base64';
import type { PMDownloadResult } from '../export/downloadTextFile';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** bytes -> base64 without btoa / Buffer (every platform) */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const a = bytes[i], b = i + 1 < n ? bytes[i + 1] : 0, c = i + 2 < n ? bytes[i + 2] : 0;
    const t = (a << 16) | (b << 8) | c;
    out += B64[(t >> 18) & 63] + B64[(t >> 12) & 63] + (i + 1 < n ? B64[(t >> 6) & 63] : '=') + (i + 2 < n ? B64[t & 63] : '=');
  }
  return out;
}

export async function downloadBinaryFile(fileName: string, bytes: Uint8Array, mimeType = 'application/zip'): Promise<PMDownloadResult> {
  if (Platform.OS === 'web') {
    const blob = new Blob([bytes as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }
  const FileSystem = require('expo-file-system/legacy');
  const base64 = bytesToBase64(bytes);
  if (Platform.OS === 'android') {
    const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return 'dismissed';
    const uri = await FileSystem.StorageAccessFramework.createFileAsync(perm.directoryUri, fileName.replace(/\.zip$/i, ''), mimeType);
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return 'downloaded';
  }
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  const res = await Share.share({ url: uri }, { dialogTitle: fileName });
  return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
}

/** the bytes of a file from ReceiveDraggableFilesComponent (drop or "Choose file…") */
export async function readDroppedFileBytes(file: DroppedFileItem): Promise<Uint8Array> {
  if (file.blob) {
    const b: any = file.blob;
    if (typeof b.arrayBuffer === 'function') return new Uint8Array(await b.arrayBuffer());
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(file.blob as Blob);
    });
  }
  if (file.base64) return new Uint8Array(base64ToArrayBuffer(file.base64));
  if (file.uri) {
    if (/^(https?:|blob:|data:)/.test(file.uri)) return new Uint8Array(await (await fetch(file.uri)).arrayBuffer());
    const FileSystem = require('expo-file-system/legacy');
    const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
    return new Uint8Array(base64ToArrayBuffer(b64));
  }
  throw new Error(`Cannot read "${file.name}".`);
}
