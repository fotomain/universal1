// Saves a text file for the user.
//   web:            automatic download (Blob + <a download>), no dialog
//   iOS / Android:  written to the app cache (expo-file-system) and handed to the share sheet
//                   ("Save to Files", AirDrop, mail, ...) - apps cannot write to a shared Downloads folder silently
import { Platform, Share } from 'react-native';

export type PMDownloadResult = 'downloaded' | 'shared' | 'dismissed';

export async function downloadTextFile(fileName: string, text: string, mimeType = 'application/json'): Promise<PMDownloadResult> {
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // let the browser start the download before the URL is released
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }
  const FileSystem = require('expo-file-system/legacy');
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
  const res = await Share.share(Platform.OS === 'ios' ? { url: uri } : { message: text, title: fileName }, { dialogTitle: fileName });
  return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
