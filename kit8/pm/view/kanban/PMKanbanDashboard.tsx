// PMKanbanDashboard - the Kanban board of the selected project (right pane of PMGanttSurface when
// uxuiSettings.ganttVsNetworkView = 'showKanbanView'; the Skia task tree stays on the left).
//
//   PMKanbanToolbar      scope (tree selection) · task count · Gantt | Kanban | Network · Kanban Stages
//   columns              project_kanban_stage_table (PMKanbanColumn = Droppable)
//   cards                tasks + milestones of the scope (PMKanbanCard = Draggable), stage from
//                        project_task_kanban_state_table (no row = first stage)
//
// Drag & drop: react-native-reanimated-dnd inside the board (card -> column, place from the drop
// position); tree rows -> board through the thin bridge in kanbanTreeBridge.ts. Scope: selecting a
// stage in the tree shows only its tasks ("All" = whole project). Data: store/store_kanban.ts
// (React Query + realtime auto refresh, crud/kanban). The Kanban stage never changes the progress %.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DropProvider, DropProviderRef } from 'react-native-reanimated-dnd';
import { usePMStore } from '../../store/store_pm';
import { usePMKanbanStore } from '../../store/store_kanban';
import { PMPalette } from '../theme';
import { PMCrud } from '../../crud/usePMCrud';
import { PMKanbanCommands } from '../../crud/kanban/useKanbanCommands';
import { useReadKanbanStageCatalogQuery } from '../../crud/kanban/kanbanQueries';
import { PMProjectKanbanStageRow, PM_KANBAN_DEFAULT_STAGES } from '../../model/kanbanTypes';
import ActivityIndicatorCircleApp from '../../../components/activityindicator/ActivityIndicatorCircleApp';
import PMKanbanToolbar from './PMKanbanToolbar';
import PMKanbanColumn from './PMKanbanColumn';
import PMKanbanStagesModalWindow from './PMKanbanStagesModalWindow';
import { PMKanbanCardDragData } from './PMKanbanCard';
import { buildKanbanBoard, derivedKanbanStage, isKanbanCardRow } from './kanbanModel';
import { kanbanColumnWidth, PM_KANBAN_GAP, PM_KANBAN_PADDING } from './kanbanLayout';
import { PMKanbanTreeBridge } from './kanbanTreeBridge';

export interface PMKanbanDashboardProps {
  projectGUID: string;
  width: number;
  height: number;
  palette: PMPalette;
  crud: PMCrud;
  kanban: PMKanbanCommands;
  /** tree -> board drag bridge (PMGanttSurface) */
  bridge?: PMKanbanTreeBridge;
  /** x of the board inside PMGanttSurface (tree + splitter) */
  boardLeft?: number;
}

type DragPayload = { x: number; y: number; tx: number; ty: number };
type Box = { pageY: number; height: number } | null;

const measureBox = (view: View | undefined | null): Promise<Box> =>
  new Promise((resolve) => {
    if (!view || typeof (view as any).measure !== 'function') return resolve(null);
    let done = false;
    const t = setTimeout(() => !done && resolve(null), 300);
    (view as any).measure((_x: number, _y: number, _w: number, h: number, _px: number, py: number) => {
      done = true;
      clearTimeout(t);
      resolve(typeof py === 'number' && h > 0 ? { pageY: py, height: h } : null);
    });
  });

/** Read-only columns when create_pm_kanban_tables.sql has not run. */
const DEFAULT_STAGE_ROWS: PMProjectKanbanStageRow[] = PM_KANBAN_DEFAULT_STAGES.map((d, i) => ({
  rowGUID: `default-${d.stageCode}`,
  rowOwnerGUID: '',
  rowParentGUID: 'empty',
  orderInList: (i + 1) * 1024,
  rowJSON: { ...d },
}));

function isInside(guid: string, ancestor: string, parentById: Record<string, string | null>): boolean {
  for (let g: string | null | undefined = guid; g; g = parentById[g]) if (g === ancestor) return true;
  return false;
}

export default function PMKanbanDashboard({ projectGUID, width, height, palette, crud, kanban, bridge, boardLeft = 0 }: PMKanbanDashboardProps) {
  useReadKanbanStageCatalogQuery(); // keeps the shared catalog live (realtime) for the Kanban Stages window

  const tasksById = usePMStore((s) => s.tasksById);
  const tree = usePMStore((s) => s.tree);
  const schedule = usePMStore((s) => s.schedule);
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const projectName = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON?.name);
  const loaded = usePMKanbanStore((s) => s.loadedProjectGUID === projectGUID);
  const storeStages = usePMKanbanStore((s) => s.stages);
  const statesByTask = usePMKanbanStore((s) => s.statesByTask);
  const tablesMissing = usePMKanbanStore((s) => s.tablesMissing);
  const scopeGUID = usePMKanbanStore((s) => s.scopeGUID);
  const treeDragOver = usePMKanbanStore((s) => s.treeDrag?.overStageGUID ?? null);
  const setScope = usePMKanbanStore((s) => s.setScope);

  const readOnly = tablesMissing;
  const stages = tablesMissing ? DEFAULT_STAGE_ROWS : storeStages;
  const board = useMemo(
    () => buildKanbanBoard({ tasksById, tree, schedule, stages, statesByTask: tablesMissing ? {} : statesByTask, scopeGUID }),
    [tasksById, tree, schedule, stages, statesByTask, tablesMissing, scopeGUID]
  );
  const scopeRow = scopeGUID ? tasksById[scopeGUID] : undefined;
  const scopeStage = useMemo(
    () => (scopeRow && !isKanbanCardRow(scopeRow, tree) ? derivedKanbanStage(scopeRow.rowGUID, tasksById, tree, stages, statesByTask) : null),
    [scopeRow, tree, tasksById, stages, statesByTask]
  );

  // ---- scope follows the tree: a selected stage = its subtree; a task outside the scope = whole project ----
  useEffect(() => {
    if (!selectedGUID) return;
    const s = usePMStore.getState();
    const row = s.tasksById[selectedGUID];
    if (!row) return;
    if (!isKanbanCardRow(row, s.tree)) setScope(selectedGUID);
    else {
      const cur = usePMKanbanStore.getState().scopeGUID;
      if (cur && !isInside(selectedGUID, cur, s.tree.parentById)) setScope(null);
    }
  }, [selectedGUID, setScope]);

  // ---- geometry (also published to the tree -> board bridge) ----
  const colW = kanbanColumnWidth(width);
  const [area, setArea] = useState({ y: 0, h: 0 });
  const onAreaLayout = (e: LayoutChangeEvent) => {
    const { y, height: h } = e.nativeEvent.layout;
    setArea((a) => (a.y === y && a.h === h ? a : { y, h }));
  };
  useEffect(() => {
    if (!bridge) return;
    bridge.boardLeft.value = boardLeft;
    bridge.boardTop.value = area.y;
    bridge.columnCount.value = board.columns.length;
    bridge.columnWidth.value = colW;
  }, [bridge, boardLeft, area.y, board.columns.length, colW]);

  // ---- drag & drop inside the board ----
  const dropRef = useRef<DropProviderRef>(null);
  const lastDrag = useRef<DragPayload | null>(null);
  const cardRefs = useRef(new Map<string, View>());
  const [epoch, setEpoch] = useState(0);
  const [draggingStage, setDraggingStage] = useState<string | null>(null);
  const registerRef = useCallback((guid: string, v: View | null) => {
    if (v) cardRefs.current.set(guid, v);
    else cardRefs.current.delete(guid);
  }, []);
  const refreshDropZones = useCallback(() => dropRef.current?.requestPositionUpdate(), []);
  useEffect(() => {
    const t = setTimeout(refreshDropZones, 50);
    return () => clearTimeout(t);
  }, [board, area, width, height, refreshDropZones]);

  const boardRef = useRef(board);
  boardRef.current = board;

  const onDropCard = useCallback(
    async (data: PMKanbanCardDragData, stageGUID: string) => {
      const col = boardRef.current.columns.find((c) => c.stage.rowGUID === stageGUID);
      if (!col) return;
      const drag = lastDrag.current;
      const others = col.cards.filter((c) => c.guid !== data.guid);
      let index: number | undefined;
      if (drag && others.length) {
        const [self, ...boxes] = await Promise.all([measureBox(cardRefs.current.get(data.guid)), ...others.map((c) => measureBox(cardRefs.current.get(c.guid)))]);
        const centerY = drag.y + drag.ty + (self?.height ?? 80) / 2;
        const i = boxes.findIndex((b) => !!b && centerY < b.pageY + b.height / 2);
        const anchor = i >= 0 ? others[i].guid : null;
        index = anchor ? col.cards.findIndex((c) => c.guid === anchor) : col.cards.length;
      }
      kanban.moveTasksToStage([data.guid], stageGUID, index);
    },
    [kanban]
  );
  const onDragStart = useCallback((data: PMKanbanCardDragData) => {
    lastDrag.current = null;
    setDraggingStage(data.stageGUID);
    usePMStore.getState().setSelected(data.guid);
  }, []);
  const onDragEnd = useCallback(() => {
    // after the library has processed the drop: remount the cards (drops the Draggable translation)
    setTimeout(() => {
      setDraggingStage(null);
      setEpoch((e) => e + 1);
    }, 60);
  }, []);

  const onSelect = useCallback((guid: string) => usePMStore.getState().revealRow(guid), []);
  const onEdit = useCallback((guid: string) => crud.edit(guid), [crud]);
  const onMoveBy = useCallback(
    (guid: string, dir: -1 | 1) => {
      const b = boardRef.current;
      const ci = b.columnOfTask[guid];
      const target = ci === undefined ? undefined : b.columns[ci + dir];
      if (target) kanban.moveTasksToStage([guid], target.stage.rowGUID);
    },
    [kanban]
  );

  const onHScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (bridge) bridge.scrollX.value = e.nativeEvent.contentOffset.x;
    },
    [bridge]
  );

  const [stagesOpen, setStagesOpen] = useState(false);
  const columnsHeight = Math.max(160, (area.h || height) - PM_KANBAN_PADDING * 2);
  const waiting = !tablesMissing && (!loaded || !storeStages.length);

  return (
    <View style={{ width, height, backgroundColor: palette.background }} testID="pm-kanban-dashboard">
      <PMKanbanToolbar
        crud={crud}
        palette={palette}
        scopeName={scopeRow ? scopeRow.rowJSON?.name || '(no name)' : null}
        scopeStage={scopeStage}
        cardCount={board.cardCount}
        onClearScope={() => setScope(null)}
        onOpenStages={() => setStagesOpen(true)}
      />
      {tablesMissing && (
        <View style={[styles.banner, { borderColor: palette.error }]}>
          <Text style={{ color: palette.error, fontSize: 12 }}>
            Read-only: the Kanban tables are missing - run kit8/sql/init/create_pm_kanban_tables.sql in Supabase.
          </Text>
        </View>
      )}
      {waiting ? (
        <View style={styles.center} onLayout={onAreaLayout}>
          <ActivityIndicatorCircleApp testID="pm-kanban-loading" />
        </View>
      ) : (
        <DropProvider ref={dropRef} onDragging={(p) => (lastDrag.current = p)}>
          <ScrollView
            style={{ flex: 1 }}
            onLayout={onAreaLayout}
            onScrollEndDrag={refreshDropZones}
            onMomentumScrollEnd={refreshDropZones}
            scrollEventThrottle={32}
            onScroll={Platform.OS === 'web' ? refreshDropZones : undefined}
            nestedScrollEnabled
          >
            <ScrollView
              horizontal
              nestedScrollEnabled
              onScroll={onHScroll}
              scrollEventThrottle={16}
              onScrollEndDrag={refreshDropZones}
              onMomentumScrollEnd={refreshDropZones}
              contentContainerStyle={styles.row}
              testID="pm-kanban-columns"
            >
              {board.columns.map((col, i) => (
                <View key={col.stage.rowGUID} style={{ marginRight: i < board.columns.length - 1 ? PM_KANBAN_GAP : 0 }}>
                  <PMKanbanColumn
                    column={col}
                    index={i}
                    columnCount={board.columns.length}
                    width={colW}
                    minHeight={columnsHeight}
                    palette={palette}
                    selectedGUID={selectedGUID}
                    readOnly={readOnly}
                    treeDragOver={treeDragOver === col.stage.rowGUID}
                    raised={draggingStage === col.stage.rowGUID}
                    epoch={epoch}
                    registerRef={registerRef}
                    onDropCard={onDropCard}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onMoveBy={onMoveBy}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </View>
              ))}
            </ScrollView>
          </ScrollView>
        </DropProvider>
      )}
      <PMKanbanStagesModalWindow projectGUID={projectGUID} projectName={projectName} visible={stagesOpen} onClose={() => setStagesOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: PM_KANBAN_PADDING },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, margin: 6, padding: 6 },
});
