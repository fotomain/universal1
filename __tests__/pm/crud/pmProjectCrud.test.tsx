/** @jest-environment jsdom */
// Project CRUD hooks (create / update / delete / search / demo seed), the scheduler
// write-back and the web undo storage.
import { mountPM, PMHarness, unmountPM } from './pmCrudHarnessTestKit';
import { act } from 'react';
import { createWebUndoStorage } from '../../../kit8/pm/undo/undoGanttWebStorage';
import { undoGanttKey } from '../../../kit8/pm/undo/undoGanttTypes';

let h: PMHarness;
const run = async (fn: () => unknown) => {
  await act(async () => {
    await fn();
  });
  await h.settle();
};
const dbProjects = () => h.db.rows('project_table').filter((p) => p.rowOwnerGUID === h.owner);

afterEach(unmountPM);

describe('project_table through React Query', () => {
  beforeEach(async () => {
    h = await mountPM();
  });

  it('create: + Project inserts a row after the last project and lists it', async () => {
    const row = h.projects.buildRow('Project 3', Date.UTC(2026, 9, 1));
    expect(row.orderInList).toBeGreaterThan(Math.max(...h.demo.projects.map((p) => p.orderInList)));
    await run(() => h.projects.createProject.mutate(row));
    expect(dbProjects().map((p) => p.rowJSON.name)).toEqual(['Project 1', 'Project 2', 'Project 3']);
    expect(h.store().projectsById[row.rowGUID].rowJSON.name).toBe('Project 3');
    expect(h.store().projectOrder[2]).toBe(row.rowGUID);
  });

  it('update: rename / weekends (the whole rowJSON column is written, like the settings dialog does)', async () => {
    const json = h.store().projectsById[h.P2].rowJSON;
    await run(() => h.projects.updateProject.mutate({ rowGUID: h.P2, patch: { rowJSON: { ...json, name: 'Renamed', skipWeekends: true } } }));
    const p = dbProjects().find((x) => x.rowGUID === h.P2)!;
    expect(p.rowJSON).toMatchObject({ name: 'Renamed', skipWeekends: true, rowKind: 'project' });
    expect(h.store().projectsById[h.P2].rowJSON.name).toBe('Renamed');
  });

  it('update failure rolls the projects list back', async () => {
    h.db.failNext('permission denied', { table: 'project_table', op: 'update' });
    await run(() => h.projects.updateProject.mutate({ rowGUID: h.P2, patch: { rowJSON: { name: 'Nope' } as any } }));
    expect(h.store().projectsById[h.P2].rowJSON.name).toBe('Project 2');
    expect(h.store().lastError).toBe('permission denied');
  });

  it('delete: removes the project from the database and the store', async () => {
    await run(() => h.projects.deleteProject.mutate(h.P2));
    expect(dbProjects().map((p) => p.rowJSON.name)).toEqual(['Project 1']);
    expect(h.store().projectsById[h.P2]).toBeUndefined();
  });

  it('search: substring from the database (SelectProjectFromList)', async () => {
    h.setSearch('ect 2');
    await h.until(() => h.search.data?.length === 1, 'search result');
    expect(h.search.data[0].rowGUID).toBe(h.P2);
    h.setSearch('');
    await h.until(() => h.search.data?.length === 2, 'all projects');
  });

  it('seed demo: inserts Project 1 + 2 again (parents before children), selects the first', async () => {
    await run(() => h.projects.seedDemo.mutate());
    expect(dbProjects()).toHaveLength(4);
    const inserts = h.db.calls.filter((c) => c.op === 'insert').map((c) => c.table);
    expect(inserts).toEqual(['project_table', 'project_task_table', 'project_task_table', 'project_task_dependencies_table']);
    const stagesCall = h.db.calls.filter((c) => c.op === 'insert' && c.table === 'project_task_table')[0];
    expect(stagesCall.payload.every((t: any) => t.rowJSON.rowKind === 'stage')).toBe(true);
    const newP1 = dbProjects()[2].rowGUID;
    expect(h.store().selectedProjectGUID).toBe(newP1);
    await h.until(() => h.store().loadedProjectGUID === newP1 && h.store().tasks.length === 8, 'new demo project loaded');
  });
});

describe('scheduler write-back (pm_apply_schedule)', () => {
  it('persists computed start / finish and the project finish + progress', async () => {
    h = await mountPM({ writeBack: true });
    await h.until(() => h.db.rpcCalls.length > 0, 'write-back RPC');
    await h.settle();
    const call = h.db.rpcCalls[0];
    expect(call.fn).toBe('pm_apply_schedule');
    expect(call.args.p_project_guid).toBe(h.P1);
    expect(call.args.p_rows).toHaveLength(8);
    const t111 = h.store().tasks.find((t) => t.rowJSON.name === 'Task 111')!;
    const w = call.args.p_rows.find((r: any) => r.rowGUID === t111.rowGUID);
    expect(Date.parse(w.startAt)).toBe(h.store().schedule[t111.rowGUID].startMs);
    expect(call.args.p_project_finish).toBe(new Date(h.store().projectFinishMs).toISOString());
    expect(h.db.task(t111.rowGUID)!.rowJSON.startAt).toBe(w.startAt);
  });
});

describe('web undo storage (undoGanttActionTable in localStorage)', () => {
  const entry = (key: string, i: number) => ({
    rowGUID: `e${i}`,
    undoKey: key,
    rowOwnerGUID: 'p',
    rowParentGUID: 'u',
    orderInList: i,
    rowJSON: { undoKey: key, actionType: 'task-update', label: `L${i}`, createdAt: '', projectGUID: 'p', userGUID: 'u', before: { tasks: [], deps: [] } },
  });

  it('push / peek / count / keepLast / remove / clear', async () => {
    localStorage.clear();
    const s = createWebUndoStorage();
    const key = undoGanttKey('u-storage', 'p-storage');
    for (let i = 1; i <= 5; i++) await s.push(entry(key, i) as any, 3);
    expect(await s.count(key)).toBe(3);
    expect((await s.peek(key))!.rowGUID).toBe('e5');
    await s.remove('e5');
    expect((await s.peek(key))!.rowGUID).toBe('e4');
    expect(JSON.parse(localStorage.getItem(`undoGanttActionTable:${key}`)!)).toHaveLength(2);
    await s.clear(key);
    expect(await s.count(key)).toBe(0);
    expect(await s.peek(key)).toBeNull();
  });
});
