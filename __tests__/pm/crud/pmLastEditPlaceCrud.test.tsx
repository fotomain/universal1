/** @jest-environment jsdom */
// crud.recordEditPlace: rowJSON.lastEditPlace of a task - written only when the place changes, by the RPC that sends nothing else,
// seen at once in the cache / store, quiet on failure, never an undo step.
import { mountPM, PMHarness, unmountPM } from './pmCrudHarnessTestKit';
import { act } from 'react';
import { lastEditPlaceOf } from '../../../kit8/pm/model/lastEditPlace';

let h: PMHarness;
beforeEach(async () => {
  h = await mountPM();
});
afterEach(unmountPM);

const g = (name: string) => h.byName(name).rowGUID as string;
const rpcCalls = () => h.db.rpcCalls.filter((c) => c.fn === 'pm_set_task_last_edit_place');
/** the cache reaches the store on the next tick (React Query notifies in a timer) */
const tick = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};
/** past the 0.6 s the place waits before it is saved */
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
};
const dbPlace = (name: string) => lastEditPlaceOf(h.db.rows('project_task_table').find((t) => t.rowJSON.name === name)?.rowJSON);
const storePlace = (name: string) => lastEditPlaceOf(h.store().tasksById[g(name)]?.rowJSON);

describe('recordEditPlace', () => {
  it('shows in the store at once, is saved ~0.6 s later by the RPC, with the editor', async () => {
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'taskPage', section: 'finances', genus: 'materialGenus', lineGUID: 'line-1' }));
    await tick();
    expect(storePlace('Task 111')).toMatchObject({ surface: 'taskPage', section: 'finances', genus: 'materialGenus', lineGUID: 'line-1', by: h.owner });
    expect(rpcCalls()).toHaveLength(0);
    await flush();
    expect(rpcCalls()).toHaveLength(1);
    expect(rpcCalls()[0].args).toMatchObject({ p_task_guid: g('Task 111'), p_place: { v: 1, section: 'finances', lineGUID: 'line-1' } });
    expect(dbPlace('Task 111')).toMatchObject({ genus: 'materialGenus', lineGUID: 'line-1' });
  });

  it('the rest of rowJSON is not sent: nothing else of the task can be overwritten', async () => {
    const before = { ...h.db.rows('project_task_table').find((t) => t.rowJSON.name === 'Task 111')!.rowJSON };
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'editModal', section: 'TabUXUI' }));
    await flush();
    const after = h.db.rows('project_task_table').find((t) => t.rowJSON.name === 'Task 111')!.rowJSON;
    const { lastEditPlace: _p, ...rest } = after;
    expect(rest).toEqual(before);
    expect(Object.keys(rpcCalls()[0].args).sort()).toEqual(['p_place', 'p_task_guid']);
  });

  it('the same place again (any number of edits in one place) is not written again', async () => {
    const place = { surface: 'financesView' as const, section: 'finances', genus: 'timeGenus', lineGUID: 'l1' };
    for (let i = 0; i < 5; i++) act(() => h.crud.recordEditPlace(g('Task 111'), place));
    await flush();
    act(() => h.crud.recordEditPlace(g('Task 111'), place));
    await flush();
    expect(rpcCalls()).toHaveLength(1);
  });

  it('a quick series of places is ONE write with the last place', async () => {
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'taskPage', section: 'progress' }));
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'taskPage', section: 'kanbanProgress' }));
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'taskPage', section: 'dependencies' }));
    await flush();
    expect(rpcCalls()).toHaveLength(1);
    expect(dbPlace('Task 111')).toMatchObject({ section: 'dependencies' });
  });

  it('another task, another line = another write', async () => {
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'taskPage', section: 'finances', genus: 'timeGenus', lineGUID: 'a' }));
    await flush();
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'taskPage', section: 'finances', genus: 'timeGenus', lineGUID: 'b' }));
    act(() => h.crud.recordEditPlace(g('Task 112'), { surface: 'taskPage', section: 'progress' }));
    await flush();
    expect(rpcCalls()).toHaveLength(3);
    expect(dbPlace('Task 111')).toMatchObject({ lineGUID: 'b' });
    expect(dbPlace('Task 112')).toMatchObject({ section: 'progress' });
  });

  it('a place the surface cannot have is ignored', async () => {
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'editModal', section: 'finances' }));
    act(() => h.crud.recordEditPlace('', { surface: 'taskPage', section: 'progress' }));
    await flush();
    expect(rpcCalls()).toHaveLength(0);
    expect(storePlace('Task 111')).toBeNull();
  });

  it('a failing RPC (SQL not installed) is quiet: no error banner, the place still shows in the session', async () => {
    h.db.failNext('function pm_set_task_last_edit_place does not exist', { table: 'pm_set_task_last_edit_place', op: 'rpc' });
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'taskPage', section: 'progress' }));
    await flush();
    await h.settle();
    await tick();
    expect(h.store().lastError).toBeNull();
    expect(storePlace('Task 111')).toMatchObject({ section: 'progress' });
  });

  it('it is not an undo step', async () => {
    const undoBefore = h.store().undoCount;
    act(() => h.crud.recordEditPlace(g('Task 111'), { surface: 'taskPage', section: 'progress' }));
    await flush();
    expect(h.store().undoCount).toBe(undoBefore);
  });
});
