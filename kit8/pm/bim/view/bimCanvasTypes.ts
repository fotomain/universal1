// Types shared by BimCanvas.tsx (native) and BimCanvas.web.tsx: a `.web` file must not import types from its twin.
import type React from 'react';

export interface BimCanvasProps {
  width: number;
  height: number;
  children?: React.ReactNode;
  testID?: string;
}

/** what the scene gives back to the gestures (they live outside the canvas) */
export interface BimSceneController {
  /** puts the camera where the orbit says and asks for a frame */
  render: () => void;
  /** the IFC id of the element under the point (x, y in pixels of the view), or null */
  pick: (x: number, y: number) => string | null;
}
