// Web: react-three-fiber on a canvas. Render on demand, pixel ratio at most 2.
import React from 'react';
import { Canvas } from '@react-three/fiber';
import type { BimCanvasProps } from './bimCanvasTypes';

export default function BimCanvas({ width, height, children, testID }: BimCanvasProps) {
  return (
    <Canvas data-testid={testID} style={{ width, height }} frameloop="demand" dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 5000 }} gl={{ antialias: true, alpha: false }} flat>
      {children}
    </Canvas>
  );
}
