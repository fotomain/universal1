// three-mesh-bvh makes the ray picking fast (a tree over the triangles, built once per chunk). Installed once, lazily: a model of 58 walls needs it little, one of 60 000 elements a lot.
// `firstHitOnly` = the nearest hit only. Without the library everything still works, only slower.
import * as THREE from 'three';

let installed = false;

export function installBvh(): void {
  if (installed) return;
  installed = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bvh = require('three-mesh-bvh');
    (THREE.BufferGeometry.prototype as any).computeBoundsTree = bvh.computeBoundsTree;
    (THREE.BufferGeometry.prototype as any).disposeBoundsTree = bvh.disposeBoundsTree;
    (THREE.Mesh.prototype as any).raycast = bvh.acceleratedRaycast;
  } catch {
    /* no BVH: three's own raycast */
  }
}

export function buildBvh(mesh: THREE.Mesh): void {
  const g = mesh.geometry as any;
  if (typeof g.computeBoundsTree === 'function' && !g.boundsTree) // indirect: the BVH keeps its own triangle order and leaves the index buffer alone - the default REORDERS the index (and here it is a view on the chunk file), which would make the triangle -> element
    // ranges of the BIMC chunk point at the wrong elements (a pick would light another element / scroll to another task)
    g.computeBoundsTree({ indirect: true, maxLeafTris: 10 });
}
