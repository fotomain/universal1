// Web twin of CameraPermissionGate.tsx. react-native-vision-camera THROWS when it is imported in a browser ("VisionCamera currently does not work on web"),
// so the native gate cannot be loaded here. The Identification photo step has no camera on the web (MrzPhotoStep.web: the user types the values), so
// there is nothing to ask for: the screen opens at once. A web screen that does use the camera asks getUserMedia itself (RecordPhoto.web).
import React from 'react';
import type { CameraPermissionGateProps } from './cameraPermissionGateTypes';

export default function CameraPermissionGate({ children }: CameraPermissionGateProps) {
  return <>{children}</>;
}
