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

// ---- kanbanNoState: stageGUID 'kanbanNoState' = in no column (like empty) ----
import { isTaskKanbanNoState, kanbanStageForRow, planKanbanClear } from '../../../../kit8/pm/view/kanban/kanbanModel';
import { PM_KANBAN_NO_STATE } from '../../../../kit8/pm/model/kanbanTypes';
import { compileTreeColumnFilter, treeCellFilterValue, treeColumnCanBeEmpty } from '../../../../kit8/pm/view/tree/filter/treeColumnFilter';

describe('kanbanNoState', () => {
  const noState = { [t1.rowGUID]: state(t1.rowGUID, PM_KANBAN_NO_STATE, 1024), [t2.rowGUID]: state(t2.rowGUID, 's-exec', 1024) };

  it('a task with kanbanNoState is in NO column and is counted apart', () => {
    const b = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask: noState, scopeGUID: null });
    expect(b.columns.flatMap((c) => c.cards.map((x) => x.name))).not.toContain('Task 1');
    expect(b.noStateGUIDs).toEqual([t1.rowGUID]);
    expect(b.cardCount).toBe(3);
    expect(b.columnOfTask[t1.rowGUID]).toBeUndefined();
    expect(kanbanStageOfTask(t1.rowGUID, stages, noState)).toBeNull();
    expect(isTaskKanbanNoState(t1.rowGUID, noState)).toBe(true);
    expect(isTaskKanbanNoState(t4.rowGUID, noState)).toBe(false); // no row = first stage
  });

  it('planKanbanClear writes kanbanNoState once and keeps the stage progress %', () => {
    const st = { [t2.rowGUID]: { ...state(t2.rowGUID, 's-exec', 2048), rowJSON: { stageGUID: 's-exec', kanbanStageProgressPercent: 70 } } };
    const writes = planKanbanClear(st, [t2.rowGUID, t4.rowGUID, t2.rowGUID]);
    expect(writes).toEqual([
      { taskGUID: t2.rowGUID, stageGUID: PM_KANBAN_NO_STATE, orderInList: 2048, kanbanStageProgressPercent: 70 },
      { taskGUID: t4.rowGUID, stageGUID: PM_KANBAN_NO_STATE, orderInList: 1024 },
    ]);
    const after = Object.fromEntries(applyKanbanStateWrites(Object.values(st), P, writes).map((s) => [s.rowParentGUID, s]));
    expect(planKanbanClear(after, [t2.rowGUID, t4.rowGUID])).toEqual([]); // already there
  });

  it('moving a kanbanNoState task onto a column brings it back', () => {
    const b = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask: noState, scopeGUID: null });
    const writes = planKanbanMove(b, noState, [t1.rowGUID], 's-plan');
    expect(writes).toEqual([{ taskGUID: t1.rowGUID, stageGUID: 's-plan', orderInList: 1024 }]);
  });

  it('tree cell: task = null stage; stage row = earliest stage of its tasks, null when all have no state', () => {
    expect(kanbanStageForRow(t1.rowGUID, tasksById, tree, stages, noState)).toBeNull();
    expect(kanbanStageForRow(t2.rowGUID, tasksById, tree, stages, noState)?.rowGUID).toBe('s-exec');
    expect(kanbanStageForRow(A.rowGUID, tasksById, tree, stages, noState)?.rowGUID).toBe('s-wait'); // m3 has no row
    const all = Object.fromEntries([t1, t2, m3].map((t) => [t.rowGUID, state(t.rowGUID, PM_KANBAN_NO_STATE, 1)]));
    expect(kanbanStageForRow(A.rowGUID, tasksById, tree, stages, all)).toBeNull();
    expect(kanbanStageForRow(C.rowGUID, tasksById, tree, stages, all)?.rowGUID).toBe('s-wait'); // empty stage
  });

  it('tree filter: Kanban "Is empty" finds the kanbanNoState tasks', () => {
    const sorted = [...stages].sort((a, b) => a.orderInList - b.orderInList);
    const ctx = { tasksById, schedule: {}, tree, customColumns: [], kanbanStages: sorted, kanbanStates: noState };
    expect(treeColumnCanBeEmpty('kanban')).toBe(true);
    const f = compileTreeColumnFilter({ filterVariantForColumn: 'isEmpty' } as any, 'text') as any;
    expect(f.test(treeCellFilterValue('kanban', t1.rowGUID, ctx))).toBe(true);
    expect(f.test(treeCellFilterValue('kanban', t2.rowGUID, ctx))).toBe(false);
    expect(treeCellFilterValue('kanban', t4.rowGUID, ctx)).toBe('Waiting');
    expect(treeCellFilterValue('kanban', A.rowGUID, ctx)).toBe('Waiting');
  });
});
