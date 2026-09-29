// Skia: tree column grid + header (titles in the saved column order) + column drag feedback
// (ghost of the dragged header + drop line). Drawn inside the tree Canvas, after the rows.
// NOTE: Skia component - import it by path (not from ./index) so nothing evaluates Skia before
// CanvasKit on web (see gantt/PMGanttSurfaceLoader.web.tsx).

import React from 'react';
import { Line, Rect, SkFont, Text as SkText, vec } from '@shopify/react-native-skia';
import { PM_SCALE_HEIGHT } from '../../constants';
import { PMPalette } from '../../theme';
import { PMTreeColumnsLayout } from './treeColumns';
import { PMTreeColumnDrag } from './useTreeColumnDragGesture';

export default function PMTreeColumnsHeader({
  layout,
  palette,
  font,
  height,
  drag,
}: {
  layout: PMTreeColumnsLayout;
  palette: PMPalette;
  /** header font (null while fonts load) */
  font: SkFont | null;
  /** canvas height (the separators run through the body too) */
  height: number;
  drag: PMTreeColumnDrag;
}) {
  const { width, separators, columns } = layout;
  return (
    <>
      {/* ---- column separators (body) ---- */}
      {separators.map((x) => (
        <Line key={`b${x}`} p1={vec(x + 0.5, 0)} p2={vec(x + 0.5, height)} color={palette.grid} strokeWidth={1} />
      ))}

      {/* ---- header (matches the chart's 2-tier time scale height) ---- */}
      <Rect x={0} y={0} width={width} height={PM_SCALE_HEIGHT} color={palette.header} />
      <Line p1={vec(0, PM_SCALE_HEIGHT - 0.5)} p2={vec(width, PM_SCALE_HEIGHT - 0.5)} color={palette.gridStrong} strokeWidth={1} />
      {separators.map((x) => (
        <Line key={`h${x}`} p1={vec(x + 0.5, 0)} p2={vec(x + 0.5, PM_SCALE_HEIGHT)} color={palette.gridStrong} strokeWidth={1} />
      ))}
      {font &&
        columns.map((c) => (
          <SkText key={c.key} x={c.x + (c.key === 'name' ? 10 : 8)} y={PM_SCALE_HEIGHT / 2 + 4} text={c.title} font={font} color={palette.textMuted} />
        ))}

      {/* ---- column drag & drop feedback ---- */}
      <Rect x={drag.ghostX} y={0} width={drag.ghostW} height={height} color={palette.ghost} opacity={drag.ghostOpacity} />
      <Rect x={drag.dropX} y={0} width={2} height={height} color={palette.primary} opacity={drag.ghostOpacity} />
      <Line p1={vec(width - 0.5, 0)} p2={vec(width - 0.5, height)} color={palette.gridStrong} strokeWidth={1} />
    </>
  );
}
