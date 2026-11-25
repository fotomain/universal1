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
import { Platform, StyleSheet, View } from 'react-native';
import { shallowEqual, useSelector } from 'react-redux';
import { Canvas, Group, Path, Rect, RoundedRect, Skia, Text as SkText, rect, type SkFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withDecay } from 'react-native-reanimated';
import SelectElementFromCatalog, { defaultTitleExtractor } from '../../../catalog/inner/select_element/SelectElementFromCatalog';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { pmT } from '../../i18n/pmT';
import { PM_ROW_HEIGHT, PM_SCALE_HEIGHT } from '../../model/constants';
import { makeMeasure, usePMFonts } from '../../skia/usePMFonts';
import { usePMStore } from '../../store/store_pm';
import { clampValue, maxScrollY, type PMViewport } from '../../view/gantt/useGanttViewport';
import { withAlpha, type PMPalette } from '../../view/theme';
import type { DocumentCalc } from '../model/estimationCalc';
import type { LineRow } from '../model/estimationDocumentModel';
import {
  applyGridEdit, buildGridRows, cellText, columnAtX, editSeed, fitText, gridColumns, isCellEditable, neighbourColumn, nextOption, parseGridInput, shareOf, wrapTitle,
  type CellContext, type GridColumn,
} from '../model/estimateGridModel';
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
  testID?: string;
}

interface EditState { guid: string; colKey: string; seed: string; caret: 'select' | 'end' }

const HBAR_H = 5;
const CATALOG_ENTITIES = ['budgetItemReusable', 'businessUnitReusable'] as const;

export default function EstimateGridPane({ width, height, palette, viewport, projectGUID, documentGUID, doc, lines, calc, layout, basis, currency, readOnly, onChangeLines, onSelectNorm, testID = 'estimate-grid' }: EstimateGridPaneProps) {
  const fonts = usePMFonts();
  const measure = useMemo(() => makeMeasure(fonts.regular), [fonts.regular]);
  const measureBold = useMemo(() => makeMeasure(fonts.bold), [fonts.bold]);
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
  const rows = useMemo(
    () => buildGridRows({ visible: visibleRows, childrenById, kindOf: (g) => taskKindOf(tasksById[g]), lines, byLine: calc.byLine, doc }),
    [visibleRows, childrenById, tasksById, lines, calc.byLine, doc],
  );
  const ctx = useMemo<CellContext>(() => ({ sumKey: BASIS_TO_SUM_KEY[basis], area: Number(doc.areaM2) || 0, totalCurrent: calc.total.current || 0, nameOf, t: pmT }), [basis, doc.areaM2, calc.total.current, nameOf]);

  // ---- selection / editing ----
  const [colKey, setColKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const activeCol = columns.find((c) => c.key === colKey) ?? columns[0] ?? null;
  const selIdx = selectedGUID ? rowIndexById[selectedGUID] ?? -1 : -1;
  const live = useRef({ rows, columns, activeCol, selectedGUID, selIdx, readOnly, visibleRows, editing });
  live.current = { rows, columns, activeCol, selectedGUID, selIdx, readOnly, visibleRows, editing };

  // ---- horizontal scroll (the grid's own; the vertical one is the tree's) ----
  const scrollX = useSharedValue(0);
  const maxX = Math.max(0, contentWidth - width);
  const maxXSV = useSharedValue(maxX);
  useEffect(() => {
    maxXSV.value = maxX;
    scrollX.value = clampValue(scrollX.value, 0, maxX);
  }, [maxX, maxXSV, scrollX]);
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
    focusRoot();
    if (live.current.editing) setEditing(null);
    if (y < PM_SCALE_HEIGHT) return;
    const idx = Math.floor((y - PM_SCALE_HEIGHT + scrollY.value) / PM_ROW_HEIGHT);
    const guid = live.current.visibleRows[idx];
    if (!guid) return;
    const col = columnAtX(live.current.columns, x + scrollX.value);
    selectRow(guid);
    if (!col) return;
    setColKey(col.key);
    // the norm cell is a button: one touch opens the norm books; the others edit on a double touch
    if (col.kind === 'norm' || double) beginEdit(guid, col.key);
  }, [beginEdit, focusRoot, scrollX, scrollY, selectRow]);
  const tapRef = useRef(tapAt);
  tapRef.current = tapAt;
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
    return Gesture.Race(pan, Gesture.Exclusive(doubleTap, tap));
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
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') el.focus({ preventScroll: true });
    };
    const onKey = (e: KeyboardEvent) => {
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
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('keydown', onKey);
    };
  }, [beginEdit, bodyH, clearCell, rowCount, scrollX, scrollY, selectRelative]);

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
  // texts of the header and of the cells in the window; a text the normal font cannot draw (Cyrillic ...) gets the fallback font once it is there
  const rawCells = useMemo(() => {
    if (last < first) return [];
    const out: { key: string; col: GridColumn; i: number; text: string; bold: boolean }[] = [];
    for (let i = first; i <= last; i++) {
      const row = rows[i];
      if (!row) continue;
      for (const c of columns) {
        if (c.kind === 'share') continue;
        const t = cellText(c, row, ctx);
        if (t) out.push({ key: `${i}:${c.key}`, col: c, i, text: t, bold: row.kind === 'summary' || !!c.bold });
      }
    }
    return out;
  }, [first, last, rows, columns, ctx]);
  const wantFallback = useMemo(() => columns.some((c) => needsFallbackFont(c.title)) || rawCells.some((c) => needsFallbackFont(c.text)), [columns, rawCells]);
  const fb = useGridFallbackFonts(wantFallback);
  const fbMeasure = useMemo(() => makeMeasure(fb.regular), [fb.regular]);
  const fbMeasureBold = useMemo(() => makeMeasure(fb.bold), [fb.bold]);
  const headerLines = useMemo(() => {
    if (!fonts.ready) return [];
    const out: { key: string; x: number; y: number; text: string; font: SkFont }[] = [];
    for (const c of columns) {
      const alt = needsFallbackFont(c.title) && !!fb.bold;
      const font = alt ? fb.bold! : fonts.bold!;
      const m = alt ? fbMeasureBold : measureBold;
      const parts = wrapTitle(c.title, c.width - 12, m);
      parts.forEach((t, i) => out.push({ key: `${c.key}:${i}`, x: c.x + (c.width - m(t)) / 2, y: parts.length === 1 ? PM_SCALE_HEIGHT / 2 + 4 : PM_SCALE_HEIGHT / 2 + (i === 0 ? -3 : 11), text: t, font }));
    }
    return out;
  }, [columns, fonts.ready, fonts.bold, measureBold, fb.bold, fbMeasureBold]);
  const cells = useMemo(() => {
    if (!fonts.ready) return [];
    const out: { key: string; x: number; y: number; text: string; font: SkFont; color: string }[] = [];
    for (const r of rawCells) {
      const c = r.col;
      const alt = needsFallbackFont(r.text) && !!(r.bold ? fb.bold : fb.regular);
      const font = (alt ? (r.bold ? fb.bold : fb.regular) : r.bold ? fonts.bold : fonts.regular)!;
      const m = alt ? (r.bold ? fbMeasureBold : fbMeasure) : r.bold ? measureBold : measure;
      const t = fitText(r.text, c.width - 16, m);
      const w = m(t);
      out.push({ key: r.key, x: c.align === 'right' ? c.x + c.width - 8 - w : c.align === 'center' ? c.x + (c.width - w) / 2 : c.x + 8, y: r.i * PM_ROW_HEIGHT + PM_ROW_HEIGHT / 2 + 4, text: t, font, color: c.kind === 'norm' ? palette.primary : palette.text });
    }
    return out;
  }, [fonts.ready, fonts.bold, fonts.regular, rawCells, fb.regular, fb.bold, fbMeasure, fbMeasureBold, measure, measureBold, palette.primary, palette.text]);
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
              <Path path={grid.h} style="stroke" strokeWidth={1} color={lineColor} />
              <Path path={grid.v} style="stroke" strokeWidth={1} color={lineColor} />
              {shareCol && rows.slice(first, last + 1).map((r, k) => {
                const p = shareOf(r, ctx);
                if (!p) return null;
                const y = (first + k) * PM_ROW_HEIGHT + PM_ROW_HEIGHT / 2 - 4;
                return <RoundedRect key={`b${r.guid}`} x={shareCol.x + 8} y={y} width={Math.max(2, (shareCol.width - 16) * p)} height={8} r={4} color={palette.primary} />;
              })}
              {fonts.ready && cells.map((c) => <SkText key={c.key} x={c.x} y={c.y} text={c.text} font={c.font} color={c.color} />)}
              {outline && <Rect x={outline.x + 1} y={outline.y + 1} width={outline.w - 2} height={PM_ROW_HEIGHT - 2} style="stroke" strokeWidth={2} color={palette.primary} />}
            </Group>
          </Group>
          {/* ---- header: the names of ALL columns on ONE level, as high as the header of the tree ---- */}
          <Rect x={0} y={0} width={width} height={PM_SCALE_HEIGHT} color={palette.header} />
          <Group transform={headTransform}>
            {activeCol && <Rect x={activeCol.x} y={0} width={activeCol.width} height={PM_SCALE_HEIGHT - 1} color={withAlpha(palette.primary, 0.12)} />}
            <Path path={headerSeparators} style="stroke" strokeWidth={1} color={palette.gridStrong} />
            {fonts.ready && headerLines.map((h) => <SkText key={h.key} x={h.x} y={h.y} text={h.text} font={h.font} color={palette.textMuted} />)}
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
                x={editCol.x}
                width={editCol.width}
                scrollY={scrollY}
                initial={editing.seed}
                caret={editing.caret}
                align={editCol.align}
                numeric={editCol.kind === 'number'}
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
