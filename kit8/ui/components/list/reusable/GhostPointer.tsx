// ReusableList - the ghost pointer exists on the WEB only (a browser cannot move the real mouse pointer). iOS / Android: nothing to draw.
import React, { forwardRef, useImperativeHandle } from 'react';
import type { GhostPointerHandle, GhostPointerProps } from './ghostPointerTypes';

const GhostPointer = forwardRef<GhostPointerHandle, GhostPointerProps>(function GhostPointer(_props, ref) {
  useImperativeHandle(ref, () => ({ jump: () => {} }), []);
  return null;
});

export default GhostPointer;
