// The Skia-rendered Gantt surface: [ tree | splitter | chart ] sharing ONE viewport.
// On web this module (and everything that imports Skia) is loaded lazily, after
// CanvasKit has been initialised (see PMGanttSurfaceLoader.web.tsx).
//
// Redraw on view size / orientation changes: the pane follows onLayout live, and once
// the size settles (window resize, split-screen, landscape <-> portrait) the Skia
// canvases are re-created (layoutEpoch key) so nothing stale is left on screen; scroll
// is re-clamped and the selected row kept in view.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { DAY_MS, PM_DAY_WIDTH_MAX, PM_DAY_WIDTH_MIN, PM_SCALE_HEIGHT, PM_SPLITTER_WIDTH, PM_TIMELINE_PAD_DAYS, PM_TOOLBAR_HEIGHT } from '../constants';
import { usePMStore } from '../store';
import { makePMPalette } from '../theme';
import { clampValue, maxScrollX, maxScrollY, useGanttViewport } from '../useGanttViewport';
import { mondayOnOrBefore } from './ganttGeometry';
import { diffDaysMs, todayUTC } from '../scheduling';
import { usePMCrud } from '../usePMCrud';
import PMProjectTasksTree from '../tree/PMProjectTasksTree';
import PMProjectGanttChart from './PMProjectGanttChart';
import { hidePMTip } from '../inner/tooltip/PMTooltip';

const MIN_CHART_WIDTH = 160;
const RESIZE_SETTLE_MS = 180;

export interface PMGanttSurfaceProps {
  ownerGUID: string;
  projectGUID: string;
}

export default function PMGanttSurface({ ownerGUID, projectGUID }: PMGanttSurfaceProps) {
  const { themeColors, isDark } = useDesignSystem();
  const palette = useMemo(() => makePMPalette(themeColors, isDark), [themeColors, isDark]);
  const crud = usePMCrud(ownerGUID, projectGUID);

  const rootRef = useRef<View>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const applySize = useCallback((width: number, height: number) => {
    if (!(width > 0 && height > 0)) return;
    setSize((s) => (Math.abs(s.w - width) < 0.5 && Math.abs(s.h - height) < 0.5 ? s : { w: width, h: height }));
  }, []);
  const onLayout = (e: LayoutChangeEvent) => applySize(e.nativeEvent.layout.width, e.nativeEvent.layout.height);

  // ---- view size / orientation changes -> settle -> full redraw ----
  const win = useWindowDimensions();
  const orientation = win.width >= win.height ? 'landscape' : 'portrait';
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstSize = useRef(true);
  const scheduleRedraw = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      // after a rotation onLayout can lag behind on some devices: measure once more
      const node = rootRef.current as any;
      if (node && typeof node.measure === 'function') node.measure((_x: number, _y: number, w: number, h: number) => applySize(w, h));
      setLayoutEpoch((n) => n + 1);
    }, RESIZE_SETTLE_MS);
  }, [applySize]);
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);
  // window resized / rotated (landscape <-> portrait), split view, browser resize
  const winKey = `${Math.round(win.width)}x${Math.round(win.height)}:${orientation}`;
  const lastWinKey = useRef(winKey);
  useEffect(() => {
    if (lastWinKey.current === winKey) return;
    lastWinKey.current = winKey;
    scheduleRedraw();
  }, [winKey, scheduleRedraw]);
  // the pane itself changed size (drawer, splitter of a parent layout, keyboard, ...)
  useEffect(() => {
    if (!size.w || !size.h) return;
    if (firstSize.current) {
      firstSize.current = false;
      return;
    }
    // positions of floating UI are stale now
    hidePMTip();
    const s = usePMStore.getState();
    if (s.depMenu) s.setDepMenu(null);
    if (s.cellEdit) s.setCellEdit(null);
    scheduleRedraw();
  }, [size.w, size.h, scheduleRedraw]);

  const storeTreeWidth = usePMStore((s) => s.treeWidth);
  const dayWidth = usePMStore((s) => s.dayWidth);
  const rowCount = usePMStore((s) => s.visibleRows.length);
  const projectStartMs = usePMStore((s) => s.projectStartMs);
  const projectFinishMs = usePMStore((s) => s.projectFinishMs);
  const selectedGUID = usePMStore((s) => s.selectedGUID);

  // phones: the tree takes at most ~45% so the chart stays usable
  const treeWidth = size.w ? Math.round(Math.min(storeTreeWidth, Math.max(160, size.w * 0.45))) : storeTreeWidth;
  const chartWidth = Math.max(MIN_CHART_WIDTH, size.w - treeWidth - PM_SPLITTER_WIDTH);
  const bodyHeight = Math.max(0, size.h - PM_TOOLBAR_HEIGHT - PM_SCALE_HEIGHT);

  // timeline = project range + padding, starting on a Monday, at least one screen wide
  const timelineStartMs = useMemo(
    () => mondayOnOrBefore(Math.min(projectStartMs, todayUTC()) - PM_TIMELINE_PAD_DAYS * DAY_MS),
    [projectStartMs]
  );
  const totalDays = useMemo(() => {
    const end = Math.max(projectFinishMs, todayUTC()) + PM_TIMELINE_PAD_DAYS * 2 * DAY_MS;
    return Math.max(diffDaysMs(end, timelineStartMs), Math.ceil(chartWidth / PM_DAY_WIDTH_MIN) + 7);
  }, [projectFinishMs, timelineStartMs, chartWidth]);

  const commitZoom = useCallback((dw: number) => usePMStore.getState().setDayWidth(dw), []);
  const viewport = useGanttViewport({ rowCount, bodyHeight, chartWidth, totalDays, dayWidth, onCommitZoom: commitZoom });

  // first paint of a project: scroll so the project start is near the left edge
  const didInitialScroll = useRef<string | null>(null);
  useEffect(() => {
    if (!size.w || didInitialScroll.current === projectGUID || rowCount === 0) return;
    didInitialScroll.current = projectGUID;
    viewport.scrollY.value = 0;
    viewport.scrollToX(((projectStartMs - timelineStartMs) / DAY_MS - 2) * dayWidth, false);
  }, [size.w, projectGUID, rowCount, projectStartMs, timelineStartMs, dayWidth, viewport]);

  // keep the selected row in view (keyboard / toolbar moves) - when the selection changes
  // and after every size / orientation redraw
  const { scrollToRow } = viewport;
  useEffect(() => {
    if (!selectedGUID) return;
    const idx = usePMStore.getState().rowIndexById[selectedGUID];
    if (idx !== undefined) scrollToRow(idx);
  }, [selectedGUID, scrollToRow, layoutEpoch]);

  // "activate this row" requests (back from the task page): expand its parents, select
  // it and scroll it into view once the project data is on screen
  const focusRequest = usePMStore((s) => s.focusRequest);
  const loadedProjectGUID = usePMStore((s) => s.loadedProjectGUID);
  useEffect(() => {
    if (!focusRequest || !size.w || loadedProjectGUID !== projectGUID) return;
    const s = usePMStore.getState();
    if (!s.tasksById[focusRequest.guid]) {
      // the row is not in this project (or was deleted): drop the request
      if (s.tasks.length) s.requestFocus(null);
      return;
    }
    const guid = focusRequest.guid;
    s.revealRow(guid);
    s.requestFocus(null); // consumed (re-runs this effect with null -> no-op)
    // after the expanded rows are laid out (row count shared value updated)
    setTimeout(() => {
      const idx = usePMStore.getState().rowIndexById[guid];
      if (idx !== undefined) scrollToRow(idx);
    }, 60);
  }, [focusRequest, size.w, loadedProjectGUID, projectGUID, scrollToRow]);

  // ---- web: mouse wheel / trackpad = scroll, shift+wheel = horizontal, ctrl/⌘+wheel = zoom ----
  const zoomCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { scrollX, scrollY, dayWidthLive, bodyH, chartW, rowCount: rc, totalDays: td, treeScrollX, treeMaxScrollX } = viewport; // stable shared values
  const treeWidthRef = useRef(treeWidth);
  treeWidthRef.current = treeWidth;
  useEffect(() => () => {
    if (zoomCommitTimer.current) clearTimeout(zoomCommitTimer.current);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = rootRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? bodyH.value : 1;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const fx = clampValue(e.clientX - rect.left - treeWidthRef.current - PM_SPLITTER_WIDTH, 0, chartW.value);
        const next = clampValue(dayWidthLive.value * Math.exp(-e.deltaY * unit * 0.0025), PM_DAY_WIDTH_MIN, PM_DAY_WIDTH_MAX);
        const day = (scrollX.value + fx) / dayWidthLive.value;
        dayWidthLive.value = next;
        scrollX.value = clampValue(day * next - fx, 0, maxScrollX(td.value, next, chartW.value));
        if (zoomCommitTimer.current) clearTimeout(zoomCommitTimer.current);
        zoomCommitTimer.current = setTimeout(() => commitZoom(dayWidthLive.value), 140);
        return;
      }
      let dx = e.deltaX * unit;
      let dy = e.deltaY * unit;
      if (e.shiftKey && !dx) {
        dx = dy;
        dy = 0;
      }
      // over a tree whose columns overflow (custom / resized columns): horizontal = the tree columns, not the time line
      const overTree = e.clientX - el.getBoundingClientRect().left < treeWidthRef.current;
      if (dx && overTree && treeMaxScrollX.value > 0) treeScrollX.value = clampValue(treeScrollX.value + dx, 0, treeMaxScrollX.value);
      else if (dx) scrollX.value = clampValue(scrollX.value + dx, 0, maxScrollX(td.value, dayWidthLive.value, chartW.value));
      if (dy) scrollY.value = clampValue(scrollY.value + dy, 0, maxScrollY(rc.value, bodyH.value));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollX, scrollY, dayWidthLive, bodyH, chartW, rc, td, treeScrollX, treeMaxScrollX, commitZoom]);

  // ---- splitter between tree and chart ----
  const splitStart = useRef(treeWidth);
  const splitter = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          splitStart.current = usePMStore.getState().treeWidth;
        })
        .onChange((e) => usePMStore.getState().setTreeWidth(splitStart.current + e.translationX)),
    []
  );

  return (
    <View ref={rootRef} style={[styles.root, { backgroundColor: palette.background }]} onLayout={onLayout}>
      {size.w > 0 && size.h > 0 && (
        <React.Fragment key={`gantt-${layoutEpoch}`}>
          <PMProjectTasksTree viewport={viewport} width={treeWidth} height={size.h} palette={palette} crud={crud} />
          <GestureDetector gesture={splitter}>
            <View
              style={[
                styles.splitter,
                { width: PM_SPLITTER_WIDTH, backgroundColor: palette.header, borderColor: palette.border },
                Platform.OS === 'web' ? ({ cursor: 'col-resize' } as any) : null,
              ]}
            />
          </GestureDetector>
          <PMProjectGanttChart
            viewport={viewport}
            width={chartWidth}
            height={size.h}
            palette={palette}
            crud={crud}
            timelineStartMs={timelineStartMs}
            totalDays={totalDays}
          />
        </React.Fragment>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  splitter: { height: '100%', borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
});
