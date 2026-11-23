// The face image of many chips (all Latvian passports) is JPEG 2000: iOS draws it, Android cannot. This turns it into a JPEG on the phone, in plain JavaScript
// (jpeg2000 = the decoder of Mozilla's pdf.js, jpeg-js = the encoder), so the media post and the reader screen can show the picture. The original bytes still go
// to the file storage unchanged. Pure: no React, no native module. Never throws: null = could not be converted.
import { JpxImage } from 'jpeg2000';
import * as jpeg from 'jpeg-js';

/**
 * jpeg-js ends its encoding with `Buffer.from(bytes)` (it thinks it runs in Node); a phone has no global Buffer, the call would throw. For the one call a
 * minimal `Buffer.from` that makes a Uint8Array stands in, and it is taken away again (the rest of the app never sees it).
 */
function withBufferShim<T>(run: () => T): T {
  const g: any = globalThis;
  if (g.Buffer) return run();
  g.Buffer = { from: (a: ArrayLike<number>) => Uint8Array.from(a) };
  try {
    return run();
  } finally {
    delete g.Buffer;
  }
}

/** a chip photo is about 400 x 500; a bigger image is cut down to this side (the post keeps a picture of a few tens of KB) */
export const FACE_MAX_SIDE = 640;
export const FACE_JPEG_QUALITY = 80;

/**
 * The decoder reads its input with three methods of a Node Buffer (readInt8 / readUInt16BE / readUInt32BE); a phone has no Buffer. A Uint8Array that has just those
 * three (big endian, like the Buffer ones) is all it needs.
 */
class BufferLike extends Uint8Array {
  readInt8(o: number): number {
    const v = this[o];
    return v > 127 ? v - 256 : v;
  }

  readUInt16BE(o: number): number {
    return (this[o] << 8) | this[o + 1];
  }

  readUInt32BE(o: number): number {
    return this[o] * 0x1000000 + ((this[o + 1] << 16) | (this[o + 2] << 8) | this[o + 3]);
  }
}

/** the image of every tile in one RGBA buffer; null for a shape this reader does not know */
function toRgba(jpx: JpxImage): { width: number; height: number; data: Uint8Array } | null {
  const { width, height, componentsCount: n } = jpx;
  if (!(width > 0 && height > 0) || ![1, 2, 3, 4].includes(n)) return null;
  const data = new Uint8Array(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (const tile of jpx.tiles) {
    for (let y = 0; y < tile.height; y += 1) {
      const row = tile.top + y;
      if (row >= height) break;
      for (let x = 0; x < tile.width; x += 1) {
        const col = tile.left + x;
        if (col >= width) break;
        const s = (y * tile.width + x) * n;
        const d = (row * width + col) * 4;
        if (n >= 3) {
          data[d] = tile.items[s];
          data[d + 1] = tile.items[s + 1];
          data[d + 2] = tile.items[s + 2];
        } else {
          data[d] = data[d + 1] = data[d + 2] = tile.items[s]; // grey (n = 2: grey + alpha)
        }
      }
    }
  }
  return { width, height, data };
}

/** nearest neighbour down to `max` on the longer side; the same image when it is small enough */
function shrink(img: { width: number; height: number; data: Uint8Array }, max: number) {
  const big = Math.max(img.width, img.height);
  if (big <= max) return img;
  const k = max / big;
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(img.height - 1, Math.floor(y / k));
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(img.width - 1, Math.floor(x / k));
      data.set(img.data.subarray((sy * img.width + sx) * 4, (sy * img.width + sx) * 4 + 4), (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}

/** JPEG 2000 (a JP2 file or a bare codestream) -> JPEG bytes, or null when it cannot be read */
export function jp2ToJpeg(bytes: Uint8Array, quality: number = FACE_JPEG_QUALITY): Uint8Array | null {
  try {
    if (!bytes || bytes.length < 16) return null;
    const jpx = new JpxImage();
    jpx.parse(new BufferLike(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer) as any);
    const rgba = toRgba(jpx);
    if (!rgba) return null;
    const small = shrink(rgba, FACE_MAX_SIDE);
    const out = withBufferShim(() => jpeg.encode({ data: small.data as any, width: small.width, height: small.height }, quality));
    return out?.data?.length ? new Uint8Array(out.data) : null;
  } catch {
    return null;
  }
}

/** a data address of the JPEG made from a JPEG 2000 image, or null */
export function jp2ToJpegDataUri(bytes: Uint8Array, toBase64: (b: Uint8Array) => string): string | null {
  const j = jp2ToJpeg(bytes);
  return j ? `data:image/jpeg;base64,${toBase64(j)}` : null;
}
