// Native (iOS / Android): Skia is available synchronously - render the surface directly.
import React from 'react';
import PMGanttSurface, { PMGanttSurfaceProps } from './PMGanttSurface';

export default function PMGanttSurfaceLoader(props: PMGanttSurfaceProps) {
  return <PMGanttSurface {...props} />;
}
