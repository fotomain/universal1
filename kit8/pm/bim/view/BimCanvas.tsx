// iOS / Android: react-three-fiber over expo-gl (a dev build is needed: expo-gl is native code). The same scene code as the web twin (BimCanvas.web.tsx).
// No antialiasing, no shadows, render on demand: a frame only when a gesture, a selection or a chunk asks for it (battery).
import React from 'react';
import { Canvas } from '@react-three/fiber/native';
import type { BimCanvasProps } from './bimCanvasTypes';

export default function BimCanvas({ width, height, children, testID }: BimCanvasProps) {
  return (
    <Canvas testID={testID} style={{ width, height }} frameloop="demand" camera={{ fov: 45, near: 0.1, far: 5000 }} gl={{ antialias: false, alpha: false } as any} flat>
      {children}
    </Canvas>
  );
}
