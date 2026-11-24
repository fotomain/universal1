// The owner photo of a typed in person document: pick a picture (web: file input, phone: document picker), make it a small JPEG (about 480 px wide) that fits the post,
// keep its base64 for the file storage. Needs a browser canvas (web) or expo-image-manipulator (phone).
import { Platform } from 'react-native';
import { pickFilesForDrop } from '../../common/pickFilesForDrop';
import type { DroppedFileItem } from '../../common/ReceiveDraggableFilesComponent.types';
import type { PersonPhoto } from './personDocumentInputModel';

export const PERSON_PHOTO_WIDTH = 480;
export const PERSON_PHOTO_QUALITY = 0.7;

/** a file that is no picture is refused before any work is done */
export const isPictureItem = (item: Pick<DroppedFileItem, 'name' | 'mimeType'>): boolean =>
  /^image\//i.test(item.mimeType || '') || /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(item.name || '');

const toPhoto = (base64: string): PersonPhoto => ({ dataUri: `data:image/jpeg;base64,${base64}`, mime: 'image/jpeg', base64 });

async function viaCanvas(blob: Blob): Promise<PersonPhoto> {
  const url = URL.createObjectURL(blob);
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('The picture could not be read.')); i.src = url; });
    const scale = Math.min(1, PERSON_PHOTO_WIDTH / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const g = canvas.getContext('2d');
    if (!g) throw new Error('This browser cannot make the picture smaller.');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    return toPhoto(canvas.toDataURL('image/jpeg', PERSON_PHOTO_QUALITY).split(',')[1] || '');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function viaManipulator(uri: string): Promise<PersonPhoto> {
  const { manipulateAsync, SaveFormat } = require('expo-image-manipulator'); // lazy: a web build / a node test never needs it
  const r = await manipulateAsync(uri, [{ resize: { width: PERSON_PHOTO_WIDTH } }], { compress: PERSON_PHOTO_QUALITY, format: SaveFormat.JPEG, base64: true });
  if (!r?.base64) throw new Error('The picture could not be read.');
  return toPhoto(r.base64);
}

/** the picked picture as a small JPEG (throws a readable error) */
export async function personPhotoOf(item: DroppedFileItem): Promise<PersonPhoto> {
  if (!isPictureItem(item)) throw new Error('Choose a picture (JPEG, PNG ...).');
  if (item.blob && Platform.OS === 'web') return viaCanvas(item.blob);
  if (item.uri) return viaManipulator(item.uri);
  throw new Error('The picture could not be read.');
}

/** the user picks a picture; null = nothing picked */
export async function pickPersonPhoto(pick: typeof pickFilesForDrop = pickFilesForDrop): Promise<PersonPhoto | null> {
  const items = await pick({ accept: 'image/*', mimeTypes: ['image/*'], multiple: false });
  return items.length ? personPhotoOf(items[0]) : null;
}
