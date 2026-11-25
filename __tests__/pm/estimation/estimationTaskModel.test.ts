// The estimate of one task: assigning lines to a task, the rule "an estimate belongs to a task only".
import { assignLinesToTask, canCarryEstimate, rootStagesByName, taskKindOf, taskRowsFromPlan, unassignedLines } from '../../../kit8/pm/estimation/model/estimationTaskModel';
import { newLineRow } from '../../../kit8/pm/estimation/model/estimationDocumentModel';

const sec = newLineRow('p', 'd', 'section', 'empty', 10, { title: 'Sec' });
const pos = newLineRow('p', 'd', 'position', sec.rowGUID, 20, { title: 'Pos' });
const own = newLineRow('p', 'd', 'position', 'empty', 30, { title: 'Own', taskGUID: 'c' });

describe('estimationTaskModel', () => {
  test('lines with no task are the unassigned ones', () => {
    expect(unassignedLines([sec, pos, own]).map((l) => l.rowJSON.title)).toEqual(['Sec', 'Pos']);
  });
  test('assigning a section gives its positions to the task too; the others stay', () => {
    const out = assignLinesToTask([sec, pos, own], [sec.rowGUID], 'a');
    expect(out.map((l) => l.rowJSON.taskGUID)).toEqual(['a', 'a', 'c']);
    expect(out[2]).toBe(own);
  });
  test('an estimate belongs to a TASK only: not a stage (also an empty one), not a milestone, not a task with subtasks', () => {
    expect(canCarryEstimate('task', false)).toBe(true);
    expect(canCarryEstimate('stage', false)).toBe(false);
    expect(canCarryEstimate('milestone', false)).toBe(false);
    expect(canCarryEstimate('task', true)).toBe(false);
    expect(canCarryEstimate(undefined, false)).toBe(false);
  });
  test('lines are not given to a row that is no task', () => {
    const out = assignLinesToTask([sec, pos], [sec.rowGUID], 's', false);
    expect(out.map((l) => l.rowJSON.taskGUID)).toEqual([sec.rowJSON.taskGUID, pos.rowJSON.taskGUID]);
  });
});

test('the kind of a store task row is in rowJSON.rowKind (the row has no top level rowKind)', () => {
  expect(taskKindOf({ rowJSON: { rowKind: 'task' } })).toBe('task');
  expect(taskKindOf({ rowJSON: { rowKind: 'stage' } })).toBe('stage');
  expect(taskKindOf(undefined)).toBeUndefined();
});

describe('lines whose task is gone', () => {
  test('a line that names a task which is not in the tree any more is unassigned too (once the tasks are known)', () => {
    expect(unassignedLines([own], new Set(['x'])).map((l) => l.rowJSON.title)).toEqual(['Own']);
    expect(unassignedLines([own], new Set(['c'])).map((l) => l.rowJSON.title)).toEqual([]);
    // the tasks are not known yet (empty set / none): nothing is called unassigned by mistake
    expect(unassignedLines([own], new Set())).toEqual([]);
    expect(unassignedLines([own])).toEqual([]);
  });
});

describe('the task plan -> task rows of the project', () => {
  const P = '11111111-1111-1111-1111-111111111111';
  const plan = [
    { rowGUID: 'aaaaaaaa-0000-0000-0000-000000000001', parentGUID: null, kind: 'stage' as const, name: 'Foundations' },
    { rowGUID: 'aaaaaaaa-0000-0000-0000-000000000002', parentGUID: 'aaaaaaaa-0000-0000-0000-000000000001', kind: 'task' as const, name: 'Slab' },
    { rowGUID: 'aaaaaaaa-0000-0000-0000-000000000003', parentGUID: 'aaaaaaaa-0000-0000-0000-000000000001', kind: 'task' as const, name: 'Walls' },
  ];
  test('rows have the path under their parent, the owner, the kind, the name and an order that grows', () => {
    const rows = taskRowsFromPlan(plan, { projectGUID: P, ownerGUID: 'u1' });
    expect(rows.map((r) => r.rowJSON.rowKind)).toEqual(['stage', 'task', 'task']);
    expect(rows[0].treePath).toBe('11111111_1111_1111_1111_111111111111.aaaaaaaa_0000_0000_0000_000000000001');
    expect(rows[1].treePath).toBe(`${rows[0].treePath}.aaaaaaaa_0000_0000_0000_000000000002`);
    expect(rows.every((r) => r.rowOwnerGUID === 'u1' && r.projectGUID === P)).toBe(true);
    expect(rows[1].orderInList).toBeLessThan(rows[2].orderInList);
  });
  test('new rows go AFTER the rows that exist; a parent that exists already gives the path', () => {
    const existing = taskRowsFromPlan([{ rowGUID: 'bbbbbbbb-0000-0000-0000-000000000001', parentGUID: null, kind: 'stage', name: 'Roof' }], { projectGUID: P, ownerGUID: 'u1' });
    const out = taskRowsFromPlan([
      { rowGUID: 'cccccccc-0000-0000-0000-000000000001', parentGUID: null, kind: 'stage', name: 'Walls' },
      { rowGUID: 'cccccccc-0000-0000-0000-000000000002', parentGUID: 'bbbbbbbb-0000-0000-0000-000000000001', kind: 'task', name: 'Tiles' },
    ], { projectGUID: P, ownerGUID: 'u1', existing });
    expect(out[0].orderInList).toBeGreaterThan(existing[0].orderInList);
    expect(out[1].treePath.startsWith(`${existing[0].treePath}.`)).toBe(true);
    expect(out[1].orderInList).toBeGreaterThan(0);
  });
  test('the stages directly under the project by name (a task is not a stage)', () => {
    const rows = taskRowsFromPlan([...plan, { rowGUID: 'dddddddd-0000-0000-0000-000000000001', parentGUID: null, kind: 'task', name: 'Loose task' }], { projectGUID: P, ownerGUID: 'u1' });
    expect([...rootStagesByName(rows)]).toEqual([['Foundations', 'aaaaaaaa-0000-0000-0000-000000000001']]);
  });
});
