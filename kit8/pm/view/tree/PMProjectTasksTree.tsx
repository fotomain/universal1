// Left pane: the task tree (grid) drawn entirely with Skia - rows, indentation, chevrons, kind icons,
// #(hierarchy number) / Task name / Start / Days / % / custom columns - on the SAME virtual vertical
// scroll value as the chart, so tree rows and Gantt bars are pixel-locked (no second ScrollView to sync).
//
// Columns (tree/columns)  = "#" first by default (uxuiSettings.showTreeHierarchyNumbers switches it),
//                           drag a column header to move the column (uxuiSettings.treeColumnsOrder),
//                           drag a header separator to resize the column on its left - Task name included
//                           (uxuiSettings.treeColumnsWidths; double-click the separator = default width),
//                           right-click (touch: long-press) a header = PMTreeHeaderMenu: Add custom column ▸
//                           Text / Date / Boolean / Integer / Float, Delete custom column, header color, width.
// Horizontal scroll       = when the columns are wider than the pane (custom / resized columns):
//                           shift+wheel or trackpad (web), pan (touch), the scroll bar at the bottom.
//                           viewport.treeScrollX - every column x below is a CONTENT x.
// Container CRUD panel    = the toolbar above the canvas.
// Row CRUD panel          = the hover panel (web: on hover, touch: on the selected row); it takes the
//                           width its icons need (tree/panels/treeRowPanelGeometry): ends at the Task name
//                           column's right edge and grows over the neighbouring columns when needed.
//                           Its LAST button is the drag handle: press + drag = move the row.
// Filter & sort           = the ▾ at the right of every header (funnel = filtered, uxuiSettings.columnFilterIconColor;
//                           ↑ / ↓ = sorted column) or header menu -> "Filter & sort" -> PMTreeColumnFilterPopup
//                           (tree/filter). Rows kept only as the context of a match are drawn muted.
// Inline cell edit        = click / tap Start, Days, % or a custom cell -> EditTaskStart / EditTaskDays /
//                           EditTaskProgress / EditTaskCustomValue (Boolean cells toggle on click);
//                           drag & drop of rows also works on the Task name and # columns.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Group, Path, Rect, RoundedRect, Skia, Text as SkText, rect, useCanvasRef } from '@shopify/react-native-skia';
import { registerScreenshotCanvas, skiaCanvasSnapshotBase64 } from '../../../lib/shareScreenshot';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import { PM_ROW_HEIGHT, PM_SCALE_HEIGHT, PM_TOOLBAR_HEIGHT, PM_TREE_INDENT } from '../../model/constants';
import { usePMStore } from '../../store/store_pm';
import { formatDateShort } from '../project/scheduling';
import { formatPlanDate, formatPlanDuration } from '../../model/planDateFormats';
import { ellipsize, PMPalette, withAlpha } from '../theme';
import { makeMeasure, usePMFonts } from '../../skia/usePMFonts';
import { clampValue, maxScrollY, PMViewport } from '../gantt/useGanttViewport';
import { PMCrud } from '../../crud/usePMCrud';
import PMTreeRowHoverPanel from './panels/PMTreeRowHoverPanel';
import PMTreeToolbar from './toolbars/PMTreeToolbar';
import { hidePMTip, showPMTip } from '../../inner/tooltip/PMTooltip';
import { PMCellField } from '../../store/store_pm';
import { taskColorOf } from '../../model/types';
import { usePMKanbanStore } from '../../store/store_kanban';
import { kanbanStageForRow, derivedKanbanProgress } from '../kanban/kanbanModel';
import { kanbanStageColorOf, kanbanStageProgressOf, PM_KANBAN_NO_STATE_COLOR, PM_KANBAN_NO_STATE_LABEL } from '../../model/kanbanTypes';
import PMInlineCellEditor from './inline/PMInlineCellEditor';
import {
  PMTreeColumnKey,
  PM_TREE_RESIZE_GRAB,
  scrollXToRevealColumn,
  treeColumnAt,
  treeColumnResizeHandleAt,
  treeMaxScrollX as layoutMaxScrollX,
} from './columns/treeColumns';
import {
  customColumnAlign,
  formatCustomColumnValue,
  isCustomColumnKey,
  PM_CUSTOM_COLUMN_TYPE_LABEL,
  taskCustomValuesOf,
} from './columns/customColumns';
import { useTreeColumnsLayout } from './columns/useTreeColumnsLayout';
import { useTreeColumnDragGesture, useTreeColumnGeometry } from './columns/useTreeColumnDragGesture';
import { kanbanBridgeFinish, kanbanBridgeMove, kanbanBridgeRelease, PMKanbanTreeBridge } from '../kanban/kanbanTreeBridge';
import { useTreeColumnResizeGesture } from './columns/useTreeColumnResizeGesture';
import PMTreeColumnsHeader from './columns/PMTreeColumnsHeader';
import { isOverTreeRowPanel, placeTreeRowPanel, treeRowPanelViewLeft } from './panels/treeRowPanelGeometry';
import { treeFilterIconAt } from './filter/treeFilterIconGeometry';
import { describeTreeColumnFilter, isTreeColumnFilterActive, sortLabels, treeColumnDataType } from './filter/treeColumnFilter';

const IS_WEB = Platform.OS === 'web';
const CHEVRON_W = 16;
const ICON_W = 16;
/** Horizontal scroll bar (only when the columns are wider than the pane). */
const HBAR_H = 6;
const HBAR_GRAB_H = 12;
/** Fingers need a wider grab zone around a header separator than a mouse. */
const RESIZE_GRAB = IS_WEB ? PM_TREE_RESIZE_GRAB : 12;
const BOOL_BOX = 12;
/** Width of the multi-selection column (round check boxes) - always the FIRST column, left of the grid. */
export const PM_TREE_SELECT_WIDTH = 30;

function RoundCheck({ checked, partial, color, muted }: { checked: boolean; partial?: boolean; color: string; muted: string }) {
  return (
    <View style={[selectStyles.circle, { borderColor: checked || partial ? color : muted, backgroundColor: checked ? color : 'transparent' }]}>
      {checked ? <Text style={selectStyles.mark}>✓</Text> : partial ? <View style={[selectStyles.dash, { backgroundColor: color }]} /> : null}
    </View>
  );
}
const selectStyles = StyleSheet.create({
  circle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  mark: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 13 },
  dash: { width: 8, height: 2, borderRadius: 1 },
});

/** Editable cell of a column (null = Task name / # column). */
const cellFieldOf = (key: PMTreeColumnKey | null): PMCellField | null =>
  key === 'taskStartDate' ||
  key === 'start' ||
  key === 'taskFinishDate' ||
  key === 'taskDuration' ||
  key === 'days' ||
  key === 'progress' ||
  key === 'kanban' ||
  key === 'kanbanStageProgressPercent' ||
  key === 'startHourStart' ||
  key === 'startHourFinish' ||
  key === 'planMinuteStart' ||
  key === 'planMinuteFinish' ||
  key === 'planSecondStart' ||
  key === 'planSecondFinish' ||
  isCustomColumnKey(key)
    ? (key as PMCellField)
    : null;

interface Props {
  viewport: PMViewport;
  width: number;
  height: number; // whole pane incl. toolbar
  palette: PMPalette;
  crud: PMCrud;
  /** Kanban mode: dragging a row to the right of the tree drops it onto the board (view/kanban/kanbanTreeBridge.ts) */
  kanbanBridge?: PMKanbanTreeBridge;
  /** uxui.hideGanttToolBar: no tree toolbar (the chart hides its bar too, so the rows stay aligned) */
  hideToolbar?: boolean;
}

export default function PMProjectTasksTree({ viewport, width: paneWidth, height, palette, crud, kanbanBridge, hideToolbar = false }: Props) {
  /** the grid (Skia canvas) starts after the multi-selection column */
  const width = Math.max(40, paneWidth - PM_TREE_SELECT_WIDTH);
  const TB = hideToolbar ? 0 : PM_TOOLBAR_HEIGHT;
  const skiaRef = useCanvasRef();
  const checkedGUIDs = usePMStore((s) => s.checkedGUIDs);
  const fonts = usePMFonts();
  const visibleRows = usePMStore((s) => s.visibleRows);
  const tasksById = usePMStore((s) => s.tasksById);
  const tree = usePMStore((s) => s.tree);
  const schedule = usePMStore((s) => s.schedule);
  const expanded = usePMStore((s) => (s.selectedProjectGUID ? s.expandedByProject[s.selectedProjectGUID] : undefined));
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const hoveredGUID = usePMStore((s) => s.hoveredGUID);
  const linkSourceGUID = usePMStore((s) => s.linkSourceGUID);
  const rowIndexById = usePMStore((s) => s.rowIndexById);
  const showCritical = usePMStore((s) => s.showCriticalPath);
  const cellEdit = usePMStore((s) => s.cellEdit);
  const headerColors = usePMStore((s) => s.treeHeadersBackgroundColors);
  const columnReveal = usePMStore((s) => s.treeColumnReveal);
  // ---- filter & sort (tree/filter) ----
  const columnFilters = usePMStore((s) => s.treeColumnsFilters);
  const columnSort = usePMStore((s) => s.treeColumnSort);
  const filterIconColor = usePMStore((s) => s.columnFilterIconColor);
  const filterContext = usePMStore((s) => s.treeFilterContextGUIDs);
  const customColumnDefs = usePMStore((s) => s.customColumns);
  const filteredKeys = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const [k, f] of Object.entries(columnFilters)) if (isTreeColumnFilterActive(k, f, customColumnDefs)) out[k] = true;
    return out;
  }, [columnFilters, customColumnDefs]);
  /** uxuiSettings.projectTreeContextCommandsMode: row commands in a right-click / long-press menu instead of the hover panel */
  const rowMenuMode = usePMStore((s) => s.projectTreeContextCommandsMode === 'onRightClickMenuMode');

  const canvasH = Math.max(0, height - TB);
  // ---- grid columns (tree/columns): saved order + widths, "#" switch, custom columns, responsive hiding ----
  /** column being resized right now (live, saved on release) */
  const [liveWidth, setLiveWidth] = useState<{ key: PMTreeColumnKey; width: number } | null>(null);
  const layout = useTreeColumnsLayout(width, liveWidth);
  const geometry = useTreeColumnGeometry(layout, RESIZE_GRAB);
  const nameCol = layout.byKey.name ?? { key: 'name' as const, title: '', x: 0, w: width };
  const wbsCol = layout.byKey.wbs;
  const startCol = layout.byKey.taskStartDate ?? layout.byKey.start;
  const finishCol = layout.byKey.taskFinishDate;
  const startHourStartCol = layout.byKey.startHourStart;
  const startHourFinishCol = layout.byKey.startHourFinish;
  const planMinuteStartCol = layout.byKey.planMinuteStart;
  const planMinuteFinishCol = layout.byKey.planMinuteFinish;
  const planSecondStartCol = layout.byKey.planSecondStart;
  const planSecondFinishCol = layout.byKey.planSecondFinish;
  const daysCol = layout.byKey.taskDuration ?? layout.byKey.days;
  const progCol = layout.byKey.progress;
  const kanbanCol = layout.byKey.kanban;
  const kanbanProgressCol = layout.byKey.kanbanStageProgressPercent;
  const planDateInputFormat = usePMStore((s) => s.planDateInputFormat);
  const planDay = usePMStore((s) => s.planDay);
  const planHour = usePMStore((s) => s.planHour);
  const planMinute = usePMStore((s) => s.planMinute);
  const planSecond = usePMStore((s) => s.planSecond);
  const customCols = useMemo(() => layout.columns.filter((c) => c.customType), [layout]);
  const kanbanStages = usePMKanbanStore((s) => s.stages);
  const kanbanStates = usePMKanbanStore((s) => s.statesByTask);
  /** grid width in content coordinates (rows, lines) */
  const gridW = Math.max(width, layout.contentWidth);
  const { scrollY, hoverRow, rowCount, bodyH, dragging, win, treeScrollX, treeMaxScrollX } = viewport;
  const colsRef = useRef(layout);
  colsRef.current = layout;
  /** left x of the tree structure (chevron) of a row at `depth` (content x) */
  const chevronXAt = useCallback((depth: number) => (colsRef.current.byKey.name?.x ?? 0) + 8 + depth * PM_TREE_INDENT, []);
  const [hoverInCells, setHoverInCells] = useState(false);
  const [hoverCellField, setHoverCellField] = useState<PMCellField | null>(null);
  const [headerCursor, setHeaderCursor] = useState<'' | 'grab' | 'col-resize' | 'pointer'>('');
  /** row whose hover panel is showing (web) - the pointer may move over the panel without hiding it */
  const panelShownFor = useRef<string | null>(null);
  /** row under the pointer while the pointer is over THIS tree (the chart also sets store.hoveredGUID) */
  const [treeHoverGUID, setTreeHoverGUID] = useState<string | null>(null);
  /** row dragged by the panel's drag handle (keeps its panel mounted while the pointer moves away) */
  const [handleDragGUID, setHandleDragGUID] = useState<string | null>(null);

  // ---- horizontal scroll range follows the layout ----------------------------------------------------
  const maxSX = layoutMaxScrollX(layout);
  useEffect(() => {
    treeMaxScrollX.value = maxSX;
    treeScrollX.value = clampValue(treeScrollX.value, 0, maxSX);
  }, [maxSX, treeMaxScrollX, treeScrollX]);

  // new custom column (or any "reveal" request): scroll it into view once it is laid out
  useEffect(() => {
    if (!columnReveal || !layout.byKey[columnReveal.key]) return;
    treeScrollX.value = withTiming(scrollXToRevealColumn(layout, columnReveal.key, treeScrollX.value), { duration: 280 });
    usePMStore.getState().requestTreeColumnReveal(null);
  }, [columnReveal, layout, treeScrollX]);

  // ---- per-window row descriptors (re-computed only when the window/data changes) ------
  const rows = useMemo(() => {
    const measureReg = makeMeasure(fonts.regular);
    const measureBold = makeMeasure(fonts.bold);
    const measureSmall = makeMeasure(fonts.small);
    const measureSmallBold = makeMeasure(fonts.smallBold);
    const out: {
      guid: string;
      index: number;
      y: number;
      depth: number;
      summary: boolean;
      milestone: boolean;
      hasChildren: boolean;
      isExpanded: boolean;
      name: string;
      nameX: number;
      wbs: string;
      start: string;
      startHourStart: string;
      startHourStartX: number;
      planMinuteStart: string;
      planMinuteStartX: number;
      planSecondStart: string;
      planSecondStartX: number;
      finish: string;
      startHourFinish: string;
      startHourFinishX: number;
      planMinuteFinish: string;
      planMinuteFinishX: number;
      planSecondFinish: string;
      planSecondFinishX: number;
      days: string;
      daysX: number;
      prog: string;
      progX: number;
      kanban: {
        text: string;
        color: string;
        bgColor: string;
        pillX: number;
        pillW: number;
        dotX: number;
        textX: number;
      } | null;
      kanbanProg: string;
      kanbanProgX: number;
      critical: boolean;
      color: string | null;
      /** shown only because a descendant matches the filters */
      context: boolean;
      custom: { key: string; text: string; x: number; bool: boolean | null; boxX: number }[];
    }[] = [];
    for (let i = win.firstRow; i <= win.lastRow && i < visibleRows.length; i++) {
      const guid = visibleRows[i];
      const t = tasksById[guid];
      if (!t) continue;
      const r = schedule[guid];
      const depth = tree.depthById[guid] ?? 0;
      const hasChildren = (tree.childrenById[guid]?.length ?? 0) > 0;
      const summary = !!r?.isSummary;
      const nameX = nameCol.x + 8 + depth * PM_TREE_INDENT + CHEVRON_W + ICON_W + 4;
      const measure = summary ? measureBold : measureReg;
      const isSubDay = planHour || planMinute || planSecond;
      const finishInstant = r
        ? isSubDay
          ? r.finishMs
          : r.finishMs > r.startMs
          ? r.finishMs - 1
          : r.startMs
        : 0;
      const startText = r ? ellipsize(formatPlanDate(r.startMs, planDateInputFormat), (startCol?.w ?? 0) - 10, measureSmall) : '';
      const finishText = r ? ellipsize(formatPlanDate(finishInstant, planDateInputFormat), (finishCol?.w ?? 0) - 10, measureSmall) : '';
      const durationText = r ? (r.isMilestone ? '◆' : formatPlanDuration(r.durationDays, { planDay, planHour, planMinute, planSecond })) : '';
      const prog = r ? `${Math.round(r.progress)}%` : '';

      const dStart = r ? new Date(r.startMs) : null;
      const dFinish = r ? new Date(finishInstant) : null;
      const formatUnit = (val: unknown, fallback: number | null): string => {
        if (typeof val === 'number') return String(val).padStart(2, '0');
        if (typeof val === 'string' && val.trim() !== '') return val.padStart(2, '0');
        return fallback !== null ? String(fallback).padStart(2, '0') : '';
      };
      const startHourStartText = startHourStartCol ? formatUnit(t.rowJSON?.startHourStart, dStart ? dStart.getUTCHours() : null) : '';
      const startHourFinishText = startHourFinishCol ? formatUnit(t.rowJSON?.startHourFinish, dFinish ? dFinish.getUTCHours() : null) : '';
      const planMinuteStartText = planMinuteStartCol ? formatUnit(t.rowJSON?.planMinuteStart, dStart ? dStart.getUTCMinutes() : null) : '';
      const planMinuteFinishText = planMinuteFinishCol ? formatUnit(t.rowJSON?.planMinuteFinish, dFinish ? dFinish.getUTCMinutes() : null) : '';
      const planSecondStartText = planSecondStartCol ? formatUnit(t.rowJSON?.planSecondStart, dStart ? dStart.getUTCSeconds() : null) : '';
      const planSecondFinishText = planSecondFinishCol ? formatUnit(t.rowJSON?.planSecondFinish, dFinish ? dFinish.getUTCSeconds() : null) : '';

      const startHourStartX = startHourStartCol ? startHourStartCol.x + startHourStartCol.w - 8 - measureSmall(startHourStartText) : 0;
      const startHourFinishX = startHourFinishCol ? startHourFinishCol.x + startHourFinishCol.w - 8 - measureSmall(startHourFinishText) : 0;
      const planMinuteStartX = planMinuteStartCol ? planMinuteStartCol.x + planMinuteStartCol.w - 8 - measureSmall(planMinuteStartText) : 0;
      const planMinuteFinishX = planMinuteFinishCol ? planMinuteFinishCol.x + planMinuteFinishCol.w - 8 - measureSmall(planMinuteFinishText) : 0;
      const planSecondStartX = planSecondStartCol ? planSecondStartCol.x + planSecondStartCol.w - 8 - measureSmall(planSecondStartText) : 0;
      const planSecondFinishX = planSecondFinishCol ? planSecondFinishCol.x + planSecondFinishCol.w - 8 - measureSmall(planSecondFinishText) : 0;

      let kanban: { text: string; color: string; bgColor: string; pillX: number; pillW: number; dotX: number; textX: number } | null = null;
      if (kanbanCol) {
        // null = kanbanNoState (the task is in no column)
        const stage = kanbanStageForRow(guid, tasksById, tree, kanbanStages, kanbanStates);
        const stageName = stage ? stage.rowJSON?.stageName || '—' : kanbanStages.length ? PM_KANBAN_NO_STATE_LABEL : 'None';
        const stageColor = stage ? kanbanStageColorOf(stage.rowJSON) : PM_KANBAN_NO_STATE_COLOR;
        const maxTextW = Math.max(10, kanbanCol.w - 28);
        const ellipsized = ellipsize(stageName, maxTextW, measureSmall);
        const textW = measureSmall(ellipsized);
        const pillW = Math.min(kanbanCol.w - 8, Math.max(28, textW + 18));
        const pillX = kanbanCol.x + 4;
        const dotX = pillX + 6;
        const textX = pillX + 16;
        const bgColor = withAlpha(stageColor, 0.16);
        kanban = { text: ellipsized, color: stageColor, bgColor, pillX, pillW, dotX, textX };
      }
      let kanbanProg = '';
      let kanbanProgX = 0;
      if (kanbanProgressCol) {
        const val = summary || hasChildren
          ? derivedKanbanProgress(guid, tasksById, tree, kanbanStates)
          : kanbanStageProgressOf(kanbanStates[guid], 0);
        kanbanProg = `${val}%`;
        kanbanProgX = kanbanProgressCol.x + kanbanProgressCol.w - 8 - measureSmall(kanbanProg);
      }
      const values = customCols.length ? taskCustomValuesOf(t.rowJSON) : {};
      const custom = customCols.map((c) => {
        const type = c.customType!;
        const v = values[c.key];
        if (type === 'boolean') return { key: c.key, text: '', x: 0, bool: v === true ? true : v === false ? false : null, boxX: c.x + (c.w - BOOL_BOX) / 2 };
        const text = ellipsize(formatCustomColumnValue(type, v), c.w - 14, measureSmall);
        const x = customColumnAlign(type) === 'right' ? c.x + c.w - 8 - measureSmall(text) : c.x + 8;
        return { key: c.key, text, x, bool: null, boxX: 0 };
      });
      out.push({
        guid,
        index: i,
        y: i * PM_ROW_HEIGHT,
        depth,
        summary,
        milestone: !!r?.isMilestone,
        hasChildren,
        isExpanded: expanded?.[guid] !== false,
        name: ellipsize(t.rowJSON?.name || '(untitled)', nameCol.x + nameCol.w - nameX - 6, measure),
        nameX,
        wbs: wbsCol ? ellipsize(tree.wbsById[guid] ?? '', wbsCol.w - 12, summary ? measureSmallBold : measureSmall) : '',
        start: startText,
        startHourStart: startHourStartText,
        startHourStartX,
        planMinuteStart: planMinuteStartText,
        planMinuteStartX,
        planSecondStart: planSecondStartText,
        planSecondStartX,
        finish: finishText,
        startHourFinish: startHourFinishText,
        startHourFinishX,
        planMinuteFinish: planMinuteFinishText,
        planMinuteFinishX,
        planSecondFinish: planSecondFinishText,
        planSecondFinishX,
        days: durationText,
        daysX: daysCol ? daysCol.x + daysCol.w - 8 - measureSmall(durationText) : 0,
        prog,
        progX: progCol ? progCol.x + progCol.w - 8 - measureSmall(prog) : 0,
        kanban,
        kanbanProg,
        kanbanProgX,
        critical: showCritical && !!r?.isCritical && !summary,
        color: taskColorOf(t.rowJSON),
        context: !!filterContext[guid],
        custom,
      });
    }
    return out;
  }, [win.firstRow, win.lastRow, visibleRows, tasksById, schedule, tree, expanded, fonts.regular, fonts.bold, fonts.small, fonts.smallBold, nameCol.x, nameCol.w, wbsCol, startCol, startHourStartCol, planMinuteStartCol, planSecondStartCol, finishCol, startHourFinishCol, planMinuteFinishCol, planSecondFinishCol, daysCol, progCol, kanbanCol, kanbanProgressCol, kanbanStages, kanbanStates, customCols, showCritical, filterContext, planDateInputFormat, planDay, planHour, planMinute, planSecond]);

  // one path for all chevrons, one for all horizontal row lines, one per Boolean cell state
  const { chevrons, rowLines, milestones, boolBoxes, boolChecked, boolMarks } = useMemo(() => {
    const chevronPath = Skia.Path.Make();
    const linesPath = Skia.Path.Make();
    const diamonds = Skia.Path.Make();
    const boxes = Skia.Path.Make();
    const checked = Skia.Path.Make();
    const marks = Skia.Path.Make();
    for (const r of rows) {
      const cy = r.y + PM_ROW_HEIGHT / 2;
      const x = nameCol.x + 8 + r.depth * PM_TREE_INDENT;
      if (r.hasChildren) {
        if (r.isExpanded) {
          chevronPath.moveTo(x + 2, cy - 2);
          chevronPath.lineTo(x + 10, cy - 2);
          chevronPath.lineTo(x + 6, cy + 3);
        } else {
          chevronPath.moveTo(x + 4, cy - 4);
          chevronPath.lineTo(x + 9, cy);
          chevronPath.lineTo(x + 4, cy + 4);
        }
        chevronPath.close();
      }
      if (r.milestone) {
        const ix = x + CHEVRON_W + 5;
        diamonds.moveTo(ix, cy - 5);
        diamonds.lineTo(ix + 5, cy);
        diamonds.lineTo(ix, cy + 5);
        diamonds.lineTo(ix - 5, cy);
        diamonds.close();
      }
      for (const c of r.custom) {
        if (!c.boxX) continue;
        const box = Skia.XYWHRect(c.boxX, cy - BOOL_BOX / 2, BOOL_BOX, BOOL_BOX);
        if (c.bool) {
          checked.addRRect(Skia.RRectXY(box, 2.5, 2.5));
          marks.moveTo(c.boxX + 2.5, cy);
          marks.lineTo(c.boxX + 5, cy + 2.8);
          marks.lineTo(c.boxX + 9.5, cy - 2.8);
        } else {
          boxes.addRRect(Skia.RRectXY(Skia.XYWHRect(c.boxX + 0.5, cy - BOOL_BOX / 2 + 0.5, BOOL_BOX - 1, BOOL_BOX - 1), 2.5, 2.5));
        }
      }
      linesPath.moveTo(0, r.y + PM_ROW_HEIGHT - 0.5);
      linesPath.lineTo(gridW, r.y + PM_ROW_HEIGHT - 0.5);
    }
    return { chevrons: chevronPath, rowLines: linesPath, milestones: diamonds, boolBoxes: boxes, boolChecked: checked, boolMarks: marks };
  }, [rows, gridW, nameCol.x]);

  // ---- UI-thread driven layers ---------------------------------------------------------
  const bodyTransform = useDerivedValue(() => [{ translateX: -treeScrollX.value }, { translateY: PM_SCALE_HEIGHT - scrollY.value }]);
  const hoverY = useDerivedValue(() => Math.max(0, hoverRow.value) * PM_ROW_HEIGHT);
  const hoverOpacity = useDerivedValue(() => (hoverRow.value >= 0 && dragging.value === 0 ? 1 : 0));
  // horizontal scroll bar
  const hbarW = maxSX > 0 ? Math.max(24, (width * width) / layout.contentWidth) : 0;
  const hbarX = useDerivedValue(() => (treeMaxScrollX.value > 0 ? (treeScrollX.value / treeMaxScrollX.value) * (width - hbarW) : 0), [width, hbarW]);

  const dragFrom = useSharedValue(-1);
  /** touch long-press row menu (onRightClickMenuMode): row + start point */
  const menuRow = useSharedValue(-1);
  const menuX = useSharedValue(0);
  const menuY = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dropSlot = useSharedValue(-1);
  const handleStartY = useSharedValue(0);
  const handleStartScroll = useSharedValue(0);
  const ghostOpacity = useDerivedValue(() => (dragFrom.value >= 0 ? 1 : 0));
  const dropLineY = useDerivedValue(() => Math.max(0, dropSlot.value) * PM_ROW_HEIGHT - 1);

  // ---- JS callbacks from gestures -------------------------------------------------------
  const canvasBoxRef = useRef<View>(null);
  const lastTipZone = useRef('');

  /** Which editable column is under content x (null = Task name / # column). */
  const cellFieldAt = useCallback((x: number): PMCellField | null => cellFieldOf(treeColumnAt(colsRef.current, x)), []);

  /** Stages are rolled up; milestones have no duration. Custom cells and Kanban are editable on every row. */
  const cellEditable = useCallback((guid: string, field: PMCellField) => {
    const s = usePMStore.getState();
    if (!s.tasksById[guid]) return false;
    if (field === 'kanban' || field === 'kanbanStageProgressPercent') return true;
    if (isCustomColumnKey(field)) return true;
    if (s.schedule[guid]?.isSummary || (s.tree.childrenById[guid]?.length ?? 0) > 0) return false;
    if ((field === 'taskDuration' || field === 'days') && s.tasksById[guid]?.rowJSON.rowKind === 'milestone') return false;
    if (
      (field === 'taskFinishDate' || field === 'startHourFinish' || field === 'planMinuteFinish' || field === 'planSecondFinish') &&
      s.tasksById[guid]?.rowJSON.rowKind === 'milestone'
    )
      return false;
    return true;
  }, []);

  /** Scrolls the tree horizontally so column `key` is fully visible. */
  const revealColumn = useCallback(
    (key: PMTreeColumnKey) => {
      const target = scrollXToRevealColumn(colsRef.current, key, treeScrollX.value);
      if (Math.abs(target - treeScrollX.value) > 0.5) treeScrollX.value = withTiming(target, { duration: 180 });
    },
    [treeScrollX]
  );

  /** Opens the inline editor (or toggles a Boolean) if (idx, content x) is an editable cell; true when it did. */
  const openCellEditor = useCallback(
    (idx: number, x: number) => {
      const s = usePMStore.getState();
      const guid = s.visibleRows[idx];
      const field = guid ? cellFieldAt(x) : null;
      if (!guid || !field) return false;
      s.setSelected(guid);
      if (!cellEditable(guid, field)) return true; // a cell, but read-only: just select
      hidePMTip();
      if (isCustomColumnKey(field)) {
        const def = s.customColumns.find((c) => c.key === field);
        if (!def) return true;
        if (def.type === 'boolean') {
          const cur = taskCustomValuesOf(s.tasksById[guid]?.rowJSON)[field];
          crud.setCustomColumnValue(guid, field, cur === true ? false : true);
          return true;
        }
      }
      revealColumn(field);
      s.setCellEdit({ guid, field });
      return true;
    },
    [cellFieldAt, cellEditable, crud, revealColumn]
  );

  /** Tip bubble at a VIEW point of the canvas. */
  const tipAt = useCallback((text: string, vx: number, vy: number) => {
    canvasBoxRef.current?.measureInWindow((wx, wy) => showPMTip(text, wx + vx - 1, wy + vy + 10, 2, 2, 450));
  }, []);

  /** Pointer moved: idx = row (-1 = none / header), x = CONTENT x, vx / y = view point. */
  const setHoveredIndex = useCallback((idx: number, x = -1, vx = -1, y = -1) => {
    const s = usePMStore.getState();
    const guid = idx >= 0 ? s.visibleRows[idx] ?? null : null;
    s.setHovered(guid);
    setTreeHoverGUID(guid);
    // tips for the canvas-drawn "icons": chevron + row drag handle + column headers
    let zone = '';
    const field = guid ? cellFieldAt(x) : null;
    // over a cell = inline edit (no panel) - unless the panel of this row is showing and the pointer is on it
    const sx = x - vx;
    const onPanel =
      !!guid &&
      panelShownFor.current === guid &&
      (() => {
        const box = placeTreeRowPanel(colsRef.current, !!s.schedule[guid]?.isSummary);
        return isOverTreeRowPanel({ left: treeRowPanelViewLeft(box.left, box.width, sx, colsRef.current.width), width: box.width }, vx);
      })();
    const inCells = !!field && !onPanel;
    panelShownFor.current = guid && !inCells ? guid : null;
    setHoverInCells(inCells);
    setHoverCellField(inCells ? field : null);
    const inHeader = !guid && y >= 0 && y < PM_SCALE_HEIGHT && x >= 0;
    const resizeKey = inHeader ? treeColumnResizeHandleAt(colsRef.current, x, RESIZE_GRAB) : null;
    const filterKey = inHeader && !resizeKey ? treeFilterIconAt(colsRef.current, x, y, RESIZE_GRAB) : null;
    const headerKey = inHeader && !resizeKey && !filterKey ? treeColumnAt(colsRef.current, x) : null;
    setHeaderCursor(resizeKey ? 'col-resize' : filterKey ? 'pointer' : headerKey ? 'grab' : '');
    if (resizeKey) zone = `resize:${resizeKey}`;
    else if (filterKey) zone = `filter:${filterKey}`;
    else if (headerKey) zone = `head:${headerKey}`;
    if (guid && x >= 0 && !onPanel) {
      const chevronX = chevronXAt(s.tree.depthById[guid] ?? 0);
      const hasKids = (s.tree.childrenById[guid]?.length ?? 0) > 0;
      if (inCells && field) zone = `cell:${field}:${guid}`;
      else if (hasKids && x >= chevronX - 4 && x <= chevronX + CHEVRON_W + 2) zone = `chev:${guid}`;
      else if (x < chevronX + CHEVRON_W + ICON_W + 4 && x > chevronX + CHEVRON_W) zone = `icon:${guid}`;
    }
    if (zone === lastTipZone.current) return;
    lastTipZone.current = zone;
    if (!zone || !canvasBoxRef.current) return hidePMTip();
    const custom = (k: string) => s.customColumns.find((c) => c.key === k);
    if (zone.startsWith('resize:')) {
      const k = zone.slice(7) as PMTreeColumnKey;
      const title = colsRef.current.byKey[k]?.title ?? '';
      return tipAt(`Drag to resize "${title}" · double-click = default width`, vx, y);
    }
    if (zone.startsWith('filter:')) {
      const k = zone.slice(7) as PMTreeColumnKey;
      const title = colsRef.current.byKey[k]?.title ?? '';
      const type = treeColumnDataType(k, s.customColumns);
      const f = s.treeColumnsFilters[k];
      const parts: string[] = [];
      if (f && type && isTreeColumnFilterActive(k, f, s.customColumns)) parts.push(`Filtered: ${describeTreeColumnFilter(f, type)}`);
      if (s.treeColumnSort?.key === k && type) parts.push(sortLabels(type)[s.treeColumnSort.direction].replace(/^Sort/, 'Sorted'));
      return tipAt(parts.length ? `${title} · ${parts.join(' · ')} · click to change` : `Filter & sort "${title}"`, vx, y);
    }
    if (zone.startsWith('head:')) {
      const k = zone.slice(5);
      const def = custom(k);
      const what = def ? `${def.name} (${PM_CUSTOM_COLUMN_TYPE_LABEL[def.type]} column) · ` : '';
      const move = colsRef.current.columns.length > 1 ? 'drag to move the column · ' : '';
      return tipAt(`${what}${move}${IS_WEB ? 'right-click' : 'long-press'} for column options (filter & sort, add a custom column…)`, vx, y);
    }
    const expandedNow = s.selectedProjectGUID ? s.expandedByProject[s.selectedProjectGUID]?.[guid!] !== false : true;
    const summary = !!s.schedule[guid!]?.isSummary;
    const kind = s.tasksById[guid!]?.rowJSON.rowKind;
    let tip: string;
    if (zone.startsWith('cell:')) {
      const f = zone.split(':').slice(1, -1).join(':') as PMCellField;
      const def = isCustomColumnKey(f) ? custom(f) : undefined;
      tip = def
        ? def.type === 'boolean'
          ? `Click to switch "${def.name}"`
          : `Click to edit "${def.name}" (${PM_CUSTOM_COLUMN_TYPE_LABEL[def.type]}${def.type === 'date' ? ', YYYY-MM-DD' : ''})`
        : f === 'kanban'
          ? 'Click to change Kanban stage'
          : f === 'kanbanStageProgressPercent'
          ? 'Click to change Kanban stage progress %'
          : cellEditable(guid!, f)
          ? f === 'taskStartDate' || f === 'start'
            ? `Click to set the start (${planDateInputFormat}, empty = as soon as possible)`
            : f === 'taskFinishDate'
              ? `Click to set the finish date (${planDateInputFormat})`
              : f === 'taskDuration' || f === 'days'
                ? 'Click to change the duration'
                : 'Click to change the progress %'
          : summary
            ? 'Rolled up from the rows inside this stage'
            : 'Milestones have no duration';
    } else {
      tip = zone.startsWith('chev')
        ? expandedNow ? 'Collapse' : 'Expand'
        : `${summary ? 'Stage' : kind === 'milestone' ? 'Milestone' : 'Task'} · drag the row by its name or by ⠿ on its panel to reorder / re-parent · double-click to edit`;
    }
    tipAt(tip, vx, y);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onTapRow = useCallback(
    (idx: number, x: number) => {
      const s = usePMStore.getState();
      const guid = s.visibleRows[idx];
      if (!guid) {
        s.setSelected(null);
        return;
      }
      const chevronX = chevronXAt(s.tree.depthById[guid] ?? 0);
      if ((s.tree.childrenById[guid]?.length ?? 0) > 0 && x >= chevronX - 4 && x <= chevronX + CHEVRON_W + 2) {
        s.toggleExpanded(guid);
        return;
      }
      if (s.linkSourceGUID && s.linkSourceGUID !== guid) {
        crud.link(s.linkSourceGUID, guid);
        return;
      }
      if (openCellEditor(idx, x)) return; // Start / Days / % / custom -> inline editor (Boolean: toggle)
      s.setSelected(guid);
    },
    [crud, openCellEditor] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onDoubleTapRow = useCallback(
    (idx: number, x: number) => {
      const field = cellFieldAt(x);
      if (field) {
        // a Boolean cell was already switched by the first click: a double-click must not switch it back and forth
        if (isCustomColumnKey(field)) return;
        if (openCellEditor(idx, x)) return;
      }
      const guid = usePMStore.getState().visibleRows[idx];
      if (guid) crud.edit(guid);
    },
    [crud, openCellEditor, cellFieldAt]
  );

  /** Double-click on a header separator = default width of the column on its left. */
  const onDoubleTapHeader = useCallback(
    (x: number) => {
      const key = treeColumnResizeHandleAt(colsRef.current, x, RESIZE_GRAB);
      if (key) crud.resetTreeColumnWidth(key);
    },
    [crud]
  );

  /** Opens the "Filter & sort" popup of a column, under its header (window coordinates). */
  const openColumnFilter = useCallback(
    (key: PMTreeColumnKey) => {
      hidePMTip();
      const c = colsRef.current.byKey[key];
      const box = canvasBoxRef.current;
      if (!c || !box) return;
      box.measureInWindow((wx, wy) => crud.openTreeColumnFilter(key, wx + Math.max(0, c.x - treeScrollX.value), wy + PM_SCALE_HEIGHT));
    },
    [crud, treeScrollX]
  );

  /** Tap on the header: the ▾ / funnel icon opens "Filter & sort" (the rest of the header = drag / resize / menu). */
  const onTapHeader = useCallback(
    (x: number, y: number) => {
      if (treeColumnResizeHandleAt(colsRef.current, x, RESIZE_GRAB)) return;
      const key = treeFilterIconAt(colsRef.current, x, y, RESIZE_GRAB);
      if (key) openColumnFilter(key);
    },
    [openColumnFilter]
  );

  /** Header context menu (window point); column under content x. */
  const openHeaderMenu = useCallback(
    (x: number, winX: number, winY: number) => {
      hidePMTip();
      usePMStore.getState().setCellEdit(null);
      crud.openTreeHeaderMenu(treeColumnAt(colsRef.current, x), winX, winY);
    },
    [crud]
  );

  const onDrop = useCallback(
    (from: number, slot: number) => {
      const s = usePMStore.getState();
      if (s.treeColumnSort) {
        // the tree order is the sort order now: a drop could not keep its place
        if (slot !== from && slot !== from + 1) {
          const title = colsRef.current.byKey[s.treeColumnSort.key]?.title ?? s.treeColumnSort.key;
          s.setError(`The tree is sorted by "${title}" - clear the sort (column ▾ -> Filter & sort) to reorder rows by drag & drop.`);
        }
        return;
      }
      crud.dropRow(from, slot);
    },
    [crud]
  );
  /** drag handle of the row panel: keep that row's panel mounted during the drag (idx -1 = drag ended) */
  const onHandleDrag = useCallback((idx: number) => {
    hidePMTip();
    setHandleDragGUID(idx >= 0 ? usePMStore.getState().visibleRows[idx] ?? null : null);
  }, []);

  /** onRightClickMenuMode: select the row and open PMTaskRowMenu at the window point */
  const openRowMenu = useCallback((idx: number, winX: number, winY: number) => {
    const s = usePMStore.getState();
    const guid = s.visibleRows[idx];
    if (!guid) return;
    hidePMTip();
    s.setSelected(guid);
    s.setRowMenu({ guid, x: winX, y: winY, source: 'tree' });
  }, []);

  // web: right-click on the header -> PMTreeHeaderMenu; on a row (onRightClickMenuMode) -> PMTaskRowMenu;
  // elsewhere the browser menu
  useEffect(() => {
    if (!IS_WEB) return;
    const el = canvasBoxRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const onContextMenu = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const y = e.clientY - r.top;
      if (y < 0) return;
      if (y >= PM_SCALE_HEIGHT) {
        // right-click a row = PMTaskRowMenu in both command modes (the hover panel has the same commands)
        const idx = Math.floor((y - PM_SCALE_HEIGHT + scrollY.value) / PM_ROW_HEIGHT);
        if (idx < 0 || idx >= usePMStore.getState().visibleRows.length) return;
        e.preventDefault();
        openRowMenu(idx, e.clientX, e.clientY);
        return;
      }
      e.preventDefault();
      openHeaderMenu(e.clientX - r.left + treeScrollX.value, e.clientX, e.clientY);
    };
    el.addEventListener('contextmenu', onContextMenu);
    return () => el.removeEventListener('contextmenu', onContextMenu);
  }, [openHeaderMenu, openRowMenu, rowMenuMode, scrollY, treeScrollX]);

  // ---- hover / selection CRUD panel ------------------------------------------------------
  // web: no hover panel while the pointer is over Start / Days / % / custom cells (inline edit there) -
  //      but once it shows, the pointer may move onto it even where it covers those columns
  // web: only while the pointer is over the tree - hovering a Gantt bar highlights the row but shows no tree panel
  const treeHovered = treeHoverGUID && treeHoverGUID === hoveredGUID ? treeHoverGUID : null;
  // onRightClickMenuMode: no panel - the same commands are in PMTaskRowMenu
  const panelGUID = handleDragGUID ?? (rowMenuMode || linkSourceGUID || cellEdit ? null : IS_WEB ? (hoverInCells ? null : treeHovered) : selectedGUID);
  const panelIndex = panelGUID ? rowIndexById[panelGUID] ?? -1 : -1;
  const panelIsSummary = panelGUID ? !!schedule[panelGUID]?.isSummary : false;
  // the panel takes the width its icons need (not only the Task name column)
  const panelBox = useMemo(() => placeTreeRowPanel(layout, panelIsSummary), [layout, panelIsSummary]);
  /** UI-thread copy of the panel box (content x): taps / drags on the panel must not reach the canvas */
  const panelRowSV = useSharedValue(-1);
  const panelLeftSV = useSharedValue(0);
  const panelWidthSV = useSharedValue(0);
  const paneWidthSV = useSharedValue(width);
  useEffect(() => {
    panelRowSV.value = panelIndex;
    panelLeftSV.value = panelBox.left;
    panelWidthSV.value = panelBox.width;
    paneWidthSV.value = width;
  }, [panelIndex, panelBox, width, panelRowSV, panelLeftSV, panelWidthSV, paneWidthSV]);

  // ---- column drag & drop + resize (header) -------------------------------------------------
  const onColumnDragStart = useCallback(() => {
    hidePMTip();
    usePMStore.getState().setCellEdit(null);
  }, []);
  const colDrag = useTreeColumnDragGesture(layout, crud.setTreeColumnsOrder, { dragging, onStart: onColumnDragStart, scrollX: treeScrollX, geometry });
  const onResizeCommit = useCallback(
    (key: PMTreeColumnKey, w: number) => {
      crud.setTreeColumnWidth(key, w);
      setLiveWidth(null);
    },
    [crud]
  );
  const onResizeLive = useCallback((key: PMTreeColumnKey, w: number) => setLiveWidth({ key, width: w }), []);
  const colResize = useTreeColumnResizeGesture(layout, geometry, {
    scrollX: treeScrollX,
    dragging,
    onStart: onColumnDragStart,
    onLive: onResizeLive,
    onCommit: onResizeCommit,
  });

  // ---- gestures -----------------------------------------------------------------------------
  /** content x ranges where a row can be grabbed for drag & drop (Task name + # columns, not the editable cells) */
  const rowDragRanges = useSharedValue<number[]>([]);
  const rowDragKey = layout.columns.filter((c) => !cellFieldOf(c.key)).map((c) => `${c.x},${c.x + c.w}`).join(';');
  useEffect(() => {
    rowDragRanges.value = colsRef.current.columns.filter((c) => !cellFieldOf(c.key)).flatMap((c) => [c.x, c.x + c.w]);
  }, [rowDragKey, rowDragRanges]);
  const canvasHSV = useSharedValue(canvasH);
  useEffect(() => {
    canvasHSV.value = canvasH;
  }, [canvasH, canvasHSV]);

  const bridge = kanbanBridge;
  const { gesture, handleGesture } = useMemo(() => {
    /** view x of the panel's left edge (it follows its column but stays inside the pane) */
    const onPanel = (idx: number, vx: number) => {
      'worklet';
      if (idx < 0 || panelRowSV.value !== idx) return false;
      const left = treeRowPanelViewLeft(panelLeftSV.value, panelWidthSV.value, treeScrollX.value, paneWidthSV.value);
      return vx >= left && vx <= left + panelWidthSV.value;
    };
    const inRowDragZone = (x: number) => {
      'worklet';
      const r = rowDragRanges.value;
      for (let i = 0; i + 1 < r.length; i += 2) if (x >= r[i] && x < r[i + 1]) return true;
      return false;
    };
    const rowAt = (y: number) => {
      'worklet';
      if (y < PM_SCALE_HEIGHT) return -1;
      const idx = Math.floor((y - PM_SCALE_HEIGHT + scrollY.value) / PM_ROW_HEIGHT);
      return idx >= 0 && idx < rowCount.value ? idx : -1;
    };
    const cx = (vx: number) => {
      'worklet';
      return vx + treeScrollX.value;
    };

    const hover = Gesture.Hover()
      .onBegin((e) => {
        'worklet';
        const idx = rowAt(e.y);
        if (idx !== hoverRow.value) {
          hoverRow.value = idx;
          runOnJS(setHoveredIndex)(idx, cx(e.x), e.x, e.y);
        }
      })
      .onUpdate((e) => {
        'worklet';
        const idx = rowAt(e.y);
        hoverRow.value = idx;
        // every move: the JS side de-duplicates, but needs x to switch chevron / row tips
        runOnJS(setHoveredIndex)(idx, cx(e.x), e.x, e.y);
      })
      .onEnd(() => {
        'worklet';
        hoverRow.value = -1;
        runOnJS(setHoveredIndex)(-1, -1, -1, -1);
      });

    const tap = Gesture.Tap()
      .maxDuration(450)
      .onEnd((e, ok) => {
        'worklet';
        if (!ok) return;
        if (e.y >= canvasHSV.value - HBAR_GRAB_H && treeMaxScrollX.value > 0) return; // on the scroll bar
        const idx = rowAt(e.y);
        if (onPanel(idx, e.x)) return; // on the hover panel (its buttons handle the press)
        if (e.y < PM_SCALE_HEIGHT) {
          runOnJS(onTapHeader)(cx(e.x), e.y); // header: the filter icon; the rest = drag / resize / menu
          return;
        }
        runOnJS(onTapRow)(idx, cx(e.x));
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e, ok) => {
        'worklet';
        if (!ok) return;
        if (e.y < PM_SCALE_HEIGHT) {
          runOnJS(onDoubleTapHeader)(cx(e.x));
          return;
        }
        const idx = rowAt(e.y);
        if (idx >= 0 && !onPanel(idx, e.x)) runOnJS(onDoubleTapRow)(idx, cx(e.x));
      });

    const reorder = Gesture.Pan()
      .minDistance(6)
      .onStart((e) => {
        'worklet';
        const idx = rowAt(e.y);
        // drag & drop only from the Task name / # columns (the cells are for inline editing)
        if (idx < 0 || !inRowDragZone(cx(e.x)) || onPanel(idx, e.x)) return;
        dragFrom.value = idx;
        dragging.value = 1;
        runOnJS(hidePMTip)();
        dragY.value = idx * PM_ROW_HEIGHT;
        dropSlot.value = idx;
      })
      .onChange((e) => {
        'worklet';
        if (dragFrom.value < 0) return;
        dragY.value += e.changeY;
        // Kanban: to the right of the tree the row is dragged onto the board (surface coords: canvas is below the toolbar)
        if (bridge && kanbanBridgeMove(bridge, e.x + PM_TREE_SELECT_WIDTH, e.y + TB, dragFrom.value)) return;
        const contentY = e.y - PM_SCALE_HEIGHT + scrollY.value;
        dropSlot.value = clampValue(Math.round(contentY / PM_ROW_HEIGHT), 0, rowCount.value);
      })
      .onEnd(() => {
        'worklet';
        if (dragFrom.value < 0) return;
        if (bridge && kanbanBridgeRelease(bridge, dragFrom.value)) return;
        runOnJS(onDrop)(dragFrom.value, dropSlot.value);
      })
      .onFinalize(() => {
        'worklet';
        dragFrom.value = -1;
        dropSlot.value = -1;
        dragging.value = 0;
        if (bridge) kanbanBridgeFinish(bridge);
      });
    if (!IS_WEB) reorder.activateAfterLongPress(350);

    const scroll = Gesture.Pan()
      .minDistance(4)
      .onChange((e) => {
        'worklet';
        scrollY.value = clampValue(scrollY.value - e.changeY, 0, maxScrollY(rowCount.value, bodyH.value));
        if (treeMaxScrollX.value > 0) treeScrollX.value = clampValue(treeScrollX.value - e.changeX, 0, treeMaxScrollX.value);
      })
      .onEnd((e) => {
        'worklet';
        scrollY.value = withDecay({ velocity: -e.velocityY, clamp: [0, maxScrollY(rowCount.value, bodyH.value)] });
        if (treeMaxScrollX.value > 0) treeScrollX.value = withDecay({ velocity: -e.velocityX, clamp: [0, treeMaxScrollX.value] });
      });

    /** drag the horizontal scroll bar (bottom band of the canvas) */
    const hbar = Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((e, m) => {
        'worklet';
        const t = e.allTouches[0];
        if (!t || treeMaxScrollX.value <= 0 || t.y < canvasHSV.value - HBAR_GRAB_H) m.fail();
      })
      .onTouchesMove((_e, m) => {
        'worklet';
        m.activate();
      })
      .onChange((e) => {
        'worklet';
        const pane = paneWidthSV.value;
        const content = pane + treeMaxScrollX.value;
        treeScrollX.value = clampValue(treeScrollX.value + (e.changeX * content) / Math.max(1, pane), 0, treeMaxScrollX.value);
      });

    /** touch: long-press a header = column menu (web: right-click, see the contextmenu listener) */
    const headerMenu = Gesture.LongPress()
      .minDuration(450)
      .onTouchesDown((e, m) => {
        'worklet';
        const t = e.allTouches[0];
        if (!t || t.y >= PM_SCALE_HEIGHT) m.fail();
      })
      .onStart((e) => {
        'worklet';
        runOnJS(openHeaderMenu)(cx(e.x), e.absoluteX, e.absoluteY);
      });

    /** touch + onRightClickMenuMode: long-press a row and release without moving = PMTaskRowMenu
     *  (long-press and drag still reorders the row) */
    const rowMenu = Gesture.LongPress()
      .enabled(!IS_WEB)
      .minDuration(450)
      .maxDistance(12)
      .onTouchesDown((e, m) => {
        'worklet';
        const t = e.allTouches[0];
        if (!t || t.y < PM_SCALE_HEIGHT) m.fail();
      })
      .onStart((e) => {
        'worklet';
        menuRow.value = rowAt(e.y);
        menuX.value = e.x;
        menuY.value = e.y;
      })
      .onEnd((e, ok) => {
        'worklet';
        const idx = menuRow.value;
        menuRow.value = -1;
        if (!ok || idx < 0 || dragging.value !== 0) return;
        if (Math.abs(e.x - menuX.value) + Math.abs(e.y - menuY.value) > 12) return; // it became a drag
        runOnJS(openRowMenu)(idx, e.absoluteX, e.absoluteY);
      });

    /** the panel's drag handle (last panel button): drag the panel's row */
    const handle = Gesture.Pan()
      .minDistance(1)
      .onStart(() => {
        'worklet';
        const idx = panelRowSV.value;
        if (idx < 0) return;
        dragFrom.value = idx;
        dragging.value = 1;
        dragY.value = idx * PM_ROW_HEIGHT;
        dropSlot.value = idx;
        handleStartY.value = idx * PM_ROW_HEIGHT + PM_ROW_HEIGHT / 2;
        handleStartScroll.value = scrollY.value;
        runOnJS(onHandleDrag)(idx);
      })
      .onChange((e) => {
        'worklet';
        if (dragFrom.value < 0) return;
        dragY.value += e.changeY;
        if (bridge) {
          // the handle is the panel's last button: its surface point + the finger's translation
          const handleX = PM_TREE_SELECT_WIDTH + treeRowPanelViewLeft(panelLeftSV.value, panelWidthSV.value, treeScrollX.value, paneWidthSV.value) + panelWidthSV.value - 14;
          const handleY = TB + PM_SCALE_HEIGHT + handleStartY.value - handleStartScroll.value;
          if (kanbanBridgeMove(bridge, handleX + e.translationX, handleY + e.translationY, dragFrom.value)) return;
        }
        const contentY = handleStartY.value + e.translationY + (scrollY.value - handleStartScroll.value);
        dropSlot.value = clampValue(Math.round(contentY / PM_ROW_HEIGHT), 0, rowCount.value);
      })
      .onEnd(() => {
        'worklet';
        if (dragFrom.value < 0) return;
        if (bridge && kanbanBridgeRelease(bridge, dragFrom.value)) return;
        runOnJS(onDrop)(dragFrom.value, dropSlot.value);
      })
      .onFinalize(() => {
        'worklet';
        dragFrom.value = -1;
        dropSlot.value = -1;
        dragging.value = 0;
        runOnJS(onHandleDrag)(-1);
        if (bridge) kanbanBridgeFinish(bridge);
      });

    // web: mouse-drag = reorder (wheel scrolls); touch: long-press-drag = reorder, drag = scroll
    const pans = IS_WEB ? reorder : Gesture.Exclusive(reorder, scroll);
    // header first: resize (fails at once away from a separator) > long-press menu (touch) > column drag;
    // they all fail at once outside the header, so rows are not delayed
    const header = IS_WEB
      ? Gesture.Exclusive(hbar, colResize.gesture, colDrag.gesture)
      : Gesture.Exclusive(hbar, colResize.gesture, headerMenu, colDrag.gesture);
    // the drag handle wins over every canvas gesture that the same touch starts
    if (IS_WEB) handle.blocksExternalGesture(reorder, tap, doubleTap);
    else handle.blocksExternalGesture(reorder, scroll, tap, doubleTap);
    return {
      gesture: Gesture.Simultaneous(hover, rowMenu, Gesture.Race(Gesture.Exclusive(header, pans), Gesture.Exclusive(doubleTap, tap))),
      handleGesture: handle,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollY, rowCount, hoverRow, bodyH, dragging, dragFrom, dragY, dropSlot, panelRowSV, panelLeftSV, panelWidthSV, paneWidthSV, rowDragRanges, treeScrollX, treeMaxScrollX, canvasHSV, colDrag.gesture, colResize.gesture, setHoveredIndex, onTapRow, onDoubleTapRow, onDoubleTapHeader, onTapHeader, openHeaderMenu, onDrop, onHandleDrag, rowMenuMode, openRowMenu, menuRow, menuX, menuY, bridge, TB]);

  // ---- multi selection column (round check boxes): rows follow the vertical scroll on the UI thread ----
  const selectRowsStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -scrollY.value }] }));
  const checkedCount = useMemo(() => Object.keys(checkedGUIDs).length, [checkedGUIDs]);
  const allChecked = visibleRows.length > 0 && visibleRows.every((g) => checkedGUIDs[g]);
  const toggleAllChecked = useCallback(() => {
    const s = usePMStore.getState();
    const all = s.visibleRows.length > 0 && s.visibleRows.every((g) => s.checkedGUIDs[g]);
    if (all || (Object.keys(s.checkedGUIDs).length > 0 && !s.visibleRows.some((g) => !s.checkedGUIDs[g]))) s.clearChecked();
    else s.setChecked(s.visibleRows, true);
  }, []);
  const selectScroll = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .onChange((e) => {
          'worklet';
          scrollY.value = clampValue(scrollY.value - e.changeY, 0, maxScrollY(rowCount.value, bodyH.value));
        }),
    [scrollY, rowCount, bodyH]
  );

  // "Share screenshot": html2canvas cannot read a Skia (WebGL) canvas back - give it a snapshot
  useEffect(() => {
    if (!IS_WEB) return;
    return registerScreenshotCanvas('pm-tree', { element: () => canvasBoxRef.current, snapshot: () => skiaCanvasSnapshotBase64(skiaRef) });
  }, [skiaRef]);

  const panelStyle = useAnimatedStyle(() => {
    const top = PM_SCALE_HEIGHT + panelIndex * PM_ROW_HEIGHT - scrollY.value;
    const visible = panelIndex >= 0 && dragging.value === 0 && top >= PM_SCALE_HEIGHT - 2 && top + PM_ROW_HEIGHT <= bodyH.value + PM_SCALE_HEIGHT + 2;
    const left = treeRowPanelViewLeft(panelLeftSV.value, panelWidthSV.value, treeScrollX.value, paneWidthSV.value);
    return { opacity: visible ? 1 : 0, transform: [{ translateX: left }, { translateY: top + 4 }] };
  }, [panelIndex]);
  const editorLayerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -treeScrollX.value }] }));
  const panelRow = panelGUID ? tasksById[panelGUID] : undefined;

  const selectedIndex = selectedGUID ? rowIndexById[selectedGUID] ?? -1 : -1;
  const linkIndex = linkSourceGUID ? rowIndexById[linkSourceGUID] ?? -1 : -1;
  const cursor = headerCursor || (hoverCellField === 'kanban' ? 'pointer' : hoverInCells ? 'text' : 'default');

  return (
    <View style={{ width: paneWidth, height, backgroundColor: palette.surface }}>
      {/* ---- container CRUD panel ---- */}
      {!hideToolbar && <PMTreeToolbar crud={crud} palette={palette} />}

      <View style={{ flexDirection: 'row', width: paneWidth, height: canvasH }}>
      {/* ---- multi selection: round check box = FIRST column (stages and tasks) ---- */}
      <GestureDetector gesture={selectScroll}>
        <View testID="pm-tree-select-column" style={{ width: PM_TREE_SELECT_WIDTH, height: canvasH, overflow: 'hidden', borderRightWidth: StyleSheet.hairlineWidth, borderColor: palette.border }}>
          <View style={{ position: 'absolute', left: 0, top: PM_SCALE_HEIGHT, width: PM_TREE_SELECT_WIDTH, height: Math.max(0, canvasH - PM_SCALE_HEIGHT), overflow: 'hidden' }}>
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: PM_TREE_SELECT_WIDTH }, selectRowsStyle]}>
              {rows.map((r) => (
                <Pressable
                  key={r.guid}
                  testID={`pm-tree-check-${r.guid}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!checkedGUIDs[r.guid] }}
                  accessibilityLabel={`Select ${r.name}`}
                  onPress={() => usePMStore.getState().toggleChecked(r.guid)}
                  style={{ position: 'absolute', left: 0, top: r.y, width: PM_TREE_SELECT_WIDTH, height: PM_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', backgroundColor: checkedGUIDs[r.guid] ? palette.selected : 'transparent' }}
                >
                  <RoundCheck checked={!!checkedGUIDs[r.guid]} color={palette.primary} muted={palette.textMuted} />
                </Pressable>
              ))}
            </Animated.View>
          </View>
          <Pressable
            testID="pm-tree-check-all"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allChecked }}
            accessibilityLabel={checkedCount ? `Clear the selection (${checkedCount})` : 'Select all rows'}
            onPress={toggleAllChecked}
            style={{ height: PM_SCALE_HEIGHT, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.header, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border }}
          >
            <RoundCheck checked={allChecked} partial={checkedCount > 0} color={palette.primary} muted={palette.textMuted} />
          </Pressable>
        </View>
      </GestureDetector>
      <GestureDetector gesture={gesture}>
        <View
          ref={canvasBoxRef}
          style={[{ width, height: canvasH, overflow: 'hidden' }, IS_WEB ? ({ cursor } as any) : null]}
          collapsable={false}
        >
          <Canvas ref={skiaRef} style={{ width, height: canvasH }}>
            <Rect x={0} y={0} width={width} height={canvasH} color={palette.surface} />

            {/* ---- rows (virtualized, translated on the UI thread) ---- */}
            <Group clip={rect(0, PM_SCALE_HEIGHT, width, Math.max(0, canvasH - PM_SCALE_HEIGHT))}>
              <Group transform={bodyTransform}>
                {selectedIndex >= 0 && <Rect x={0} y={selectedIndex * PM_ROW_HEIGHT} width={gridW} height={PM_ROW_HEIGHT} color={palette.selected} />}
                {linkIndex >= 0 && <Rect x={0} y={linkIndex * PM_ROW_HEIGHT} width={3} height={PM_ROW_HEIGHT} color={palette.linkActive} />}
                <Rect x={0} y={hoverY} width={gridW} height={PM_ROW_HEIGHT} color={palette.hover} opacity={hoverOpacity} />
                <Path path={rowLines} style="stroke" strokeWidth={1} color={palette.grid} />
                <Path path={chevrons} color={palette.textMuted} />
                <Path path={milestones} color={palette.milestone} />
                <Path path={boolBoxes} style="stroke" strokeWidth={1.2} color={palette.textMuted} />
                <Path path={boolChecked} color={palette.primary} />
                <Path path={boolMarks} style="stroke" strokeWidth={1.8} strokeCap="round" strokeJoin="round" color={palette.surface} />
                {rows.map((r) => {
                  const cy = r.y + PM_ROW_HEIGHT / 2;
                  const iconX = nameCol.x + 8 + r.depth * PM_TREE_INDENT + CHEVRON_W;
                  const base = cy + 4;
                  return (
                    <Group key={r.guid}>
                      {r.summary ? (
                        <RoundedRect x={iconX} y={cy - 5} width={11} height={10} r={2} color={palette.summary} />
                      ) : !r.milestone ? (
                        <RoundedRect x={iconX} y={cy - 3} width={11} height={6} r={3} color={r.color || (r.critical ? palette.critical : palette.bar)} />
                      ) : null}
                      {fonts.ready && (
                        <>
                          <SkText x={r.nameX} y={base} text={r.name} font={r.summary ? fonts.bold : fonts.regular} color={r.context ? palette.textMuted : palette.text} opacity={r.context ? 0.7 : 1} />
                          {wbsCol && <SkText x={wbsCol.x + 8} y={base} text={r.wbs} font={r.summary ? fonts.smallBold : fonts.small} color={palette.textMuted} />}
                          {startCol && <SkText x={startCol.x + 8} y={base} text={r.start} font={fonts.small} color={palette.textMuted} />}
                          {startHourStartCol && <SkText x={r.startHourStartX} y={base} text={r.startHourStart} font={fonts.small} color={palette.textMuted} />}
                          {planMinuteStartCol && <SkText x={r.planMinuteStartX} y={base} text={r.planMinuteStart} font={fonts.small} color={palette.textMuted} />}
                          {planSecondStartCol && <SkText x={r.planSecondStartX} y={base} text={r.planSecondStart} font={fonts.small} color={palette.textMuted} />}
                          {finishCol && <SkText x={finishCol.x + 8} y={base} text={r.finish} font={fonts.small} color={palette.textMuted} />}
                          {startHourFinishCol && <SkText x={r.startHourFinishX} y={base} text={r.startHourFinish} font={fonts.small} color={palette.textMuted} />}
                          {planMinuteFinishCol && <SkText x={r.planMinuteFinishX} y={base} text={r.planMinuteFinish} font={fonts.small} color={palette.textMuted} />}
                          {planSecondFinishCol && <SkText x={r.planSecondFinishX} y={base} text={r.planSecondFinish} font={fonts.small} color={palette.textMuted} />}
                          {daysCol && <SkText x={r.daysX} y={base} text={r.days} font={fonts.small} color={palette.textMuted} />}
                          {progCol && <SkText x={r.progX} y={base} text={r.prog} font={fonts.small} color={palette.textMuted} />}
                          {r.kanban && (
                            <>
                              <RoundedRect
                                x={r.kanban.pillX}
                                y={cy - 9}
                                width={r.kanban.pillW}
                                height={18}
                                r={4}
                                color={r.kanban.bgColor}
                              />
                              <RoundedRect
                                x={r.kanban.dotX}
                                y={cy - 3}
                                width={6}
                                height={6}
                                r={3}
                                color={r.kanban.color}
                              />
                              <SkText
                                x={r.kanban.textX}
                                y={base}
                                text={r.kanban.text}
                                font={r.summary ? fonts.smallBold : fonts.small}
                                color={r.context ? palette.textMuted : palette.text}
                              />
                            </>
                          )}
                          {kanbanProgressCol && <SkText x={r.kanbanProgX} y={base} text={r.kanbanProg} font={fonts.small} color={palette.textMuted} />}
                          {r.custom.map((c) => (c.text ? <SkText key={c.key} x={c.x} y={base} text={c.text} font={fonts.small} color={palette.text} /> : null))}
                        </>
                      )}
                    </Group>
                  );
                })}
                {/* drag-to-reorder feedback */}
                <Rect x={0} y={dragY} width={gridW} height={PM_ROW_HEIGHT} color={palette.ghost} opacity={ghostOpacity} />
                <Rect x={0} y={dropLineY} width={gridW} height={2} color={palette.primary} opacity={ghostOpacity} />
              </Group>
            </Group>

            {/* ---- column grid + header (saved order / widths / colors) + column drag & resize feedback ---- */}
            <PMTreeColumnsHeader
              layout={layout}
              palette={palette}
              font={fonts.ready ? fonts.smallBold : null}
              height={canvasH}
              drag={colDrag}
              resize={colResize}
              geometry={geometry}
              scrollX={treeScrollX}
              headerColors={headerColors}
              filteredKeys={filteredKeys}
              sort={columnSort}
              filterIconColor={filterIconColor}
            />

            {/* ---- horizontal scroll bar (columns wider than the pane) ---- */}
            {hbarW > 0 && (
              <>
                <Rect x={0} y={canvasH - HBAR_H - 2} width={width} height={HBAR_H + 2} color={palette.surface} opacity={0.85} />
                <RoundedRect x={hbarX} y={canvasH - HBAR_H - 1} width={hbarW} height={HBAR_H} r={HBAR_H / 2} color={palette.gridStrong} />
              </>
            )}
          </Canvas>

          {/* ---- inline cell editors (Start / Days / % / custom), in content x -> follow the horizontal scroll ---- */}
          {cellEdit && rowIndexById[cellEdit.guid] !== undefined && (
            <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' } as any, editorLayerStyle]}>
              <PMInlineCellEditor
                field={cellEdit.field}
                guid={cellEdit.guid}
                rowIndex={rowIndexById[cellEdit.guid]}
                cols={layout}
                scrollY={scrollY}
                crud={crud}
                colors={{ text: palette.text, background: palette.surface, primary: palette.primary, error: palette.error }}
              />
            </Animated.View>
          )}

          {/* ---- row CRUD panel (hover on web, selection on touch); last button = drag handle ---- */}
          {panelRow && (
            <PMTreeRowHoverPanel
              guid={panelRow.rowGUID}
              isSummary={panelIsSummary}
              crud={crud}
              palette={palette}
              width={panelBox.width}
              left={0}
              animatedStyle={panelStyle}
              dragGesture={handleGesture}
            />
          )}
        </View>
      </GestureDetector>
      </View>
    </View>
  );
}
