// One virtual viewport shared by the Skia tree and the Skia chart.
//
// Instead of two ScrollViews that must be kept in sync (the classic Gantt desync bug),
// there is exactly ONE vertical scroll value (a Reanimated shared value). Both canvases
// translate their row layer by the same value on the UI thread, so tree row i and bar i
// are always on the same pixel row. React only re-renders when the visible row/day
// window crosses a bucket boundary (virtualization), never per scroll frame.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { runOnJS, SharedValue, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  PM_DAY_BUCKET,
  PM_DAY_WIDTH_MAX,
  PM_DAY_WIDTH_MIN,
  PM_OVERSCAN_ROWS,
  PM_ROW_BUCKET,
  PM_ROW_HEIGHT,
} from './constants';

export interface PMWindow {
  firstRow: number;
  lastRow: number; // inclusive
  firstDay: number;
  lastDay: number; // inclusive
}

export interface PMViewport {
  scrollX: SharedValue<number>; // px in LIVE zoom units
  scrollY: SharedValue<number>;
  dayWidthLive: SharedValue<number>; // follows pinch / ctrl+wheel every frame
  bodyH: SharedValue<number>; // visible rows area height (canvas minus time scale)
  chartW: SharedValue<number>;
  rowCount: SharedValue<number>;
  totalDays: SharedValue<number>;
  hoverRow: SharedValue<number>; // -1 = none
  dragging: SharedValue<number>; // 1 while a bar/row drag is active (hides hover panels)
  win: PMWindow;
  /** committed zoom (React); live/committed = on-the-fly scaleX during pinch */
  dayWidth: number;
  setZoom: (dayWidth: number, focalX?: number) => void;
  scrollToX: (x: number, animated?: boolean) => void;
  scrollToRow: (index: number) => void;
}

export function clampValue(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.max(lo, Math.min(hi, v));
}

export function maxScrollY(rowCount: number, bodyH: number): number {
  'worklet';
  return Math.max(0, rowCount * PM_ROW_HEIGHT + PM_ROW_HEIGHT - bodyH);
}

export function maxScrollX(totalDays: number, dayWidth: number, chartW: number): number {
  'worklet';
  return Math.max(0, totalDays * dayWidth - chartW);
}

const ENC = 1_000_000;

export function useGanttViewport(params: {
  rowCount: number;
  bodyHeight: number;
  chartWidth: number;
  totalDays: number;
  dayWidth: number; // committed zoom from the store
  onCommitZoom: (dayWidth: number) => void;
}): PMViewport {
  const { rowCount, bodyHeight, chartWidth, totalDays, dayWidth, onCommitZoom } = params;
  const scrollX = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const dayWidthLive = useSharedValue(dayWidth);
  const bodyH = useSharedValue(bodyHeight);
  const chartW = useSharedValue(chartWidth);
  const rowCountSV = useSharedValue(rowCount);
  const totalDaysSV = useSharedValue(totalDays);
  const hoverRow = useSharedValue(-1);
  const dragging = useSharedValue(0);

  // keep geometry shared values in sync with React layout, re-clamping scroll
  useEffect(() => {
    bodyH.value = bodyHeight;
    chartW.value = chartWidth;
    rowCountSV.value = rowCount;
    totalDaysSV.value = totalDays;
    scrollY.value = clampValue(scrollY.value, 0, maxScrollY(rowCount, bodyHeight));
    scrollX.value = clampValue(scrollX.value, 0, maxScrollX(totalDays, dayWidthLive.value, chartWidth));
  }, [bodyHeight, chartWidth, rowCount, totalDays, bodyH, chartW, rowCountSV, totalDaysSV, scrollX, scrollY, dayWidthLive]);

  // committed zoom changed from outside (toolbar, commit after pinch) -> live follows
  useEffect(() => {
    if (Math.abs(dayWidthLive.value - dayWidth) > 1e-6) dayWidthLive.value = dayWidth;
  }, [dayWidth, dayWidthLive]);

  // ---- virtualization windows (bucketed so React renders rarely) ----------------------
  const [rowWin, setRowWin] = useState(0);
  const [dayWin, setDayWin] = useState(0);

  useAnimatedReaction(
    () => {
      const first = Math.max(0, Math.floor(scrollY.value / PM_ROW_HEIGHT) - PM_OVERSCAN_ROWS);
      const bucket = Math.floor(first / PM_ROW_BUCKET) * PM_ROW_BUCKET;
      const visible = Math.ceil(bodyH.value / PM_ROW_HEIGHT);
      return bucket * ENC + visible;
    },
    (cur, prev) => {
      if (cur !== prev) runOnJS(setRowWin)(cur);
    }
  );
  useAnimatedReaction(
    () => {
      const dw = Math.max(dayWidthLive.value, 0.5);
      const first = Math.max(0, Math.floor(scrollX.value / dw) - 7);
      const bucket = Math.floor(first / PM_DAY_BUCKET) * PM_DAY_BUCKET;
      const visible = Math.ceil(chartW.value / dw);
      return bucket * ENC + visible;
    },
    (cur, prev) => {
      if (cur !== prev) runOnJS(setDayWin)(cur);
    }
  );

  const win = useMemo<PMWindow>(() => {
    const firstRow = Math.floor(rowWin / ENC);
    const visRows = rowWin % ENC;
    const firstDay = Math.floor(dayWin / ENC);
    const visDays = dayWin % ENC;
    return {
      firstRow,
      lastRow: Math.min(rowCount - 1, firstRow + visRows + 2 * PM_OVERSCAN_ROWS + PM_ROW_BUCKET),
      firstDay,
      lastDay: Math.min(totalDays, firstDay + visDays + 14 + PM_DAY_BUCKET),
    };
  }, [rowWin, dayWin, rowCount, totalDays]);

  const setZoom = useCallback(
    (next: number, focalX?: number) => {
      const dw = clampValue(next, PM_DAY_WIDTH_MIN, PM_DAY_WIDTH_MAX);
      const fx = focalX ?? chartW.value / 2;
      const day = (scrollX.value + fx) / dayWidthLive.value;
      dayWidthLive.value = dw;
      scrollX.value = clampValue(day * dw - fx, 0, maxScrollX(totalDaysSV.value, dw, chartW.value));
      onCommitZoom(dw);
    },
    [chartW, scrollX, dayWidthLive, totalDaysSV, onCommitZoom]
  );

  const scrollToX = useCallback(
    (x: number, animated = true) => {
      const target = clampValue(x, 0, maxScrollX(totalDaysSV.value, dayWidthLive.value, chartW.value));
      scrollX.value = animated ? withTiming(target, { duration: 260 }) : target;
    },
    [scrollX, totalDaysSV, dayWidthLive, chartW]
  );

  const scrollToRow = useCallback(
    (index: number) => {
      const top = index * PM_ROW_HEIGHT;
      const cur = scrollY.value;
      if (top >= cur && top + PM_ROW_HEIGHT <= cur + bodyH.value) return;
      const target = clampValue(top - bodyH.value / 3, 0, maxScrollY(rowCountSV.value, bodyH.value));
      scrollY.value = withTiming(target, { duration: 220 });
    },
    [scrollY, bodyH, rowCountSV]
  );

  return {
    scrollX,
    scrollY,
    dayWidthLive,
    bodyH,
    chartW,
    rowCount: rowCountSV,
    totalDays: totalDaysSV,
    hoverRow,
    dragging,
    win,
    dayWidth,
    setZoom,
    scrollToX,
    scrollToRow,
  };
}
