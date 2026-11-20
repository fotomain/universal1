import { bimcElementIndexRanges, bimcElementOfTriangle, bimcVertex, BimcError, parseBimc } from '../../kit8/pm/bim/bimc/bimcReader';
import { base64ToArrayBuffer } from '../../kit8/pm/bim/bimc/base64';
import { readChunkBytes, readExampleBundle } from './bimTestKit';

describe('BIMC v1 reader on the converted example 1 (golden chunks of py/bim/server)', () => {
  const bundle = readExampleBundle();

  it('reads every chunk and agrees with bundle.json', () => {
    let elements = 0;
    for (const c of bundle.chunks) {
      const chunk = parseBimc(readChunkBytes(c.hash));
      expect(chunk.version).toBe(1);
      expect(chunk.vertexCount).toBe(c.vertexCount);
      expect(chunk.elementCount).toBe(c.elementCount);
      expect(chunk.size.every((x) => x > 0)).toBe(true);
      expect(chunk.min[0]).toBeCloseTo(c.bboxMin[0], 3);
      elements += chunk.elementCount;
    }
    expect(elements).toBe(58);
  });

  it('the guid of an element number is the guid of its row', () => {
    for (const e of bundle.elements) {
      const chunk = parseBimc(readChunkBytes(e.chunkHash));
      expect(chunk.guids[e.elementNumber]).toBe(e.ifcGuid);
    }
  });

  it('zero copy: the arrays are views on the buffer, the positions are quantized inside the box', () => {
    const bytes = readChunkBytes(bundle.chunks[0].hash);
    const c = parseBimc(bytes);
    expect(c.positions.buffer).toBe(bytes);
    expect(c.positions).toBeInstanceOf(Uint16Array);
    expect(c.positions.length).toBe(c.vertexCount * 3);
    expect(c.elementIndex.length).toBe(c.vertexCount);
    // the dequantized vertices of an element lie inside its bbox (to a millimetre)
    const e = bundle.elements.find((x) => x.chunkHash === bundle.chunks[0].hash && x.elementNumber === 0)!;
    for (let v = 0; v < c.vertexCount; v++) {
      if (c.elementIndex[v] !== 0) continue;
      const p = bimcVertex(c, v);
      for (let k = 0; k < 3; k++) {
        expect(p[k]).toBeGreaterThanOrEqual(e.bbox[k] - 0.002);
        expect(p[k]).toBeLessThanOrEqual(e.bbox[k + 3] + 0.002);
      }
    }
  });

  it('a triangle belongs to the element that owns its index range (the pick)', () => {
    const c = parseBimc(readChunkBytes(bundle.chunks[0].hash));
    const ranges = bimcElementIndexRanges(c);
    for (let e = 0; e < c.elementCount; e++) {
      const [first, count] = ranges[e];
      expect(count).toBeGreaterThan(0);
      expect(bimcElementOfTriangle(c, first / 3)).toBe(e);
      expect(bimcElementOfTriangle(c, (first + count) / 3 - 1)).toBe(e);
    }
    expect(bimcElementOfTriangle(c, c.indexCount / 3 + 5)).toBe(-1);
    // the indices stay inside the vertices
    let max = 0;
    for (let i = 0; i < c.indices.length; i++) max = Math.max(max, c.indices[i]);
    expect(max).toBeLessThan(c.vertexCount);
  });

  it('refuses a cut chunk, a wrong magic and a newer version', () => {
    const bytes = readChunkBytes(bundle.chunks[0].hash);
    expect(() => parseBimc(bytes.slice(0, bytes.byteLength - 4))).toThrow(BimcError);
    const bad = bytes.slice(0);
    new Uint8Array(bad)[0] = 0x58;
    expect(() => parseBimc(bad)).toThrow(/not a BIMC/);
    const newer = bytes.slice(0);
    new DataView(newer).setUint16(4, 9, true);
    expect(() => parseBimc(newer)).toThrow(/Unsupported BIMC version 9/);
    expect(() => parseBimc(new ArrayBuffer(10))).toThrow(/too short/);
  });

  it('a view with an unaligned start is copied once instead of failing', () => {
    const bytes = new Uint8Array(readChunkBytes(bundle.chunks[0].hash));
    const shifted = new Uint8Array(bytes.length + 1);
    shifted.set(bytes, 1);
    expect(parseBimc(shifted.subarray(1)).elementCount).toBe(bundle.chunks[0].elementCount);
  });

  it('base64 -> ArrayBuffer (the demo json)', () => {
    expect(new Uint8Array(base64ToArrayBuffer('TWFu'))).toEqual(new Uint8Array([77, 97, 110]));
    expect(new Uint8Array(base64ToArrayBuffer('TWE='))).toEqual(new Uint8Array([77, 97]));
    expect(new Uint8Array(base64ToArrayBuffer('TQ=='))).toEqual(new Uint8Array([77]));
    const demo = require('../../kit8/pm/bim/examples/example1/example1.demo.json');
    const first = demo.chunks[0];
    const c = parseBimc(base64ToArrayBuffer(first.base64));
    expect(c.elementCount).toBeGreaterThan(0);
    expect(c.vertexCount * 3).toBe(c.positions.length);
  });
});
