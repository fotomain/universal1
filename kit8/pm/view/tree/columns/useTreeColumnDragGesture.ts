// Drag & drop of the tree columns by their header (web: press + move, touch: press + move
// in the header row). Runs on the UI thread (ghost + drop line); one JS call on release
// computes the new order (moveTreeColumn) and hands it to onReorder.
//
// The column geometry lives in a shared value, so the gesture object stays the same while the
// layout changes (a column being resized, a new custom column) - RNGH would otherwise cancel
// the running gesture. x values are CONTENT x (pointer x + the tree's horizontal scroll).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { DerivedValue, runOnJS, SharedValue, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { PM_SCALE_HEIGHT } from '../../../model/constants';
import { moveTreeColumn, PMTreeColumnKey, PMTreeColumnsLayout, PM_TREE_RESIZE_GRAB } from './treeColumns';

/** px the pointer must travel in the header before a column drag starts */
const ACTIVATE_PX = 6;

export interface PMTreeColumnGeometry {
  xs: number[];
  ws: number[];
  contentWidth: number;
  /** half width of the resize grab zone around a column's right edge */
  grab: number;
}

export const geometryOfLayout = (l: PMTreeColumnsLayout, grab = PM_TREE_RESIZE_GRAB): PMTreeColumnGeometry => ({
  xs: l.columns.map((c) => c.x),
  ws: l.columns.map((c) => c.w),
  contentWidth: l.contentWidth,
  grab,
});

/** Shared (UI-thread) copy of the column geometry, updated whenever the layout changes. */
export function useTreeColumnGeometry(layout: PMTreeColumnsLayout, grab = PM_TREE_RESIZE_GRAB): SharedValue<PMTreeColumnGeometry> {
  const geo = useSharedValue<PMTreeColumnGeometry>(geometryOfLayout(layout, grab));
  const key = `${layout.columns.map((c) => `${c.x}:${c.w}`).join(',')}|${layout.contentWidth}|${grab}`;
  useEffect(() => {
    geo.value = geometryOfLayout(layout, grab);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return geo;
}

/** Index of the column under content x (-1 = none). */
export function columnIndexAt(g: PMTreeColumnGeometry, x: number): number {
  'worklet';
  for (let i = 0; i < g.xs.length; i++) if (x >= g.xs[i] && x < g.xs[i] + g.ws[i]) return i;
  return -1;
}

/** Index of the column whose right edge is within `grab` px of content x (-1 = none). */
export function resizeEdgeIndexAt(g: PMTreeColumnGeometry, x: number, grab?: number): number {
  'worklet';
  let best = -1;
  let bestD = (grab ?? g.grab) + 0.001;
  for (let i = 0; i < g.xs.length; i++) {
    const d = Math.abs(g.xs[i] + g.ws[i] - x);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export interface PMTreeColumnDrag {
  gesture: ReturnType<typeof Gesture.Pan>;
  /** index (in layout.columns) of the dragged column, -1 = none */
  dragFrom: SharedValue<number>;
  /** left content x of the dragged column ghost */
  ghostX: SharedValue<number>;
  ghostW: SharedValue<number>;
  ghostOpacity: DerivedValue<number>;
  /** content x of the drop line */
  dropX: DerivedValue<number>;
}

export function useTreeColumnDragGesture(
  layout: PMTreeColumnsLayout,
  onReorder: (order: PMTreeColumnKey[]) => void,
  opts: { dragging?: SharedValue<number>; onStart?: () => void; scrollX?: SharedValue<number>; geometry?: SharedValue<PMTreeColumnGeometry> } = {}
): PMTreeColumnDrag {
  const dragFrom = useSharedValue(-1);
  const ghostX = useSharedValue(0);
  const ghostW = useSharedValue(0);
  const grabDX = useSharedValue(0);
  const downX = useSharedValue(0);
  const dropSlot = useSharedValue(-1);
  const zero = useSharedValue(0);
  const ownGeo = useTreeColumnGeometry(layout);
  const geo = opts.geometry ?? ownGeo;
  const scrollX = opts.scrollX ?? zero;
  const { dragging } = opts;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const onStartRef = useRef(opts.onStart);
  onStartRef.current = opts.onStart;
  const commit = useCallback((from: number, slot: number) => {
    const l = layoutRef.current;
    const col = l.columns[from];
    if (!col || slot < 0) return;
    const next = moveTreeColumn(l, col.key, slot);
    if (next !== l.order) onReorderRef.current(next);
  }, []);
  const started = useCallback(() => onStartRef.current?.(), []);

  const ghostOpacity = useDerivedValue<number>(() => (dragFrom.value >= 0 ? 1 : 0));
  const dropX = useDerivedValue(() => {
    const s = dropSlot.value;
    if (s < 0) return -10;
    const g = geo.value;
    const b = s === 0 ? 0 : (g.xs[s - 1] ?? 0) + (g.ws[s - 1] ?? 0);
    return Math.max(0, Math.min(g.contentWidth - 2, b - 1));
  });

  const gesture = useMemo(() => {
    const slotAt = (x: number) => {
      'worklet';
      const g = geo.value;
      let best = 0;
      let bestD = Math.abs(x);
      for (let i = 0; i < g.xs.length; i++) {
        const d = Math.abs(g.xs[i] + g.ws[i] - x);
        if (d < bestD) {
          bestD = d;
          best = i + 1;
        }
      }
      return best;
    };
    return Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((e, m) => {
        'worklet';
        const t = e.allTouches[0];
        const g = geo.value;
        const x = t ? t.x + scrollX.value : -1;
        // only in the header row, only on a column (not on a resize edge), and only if there is something to reorder
        if (!t || t.y < 0 || t.y >= PM_SCALE_HEIGHT || g.xs.length < 2 || columnIndexAt(g, x) < 0 || resizeEdgeIndexAt(g, x) >= 0) {
          m.fail();
          return;
        }
        downX.value = x;
      })
      .onTouchesMove((e, m) => {
        'worklet';
        const t = e.allTouches[0];
        if (t && Math.abs(t.x + scrollX.value - downX.value) > ACTIVATE_PX) m.activate();
      })
      .onStart(() => {
        'worklet';
        const g = geo.value;
        const i = columnIndexAt(g, downX.value);
        if (i < 0) return;
        dragFrom.value = i;
        grabDX.value = downX.value - g.xs[i];
        ghostX.value = g.xs[i];
        ghostW.value = g.ws[i];
        dropSlot.value = i;
        if (dragging) dragging.value = 1;
        runOnJS(started)();
      })
      .onChange((e) => {
        'worklet';
        const i = dragFrom.value;
        if (i < 0) return;
        const g = geo.value;
        const x = e.x + scrollX.value;
        ghostX.value = Math.max(0, Math.min(g.contentWidth - g.ws[i], x - grabDX.value));
        dropSlot.value = slotAt(x);
      })
      .onEnd(() => {
        'worklet';
        if (dragFrom.value >= 0) runOnJS(commit)(dragFrom.value, dropSlot.value);
      })
      .onFinalize(() => {
        'worklet';
        dragFrom.value = -1;
        dropSlot.value = -1;
        if (dragging) dragging.value = 0;
      });
  }, [geo, scrollX, commit, started, dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  return { gesture, dragFrom, ghostX, ghostW, ghostOpacity, dropX };
}
