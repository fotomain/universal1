// Pure Kanban logic (kit8/pm/view/kanban/kanbanModel.ts).
import { buildTreeIndex, toLtreeLabel } from '../../../../kit8/pm/view/project/scheduling';
import {
  applyKanbanStateWrites,
  buildKanbanBoard,
  derivedKanbanStage,
  kanbanColumnAtX,
  kanbanLeavesOf,
  kanbanStageOfTask,
  planKanbanMove,
} from '../../../../kit8/pm/view/kanban/kanbanModel';
import type { PMTaskRow } from '../../../../kit8/pm/model/types';
import type { PMProjectKanbanStageRow, PMTaskKanbanStateRow } from '../../../../kit8/pm/model/kanbanTypes';

const P = '00000000-0000-4000-8000-000000000000';
const g = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (guid: string, parentPath: string, kind: 'stage' | 'task' | 'milestone', order: number, name: string, progress = 0): PMTaskRow => ({
  rowGUID: guid,
  treePath: `${parentPath}.${toLtreeLabel(guid)}`,
  projectGUID: P,
  rowOwnerGUID: 'u',
  rowDuration: null,
  rowProgress: progress,
  orderInList: order,
  rowJSON: { rowKind: kind, name, durationDays: kind === 'milestone' ? 0 : 1 },
});
const root = toLtreeLabel(P);
// Stage A (t1, t2, milestone m3) · Stage B (t4) · empty Stage C
const A = row(g(1), root, 'stage', 1, 'Stage A');
const t1 = row(g(11), A.treePath, 'task', 1, 'Task 1', 40);
const t2 = row(g(12), A.treePath, 'task', 2, 'Task 2');
const m3 = row(g(13), A.treePath, 'milestone', 3, 'Milestone 3');
const B = row(g(2), root, 'stage', 2, 'Stage B');
const t4 = row(g(21), B.treePath, 'task', 1, 'Task 4');
const C = row(g(3), root, 'stage', 3, 'Stage C');
const tasks = [A, t1, t2, m3, B, t4, C];
const tasksById = Object.fromEntries(tasks.map((t) => [t.rowGUID, t]));
const tree = buildTreeIndex(tasks);
const stage = (id: string, order: number, name: string): PMProjectKanbanStageRow => ({ rowGUID: id, rowOwnerGUID: P, rowParentGUID: 'empty', orderInList: order, rowJSON: { stageName: name } });
const stages = [stage('s-plan', 2048, 'Plan'), stage('s-wait', 1024, 'Waiting'), stage('s-exec', 3072, 'Execute')];
const state = (task: string, stageGUID: string, order: number): PMTaskKanbanStateRow => ({ rowGUID: `st-${task}`, rowOwnerGUID: P, rowParentGUID: task, orderInList: order, rowJSON: { stageGUID } });

describe('buildKanbanBoard', () => {
  it('puts every task / milestone (not stages) into the first stage when it has no state', () => {
    const b = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask: {}, scopeGUID: null });
    expect(b.columns.map((c) => c.stage.rowJSON.stageName)).toEqual(['Waiting', 'Plan', 'Execute']);
    expect(b.columns[0].cards.map((c) => c.name)).toEqual(['Task 1', 'Task 2', 'Milestone 3', 'Task 4']);
    expect(b.cardCount).toBe(4);
    expect(b.columns[0].cards[0]).toMatchObject({ progress: 40, parentName: 'Stage A', wbs: '1.1', kind: 'task' });
    expect(b.columns[0].cards[2].kind).toBe('milestone');
  });
  it('uses saved stages + order, unknown stages fall back to the first stage', () => {
    const statesByTask = { [t2.rowGUID]: state(t2.rowGUID, 's-exec', 2048), [t4.rowGUID]: state(t4.rowGUID, 's-exec', 1024), [t1.rowGUID]: state(t1.rowGUID, 'deleted', 1) };
    const b = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask, scopeGUID: null });
    expect(b.columns[2].cards.map((c) => c.name)).toEqual(['Task 4', 'Task 2']);
    expect(b.columns[0].cards.map((c) => c.name)).toEqual(['Task 1', 'Milestone 3']);
    expect(b.columnOfTask[t2.rowGUID]).toBe(2);
  });
  it('shows only the subtree of the scope row', () => {
    const b = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask: {}, scopeGUID: B.rowGUID });
    expect(b.columns[0].cards.map((c) => c.name)).toEqual(['Task 4']);
    const one = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask: {}, scopeGUID: t2.rowGUID });
    expect(one.cardCount).toBe(1);
    const unknown = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask: {}, scopeGUID: 'nope' });
    expect(unknown.cardCount).toBe(4);
  });
  it('no stages = no columns', () => {
    expect(buildKanbanBoard({ tasksById, tree, schedule: {}, stages: [], statesByTask: {}, scopeGUID: null }).columns).toEqual([]);
  });
});

describe('planKanbanMove', () => {
  const board = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask: {}, scopeGUID: null });
  it('appends to another column and numbers it', () => {
    expect(planKanbanMove(board, {}, [t2.rowGUID], 's-plan')).toEqual([{ taskGUID: t2.rowGUID, stageGUID: 's-plan', orderInList: 1024 }]);
  });
  it('reorders inside a column (index = place in the column as shown)', () => {
    const writes = planKanbanMove(board, {}, [m3.rowGUID], 's-wait', 0);
    expect(writes.map((w) => [tasksById[w.taskGUID].rowJSON.name, w.orderInList])).toEqual([
      ['Milestone 3', 1024],
      ['Task 1', 2048],
      ['Task 2', 3072],
      ['Task 4', 4096],
    ]);
  });
  it('writes only rows that change', () => {
    const statesByTask = { [t1.rowGUID]: state(t1.rowGUID, 's-plan', 1024) };
    const b = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask, scopeGUID: null });
    expect(planKanbanMove(b, statesByTask, [t4.rowGUID], 's-plan')).toEqual([{ taskGUID: t4.rowGUID, stageGUID: 's-plan', orderInList: 2048 }]);
  });
  it('moves a whole stage (its leaves) and ignores unknown columns', () => {
    const leaves = kanbanLeavesOf(A.rowGUID, tasksById, tree);
    expect(leaves).toEqual([t1.rowGUID, t2.rowGUID, m3.rowGUID]);
    expect(planKanbanMove(board, {}, leaves, 's-exec').map((w) => w.orderInList)).toEqual([1024, 2048, 3072]);
    expect(planKanbanMove(board, {}, leaves, 'nope')).toEqual([]);
    expect(kanbanLeavesOf(C.rowGUID, tasksById, tree)).toEqual([]);
  });
});

describe('stage helpers', () => {
  it('kanbanStageOfTask / derivedKanbanStage (earliest stage of the tasks inside)', () => {
    const sorted = [...stages].sort((a, b) => a.orderInList - b.orderInList);
    const statesByTask = { [t1.rowGUID]: state(t1.rowGUID, 's-exec', 1), [t2.rowGUID]: state(t2.rowGUID, 's-plan', 1), [m3.rowGUID]: state(m3.rowGUID, 's-exec', 2) };
    expect(kanbanStageOfTask(t1.rowGUID, sorted, statesByTask)).toBe('s-exec');
    expect(kanbanStageOfTask(t4.rowGUID, sorted, statesByTask)).toBe('s-wait');
    expect(kanbanStageOfTask(t4.rowGUID, [], statesByTask)).toBeNull();
    expect(derivedKanbanStage(A.rowGUID, tasksById, tree, stages, statesByTask)?.rowGUID).toBe('s-plan');
    expect(derivedKanbanStage(C.rowGUID, tasksById, tree, stages, statesByTask)).toBeNull();
  });
  it('applyKanbanStateWrites keeps other rows and replaces written ones', () => {
    const out = applyKanbanStateWrites([state('a', 's1', 1), state('b', 's1', 2)], P, [{ taskGUID: 'b', stageGUID: 's2', orderInList: 5 }, { taskGUID: 'c', stageGUID: 's2', orderInList: 6 }]);
    expect(out.map((r) => [r.rowParentGUID, r.rowJSON.stageGUID, r.orderInList])).toEqual([
      ['a', 's1', 1],
      ['b', 's2', 5],
      ['c', 's2', 6],
    ]);
  });
  it('kanbanColumnAtX: fixed columns with gaps', () => {
    // padding 10, width 100, gap 10 -> [10..110] col 0, [120..220] col 1
    expect(kanbanColumnAtX(5, 3, 100, 10, 10)).toBe(-1);
    expect(kanbanColumnAtX(50, 3, 100, 10, 10)).toBe(0);
    expect(kanbanColumnAtX(115, 3, 100, 10, 10)).toBe(-1);
    expect(kanbanColumnAtX(130, 3, 100, 10, 10)).toBe(1);
    expect(kanbanColumnAtX(400, 3, 100, 10, 10)).toBe(-1);
  });
});

it('planKanbanMove: dropping a card where it already is writes nothing', () => {
  const board = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask: {}, scopeGUID: null });
  expect(planKanbanMove(board, {}, [t2.rowGUID], 's-wait', 1)).toEqual([]);
  expect(planKanbanMove(board, {}, [t2.rowGUID], 's-wait', 2)).toEqual([]);
});
