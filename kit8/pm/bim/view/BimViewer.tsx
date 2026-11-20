// The 3D view: gestures (orbit, pan, pinch, wheel, tap) + the canvas. It knows NOTHING of the task tree: it gets `highlighted` (IFC ids) and gives onElementPress(ifcGuid) -
// useBimTaskBridge is the only place that talks to the store (documentation/BIM_WBS.html section 5).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import BimAxisGizmo from './BimAxisGizmo';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { BimcChunk } from '../bimc/bimcReader';
import BimCanvas from './BimCanvas';
import BimSceneContent from './BimSceneContent';
import { BIM_TAP_MAX_MOVE_PX, BIM_TAP_MAX_MS, fitBox, orbitBy, panBy, zoomBy, type BimOrbit } from './bimCamera';
import type { BimSceneController } from './bimCanvasTypes';
import type { BimStateColors } from './bimSceneBuilder';

export interface BimViewerProps {
  width: number;
  height: number;
  chunks: Array<{ hash: string; chunk: BimcChunk }>;
  /** the box of the whole model (scene space) */
  modelBox: number[];
  highlighted: ReadonlySet<string>;
  dimRest: boolean;
  colors: BimStateColors;
  background: string;
  /** move the camera to this box when `zoomNonce` changes (null = nothing) */
  zoomBox?: number[] | null;
  zoomNonce?: number;
  /** a change makes the camera fit the whole model again */
  fitNonce?: number;
  onElementPress: (ifcGuid: string) => void;
  onEmptyPress?: () => void;
  testID?: string;
}

export default function BimViewer({ width, height, chunks, modelBox, highlighted, dimRest, colors, background, zoomBox, zoomNonce = 0, fitNonce = 0, onElementPress, onEmptyPress, testID }: BimViewerProps) {
  const aspect = width > 0 && height > 0 ? width / height : 1;
  const orbitRef = useRef<BimOrbit>(fitBox(modelBox, 45, aspect));
  const controllerRef = useRef<BimSceneController | null>(null);
  const modelRadius = useMemo(() => Math.max(1, Math.hypot(modelBox[3] - modelBox[0], modelBox[4] - modelBox[1], modelBox[5] - modelBox[2]) / 2), [modelBox]);
  const cb = useRef({ onElementPress, onEmptyPress });
  cb.current = { onElementPress, onEmptyPress };
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };

  // the orientation scheme (XYZ gizmo) turns with the camera
  const [angles, setAngles] = useState({ yaw: orbitRef.current.yaw, pitch: orbitRef.current.pitch });
  const render = () => {
    controllerRef.current?.render();
    const o = orbitRef.current;
    setAngles((a) => (Math.abs(a.yaw - o.yaw) < 1e-4 && Math.abs(a.pitch - o.pitch) < 1e-4 ? a : { yaw: o.yaw, pitch: o.pitch }));
  };

  // the whole model in view: at the start, on "Fit"
  useEffect(() => {
    orbitRef.current = fitBox(modelBox, 45, aspect, orbitRef.current.yaw, orbitRef.current.pitch);
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce, modelBox]);

  // the selection in view
  useEffect(() => {
    if (!zoomBox) return;
    const f = fitBox(zoomBox, 45, aspect, orbitRef.current.yaw, orbitRef.current.pitch);
    orbitRef.current = { ...f, distance: Math.max(f.distance, 3) };
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomNonce]);

  const gesture = useMemo(() => {
    const orbit = Gesture.Pan().minPointers(1).maxPointers(1).runOnJS(true).onChange((e) => {
      orbitRef.current = orbitBy(orbitRef.current, e.changeX, e.changeY);
      render();
    });
    const pan = Gesture.Pan().minPointers(2).maxPointers(2).runOnJS(true).onChange((e) => {
      orbitRef.current = panBy(orbitRef.current, e.changeX, e.changeY, sizeRef.current.height);
      render();
    });
    const pinch = Gesture.Pinch().runOnJS(true).onChange((e) => {
      if (e.scaleChange > 0) {
        orbitRef.current = zoomBy(orbitRef.current, 1 / e.scaleChange);
        render();
      }
    });
    const tap = Gesture.Tap().maxDistance(BIM_TAP_MAX_MOVE_PX).maxDuration(BIM_TAP_MAX_MS).runOnJS(true).onEnd((e, ok) => {
      if (!ok) return;
      const hit = controllerRef.current?.pick(e.x, e.y) ?? null;
      if (hit) cb.current.onElementPress(hit);
      else cb.current.onEmptyPress?.();
    });
    return Gesture.Exclusive(tap, Gesture.Simultaneous(orbit, pan, pinch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onWheel = Platform.OS === 'web' ? ({ onWheel: (e: any) => { e.preventDefault?.(); orbitRef.current = zoomBy(orbitRef.current, Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0015)); render(); } } as any) : {};

  return (
    <GestureDetector gesture={gesture}>
      <View testID={testID} collapsable={false} style={{ width, height, overflow: 'hidden', ...(Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as any) : null) }} {...onWheel}>
        <BimCanvas width={width} height={height} testID={testID ? `${testID}-canvas` : undefined}>
          <BimSceneContent chunks={chunks} highlighted={highlighted} dimRest={dimRest} colors={colors} background={background} orbitRef={orbitRef} controllerRef={controllerRef} size={{ width, height }} modelRadius={modelRadius} />
        </BimCanvas>
        <BimAxisGizmo yaw={angles.yaw} pitch={angles.pitch} testID={testID ? `${testID}-axes` : undefined} />
      </View>
    </GestureDetector>
  );
}
