/** @jest-environment jsdom */
// usePMCrud: every PM CRUD command end-to-end (command -> React Query mutation -> Supabase
// -> refetch -> Zustand store), against the in-memory database of fakeSupabaseTestKit.
import { mockApprove, mockRouter, mountPM, PMHarness, unmountPM } from './pmCrudHarnessTestKit';
import { act } from 'react';
import { DAY_MS } from '../../../kit8/pm/model/constants';

let h: PMHarness;
const run = async (fn: () => unknown) => {
  let out: unknown;
  await act(async () => {
    out = await fn();
  });
  await h.settle();
  return out;
};
const dbTask = (name: string) => h.db.rows('project_task_table').find((t) => t.rowJSON.name === name)!;
const dbDeps = () => h.db.rows('project_task_dependencies_table').filter((d) => d.projectGUID === h.P1);
const hasDep = (pred: string, succ: string) => dbDeps().some((d) => d.rowGUID === h.byName(succ).rowGUID && d.rowDependsOnGUID === h.byName(pred).rowGUID);
const g = (name: string) => h.byName(name).rowGUID as string;

beforeEach(async () => {
  mockApprove.mockReset();
  mockApprove.mockImplementation(async () => true);
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  h = await mountPM();
});
afterEach(unmountPM);

describe('add stage below / above / substage (row menu, hover panels, "+ Stage" menu)', () => {
  it('createStageBelow / createStageAbove on a stage: a sibling stage right after / before it', async () => {
    await run(() => h.crud.createStageBelow(g('Stage 1')));
    expect(h.childrenOf(null)).toEqual(['Stage 1', 'New stage', 'Stage 2']);
    await run(() => h.crud.createStageAbove(g('Stage 1')));
    expect(h.childrenOf(null)).toEqual(['New stage', 'Stage 1', 'New stage', 'Stage 2']);
  });

  it('on a task: next to the stage the task is in', async () => {
    await run(() => h.crud.createStageAbove(g('Task 122')));
    expect(h.childrenOf(null)).toEqual(['Stage 1', 'New stage', 'Stage 2']);
    expect(h.childrenOf(g('Stage 2'))).toEqual(['Task 121', 'Task 122', 'Task 123']);
  });

  it('createSubStage: a stage INSIDE the stage (last row); a substage is dragged like any other row', async () => {
    const sub = (await run(() => h.crud.createSubStage(g('Stage 1')))) as string;
    expect(h.db.task(sub)).toMatchObject({ rowJSON: { rowKind: 'stage', name: 'New substage' } });
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'Task 112', 'Task 113', 'New substage']);
    expect(h.store().tree.parentById[sub]).toBe(g('Stage 1'));
  });
});

describe('multi selection (round check boxes)', () => {
  it('toggleChecked / setChecked / clearChecked; deleted rows leave the selection', async () => {
    const s = () => h.store();
    s().toggleChecked(g('Task 111'));
    s().setChecked([g('Task 112'), g('Stage 2')], true);
    expect(Object.keys(s().checkedGUIDs).sort()).toEqual([g('Task 111'), g('Task 112'), g('Stage 2')].sort());
    s().toggleChecked(g('Task 111'));
    expect(s().checkedGUIDs[g('Task 111')]).toBeUndefined();
    s().clearChecked();
    expect(s().checkedGUIDs).toEqual({});
  });

  it('deleteTasks asks ONCE, deletes the checked rows (a row inside a checked stage goes with it) and clears the selection', async () => {
    const stage2 = g('Stage 2');
    h.store().setChecked([g('Task 111'), stage2, g('Task 122')], true);
    await run(() => h.crud.deleteTasks(Object.keys(h.store().checkedGUIDs)));
    expect(mockApprove).toHaveBeenCalledTimes(1);
    expect(h.childrenOf(null)).toEqual(['Stage 1']);
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 112', 'Task 113']);
    expect(h.store().checkedGUIDs).toEqual({});
  });
});
