// The Skia-rendered Gantt surface: [ tree | splitter | chart ] sharing ONE viewport.
// Kanban mode (rightPane='kanban'): [ tree | splitter | PMKanbanDashboard ]; tree rows can be dragged onto
// the board through view/kanban/kanbanTreeBridge.ts.
// Versions mode (rightPane='versions'): [ tree | splitter | PMProjectVersionsList ] (kit8/pm/version).
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
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { DAY_MS, PM_DAY_WIDTH_MAX, PM_DAY_WIDTH_MIN, PM_SCALE_HEIGHT, PM_SPLITTER_WIDTH, PM_TIMELINE_PAD_DAYS, PM_TOOLBAR_HEIGHT } from '../../model/constants';
import { usePMStore } from '../../store/store_pm';
import { makePMPalette } from '../theme';
import { clampValue, maxScrollX, maxScrollY, useGanttViewport } from './useGanttViewport';
import { mondayOnOrBefore } from './ganttGeometry';
import { diffDaysMs, todayUTC } from '../project/scheduling';
import { usePMCrud } from '../../crud/usePMCrud';
import PMProjectTasksTree from '../tree/PMProjectTasksTree';
import PMProjectGanttChart from './PMProjectGanttChart';
import { measureViewInWindow, registerDashboardPdfTarget } from '../../crud/exchange/pdf/exportDashboardToPdf';
import { hidePMTip } from '../../inner/tooltip/PMTooltip';
import { useKanbanCommands } from '../../crud/kanban/useKanbanCommands';
import PMKanbanDashboard from '../kanban/PMKanbanDashboard';
import PMKanbanTreeDragGhost from '../kanban/PMKanbanTreeDragGhost';
import { useKanbanTreeBridge } from '../kanban/kanbanTreeBridge';
import PMProjectVersionsList from '../../version/view/list/PMProjectVersionsList';
import { usePMVersionStore } from '../../version/store/store_version';
import { overlaysRange } from '../../version/model/versionCompare';

const MIN_CHART_WIDTH = 160;
const RESIZE_SETTLE_MS = 180;

export interface PMGanttSurfaceProps {
  ownerGUID: string;
  projectGUID: string;
  /** right pane: the Skia Gantt chart (default), the Kanban board (tree rows can be dragged onto it) or the project versions list */
  rightPane?: 'gantt' | 'kanban' | 'versions';
  readOnly?: boolean;
  hideTree?: boolean;
  /** uxui.hideGanttChartNode: only the tree (no splitter, no chart / board / versions list) */
  hideRight?: boolean;
  /** uxui.hideGanttToolBar: no tree toolbar and no Gantt / Kanban bar (both, so the rows stay aligned) */
  hideToolbars?: boolean;
}

const IS_COARSE =
  Platform.OS !== 'web' ||
  (typeof window !== 'undefined' && typeof (window as any).matchMedia === 'function' && !!(window as any).matchMedia('(pointer: coarse)')?.matches);
/** touch: transparent grab zone around the 6px divider (a finger cannot hit 6px) */
const SPLITTER_GRAB = 28;

export default function PMGanttSurface({
  ownerGUID,
  projectGUID,
  rightPane = 'gantt',
  readOnly = false,
  hideTree: hideTreeProp = false,
  hideRight: hideRightProp = false,
  hideToolbars = false,
}: PMGanttSurfaceProps) {
  // never both hidden
  const hideRight = hideRightProp && !hideTreeProp;
  const hideTree = hideTreeProp;
  const TB = hideToolbars ? 0 : PM_TOOLBAR_HEIGHT;
  const ganttPeriod = usePMStore((s) => s.ganttPeriod);
  const [splitterActive, setSplitterActive] = useState(false);
  /** narrow panes (phones): the width the user dragged the divider to (null = the default 45 %) */
  const [narrowTreeWidth, setNarrowTreeWidth] = useState<number | null>(null);
  const narrowRef = useRef(false);
  const isKanban = rightPane === 'kanban';
  const isVersions = rightPane === 'versions';
  const { themeColors, isDark } = useDesignSystem();
  const criticalColor = usePMStore((s) => s.criticalPathTaskColor); // uxuiSettings.criticalPathTaskColor
  const palette = useMemo(() => makePMPalette(themeColors, isDark, criticalColor), [themeColors, isDark, criticalColor]);
  const crud = usePMCrud(ownerGUID, projectGUID);
  const kanban = useKanbanCommands(projectGUID);
  const kanbanBridge = useKanbanTreeBridge(kanban);

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
  // "Export to PDF": the pictures = this surface without the tree toolbar / Gantt bar
  const pdfToolbarH = useRef(TB);
  pdfToolbarH.current = TB;
  useEffect(
    () =>
      registerDashboardPdfTarget(async () => {
        const r = await measureViewInWindow(rootRef.current);
        const top = pdfToolbarH.current;
        return r && r.height > top ? { x: r.x, y: r.y + top, width: r.width, height: r.height - top } : r;
      }),
    [],
  );
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
  // checked project versions (kit8/pm/version) widen the time line so their bars are never cut off
  const versionOverlays = usePMVersionStore((s) => s.overlays);
  const versionRange = useMemo(() => (readOnly ? null : overlaysRange(versionOverlays)), [versionOverlays, readOnly]);
  // ... and so does the custom period of the Gantt bar (period button)
  let rangeStartMs = versionRange ? Math.min(projectStartMs, versionRange.startMs) : projectStartMs;
  let rangeFinishMs = versionRange ? Math.max(projectFinishMs, versionRange.finishMs) : projectFinishMs;
  if (ganttPeriod && !readOnly) {
    rangeStartMs = Math.min(rangeStartMs, ganttPeriod.startMs);
    rangeFinishMs = Math.max(rangeFinishMs, ganttPeriod.finishMs);
  }

  // phones: the tree takes at most ~45% so the chart stays usable
  // (the user may drag the divider further on a phone: up to the pane minus a minimal chart)
  const narrow = size.w > 0 && size.w < 640;
  const treeWidth = hideRight
    ? size.w
    : narrow && narrowTreeWidth !== null
    ? Math.round(Math.max(96, Math.min(narrowTreeWidth, size.w - MIN_CHART_WIDTH - PM_SPLITTER_WIDTH)))
    : size.w
    ? Math.round(Math.min(storeTreeWidth, Math.max(160, size.w * 0.45)))
    : storeTreeWidth;
  const effectiveTreeWidth = hideTree ? 0 : treeWidth;
  const chartWidth = hideTree
    ? Math.max(MIN_CHART_WIDTH, size.w)
    : Math.max(MIN_CHART_WIDTH, size.w - effectiveTreeWidth - PM_SPLITTER_WIDTH);
  useEffect(() => {
    kanbanBridge.treeWidth.value = effectiveTreeWidth;
  }, [kanbanBridge, effectiveTreeWidth]);
  const bodyHeight = Math.max(0, size.h - TB - PM_SCALE_HEIGHT);

  // timeline = project range + padding, starting on a Monday, at least one screen wide
  const timelineStartMs = useMemo(
    () => mondayOnOrBefore(Math.min(rangeStartMs, todayUTC()) - PM_TIMELINE_PAD_DAYS * DAY_MS),
    [rangeStartMs]
  );
  const totalDays = useMemo(() => {
    const end = Math.max(rangeFinishMs, todayUTC()) + PM_TIMELINE_PAD_DAYS * 2 * DAY_MS;
    return Math.max(diffDaysMs(end, timelineStartMs), Math.ceil(chartWidth / PM_DAY_WIDTH_MIN) + 7);
  }, [rangeFinishMs, timelineStartMs, chartWidth]);

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
  const isKanbanRef = useRef(isKanban);
  isKanbanRef.current = isKanban || isVersions; // the right pane scrolls natively
  useEffect(() => () => {
    if (zoomCommitTimer.current) clearTimeout(zoomCommitTimer.current);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = rootRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const onWheel = (e: WheelEvent) => {
      // Kanban: the board scrolls natively, only the tree uses the shared viewport
      if (isKanbanRef.current && e.clientX - el.getBoundingClientRect().left >= treeWidthRef.current) return;
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
  // mouse: drag it. touch: LONG TOUCH the divider (it lights up), then drag - a plain swipe over it still scrolls.
  const splitStart = useRef(treeWidth);
  const shownTreeWidth = useRef(treeWidth);
  shownTreeWidth.current = treeWidth;
  narrowRef.current = narrow;
  const splitter = useMemo(() => {
    const g = Gesture.Pan()
      .runOnJS(true)
      .onStart(() => {
        // start from the width on screen (phones clamp the saved width)
        splitStart.current = shownTreeWidth.current;
        setSplitterActive(true);
      })
      .onChange((e) => {
        const w = splitStart.current + e.translationX;
        if (narrowRef.current) setNarrowTreeWidth(w);
        else usePMStore.getState().setTreeWidth(w);
      })
      .onFinalize(() => setSplitterActive(false));
    if (IS_COARSE) g.activateAfterLongPress(220);
    return g;
  }, []);

  return (
    <View ref={rootRef} style={[styles.root, { backgroundColor: palette.background }]} onLayout={onLayout}>
      {size.w > 0 && size.h > 0 && (
        <React.Fragment key={`gantt-${layoutEpoch}`}>
          {!hideTree && (
            <>
              <PMProjectTasksTree viewport={viewport} width={treeWidth} height={size.h} palette={palette} crud={crud} kanbanBridge={isKanban && !hideRight ? kanbanBridge : undefined} hideToolbar={hideToolbars} />
              {!hideRight && (
                <View
                  testID="pm-splitter"
                  style={[
                    styles.splitter,
                    { width: PM_SPLITTER_WIDTH, backgroundColor: splitterActive ? palette.primary : palette.header, borderColor: palette.border, zIndex: 30 },
                  ]}
                >
                  <GestureDetector gesture={splitter}>
                    <View
                      testID="pm-splitter-grab"
                      style={[
                        IS_COARSE ? { position: 'absolute', top: 0, bottom: 0, left: -(SPLITTER_GRAB - PM_SPLITTER_WIDTH) / 2, width: SPLITTER_GRAB } : StyleSheet.absoluteFill,
                        Platform.OS === 'web' ? ({ cursor: 'col-resize', touchAction: 'none' } as any) : null,
                      ]}
                    >
                      {/* grip mark */}
                      <View pointerEvents="none" style={[styles.grip, { backgroundColor: splitterActive ? palette.surface : palette.textMuted, left: (IS_COARSE ? SPLITTER_GRAB : PM_SPLITTER_WIDTH) / 2 - 1 }]} />
                    </View>
                  </GestureDetector>
                </View>
              )}
            </>
          )}
          {hideRight ? null : isVersions ? (
            <PMProjectVersionsList ownerGUID={ownerGUID} projectGUID={projectGUID} width={chartWidth} height={size.h} palette={palette} crud={crud} />
          ) : isKanban ? (
            <PMKanbanDashboard
              projectGUID={projectGUID}
              width={chartWidth}
              height={size.h}
              palette={palette}
              crud={crud}
              kanban={kanban}
              bridge={kanbanBridge}
              boardLeft={hideTree ? 0 : treeWidth + PM_SPLITTER_WIDTH}
              hideToolbar={hideToolbars}
            />
          ) : (
            <PMProjectGanttChart
              viewport={viewport}
              width={chartWidth}
              height={size.h}
              palette={palette}
              crud={crud}
              timelineStartMs={timelineStartMs}
              totalDays={totalDays}
              readOnly={readOnly}
              hideToolbar={hideToolbars}
            />
          )}
          {isKanban && !hideTree && !hideRight && <PMKanbanTreeDragGhost bridge={kanbanBridge} palette={palette} />}
        </React.Fragment>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  splitter: { height: '100%', borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, overflow: 'visible' },
  grip: { position: 'absolute', top: '50%', marginTop: -14, width: 2, height: 28, borderRadius: 1, opacity: 0.7 },
});
