// Kanban stage percent (kit8/pm/model/kanbanTypes.ts, kit8/pm/view/kanban/kanbanModel.ts, kanbanSettings.ts) - pure logic.
//   1..100 = FIXED stage: every card has the percent of the stage · 0 = MANUAL stage: the percent is typed on the card
import { buildTreeIndex, toLtreeLabel } from '../../../../kit8/pm/view/project/scheduling';
import {
  buildKanbanBoard,
  kanbanPercentForRow,
  kanbanTaskPercentOf,
  planKanbanMove,
  planKanbanTaskProgress,
  derivedKanbanProgress,
} from '../../../../kit8/pm/view/kanban/kanbanModel';
import {
  isKanbanStageManualPercent,
  isKanbanStagePercent,
  kanbanCardPercentOf,
  kanbanStagePercentOf,
  parseKanbanStagePercent,
  PM_KANBAN_DEFAULT_STAGES,
  PM_KANBAN_STANDARD_PERCENT,
} from '../../../../kit8/pm/model/kanbanTypes';
import type { PMProjectKanbanStageRow, PMTaskKanbanStateRow } from '../../../../kit8/pm/model/kanbanTypes';
import { autoUpdateTaskProgressFromKanbanOf, kanbanValuesOf } from '../../../../kit8/pm/view/project/settings/kanban/kanbanSettings';
import type { PMTaskRow } from '../../../../kit8/pm/model/types';

const P = '00000000-0000-4000-8000-000000000000';
const g = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const task = (guid: string, parentPath: string, order: number, name: string): PMTaskRow => ({
  rowGUID: guid,
  treePath: `${parentPath}.${toLtreeLabel(guid)}`,
  projectGUID: P,
  rowOwnerGUID: 'u',
  rowDuration: null,
  rowProgress: 0,
  orderInList: order,
  rowJSON: { rowKind: 'task', taskDescription: name, durationDays: 1 },
});
const stageRow = (guid: string, order: number, name: string): PMTaskRow => ({ ...task(guid, toLtreeLabel(P), order, name), rowJSON: { rowKind: 'stage', taskDescription: name, durationDays: 1 } });
const S1 = stageRow(g(1), 1, 'Stage 1');
const t1 = task(g(11), S1.treePath, 1, 'T1');
const t2 = task(g(12), S1.treePath, 2, 'T2');
const t3 = task(g(13), S1.treePath, 3, 'T3');
const tasks = [S1, t1, t2, t3];
const tasksById = Object.fromEntries(tasks.map((t) => [t.rowGUID, t]));
const tree = buildTreeIndex(tasks);
const st = (id: string, order: number, name: string, p?: number, code?: string): PMProjectKanbanStageRow => ({
  rowGUID: id,
  rowOwnerGUID: P,
  rowParentGUID: 'empty',
  orderInList: order,
  rowJSON: { stageName: name, ...(code ? { stageCode: code } : {}), ...(p !== undefined ? { stageProgressPercent: p } : {}) },
});
const stages = [st('wait', 1024, 'Waiting', 0), st('plan', 2048, 'Plan', 10), st('exec', 3072, 'Execute', 90)];
const state = (taskGUID: string, stageGUID: string, order = 1024, kanbanStageProgressPercent?: number): PMTaskKanbanStateRow => ({
  rowGUID: `s-${taskGUID}`,
  rowOwnerGUID: P,
  rowParentGUID: taskGUID,
  orderInList: order,
  rowJSON: { stageGUID, ...(kanbanStageProgressPercent !== undefined ? { kanbanStageProgressPercent } : {}) },
});

describe('stage percent helpers', () => {
  it('the default stages carry the standard percents (same as the SQL seed)', () => {
    expect(PM_KANBAN_DEFAULT_STAGES.map((s) => [s.stageCode, s.stageProgressPercent])).toEqual([['waiting', 0], ['plan', 10], ['analyse', 30], ['construct', 60], ['execute', 90]]);
    expect(PM_KANBAN_STANDARD_PERCENT).toEqual({ waiting: 0, plan: 10, analyse: 30, construct: 60, execute: 90 });
  });
  it('kanbanStagePercentOf: the stored percent, else the standard percent of the code, else 0', () => {
    expect(kanbanStagePercentOf({ stageName: 'x', stageProgressPercent: 45 })).toBe(45);
    expect(kanbanStagePercentOf({ stageName: 'x', stageCode: 'construct' })).toBe(60);
    expect(kanbanStagePercentOf({ stageName: 'x', stageCode: 'mine' })).toBe(0);
    expect(kanbanStagePercentOf({ stageName: 'x', stageCode: 'plan', stageProgressPercent: 0 })).toBe(0); // an explicit 0 is manual, not the standard
    expect(kanbanStagePercentOf({ stageName: 'x', stageProgressPercent: 150 })).toBe(100);
    expect(kanbanStagePercentOf(null)).toBe(0);
    expect(kanbanStagePercentOf({ stageName: 'x', stageCode: 'toString' })).toBe(0); // no prototype keys
  });
  it('manual = 0; fixed = 1..100', () => {
    expect(isKanbanStageManualPercent({ stageName: 'x', stageProgressPercent: 0 })).toBe(true);
    expect(isKanbanStageManualPercent({ stageName: 'x', stageProgressPercent: 1 })).toBe(false);
    expect(isKanbanStageManualPercent({ stageName: 'x' })).toBe(true);
  });
  it('isKanbanStagePercent / parseKanbanStagePercent accept whole numbers 0..100 only', () => {
    for (const ok of [0, 1, 50, 100]) expect(isKanbanStagePercent(ok)).toBe(true);
    for (const bad of [-1, 101, 1.5, NaN, '5', null, undefined]) expect(isKanbanStagePercent(bad)).toBe(false);
    expect(parseKanbanStagePercent('')).toBe(0);
    expect(parseKanbanStagePercent(' 45 ')).toBe(45);
    expect(parseKanbanStagePercent('100')).toBe(100);
    for (const bad of ['101', '4.5', '-1', 'x', '1000']) expect(parseKanbanStagePercent(bad)).toBeNull();
  });
  it('kanbanCardPercentOf: fixed stage = the stage, manual stage = the percent typed on the card', () => {
    const fixed = { stageName: 'x', stageProgressPercent: 30 };
    const manual = { stageName: 'x', stageProgressPercent: 0 };
    expect(kanbanCardPercentOf(fixed, state('t', 's', 1, 77))).toBe(30);
    expect(kanbanCardPercentOf(manual, state('t', 's', 1, 77))).toBe(77);
    expect(kanbanCardPercentOf(manual, undefined)).toBe(0);
  });
});

describe('board percent', () => {
  it('cards get the effective percent and percentFixed from their column', () => {
    const statesByTask = { [t2.rowGUID]: state(t2.rowGUID, 'plan', 1024, 77), [t3.rowGUID]: state(t3.rowGUID, 'wait', 1024, 40) };
    const b = buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask, scopeGUID: null });
    const byName = (n: string) => b.columns.flatMap((c) => c.cards).find((c) => c.name === n)!;
    expect(byName('T1')).toMatchObject({ kanbanStageProgressPercent: 0, percentFixed: false }); // no state: first stage (manual)
    expect(byName('T2')).toMatchObject({ kanbanStageProgressPercent: 10, percentFixed: true }); // the stored 77 is ignored
    expect(byName('T3')).toMatchObject({ kanbanStageProgressPercent: 40, percentFixed: false });
  });
  it('kanbanTaskPercentOf / kanbanPercentForRow / derivedKanbanProgress follow the stage', () => {
    const statesByTask = { [t1.rowGUID]: state(t1.rowGUID, 'exec'), [t2.rowGUID]: state(t2.rowGUID, 'plan'), [t3.rowGUID]: state(t3.rowGUID, 'wait', 1024, 50) };
    expect(kanbanTaskPercentOf(t1.rowGUID, stages, statesByTask)).toBe(90);
    expect(kanbanTaskPercentOf(t3.rowGUID, stages, statesByTask)).toBe(50);
    expect(kanbanPercentForRow(t2.rowGUID, tasksById, tree, stages, statesByTask)).toBe(10);
    expect(kanbanPercentForRow(S1.rowGUID, tasksById, tree, stages, statesByTask)).toBe(Math.round((90 + 10 + 50) / 3));
    expect(derivedKanbanProgress(S1.rowGUID, tasksById, tree, statesByTask, stages)).toBe(50);
    // without stages the stored percents count (old callers)
    expect(derivedKanbanProgress(S1.rowGUID, tasksById, tree, statesByTask)).toBe(Math.round(50 / 3));
  });
  it('a kanbanNoState task keeps the stored percent', () => {
    const statesByTask = { [t1.rowGUID]: state(t1.rowGUID, 'kanbanNoState', 1, 33) };
    expect(kanbanTaskPercentOf(t1.rowGUID, stages, statesByTask)).toBe(33);
  });
});

describe('planKanbanMove into a fixed / manual stage', () => {
  const board = () => buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask: {}, scopeGUID: null });
  it('a FIXED target stage stores its percent on the moved cards', () => {
    const w = planKanbanMove(board(), {}, [t1.rowGUID], 'exec');
    expect(w).toEqual([{ taskGUID: t1.rowGUID, stageGUID: 'exec', orderInList: 1024, kanbanStageProgressPercent: 90 }]);
  });
  it('a MANUAL target stage keeps the percent typed before', () => {
    const w = planKanbanMove(board(), { [t1.rowGUID]: state(t1.rowGUID, 'plan', 1024, 66) }, [t1.rowGUID], 'wait');
    expect(w.find((x) => x.taskGUID === t1.rowGUID)).toMatchObject({ stageGUID: 'wait', kanbanStageProgressPercent: 66 });
  });
});

describe('planKanbanTaskProgress (switch autoUpdateTaskProgressPercentFromKanban on)', () => {
  const board = (statesByTask: Record<string, PMTaskKanbanStateRow> = {}) => buildKanbanBoard({ tasksById, tree, schedule: {}, stages, statesByTask, scopeGUID: null });
  it('a FIXED target stage sets the progress of the tasks that change column', () => {
    expect(planKanbanTaskProgress(board(), [t1.rowGUID, t2.rowGUID], 'exec')).toEqual([
      { taskGUID: t1.rowGUID, progress: 90 },
      { taskGUID: t2.rowGUID, progress: 90 },
    ]);
  });
  it('tasks already in the column (a reorder) are skipped', () => {
    const b = board({ [t2.rowGUID]: state(t2.rowGUID, 'plan') });
    expect(planKanbanTaskProgress(b, [t1.rowGUID, t2.rowGUID], 'plan')).toEqual([{ taskGUID: t1.rowGUID, progress: 10 }]);
  });
  it('a MANUAL target stage or an unknown stage sets nothing', () => {
    expect(planKanbanTaskProgress(board(), [t2.rowGUID], 'wait')).toEqual([]);
    expect(planKanbanTaskProgress(board(), [t2.rowGUID], 'nope')).toEqual([]);
  });
  it('a duplicate task is planned once', () => {
    expect(planKanbanTaskProgress(board(), [t1.rowGUID, t1.rowGUID], 'plan')).toHaveLength(1);
  });
});

describe('kanbanSettings', () => {
  it('the switch is OFF while missing or not true', () => {
    expect(autoUpdateTaskProgressFromKanbanOf(null)).toBe(false);
    expect(autoUpdateTaskProgressFromKanbanOf({})).toBe(false);
    expect(autoUpdateTaskProgressFromKanbanOf({ autoUpdateTaskProgressPercentFromKanban: 'true' })).toBe(false);
    expect(autoUpdateTaskProgressFromKanbanOf({ autoUpdateTaskProgressPercentFromKanban: true })).toBe(true);
    expect(kanbanValuesOf(undefined)).toEqual({ autoUpdateTaskProgressPercentFromKanban: false });
  });
});
