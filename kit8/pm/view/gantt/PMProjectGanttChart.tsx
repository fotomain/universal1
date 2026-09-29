// Right pane: time scale + grid + bars + dependency links, all on one Skia canvas.
//
//  * vertical scroll  = the SAME shared value as the tree (pixel-locked rows)
//  * horizontal zoom  = live scaleX transform on the UI thread while pinching /
//                       ctrl+wheel, committed to React (crisp re-layout) on release
//  * drag & drop      = RNGH gestures + Reanimated shared values; the ghost bar, the
//                       snapped date label and the rubber-band link line are drawn on
//                       the UI thread; one JS call commits the edit on release
//  * links            = smooth (cubic Bézier) or square (orthogonal) paths between bar ends
//                       (FS/SS/FF/SF) + arrows, per-dependency color (rowJSON.dependencyColor)
//  * link actions     = right-click (web) / tap (touch) an arrow -> menu (edit, delete);
//                       double-click an arrow -> PMEditDependencyScreen
//  * hover CRUD panel = next to the hovered (web) / selected (touch) bar

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Canvas, Circle, Group, Path, Rect, RoundedRect, Skia, SkPath, Text as SkText, rect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withDecay } from 'react-native-reanimated';
import {
  DAY_MS,
  PM_LINK_HIT_TOLERANCE,
  PM_BAR_HANDLE_PX,
  PM_BAR_PANEL_WIDTH,
  PM_BAR_VPAD,
  PM_DAY_WIDTH_MAX,
  PM_DAY_WIDTH_MIN,
  PM_OVERSCAN_ROWS,
  PM_ROW_HEIGHT,
  PM_SCALE_HEIGHT,
  PM_TOOLBAR_HEIGHT,
} from '../../model/constants';
import { usePMStore } from '../../store/store_pm';
import { formatDateShort, linkTypeFromEnds, MONTHS_SHORT, todayUTC } from '../project/scheduling';
import { distanceToPolyline, isWeekendDay, routeLink, scaleCells, scaleLevelsFor } from './ganttGeometry';
import { PMDepRef, taskColorOf } from '../../model/types';
import {
  isProgressLineUnderText,
  PMProgressLinePosition,
  PMProjectProgressLine,
  PMProjectProgressLabel,
  PMTaskProgressLine,
  projectProgressLineLayout,
} from '../task/progress/line';
import { ellipsize, PMPalette } from '../theme';
import { makeMeasure, usePMFonts } from '../../skia/usePMFonts';
import { clampValue, maxScrollX, maxScrollY, PMViewport } from './useGanttViewport';
import { PMCrud } from '../../crud/usePMCrud';
import PMGanttBarHoverPanel from './panels/PMGanttBarHoverPanel';
import PMGanttToolbar from './toolbars/PMGanttToolbar';
import { hidePMTip, showPMTip } from '../../inner/tooltip/PMTooltip';

const IS_WEB = Platform.OS === 'web';

// hit-test zones / drag modes (numbers so they live happily in worklets)
const Z_NONE = 0;
const Z_MOVE = 1;
const Z_RESIZE_START = 2;
const Z_RESIZE_END = 3;
const Z_PROGRESS = 4;
const Z_LINK_START = 5;
const Z_LINK_FINISH = 6;
const Z_THUMB_X = 7;
const Z_THUMB_Y = 8;
const Z_BAR_ONLY = 9; // summary body: selectable, not draggable
const Z_HOLD = 99; // drop committed, ghost kept until React re-renders

// bar kinds in the hit-test table
const K_NONE = -1;
const K_TASK = 0;
const K_SUMMARY = 1;
const K_MILESTONE = 2;

const SCROLLBAR = 8;
const MILESTONE_HALF = 8;
const SUMMARY_H = 10;
// tips for the Skia-drawn hot zones (the bar "icons": grips, link circles, progress knob)
const ZONE_TIPS: Record<number, string> = {
  [Z_MOVE]: 'Drag to move (sets a "start no earlier than" date) · double-click to edit',
  [Z_RESIZE_START]: 'Drag to change the start (duration changes)',
  [Z_RESIZE_END]: 'Drag to change the duration',
  [Z_PROGRESS]: 'Drag to set progress',
  [Z_LINK_START]: "Drag to another bar's end to link from this task's START",
  [Z_LINK_FINISH]: "Drag to another bar's end to link from this task's FINISH",
  [Z_BAR_ONLY]: 'Stage summary: dates and progress are rolled up from its tasks',
};
const CURSORS: Record<number, string> = {
  [Z_MOVE]: 'grab',
  [Z_RESIZE_START]: 'ew-resize',
  [Z_RESIZE_END]: 'ew-resize',
  [Z_PROGRESS]: 'col-resize',
  [Z_LINK_START]: 'crosshair',
  [Z_LINK_FINISH]: 'crosshair',
  [Z_THUMB_X]: 'default',
  [Z_THUMB_Y]: 'default',
  [Z_BAR_ONLY]: 'pointer',
};

interface Props {
  viewport: PMViewport;
  width: number;
  height: number; // whole pane incl. toolbar
  palette: PMPalette;
  crud: PMCrud;
  timelineStartMs: number;
  totalDays: number;
}

interface BarDesc {
  guid: string;
  index: number;
  kind: number;
  x: number;
  w: number;
  y: number;
  cy: number;
  progress: number;
  color: string;
  progressColor: string;
  label: string;
  labelX: number;
  labelInside: boolean;
  /** showTaskProgressOnGantt: "XX%" text, right-justified at the bar end (null = hidden) */
  pctLabel: string | null;
  pctX: number;
  /** uxuiSettings.taskProgressLinePosition / taskProgressLineColor */
  progressLinePos: PMProgressLinePosition;
  progressLineColor: string;
}

function linkHandleOffset(kind: number): number {
  'worklet';
  return kind === K_MILESTONE ? MILESTONE_HALF + 8 : 9;
}

export default function PMProjectGanttChart({ viewport, width, height, palette, crud, timelineStartMs, totalDays }: Props) {
  const fonts = usePMFonts();
  const visibleRows = usePMStore((s) => s.visibleRows);
  const rowIndexById = usePMStore((s) => s.rowIndexById);
  const tasksById = usePMStore((s) => s.tasksById);
  const schedule = usePMStore((s) => s.schedule);
  const deps = usePMStore((s) => s.deps);
  const hoveredGUID = usePMStore((s) => s.hoveredGUID);
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const linkSourceGUID = usePMStore((s) => s.linkSourceGUID);
  const showCritical = usePMStore((s) => s.showCriticalPath);
  const projectStartMs = usePMStore((s) => s.projectStartMs);
  const projectFinishMs = usePMStore((s) => s.projectFinishMs);
  const linkLineForm = usePMStore((s) => s.linkLineForm);
  const showTaskProgress = usePMStore((s) => s.showTaskProgressOnGantt);
  const taskLinePos = usePMStore((s) => s.taskProgressLinePosition);
  const projectLinePos = usePMStore((s) => s.projectProgressLinePosition);
  const projectProgress = usePMStore((s) => s.projectProgress);
  const taskLineColor = usePMStore((s) => s.taskProgressLineColor);
  const projectLineColor = usePMStore((s) => s.projectProgressLineColor);
  const depMenu = usePMStore((s) => s.depMenu);
  const editingDep = usePMStore((s) => s.editingDep);
  /** uxuiSettings.projectGanttChartContextCommandsMode: bar commands in a right-click / long-press menu instead of the panel */
  const rowMenuMode = usePMStore((s) => s.projectGanttChartContextCommandsMode === 'onRightClickMenuMode');
  /** touch long-press bar menu: row + start point */
  const menuRow = useSharedValue(-1);
  const menuX = useSharedValue(0);
  const menuY = useSharedValue(0);

  const { scrollX, scrollY, dayWidthLive, bodyH, chartW, rowCount, totalDays: totalDaysSV, hoverRow, dragging, win, dayWidth } = viewport;
  const canvasH = Math.max(0, height - PM_TOOLBAR_HEIGHT);
  const bodyPx = Math.max(0, canvasH - PM_SCALE_HEIGHT);
  const xOf = useCallback((ms: number) => ((ms - timelineStartMs) / DAY_MS) * dayWidth, [timelineStartMs, dayWidth]);

  // =====================================================================================
  // Bars: hit-test table for ALL visible rows (UI thread) + draw list for the window
  // =====================================================================================
  const hitTable = useMemo(() => {
    const n = visibleRows.length;
    const xs = new Array<number>(n);
    const ws = new Array<number>(n);
    const kinds = new Array<number>(n);
    const progs = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const r = schedule[visibleRows[i]];
      if (!r) {
        xs[i] = 0;
        ws[i] = 0;
        kinds[i] = K_NONE;
        progs[i] = 0;
        continue;
      }
      xs[i] = xOf(r.startMs);
      ws[i] = r.isMilestone ? 0 : Math.max(2, xOf(r.finishMs) - xOf(r.startMs));
      kinds[i] = r.isSummary ? K_SUMMARY : r.isMilestone ? K_MILESTONE : K_TASK;
      progs[i] = r.progress;
    }
    return { dw: dayWidth, x: xs, w: ws, kind: kinds, prog: progs };
  }, [visibleRows, schedule, xOf, dayWidth]);

  const barsSV = useSharedValue(hitTable);
  useEffect(() => {
    barsSV.value = hitTable;
  }, [hitTable, barsSV]);

  const bars = useMemo<BarDesc[]>(() => {
    const measure = makeMeasure(fonts.regular);
    const measureBold = makeMeasure(fonts.bold);
    const measurePct = makeMeasure(fonts.smallBold);
    const out: BarDesc[] = [];
    for (let i = win.firstRow; i <= win.lastRow && i < visibleRows.length; i++) {
      const guid = visibleRows[i];
      const r = schedule[guid];
      const t = tasksById[guid];
      if (!r || !t) continue;
      const kind = r.isSummary ? K_SUMMARY : r.isMilestone ? K_MILESTONE : K_TASK;
      const x = hitTable.x[i];
      const w = hitTable.w[i];
      const y = i * PM_ROW_HEIGHT;
      const critical = showCritical && r.isCritical && kind !== K_SUMMARY;
      const color = taskColorOf(t.rowJSON) || (kind === K_SUMMARY ? palette.summary : kind === K_MILESTONE ? palette.milestone : critical ? palette.critical : palette.bar);
      const progressColor = kind === K_SUMMARY ? palette.summaryProgress : critical ? palette.criticalProgress : palette.barProgress;
      const name = t.rowJSON.name || '';
      const textW = (kind === K_SUMMARY ? measureBold : measure)(name);
      const pctLabel = showTaskProgress && kind === K_TASK ? `${Math.round(r.progress)}%` : null;
      const pctW = pctLabel ? measurePct(pctLabel) : 0;
      // the name stays inside the bar only if it still fits next to the "XX%"
      const inside = kind === K_TASK && textW + 12 + (pctLabel ? pctW + 8 : 0) <= w;
      out.push({
        guid,
        index: i,
        kind,
        x,
        w,
        y,
        cy: y + PM_ROW_HEIGHT / 2,
        progress: r.progress / 100,
        color,
        progressColor,
        label: inside ? name : ellipsize(name, 260, kind === K_SUMMARY ? measureBold : measure),
        labelX: inside ? x + 6 : kind === K_MILESTONE ? x + MILESTONE_HALF + 20 : x + w + 20,
        labelInside: inside,
        pctLabel,
        pctX: x + w - 5 - pctW, // right-justified at the end of the bar
        progressLinePos: taskLinePos,
        progressLineColor: taskLineColor,
      });
    }
    return out;
  }, [win.firstRow, win.lastRow, visibleRows, schedule, tasksById, hitTable, showCritical, showTaskProgress, taskLinePos, taskLineColor, palette, fonts.regular, fonts.bold, fonts.smallBold]);

  // =====================================================================================
  // Dependency links: one path per style (normal / critical / highlighted) + arrows
  // =====================================================================================
  // arrows of the visible window, in committed content coordinates (for hit-testing)
  const linkHitsRef = useRef<{ ref: PMDepRef; points: number[] }[]>([]);
  const focusDep = editingDep || depMenu;
  const links = useMemo(() => {
    const mk = () => Skia.Path.Make();
    const p = { normal: mk(), normalArrow: mk(), critical: mk(), criticalArrow: mk(), active: mk(), activeArrow: mk() };
    const custom: Record<string, { line: SkPath; arrow: SkPath }> = {};
    const hits: { ref: PMDepRef; points: number[] }[] = [];
    const lo = win.firstRow - PM_OVERSCAN_ROWS;
    const hi = win.lastRow + PM_OVERSCAN_ROWS;
    const focus = hoveredGUID || selectedGUID;
    for (const d of deps) {
      const i1 = rowIndexById[d.rowDependsOnGUID];
      const i2 = rowIndexById[d.rowGUID];
      if (i1 === undefined || i2 === undefined) continue;
      if (Math.max(i1, i2) < lo || Math.min(i1, i2) > hi) continue;
      const k1 = hitTable.kind[i1];
      const k2 = hitTable.kind[i2];
      if (k1 === K_NONE || k2 === K_NONE) continue;
      const type = d.linkType || 'FS';
      const fromFinish = type[0] === 'F';
      const toStart = type[1] === 'S';
      const mh1 = k1 === K_MILESTONE ? MILESTONE_HALF : 0;
      const mh2 = k2 === K_MILESTONE ? MILESTONE_HALF : 0;
      const x1 = fromFinish ? hitTable.x[i1] + hitTable.w[i1] + mh1 : hitTable.x[i1] - mh1;
      const x2 = toStart ? hitTable.x[i2] - mh2 : hitTable.x[i2] + hitTable.w[i2] + mh2;
      const y1 = i1 * PM_ROW_HEIGHT + PM_ROW_HEIGHT / 2;
      const y2 = i2 * PM_ROW_HEIGHT + PM_ROW_HEIGHT / 2;
      const dir1 = fromFinish ? 1 : -1;
      const dir2 = toStart ? 1 : -1; // +1 = arrow points right (enters a bar start)
      const r1 = schedule[d.rowDependsOnGUID];
      const r2 = schedule[d.rowGUID];
      const isFocusedDep = !!focusDep && focusDep.rowGUID === d.rowGUID && focusDep.dependsOnGUID === d.rowDependsOnGUID;
      const isActive = isFocusedDep || (!!focus && (d.rowGUID === focus || d.rowDependsOnGUID === focus));
      const isCritical = showCritical && !!r1?.isCritical && !!r2?.isCritical;
      const customColor = d.rowJSON?.dependencyColor || null;
      if (customColor && !isActive && !custom[customColor]) custom[customColor] = { line: mk(), arrow: mk() };
      const target: { line: SkPath; arrow: SkPath } = isActive
        ? { line: p.active, arrow: p.activeArrow }
        : customColor
          ? custom[customColor]
          : isCritical
            ? { line: p.critical, arrow: p.criticalArrow }
            : { line: p.normal, arrow: p.normalArrow };
      const line = target.line;
      const arrow = target.arrow;

      const route = routeLink(x1, y1, x2, y2, dir1, dir2, linkLineForm, PM_ROW_HEIGHT);
      line.moveTo(x1, y1);
      if (route.c) line.cubicTo(route.c[0], route.c[1], route.c[2], route.c[3], route.endX, y2);
      else for (let k = 2; k < route.points.length; k += 2) line.lineTo(route.points[k], route.points[k + 1]);
      arrow.moveTo(route.tipX, y2);
      arrow.lineTo(route.tipX - dir2 * 7, y2 - 4);
      arrow.lineTo(route.tipX - dir2 * 7, y2 + 4);
      arrow.close();
      hits.push({ ref: { rowGUID: d.rowGUID, dependsOnGUID: d.rowDependsOnGUID }, points: route.points });
    }
    linkHitsRef.current = hits;
    return { ...p, custom: Object.entries(custom) };
  }, [deps, rowIndexById, hitTable, schedule, win.firstRow, win.lastRow, hoveredGUID, selectedGUID, showCritical, linkLineForm, focusDep]);

  // =====================================================================================
  // Grid + 2-tier time scale for the visible day window
  // =====================================================================================
  const levels = scaleLevelsFor(dayWidth);
  const grid = useMemo(() => {
    const weekend = Skia.Path.Make();
    const thin = Skia.Path.Make();
    const strong = Skia.Path.Make();
    const yTop = win.firstRow * PM_ROW_HEIGHT;
    const yBottom = Math.max((win.lastRow + 1) * PM_ROW_HEIGHT, yTop + bodyPx + 2 * PM_OVERSCAN_ROWS * PM_ROW_HEIGHT);
    const from = Math.max(0, win.firstDay);
    const to = Math.min(totalDays, win.lastDay);
    if (dayWidth >= 3) {
      for (let d = from; d <= to; d++) {
        if (isWeekendDay(timelineStartMs, d)) weekend.addRect(Skia.XYWHRect(d * dayWidth, yTop, dayWidth, yBottom - yTop));
      }
    }
    const bottomCells = scaleCells(timelineStartMs, from, to, levels.bottom, dayWidth);
    const topCells = scaleCells(timelineStartMs, from, to, levels.top, dayWidth);
    if (levels.bottom === 'day' && dayWidth >= 12) {
      for (const c of bottomCells) {
        thin.moveTo(c.x, yTop);
        thin.lineTo(c.x, yBottom);
      }
    } else if (levels.bottom !== 'day') {
      for (const c of bottomCells) {
        thin.moveTo(c.x, yTop);
        thin.lineTo(c.x, yBottom);
      }
    }
    for (const c of topCells) {
      strong.moveTo(c.x, yTop);
      strong.lineTo(c.x, yBottom);
    }
    return { weekend, thin, strong, bottomCells, topCells };
  }, [win.firstRow, win.lastRow, win.firstDay, win.lastDay, totalDays, dayWidth, timelineStartMs, bodyPx, levels.bottom, levels.top]);

  const scaleLines = useMemo(() => {
    const p = Skia.Path.Make();
    for (const c of grid.bottomCells) {
      p.moveTo(c.x, PM_SCALE_HEIGHT / 2);
      p.lineTo(c.x, PM_SCALE_HEIGHT);
    }
    for (const c of grid.topCells) {
      p.moveTo(c.x, 0);
      p.lineTo(c.x, PM_SCALE_HEIGHT / 2);
    }
    return p;
  }, [grid]);

  const measureSmall = useMemo(() => makeMeasure(fonts.small), [fonts.small]);
  const measureSmallBold = useMemo(() => makeMeasure(fonts.smallBold), [fonts.smallBold]);

  // sticky label for the top-tier cell that starts left of the viewport (e.g. "Sep 2026")
  const topCellsSV = useSharedValue<{ x: number; w: number; label: string; tw: number }[]>([]);
  useEffect(() => {
    topCellsSV.value = grid.topCells.map((c) => ({ x: c.x, w: c.w, label: c.label, tw: measureSmallBold(c.label) }));
  }, [grid.topCells, measureSmallBold, topCellsSV]);

  const rowLines = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = win.firstRow; i <= win.lastRow && i < visibleRows.length; i++) {
      p.moveTo(0, (i + 1) * PM_ROW_HEIGHT - 0.5);
      p.lineTo(width, (i + 1) * PM_ROW_HEIGHT - 0.5);
    }
    return p;
  }, [win.firstRow, win.lastRow, visibleRows.length, width]);

  const todayX = xOf(todayUTC());
  const projectBand = { x: xOf(projectStartMs), w: Math.max(0, xOf(projectFinishMs) - xOf(projectStartMs)) };

  // project progress line in the time-scale header (uxuiSettings.projectProgressLinePosition)
  const projectLine = useMemo(() => {
    if (!showTaskProgress || projectBand.w <= 0) return null;
    const { y, H, baseline } = projectProgressLineLayout(projectLinePos, PM_SCALE_HEIGHT);
    const label = `Project ${Math.round(projectProgress)}%`;
    const tw = makeMeasure(fonts.smallBold)(label);
    return { y, H, label, tw, baseline, labelX: projectBand.x + projectBand.w - tw - 4, underText: isProgressLineUnderText(projectLinePos) };
  }, [showTaskProgress, projectBand.x, projectBand.w, projectLinePos, projectProgress, fonts.smallBold]);

  // =====================================================================================
  // UI-thread transforms
  // =====================================================================================
  const zoomRatio = useDerivedValue(() => dayWidthLive.value / dayWidth, [dayWidth]);
  const bodyY = useDerivedValue(() => [{ translateY: PM_SCALE_HEIGHT - scrollY.value }]);
  const timeX = useDerivedValue(() => [{ translateX: -scrollX.value }, { scaleX: zoomRatio.value }]);
  const hoverY = useDerivedValue(() => Math.max(0, hoverRow.value) * PM_ROW_HEIGHT);
  const hoverOpacity = useDerivedValue(() => (hoverRow.value >= 0 && dragging.value === 0 ? 1 : 0));

  // ---- drag state ------------------------------------------------------------------------
  const dragMode = useSharedValue(Z_NONE);
  const dragRow = useSharedValue(-1);
  const dragBaseX = useSharedValue(0); // committed px
  const dragBaseW = useSharedValue(0);
  const dragDX = useSharedValue(0); // screen px
  const dragProg = useSharedValue(0);
  const downX = useSharedValue(0);
  const downY = useSharedValue(0);
  const pendingZone = useSharedValue(Z_NONE);
  const linkX1 = useSharedValue(0);
  const linkY1 = useSharedValue(0);
  const linkX2 = useSharedValue(0);
  const linkY2 = useSharedValue(0);
  const linkTarget = useSharedValue(-1);
  const pinchBase = useSharedValue(dayWidth);
  const panelRow = useSharedValue(-1);
  const hoverZone = useSharedValue(Z_NONE);

  const isBarDrag = (m: number) => {
    'worklet';
    return m === Z_MOVE || m === Z_RESIZE_START || m === Z_RESIZE_END || m === Z_PROGRESS || m === Z_HOLD;
  };

  const ghostX = useDerivedValue(() => {
    const live = dayWidthLive.value;
    const left = dragBaseX.value * zoomRatio.value - scrollX.value;
    const w = dragBaseW.value * zoomRatio.value;
    const snap = Math.round(dragDX.value / live) * live;
    if (dragMode.value === Z_MOVE) return left + snap;
    if (dragMode.value === Z_RESIZE_START) return Math.min(left + snap, left + w - live);
    return left;
  });
  const ghostW = useDerivedValue(() => {
    const live = dayWidthLive.value;
    const w = dragBaseW.value * zoomRatio.value;
    const snap = Math.round(dragDX.value / live) * live;
    if (dragMode.value === Z_RESIZE_END) return Math.max(live, w + snap);
    if (dragMode.value === Z_RESIZE_START) return Math.max(live, w - snap);
    return w;
  });
  const ghostY = useDerivedValue(() => dragRow.value * PM_ROW_HEIGHT + PM_BAR_VPAD);
  const ghostOpacity = useDerivedValue(() => (isBarDrag(dragMode.value) && dragMode.value !== Z_PROGRESS ? 1 : 0));
  const progressW = useDerivedValue(() => {
    const w = dragBaseW.value * zoomRatio.value;
    if (w <= 0) return 0;
    return clampValue(dragProg.value / 100 + dragDX.value / w, 0, 1) * w;
  });
  const progressX = useDerivedValue(() => dragBaseX.value * zoomRatio.value - scrollX.value);
  const progressOpacity = useDerivedValue(() => (dragMode.value === Z_PROGRESS ? 1 : 0));

  const tStart = timelineStartMs;
  const dwCommitted = dayWidth;
  const ghostLabel = useDerivedValue(() => {
    const m = dragMode.value;
    if (m !== Z_MOVE && m !== Z_RESIZE_START && m !== Z_RESIZE_END && m !== Z_PROGRESS) return '';
    if (m === Z_PROGRESS) {
      const w = dragBaseW.value * zoomRatio.value;
      return `${Math.round(clampValue(dragProg.value / 100 + (w > 0 ? dragDX.value / w : 0), 0, 1) * 100)}%`;
    }
    const days = Math.round(dragDX.value / dayWidthLive.value);
    const startDay = dragBaseX.value / dwCommitted;
    const lenDays = Math.round(dragBaseW.value / dwCommitted);
    let s = startDay;
    let f = startDay + lenDays;
    if (m === Z_MOVE) {
      s += days;
      f += days;
    } else if (m === Z_RESIZE_START) s = Math.min(s + days, f - 1);
    else f = Math.max(f + days, s + 1);
    const ds = new Date(tStart + s * 86400000);
    const df = new Date(tStart + (f - 1) * 86400000);
    return `${ds.getUTCDate()} ${MONTHS_SHORT[ds.getUTCMonth()]} – ${df.getUTCDate()} ${MONTHS_SHORT[df.getUTCMonth()]}  (${Math.round(f - s)}d)`;
  });
  const ghostBaseline = useDerivedValue(() => ghostY.value + (PM_ROW_HEIGHT - 2 * PM_BAR_VPAD) / 2 + 4);
  const ghostLabelX = useDerivedValue(() => ghostX.value + (dragMode.value === Z_PROGRESS ? progressW.value + 6 : ghostW.value + 8));

  const linkPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    if (dragMode.value !== Z_LINK_START && dragMode.value !== Z_LINK_FINISH) return p;
    const dir = dragMode.value === Z_LINK_FINISH ? 1 : -1;
    const bend = Math.max(20, Math.abs(linkX2.value - linkX1.value) / 2);
    p.moveTo(linkX1.value, linkY1.value);
    p.cubicTo(linkX1.value + dir * bend, linkY1.value, linkX2.value - bend * Math.sign(linkX2.value - linkX1.value || 1), linkY2.value, linkX2.value, linkY2.value);
    return p;
  });
  const linkTargetY = useDerivedValue(() => PM_SCALE_HEIGHT + Math.max(0, linkTarget.value) * PM_ROW_HEIGHT - scrollY.value);
  const linkTargetOpacity = useDerivedValue(() => (linkTarget.value >= 0 && (dragMode.value === Z_LINK_START || dragMode.value === Z_LINK_FINISH) ? 1 : 0));

  const stickyIndex = useDerivedValue(() => {
    const cells = topCellsSV.value;
    for (let i = 0; i < cells.length; i++) {
      const sx = cells[i].x * zoomRatio.value - scrollX.value;
      const ex = (cells[i].x + cells[i].w) * zoomRatio.value - scrollX.value;
      if (sx < 0 && ex > 0) return i;
    }
    return -1;
  });
  const stickyLabel = useDerivedValue(() => (stickyIndex.value >= 0 ? topCellsSV.value[stickyIndex.value].label : ''));
  const stickyX = useDerivedValue(() => {
    const i = stickyIndex.value;
    if (i < 0) return -999;
    const c = topCellsSV.value[i];
    return Math.min(6, (c.x + c.w) * zoomRatio.value - scrollX.value - c.tw - 6);
  });
  const stickyBgW = useDerivedValue(() => (stickyIndex.value >= 0 ? topCellsSV.value[stickyIndex.value].tw + 12 : 0));
  const stickyBgX = useDerivedValue(() => stickyX.value - 6);

  // ---- scrollbars ------------------------------------------------------------------------
  const vThumbH = useDerivedValue(() => {
    const content = rowCount.value * PM_ROW_HEIGHT + PM_ROW_HEIGHT;
    return content <= bodyH.value ? 0 : Math.max(28, (bodyH.value * bodyH.value) / content);
  });
  const vThumbY = useDerivedValue(() => {
    const max = maxScrollY(rowCount.value, bodyH.value);
    return PM_SCALE_HEIGHT + (max > 0 ? (scrollY.value / max) * (bodyH.value - vThumbH.value) : 0);
  });
  const hThumbW = useDerivedValue(() => {
    const content = totalDaysSV.value * dayWidthLive.value;
    return content <= chartW.value ? 0 : Math.max(28, (chartW.value * chartW.value) / content);
  });
  const hThumbX = useDerivedValue(() => {
    const max = maxScrollX(totalDaysSV.value, dayWidthLive.value, chartW.value);
    return max > 0 ? (scrollX.value / max) * (chartW.value - SCROLLBAR - hThumbW.value) : 0;
  });

  // =====================================================================================
  // Hit testing (UI thread)
  // =====================================================================================
  const rowAt = (y: number) => {
    'worklet';
    if (y < PM_SCALE_HEIGHT) return -1;
    const idx = Math.floor((y - PM_SCALE_HEIGHT + scrollY.value) / PM_ROW_HEIGHT);
    return idx >= 0 && idx < rowCount.value ? idx : -1;
  };

  const panelHit = (x: number, y: number) => {
    'worklet';
    const idx = panelRow.value;
    if (!IS_WEB || idx < 0 || rowAt(y) !== idx) return false;
    const b = barsSV.value;
    const r = dayWidthLive.value / b.dw;
    const left = Math.min(b.x[idx] * r - scrollX.value + b.w[idx] * r + 26, chartW.value - PM_BAR_PANEL_WIDTH - SCROLLBAR - 4);
    return x >= left && x <= left + PM_BAR_PANEL_WIDTH;
  };

  const hitTest = (x: number, y: number) => {
    'worklet';
    const bh = bodyH.value;
    const cw = chartW.value;
    if (IS_WEB && maxScrollY(rowCount.value, bh) > 0 && x >= cw - SCROLLBAR - 2 && y >= PM_SCALE_HEIGHT) return Z_THUMB_Y;
    if (IS_WEB && maxScrollX(totalDaysSV.value, dayWidthLive.value, cw) > 0 && y >= PM_SCALE_HEIGHT + bh - SCROLLBAR - 2) return Z_THUMB_X;
    const idx = rowAt(y);
    if (idx < 0 || panelHit(x, y)) return Z_NONE;
    const b = barsSV.value;
    const kind = b.kind[idx];
    if (kind === undefined || kind === K_NONE) return Z_NONE;
    const r = dayWidthLive.value / b.dw;
    const bx = b.x[idx] * r - scrollX.value;
    const bw = b.w[idx] * r;
    const cy = PM_SCALE_HEIGHT + idx * PM_ROW_HEIGHT - scrollY.value + PM_ROW_HEIGHT / 2;
    const off = linkHandleOffset(kind);
    if (Math.abs(y - cy) <= 8) {
      if (Math.abs(x - (bx - off)) <= 7) return Z_LINK_START;
      if (Math.abs(x - (bx + bw + off)) <= 7) return Z_LINK_FINISH;
    }
    if (kind === K_SUMMARY) return x >= bx && x <= bx + bw && Math.abs(y - cy) <= 8 ? Z_BAR_ONLY : Z_NONE;
    if (kind === K_MILESTONE) return Math.abs(x - bx) <= MILESTONE_HALF + 1 && Math.abs(y - cy) <= MILESTONE_HALF + 1 ? Z_MOVE : Z_NONE;
    const half = PM_ROW_HEIGHT / 2 - PM_BAR_VPAD;
    if (y < cy - half - 2 || y > cy + half + 5) return Z_NONE;
    const px = bx + (bw * b.prog[idx]) / 100;
    if (y >= cy + half - 5 && Math.abs(x - px) <= 6 && bw > 16) return Z_PROGRESS;
    if (x >= bx - 3 && x <= bx + Math.min(PM_BAR_HANDLE_PX, bw / 3)) return Z_RESIZE_START;
    if (x >= bx + bw - Math.min(PM_BAR_HANDLE_PX, bw / 3) && x <= bx + bw + 3) return Z_RESIZE_END;
    if (x > bx && x < bx + bw) return Z_MOVE;
    return Z_NONE;
  };

  // =====================================================================================
  // JS commits
  // =====================================================================================
  const [cursor, setCursor] = useState('default');
  const releaseHold = useCallback(() => {
    if (dragMode.value === Z_HOLD) {
      dragMode.value = Z_NONE;
      dragRow.value = -1;
      dragging.value = 0;
    }
  }, [dragMode, dragRow, dragging]);

  // ghost stays until the optimistic re-render has moved the real bar (no flicker)
  useEffect(() => {
    releaseHold();
  }, [hitTable, releaseHold]);

  const commitBarDrag = useCallback(
    (mode: number, rowIdx: number, days: number, progress: number) => {
      const guid = usePMStore.getState().visibleRows[rowIdx];
      let changed = false;
      if (guid) {
        if (mode === Z_PROGRESS) {
          const cur = usePMStore.getState().tasksById[guid]?.rowProgress ?? 0;
          changed = Math.round(cur) !== Math.round(progress);
          crud.setProgress(guid, progress);
        } else if (days) {
          changed = true;
          crud.applyBarEdit(guid, mode === Z_MOVE ? 'move' : mode === Z_RESIZE_START ? 'resize-start' : 'resize-end', days);
        }
      }
      if (!changed) releaseHold();
      else setTimeout(releaseHold, 900); // safety net if nothing re-renders (e.g. clamped by a dependency)
    },
    [crud, releaseHold]
  );

  const commitLink = useCallback(
    (fromRow: number, fromEnd: number, toRow: number, toEnd: number) => {
      const s = usePMStore.getState();
      const from = s.visibleRows[fromRow];
      const to = s.visibleRows[toRow];
      if (!from || !to || from === to) return;
      crud.link(from, to, linkTypeFromEnds(fromEnd === 0 ? 'start' : 'finish', toEnd === 0 ? 'start' : 'finish'));
    },
    [crud]
  );

  const canvasBoxRef = useRef<View>(null);
  const onHover = useCallback((idx: number, zone: number, x = 0, y = 0) => {
    const tip = ZONE_TIPS[zone];
    if (tip && canvasBoxRef.current) {
      canvasBoxRef.current.measureInWindow((wx, wy) => showPMTip(tip, wx + x - 1, wy + y + 10, 2, 2, 600));
    } else hidePMTip();
    const s = usePMStore.getState();
    s.setHovered(idx >= 0 ? s.visibleRows[idx] ?? null : null);
    if (IS_WEB) setCursor(CURSORS[zone] || (idx >= 0 ? 'default' : 'default'));
  }, []);

  /** Dependency arrow under a canvas point (screen px inside the canvas), if any. */
  const hitLinkAt = useCallback(
    (x: number, y: number): PMDepRef | null => {
      if (y < PM_SCALE_HEIGHT) return null;
      const ratio = dayWidthLive.value / dayWidth;
      const cy = y - PM_SCALE_HEIGHT + scrollY.value; // content y
      let best: PMDepRef | null = null;
      let bestD = PM_LINK_HIT_TOLERANCE;
      for (const h of linkHitsRef.current) {
        const d = distanceToPolyline(x, cy, h.points, ratio, -scrollX.value);
        if (d <= bestD) {
          bestD = d;
          best = h.ref;
        }
      }
      return best;
    },
    [dayWidth, dayWidthLive, scrollX, scrollY]
  );

  /** Opens the arrow's context menu at a canvas point (converted to window coordinates). */
  const openLinkMenuAt = useCallback(
    (ref: PMDepRef, x: number, y: number) => {
      hidePMTip();
      if (!canvasBoxRef.current) return crud.openDependencyMenu(ref, x, y);
      canvasBoxRef.current.measureInWindow((wx, wy) => crud.openDependencyMenu(ref, wx + x, wy + y));
    },
    [crud]
  );

  const onTap = useCallback(
    (idx: number, x: number, y: number, zone: number) => {
      const s = usePMStore.getState();
      const guid = idx >= 0 ? s.visibleRows[idx] : undefined;
      if (s.linkSourceGUID) {
        if (guid && guid !== s.linkSourceGUID) crud.link(s.linkSourceGUID, guid);
        else s.setLinkSource(null);
        return;
      }
      // touch devices have no right-click: a tap on an arrow opens its menu (edit / delete)
      if (!IS_WEB && (zone === Z_NONE || zone === Z_BAR_ONLY)) {
        const ref = hitLinkAt(x, y);
        if (ref) return openLinkMenuAt(ref, x, y);
      }
      s.setSelected(guid ?? null);
    },
    [crud, hitLinkAt, openLinkMenuAt]
  );

  const onDoubleTap = useCallback(
    (idx: number, x: number, y: number, zone: number) => {
      // double-click on a dependency arrow (not on a bar) -> PMEditDependencyScreen
      if (zone === Z_NONE || zone === Z_BAR_ONLY) {
        const ref = hitLinkAt(x, y);
        if (ref) return crud.openDependencyEditor(ref);
      }
      const guid = idx >= 0 ? usePMStore.getState().visibleRows[idx] : undefined;
      if (guid) crud.edit(guid);
    },
    [crud, hitLinkAt]
  );

  /** onRightClickMenuMode: select the bar's task and open PMTaskRowMenu at the window point */
  const openRowMenu = useCallback((idx: number, winX: number, winY: number) => {
    const s = usePMStore.getState();
    const guid = s.visibleRows[idx];
    if (!guid) return;
    hidePMTip();
    s.setSelected(guid);
    s.setRowMenu({ guid, x: winX, y: winY, source: 'gantt' });
  }, []);
  const isBarZone = (zone: number) => {
    'worklet';
    return zone !== Z_NONE && zone !== Z_THUMB_X && zone !== Z_THUMB_Y && zone !== Z_HOLD;
  };

  // web: right-click on an arrow -> context menu (edit, delete); on a bar (onRightClickMenuMode) ->
  // PMTaskRowMenu; elsewhere the browser menu
  useEffect(() => {
    if (!IS_WEB) return;
    const el = canvasBoxRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const onContextMenu = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const ref = hitLinkAt(x, y);
      if (!ref) {
        if (!rowMenuMode || !isBarZone(hitTest(x, y))) return;
        e.preventDefault();
        openRowMenu(rowAt(y), e.clientX, e.clientY);
        return;
      }
      e.preventDefault();
      hidePMTip();
      crud.openDependencyMenu(ref, e.clientX, e.clientY);
    };
    el.addEventListener('contextmenu', onContextMenu);
    return () => el.removeEventListener('contextmenu', onContextMenu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crud, hitLinkAt, rowMenuMode, openRowMenu]);

  const commitZoom = useCallback((dw: number) => usePMStore.getState().setDayWidth(dw), []);

  // =====================================================================================
  // Gestures
  // =====================================================================================
  const gesture = useMemo(() => {
    const startDrag = (zone: number, x: number, y: number) => {
      'worklet';
      runOnJS(hidePMTip)();
      const idx = rowAt(y);
      if (zone === Z_THUMB_X || zone === Z_THUMB_Y) {
        dragMode.value = zone;
        return;
      }
      if (idx < 0) return;
      const b = barsSV.value;
      dragRow.value = idx;
      dragBaseX.value = b.x[idx] * (dwCommitted / b.dw);
      dragBaseW.value = b.w[idx] * (dwCommitted / b.dw);
      dragProg.value = b.prog[idx];
      dragDX.value = 0;
      dragging.value = 1;
      if (zone === Z_LINK_START || zone === Z_LINK_FINISH) {
        const r = dayWidthLive.value / b.dw;
        const off = linkHandleOffset(b.kind[idx]);
        linkX1.value = zone === Z_LINK_START ? b.x[idx] * r - scrollX.value - off : b.x[idx] * r - scrollX.value + b.w[idx] * r + off;
        linkY1.value = PM_SCALE_HEIGHT + idx * PM_ROW_HEIGHT - scrollY.value + PM_ROW_HEIGHT / 2;
        linkX2.value = x;
        linkY2.value = y;
        linkTarget.value = -1;
      }
      dragMode.value = zone;
    };

    const moveDrag = (x: number, y: number, changeX: number, changeY: number) => {
      'worklet';
      const m = dragMode.value;
      if (m === Z_THUMB_Y) {
        const max = maxScrollY(rowCount.value, bodyH.value);
        const track = bodyH.value - vThumbH.value;
        if (track > 0) scrollY.value = clampValue(scrollY.value + (changeY * max) / track, 0, max);
      } else if (m === Z_THUMB_X) {
        const max = maxScrollX(totalDaysSV.value, dayWidthLive.value, chartW.value);
        const track = chartW.value - SCROLLBAR - hThumbW.value;
        if (track > 0) scrollX.value = clampValue(scrollX.value + (changeX * max) / track, 0, max);
      } else if (m === Z_LINK_START || m === Z_LINK_FINISH) {
        linkX2.value = x;
        linkY2.value = y;
        const t = rowAt(y);
        linkTarget.value = t !== dragRow.value ? t : -1;
      } else if (isBarDrag(m)) {
        dragDX.value += changeX;
      }
    };

    const endDrag = (x: number, y: number) => {
      'worklet';
      const m = dragMode.value;
      if (m === Z_MOVE || m === Z_RESIZE_START || m === Z_RESIZE_END || m === Z_PROGRESS) {
        const days = Math.round(dragDX.value / dayWidthLive.value);
        const w = dragBaseW.value * zoomRatio.value;
        const progress = clampValue(dragProg.value / 100 + (w > 0 ? dragDX.value / w : 0), 0, 1) * 100;
        dragMode.value = Z_HOLD;
        runOnJS(commitBarDrag)(m, dragRow.value, days, progress);
        return;
      }
      if (m === Z_LINK_START || m === Z_LINK_FINISH) {
        const t = rowAt(y);
        if (t >= 0 && t !== dragRow.value) {
          const b = barsSV.value;
          const r = dayWidthLive.value / b.dw;
          const mid = b.x[t] * r - scrollX.value + (b.w[t] * r) / 2;
          runOnJS(commitLink)(dragRow.value, m === Z_LINK_START ? 0 : 1, t, x < mid ? 0 : 1);
        }
      }
      dragMode.value = Z_NONE;
    };

    const finalize = () => {
      'worklet';
      if (dragMode.value !== Z_HOLD) {
        dragMode.value = Z_NONE;
        dragRow.value = -1;
        dragging.value = 0;
      }
      linkTarget.value = -1;
    };

    const hover = Gesture.Hover()
      .onBegin((e) => {
        'worklet';
        const idx = rowAt(e.y);
        const zone = hitTest(e.x, e.y);
        hoverRow.value = idx;
        hoverZone.value = zone;
        runOnJS(onHover)(idx, zone, e.x, e.y);
      })
      .onUpdate((e) => {
        'worklet';
        const idx = rowAt(e.y);
        const zone = hitTest(e.x, e.y);
        if (idx !== hoverRow.value || zone !== hoverZone.value) {
          hoverRow.value = idx;
          hoverZone.value = zone;
          runOnJS(onHover)(idx, zone, e.x, e.y);
        }
      })
      .onEnd(() => {
        'worklet';
        hoverRow.value = -1;
        hoverZone.value = Z_NONE;
        runOnJS(onHover)(-1, Z_NONE, 0, 0);
      });

    // bar editing: web = press+move on a bar (mouse), touch = long-press on a bar
    const edit = IS_WEB
      ? Gesture.Pan()
          .manualActivation(true)
          .onTouchesDown((e, m) => {
            'worklet';
            const t = e.allTouches[0];
            const zone = hitTest(t.x, t.y);
            pendingZone.value = zone;
            downX.value = t.x;
            downY.value = t.y;
            if (zone === Z_NONE || zone === Z_BAR_ONLY) m.fail();
          })
          .onTouchesMove((e, m) => {
            'worklet';
            const t = e.allTouches[0];
            if (Math.abs(t.x - downX.value) + Math.abs(t.y - downY.value) > 3) m.activate();
          })
          .onStart(() => {
            'worklet';
            startDrag(pendingZone.value, downX.value, downY.value);
          })
      : Gesture.Pan()
          .activateAfterLongPress(300)
          .onStart((e) => {
            'worklet';
            const zone = hitTest(e.x, e.y);
            if (zone !== Z_NONE && zone !== Z_BAR_ONLY && zone !== Z_THUMB_X && zone !== Z_THUMB_Y) startDrag(zone, e.x, e.y);
          });
    edit
      .onChange((e) => {
        'worklet';
        moveDrag(e.x, e.y, e.changeX, e.changeY);
      })
      .onEnd((e) => {
        'worklet';
        endDrag(e.x, e.y);
      })
      .onFinalize(() => {
        'worklet';
        finalize();
      });

    const scroll = Gesture.Pan()
      .minDistance(3)
      .onChange((e) => {
        'worklet';
        scrollX.value = clampValue(scrollX.value - e.changeX, 0, maxScrollX(totalDaysSV.value, dayWidthLive.value, chartW.value));
        scrollY.value = clampValue(scrollY.value - e.changeY, 0, maxScrollY(rowCount.value, bodyH.value));
      })
      .onEnd((e) => {
        'worklet';
        scrollX.value = withDecay({ velocity: -e.velocityX, clamp: [0, maxScrollX(totalDaysSV.value, dayWidthLive.value, chartW.value)] });
        scrollY.value = withDecay({ velocity: -e.velocityY, clamp: [0, maxScrollY(rowCount.value, bodyH.value)] });
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        'worklet';
        pinchBase.value = dayWidthLive.value;
        dragging.value = 1;
      })
      .onUpdate((e) => {
        'worklet';
        const next = clampValue(pinchBase.value * e.scale, PM_DAY_WIDTH_MIN, PM_DAY_WIDTH_MAX);
        const day = (scrollX.value + e.focalX) / dayWidthLive.value;
        dayWidthLive.value = next;
        scrollX.value = clampValue(day * next - e.focalX, 0, maxScrollX(totalDaysSV.value, next, chartW.value));
      })
      .onEnd(() => {
        'worklet';
        runOnJS(commitZoom)(dayWidthLive.value);
      })
      .onFinalize(() => {
        'worklet';
        dragging.value = 0;
      });

    const tap = Gesture.Tap()
      .maxDuration(450)
      .onEnd((e, ok) => {
        'worklet';
        if (!ok || panelHit(e.x, e.y)) return;
        runOnJS(onTap)(rowAt(e.y), e.x, e.y, hitTest(e.x, e.y));
      });
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e, ok) => {
        'worklet';
        if (!ok || panelHit(e.x, e.y)) return;
        const idx = rowAt(e.y);
        if (idx >= 0) runOnJS(onDoubleTap)(idx, e.x, e.y, hitTest(e.x, e.y));
      });

    /** touch + onRightClickMenuMode: long-press a bar and release without moving = PMTaskRowMenu
     *  (long-press and drag still moves / resizes the bar; a drag without movement changes nothing) */
    const rowMenu = Gesture.LongPress()
      .enabled(rowMenuMode && !IS_WEB)
      .minDuration(450)
      .maxDistance(12)
      .onStart((e) => {
        'worklet';
        menuRow.value = isBarZone(hitTest(e.x, e.y)) ? rowAt(e.y) : -1;
        menuX.value = e.x;
        menuY.value = e.y;
      })
      .onEnd((e, ok) => {
        'worklet';
        const idx = menuRow.value;
        menuRow.value = -1;
        if (!ok || idx < 0) return;
        if (Math.abs(e.x - menuX.value) + Math.abs(e.y - menuY.value) > 12) return; // it became a drag
        runOnJS(openRowMenu)(idx, e.absoluteX, e.absoluteY);
      });

    return Gesture.Simultaneous(hover, pinch, rowMenu, Gesture.Race(Gesture.Exclusive(edit, scroll), Gesture.Exclusive(doubleTap, tap)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dwCommitted, onHover, onTap, onDoubleTap, commitBarDrag, commitLink, commitZoom, rowMenuMode, openRowMenu]);

  // =====================================================================================
  // Hover / selection CRUD panel next to the bar
  // =====================================================================================
  // onRightClickMenuMode: no panel - the same commands are in PMTaskRowMenu
  const panelGUID = linkSourceGUID || rowMenuMode ? null : IS_WEB ? hoveredGUID : selectedGUID;
  const panelIndex = panelGUID ? rowIndexById[panelGUID] ?? -1 : -1;
  const panelTask = panelGUID ? tasksById[panelGUID] : undefined;
  const panelBar = useMemo(
    () => (panelIndex >= 0 && hitTable.kind[panelIndex] !== K_NONE ? { x: hitTable.x[panelIndex], w: hitTable.w[panelIndex], dw: hitTable.dw } : null),
    [panelIndex, hitTable]
  );
  useEffect(() => {
    panelRow.value = panelBar ? panelIndex : -1;
  }, [panelIndex, panelBar, panelRow]);

  const panelStyle = useAnimatedStyle(() => {
    if (!panelBar) return { opacity: 0, transform: [{ translateX: -9999 }, { translateY: 0 }] };
    const r = dayWidthLive.value / panelBar.dw;
    const left = Math.min(panelBar.x * r - scrollX.value + panelBar.w * r + 26, chartW.value - PM_BAR_PANEL_WIDTH - SCROLLBAR - 4);
    const top = PM_SCALE_HEIGHT + panelIndex * PM_ROW_HEIGHT - scrollY.value + 4;
    const visible = dragging.value === 0 && top >= PM_SCALE_HEIGHT - 2 && top + PM_ROW_HEIGHT - 8 <= PM_SCALE_HEIGHT + bodyH.value && left > -PM_BAR_PANEL_WIDTH;
    return { opacity: visible ? 1 : 0, transform: [{ translateX: Math.max(4, left) }, { translateY: top }] };
  }, [panelBar, panelIndex]);

  // =====================================================================================
  // Toolbar actions
  // =====================================================================================
  const zoomBy = (factor: number) => viewport.setZoom(dayWidth * factor);
  const goToday = () => viewport.scrollToX(xOf(todayUTC()) * (dayWidthLive.value / dayWidth) - chartW.value / 3);
  const fit = () => {
    const days = Math.max(1, (projectFinishMs - projectStartMs) / DAY_MS);
    const dw = clampValue((chartW.value - 80) / (days + 2), PM_DAY_WIDTH_MIN, PM_DAY_WIDTH_MAX);
    viewport.setZoom(dw);
    requestAnimationFrame(() => viewport.scrollToX(((projectStartMs - timelineStartMs) / DAY_MS - 1) * dw, false));
  };
  const toolbarActions = { zoomBy, setZoom: (dw: number) => viewport.setZoom(dw), fit, goToday };

  const hoverBar = hoveredGUID && hoveredGUID !== selectedGUID ? bars.find((b) => b.guid === hoveredGUID) : undefined;
  const selectedBar = selectedGUID ? bars.find((b) => b.guid === selectedGUID) : undefined;
  const handleBars = [hoverBar, selectedBar].filter(Boolean) as BarDesc[];

  return (
    <View style={{ width, height, backgroundColor: palette.background }}>
      <PMGanttToolbar crud={crud} palette={palette} activeUnit={levels.bottom} actions={toolbarActions} />

      <GestureDetector gesture={gesture}>
        <View ref={canvasBoxRef} style={[{ width, height: canvasH }, IS_WEB ? ({ cursor } as any) : null]} collapsable={false}>
          <Canvas style={{ width, height: canvasH }}>
            <Rect x={0} y={0} width={width} height={canvasH} color={palette.background} />

            {/* ================= body ================= */}
            <Group clip={rect(0, PM_SCALE_HEIGHT, width, bodyPx)}>
              <Group transform={bodyY}>
                <Rect x={0} y={hoverY} width={width} height={PM_ROW_HEIGHT} color={palette.hover} opacity={hoverOpacity} />
                <Path path={rowLines} style="stroke" strokeWidth={1} color={palette.grid} />
                <Group transform={timeX}>
                  <Rect x={projectBand.x} y={win.firstRow * PM_ROW_HEIGHT} width={projectBand.w} height={2} color={palette.primary} opacity={0.35} />
                  <Path path={grid.weekend} color={palette.weekend} />
                  <Path path={grid.thin} style="stroke" strokeWidth={1} color={palette.grid} />
                  <Path path={grid.strong} style="stroke" strokeWidth={1} color={palette.gridStrong} />
                  <Rect x={todayX - 1} y={win.firstRow * PM_ROW_HEIGHT} width={2} height={Math.max(bodyPx, (win.lastRow - win.firstRow + 2) * PM_ROW_HEIGHT) + PM_OVERSCAN_ROWS * PM_ROW_HEIGHT} color={palette.today} opacity={0.8} />

                  {/* links under bars */}
                  <Path path={links.normal} style="stroke" strokeWidth={1.4} color={palette.link} />
                  <Path path={links.normalArrow} color={palette.link} />
                  <Path path={links.critical} style="stroke" strokeWidth={1.6} color={palette.critical} />
                  <Path path={links.criticalArrow} color={palette.critical} />
                  {links.custom.map(([color, cp]) => (
                    <Group key={`dc-${color}`}>
                      <Path path={cp.line} style="stroke" strokeWidth={1.6} color={color} />
                      <Path path={cp.arrow} color={color} />
                    </Group>
                  ))}
                  <Path path={links.active} style="stroke" strokeWidth={2.2} color={palette.linkActive} />
                  <Path path={links.activeArrow} color={palette.linkActive} />

                  {bars.map((b) => (
                    <BarShape key={b.guid} bar={b} palette={palette} fonts={fonts} selected={b.guid === selectedGUID} linkSource={b.guid === linkSourceGUID} />
                  ))}

                  {/* handles (link circles, resize grips, progress knob) on hover/selection */}
                  {handleBars.map((b) => (
                    <BarHandles key={`h-${b.guid}`} bar={b} palette={palette} />
                  ))}
                </Group>

                {/* drag ghost (screen-x, UI thread) */}
                <RoundedRect x={ghostX} y={ghostY} width={ghostW} height={PM_ROW_HEIGHT - 2 * PM_BAR_VPAD} r={4} color={palette.ghost} opacity={ghostOpacity} />
                <RoundedRect x={ghostX} y={ghostY} width={ghostW} height={PM_ROW_HEIGHT - 2 * PM_BAR_VPAD} r={4} color={palette.primary} style="stroke" strokeWidth={1.5} opacity={ghostOpacity} />
                <Rect x={progressX} y={ghostY} width={progressW} height={PM_ROW_HEIGHT - 2 * PM_BAR_VPAD} color={palette.barProgress} opacity={progressOpacity} />
                {fonts.small && <SkText x={ghostLabelX} y={ghostBaseline} text={ghostLabel} font={fonts.small} color={palette.text} />}
              </Group>
            </Group>

            {/* link rubber band + drop target (canvas coordinates) */}
            <Rect x={0} y={linkTargetY} width={width} height={PM_ROW_HEIGHT} color={palette.selected} opacity={linkTargetOpacity} />
            <Path path={linkPath} style="stroke" strokeWidth={2} color={palette.linkActive} />

            {/* ================= time scale ================= */}
            <Rect x={0} y={0} width={width} height={PM_SCALE_HEIGHT} color={palette.header} />
            <Group clip={rect(0, 0, width, PM_SCALE_HEIGHT)}>
              <Group transform={timeX}>
                <Path path={scaleLines} style="stroke" strokeWidth={1} color={palette.gridStrong} />
                {projectLine?.underText && (
                  <PMProjectProgressLine y={projectLine.y} H={projectLine.H} band={projectBand} progress={projectProgress} color={projectLineColor} />
                )}
                {grid.bottomCells.map((c) =>
                  c.strong ? <Rect key={`w${c.x}`} x={c.x} y={PM_SCALE_HEIGHT / 2} width={c.w} height={PM_SCALE_HEIGHT / 2} color={palette.weekend} /> : null
                )}
                {fonts.ready &&
                  grid.topCells.map((c) => {
                    const tw = measureSmallBold(c.label);
                    return tw + 8 <= c.w || c.w > 60 ? (
                      <SkText key={`t${c.x}`} x={c.x + 6} y={PM_SCALE_HEIGHT / 2 - 8} text={c.label} font={fonts.smallBold} color={palette.text} />
                    ) : null;
                  })}
                {fonts.ready &&
                  grid.bottomCells.map((c) => {
                    const tw = measureSmall(c.label);
                    return tw + 4 <= c.w ? (
                      <SkText key={`b${c.x}`} x={c.x + (c.w - tw) / 2} y={PM_SCALE_HEIGHT - 9} text={c.label} font={fonts.small} color={palette.textMuted} />
                    ) : null;
                  })}
                <Rect x={todayX - 1} y={PM_SCALE_HEIGHT / 2} width={2} height={PM_SCALE_HEIGHT / 2} color={palette.today} />
                {projectLine && !projectLine.underText && (
                  <PMProjectProgressLine y={projectLine.y} H={projectLine.H} band={projectBand} progress={projectProgress} color={projectLineColor} />
                )}
                {projectLine && (
                  <PMProjectProgressLabel
                    x={projectLine.labelX}
                    baseline={projectLine.baseline}
                    textWidth={projectLine.tw}
                    text={projectLine.label}
                    font={fonts.smallBold}
                    background={palette.header}
                    color={palette.text}
                  />
                )}
              </Group>
            </Group>
            <Rect x={stickyBgX} y={0} width={stickyBgW} height={PM_SCALE_HEIGHT / 2 - 1} color={palette.header} />
            {fonts.smallBold && <SkText x={stickyX} y={PM_SCALE_HEIGHT / 2 - 8} text={stickyLabel} font={fonts.smallBold} color={palette.text} />}
            <Rect x={0} y={PM_SCALE_HEIGHT / 2 - 0.5} width={width} height={1} color={palette.grid} />
            <Rect x={0} y={PM_SCALE_HEIGHT - 1} width={width} height={1} color={palette.gridStrong} />

            {/* ================= scrollbars ================= */}
            <RoundedRect x={width - SCROLLBAR} y={vThumbY} width={SCROLLBAR - 2} height={vThumbH} r={3} color={palette.gridStrong} />
            <RoundedRect x={hThumbX} y={canvasH - SCROLLBAR} width={hThumbW} height={SCROLLBAR - 2} r={3} color={palette.gridStrong} />
          </Canvas>

          {panelTask && <PMGanttBarHoverPanel guid={panelTask.rowGUID} crud={crud} palette={palette} animatedStyle={panelStyle} />}
        </View>
      </GestureDetector>
    </View>
  );
}

// =====================================================================================
// Bar primitives
// =====================================================================================

type Fonts = ReturnType<typeof usePMFonts>;

function milestonePath(x: number, cy: number): SkPath {
  const p = Skia.Path.Make();
  p.moveTo(x, cy - MILESTONE_HALF);
  p.lineTo(x + MILESTONE_HALF, cy);
  p.lineTo(x, cy + MILESTONE_HALF);
  p.lineTo(x - MILESTONE_HALF, cy);
  p.close();
  return p;
}

function summaryBracketsPath(x: number, w: number, y: number): SkPath {
  const p = Skia.Path.Make();
  const b = y + SUMMARY_H;
  p.moveTo(x, b);
  p.lineTo(x + 6, b);
  p.lineTo(x, b + 5);
  p.close();
  p.moveTo(x + w, b);
  p.lineTo(x + w - 6, b);
  p.lineTo(x + w, b + 5);
  p.close();
  return p;
}

const BarShape = React.memo(function BarShape({
  bar,
  palette,
  fonts,
  selected,
  linkSource,
}: {
  bar: BarDesc;
  palette: PMPalette;
  fonts: Fonts;
  selected: boolean;
  linkSource: boolean;
}) {
  const h = PM_ROW_HEIGHT - 2 * PM_BAR_VPAD;
  const y = bar.y + PM_BAR_VPAD;
  const baseline = bar.cy + 4;
  const outline = selected || linkSource ? (linkSource ? palette.linkActive : palette.text) : null;

  if (bar.kind === K_MILESTONE) {
    const path = milestonePath(bar.x, bar.cy);
    return (
      <Group>
        <Path path={path} color={bar.color} />
        {outline && <Path path={path} style="stroke" strokeWidth={2} color={outline} />}
        {fonts.regular && <SkText x={bar.labelX} y={baseline} text={bar.label} font={fonts.regular} color={palette.text} />}
      </Group>
    );
  }

  if (bar.kind === K_SUMMARY) {
    const sy = bar.cy - SUMMARY_H / 2 - 2;
    return (
      <Group>
        <Rect x={bar.x} y={sy} width={bar.w} height={SUMMARY_H} color={bar.color} />
        {bar.progress > 0 && <Rect x={bar.x} y={sy + SUMMARY_H - 3} width={bar.w * bar.progress} height={3} color={bar.progressColor} />}
        <Path path={summaryBracketsPath(bar.x, bar.w, sy)} color={bar.color} />
        {outline && <Rect x={bar.x - 1} y={sy - 1} width={bar.w + 2} height={SUMMARY_H + 2} style="stroke" strokeWidth={1.5} color={outline} />}
        {fonts.bold && <SkText x={bar.labelX} y={baseline} text={bar.label} font={fonts.bold} color={palette.text} />}
      </Group>
    );
  }

  // showTaskProgressOnGantt: thick line, XX% of the task's full length (kit8/pm/view/task/progress/line)
  //   onTop = on the top edge · onBottom = on the bottom edge · atTheMiddle = through the middle, under the text
  const progressLine =
    bar.pctLabel !== null ? (
      <PMTaskProgressLine x={bar.x} barTop={y} barWidth={bar.w} barHeight={h} progress01={bar.progress} position={bar.progressLinePos} color={bar.progressLineColor} />
    ) : null;
  const lineUnderText = isProgressLineUnderText(bar.progressLinePos);

  return (
    <Group>
      <RoundedRect x={bar.x} y={y} width={bar.w} height={h} r={4} color={bar.color} />
      {bar.progress > 0 && (
        <Group clip={rect(bar.x, y, bar.w * bar.progress, h)}>
          <RoundedRect x={bar.x} y={y} width={bar.w} height={h} r={4} color={bar.progressColor} opacity={0.55} />
        </Group>
      )}
      {lineUnderText && progressLine}
      {outline && <RoundedRect x={bar.x - 1} y={y - 1} width={bar.w + 2} height={h + 2} r={5} style="stroke" strokeWidth={2} color={outline} />}
      {fonts.regular && (
        <SkText x={bar.labelX} y={baseline} text={bar.label} font={fonts.regular} color={bar.labelInside ? palette.textOnBar : palette.text} />
      )}
      {bar.pctLabel !== null && (
        <>
          {!lineUnderText && progressLine}
          {fonts.smallBold && <SkText x={bar.pctX} y={baseline} text={bar.pctLabel} font={fonts.smallBold} color={palette.textOnBar} />}
        </>
      )}
    </Group>
  );
});

const BarHandles = React.memo(function BarHandles({ bar, palette }: { bar: BarDesc; palette: PMPalette }) {
  const off = linkHandleOffset(bar.kind);
  const h = PM_ROW_HEIGHT - 2 * PM_BAR_VPAD;
  const y = bar.y + PM_BAR_VPAD;
  return (
    <Group>
      <Circle cx={bar.x - off} cy={bar.cy} r={4.5} color={palette.surface} />
      <Circle cx={bar.x - off} cy={bar.cy} r={4.5} style="stroke" strokeWidth={1.5} color={palette.handle} />
      <Circle cx={bar.x + bar.w + off} cy={bar.cy} r={4.5} color={palette.surface} />
      <Circle cx={bar.x + bar.w + off} cy={bar.cy} r={4.5} style="stroke" strokeWidth={1.5} color={palette.handle} />
      {bar.kind === K_TASK && bar.w > 16 && (
        <>
          <Rect x={bar.x + 2} y={y + 5} width={2} height={h - 10} color={palette.textOnBar} opacity={0.8} />
          <Rect x={bar.x + bar.w - 4} y={y + 5} width={2} height={h - 10} color={palette.textOnBar} opacity={0.8} />
          <Path path={progressKnob(bar.x + bar.w * bar.progress, y + h)} color={palette.handle} />
        </>
      )}
    </Group>
  );
});

function progressKnob(x: number, bottom: number): SkPath {
  const p = Skia.Path.Make();
  p.moveTo(x, bottom - 4);
  p.lineTo(x + 5, bottom + 3);
  p.lineTo(x - 5, bottom + 3);
  p.close();
  return p;
}
