// Left pane: the task tree (grid) drawn entirely with Skia - rows, indentation,
// chevrons, kind icons, name/start/days/% columns - on the SAME virtual scroll value as
// the chart, so tree rows and Gantt bars are pixel-locked (no second ScrollView to sync).
//
// Container CRUD panel = the toolbar above the canvas.
// Row CRUD panel       = the hover panel (web: on hover, touch: on the selected row),
//                        inside the Task name column (never over Start / Days / %).
// Inline cell edit     = click / tap Start, Days or % -> EditTaskStart / EditTaskDays /
//                        EditTaskProgress; drag & drop of rows works on the Task name column.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Canvas, Group, Line, Path, Rect, RoundedRect, Skia, Text as SkText, rect, vec } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withDecay } from 'react-native-reanimated';
import {
  PM_HOVER_PANEL_WIDTH,
  PM_ROW_HEIGHT,
  PM_SCALE_HEIGHT,
  PM_TOOLBAR_HEIGHT,
  PM_TREE_COL_DAYS,
  PM_TREE_COL_PROGRESS,
  PM_TREE_COL_START,
  PM_TREE_INDENT,
} from './constants';
import { usePMStore } from './store';
import { formatDateShort } from './scheduling';
import { ellipsize, PMPalette } from './theme';
import { makeMeasure, usePMFonts } from './skia/usePMFonts';
import { clampValue, maxScrollY, PMViewport } from './useGanttViewport';
import { PMCrud } from './usePMCrud';
import PMTreeRowHoverPanel from './panels/tree/PMTreeRowHoverPanel';
import PMTreeToolbar from './toolbars/tree/PMTreeToolbar';
import { hidePMTip, showPMTip } from './PMTooltip';
import { PMCellField } from './store';
import { taskColorOf } from './types';
import PMInlineCellEditor from './inline/PMInlineCellEditor';

const IS_WEB = Platform.OS === 'web';
const CHEVRON_W = 16;
const ICON_W = 16;

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
  // responsive grid columns: on narrow panes drop %, then Days, then Start (name always stays)
  const MIN_NAME = 130;
  const showProg = width - (PM_TREE_COL_START + PM_TREE_COL_DAYS + PM_TREE_COL_PROGRESS) >= MIN_NAME;
  const showDays = width - (PM_TREE_COL_START + PM_TREE_COL_DAYS) >= MIN_NAME;
  const showStart = width - PM_TREE_COL_START >= MIN_NAME;
  const colProgX = showProg ? width - PM_TREE_COL_PROGRESS : width;
  const colDaysX = showDays ? colProgX - PM_TREE_COL_DAYS : colProgX;
  const colStartX = showStart ? colDaysX - PM_TREE_COL_START : colDaysX;
  const colLines = [showStart && colStartX, showDays && colDaysX, showProg && colProgX].filter((x): x is number => typeof x === 'number');
  const { scrollY, hoverRow, rowCount, bodyH, dragging, win } = viewport;
  /** x where the editable cells begin; left of it = Task name column (drag & drop, hover panel) */
  const cellsX = colStartX;
  const colsRef = useRef({ cellsX, colStartX, colDaysX, colProgX, showStart, showDays, showProg, width });
  colsRef.current = { cellsX, colStartX, colDaysX, colProgX, showStart, showDays, showProg, width };
  const [hoverInCells, setHoverInCells] = useState(false);

  // ---- per-window row descriptors (re-computed only when the window/data changes) ------
  const rows = useMemo(() => {
    const measureReg = makeMeasure(fonts.regular);
    const measureBold = makeMeasure(fonts.bold);
    const measureSmall = makeMeasure(fonts.small);
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
      const nameX = 8 + depth * PM_TREE_INDENT + CHEVRON_W + ICON_W + 4;
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
        name: ellipsize(t.rowJSON?.name || '(untitled)', colStartX - nameX - 6, measure),
        nameX,
        start: r ? formatDateShort(r.startMs) : '',
        days,
        daysX: colDaysX + PM_TREE_COL_DAYS - 8 - measureSmall(days),
        prog,
        progX: colProgX + PM_TREE_COL_PROGRESS - 8 - measureSmall(prog),
        critical: showCritical && !!r?.isCritical && !summary,
        color: taskColorOf(t.rowJSON),
      });
    }
    return out;
  }, [win.firstRow, win.lastRow, visibleRows, tasksById, schedule, tree, expanded, fonts.regular, fonts.bold, fonts.small, colStartX, colDaysX, colProgX, showCritical]);

  // one path for all chevrons, one for all horizontal row lines
  const { chevrons, rowLines, milestones } = useMemo(() => {
    const chevronPath = Skia.Path.Make();
    const linesPath = Skia.Path.Make();
    const diamonds = Skia.Path.Make();
    for (const r of rows) {
      const cy = r.y + PM_ROW_HEIGHT / 2;
      const x = 8 + r.depth * PM_TREE_INDENT;
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
  }, [rows, width]);

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

  /** Which editable column is under canvas x (null = Task name column / hidden column). */
  const cellFieldAt = useCallback((x: number): PMCellField | null => {
    const c = colsRef.current;
    if (c.showProg && x >= c.colProgX) return 'progress';
    if (c.showDays && x >= c.colDaysX) return 'days';
    if (c.showStart && x >= c.colStartX) return 'start';
    return null;
  }, []);

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
      const field = guid && x >= colsRef.current.cellsX ? cellFieldAt(x) : null;
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
    // tips for the canvas-drawn "icons": chevron + row drag handle
    let zone = '';
    const inCells = !!guid && x >= colsRef.current.cellsX;
    setHoverInCells(inCells);
    if (guid && x >= 0) {
      const chevronX = 8 + (s.tree.depthById[guid] ?? 0) * PM_TREE_INDENT;
      const hasKids = (s.tree.childrenById[guid]?.length ?? 0) > 0;
      const field = inCells ? cellFieldAt(x) : null;
      if (field) zone = `cell:${field}:${guid}`;
      else if (hasKids && x >= chevronX - 4 && x <= chevronX + CHEVRON_W + 2) zone = `chev:${guid}`;
      else if (x < chevronX + CHEVRON_W + ICON_W + 4 && x > chevronX + CHEVRON_W) zone = `icon:${guid}`;
    }
    if (zone === lastTipZone.current) return;
    lastTipZone.current = zone;
    if (!zone || !canvasBoxRef.current) return hidePMTip();
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
      const depth = s.tree.depthById[guid] ?? 0;
      const chevronX = 8 + depth * PM_TREE_INDENT;
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
      if (x >= colsRef.current.cellsX && openCellEditor(idx, x)) return;
      const guid = usePMStore.getState().visibleRows[idx];
      if (guid) crud.edit(guid);
    },
    [crud, openCellEditor]
  );

  const onDrop = useCallback((from: number, slot: number) => crud.dropRow(from, slot), [crud]);

  // ---- gestures -----------------------------------------------------------------------------
  // the hover panel sits at the right end of the Task name column (never over Start / Days / %)
  const panelWidth = Math.min(PM_HOVER_PANEL_WIDTH, Math.max(60, cellsX - 12));
  const panelRight = width - cellsX + 4;
  const panelZoneX = cellsX - panelWidth - 6;
  const gesture = useMemo(() => {
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
        if (idx >= 0 && e.x > panelZoneX && e.x < cellsX && IS_WEB && hoverRow.value === idx) return; // on the hover panel
        runOnJS(onTapRow)(idx, e.x);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e, ok) => {
        'worklet';
        if (!ok) return;
        const idx = rowAt(e.y);
        if (idx >= 0 && !(e.x > panelZoneX && e.x < cellsX && IS_WEB)) runOnJS(onDoubleTapRow)(idx, e.x);
      });

    const reorder = Gesture.Pan()
      .minDistance(6)
      .onStart((e) => {
        'worklet';
        const idx = rowAt(e.y);
        // drag & drop only from the Task name column (the cells are for inline editing)
        if (idx < 0 || e.x >= cellsX || (IS_WEB && e.x > panelZoneX && hoverRow.value === idx)) return;
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
    return Gesture.Simultaneous(hover, Gesture.Race(pans, Gesture.Exclusive(doubleTap, tap)));
  }, [scrollY, rowCount, hoverRow, bodyH, dragging, dragFrom, dragY, dropSlot, panelZoneX, cellsX, setHoveredIndex, onTapRow, onDoubleTapRow, onDrop]);

  // ---- hover / selection CRUD panel ------------------------------------------------------
  // web: no hover panel while the pointer is over Start / Days / % (inline edit there)
  const panelGUID = linkSourceGUID || cellEdit ? null : IS_WEB ? (hoverInCells ? null : hoveredGUID ?? null) : selectedGUID;
  const panelIndex = panelGUID ? rowIndexById[panelGUID] ?? -1 : -1;
  const panelStyle = useAnimatedStyle(() => {
    const top = PM_SCALE_HEIGHT + panelIndex * PM_ROW_HEIGHT - scrollY.value;
    const visible = panelIndex >= 0 && dragging.value === 0 && top >= PM_SCALE_HEIGHT - 2 && top + PM_ROW_HEIGHT <= bodyH.value + PM_SCALE_HEIGHT + 2;
    return { opacity: visible ? 1 : 0, transform: [{ translateY: top + 4 }] };
  }, [panelIndex]);
  const panelRow = panelGUID ? tasksById[panelGUID] : undefined;
  const panelIsSummary = panelGUID ? !!schedule[panelGUID]?.isSummary : false;

  const selectedIndex = selectedGUID ? rowIndexById[selectedGUID] ?? -1 : -1;
  const linkIndex = linkSourceGUID ? rowIndexById[linkSourceGUID] ?? -1 : -1;

  return (
    <View style={{ width, height, backgroundColor: palette.surface }}>
      {/* ---- container CRUD panel ---- */}
      <PMTreeToolbar crud={crud} palette={palette} />

      <GestureDetector gesture={gesture}>
        <View
          ref={canvasBoxRef}
          style={[{ width, height: canvasH }, IS_WEB ? ({ cursor: hoverInCells ? 'text' : 'default' } as any) : null]}
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
                  const iconX = 8 + r.depth * PM_TREE_INDENT + CHEVRON_W;
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
                          {showStart && <SkText x={colStartX + 8} y={base} text={r.start} font={fonts.small} color={palette.textMuted} />}
                          {showDays && <SkText x={r.daysX} y={base} text={r.days} font={fonts.small} color={palette.textMuted} />}
                          {showProg && <SkText x={r.progX} y={base} text={r.prog} font={fonts.small} color={palette.textMuted} />}
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

            {/* ---- column separators ---- */}
            {colLines.map((x) => (
              <Line key={x} p1={vec(x + 0.5, 0)} p2={vec(x + 0.5, canvasH)} color={palette.grid} strokeWidth={1} />
            ))}

            {/* ---- header (matches the chart's 2-tier time scale height) ---- */}
            <Rect x={0} y={0} width={width} height={PM_SCALE_HEIGHT} color={palette.header} />
            <Line p1={vec(0, PM_SCALE_HEIGHT - 0.5)} p2={vec(width, PM_SCALE_HEIGHT - 0.5)} color={palette.gridStrong} strokeWidth={1} />
            {colLines.map((x) => (
              <Line key={`h${x}`} p1={vec(x + 0.5, 0)} p2={vec(x + 0.5, PM_SCALE_HEIGHT)} color={palette.gridStrong} strokeWidth={1} />
            ))}
            {fonts.ready && (
              <>
                <SkText x={10} y={PM_SCALE_HEIGHT / 2 + 4} text="Task name" font={fonts.smallBold} color={palette.textMuted} />
                {showStart && <SkText x={colStartX + 8} y={PM_SCALE_HEIGHT / 2 + 4} text="Start" font={fonts.smallBold} color={palette.textMuted} />}
                {showDays && <SkText x={colDaysX + 8} y={PM_SCALE_HEIGHT / 2 + 4} text="Days" font={fonts.smallBold} color={palette.textMuted} />}
                {showProg && <SkText x={colProgX + 8} y={PM_SCALE_HEIGHT / 2 + 4} text="%" font={fonts.smallBold} color={palette.textMuted} />}
              </>
            )}
            <Line p1={vec(width - 0.5, 0)} p2={vec(width - 0.5, canvasH)} color={palette.gridStrong} strokeWidth={1} />
          </Canvas>

          {/* ---- row CRUD panel (hover on web, selection on touch) ---- */}
          {panelRow && (
            <PMTreeRowHoverPanel
              guid={panelRow.rowGUID}
              isSummary={panelIsSummary}
              crud={crud}
              palette={palette}
              width={panelWidth}
              right={panelRight}
              animatedStyle={panelStyle}
            />
          )}

          {/* ---- inline cell editors (Start / Days / %) ---- */}
          {cellEdit && rowIndexById[cellEdit.guid] !== undefined && (
            <PMInlineCellEditor
              field={cellEdit.field}
              guid={cellEdit.guid}
              rowIndex={rowIndexById[cellEdit.guid]}
              cols={{ colStartX, colDaysX, colProgX, width }}
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
