// Text of a file from ReceiveDraggableFilesComponent (drop or "Choose file…"):
//   web: File/Blob · iOS / Android: file uri (expo-file-system) or base64
import type { DroppedFileItem } from '../../../../../ui/components/common/ReceiveDraggableFilesComponent.types';

function blobText(blob: Blob): Promise<string> {
  if (typeof (blob as any).text === 'function') return (blob as any).text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(blob);
  });
}

function base64ToText(b64: string): string {
  const bin = typeof atob === 'function' ? atob(b64) : require('react-native-base64').decode(b64);
  try {
    // UTF-8 bytes -> string
    return decodeURIComponent(Array.from(bin, (c: string) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return bin;
  }
}

export async function readDroppedFileText(file: DroppedFileItem): Promise<string> {
  if (file.blob) return blobText(file.blob);
  if (file.base64) return base64ToText(file.base64);
  if (file.uri) {
    if (/^(https?:|blob:|data:)/.test(file.uri)) return (await fetch(file.uri)).text();
    const FileSystem = require('expo-file-system/legacy');
    return FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
  }
  throw new Error(`Cannot read "${file.name}".`);
}
