// An ISOLATED mesh draws ONE element alone (the component screen): its index buffer is a view on the triangles of that element, a pick answers it.
import * as THREE from 'three';
import { bimcElementIndexRanges, parseBimc } from '../../kit8/pm/bim/bimc/bimcReader';
import { buildChunkMesh, pickElement } from '../../kit8/pm/bim/view/bimSceneBuilder';
import { readChunkBytes, readExampleBundle } from './bimTestKit';

const b = readExampleBundle();
const first = b.chunks[0];
const chunk = parseBimc(readChunkBytes(first.hash));

describe('isolated element mesh', () => {
  it('draws only the triangles of the element; the vertex buffers are shared with the chunk', () => {
    const e = Math.min(2, chunk.elementCount - 1);
    const [firstIndex, count] = bimcElementIndexRanges(chunk)[e];
    const cm = buildChunkMesh(first.hash, chunk, undefined, e);
    const idx = cm.mesh.geometry.index!.array;
    expect(cm.onlyElement).toBe(e);
    expect(idx.length).toBe(count);
    expect(Array.from(idx)).toEqual(Array.from(chunk.indices.subarray(firstIndex, firstIndex + count)));
    expect(count).toBeLessThan(chunk.indices.length);
    expect(cm.mesh.geometry.getAttribute('position').array).toBe(chunk.positions);
  });

  it('the whole chunk is drawn when no element is asked for', () => {
    const cm = buildChunkMesh(first.hash, chunk);
    expect(cm.onlyElement).toBeUndefined();
    expect(cm.mesh.geometry.index!.array).toBe(chunk.indices);
  });

  it('a pick on an isolated mesh answers its element (the face numbers of a subset are not the chunk\'s)', () => {
    const e = Math.min(1, chunk.elementCount - 1);
    const cm = buildChunkMesh(first.hash, chunk, undefined, e);
    cm.mesh.updateMatrixWorld();
    // a ray at the middle of the first triangle of the element, along its normal
    const [firstIndex] = bimcElementIndexRanges(chunk)[e];
    const vert = (i: number) =>
      new THREE.Vector3(chunk.positions[i * 3], chunk.positions[i * 3 + 1], chunk.positions[i * 3 + 2]).divideScalar(65535).multiply(new THREE.Vector3(...chunk.size)).add(new THREE.Vector3(...chunk.min));
    const [a, b2, c] = [vert(chunk.indices[firstIndex]), vert(chunk.indices[firstIndex + 1]), vert(chunk.indices[firstIndex + 2])];
    const centre = a.clone().add(b2).add(c).divideScalar(3);
    const normal = b2.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const rc = new THREE.Raycaster();
    rc.set(centre.clone().addScaledVector(normal, 0.5), normal.clone().negate());
    const hit = pickElement([cm], rc);
    expect(hit?.ifcGuid).toBe(chunk.guids[e]);
  });
});
