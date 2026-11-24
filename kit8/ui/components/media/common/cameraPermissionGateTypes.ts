// Shared props of CameraPermissionGate.tsx and its web twin (tsc resolves .web first: a twin must not import types from './CameraPermissionGate').
import type React from 'react';

export interface CameraPermissionGateProps {
  /** what the camera is for, one short sentence ('to photograph the zone of the document') */
  reason: string;
  children: React.ReactNode;
}
