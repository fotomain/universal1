// columnResizeWidth: resize a tree column (the Task name column and every other one) by dragging
// the separator at its RIGHT edge in the header. Live: onLive(key, width) on every move (the tree
// re-lays out), onCommit(key, width) once on release (saved in uxuiSettings.treeColumnsWidths).
// Double-click on a separator (handled by the tree) = default width.
//
// Stable gesture: the geometry is read from a shared value, so re-layouts during the drag do not
// replace the gesture object (RNGH would cancel it). x = CONTENT x (pointer x + horizontal scroll).

import { useCallback, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { DerivedValue, runOnJS, SharedValue, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { PM_SCALE_HEIGHT } from '../../constants';
import { clampTreeColumnWidth, PMTreeColumnKey, PMTreeColumnsLayout } from './treeColumns';
import { PMTreeColumnGeometry, resizeEdgeIndexAt } from './useTreeColumnDragGesture';

export interface PMTreeColumnResize {
  gesture: ReturnType<typeof Gesture.Pan>;
  /** index (in layout.columns at the start) of the resized column, -1 = none */
  resizing: SharedValue<number>;
  /** 1 while resizing (guide line opacity) */
  guideOpacity: DerivedValue<number>;
}

export function useTreeColumnResizeGesture(
  layout: PMTreeColumnsLayout,
  geometry: SharedValue<PMTreeColumnGeometry>,
  opts: {
    scrollX: SharedValue<number>;
    dragging?: SharedValue<number>;
    onStart?: () => void;
    onLive: (key: PMTreeColumnKey, width: number) => void;
    onCommit: (key: PMTreeColumnKey, width: number) => void;
  }
): PMTreeColumnResize {
  const resizing = useSharedValue(-1);
  const startW = useSharedValue(0);
  const downX = useSharedValue(0);
  const lastW = useSharedValue(0);
  const { scrollX, dragging } = opts;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  /** key of the column being resized (fixed at the start: indexes move while widths change) */
  const keyRef = useRef<PMTreeColumnKey | null>(null);
  const began = useCallback((i: number) => {
    keyRef.current = layoutRef.current.columns[i]?.key ?? null;
    optsRef.current.onStart?.();
  }, []);
  const live = useCallback((w: number) => {
    const k = keyRef.current;
    if (k) optsRef.current.onLive(k, clampTreeColumnWidth(k, w));
  }, []);
  const commit = useCallback((w: number) => {
    const k = keyRef.current;
    keyRef.current = null;
    if (k) optsRef.current.onCommit(k, clampTreeColumnWidth(k, w));
  }, []);

  const guideOpacity = useDerivedValue<number>(() => (resizing.value >= 0 ? 1 : 0));

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((e, m) => {
          'worklet';
          const t = e.allTouches[0];
          if (!t || t.y < 0 || t.y >= PM_SCALE_HEIGHT) {
            m.fail();
            return;
          }
          const g = geometry.value;
          const i = resizeEdgeIndexAt(g, t.x + scrollX.value);
          if (i < 0) {
            m.fail();
            return;
          }
          resizing.value = -1;
          downX.value = t.x;
          startW.value = g.ws[i];
          lastW.value = g.ws[i];
          // remember which edge: activate on the first move
          resizing.value = -2 - i;
        })
        .onTouchesMove((e, m) => {
          'worklet';
          const t = e.allTouches[0];
          if (t && Math.abs(t.x - downX.value) > 2) m.activate();
        })
        .onStart(() => {
          'worklet';
          const i = -2 - resizing.value;
          if (i < 0) return;
          resizing.value = i;
          if (dragging) dragging.value = 1;
          runOnJS(began)(i);
        })
        .onChange((e) => {
          'worklet';
          if (resizing.value < 0) return;
          const w = startW.value + e.translationX;
          if (Math.abs(w - lastW.value) < 1) return;
          lastW.value = w;
          runOnJS(live)(w);
        })
        .onEnd(() => {
          'worklet';
          if (resizing.value >= 0) runOnJS(commit)(lastW.value);
        })
        .onFinalize(() => {
          'worklet';
          resizing.value = -1;
          if (dragging) dragging.value = 0;
        }),
    [geometry, scrollX, dragging, began, live, commit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { gesture, resizing, guideOpacity };
}
