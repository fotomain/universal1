// The three.js side of the viewer, without React: one mesh per chunk (a Uint16 NORMALIZED position attribute, the chunk box in the object matrix = no decode work), the state of every
// element written into a per-vertex colour (normal | highlighted | dimmed: a colour write, never a rebuild of the geometry), picking by BVH raycast -> triangle -> element.
import * as THREE from 'three';
import { bimcElementIndexRanges, bimcElementOfTriangle, type BimcChunk } from '../bimc/bimcReader';
import { BIM_STATE_DIM, BIM_STATE_HIGHLIGHT, BIM_STATE_NORMAL } from '../model/bimModel';

export interface BimChunkMesh {
  hash: string;
  chunk: BimcChunk;
  mesh: THREE.Mesh;
  /** first / last+1 vertex of every element number (the vertices of an element are one block) */
  vertexRanges: Array<[number, number]>;
  /** the base colour of every element number, RGBA8 */
  baseColors: Uint8Array;
  /** the state last applied per element number (to write only what changed) */
  applied: Uint8Array;
  /** an ISOLATED mesh: the element number it draws alone (its index buffer holds only its triangles; a pick answers this element) */
  onlyElement?: number;
}

export interface BimStateColors {
  /** the highlight colour, 0..255 */
  highlight: [number, number, number];
  /** opacity of a dimmed element, 0..1 */
  dimAlpha: number;
}

export const DEFAULT_STATE_COLORS: BimStateColors = { highlight: [255, 140, 0], dimAlpha: 0.15 };

/** the vertex block of every element number */
export function elementVertexRanges(c: BimcChunk): Array<[number, number]> {
  const out: Array<[number, number]> = Array.from({ length: c.elementCount }, () => [0, 0]);
  const seen = new Uint8Array(c.elementCount);
  for (let v = 0; v < c.vertexCount; v++) {
    const e = c.elementIndex[v];
    if (!seen[e]) {
      seen[e] = 1;
      out[e] = [v, v + 1];
    } else out[e][1] = v + 1;
  }
  return out;
}

/** the colour of every element: the material of its first range */
export function elementBaseColors(c: BimcChunk): Uint8Array {
  const out = new Uint8Array(c.elementCount * 4).fill(255);
  const done = new Uint8Array(c.elementCount);
  for (const r of c.ranges) {
    if (done[r.element]) continue;
    done[r.element] = 1;
    for (let k = 0; k < 4; k++) out[r.element * 4 + k] = c.palette[r.material * 4 + k] ?? 255;
  }
  return out;
}

/** `onlyElement` = an element number of the chunk: the mesh draws that element ALONE (the component screen); the vertex buffers are shared, only the index buffer is a view on its triangles */
export function buildChunkMesh(hash: string, chunk: BimcChunk, material?: THREE.Material, onlyElement?: number): BimChunkMesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(chunk.positions, 3, true));
  const colors = new Uint8Array(chunk.vertexCount * 4);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4, true));
  if (onlyElement !== undefined) {
    const [first, count] = bimcElementIndexRanges(chunk)[onlyElement] ?? [0, 0];
    geometry.setIndex(new THREE.BufferAttribute(chunk.indices.subarray(first, first + count), 1));
  } else geometry.setIndex(new THREE.BufferAttribute(chunk.indices, 1));
  const mat = material ?? new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(chunk.min[0], chunk.min[1], chunk.min[2]);
  mesh.scale.set(chunk.size[0], chunk.size[1], chunk.size[2]);
  mesh.userData.bimHash = hash;
  const cm: BimChunkMesh = { hash, chunk, mesh, vertexRanges: elementVertexRanges(chunk), baseColors: elementBaseColors(chunk), applied: new Uint8Array(chunk.elementCount).fill(255), ...(onlyElement !== undefined ? { onlyElement } : {}) };
  applyElementStates(cm, () => BIM_STATE_NORMAL);
  return cm;
}

/** writes the colour of the elements whose state changed. stateOf(ifcGuid) -> BIM_STATE_*. Returns true when something was written. */
export function applyElementStates(cm: BimChunkMesh, stateOf: (ifcGuid: string) => number, colors: BimStateColors = DEFAULT_STATE_COLORS): boolean {
  const attr = cm.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = attr.array as Uint8Array;
  let changed = false;
  let anyDim = false;
  for (let e = 0; e < cm.chunk.elementCount; e++) {
    const s = stateOf(cm.chunk.guids[e]);
    if (s === BIM_STATE_DIM) anyDim = true;
    if (cm.applied[e] === s) continue;
    cm.applied[e] = s;
    changed = true;
    let r = cm.baseColors[e * 4];
    let g = cm.baseColors[e * 4 + 1];
    let b = cm.baseColors[e * 4 + 2];
    let a = cm.baseColors[e * 4 + 3];
    if (s === BIM_STATE_HIGHLIGHT) [r, g, b, a] = [colors.highlight[0], colors.highlight[1], colors.highlight[2], 255];
    else if (s === BIM_STATE_DIM) a = Math.round(a * colors.dimAlpha);
    const [v0, v1] = cm.vertexRanges[e];
    for (let v = v0; v < v1; v++) {
      arr[v * 4] = r;
      arr[v * 4 + 1] = g;
      arr[v * 4 + 2] = b;
      arr[v * 4 + 3] = a;
    }
  }
  if (changed) attr.needsUpdate = true;
  const m = cm.mesh.material as THREE.Material;
  const wantTransparent = anyDim || cm.baseColors.some((_, i) => i % 4 === 3 && cm.baseColors[i] < 255);
  if (m.transparent !== wantTransparent) {
    m.transparent = wantTransparent;
    m.needsUpdate = true;
  }
  return changed;
}

export interface BimHit {
  ifcGuid: string;
  hash: string;
  distance: number;
}

/** the nearest element under a ray (the BVH of three-mesh-bvh is installed on the geometries by installBvh; without it three tests every triangle) */
export function pickElement(chunks: BimChunkMesh[], raycaster: THREE.Raycaster): BimHit | null {
  let best: BimHit | null = null;
  for (const cm of chunks) {
    cm.mesh.updateMatrixWorld();
    const hits = raycaster.intersectObject(cm.mesh, false);
    const h = hits[0];
    if (!h || h.faceIndex == null) continue;
    // an isolated mesh has only the triangles of one element: its face numbers are not the chunk's
    const el = cm.onlyElement !== undefined ? cm.onlyElement : bimcElementOfTriangle(cm.chunk, h.faceIndex);
    if (el < 0) continue;
    if (!best || h.distance < best.distance) best = { ifcGuid: cm.chunk.guids[el], hash: cm.hash, distance: h.distance };
  }
  return best;
}

export function disposeChunkMesh(cm: BimChunkMesh): void {
  cm.mesh.geometry.dispose();
  (cm.mesh.material as THREE.Material).dispose();
}
