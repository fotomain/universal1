// Left pane: the task tree (grid) drawn entirely with Skia - rows, indentation,
// chevrons, kind icons, #(hierarchy number)/name/start/days/% columns - on the SAME virtual scroll value as
// the chart, so tree rows and Gantt bars are pixel-locked (no second ScrollView to sync).
//
// Columns (tree/columns)  = "#" first by default (uxuiSettings.showTreeHierarchyNumbers switches it),
//                           drag a column header to move the column (uxuiSettings.treeColumnsOrder).
// Container CRUD panel    = the toolbar above the canvas.
// Row CRUD panel          = the hover panel (web: on hover, touch: on the selected row); it takes the
//                           width its icons need (tree/panels/treeRowPanelGeometry): ends at the Task name
//                           column's right edge and grows over the neighbouring columns when needed.
// Inline cell edit        = click / tap Start, Days or % -> EditTaskStart / EditTaskDays /
//                           EditTaskProgress; drag & drop of rows works on the Task name and # columns.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Canvas, Group, Path, Rect, RoundedRect, Skia, Text as SkText, rect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withDecay } from 'react-native-reanimated';
import { PM_ROW_HEIGHT, PM_SCALE_HEIGHT, PM_TOOLBAR_HEIGHT, PM_TREE_INDENT } from '../constants';
import { usePMStore } from '../store';
import { formatDateShort } from '../scheduling';
import { ellipsize, PMPalette } from '../theme';
import { makeMeasure, usePMFonts } from '../skia/usePMFonts';
import { clampValue, maxScrollY, PMViewport } from '../useGanttViewport';
import { PMCrud } from '../usePMCrud';
import PMTreeRowHoverPanel from './panels/PMTreeRowHoverPanel';
import PMTreeToolbar from './toolbars/PMTreeToolbar';
import { hidePMTip, showPMTip } from '../PMTooltip';
import { PMCellField } from '../store';
import { taskColorOf } from '../types';
import PMInlineCellEditor from './inline/PMInlineCellEditor';
import { PMTreeColumnKey, treeColumnAt } from './columns/treeColumns';
import { useTreeColumnsLayout } from './columns/useTreeColumnsLayout';
import { useTreeColumnDragGesture } from './columns/useTreeColumnDragGesture';
import PMTreeColumnsHeader from './columns/PMTreeColumnsHeader';
import { isOverTreeRowPanel, placeTreeRowPanel } from './panels/treeRowPanelGeometry';

const IS_WEB = Platform.OS === 'web';
const CHEVRON_W = 16;
const ICON_W = 16;

/** Editable cell of a column (null = Task name / # column). */
const cellFieldOf = (key: PMTreeColumnKey | null): PMCellField | null =>
  key === 'start' || key === 'days' || key === 'progress' ? key : null;

interface Props {
  viewport: PMViewport;
  width: number;
  height: number; // whole pane incl. toolbar
  palette: PMPalette;
  crud: PMCrud;
}

export default function PMProjectTasksTree({ viewport, width, height, palette, crud }: Props) {
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

  const canvasH = Math.max(0, height - PM_TOOLBAR_HEIGHT);
  // grid columns (tree/columns): saved order, "#" switch, responsive hiding on narrow panes
  const layout = useTreeColumnsLayout(width);
  const nameCol = layout.byKey.name ?? { key: 'name' as const, title: '', x: 0, w: width };
  const wbsCol = layout.byKey.wbs;
  const startCol = layout.byKey.start;
  const daysCol = layout.byKey.days;
  const progCol = layout.byKey.progress;
  const { scrollY, hoverRow, rowCount, bodyH, dragging, win } = viewport;
  const colsRef = useRef(layout);
  colsRef.current = layout;
  /** left x of the tree structure (chevron) of a row at `depth` */
  const chevronXAt = useCallback((depth: number) => (colsRef.current.byKey.name?.x ?? 0) + 8 + depth * PM_TREE_INDENT, []);
  const [hoverInCells, setHoverInCells] = useState(false);
  const [hoverInHeader, setHoverInHeader] = useState(false);
  /** row whose hover panel is showing (web) - the pointer may move over the panel without hiding it */
  const panelShownFor = useRef<string | null>(null);
  /** row under the pointer while the pointer is over THIS tree (the chart also sets store.hoveredGUID) */
  const [treeHoverGUID, setTreeHoverGUID] = useState<string | null>(null);

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
      days: string;
      daysX: number;
      prog: string;
      progX: number;
      critical: boolean;
      color: string | null;
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
      const days = r ? (r.isMilestone ? '◆' : String(r.durationDays)) : '';
      const prog = r ? `${Math.round(r.progress)}%` : '';
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
        start: r ? formatDateShort(r.startMs) : '',
        days,
        daysX: daysCol ? daysCol.x + daysCol.w - 8 - measureSmall(days) : 0,
        prog,
        progX: progCol ? progCol.x + progCol.w - 8 - measureSmall(prog) : 0,
        critical: showCritical && !!r?.isCritical && !summary,
        color: taskColorOf(t.rowJSON),
      });
    }
    return out;
  }, [win.firstRow, win.lastRow, visibleRows, tasksById, schedule, tree, expanded, fonts.regular, fonts.bold, fonts.small, fonts.smallBold, nameCol.x, nameCol.w, wbsCol, daysCol, progCol, showCritical]);

  // one path for all chevrons, one for all horizontal row lines
  const { chevrons, rowLines, milestones } = useMemo(() => {
    const chevronPath = Skia.Path.Make();
    const linesPath = Skia.Path.Make();
    const diamonds = Skia.Path.Make();
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
      linesPath.moveTo(0, r.y + PM_ROW_HEIGHT - 0.5);
      linesPath.lineTo(width, r.y + PM_ROW_HEIGHT - 0.5);
    }
    return { chevrons: chevronPath, rowLines: linesPath, milestones: diamonds };
  }, [rows, width, nameCol.x]);

  // ---- UI-thread driven layers ---------------------------------------------------------
  const bodyTransform = useDerivedValue(() => [{ translateY: PM_SCALE_HEIGHT - scrollY.value }]);
  const hoverY = useDerivedValue(() => Math.max(0, hoverRow.value) * PM_ROW_HEIGHT);
  const hoverOpacity = useDerivedValue(() => (hoverRow.value >= 0 && dragging.value === 0 ? 1 : 0));

  const dragFrom = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const dropSlot = useSharedValue(-1);
  const ghostOpacity = useDerivedValue(() => (dragFrom.value >= 0 ? 1 : 0));
  const dropLineY = useDerivedValue(() => Math.max(0, dropSlot.value) * PM_ROW_HEIGHT - 1);

  // ---- JS callbacks from gestures -------------------------------------------------------
  const canvasBoxRef = useRef<View>(null);
  const lastTipZone = useRef('');

  /** Which editable column is under canvas x (null = Task name / # column). */
  const cellFieldAt = useCallback((x: number): PMCellField | null => cellFieldOf(treeColumnAt(colsRef.current, x)), []);

  /** Stages are rolled up; milestones have no duration. */
  const cellEditable = useCallback((guid: string, field: PMCellField) => {
    const s = usePMStore.getState();
    if (s.schedule[guid]?.isSummary || (s.tree.childrenById[guid]?.length ?? 0) > 0) return false;
    if (field === 'days' && s.tasksById[guid]?.rowJSON.rowKind === 'milestone') return false;
    return !!s.tasksById[guid];
  }, []);

  /** Opens the inline editor if (idx, x) is an editable cell; returns true when it did. */
  const openCellEditor = useCallback(
    (idx: number, x: number) => {
      const s = usePMStore.getState();
      const guid = s.visibleRows[idx];
      const field = guid ? cellFieldAt(x) : null;
      if (!guid || !field) return false;
      s.setSelected(guid);
      if (!cellEditable(guid, field)) return true; // a cell, but read-only: just select
      hidePMTip();
      s.setCellEdit({ guid, field });
      return true;
    },
    [cellFieldAt, cellEditable]
  );
  const setHoveredIndex = useCallback((idx: number, x = -1, y = -1) => {
    const s = usePMStore.getState();
    const guid = idx >= 0 ? s.visibleRows[idx] ?? null : null;
    s.setHovered(guid);
    setTreeHoverGUID(guid);
    // tips for the canvas-drawn "icons": chevron + row drag handle + column headers
    let zone = '';
    const field = guid ? cellFieldAt(x) : null;
    // over a cell = inline edit (no panel) - unless the panel of this row is showing and the pointer is on it
    const onPanel =
      !!guid && panelShownFor.current === guid && isOverTreeRowPanel(placeTreeRowPanel(colsRef.current, !!s.schedule[guid]?.isSummary), x);
    const inCells = !!field && !onPanel;
    panelShownFor.current = guid && !inCells ? guid : null;
    setHoverInCells(inCells);
    const headerKey = !guid && y >= 0 && y < PM_SCALE_HEIGHT && x >= 0 ? treeColumnAt(colsRef.current, x) : null;
    setHoverInHeader(!!headerKey && colsRef.current.columns.length > 1);
    if (headerKey && colsRef.current.columns.length > 1) zone = `head:${headerKey}`;
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
    if (zone.startsWith('head:')) {
      const headTip = 'Drag the column header to move the column';
      canvasBoxRef.current.measureInWindow((wx, wy) => showPMTip(headTip, wx + x - 1, wy + y + 10, 2, 2, 450));
      return;
    }
    const expandedNow = s.selectedProjectGUID ? s.expandedByProject[s.selectedProjectGUID]?.[guid!] !== false : true;
    const summary = !!s.schedule[guid!]?.isSummary;
    const kind = s.tasksById[guid!]?.rowJSON.rowKind;
    let tip: string;
    if (zone.startsWith('cell:')) {
      const field = zone.split(':')[1] as PMCellField;
      tip = cellEditable(guid!, field)
        ? field === 'start'
          ? 'Click to set the start (YYYY-MM-DD, empty = as soon as possible)'
          : field === 'days'
            ? 'Click to change the duration (working days)'
            : 'Click to change the progress %'
        : summary
          ? 'Rolled up from the rows inside this stage'
          : 'Milestones have no duration';
    } else {
      tip = zone.startsWith('chev')
        ? expandedNow ? 'Collapse' : 'Expand'
        : `${summary ? 'Stage' : kind === 'milestone' ? 'Milestone' : 'Task'} · drag the row by its name to reorder / re-parent · double-click to edit`;
    }
    canvasBoxRef.current.measureInWindow((wx, wy) => showPMTip(tip, wx + x - 1, wy + y + 10, 2, 2, 450));
  }, []);

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
      if (openCellEditor(idx, x)) return; // Start / Days / % -> inline editor
      s.setSelected(guid);
    },
    [crud, openCellEditor]
  );

  const onDoubleTapRow = useCallback(
    (idx: number, x: number) => {
      if (cellFieldAt(x) && openCellEditor(idx, x)) return;
      const guid = usePMStore.getState().visibleRows[idx];
      if (guid) crud.edit(guid);
    },
    [crud, openCellEditor, cellFieldAt]
  );

  const onDrop = useCallback((from: number, slot: number) => crud.dropRow(from, slot), [crud]);

  // ---- hover / selection CRUD panel ------------------------------------------------------
  // web: no hover panel while the pointer is over Start / Days / % (inline edit there) - but once it
  //      shows, the pointer may move onto it even where it covers those columns
  // web: only while the pointer is over the tree - hovering a Gantt bar highlights the row but shows no tree panel
  const treeHovered = treeHoverGUID && treeHoverGUID === hoveredGUID ? treeHoverGUID : null;
  const panelGUID = linkSourceGUID || cellEdit ? null : IS_WEB ? (hoverInCells ? null : treeHovered) : selectedGUID;
  const panelIndex = panelGUID ? rowIndexById[panelGUID] ?? -1 : -1;
  const panelIsSummary = panelGUID ? !!schedule[panelGUID]?.isSummary : false;
  // the panel takes the width its icons need (not only the Task name column)
  const panelBox = useMemo(() => placeTreeRowPanel(layout, panelIsSummary), [layout, panelIsSummary]);
  /** UI-thread copy of the panel box: taps / drags on the panel must not reach the canvas */
  const panelRowSV = useSharedValue(-1);
  const panelLeftSV = useSharedValue(0);
  const panelRightSV = useSharedValue(0);
  useEffect(() => {
    panelRowSV.value = panelIndex;
    panelLeftSV.value = panelBox.left;
    panelRightSV.value = panelBox.left + panelBox.width;
  }, [panelIndex, panelBox, panelRowSV, panelLeftSV, panelRightSV]);

  // ---- column drag & drop (header) ---------------------------------------------------------
  const onColumnDragStart = useCallback(() => {
    hidePMTip();
    usePMStore.getState().setCellEdit(null);
  }, []);
  const colDrag = useTreeColumnDragGesture(layout, crud.setTreeColumnsOrder, { dragging, onStart: onColumnDragStart });

  // ---- gestures -----------------------------------------------------------------------------
  /** x ranges where a row can be grabbed for drag & drop (Task name + # columns, not the editable cells) */
  const rowDragRanges = layout.columns.filter((c) => !cellFieldOf(c.key)).flatMap((c) => [c.x, c.x + c.w]);
  const rowDragKey = rowDragRanges.join(',');
  const gesture = useMemo(() => {
    const onPanel = (idx: number, x: number) => {
      'worklet';
      return idx >= 0 && panelRowSV.value === idx && x >= panelLeftSV.value && x <= panelRightSV.value;
    };
    const inRowDragZone = (x: number) => {
      'worklet';
      for (let i = 0; i + 1 < rowDragRanges.length; i += 2) if (x >= rowDragRanges[i] && x < rowDragRanges[i + 1]) return true;
      return false;
    };
    const rowAt = (y: number) => {
      'worklet';
      if (y < PM_SCALE_HEIGHT) return -1;
      const idx = Math.floor((y - PM_SCALE_HEIGHT + scrollY.value) / PM_ROW_HEIGHT);
      return idx >= 0 && idx < rowCount.value ? idx : -1;
    };

    const hover = Gesture.Hover()
      .onBegin((e) => {
        'worklet';
        const idx = rowAt(e.y);
        if (idx !== hoverRow.value) {
          hoverRow.value = idx;
          runOnJS(setHoveredIndex)(idx, e.x, e.y);
        }
      })
      .onUpdate((e) => {
        'worklet';
        const idx = rowAt(e.y);
        hoverRow.value = idx;
        // every move: the JS side de-duplicates, but needs x to switch chevron / row tips
        runOnJS(setHoveredIndex)(idx, e.x, e.y);
      })
      .onEnd(() => {
        'worklet';
        hoverRow.value = -1;
        runOnJS(setHoveredIndex)(-1, -1, -1);
      });

    const tap = Gesture.Tap()
      .maxDuration(450)
      .onEnd((e, ok) => {
        'worklet';
        if (!ok) return;
        const idx = rowAt(e.y);
        if (onPanel(idx, e.x)) return; // on the hover panel (its buttons handle the press)
        runOnJS(onTapRow)(idx, e.x);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e, ok) => {
        'worklet';
        if (!ok) return;
        const idx = rowAt(e.y);
        if (idx >= 0 && !onPanel(idx, e.x)) runOnJS(onDoubleTapRow)(idx, e.x);
      });

    const reorder = Gesture.Pan()
      .minDistance(6)
      .onStart((e) => {
        'worklet';
        const idx = rowAt(e.y);
        // drag & drop only from the Task name / # columns (the cells are for inline editing)
        if (idx < 0 || !inRowDragZone(e.x) || onPanel(idx, e.x)) return;
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
        const contentY = e.y - PM_SCALE_HEIGHT + scrollY.value;
        dropSlot.value = clampValue(Math.round(contentY / PM_ROW_HEIGHT), 0, rowCount.value);
      })
      .onEnd(() => {
        'worklet';
        if (dragFrom.value >= 0) runOnJS(onDrop)(dragFrom.value, dropSlot.value);
      })
      .onFinalize(() => {
        'worklet';
        dragFrom.value = -1;
        dropSlot.value = -1;
        dragging.value = 0;
      });
    if (!IS_WEB) reorder.activateAfterLongPress(350);

    const scroll = Gesture.Pan()
      .minDistance(4)
      .onChange((e) => {
        'worklet';
        scrollY.value = clampValue(scrollY.value - e.changeY, 0, maxScrollY(rowCount.value, bodyH.value));
      })
      .onEnd((e) => {
        'worklet';
        scrollY.value = withDecay({ velocity: -e.velocityY, clamp: [0, maxScrollY(rowCount.value, bodyH.value)] });
      });

    // web: mouse-drag = reorder (wheel scrolls); touch: long-press-drag = reorder, drag = scroll
    const pans = IS_WEB ? reorder : Gesture.Exclusive(reorder, scroll);
    // the column header drag (fails at once outside the header) goes first
    return Gesture.Simultaneous(hover, Gesture.Race(Gesture.Exclusive(colDrag.gesture, pans), Gesture.Exclusive(doubleTap, tap)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollY, rowCount, hoverRow, bodyH, dragging, dragFrom, dragY, dropSlot, panelRowSV, panelLeftSV, panelRightSV, rowDragKey, colDrag.gesture, setHoveredIndex, onTapRow, onDoubleTapRow, onDrop]);

  const panelStyle = useAnimatedStyle(() => {
    const top = PM_SCALE_HEIGHT + panelIndex * PM_ROW_HEIGHT - scrollY.value;
    const visible = panelIndex >= 0 && dragging.value === 0 && top >= PM_SCALE_HEIGHT - 2 && top + PM_ROW_HEIGHT <= bodyH.value + PM_SCALE_HEIGHT + 2;
    return { opacity: visible ? 1 : 0, transform: [{ translateY: top + 4 }] };
  }, [panelIndex]);
  const panelRow = panelGUID ? tasksById[panelGUID] : undefined;

  const selectedIndex = selectedGUID ? rowIndexById[selectedGUID] ?? -1 : -1;
  const linkIndex = linkSourceGUID ? rowIndexById[linkSourceGUID] ?? -1 : -1;

  return (
    <View style={{ width, height, backgroundColor: palette.surface }}>
      {/* ---- container CRUD panel ---- */}
      <PMTreeToolbar crud={crud} palette={palette} />

      <GestureDetector gesture={gesture}>
        <View
          ref={canvasBoxRef}
          style={[{ width, height: canvasH }, IS_WEB ? ({ cursor: hoverInHeader ? 'grab' : hoverInCells ? 'text' : 'default' } as any) : null]}
          collapsable={false}
        >
          <Canvas style={{ width, height: canvasH }}>
            <Rect x={0} y={0} width={width} height={canvasH} color={palette.surface} />

            {/* ---- rows (virtualized, translated on the UI thread) ---- */}
            <Group clip={rect(0, PM_SCALE_HEIGHT, width, Math.max(0, canvasH - PM_SCALE_HEIGHT))}>
              <Group transform={bodyTransform}>
                {selectedIndex >= 0 && <Rect x={0} y={selectedIndex * PM_ROW_HEIGHT} width={width} height={PM_ROW_HEIGHT} color={palette.selected} />}
                {linkIndex >= 0 && <Rect x={0} y={linkIndex * PM_ROW_HEIGHT} width={3} height={PM_ROW_HEIGHT} color={palette.linkActive} />}
                <Rect x={0} y={hoverY} width={width} height={PM_ROW_HEIGHT} color={palette.hover} opacity={hoverOpacity} />
                <Path path={rowLines} style="stroke" strokeWidth={1} color={palette.grid} />
                <Path path={chevrons} color={palette.textMuted} />
                <Path path={milestones} color={palette.milestone} />
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
                          <SkText x={r.nameX} y={base} text={r.name} font={r.summary ? fonts.bold : fonts.regular} color={palette.text} />
                          {wbsCol && <SkText x={wbsCol.x + 8} y={base} text={r.wbs} font={r.summary ? fonts.smallBold : fonts.small} color={palette.textMuted} />}
                          {startCol && <SkText x={startCol.x + 8} y={base} text={r.start} font={fonts.small} color={palette.textMuted} />}
                          {daysCol && <SkText x={r.daysX} y={base} text={r.days} font={fonts.small} color={palette.textMuted} />}
                          {progCol && <SkText x={r.progX} y={base} text={r.prog} font={fonts.small} color={palette.textMuted} />}
                        </>
                      )}
                    </Group>
                  );
                })}
                {/* drag-to-reorder feedback */}
                <Rect x={0} y={dragY} width={width} height={PM_ROW_HEIGHT} color={palette.ghost} opacity={ghostOpacity} />
                <Rect x={0} y={dropLineY} width={width} height={2} color={palette.primary} opacity={ghostOpacity} />
              </Group>
            </Group>

            {/* ---- column grid + header (saved column order) + column drag & drop feedback ---- */}
            <PMTreeColumnsHeader layout={layout} palette={palette} font={fonts.ready ? fonts.smallBold : null} height={canvasH} drag={colDrag} />
          </Canvas>

          {/* ---- row CRUD panel (hover on web, selection on touch) ---- */}
          {panelRow && (
            <PMTreeRowHoverPanel
              guid={panelRow.rowGUID}
              isSummary={panelIsSummary}
              crud={crud}
              palette={palette}
              width={panelBox.width}
              left={panelBox.left}
              animatedStyle={panelStyle}
            />
          )}

          {/* ---- inline cell editors (Start / Days / %) ---- */}
          {cellEdit && rowIndexById[cellEdit.guid] !== undefined && (
            <PMInlineCellEditor
              field={cellEdit.field}
              guid={cellEdit.guid}
              rowIndex={rowIndexById[cellEdit.guid]}
              cols={layout}
              scrollY={scrollY}
              crud={crud}
              colors={{ text: palette.text, background: palette.surface, primary: palette.primary, error: palette.error }}
            />
          )}
        </View>
      </GestureDetector>
    </View>
  );
}
