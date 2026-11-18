// The looks of a photo: black and white modes and modern colour looks. Pure: no React, no native module.
// ONE definition per look: a 4x5 colour matrix (the rows give R, G, B, A from the old R, G, B, A and a constant; the values are
// 0..1 like SVG feColorMatrix). The phone applies it with Skia (applyPhotoFilter.ts), the browser with a loop over the pixels
// (applyPhotoFilter.web.ts), the web preview with the CSS filter `css`.

export type PhotoFilterGroup = 'normal' | 'bw' | 'color';

export interface PhotoFilter {
  id: string;
  label: string;
  group: PhotoFilterGroup;
  /** 20 numbers, row by row: [R <- r g b a 1, G <- ..., B <- ..., A <- ...] */
  matrix: number[];
  /** the live look of the web preview and the chip (an approximation of the matrix) */
  css: string;
}

export const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** the luminance weights of the human eye (Rec. 709) */
const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

/** a black and white matrix with a contrast factor around the middle grey (1 = none) and a brightness shift */
export function monoMatrix(contrast = 1, shift = 0): number[] {
  const o = 0.5 * (1 - contrast) + shift;
  return [LR * contrast, LG * contrast, LB * contrast, 0, o, LR * contrast, LG * contrast, LB * contrast, 0, o, LR * contrast, LG * contrast, LB * contrast, 0, o, 0, 0, 0, 1, 0];
}

/** saturation: 0 = grey, 1 = as it is, > 1 = stronger colours */
export function saturationMatrix(s: number): number[] {
  const a = LR * (1 - s);
  const b = LG * (1 - s);
  const c = LB * (1 - s);
  return [a + s, b, c, 0, 0, a, b + s, c, 0, 0, a, b, c + s, 0, 0, 0, 0, 0, 1, 0];
}

/** contrast around the middle grey + brightness shift on every colour channel */
export function contrastMatrix(contrast: number, shift = 0): number[] {
  const o = 0.5 * (1 - contrast) + shift;
  return [contrast, 0, 0, 0, o, 0, contrast, 0, 0, o, 0, 0, contrast, 0, o, 0, 0, 0, 1, 0];
}

/** a 4x5 matrix applied after another: result = b(a(color)) */
export function multiplyMatrices(a: number[], b: number[]): number[] {
  const out = new Array(20).fill(0);
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += b[r * 5 + k] * a[k * 5 + c];
      if (c === 4) sum += b[r * 5 + 4];
      out[r * 5 + c] = sum;
    }
  }
  return out;
}

/** a tint: the channels are multiplied (warm = more red, less blue) and shifted */
function tintMatrix(r: number, g: number, b: number, shiftR = 0, shiftG = 0, shiftB = 0): number[] {
  return [r, 0, 0, 0, shiftR, 0, g, 0, 0, shiftG, 0, 0, b, 0, shiftB, 0, 0, 0, 1, 0];
}

const SEPIA = [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0];

export const PHOTO_FILTERS: PhotoFilter[] = [
  { id: 'original', label: 'Original', group: 'normal', matrix: IDENTITY_MATRIX, css: 'none' },
  // black and white modes
  { id: 'mono', label: 'Mono', group: 'bw', matrix: monoMatrix(1), css: 'grayscale(1)' },
  { id: 'noir', label: 'Noir', group: 'bw', matrix: monoMatrix(1.55, -0.04), css: 'grayscale(1) contrast(1.55) brightness(0.96)' },
  { id: 'silver', label: 'Silver', group: 'bw', matrix: monoMatrix(0.85, 0.05), css: 'grayscale(1) contrast(0.85) brightness(1.08)' },
  { id: 'highkey', label: 'High key', group: 'bw', matrix: monoMatrix(1.2, 0.14), css: 'grayscale(1) contrast(1.2) brightness(1.28)' },
  { id: 'grain', label: 'Film B&W', group: 'bw', matrix: multiplyMatrices(monoMatrix(1.25, -0.02), tintMatrix(1.04, 1, 0.94)), css: 'grayscale(1) contrast(1.25) sepia(0.15)' },
  // colour looks
  { id: 'vivid', label: 'Vivid', group: 'color', matrix: multiplyMatrices(saturationMatrix(1.5), contrastMatrix(1.1, -0.02)), css: 'saturate(1.5) contrast(1.1)' },
  { id: 'warm', label: 'Warm', group: 'color', matrix: multiplyMatrices(tintMatrix(1.1, 1.0, 0.86, 0.02, 0.01, -0.02), saturationMatrix(1.1)), css: 'sepia(0.28) saturate(1.2) hue-rotate(-8deg)' },
  { id: 'cool', label: 'Cool', group: 'color', matrix: multiplyMatrices(tintMatrix(0.9, 1.0, 1.12, -0.02, 0, 0.03), saturationMatrix(1.05)), css: 'saturate(1.05) hue-rotate(12deg) brightness(1.02)' },
  { id: 'fade', label: 'Fade', group: 'color', matrix: multiplyMatrices(saturationMatrix(0.78), contrastMatrix(0.82, 0.1)), css: 'saturate(0.78) contrast(0.82) brightness(1.12)' },
  { id: 'vintage', label: 'Vintage', group: 'color', matrix: multiplyMatrices(SEPIA, multiplyMatrices(saturationMatrix(0.9), contrastMatrix(0.92, 0.06))), css: 'sepia(0.7) contrast(0.92) brightness(1.06)' },
  { id: 'drama', label: 'Drama', group: 'color', matrix: multiplyMatrices(saturationMatrix(0.8), contrastMatrix(1.4, -0.06)), css: 'saturate(0.8) contrast(1.4) brightness(0.94)' },
  { id: 'teal', label: 'Teal & orange', group: 'color', matrix: multiplyMatrices(tintMatrix(1.12, 1.0, 0.92, 0.03, 0.0, 0.02), contrastMatrix(1.12, -0.02)), css: 'contrast(1.12) saturate(1.25) hue-rotate(-6deg)' },
];

export const DEFAULT_PHOTO_FILTER = 'original';

export const filterById = (id: string | undefined | null): PhotoFilter => PHOTO_FILTERS.find((f) => f.id === id) ?? PHOTO_FILTERS[0];

export const filtersOfGroup = (group: PhotoFilterGroup) => PHOTO_FILTERS.filter((f) => f.group === group);

export const isBlackAndWhite = (id: string | undefined | null) => filterById(id).group === 'bw';

/** one pixel through a matrix (r, g, b in 0..255, the alpha is kept) - the browser applies it with this; a test checks the looks with it */
export function applyMatrixToPixel(matrix: number[], r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const ch = (row: number) => {
    const v = matrix[row * 5] * rn + matrix[row * 5 + 1] * gn + matrix[row * 5 + 2] * bn + matrix[row * 5 + 4];
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  return [ch(0), ch(1), ch(2)];
}

/** a filter that changes nothing needs no work (the photo is kept as the camera made it) */
export const isIdentity = (id: string | undefined | null) => filterById(id).id === 'original';
