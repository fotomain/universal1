import * as THREE from 'three';
import { parseBimc } from '../../kit8/pm/bim/bimc/bimcReader';
import { applyElementStates, buildChunkMesh, DEFAULT_STATE_COLORS, elementBaseColors, elementVertexRanges, pickElement } from '../../kit8/pm/bim/view/bimSceneBuilder';
import { BIM_STATE_DIM, BIM_STATE_HIGHLIGHT, BIM_STATE_NORMAL } from '../../kit8/pm/bim/model/bimModel';
import { readChunkBytes, readExampleBundle } from './bimTestKit';

const b = readExampleBundle();
const first = b.chunks[0];
const chunk = parseBimc(readChunkBytes(first.hash));

describe('three scene of a chunk', () => {
  it('the geometry takes the Uint16 positions as they are (normalized) and the chunk box goes to the object matrix', () => {
    const cm = buildChunkMesh(first.hash, chunk);
    const pos = cm.mesh.geometry.getAttribute('position');
    expect(pos.array).toBe(chunk.positions);
    expect(pos.normalized).toBe(true);
    expect(pos.itemSize).toBe(3);
    expect(cm.mesh.geometry.index!.array).toBe(chunk.indices);
    expect(cm.mesh.position.toArray()).toEqual(chunk.min.map((x) => Math.fround(x)));
    expect(cm.mesh.scale.toArray()).toEqual(chunk.size.map((x) => Math.fround(x)));
    // the world box of the mesh is the box of the chunk
    cm.mesh.geometry.computeBoundingBox();
    const box = new THREE.Box3().copy(cm.mesh.geometry.boundingBox!).applyMatrix4((cm.mesh.updateMatrixWorld(), cm.mesh.matrixWorld));
    for (let k = 0; k < 3; k++) {
      expect(box.min.getComponent(k)).toBeCloseTo(chunk.min[k], 2);
      expect(box.max.getComponent(k)).toBeLessThanOrEqual(chunk.min[k] + chunk.size[k] + 1e-3);
    }
  });

  it('every element has its block of vertices and a base colour', () => {
    const r = elementVertexRanges(chunk);
    expect(r).toHaveLength(chunk.elementCount);
    expect(r[0][0]).toBe(0);
    expect(r[r.length - 1][1]).toBe(chunk.vertexCount);
    for (let i = 1; i < r.length; i++) expect(r[i][0]).toBe(r[i - 1][1]);
    expect(elementBaseColors(chunk)).toHaveLength(chunk.elementCount * 4);
  });

  it('states write colours: highlighted = the highlight colour, dimmed = the base colour at 15 % opacity, back to normal restores it', () => {
    const cm = buildChunkMesh(first.hash, chunk);
    const col = cm.mesh.geometry.getAttribute('color').array as Uint8Array;
    const g0 = chunk.guids[0];
    const base = Array.from(col.slice(cm.vertexRanges[0][0] * 4, cm.vertexRanges[0][0] * 4 + 4));
    expect(base[3]).toBeGreaterThan(200);

    const changed = applyElementStates(cm, (g) => (g === g0 ? BIM_STATE_HIGHLIGHT : BIM_STATE_DIM));
    expect(changed).toBe(true);
    const v0 = cm.vertexRanges[0][0] * 4;
    expect(Array.from(col.slice(v0, v0 + 4))).toEqual([...DEFAULT_STATE_COLORS.highlight, 255]);
    const v1 = cm.vertexRanges[1][0] * 4;
    expect(col[v1 + 3]).toBe(Math.round(cm.baseColors[4 + 3] * DEFAULT_STATE_COLORS.dimAlpha));
    expect((cm.mesh.material as THREE.Material).transparent).toBe(true);

    expect(applyElementStates(cm, (g) => (g === g0 ? BIM_STATE_HIGHLIGHT : BIM_STATE_DIM))).toBe(false); // nothing changed = nothing written
    applyElementStates(cm, () => BIM_STATE_NORMAL);
    expect(Array.from(col.slice(v0, v0 + 4))).toEqual(base);
    expect((cm.mesh.material as THREE.Material).transparent).toBe(false);
  });

  it('a ray finds the element under it and the nearest of two chunks wins', () => {
    const cm = buildChunkMesh(first.hash, chunk);
    cm.mesh.updateMatrixWorld();
    // shoot at the centre of element 0 from the side of its box
    const e = b.elements.find((x) => x.chunkHash === first.hash && x.elementNumber === 0)!;
    const c = [(e.bbox[0] + e.bbox[3]) / 2, (e.bbox[1] + e.bbox[4]) / 2, (e.bbox[2] + e.bbox[5]) / 2];
    // a ray along +/- every axis through the centre: at least one of the six hits the wall (a wall is a thin box)
    let hit: string | null = null;
    for (const dir of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const origin = new THREE.Vector3(c[0] - dir[0] * 500, c[1] - dir[1] * 500, c[2] - dir[2] * 500);
      const rc = new THREE.Raycaster(origin, new THREE.Vector3(dir[0], dir[1], dir[2]));
      const h = pickElement([cm], rc);
      if (h) hit = h.ifcGuid;
      if (hit) break;
    }
    expect(hit).not.toBeNull();
    expect(chunk.guids).toContain(hit);
    // a ray that misses everything
    expect(pickElement([cm], new THREE.Raycaster(new THREE.Vector3(1e4, 1e4, 1e4), new THREE.Vector3(0, 1, 0)))).toBeNull();
  });
});
