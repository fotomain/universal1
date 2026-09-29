// Drag & drop of the tree columns by their header (web: press + move, touch: press + move
// in the header row). Runs on the UI thread (ghost + drop line); one JS call on release
// computes the new order (moveTreeColumn) and hands it to onReorder.

import { useCallback, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { DerivedValue, runOnJS, SharedValue, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { PM_SCALE_HEIGHT } from '../../constants';
import { moveTreeColumn, PMTreeColumnKey, PMTreeColumnsLayout } from './treeColumns';

/** px the pointer must travel in the header before a column drag starts */
const ACTIVATE_PX = 6;

export interface PMTreeColumnDrag {
  gesture: ReturnType<typeof Gesture.Pan>;
  /** index (in layout.columns) of the dragged column, -1 = none */
  dragFrom: SharedValue<number>;
  /** left x of the dragged column ghost */
  ghostX: SharedValue<number>;
  ghostW: SharedValue<number>;
  ghostOpacity: DerivedValue<number>;
  /** x of the drop line */
  dropX: DerivedValue<number>;
}

export function useTreeColumnDragGesture(
  layout: PMTreeColumnsLayout,
  onReorder: (order: PMTreeColumnKey[]) => void,
  opts: { dragging?: SharedValue<number>; onStart?: () => void } = {}
): PMTreeColumnDrag {
  const dragFrom = useSharedValue(-1);
  const ghostX = useSharedValue(0);
  const ghostW = useSharedValue(0);
  const grabDX = useSharedValue(0);
  const downX = useSharedValue(0);
  const dropSlot = useSharedValue(-1);
  const { dragging, onStart } = opts;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const commit = useCallback(
    (from: number, slot: number) => {
      const l = layoutRef.current;
      const col = l.columns[from];
      if (!col || slot < 0) return;
      const next = moveTreeColumn(l, col.key, slot);
      if (next !== l.order) onReorder(next);
    },
    [onReorder]
  );
  const started = useCallback(() => onStart?.(), [onStart]);

  const xs = layout.columns.map((c) => c.x);
  const ws = layout.columns.map((c) => c.w);
  const width = layout.width;
  const key = `${xs.join(',')}|${ws.join(',')}|${width}`;

  const ghostOpacity = useDerivedValue<number>(() => (dragFrom.value >= 0 ? 1 : 0));
  // bounds: 0, right edge of column 0, right edge of column 1, ...
  const bounds = useMemo(() => [0, ...xs.map((x, i) => x + ws[i])], [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dropX = useDerivedValue(() => {
    const s = dropSlot.value;
    if (s < 0) return -10;
    const b = bounds[Math.min(s, bounds.length - 1)] ?? 0;
    return Math.max(0, Math.min(width - 2, b - 1));
  }, [bounds, width]);

  const gesture = useMemo(() => {
    const columnAt = (x: number) => {
      'worklet';
      for (let i = 0; i < xs.length; i++) if (x >= xs[i] && x < xs[i] + ws[i]) return i;
      return -1;
    };
    const slotAt = (x: number) => {
      'worklet';
      let best = 0;
      for (let i = 1; i < bounds.length; i++) if (Math.abs(bounds[i] - x) < Math.abs(bounds[best] - x)) best = i;
      return best;
    };
    return Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((e, m) => {
        'worklet';
        const t = e.allTouches[0];
        // only in the header row, only on a column, and only if there is something to reorder
        if (!t || t.y < 0 || t.y >= PM_SCALE_HEIGHT || xs.length < 2 || columnAt(t.x) < 0) {
          m.fail();
          return;
        }
        downX.value = t.x;
      })
      .onTouchesMove((e, m) => {
        'worklet';
        const t = e.allTouches[0];
        if (t && Math.abs(t.x - downX.value) > ACTIVATE_PX) m.activate();
      })
      .onStart(() => {
        'worklet';
        const i = columnAt(downX.value);
        if (i < 0) return;
        dragFrom.value = i;
        grabDX.value = downX.value - xs[i];
        ghostX.value = xs[i];
        ghostW.value = ws[i];
        dropSlot.value = i;
        if (dragging) dragging.value = 1;
        runOnJS(started)();
      })
      .onChange((e) => {
        'worklet';
        const i = dragFrom.value;
        if (i < 0) return;
        ghostX.value = Math.max(0, Math.min(width - ws[i], e.x - grabDX.value));
        dropSlot.value = slotAt(e.x);
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
  }, [key, bounds, commit, started, dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  return { gesture, dragFrom, ghostX, ghostW, ghostOpacity, dropX };
}
