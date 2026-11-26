// EstimateGridPane - the right side of the Estimate tab: an Excel-like grid drawn with Skia, ONE row per row of the task tree on its left, on the SAME vertical scroll value (the tree and the grid
// translate their rows by `viewport.scrollY` on the UI thread, exactly like the tree and the Gantt chart of the Project dashboard: row i of the tree and row i of the grid are always on the same pixel
// row, nothing is synchronised after the fact). The header is as high as the tree header (PM_SCALE_HEIGHT), so the names of all columns stand on one level; the body is as high as the tree body.
//   what a row shows       -> model/estimateGridModel (a task = its ONE position, typed in place; a stage = the sums of the tasks below it)
//   columns                -> the layout the user picked (simple / advanced / quote / trades), minus the columns hidden in the document
//   mouse / touch          -> wheel / drag scrolls (vertical = shared with the tree, horizontal = the grid's own), a tap selects the cell AND the task in the tree, a double tap / Enter / F2 edits
//   keyboard (web)         -> arrows move the cell (the task of the tree follows), a typed character starts the edit, Enter / Tab commit and move, Del clears, Esc cancels. The keys stop here: the
//                             keyboard of the tree (Del = delete the TASK, Enter = edit it, Tab = indent) does not see them while the grid has the focus
// NOTE: Skia component - the dashboard loads it lazily (inside the Gantt surface, after CanvasKit on web).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ExpoRouter from 'expo-router';
import { shallowEqual, useSelector } from 'react-redux';
import { Canvas, Group, Path, Rect, RoundedRect, Skia, Text as SkText, rect, type SkFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import SelectElementFromCatalog, { defaultTitleExtractor } from '../../../catalog/inner/select_element/SelectElementFromCatalog';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import ReusableTableColumnMenu from '../../../ui/components/table/reusable/ReusableTableColumnMenu';
import type { VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ColumnFilter, ColumnSort } from '../../../ui/components/table/reusable/tableFilter';
import { PMContextMenu } from '../../inner/menu';
import { pmT } from '../../i18n/pmT';
import { PM_ROW_HEIGHT, PM_SCALE_HEIGHT } from '../../model/constants';
import { makeMeasure, usePMFonts } from '../../skia/usePMFonts';
import { usePMStore } from '../../store/store_pm';
import { ROOT_KEY } from '../../view/project/rootKey';
import { collapsedContextRows } from '../../view/tree/filter/treeColumnFilter';
import { clampValue, maxScrollY, type PMViewport } from '../../view/gantt/useGanttViewport';
import { withAlpha, type PMPalette } from '../../view/theme';
import type { DocumentCalc } from '../model/estimationCalc';
import type { LineRow } from '../model/estimationDocumentModel';
import {
  applyGridEdit, buildGridRows, cellText, columnAtX, editorBox, editSeed, fitText, gridColumns, isCellEditable, neighbourColumn, nextOption, parseGridInput, shareOf, wrapTitle,
  type CellContext, type GridColumn, type GridRow,
} from '../model/estimateGridModel';
import { allTreeGUIDs, buildExternalView, findCells, gridColumnIsNumeric, isFilterActive, stepFind } from '../model/estimateGridView';
import type { EstimationLayout } from '../model/estimationLayouts';
import { BASIS_TO_SUM_KEY, type EstimationCurrencyBasis } from '../model/estimationModel';
import { taskKindOf } from '../model/estimationTaskModel';
import GridCellEditor, { type GridMove } from './GridCellEditor';
import { needsFallbackFont, useGridFallbackFonts } from './useGridFonts';

export interface EstimateGridPaneProps {
  /** the area under the bar of the pane: as wide as the pane, as high as the tree canvas (the tree's own toolbar is above it) */
  width: number;
  height: number;
  palette: PMPalette;
  viewport: PMViewport;
  projectGUID: string;
  documentGUID: string;
  /** the document json (rates, hidden columns, area ...) */
  doc: Record<string, any>;
  lines: LineRow[];
  calc: DocumentCalc;
  layout: EstimationLayout;
  basis: EstimationCurrencyBasis;
  /** the currency code of the view (the title of the column of the shown total) */
  currency: string;
  readOnly: boolean;
  onChangeLines: (fn: (prev: LineRow[]) => LineRow[]) => void;
  /** the norm cell of a task was pressed: the dashboard opens the norm books and writes the chosen norm into the task's position */
  onSelectNorm?: (taskGUID: string) => void;
  /** a window the grid opened (the norm books) was closed: the grid takes the keyboard back (change the number to ask for it) */
  focusToken?: number;
  testID?: string;
}

interface EditState { guid: string; colKey: string; seed: string; caret: 'select' | 'end' }

const HBAR_H = 5;
/** the width of the ▾ button at the right edge of a column header */
const HEAD_BTN_W = 24;
/** useIsFocused of expo-router; true where there is no navigator (a test) */
function useSafeIsFocused(): boolean {
  try {
    const fn = (ExpoRouter as any).useIsFocused;
    return typeof fn === 'function' ? !!fn() : true;
  } catch {
    return true;
  }
}
/** a cell that is chosen from a list (norm books, fixed options, catalog) and can be changed now: drawn as a hyperlink */
const isLinkCell = (col: GridColumn, row: GridRow, readOnly: boolean): boolean => (col.kind === 'norm' || col.kind === 'select' || col.kind === 'catalog') && isCellEditable(col, row, readOnly);
const CATALOG_ENTITIES = ['budgetItemReusable', 'businessUnitReusable'] as const;

export default function EstimateGridPane({ width, height, palette, viewport, projectGUID, documentGUID, doc, lines, calc, layout, basis, currency, readOnly, onChangeLines, onSelectNorm, focusToken = 0, testID = 'estimate-grid' }: EstimateGridPaneProps) {
  const fonts = usePMFonts();
  const measure = useMemo(() => makeMeasure(fonts.regular), [fonts.regular]);
  const measureBold = useMemo(() => makeMeasure(fonts.bold), [fonts.bold]);
  const measureHeader = useMemo(() => makeMeasure(fonts.header), [fonts.header]);
  const { scrollY, rowCount, bodyH, win } = viewport;

  // ---- the tree rows (the PM store) ----
  const visibleRows = usePMStore((s) => s.visibleRows);
  const childrenById = usePMStore((s) => s.tree.childrenById);
  const tasksById = usePMStore((s) => s.tasksById);
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const rowIndexById = usePMStore((s) => s.rowIndexById);

  // ---- catalogs of the advanced layout (budget item, business unit): read while it is shown ----
  useRealtimeEntity(CATALOG_ENTITIES[0], { enabled: layout === 'advanced' });
  useRealtimeEntity(CATALOG_ENTITIES[1], { enabled: layout === 'advanced' });
  const catalogRows: any[][] = useSelector((s: any) => CATALOG_ENTITIES.map((e) => s?.[e]?.entityDataFromServer), shallowEqual);
  const nameOf = useCallback((entity: string, guid: string): string => {
    const list: any[] = catalogRows[CATALOG_ENTITIES.indexOf(entity as any)] ?? [];
    const found = list.find((r) => r?.rowGUID === guid);
    return found ? defaultTitleExtractor(found) : '';
  }, [catalogRows]);

  // ---- columns and rows ----
  const hidden = useMemo(() => new Set<string>((doc.hiddenColumns as string[] | undefined) ?? []), [doc.hiddenColumns]);
  const { columns, contentWidth } = useMemo(() => gridColumns(layout, { t: pmT, currency, hidden }), [layout, currency, hidden]);
  // the grid row of EVERY task of the tree (a filter / sort of the grid decides which of them the tree shows), the rows shown = the ones the tree lists now
  const rowByGuid = useMemo(() => {
    const all = allTreeGUIDs(ROOT_KEY, childrenById);
    const rs = buildGridRows({ visible: all, childrenById, kindOf: (g) => taskKindOf(tasksById[g]), lines, byLine: calc.byLine, doc });
    return new Map(rs.map((r) => [r.guid, r]));
  }, [childrenById, tasksById, lines, calc.byLine, doc]);
  const rows = useMemo(() => visibleRows.map((g) => rowByGuid.get(g)).filter((r): r is GridRow => !!r), [visibleRows, rowByGuid]);
  const ctx = useMemo<CellContext>(() => ({ sumKey: BASIS_TO_SUM_KEY[basis], area: Number(doc.areaM2) || 0, totalCurrent: calc.total.current || 0, nameOf, t: pmT }), [basis, doc.areaM2, calc.total.current, nameOf]);

  // ---- selection / editing ----
  const [colKey, setColKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  /** the Filter & Sort popup of a column / the context menu of a header (page coordinates) */
  const [colMenu, setColMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const [headMenu, setHeadMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const activeCol = columns.find((c) => c.key === colKey) ?? columns[0] ?? null;
  const selIdx = selectedGUID ? rowIndexById[selectedGUID] ?? -1 : -1;
  const live = useRef({ rows, columns, activeCol, selectedGUID, selIdx, readOnly, visibleRows, editing, contentWidth });
  live.current = { rows, columns, activeCol, selectedGUID, selIdx, readOnly, visibleRows, editing, contentWidth };

  // ---- sort + filter of the columns: they reorder / hide the TREE rows too (one grid row per tree row), through the store ----
  const focused = useSafeIsFocused();
  const externalSet = useRef(false);
  useEffect(() => {
    if (!focused) return;
    const view = buildExternalView({ rootKey: ROOT_KEY, childrenById, rowOf: (g) => rowByGuid.get(g), columns, ctx, filters, sort });
    if (!view && !externalSet.current) return;
    externalSet.current = !!view;
    const store = usePMStore.getState();
    store.setTreeExternalView(view);
    if (view?.matches) {
      // the stages that hold a match are opened, so the matches can be seen
      const st = usePMStore.getState();
      const pg = st.selectedProjectGUID;
      const closed = collapsedContextRows(st.treeFilterContextGUIDs, (pg && st.expandedByProject[pg]) || {});
      if (closed.length) st.expandRows(closed);
    }
  }, [focused, filters, sort, columns, ctx, rowByGuid, childrenById]);
  // the filter / sort of this grid never stays behind: the Project dashboard shows the same tree
  useEffect(() => {
    if (focused) return;
    if (externalSet.current) { externalSet.current = false; usePMStore.getState().setTreeExternalView(null); }
  }, [focused]);
  useEffect(() => () => { if (externalSet.current) { externalSet.current = false; usePMStore.getState().setTreeExternalView(null); } }, []);

  // ---- find (Ctrl + F) ----
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [findIdx, setFindIdx] = useState(-1);
  /** Ctrl + F again while the bar is open: the cursor goes back into the field with its text selected */
  const [findNonce, setFindNonce] = useState(0);
  const findRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const matches = useMemo(() => (findOpen ? findCells(rows, columns, ctx, findText) : []), [findOpen, rows, columns, ctx, findText]);
  const matchSet = useMemo(() => new Set(matches.map((m) => `${m.rowIndex}:${m.colKey}`)), [matches]);
  const goToMatch = useCallback((i: number, list = matches) => {
    const m = list[i];
    setFindIdx(i);
    if (!m) return;
    setColKey(m.colKey);
    usePMStore.getState().requestFocus(m.guid);
  }, [matches]);
  const stepMatch = useCallback((d: 1 | -1) => goToMatch(stepFind(matches.length, findIdx, d)), [goToMatch, matches.length, findIdx]);
  const closeFind = useCallback(() => { setFindOpen(false); setFindIdx(-1); focusRootRef.current(); }, []);
  const focusRootRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!findOpen) return;
    // focused again a moment later: the key press that opened the bar (and the grid taking the focus back on its own) must not leave the cursor outside the field
    const go = () => { findRef.current?.focus(); (findRef.current as unknown as { select?: () => void } | null)?.select?.(); };
    const t1 = setTimeout(go, 0);
    const t2 = setTimeout(go, 120);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [findOpen, findNonce]);

  // ---- horizontal scroll (the grid's own; the vertical one is the tree's) ----
  const scrollX = useSharedValue(0);
  const maxX = Math.max(0, contentWidth - width);
  const maxXSV = useSharedValue(maxX);
  useEffect(() => {
    maxXSV.value = maxX;
    scrollX.value = clampValue(scrollX.value, 0, maxX);
  }, [maxX, maxXSV, scrollX]);
  // the active cell must be visible: moving it with the keys (or Tab in the editor) scrolls the grid sideways just enough to show the whole column
  const editColNow = editing ? columns.find((c) => c.key === editing.colKey) ?? null : null;
  const visBox = editColNow ? editorBox(editColNow, contentWidth) : activeCol ? { x: activeCol.x, width: activeCol.width } : { x: 0, width: 0 };
  const activeX = visBox.x;
  const activeW = visBox.width;
  useEffect(() => {
    if (!activeW || width <= 0) return;
    const left = scrollX.value;
    const target = activeW >= width || activeX < left ? activeX : activeX + activeW > left + width ? activeX + activeW - width : left;
    const next = clampValue(target, 0, maxXSV.value);
    if (Math.abs(next - left) > 0.5) scrollX.value = withTiming(next, { duration: 120 });
  }, [activeX, activeW, width, scrollX, maxXSV]);
  const bodyTransform = useDerivedValue(() => [{ translateX: -scrollX.value }, { translateY: PM_SCALE_HEIGHT - scrollY.value }]);
  const headTransform = useDerivedValue(() => [{ translateX: -scrollX.value }]);
  const editorLayerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -scrollX.value }] }));
  const hbarW = maxX > 0 ? Math.max(24, (width * width) / contentWidth) : 0;
  const hbarX = useDerivedValue(() => (maxXSV.value > 0 ? (scrollX.value / maxXSV.value) * (width - hbarW) : 0));

  // ---- commands (JS thread) ----
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const focusRoot = useCallback(() => {
    if (Platform.OS !== 'web') return;
    (rootRef.current as unknown as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, []);
  focusRootRef.current = focusRoot;
  useEffect(() => { if (focusToken) focusRoot(); }, [focusToken, focusRoot]);
  // ---- the header: ▾ = Filter & Sort popup; right click / double tap / long press = the menu of the column ----
  const pageOf = useCallback((x: number, y: number, then: (px: number, py: number) => void) => {
    const node = rootRef.current as unknown as { measureInWindow?: (cb: (ox: number, oy: number) => void) => void } | null;
    if (node?.measureInWindow) node.measureInWindow((ox, oy) => then(ox + x, oy + y));
    else then(x, y);
  }, []);
  const openColMenu = useCallback((key: string, x: number, y: number) => pageOf(x, y, (px, py) => { setHeadMenu(null); setColMenu({ key, x: px, y: py + 12 }); }), [pageOf]);
  const openHeadMenu = useCallback((key: string, x: number, y: number) => pageOf(x, y, (px, py) => { setColMenu(null); setHeadMenu({ key, x: px, y: py }); }), [pageOf]);
  const headerHit = useCallback((x: number): { col: GridColumn; button: boolean; right: number } | null => {
    const col = columnAtX(live.current.columns, x + scrollX.value);
    if (!col) return null;
    const right = col.x + col.width - scrollX.value;
    return { col, button: x >= right - HEAD_BTN_W, right };
  }, [scrollX]);
  const selectRow = useCallback((guid: string | null) => { usePMStore.getState().setSelected(guid); }, []);
  const selectRelative = useCallback((d: number) => {
    const { visibleRows: vr, selIdx: i } = live.current;
    if (!vr.length) return;
    const ni = Math.max(0, Math.min(vr.length - 1, (i < 0 ? 0 : i + d)));
    selectRow(vr[ni]);
  }, [selectRow]);
  const commitValue = useCallback((guid: string, col: GridColumn, text: string): string | null => {
    const p = parseGridInput(col, text);
    if (!p.ok) return 'invalid';
    onChangeLines((prev) => applyGridEdit(prev, { projectGUID, documentGUID }, guid, col, p.value));
    return null;
  }, [onChangeLines, projectGUID, documentGUID]);
  const beginEdit = useCallback((guid: string, key: string, typed?: string) => {
    const { rows: rs, columns: cs, readOnly: ro } = live.current;
    const i = usePMStore.getState().rowIndexById[guid];
    const row = i === undefined ? undefined : rs[i];
    const col = cs.find((c) => c.key === key);
    if (!col || !row || !isCellEditable(col, row, ro)) return;
    if (col.kind === 'norm') { onSelectNorm?.(guid); return; }
    if (col.kind === 'select') { commitValue(guid, col, nextOption(col, editSeed(col, row))); return; }
    if (col.kind === 'catalog') { setEditing({ guid, colKey: key, seed: '', caret: 'select' }); return; }
    setEditing({ guid, colKey: key, seed: typed ?? editSeed(col, row), caret: typed !== undefined ? 'end' : 'select' });
  }, [commitValue, onSelectNorm]);
  const clearCell = useCallback((guid: string, key: string) => {
    const { rows: rs, columns: cs, readOnly: ro } = live.current;
    const i = usePMStore.getState().rowIndexById[guid];
    const col = cs.find((c) => c.key === key);
    if (col && i !== undefined && isCellEditable(col, rs[i], ro) && col.kind !== 'norm' && rs[i].line) commitValue(guid, col, '');
  }, [commitValue]);
  const finishEdit = useCallback((move: GridMove) => {
    setEditing(null);
    if (move === 'down') selectRelative(1);
    else if (move === 'right') setColKey(neighbourColumn(live.current.columns, live.current.activeCol?.key ?? null, 1));
    focusRoot();
  }, [focusRoot, selectRelative]);

  // ---- touch / mouse ----
  const tapAt = useCallback((x: number, y: number, double: boolean) => {
    const ed = live.current.editing;
    if (ed) {
      // a press inside the open editor (its - / + buttons, the calculator, the text) is the editor's own
      const col = live.current.columns.find((c) => c.key === ed.colKey);
      const at = usePMStore.getState().rowIndexById[ed.guid];
      if (col && at !== undefined) {
        const box = editorBox(col, live.current.contentWidth);
        const left = box.x - scrollX.value;
        const top = PM_SCALE_HEIGHT + at * PM_ROW_HEIGHT - scrollY.value;
        if (x >= left && x <= left + box.width && y >= top && y <= top + PM_ROW_HEIGHT) return;
      }
      setEditing(null);
    }
    focusRoot();
    if (y < PM_SCALE_HEIGHT) {
      const hit = headerHit(x);
      if (!hit) return;
      if (double) openHeadMenu(hit.col.key, x, y);
      else if (hit.button) openColMenu(hit.col.key, x, y);
      return;
    }
    const idx = Math.floor((y - PM_SCALE_HEIGHT + scrollY.value) / PM_ROW_HEIGHT);
    const guid = live.current.visibleRows[idx];
    if (!guid) return;
    const col = columnAtX(live.current.columns, x + scrollX.value);
    selectRow(guid);
    if (!col) return;
    setColKey(col.key);
    // the norm cell is a button: one touch opens the norm books; the others edit on a double touch
    if (col.kind === 'norm' || double) beginEdit(guid, col.key);
  }, [beginEdit, focusRoot, headerHit, openColMenu, openHeadMenu, scrollX, scrollY, selectRow]);
  const tapRef = useRef(tapAt);
  tapRef.current = tapAt;
  const pressRef = useRef((_x: number, _y: number) => {});
  pressRef.current = (x, y) => { const hit = headerHit(x); if (hit) openHeadMenu(hit.col.key, x, y); };
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(4)
      .onChange((e) => {
        'worklet';
        scrollY.value = clampValue(scrollY.value - e.changeY, 0, maxScrollY(rowCount.value, bodyH.value));
        scrollX.value = clampValue(scrollX.value - e.changeX, 0, maxXSV.value);
      })
      .onEnd((e) => {
        'worklet';
        scrollY.value = withDecay({ velocity: -e.velocityY, clamp: [0, maxScrollY(rowCount.value, bodyH.value)] });
        if (maxXSV.value > 0) scrollX.value = withDecay({ velocity: -e.velocityX, clamp: [0, maxXSV.value] });
      });
    const tap = Gesture.Tap().runOnJS(true).maxDuration(450).onEnd((e, ok) => { if (ok) tapRef.current(e.x, e.y, false); });
    const doubleTap = Gesture.Tap().runOnJS(true).numberOfTaps(2).maxDuration(450).onEnd((e, ok) => { if (ok) tapRef.current(e.x, e.y, true); });
    // a long press on a header = the menu of the column (as in the ReusableTable)
    const longPress = Gesture.LongPress().runOnJS(true).minDuration(500).onStart((e) => { if (e.y < PM_SCALE_HEIGHT) pressRef.current(e.x, e.y); });
    return Gesture.Race(pan, longPress, Gesture.Exclusive(doubleTap, tap));
  }, [scrollX, scrollY, rowCount, bodyH, maxXSV]);

  // ---- web: wheel (vertical = the shared scroll, horizontal / shift = the grid's) and the keyboard ----
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = rootRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    el.tabIndex = 0;
    el.style.outline = 'none';
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? bodyH.value : 1;
      let dx = e.deltaX * unit;
      let dy = e.deltaY * unit;
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      if (dx) scrollX.value = clampValue(scrollX.value + dx, 0, maxXSV.value);
      if (dy) scrollY.value = clampValue(scrollY.value + dy, 0, maxScrollY(rowCount.value, bodyH.value));
    };
    const onPointerDown = (e: PointerEvent) => {
      // while an editor is open the focus stays in it (taking it away blurs the input = commits and closes the editor before a press on - / + / the calculator); tapAt closes it for a press outside
      if (live.current.editing) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') el.focus({ preventScroll: true });
    };
    const onKey = (e: KeyboardEvent) => {
      // Ctrl / Cmd + F searches INSIDE the table (the browser's own find does not see a canvas)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') {
        if (live.current.editing) return;
        e.preventDefault();
        e.stopPropagation();
        setFindOpen(true);
        setFindNonce((n) => n + 1);
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey) return;
      const { activeCol: col, selectedGUID: sel, columns: cs } = live.current;
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      const k = e.key;
      if (k === 'Escape') { stop(); setEditing(null); return; }
      if (e.altKey) return; // Alt + arrows move the TASK: the tree's own shortcut
      if (k === 'ArrowDown') { stop(); selectRelative(1); }
      else if (k === 'ArrowUp') { stop(); selectRelative(-1); }
      else if (k === 'ArrowRight') { stop(); setColKey(neighbourColumn(cs, col?.key ?? null, 1)); }
      else if (k === 'ArrowLeft') { stop(); setColKey(neighbourColumn(cs, col?.key ?? null, -1)); }
      else if (k === 'Tab') { stop(); setColKey(neighbourColumn(cs, col?.key ?? null, e.shiftKey ? -1 : 1)); }
      else if (k === 'Enter' || k === 'F2') { stop(); if (sel && col) beginEdit(sel, col.key); }
      else if (k === 'Delete' || k === 'Backspace') { stop(); if (sel && col) clearCell(sel, col.key); }
      else if (k.length === 1 && !e.altKey) { if (sel && col) { stop(); beginEdit(sel, col.key, k); } }
    };
    const onPointerMove = (e: PointerEvent) => {
      // the hand over a hyperlink cell (norm, option, catalog)
      const box = el.getBoundingClientRect();
      const { columns: cs, rows: rs, readOnly: ro } = live.current;
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      let link = false;
      if (y > PM_SCALE_HEIGHT) {
        const row = rs[Math.floor((y - PM_SCALE_HEIGHT + scrollY.value) / PM_ROW_HEIGHT)];
        const col = columnAtX(cs, x + scrollX.value);
        link = !!row && !!col && isLinkCell(col, row, ro);
      }
      if (y > 0 && y <= PM_SCALE_HEIGHT) { const h = headerHit(x); link = !!h?.button; }
      el.style.cursor = link ? 'pointer' : '';
    };
    const onContextMenu = (e: MouseEvent) => {
      const box = el.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      if (y >= PM_SCALE_HEIGHT) return;
      const hit = headerHit(x);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      setColMenu(null);
      setHeadMenu({ key: hit.col.key, x: e.clientX, y: e.clientY });
    };
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('keydown', onKey);
    };
  }, [beginEdit, bodyH, clearCell, headerHit, rowCount, scrollX, scrollY, selectRelative]);

  // ---- drawing ----
  const first = Math.max(0, win.firstRow);
  const last = Math.min(rows.length - 1, win.lastRow);
  const bodyH0 = Math.max(0, height - PM_SCALE_HEIGHT);
  const lineColor = palette.grid;
  const grid = useMemo(() => {
    const h = Skia.PathBuilder.Make();
    const v = Skia.PathBuilder.Make();
    for (let i = first; i <= last; i++) { const y = (i + 1) * PM_ROW_HEIGHT - 0.5; h.moveTo(0, y); h.lineTo(contentWidth, y); }
    const top = first * PM_ROW_HEIGHT;
    const bottom = (last + 1) * PM_ROW_HEIGHT;
    for (const c of columns) { v.moveTo(c.x + c.width - 0.5, top); v.lineTo(c.x + c.width - 0.5, bottom); }
    return { h: h.build(), v: v.build() };
  }, [first, last, columns, contentWidth]);
  const headerSeparators = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    for (const c of columns) { p.moveTo(c.x + c.width - 0.5, 0); p.lineTo(c.x + c.width - 0.5, PM_SCALE_HEIGHT); }
    return p.build();
  }, [columns]);
  // the ▾ button of every header: a muted triangle; ▲ / ▼ = the column the grid is sorted by; a dot before it = the column has a filter (both in the colour of the selection)
  const headerGlyphs = useMemo(() => {
    const muted = Skia.PathBuilder.Make();
    const active = Skia.PathBuilder.Make();
    const dots: { key: string; x: number }[] = [];
    const cy = PM_SCALE_HEIGHT / 2;
    for (const c of columns) {
      const cx = c.x + c.width - HEAD_BTN_W / 2 - 2;
      const dir = sort?.key === c.key ? sort.direction : null;
      const filtered = isFilterActive(filters[c.key]);
      const b = dir || filtered ? active : muted;
      if (dir === 'asc') { b.moveTo(cx - 4, cy + 2.5); b.lineTo(cx + 4, cy + 2.5); b.lineTo(cx, cy - 2.5); b.close(); }
      else { b.moveTo(cx - 4, cy - 2.5); b.lineTo(cx + 4, cy - 2.5); b.lineTo(cx, cy + 2.5); b.close(); }
      if (filtered) dots.push({ key: c.key, x: cx - 10 });
    }
    return { muted: muted.build(), active: active.build(), dots };
  }, [columns, sort, filters]);
  // texts of the header and of the cells in the window; a text the normal font cannot draw (Cyrillic ...) gets the fallback font once it is there
  const rawCells = useMemo(() => {
    if (last < first) return [];
    const out: { key: string; col: GridColumn; i: number; text: string; bold: boolean; link: boolean }[] = [];
    for (let i = first; i <= last; i++) {
      const row = rows[i];
      if (!row) continue;
      for (const c of columns) {
        if (c.kind === 'share') continue;
        const t = cellText(c, row, ctx);
        if (t) out.push({ key: `${i}:${c.key}`, col: c, i, text: t, bold: row.kind === 'summary' || !!c.bold, link: isLinkCell(c, row, readOnly) });
      }
    }
    return out;
  }, [first, last, rows, columns, ctx, readOnly]);
  const wantFallback = useMemo(() => columns.some((c) => needsFallbackFont(c.title)) || rawCells.some((c) => needsFallbackFont(c.text)), [columns, rawCells]);
  // a font the user chose (Roboto / Inter / Selawik) has Cyrillic itself: the fallback (a fixed 12 px) is for the Space Grotesk only
  const fb = useGridFallbackFonts(wantFallback && !fonts.custom);
  const fbMeasure = useMemo(() => makeMeasure(fb.regular), [fb.regular]);
  const fbMeasureBold = useMemo(() => makeMeasure(fb.bold), [fb.bold]);
  const headerLines = useMemo(() => {
    if (!fonts.ready) return [];
    const out: { key: string; x: number; y: number; text: string; font: SkFont }[] = [];
    for (const c of columns) {
      const alt = needsFallbackFont(c.title) && !!fb.bold;
      const font = alt ? fb.bold! : fonts.header!;
      const m = alt ? fbMeasureBold : measureHeader;
      const parts = wrapTitle(c.title, c.width - 12 - HEAD_BTN_W + 8, m);
      parts.forEach((t, i) => out.push({ key: `${c.key}:${i}`, x: c.x + (c.width - HEAD_BTN_W + 8 - m(t)) / 2, y: parts.length === 1 ? PM_SCALE_HEIGHT / 2 + 4 : PM_SCALE_HEIGHT / 2 + (i === 0 ? -3 : 11), text: t, font }));
    }
    return out;
  }, [columns, fonts.ready, fonts.header, measureHeader, fb.bold, fbMeasureBold]);
  const cells = useMemo(() => {
    if (!fonts.ready) return [];
    const out: { key: string; x: number; y: number; text: string; font: SkFont; color: string; w: number; link: boolean }[] = [];
    for (const r of rawCells) {
      const c = r.col;
      const alt = needsFallbackFont(r.text) && !!(r.bold ? fb.bold : fb.regular);
      const font = (alt ? (r.bold ? fb.bold : fb.regular) : r.bold ? fonts.bold : fonts.regular)!;
      const m = alt ? (r.bold ? fbMeasureBold : fbMeasure) : r.bold ? measureBold : measure;
      const t = fitText(r.text, c.width - 16, m);
      const w = m(t);
      out.push({ key: r.key, x: c.align === 'right' ? c.x + c.width - 8 - w : c.align === 'center' ? c.x + (c.width - w) / 2 : c.x + 8, y: r.i * PM_ROW_HEIGHT + PM_ROW_HEIGHT / 2 + 4, text: t, font, color: r.link ? palette.primary : palette.text, w, link: r.link });
    }
    return out;
  }, [fonts.ready, fonts.bold, fonts.regular, rawCells, fb.regular, fb.bold, fbMeasure, fbMeasureBold, measure, measureBold, palette.primary, palette.text]);
  const findHits = useMemo(() => {
    if (!findOpen || !matches.length) return [];
    const out: { key: string; x: number; y: number; w: number; current: boolean }[] = [];
    matches.forEach((m, i) => {
      if (m.rowIndex < first || m.rowIndex > last) return;
      const c = columns.find((k) => k.key === m.colKey);
      if (c) out.push({ key: `${m.rowIndex}:${m.colKey}`, x: c.x, y: m.rowIndex * PM_ROW_HEIGHT, w: c.width, current: i === findIdx });
    });
    return out;
  }, [findOpen, matches, first, last, columns, findIdx]);
  const shareCol = columns.find((c) => c.kind === 'share') ?? null;
  const tint = withAlpha(palette.primary, 0.05);
  const summaryTint = withAlpha(palette.text, 0.06);
  const calcCols = columns.filter((c) => c.kind === 'calc' || c.kind === 'sum' || c.kind === 'price' || c.kind === 'perArea');
  const bodyTop = first * PM_ROW_HEIGHT;
  const bodyRowsH = Math.max(0, (last - first + 1) * PM_ROW_HEIGHT);
  const outline = activeCol && selIdx >= 0 ? { x: activeCol.x, y: selIdx * PM_ROW_HEIGHT, w: activeCol.width } : null;

  // ---- the editor over the canvas ----
  const editCol = editing ? columns.find((c) => c.key === editing.colKey) ?? null : null;
  const editIdx = editing ? rowIndexById[editing.guid] : undefined;
  // the column as the Filter & Sort popup of the ReusableTable wants it (number = = / ≥ / ≤, text = Contains)
  const asVisualColumn = (c: GridColumn | undefined): VisualColumn | null => (c ? ({ key: c.key, title: c.title, type: gridColumnIsNumeric(c) ? 'number' : 'text', editable: false } as unknown as VisualColumn) : null);
  const menuColumn = colMenu ? asVisualColumn(columns.find((c) => c.key === colMenu.key)) : null;
  const headColumn = headMenu ? columns.find((c) => c.key === headMenu.key) ?? null : null;
  const editorColors = { text: palette.text, background: palette.surface, primary: palette.primary, error: palette.error };

  return (
    <GestureDetector gesture={gesture}>
      <View ref={rootRef} testID={testID} collapsable={false} style={{ width, height, overflow: 'hidden', backgroundColor: palette.surface }}>
        <Canvas style={{ width, height }}>
          <Rect x={0} y={0} width={width} height={height} color={palette.surface} />
          {/* ---- body: rows (virtualized, translated on the UI thread by the SAME scroll value as the tree) ---- */}
          <Group clip={rect(0, PM_SCALE_HEIGHT, width, bodyH0)}>
            <Group transform={bodyTransform}>
              {calcCols.map((c) => <Rect key={`t${c.key}`} x={c.x} y={bodyTop} width={c.width} height={bodyRowsH} color={tint} />)}
              {rows.slice(first, last + 1).map((r, k) => (r.kind === 'summary' ? <Rect key={`s${r.guid}`} x={0} y={(first + k) * PM_ROW_HEIGHT} width={contentWidth} height={PM_ROW_HEIGHT} color={summaryTint} /> : null))}
              {selIdx >= 0 && <Rect x={0} y={selIdx * PM_ROW_HEIGHT} width={contentWidth} height={PM_ROW_HEIGHT} color={palette.selected} />}
              {findHits.map((h) => <Rect key={`f${h.key}`} x={h.x} y={h.y} width={h.w} height={PM_ROW_HEIGHT - 1} color={h.current ? 'rgba(255,149,0,0.55)' : 'rgba(255,214,10,0.38)'} />)}
              <Path path={grid.h} style="stroke" strokeWidth={1} color={lineColor} />
              <Path path={grid.v} style="stroke" strokeWidth={1} color={lineColor} />
              {shareCol && rows.slice(first, last + 1).map((r, k) => {
                const p = shareOf(r, ctx);
                if (!p) return null;
                const y = (first + k) * PM_ROW_HEIGHT + PM_ROW_HEIGHT / 2 - 4;
                return <RoundedRect key={`b${r.guid}`} x={shareCol.x + 8} y={y} width={Math.max(2, (shareCol.width - 16) * p)} height={8} r={4} color={palette.primary} />;
              })}
              {fonts.ready && cells.map((c) => <SkText key={c.key} x={c.x} y={c.y} text={c.text} font={c.font} color={c.color} />)}
              {/* a list-select cell (norm, option, catalog) is a hyperlink: link colour + underline */}
              {fonts.ready && cells.map((c) => (c.link ? <Rect key={`u${c.key}`} x={c.x} y={c.y + 2.5} width={c.w} height={1} color={c.color} /> : null))}
              {outline && <Rect x={outline.x + 1} y={outline.y + 1} width={outline.w - 2} height={PM_ROW_HEIGHT - 2} style="stroke" strokeWidth={2} color={palette.primary} />}
            </Group>
          </Group>
          {/* ---- header: the names of ALL columns on ONE level, as high as the header of the tree ---- */}
          <Rect x={0} y={0} width={width} height={PM_SCALE_HEIGHT} color={palette.header} />
          <Group transform={headTransform}>
            {activeCol && <Rect x={activeCol.x} y={0} width={activeCol.width} height={PM_SCALE_HEIGHT - 1} color={withAlpha(palette.primary, 0.12)} />}
            <Path path={headerSeparators} style="stroke" strokeWidth={1} color={palette.gridStrong} />
            {fonts.ready && headerLines.map((h) => <SkText key={h.key} x={h.x} y={h.y} text={h.text} font={h.font} color={palette.textMuted} />)}
            <Path path={headerGlyphs.muted} color={withAlpha(palette.textMuted, 0.6)} />
            <Path path={headerGlyphs.active} color={palette.primary} />
            {headerGlyphs.dots.map((d) => <RoundedRect key={`fd${d.key}`} x={d.x - 3} y={PM_SCALE_HEIGHT / 2 - 3} width={6} height={6} r={3} color={palette.primary} />)}
          </Group>
          <Rect x={0} y={PM_SCALE_HEIGHT - 1} width={width} height={1} color={palette.gridStrong} />
          {hbarW > 0 && <RoundedRect x={hbarX} y={height - HBAR_H - 1} width={hbarW} height={HBAR_H} r={HBAR_H / 2} color={palette.gridStrong} />}
        </Canvas>
        {/* ---- the in-place editor of a cell (content x: follows the horizontal scroll) ---- */}
        {editing && editCol && editIdx !== undefined && (
          <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' } as any, editorLayerStyle]}>
            {editCol.kind === 'catalog' ? (
              <CatalogEditor
                col={editCol}
                rowIndex={editIdx}
                scrollY={scrollY}
                value={String((rows[editIdx]?.line?.rowJSON as any)?.[editCol.field ?? editCol.key] ?? '')}
                onPick={(guid) => { commitValue(editing.guid, editCol, guid ?? ''); finishEdit('none'); }}
              />
            ) : (
              <GridCellEditor
                testID={`${testID}-editor`}
                rowIndex={editIdx}
                x={editorBox(editCol, contentWidth).x}
                width={editorBox(editCol, contentWidth).width}
                scrollY={scrollY}
                initial={editing.seed}
                caret={editing.caret}
                align={editCol.align}
                numeric={editCol.kind === 'number'}
                min={editCol.min}
                max={editCol.max}
                colors={editorColors}
                onCommit={(text, move) => {
                  const problem = commitValue(editing.guid, editCol, text);
                  if (!problem) finishEdit(move);
                  return problem;
                }}
                onCancel={() => { setEditing(null); focusRoot(); }}
              />
            )}
          </Animated.View>
        )}
        {findOpen && (
          <View testID={`${testID}-find`} style={[styles.findBar, { top: PM_SCALE_HEIGHT + 6, backgroundColor: palette.surface, borderColor: palette.border }]}>
            <TextInput
              ref={findRef}
              autoFocus
              testID={`${testID}-find-input`}
              value={findText}
              placeholder={pmT('Find in the table')}
              placeholderTextColor={withAlpha(palette.text, 0.45)}
              onChangeText={(t) => { setFindText(t); const list = findCells(rows, columns, ctx, t); goToMatch(list.length ? 0 : -1, list); }}
              onSubmitEditing={() => stepMatch(1)}
              onKeyPress={(e) => {
                const ne = e.nativeEvent as any;
                if (ne.key === 'Escape') closeFind();
                else if (ne.key === 'Enter' && ne.shiftKey) { (e as any).preventDefault?.(); stepMatch(-1); }
              }}
              style={[styles.findInput, { color: palette.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
            />
            <Text testID={`${testID}-find-count`} style={{ color: palette.textMuted, fontSize: 12, marginHorizontal: 6 }}>
              {!findText.trim() ? '' : matches.length ? `${findIdx + 1} / ${matches.length}` : pmT('No results')}
            </Text>
            <Pressable testID={`${testID}-find-prev`} accessibilityLabel="Previous" onPress={() => stepMatch(-1)} style={styles.findBtn}><Text style={{ color: palette.text, fontSize: 14 }}>▲</Text></Pressable>
            <Pressable testID={`${testID}-find-next`} accessibilityLabel="Next" onPress={() => stepMatch(1)} style={styles.findBtn}><Text style={{ color: palette.text, fontSize: 14 }}>▼</Text></Pressable>
            <Pressable testID={`${testID}-find-close`} accessibilityLabel="Close" onPress={closeFind} style={styles.findBtn}><Text style={{ color: palette.text, fontSize: 16 }}>✕</Text></Pressable>
          </View>
        )}
        {colMenu && menuColumn && (
          <ReusableTableColumnMenu
            testID={testID}
            col={menuColumn}
            x={colMenu.x}
            y={colMenu.y}
            sort={sort}
            filter={filters[colMenu.key]}
            onSort={setSort}
            onFilter={(f) => setFilters((all) => { const next = { ...all }; if (f) next[colMenu.key] = f; else delete next[colMenu.key]; return next; })}
            onClose={() => { setColMenu(null); focusRoot(); }}
          />
        )}
        {headMenu && headColumn && (
          <PMContextMenu
            testID={`${testID}-header-menu`}
            x={headMenu.x}
            y={headMenu.y}
            caption={headColumn.title}
            onClose={() => { setHeadMenu(null); focusRoot(); }}
            items={[
              { testID: `${testID}-header-menu-filter-sort`, label: 'Filter & Sort', icon: 'filter_alt', onPress: () => { const m = headMenu; setHeadMenu(null); setColMenu({ key: m.key, x: m.x, y: m.y }); } },
              { testID: `${testID}-header-menu-clear-filter`, label: 'Clear filter', icon: 'filter_alt_off', disabled: !filters[headMenu.key], onPress: () => { const k = headMenu.key; setHeadMenu(null); setFilters((all) => { const next = { ...all }; delete next[k]; return next; }); } },
              { testID: `${testID}-header-menu-clear-all`, label: 'Clear all filters and sort', icon: 'clear_all', disabled: !sort && !Object.keys(filters).length, onPress: () => { setHeadMenu(null); setFilters({}); setSort(null); } },
              { testID: `${testID}-header-menu-copy-name`, label: 'Copy header name', icon: 'content_copy', onPress: () => { const t = headColumn.title; setHeadMenu(null); Clipboard.setStringAsync(t).catch(() => {}); } },
            ]}
          />
        )}
      </View>
    </GestureDetector>
  );
}

/** the catalog cell (budget item, business unit): the catalog picker of the app sits in the cell, its list opens at once on a press */
function CatalogEditor({ col, rowIndex, scrollY, value, onPick }: { col: GridColumn; rowIndex: number; scrollY: PMViewport['scrollY']; value: string; onPick: (guid: string | null) => void }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: PM_SCALE_HEIGHT + rowIndex * PM_ROW_HEIGHT - scrollY.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: col.x, width: col.width, height: PM_ROW_HEIGHT }, style]}>
      <SelectElementFromCatalog testID={`estimate-grid-catalog-${col.key}`} entityName={col.entity ?? ''} value={value || null} onChange={onPick} compact placeholder={pmT(col.title)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  findBar: { position: 'absolute', right: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, height: 34, zIndex: 20, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  findInput: { width: 170, height: 30, fontSize: 13, paddingVertical: 0 },
  findBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});
