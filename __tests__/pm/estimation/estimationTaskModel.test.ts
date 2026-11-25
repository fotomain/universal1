// The estimate of one task: assigning lines to a task, the rule "an estimate belongs to a task only".
import { assignLinesToTask, canCarryEstimate, taskKindOf, unassignedLines } from '../../../kit8/pm/estimation/model/estimationTaskModel';
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
