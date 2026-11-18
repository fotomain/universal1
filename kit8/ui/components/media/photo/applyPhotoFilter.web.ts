// Web twin of applyPhotoFilter.ts: the look is applied to the pixels of a canvas with the SAME colour matrix (photoFilters.ts), so the
// result is the same in every browser (the CSS `ctx.filter` is missing in Safari). Returns an object url of a JPEG.
import { filterById, isIdentity } from './photoFilters';

export interface FilteredPhoto {
  uri: string;
  width: number;
  height: number;
}

export const MAX_FILTER_SIDE = 4096;

const loadImage = (uri: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The photo could not be opened for the look.'));
    img.src = uri;
  });

/** the matrix over the pixels of an RGBA array (in place) */
export function filterPixels(pixels: Uint8ClampedArray, matrix: number[]) {
  const [m0, m1, m2, , m4, m5, m6, m7, , m9, m10, m11, m12, , m14] = matrix;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] / 255;
    const g = pixels[i + 1] / 255;
    const b = pixels[i + 2] / 255;
    pixels[i] = (m0 * r + m1 * g + m2 * b + m4) * 255;
    pixels[i + 1] = (m5 * r + m6 * g + m7 * b + m9) * 255;
    pixels[i + 2] = (m10 * r + m11 * g + m12 * b + m14) * 255; // Uint8ClampedArray clamps to 0..255
  }
}

export async function applyPhotoFilter(uri: string, filterId: string): Promise<FilteredPhoto> {
  const img = await loadImage(uri);
  if (isIdentity(filterId)) return { uri, width: img.naturalWidth, height: img.naturalHeight };
  const scale = Math.min(1, MAX_FILTER_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot change the look of a photo.');
  ctx.drawImage(img, 0, 0, width, height);
  const frame = ctx.getImageData(0, 0, width, height);
  filterPixels(frame.data, filterById(filterId).matrix);
  ctx.putImageData(frame, 0, 0);
  const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo could not be made.'))), 'image/jpeg', 0.92));
  return { uri: URL.createObjectURL(blob), width, height };
}
