// Saves a binary file (PDF) for the user.
//   web      automatic download (Blob + <a download>)
//   iOS      written to the app cache, then the share sheet ("Save to Files", AirDrop, Print, mail ...)
//   Android  the user picks a folder (Storage Access Framework) and the file is written there
import { Platform, Share } from 'react-native';
import { bytesToBase64 } from './pdfDocument';

export type PMBinaryDownloadResult = 'downloaded' | 'shared' | 'saved' | 'dismissed';

export async function downloadBinaryFile(fileName: string, bytes: Uint8Array, mimeType = 'application/pdf'): Promise<PMBinaryDownloadResult> {
  if (Platform.OS === 'web') {
    const blob = new Blob([bytes as any], { type: mimeType });
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
    const SAF = FileSystem.StorageAccessFramework;
    const permission = await SAF.requestDirectoryPermissionsAsync();
    if (!permission.granted) return 'dismissed';
    const uri = await SAF.createFileAsync(permission.directoryUri, fileName.replace(/\.pdf$/i, ''), mimeType);
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return 'saved';
  }
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  const res = await Share.share({ url: uri }, { subject: fileName });
  return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
