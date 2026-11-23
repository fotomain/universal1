// The picture of the chip photo for <Image> (used by the document card and by the "media post created" screen).
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { bytesToBase64 } from './crypto/bytes';
import { jp2ToJpegDataUri } from './jp2ToJpeg';
import type { IdDocument } from './emrtd';

/**
 * The picture of the chip photo for <Image>: a JPEG as it is; a JPEG 2000 as it is where the system draws it (iOS), on Android it is converted to a JPEG
 * (jp2ToJpeg, a moment of work: done after the first paint). uri '' + converting = wait; uri '' + not converting = no picture possible.
 */
export function useFaceImage(photo: IdDocument['photo']): { uri: string; converting: boolean } {
  const needsConversion = !!photo && photo.mime === 'image/jp2' && Platform.OS === 'android';
  const [converted, setConverted] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setConverted(null);
    setDone(false);
    if (!photo || !needsConversion) return undefined;
    const timer = setTimeout(() => {
      setConverted(jp2ToJpegDataUri(photo.bytes, bytesToBase64));
      setDone(true);
    }, 30);
    return () => clearTimeout(timer);
  }, [photo, needsConversion]);
  if (!photo) return { uri: '', converting: false };
  if (!needsConversion) return { uri: `data:${photo.mime};base64,${bytesToBase64(photo.bytes)}`, converting: false };
  return { uri: converted ?? '', converting: !done };
}
