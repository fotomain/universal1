/** @jest-environment node */
// A JPEG 2000 face image (the passport of Latvia) -> a JPEG the phone can draw. The samples are made by openjpeg's opj_compress from a 96 x 128 picture:
// left to right the red grows, top to bottom the green grows, the blue is a checkerboard (220 / 40) of 16 px squares.
import * as fs from 'fs';
import * as path from 'path';
import * as jpeg from 'jpeg-js';
import { jp2ToJpeg, jp2ToJpegDataUri } from '../../kit8/ui/components/media/nfc/iddocread/jp2ToJpeg';

const load = (n: string) => new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', n)));
const px = (img: { data: Uint8Array | Buffer; width: number }, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));
const near = (a: number[], b: number[], tol = 12) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

describe('jp2ToJpeg', () => {
  it.each([['a JP2 file', 'face_96x128.jp2'], ['a bare codestream', 'face_96x128.j2k']])('%s becomes a real JPEG of the same size and colours', (_n, file) => {
    const out = jp2ToJpeg(load(file));
    expect(out).not.toBeNull();
    expect(Array.from(out!.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]); // JPEG
    const img = jpeg.decode(Buffer.from(out!), { useTArray: true });
    expect(img.width).toBe(96);
    expect(img.height).toBe(128);
    // a point in the middle of a square: x = 40 (red 80), y = 24 (green 48), square (2, 1) -> checkerboard 220
    expect(near(px(img, 40, 24), [80, 48, 220], 25)).toBe(true);
    // x = 8 (red 16), y = 8 (green 16), square (0, 0) -> 40
    expect(near(px(img, 8, 8), [16, 16, 40], 25)).toBe(true);
  });

  it('a data address for <Image>', () => {
    const uri = jp2ToJpegDataUri(load('face_96x128.jp2'), (b) => Buffer.from(b).toString('base64'));
    expect(uri).toMatch(/^data:image\/jpeg;base64,\/9j\//);
  });

  it('works on a phone: there is no global Buffer (jpeg-js asks for one) and none is left behind', () => {
    const g: any = globalThis;
    const saved = g.Buffer;
    delete g.Buffer;
    let out: Uint8Array | null = null;
    let leftBehind = true;
    try {
      out = jp2ToJpeg(load('face_96x128.jp2'));
      leftBehind = 'Buffer' in g;
    } finally {
      g.Buffer = saved;
    }
    expect(out).not.toBeNull();
    expect(Array.from(out!.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    expect(leftBehind).toBe(false);
  });

  it('rubbish, empty and cut images give null, never an exception', () => {
    expect(jp2ToJpeg(new Uint8Array(0))).toBeNull();
    expect(jp2ToJpeg(new Uint8Array(200).fill(7))).toBeNull();
    expect(jp2ToJpeg(load('face_96x128.jp2').slice(0, 120))).toBeNull();
  });

});
