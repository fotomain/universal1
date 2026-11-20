// The pick through the BVH must give the SAME triangle and element as three's own raycast (regression: a BVH that reorders the index buffer breaks triangle -> element).
import * as THREE from 'three';
import { parseBimc, bimcElementOfTriangle } from '../../kit8/pm/bim/bimc/bimcReader';
import { buildChunkMesh } from '../../kit8/pm/bim/view/bimSceneBuilder';
import { buildBvh, installBvh } from '../../kit8/pm/bim/view/bimBvh';
import { readChunkBytes, readExampleBundle } from './bimTestKit';

const b = readExampleBundle();

describe('picking with and without the BVH', () => {
  installBvh();
  const hasBvh = typeof (THREE.BufferGeometry.prototype as any).computeBoundsTree === 'function';

  it('the BVH is installed (three-mesh-bvh loads)', () => {
    expect(hasBvh).toBe(true);
  });

  it('the index buffer of the chunk is NOT reordered by the BVH', () => {
    const chunk = parseBimc(readChunkBytes(b.chunks[0].hash));
    const before = Uint16Array.from(chunk.indices as Uint16Array);
    const cm = buildChunkMesh(b.chunks[0].hash, chunk);
    buildBvh(cm.mesh);
    expect(Array.from(chunk.indices)).toEqual(Array.from(before));
  });

  it('1000 random rays: the same element with and without the BVH, and it is the element that owns the hit triangle', () => {
    for (const info of b.chunks) {
      const chunk = parseBimc(readChunkBytes(info.hash));
      const plain = buildChunkMesh(info.hash, parseBimc(readChunkBytes(info.hash)));
      const fast = buildChunkMesh(info.hash, chunk);
      buildBvh(fast.mesh);
      plain.mesh.updateMatrixWorld();
      fast.mesh.updateMatrixWorld();
      let seed = 7;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
      const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(chunk.min[0] + chunk.size[0] / 2, chunk.min[1] + chunk.size[1] / 2, chunk.min[2] + chunk.size[2] / 2), new THREE.Vector3(...chunk.size));
      let hits = 0;
      for (let i = 0; i < 250; i++) {
        const target = new THREE.Vector3(box.min.x + rnd() * chunk.size[0], box.min.y + rnd() * chunk.size[1], box.min.z + rnd() * chunk.size[2]);
        const dir = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        const ray = new THREE.Raycaster(target.clone().addScaledVector(dir, -200), dir);
        const a = ray.intersectObject(plain.mesh, false)[0];
        (ray as any).firstHitOnly = true;
        const c = ray.intersectObject(fast.mesh, false)[0];
        expect(!!c).toBe(!!a);
        if (!a || !c) continue;
        hits++;
        expect(bimcElementOfTriangle(chunk, c.faceIndex!)).toBe(bimcElementOfTriangle(chunk, a.faceIndex!));
        expect(c.distance).toBeCloseTo(a.distance, 3);
      }
      expect(hits).toBeGreaterThan(20);
    }
  });
});
