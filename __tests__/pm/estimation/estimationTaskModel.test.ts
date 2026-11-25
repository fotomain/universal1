// The estimate of one task: scope of a row (itself + below), the lines of a scope, assigning lines to a task, the state of the right pane.
import { assignLinesToTask, canCarryEstimate, lineCountsByTask, linesOfScope, stageTotals, taskPaneState, taskScopeGUIDs, unassignedLines } from '../../../kit8/pm/estimation/model/estimationTaskModel';
import { newLineRow } from '../../../kit8/pm/estimation/model/estimationDocumentModel';

const children = { s: ['a', 'b'], b: ['c'] };
const sec = newLineRow('p', 'd', 'section', 'empty', 10, { title: 'Sec' });
const pos = newLineRow('p', 'd', 'position', sec.rowGUID, 20, { title: 'Pos' });
const own = newLineRow('p', 'd', 'position', 'empty', 30, { title: 'Own', taskGUID: 'c' });

describe('estimationTaskModel', () => {
  test('the scope of a stage is the stage and everything below it; a leaf is only itself', () => {
    expect([...taskScopeGUIDs('s', children)].sort()).toEqual(['a', 'b', 'c', 's']);
    expect([...taskScopeGUIDs('a', children)]).toEqual(['a']);
  });
  test('a cycle in the tree cannot loop', () => {
    expect(taskScopeGUIDs('x', { x: ['y'], y: ['x'] }).size).toBe(2);
  });
  test('the lines of a scope are the lines whose task is in it; lines with no task are the unassigned ones', () => {
    const lines = [sec, pos, own];
    expect(linesOfScope(lines, new Set(['c'])).map((l) => l.rowJSON.title)).toEqual(['Own']);
    expect(linesOfScope(lines, taskScopeGUIDs('s', children)).map((l) => l.rowJSON.title)).toEqual(['Own']);
    expect(unassignedLines(lines).map((l) => l.rowJSON.title)).toEqual(['Sec', 'Pos']);
  });
  test('assigning a section gives its positions to the task too; the others stay', () => {
    const out = assignLinesToTask([sec, pos, own], [sec.rowGUID], 'a');
    expect(out.map((l) => l.rowJSON.taskGUID)).toEqual(['a', 'a', 'c']);
    expect(out[2]).toBe(own);
  });
  test('positions per task', () => {
    expect(lineCountsByTask(assignLinesToTask([sec, pos, own], [sec.rowGUID], 'a'))).toEqual({ a: 1, c: 1 });
  });
  test('pane state: nothing picked / whole estimate = all lines; a leaf takes new lines; a stage refuses them', () => {
    expect(taskPaneState(null, false, children)).toEqual({ scope: null, newLineTaskGUID: null, addBlocked: false });
    expect(taskPaneState('a', true, children).scope).toBeNull();
    expect(taskPaneState('a', false, children)).toMatchObject({ newLineTaskGUID: 'a', addBlocked: false });
    expect(taskPaneState('s', false, children)).toMatchObject({ newLineTaskGUID: null, addBlocked: true });
  });
  test('an estimate belongs to a TASK only: not a stage (also an empty one), not a milestone, not a task with subtasks', () => {
    expect(canCarryEstimate('task', false)).toBe(true);
    expect(canCarryEstimate('stage', false)).toBe(false);
    expect(canCarryEstimate('milestone', false)).toBe(false);
    expect(canCarryEstimate('task', true)).toBe(false);
    expect(canCarryEstimate(undefined, false)).toBe(false);
    const kinds: Record<string, string> = { a: 'task', s: 'stage', m: 'milestone' };
    const kindOf = (g: string) => kinds[g];
    expect(taskPaneState('a', false, children, kindOf)).toMatchObject({ newLineTaskGUID: 'a', addBlocked: false });
    expect(taskPaneState('m', false, children, kindOf)).toMatchObject({ newLineTaskGUID: null, addBlocked: true });
    // an EMPTY stage has no children but is still no task
    expect(taskPaneState('e', false, { ...children, e: [] }, (g) => (g === 'e' ? 'stage' : 'task'))).toMatchObject({ newLineTaskGUID: null, addBlocked: true });
  });
  test('lines are not given to a row that is no task', () => {
    const out = assignLinesToTask([sec, pos], [sec.rowGUID], 's', false);
    expect(out.map((l) => l.rowJSON.taskGUID)).toEqual([sec.rowJSON.taskGUID, pos.rowJSON.taskGUID]);
  });
  test('the totals of a stage: a row per row below it in tree order, stages add up their tasks, the total is the stage', () => {
    const ch = { s: ['a', 'b'], b: ['c'] };
    const info: Record<string, any> = { a: { rowKind: 'task', title: 'A' }, b: { rowKind: 'stage', title: 'B' }, c: { rowKind: 'task', title: 'C' } };
    const la = newLineRow('p', 'd', 'position', 'empty', 10, { title: 'la', taskGUID: 'a', qty: 2, unitLabour: 100 });
    const lc = newLineRow('p', 'd', 'position', 'empty', 10, { title: 'lc', taskGUID: 'c', qty: 1, unitLabour: 50 });
    const free = newLineRow('p', 'd', 'position', 'empty', 10, { title: 'free', qty: 9, unitLabour: 999 });
    const t = stageTotals('s', ch, (g) => info[g], [la, lc, free]);
    expect(t.rows.map((r) => [r.guid, r.depth, r.positions])).toEqual([['a', 0, 1], ['b', 0, 1], ['c', 1, 1]]);
    const cur = (g: string) => t.rows.find((r) => r.guid === g)!.cost.current;
    expect(cur('a')).toBeGreaterThan(0);
    expect(cur('b')).toBeCloseTo(cur('c'), 6); // the stage b has no own line
    expect(t.total.cost.current).toBeCloseTo(cur('a') + cur('c'), 6); // the line with no task is not in it
    expect(t.total.positions).toBe(2);
    expect(t.rows[0].title).toBe('A');
  });
});

import { taskKindOf } from '../../../kit8/pm/estimation/model/estimationTaskModel';
test('the kind of a store task row is in rowJSON.rowKind (the row has no top level rowKind)', () => {
  expect(taskKindOf({ rowJSON: { rowKind: 'task' } })).toBe('task');
  expect(taskKindOf({ rowJSON: { rowKind: 'stage' } })).toBe('stage');
  expect(taskKindOf(undefined)).toBeUndefined();
});
