// What stands INSIDE the canvas: the chunk meshes, the lights, the colours of the states. Gestures are outside (BimViewer) and talk to it through the controller.
import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BimcChunk } from '../bimc/bimcReader';
import { BIM_STATE_DIM, BIM_STATE_HIGHLIGHT, BIM_STATE_NORMAL } from '../model/bimModel';
import { buildBvh, installBvh } from './bimBvh';
import { orbitPosition, type BimOrbit } from './bimCamera';
import { applyElementStates, buildChunkMesh, disposeChunkMesh, pickElement, type BimChunkMesh, type BimStateColors } from './bimSceneBuilder';
import type { BimSceneController } from './bimCanvasTypes';

export interface BimSceneContentProps {
  chunks: Array<{ hash: string; chunk: BimcChunk }>;
  highlighted: ReadonlySet<string>;
  dimRest: boolean;
  colors: BimStateColors;
  background: string;
  orbitRef: React.MutableRefObject<BimOrbit>;
  controllerRef: React.MutableRefObject<BimSceneController | null>;
  size: { width: number; height: number };
  /** a bigger number = the model grew: the far plane follows */
  modelRadius: number;
}

export default function BimSceneContent({ chunks, highlighted, dimRest, colors, background, orbitRef, controllerRef, size, modelRadius }: BimSceneContentProps) {
  const { camera, scene, invalidate } = useThree();
  const meshes = useRef(new Map<string, BimChunkMesh>());
  const raycaster = useRef(new THREE.Raycaster());

  const place = React.useCallback(() => {
    const o = orbitRef.current;
    const p = orbitPosition(o);
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(o.target[0], o.target[1], o.target[2]);
    camera.near = Math.max(0.05, o.distance / 400);
    camera.far = Math.max(500, o.distance + modelRadius * 6);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate, modelRadius, orbitRef]);

  const stateOf = React.useCallback(
    (g: string) => (highlighted.has(g) ? BIM_STATE_HIGHLIGHT : dimRest && highlighted.size > 0 ? BIM_STATE_DIM : BIM_STATE_NORMAL),
    [highlighted, dimRest]
  );

  // chunks come and go
  useEffect(() => {
    installBvh();
    const want = new Map(chunks.map((c) => [c.hash, c]));
    for (const [h, cm] of meshes.current) {
      if (!want.has(h)) {
        scene.remove(cm.mesh);
        disposeChunkMesh(cm);
        meshes.current.delete(h);
      }
    }
    for (const c of chunks) {
      if (meshes.current.has(c.hash)) continue;
      const cm = buildChunkMesh(c.hash, c.chunk);
      buildBvh(cm.mesh);
      applyElementStates(cm, stateOf, colors);
      scene.add(cm.mesh);
      meshes.current.set(c.hash, cm);
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, scene]);

  // the colours follow the state
  useEffect(() => {
    let any = false;
    for (const cm of meshes.current.values()) any = applyElementStates(cm, stateOf, colors) || any;
    if (any) invalidate();
  }, [stateOf, colors, invalidate]);

  useEffect(() => {
    place();
  }, [place, size.width, size.height]);

  useEffect(() => {
    controllerRef.current = {
      render: place,
      pick: (x, y) => {
        if (size.width <= 0 || size.height <= 0) return null;
        raycaster.current.setFromCamera(new THREE.Vector2((x / size.width) * 2 - 1, -((y / size.height) * 2 - 1)), camera);
        (raycaster.current as any).firstHitOnly = true;
        return pickElement([...meshes.current.values()], raycaster.current)?.ifcGuid ?? null;
      },
    };
    return () => {
      controllerRef.current = null;
    };
  }, [camera, controllerRef, place, size.height, size.width]);

  useEffect(
    () => () => {
      for (const cm of meshes.current.values()) {
        scene.remove(cm.mesh);
        disposeChunkMesh(cm);
      }
      meshes.current.clear();
    },
    [scene]
  );

  return (
    <>
      <color attach="background" args={[background]} />
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#ffffff', '#8a8f98', 0.9]} />
      <directionalLight position={[40, 80, 30]} intensity={1.4} />
    </>
  );
}
