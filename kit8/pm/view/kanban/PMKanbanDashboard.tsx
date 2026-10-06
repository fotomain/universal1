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
import PMContextMenu from '../../inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../inner/menu/PMMenuItem';
import { compareFilterValues, treeCellFilterValue, treeColumnDataType } from '../tree/filter/treeColumnFilter';
import { treeColumnTitle } from '../tree/columns/treeColumns';
import { pmT } from '../../i18n/pmT';

/** Tree columns a Kanban column can be sorted by (in the tree's column order; custom columns too). */
const SORTABLE_BUILTIN = ['name', 'wbs', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanbanStageProgressPercent'];

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
  /** uxui.hideGanttToolBar: no Kanban bar */
  hideToolbar?: boolean;
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

export default function PMKanbanDashboard({ projectGUID, width, height, palette, crud, kanban, bridge, boardLeft = 0, hideToolbar = false }: PMKanbanDashboardProps) {
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
  const columnSort = usePMKanbanStore((s) => s.columnSort);
  const checkedGUIDs = usePMStore((s) => s.checkedGUIDs);
  const treeColumnsOrder = usePMStore((s) => s.treeColumnsOrder);
  const customColumns = usePMStore((s) => s.customColumns);
  const noStateFilterOn = usePMStore((s) => s.treeColumnsFilters.kanban?.filterVariantForColumn === 'isEmpty');
  const kanbanFilterActive = usePMStore((s) => !!s.treeColumnsFilters.kanban || !!s.treeColumnsFilters.kanbanStageProgressPercent || s.treeColumnSort?.key === 'kanban' || s.treeColumnSort?.key === 'kanbanStageProgressPercent');

  const readOnly = tablesMissing;
  const stages = tablesMissing ? DEFAULT_STAGE_ROWS : storeStages;
  const board = useMemo(
    () => buildKanbanBoard({ tasksById, tree, schedule, stages, statesByTask: tablesMissing ? {} : statesByTask, scopeGUID }),
    [tasksById, tree, schedule, stages, statesByTask, tablesMissing, scopeGUID]
  );
  // the tree's Kanban filter / sort reads the Kanban store: re-apply it when the states change
  useEffect(() => {
    if (kanbanFilterActive) usePMStore.getState().refreshTreeRows();
  }, [kanbanFilterActive, statesByTask, storeStages]);

  // ---- sorting of single columns by a tree column (store_kanban.columnSort) ----
  const sortFields = useMemo(() => {
    const keys = [...treeColumnsOrder.filter((k) => SORTABLE_BUILTIN.includes(k) || customColumns.some((c) => c.key === k))];
    for (const k of SORTABLE_BUILTIN) if (!keys.includes(k as any)) keys.push(k as any);
    return keys.map((key) => ({ key: key as string, title: key === 'wbs' ? '# (hierarchy number)' : key === 'progress' ? 'Progress %' : treeColumnTitle(key, customColumns) }));
  }, [treeColumnsOrder, customColumns]);
  const columns = useMemo(() => {
    const ctx = { tasksById, schedule, tree, customColumns, kanbanStages: stages, kanbanStates: statesByTask };
    return board.columns.map((col) => {
      const sort = columnSort[col.stage.rowGUID];
      const type = sort ? treeColumnDataType(sort.key, customColumns) : null;
      if (!sort || !type) return col;
      const t: any = String(type).toLowerCase();
      const dir = sort.direction === 'desc' ? -1 : 1;
      const keyed = col.cards.map((c, i) => ({ c, i, v: treeCellFilterValue(sort.key, c.guid, ctx) }));
      const empty = (v: any) => v === null || v === undefined || v === '';
      keyed.sort((a, b) => {
        const ea = empty(a.v);
        const eb = empty(b.v);
        if (ea || eb) return ea === eb ? a.i - b.i : ea ? 1 : -1; // empty values last
        return dir * compareFilterValues(a.v as any, b.v as any, t) || a.i - b.i;
      });
      return { ...col, cards: keyed.map((k) => k.c) };
    });
  }, [board, columnSort, tasksById, schedule, tree, customColumns, stages, statesByTask]);

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
  const rootRef = useRef<View>(null);
  const droppedOnColumn = useRef(false);

  /** Cards moved together with `guid`: every checked card when it is checked (multi selection). */
  const cardsWith = useCallback((guid: string): string[] => {
    const s = usePMStore.getState();
    if (!s.checkedGUIDs[guid]) return [guid];
    const leaves = new Set<string>();
    for (const g of Object.keys(s.checkedGUIDs)) for (const l of isKanbanCardRow(s.tasksById[g], s.tree) ? [g] : []) leaves.add(l);
    leaves.add(guid);
    return Array.from(leaves).sort((a, b) => (s.rowIndexById[a] ?? 1e9) - (s.rowIndexById[b] ?? 1e9));
  }, []);

  const onDropCard = useCallback(
    async (data: PMKanbanCardDragData, stageGUID: string) => {
      droppedOnColumn.current = true;
      const col = boardRef.current.columns.find((c) => c.stage.rowGUID === stageGUID);
      if (!col) return;
      const moving = cardsWith(data.guid);
      if (moving.length > 1) {
        // multi selection: the checked cards go to the end of the column, like one task
        kanban.moveTasksToStage(moving, stageGUID);
        return;
      }
      const drag = lastDrag.current;
      const sorted = !!usePMKanbanStore.getState().columnSort[stageGUID];
      const others = col.cards.filter((c) => c.guid !== data.guid);
      let index: number | undefined;
      if (drag && others.length && !sorted) {
        const [self, ...boxes] = await Promise.all([measureBox(cardRefs.current.get(data.guid)), ...others.map((c) => measureBox(cardRefs.current.get(c.guid)))]);
        const centerY = drag.y + drag.ty + (self?.height ?? 80) / 2;
        const i = boxes.findIndex((b) => !!b && centerY < b.pageY + b.height / 2);
        const anchor = i >= 0 ? others[i].guid : null;
        index = anchor ? col.cards.findIndex((c) => c.guid === anchor) : col.cards.length;
      }
      kanban.moveTasksToStage([data.guid], stageGUID, index);
    },
    [kanban, cardsWith]
  );
  const onDragStart = useCallback((data: PMKanbanCardDragData) => {
    lastDrag.current = null;
    droppedOnColumn.current = false;
    setDraggingStage(data.stageGUID);
    usePMStore.getState().setSelected(data.guid);
  }, []);
  const onDragEnd = useCallback(
    (data?: PMKanbanCardDragData) => {
      // after the library has processed the drop: remount the cards (drops the Draggable translation)
      setTimeout(() => {
        setDraggingStage(null);
        setEpoch((e) => e + 1);
        // released over the TREE (left of the board), not on a column: the card(s) leave the board = kanbanNoState
        const drag = lastDrag.current;
        const node: any = rootRef.current;
        if (!data || droppedOnColumn.current || !drag || !node?.measureInWindow || boardLeft <= 0) return;
        node.measureInWindow((bx: number) => {
          if (drag.x + drag.tx + 40 < bx) kanban.clearTasksKanbanState(cardsWith(data.guid));
        });
      }, 60);
    },
    [kanban, cardsWith, boardLeft]
  );

  const onSelect = useCallback((guid: string) => usePMStore.getState().revealRow(guid), []);
  const onEdit = useCallback((guid: string) => crud.edit(guid), [crud]);
  const onMoveBy = useCallback(
    (guid: string, dir: -1 | 1) => {
      const b = boardRef.current;
      const ci = b.columnOfTask[guid];
      const target = ci === undefined ? undefined : b.columns[ci + dir];
      if (target) kanban.moveTasksToStage(cardsWith(guid), target.stage.rowGUID);
    },
    [kanban, cardsWith]
  );
  const onToggleChecked = useCallback((guid: string) => usePMStore.getState().toggleChecked(guid), []);

  // ---- column menus: ⋮ / right-click / long-press of a header, and the sort button ----
  const [colMenu, setColMenu] = useState<{ kind: 'menu' | 'sort'; stageGUID: string; x: number; y: number } | null>(null);
  const onOpenMenu = useCallback((stageGUID: string, x: number, y: number) => setColMenu({ kind: 'menu', stageGUID, x, y }), []);
  const onOpenSort = useCallback((stageGUID: string, x: number, y: number) => setColMenu({ kind: 'sort', stageGUID, x, y }), []);
  const colMenuItems = useMemo((): PMMenuItemProps[] => {
    if (!colMenu) return [];
    const close = () => setColMenu(null);
    const col = columns.find((c) => c.stage.rowGUID === colMenu.stageGUID);
    const guids = col ? col.cards.map((c) => c.guid) : [];
    const pm = usePMStore.getState();
    const kst = usePMKanbanStore.getState();
    const sort = columnSort[colMenu.stageGUID];
    const sortItems: PMMenuItemProps[] = [
      { testID: 'pm-kanban-sort-none', label: 'Saved card order', icon: 'drag_indicator', checked: !sort, onPress: () => (close(), kst.setColumnSort(colMenu.stageGUID, null)) },
      ...sortFields.map((f) => ({
        testID: `pm-kanban-sort-${f.key}`,
        label: `${f.title}${sort?.key === f.key ? (sort.direction === 'asc' ? '  ↑' : '  ↓') : ''}`,
        icon: sort?.key === f.key && sort.direction === 'asc' ? 'arrow_downward' : 'arrow_upward',
        checked: sort?.key === f.key,
        // pressing the sorted field again turns the direction round
        onPress: () => (close(), kst.setColumnSort(colMenu.stageGUID, { key: f.key, direction: sort?.key === f.key && sort.direction === 'asc' ? 'desc' : 'asc' })),
      })),
    ];
    if (colMenu.kind === 'sort') return sortItems;
    const allChecked = guids.length > 0 && guids.every((g) => pm.checkedGUIDs[g]);
    const others = board.columns.filter((c) => c.stage.rowGUID !== colMenu.stageGUID);
    return [
      {
        testID: 'pm-kanban-col-select-all',
        label: allChecked ? 'Deselect all tasks' : 'Select all tasks',
        icon: allChecked ? 'remove_done' : 'done_all',
        disabled: !guids.length,
        onPress: () => (close(), pm.setChecked(guids, !allChecked)),
      },
      {
        testID: 'pm-kanban-col-move-all',
        label: 'Move all tasks to…',
        icon: 'drive_file_move',
        disabled: !guids.length || !others.length,
        onPress: () => {},
        submenu: others.map((c) => ({
          testID: `pm-kanban-col-move-all-${c.stage.rowGUID}`,
          label: c.stage.rowJSON.stageName || '—',
          icon: 'arrow_forward',
          onPress: () => (close(), kanban.moveTasksToStage(guids, c.stage.rowGUID)),
        })),
      },
      {
        testID: 'pm-kanban-col-clear',
        label: 'Clear: all tasks to "No state"',
        icon: 'layers_clear',
        danger: true,
        disabled: !guids.length,
        onPress: () => (close(), kanban.clearTasksKanbanState(guids)),
      },
      { testID: 'pm-kanban-col-sort', label: 'Sort by', icon: 'sort', onPress: () => {}, submenu: sortItems },
    ];
  }, [colMenu, columns, board, columnSort, sortFields, kanban]);

  /** Kanban bar "No state" button: tree filter Kanban = Is empty (press again = filter off). */
  const toggleNoStateFilter = useCallback(() => {
    if (usePMStore.getState().treeColumnsFilters.kanban?.filterVariantForColumn === 'isEmpty') crud.setTreeColumnFilter('kanban' as any, null);
    else crud.setTreeColumnFilter('kanban' as any, { filterVariantForColumn: 'isEmpty' } as any);
  }, [crud]);

  const onProgressChange = useCallback(
    (guid: string, percent: number) => {
      kanban.setTaskKanbanProgress(guid, percent);
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
  // "Kanban Stages" asked from outside the board (main FAB): store_kanban.openStagesEditor(projectGUID)
  const stagesRequest = usePMKanbanStore((s) => s.stagesEditorProjectGUID);
  useEffect(() => {
    if (stagesRequest !== projectGUID) return;
    setStagesOpen(true);
    usePMKanbanStore.getState().openStagesEditor(null);
  }, [stagesRequest, projectGUID]);
  const columnsHeight = Math.max(160, (area.h || height) - PM_KANBAN_PADDING * 2);
  const waiting = !tablesMissing && (!loaded || !storeStages.length);

  return (
    <View ref={rootRef} collapsable={false} style={{ width, height, backgroundColor: palette.background }} testID="pm-kanban-dashboard">
      {!hideToolbar && <PMKanbanToolbar
        noStateCount={board.noStateGUIDs.length}
        noStateFilterOn={noStateFilterOn}
        onToggleNoStateFilter={toggleNoStateFilter}
        crud={crud}
        palette={palette}
        scopeName={scopeRow ? scopeRow.rowJSON?.name || '(no name)' : null}
        scopeStage={scopeStage}
        cardCount={board.cardCount}
        onClearScope={() => setScope(null)}
        onOpenStages={() => setStagesOpen(true)}
      />}
      {tablesMissing && (
        <View style={[styles.banner, { borderColor: palette.error }]}>
          <Text style={{ color: palette.error, fontSize: 12 }}>
            {pmT('Read-only: the Kanban tables are missing - run kit8/sql/init/done/create_tables.sql in Supabase.')}
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
              {columns.map((col, i) => (
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
                    onProgressChange={onProgressChange}
                    checkedGUIDs={checkedGUIDs}
                    onToggleChecked={onToggleChecked}
                    sortLabel={columnSort[col.stage.rowGUID] ? sortFields.find((f) => f.key === columnSort[col.stage.rowGUID].key)?.title : undefined}
                    sortDirection={columnSort[col.stage.rowGUID]?.direction}
                    onOpenSort={onOpenSort}
                    onOpenMenu={onOpenMenu}
                  />
                </View>
              ))}
            </ScrollView>
          </ScrollView>
        </DropProvider>
      )}
      {!!colMenu && (
        <PMContextMenu
          testID={colMenu.kind === 'sort' ? 'pm-kanban-sort-menu' : 'pm-kanban-column-menu'}
          x={colMenu.x}
          y={colMenu.y}
          width={230}
          caption={`${columns.find((c) => c.stage.rowGUID === colMenu.stageGUID)?.stage.rowJSON.stageName ?? ''}${colMenu.kind === 'sort' ? ' · sort by' : ''}`}
          items={colMenuItems}
          onClose={() => setColMenu(null)}
        />
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
