// Zoom out · Zoom in · Fit to screen.

import React from 'react';
import { PMPalette } from '../../theme';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { pmT } from '../../../i18n/pmT';

export default function PMGanttZoomButtons({
  palette,
  onZoomOut,
  onZoomIn,
  onFit,
}: {
  palette: PMPalette;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
}) {
  return (
    <>
      <PMIconButton testID="pm-gantt-zoom-out" icon="zoom_out" title={pmT('Zoom out')} color={palette.text} onPress={onZoomOut} />
      <PMIconButton testID="pm-gantt-zoom-in" icon="zoom_in" title={pmT('Zoom in')} color={palette.text} onPress={onZoomIn} />
      <PMIconButton testID="pm-gantt-fit" icon="fit_screen" title={pmT('Fit to screen')} color={palette.text} onPress={onFit} />
    </>
  );
}
