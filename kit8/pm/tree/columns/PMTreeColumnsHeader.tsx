// Skia: tree column grid + header (titles in the saved column order, custom column names,
// header background colors) + column drag feedback (ghost of the dragged header + drop line)
// + the column resize guide. Drawn inside the tree Canvas, after the rows.
// Columns are in CONTENT coordinates; the whole grid follows the tree's horizontal scroll (scrollX).
// NOTE: Skia component - import it by path (not from ./index) so nothing evaluates Skia before
// CanvasKit on web (see gantt/PMGanttSurfaceLoader.web.tsx).

import React, { useMemo } from 'react';
import { Group, Line, Rect, SkFont, Text as SkText, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { PM_SCALE_HEIGHT } from '../../constants';
import { ellipsize, PMPalette, readableTextOn } from '../../theme';
import { makeMeasure } from '../../skia/usePMFonts';
import { PMTreeColumnsLayout } from './treeColumns';
import { PMTreeColumnDrag, PMTreeColumnGeometry } from './useTreeColumnDragGesture';
import { PMTreeColumnResize } from './useTreeColumnResizeGesture';

export default function PMTreeColumnsHeader({
  layout,
  palette,
  font,
  height,
  drag,
  resize,
  geometry,
  scrollX,
  headerColors,
}: {
  layout: PMTreeColumnsLayout;
  palette: PMPalette;
  /** header font (null while fonts load) */
  font: SkFont | null;
  /** canvas height (the separators run through the body too) */
  height: number;
  drag: PMTreeColumnDrag;
  resize: PMTreeColumnResize;
  geometry: SharedValue<PMTreeColumnGeometry>;
  /** horizontal scroll of the tree (content x -> view x = x - scrollX) */
  scrollX: SharedValue<number>;
  /** project.rowJSON.customColumns.headersBackgroundColors */
  headerColors: Record<string, string>;
}) {
  const { width, separators, columns, contentWidth } = layout;
  const xTransform = useDerivedValue(() => [{ translateX: -scrollX.value }]);
  const guideX = useDerivedValue(() => {
    const i = resize.resizing.value;
    const g = geometry.value;
    return i >= 0 && i < g.xs.length ? g.xs[i] + g.ws[i] - 1 : -10;
  });
  const titles = useMemo(() => {
    const measure = makeMeasure(font);
    return columns.map((c) => {
      const pad = c.key === 'name' ? 10 : 8;
      return { key: c.key, x: c.x + pad, text: ellipsize(c.title, c.w - pad - 4, measure) };
    });
  }, [columns, font]);

  return (
    <>
      {/* ---- header background (whole pane) ---- */}
      <Rect x={0} y={0} width={width} height={PM_SCALE_HEIGHT} color={palette.header} />

      <Group transform={xTransform}>
        {/* ---- colored headers (rowJSON.customColumns.headersBackgroundColors) ---- */}
        {columns.map((c) =>
          headerColors[c.key] ? <Rect key={`bg${c.key}`} x={c.x} y={0} width={c.w} height={PM_SCALE_HEIGHT - 1} color={headerColors[c.key]} /> : null
        )}

        {/* ---- column separators (body + header) ---- */}
        {separators.map((x) => (
          <Line key={`b${x}`} p1={vec(x + 0.5, PM_SCALE_HEIGHT)} p2={vec(x + 0.5, height)} color={palette.grid} strokeWidth={1} />
        ))}
        {separators.map((x) => (
          <Line key={`h${x}`} p1={vec(x + 0.5, 0)} p2={vec(x + 0.5, PM_SCALE_HEIGHT)} color={palette.gridStrong} strokeWidth={1} />
        ))}
        {/* right edge of the last column (its resize handle) when the columns do not fill the pane */}
        {contentWidth < width - 1 && <Line p1={vec(contentWidth - 0.5, 0)} p2={vec(contentWidth - 0.5, height)} color={palette.gridStrong} strokeWidth={1} />}

        {font &&
          titles.map((t) => (
            <SkText
              key={t.key}
              x={t.x}
              y={PM_SCALE_HEIGHT / 2 + 4}
              text={t.text}
              font={font}
              color={(headerColors[t.key] && readableTextOn(headerColors[t.key])) || palette.textMuted}
            />
          ))}

        {/* ---- column drag & drop feedback ---- */}
        <Rect x={drag.ghostX} y={0} width={drag.ghostW} height={height} color={palette.ghost} opacity={drag.ghostOpacity} />
        <Rect x={drag.dropX} y={0} width={2} height={height} color={palette.primary} opacity={drag.ghostOpacity} />
        {/* ---- column resize guide ---- */}
        <Rect x={guideX} y={0} width={2} height={height} color={palette.primary} opacity={resize.guideOpacity} />
      </Group>

      <Line p1={vec(0, PM_SCALE_HEIGHT - 0.5)} p2={vec(width, PM_SCALE_HEIGHT - 0.5)} color={palette.gridStrong} strokeWidth={1} />
      <Line p1={vec(width - 0.5, 0)} p2={vec(width - 0.5, height)} color={palette.gridStrong} strokeWidth={1} />
    </>
  );
}
