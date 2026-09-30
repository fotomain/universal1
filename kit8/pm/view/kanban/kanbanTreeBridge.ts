// Tree -> Kanban drag bridge ("thin custom bridge"): the task tree is a Skia canvas, so its rows cannot be
// react-native-reanimated-dnd Draggables. Instead the tree's own row-drag gestures (canvas drag and the
// panel's ⠿ handle) report the pointer here while it is to the right of the tree:
//
//   tree gesture (UI thread) ── kanbanBridgeMove(sx, sy) ──► shared values: active, x, y, hoverColumn
//        │                                                     ├─ PMKanbanTreeDragGhost follows x / y
//        │                                                     └─ onHover(column) -> store.treeDrag.overStageGUID
//        └─ release over a column ── onDrop(row, column) ──► kanban.moveTreeRowToStage(task | stage, column)
//
// Coordinates are SURFACE coordinates (PMGanttSurface: tree at x = 0, board at boardLeft); the board
// publishes its geometry (left, top of the columns, horizontal scroll, column count / width).

import { useMemo } from 'react';
import { runOnJS, SharedValue, useSharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../store/store_pm';
import { usePMKanbanStore } from '../../store/store_kanban';
import { PMKanbanCommands } from '../../crud/kanban/useKanbanCommands';
import { kanbanColumnAtX } from './kanbanModel';
import { PM_KANBAN_GAP, PM_KANBAN_PADDING } from './kanbanLayout';

export interface PMKanbanTreeBridge {
  /** 1 while a tree row is dragged over the board */
  active: SharedValue<number>;
  /** pointer, surface coordinates */
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** column under the pointer (-1 = none) */
  hoverColumn: SharedValue<number>;
  /** geometry, written by PMGanttSurface / PMKanbanDashboard */
  treeWidth: SharedValue<number>;
  boardLeft: SharedValue<number>;
  boardTop: SharedValue<number>;
  scrollX: SharedValue<number>;
  columnCount: SharedValue<number>;
  columnWidth: SharedValue<number>;
  /** JS side */
  onEnter: (rowIndex: number) => void;
  onHover: (column: number) => void;
  onDrop: (rowIndex: number, column: number) => void;
  onEnd: () => void;
}

/**
 * Worklet: called by the tree's drag gestures on every move. Returns true while the pointer is over
 * the board (the tree then ignores the move for its own reorder).
 */
export function kanbanBridgeMove(bridge: PMKanbanTreeBridge, sx: number, sy: number, rowIndex: number): boolean {
  'worklet';
  if (sx <= bridge.treeWidth.value) {
    if (bridge.active.value === 1) {
      bridge.active.value = 0;
      bridge.hoverColumn.value = -1;
      runOnJS(bridge.onHover)(-1);
    }
    return false;
  }
  if (bridge.active.value === 0) {
    bridge.active.value = 1;
    runOnJS(bridge.onEnter)(rowIndex);
  }
  bridge.x.value = sx;
  bridge.y.value = sy;
  const col =
    sy < bridge.boardTop.value
      ? -1
      : kanbanColumnAtX(sx - bridge.boardLeft.value + bridge.scrollX.value, bridge.columnCount.value, bridge.columnWidth.value, PM_KANBAN_GAP, PM_KANBAN_PADDING);
  if (col !== bridge.hoverColumn.value) {
    bridge.hoverColumn.value = col;
    runOnJS(bridge.onHover)(col);
  }
  return true;
}

/** Worklet: release. true = the drop went to the board (the tree must not reorder). */
export function kanbanBridgeRelease(bridge: PMKanbanTreeBridge, rowIndex: number): boolean {
  'worklet';
  if (bridge.active.value !== 1) return false;
  runOnJS(bridge.onDrop)(rowIndex, bridge.hoverColumn.value);
  return true;
}

/** Worklet: gesture finished (dropped or cancelled). */
export function kanbanBridgeFinish(bridge: PMKanbanTreeBridge) {
  'worklet';
  bridge.active.value = 0;
  bridge.hoverColumn.value = -1;
  runOnJS(bridge.onEnd)();
}

const stageAt = (column: number): string | null => {
  const stages = usePMKanbanStore.getState().stages;
  return column >= 0 && column < stages.length ? stages[column].rowGUID : null;
};

/** Creates the bridge (PMGanttSurface, Kanban mode). */
export function useKanbanTreeBridge(kanban: PMKanbanCommands): PMKanbanTreeBridge {
  const active = useSharedValue(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const hoverColumn = useSharedValue(-1);
  const treeWidth = useSharedValue(0);
  const boardLeft = useSharedValue(0);
  const boardTop = useSharedValue(0);
  const scrollX = useSharedValue(0);
  const columnCount = useSharedValue(0);
  const columnWidth = useSharedValue(0);
  return useMemo(
    () => ({
      active,
      x,
      y,
      hoverColumn,
      treeWidth,
      boardLeft,
      boardTop,
      scrollX,
      columnCount,
      columnWidth,
      onEnter: (rowIndex: number) => {
        const s = usePMStore.getState();
        const guid = s.visibleRows[rowIndex];
        const row = guid ? s.tasksById[guid] : undefined;
        if (row) usePMKanbanStore.getState().setTreeDrag({ guid, name: row.rowJSON?.name || '', overStageGUID: null });
      },
      onHover: (column: number) => usePMKanbanStore.getState().setTreeDragOver(stageAt(column)),
      onDrop: (rowIndex: number, column: number) => {
        const guid = usePMStore.getState().visibleRows[rowIndex];
        const stageGUID = stageAt(column);
        if (guid && stageGUID) kanban.moveTreeRowToStage(guid, stageGUID);
      },
      onEnd: () => usePMKanbanStore.getState().setTreeDrag(null),
    }),
    [active, x, y, hoverColumn, treeWidth, boardLeft, boardTop, scrollX, columnCount, columnWidth, kanban]
  );
}
