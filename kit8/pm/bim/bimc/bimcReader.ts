// BIMC v1 reader (the format is written by py/bim/server/bimc.py; both read the same golden chunk in the tests).
// Zero copy: the typed arrays are VIEWS on the ArrayBuffer (every section starts at a multiple of 4 bytes). The positions are Uint16 quantized inside the box of the chunk:
//   p = min + q / 65535 * size        (the viewer uploads the Uint16 as a NORMALIZED attribute and puts min / size in the object matrix: no decode work)
// Pure: no three, no React.

export const BIMC_MAGIC = 0x434d4942; // 'BIMC' read as a little endian u32
export const BIMC_VERSION = 1;
export const BIMC_FLAG_INDEX32 = 1;
const HEADER_SIZE = 80;
const GUID_SLOT = 24;

export interface BimcRange {
  element: number;
  material: number;
  firstIndex: number;
  indexCount: number;
}

export interface BimcChunk {
  version: number;
  flags: number;
  vertexCount: number;
  indexCount: number;
  elementCount: number;
  /** the box of the chunk in scene space */
  min: [number, number, number];
  size: [number, number, number];
  /** RGBA8 per material, 4 bytes each */
  palette: Uint8Array;
  /** vertexCount x 3, quantized */
  positions: Uint16Array;
  /** the chunk local element number of every vertex */
  elementIndex: Uint16Array;
  indices: Uint16Array | Uint32Array;
  ranges: BimcRange[];
  /** the IFC GlobalId of every element number */
  guids: string[];
}

export class BimcError extends Error {}

export function parseBimc(input: ArrayBuffer | ArrayBufferView): BimcChunk {
  let buffer: ArrayBuffer;
  if (ArrayBuffer.isView(input)) {
    // a view with an unaligned start cannot be viewed as Uint16 / Uint32: copy once
    buffer = input.byteOffset % 4 === 0 && input.byteLength === input.buffer.byteLength ? (input.buffer as ArrayBuffer) : (input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer);
  } else buffer = input;
  if (buffer.byteLength < HEADER_SIZE) throw new BimcError('The chunk is too short.');
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== BIMC_MAGIC) throw new BimcError('This is not a BIMC chunk.');
  const version = dv.getUint16(4, true);
  if (version !== BIMC_VERSION) throw new BimcError(`Unsupported BIMC version ${version} - update the app.`);
  const flags = dv.getUint16(6, true);
  const vertexCount = dv.getUint32(8, true);
  const indexCount = dv.getUint32(12, true);
  const elementCount = dv.getUint32(16, true);
  const materialCount = dv.getUint32(20, true);
  const rangeCount = dv.getUint32(24, true);
  const min: [number, number, number] = [dv.getFloat32(28, true), dv.getFloat32(32, true), dv.getFloat32(36, true)];
  const size: [number, number, number] = [dv.getFloat32(40, true), dv.getFloat32(44, true), dv.getFloat32(48, true)];
  const oMat = dv.getUint32(52, true);
  const oPos = dv.getUint32(56, true);
  const oEl = dv.getUint32(60, true);
  const oIdx = dv.getUint32(64, true);
  const oRng = dv.getUint32(68, true);
  const oGd = dv.getUint32(72, true);
  const total = dv.getUint32(76, true);
  if (total !== buffer.byteLength) throw new BimcError('The chunk is cut: its size differs from the header.');
  const index32 = (flags & BIMC_FLAG_INDEX32) !== 0;
  const palette = new Uint8Array(buffer, oMat, materialCount * 4);
  const positions = new Uint16Array(buffer, oPos, vertexCount * 3);
  const elementIndex = new Uint16Array(buffer, oEl, vertexCount);
  const indices = index32 ? new Uint32Array(buffer, oIdx, indexCount) : new Uint16Array(buffer, oIdx, indexCount);
  const words = new Uint32Array(buffer, oRng, rangeCount * 3);
  const ranges: BimcRange[] = [];
  for (let i = 0; i < rangeCount; i++) {
    const w0 = words[i * 3];
    ranges.push({ element: w0 & 0xffff, material: w0 >>> 16, firstIndex: words[i * 3 + 1], indexCount: words[i * 3 + 2] });
  }
  const bytes = new Uint8Array(buffer, oGd, elementCount * GUID_SLOT);
  const guids: string[] = [];
  for (let i = 0; i < elementCount; i++) {
    let end = (i + 1) * GUID_SLOT;
    const start = i * GUID_SLOT;
    while (end > start && bytes[end - 1] === 0) end--;
    let s = '';
    for (let k = start; k < end; k++) s += String.fromCharCode(bytes[k]);
    guids.push(s);
  }
  return { version, flags, vertexCount, indexCount, elementCount, min, size, palette, positions, elementIndex, indices, ranges, guids };
}

/** the dequantized position of vertex i (scene space) */
export function bimcVertex(c: BimcChunk, i: number): [number, number, number] {
  const k = i * 3;
  return [c.min[0] + (c.positions[k] / 65535) * c.size[0], c.min[1] + (c.positions[k + 1] / 65535) * c.size[1], c.min[2] + (c.positions[k + 2] / 65535) * c.size[2]];
}

/** which element owns triangle `triangle` (the answer to a pick): binary search in the ranges, which are sorted by firstIndex. -1 = none */
export function bimcElementOfTriangle(c: BimcChunk, triangle: number): number {
  const at = triangle * 3;
  let lo = 0;
  let hi = c.ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = c.ranges[mid];
    if (at < r.firstIndex) hi = mid - 1;
    else if (at >= r.firstIndex + r.indexCount) lo = mid + 1;
    else return r.element;
  }
  return -1;
}

/** the triangle range (in indices) of every element number: [first, count] - the elements are stored one after the other */
export function bimcElementIndexRanges(c: BimcChunk): Array<[number, number]> {
  const out: Array<[number, number]> = Array.from({ length: c.elementCount }, () => [0, 0]);
  const seen = new Array<boolean>(c.elementCount).fill(false);
  for (const r of c.ranges) {
    if (!seen[r.element]) {
      out[r.element] = [r.firstIndex, r.indexCount];
      seen[r.element] = true;
    } else out[r.element][1] = r.firstIndex + r.indexCount - out[r.element][0];
  }
  return out;
}
