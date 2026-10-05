// Skia: tree column grid + header (titles in the saved column order, custom column names,
// header background colors) + column drag feedback (ghost of the dragged header + drop line)
// + the column resize guide + the filter icon of every header (tree/filter: light ▾ = no filter,
// funnel in uxuiSettings.columnFilterIconColor = filtered, small ↑ / ↓ = sorted column).
// Drawn inside the tree Canvas, after the rows.
// Columns are in CONTENT coordinates; the whole grid follows the tree's horizontal scroll (scrollX).
// NOTE: Skia component - import it by path (not from ./index) so nothing evaluates Skia before
// CanvasKit on web (see gantt/PMGanttSurfaceLoader.web.tsx).

import React, { useMemo } from 'react';
import { Group, Line, Path, Rect, RoundedRect, SkFont, Skia, Text as SkText, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { PM_SCALE_HEIGHT } from '../../../model/constants';
import { ellipsize, PMPalette, readableTextOn, withAlpha } from '../../theme';
import { treeFilterIconBox, treeHeaderTitleWidth, PM_TREE_SORT_ARROW_W } from '../filter/treeFilterIconGeometry';
import type { PMTreeColumnSort } from '../filter/treeColumnFilter';
import { makeMeasure } from '../../../skia/usePMFonts';
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
  filteredKeys,
  sort,
  filterIconColor,
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
  /** columns with an applied filter (funnel icon) */
  filteredKeys?: Record<string, boolean>;
  /** uxuiSettings.treeColumnSort (sort arrow) */
  sort?: PMTreeColumnSort | null;
  /** uxuiSettings.columnFilterIconColor */
  filterIconColor?: string;
}) {
  const { width, separators, columns, contentWidth } = layout;
  const xTransform = useDerivedValue(() => [{ translateX: -scrollX.value }]);
  // Take the shared value out first: a worklet copies everything it uses to the UI thread, and
  // `resize` also holds the gesture object, which cannot be copied ("Cannot copy value of type PanGesture").
  const resizing = resize.resizing;
  const guideX = useDerivedValue(() => {
    const i = resizing.value;
    const g = geometry.value;
    return i >= 0 && i < g.xs.length ? g.xs[i] + g.ws[i] - 1 : -10;
  });
  const titles = useMemo(() => {
    const measure = makeMeasure(font);
    return columns.map((c) => {
      const pad = c.key === 'name' ? 10 : 8;
      return { key: c.key, x: c.x + pad, text: ellipsize(c.title, treeHeaderTitleWidth(c, pad, sort?.key === c.key), measure) };
    });
  }, [columns, font, sort?.key]);

  // ---- filter icons: one path for the light ▾ arrows, one for the funnels, one per sort arrow ----
  const icons = useMemo(() => {
    const arrows = Skia.Path.Make();
    const funnels = Skia.Path.Make();
    const sortPath = Skia.Path.Make();
    const funnelBgs: { key: string; x: number; y: number; s: number }[] = [];
    const lightArrows: { key: string; color: string }[] = [];
    for (const c of columns) {
      const b = treeFilterIconBox(c);
      if (!b) continue;
      const cy = b.y + b.size / 2;
      if (filteredKeys?.[c.key]) {
        const { x, y, size: s } = b;
        funnels.moveTo(x + 0.5, y + 1.5);
        funnels.lineTo(x + s - 0.5, y + 1.5);
        funnels.lineTo(x + s * 0.6, y + s * 0.52);
        funnels.lineTo(x + s * 0.6, y + s - 0.5);
        funnels.lineTo(x + s * 0.4, y + s - 1.8);
        funnels.lineTo(x + s * 0.4, y + s * 0.52);
        funnels.close();
        funnelBgs.push({ key: c.key, x: x - 3, y: y - 3, s: s + 6 });
      } else if (headerColors[c.key]) {
        // colored header: the arrow in the header's readable text color (drawn separately)
        lightArrows.push({ key: c.key, color: withAlpha(readableTextOn(headerColors[c.key]) || '#64748b', 0.7) });
      } else {
        arrows.moveTo(b.x + 1.5, cy - 2);
        arrows.lineTo(b.x + b.size / 2, cy + 2.5);
        arrows.lineTo(b.x + b.size - 1.5, cy - 2);
      }
      if (sort?.key === c.key) {
        const sx = b.x - PM_TREE_SORT_ARROW_W / 2 - 1;
        const top = cy - 5;
        const bottom = cy + 5;
        sortPath.moveTo(sx, top);
        sortPath.lineTo(sx, bottom);
        if (sort.direction === 'asc') {
          sortPath.moveTo(sx - 3, top + 3);
          sortPath.lineTo(sx, top);
          sortPath.lineTo(sx + 3, top + 3);
        } else {
          sortPath.moveTo(sx - 3, bottom - 3);
          sortPath.lineTo(sx, bottom);
          sortPath.lineTo(sx + 3, bottom - 3);
        }
      }
    }
    const colored = lightArrows.map((a) => {
      const c = columns.find((col) => col.key === a.key)!;
      const b = treeFilterIconBox(c)!;
      const cy = b.y + b.size / 2;
      const p = Skia.Path.Make();
      p.moveTo(b.x + 1.5, cy - 2);
      p.lineTo(b.x + b.size / 2, cy + 2.5);
      p.lineTo(b.x + b.size - 1.5, cy - 2);
      return { key: a.key, path: p, color: a.color };
    });
    return { arrows, funnels, sortPath, funnelBgs, colored };
  }, [columns, filteredKeys, sort, headerColors]);
  const funnelColor = filterIconColor || '#FF4D6D';

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

        {/* ---- filter icons (▾ = Filter & sort, funnel = filtered) + sort arrow ---- */}
        <Path path={icons.arrows} style="stroke" strokeWidth={1.6} strokeCap="round" strokeJoin="round" color={palette.headerIcon} />
        {icons.colored.map((a) => (
          <Path key={`ca${a.key}`} path={a.path} style="stroke" strokeWidth={1.6} strokeCap="round" strokeJoin="round" color={a.color} />
        ))}
        {icons.funnelBgs.map((b) => (
          <RoundedRect key={`fb${b.key}`} x={b.x} y={b.y} width={b.s} height={b.s} r={4} color={withAlpha(funnelColor, 0.16)} />
        ))}
        <Path path={icons.funnels} color={funnelColor} />
        <Path path={icons.sortPath} style="stroke" strokeWidth={1.5} strokeCap="round" strokeJoin="round" color={palette.primary} />

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
