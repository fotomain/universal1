// kit8/pm/api.ts + crud/*/…Api.ts: the Supabase CRUD layer against an in-memory database.
import { createPMApi } from '../../../kit8/pm/api';
import { check, errorMessage, newGUID, normalizeDep, normalizeTask } from '../../../kit8/pm/crud/shared/apiUtils';
import { PM_MISSING_DEP_ROWJSON_HINT } from '../../../kit8/pm/crud/dependency/dependencyApi';
import { buildDemoData } from '../../../kit8/pm/seedDemo';
import { createFakeSupabase, FakeSupabase } from './fakeSupabaseTestKit';

const OWNER = '11111111-1111-4111-8111-111111111111';

function setup() {
  const db = createFakeSupabase();
  let n = 0;
  const demo = buildDemoData(OWNER, Date.UTC(2026, 8, 28), () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`);
  db.seed('project_table', demo.projects);
  db.seed('project_task_table', demo.tasks);
  db.seed('project_task_dependencies_table', demo.deps.map((d) => ({ ...d, rowJSON: {} })));
  const api = createPMApi(db as any);
  const byName = (name: string) => demo.tasks.find((t) => t.rowJSON.name === name)!;
  return { db, api, demo, byName, P1: demo.projects[0].rowGUID, P2: demo.projects[1].rowGUID };
}

describe('apiUtils', () => {
  it('newGUID returns uuid v4 values, all different', () => {
    const a = new Set(Array.from({ length: 50 }, newGUID));
    expect(a.size).toBe(50);
    for (const g of a) expect(g).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('check unwraps data or throws the Supabase error message', () => {
    expect(check({ data: [1], error: null })).toEqual([1]);
    expect(() => check({ data: null, error: { message: 'permission denied' } })).toThrow('permission denied');
  });

  it('errorMessage strips the "pm_gantt:" prefix raised by SQL triggers', () => {
    expect(errorMessage(new Error('pm_gantt: dependency would create a cycle'))).toBe('dependency would create a cycle');
    expect(errorMessage('plain')).toBe('plain');
  });

  it('normalizers coerce numeric strings and fill defaults', () => {
    const t = normalizeTask({ rowGUID: 'x', rowProgress: '42.5', orderInList: '2048', rowJSON: null });
    expect(t).toMatchObject({ rowProgress: 42.5, orderInList: 2048, rowJSON: {} });
    expect(normalizeDep({ rowGUID: 'a', rowDependsOnGUID: 'b', lagDays: '2', linkType: null })).toMatchObject({ linkType: 'FS', lagDays: 2, rowJSON: {} });
  });
});

describe('project_table CRUD', () => {
  it('readProjects: only the owner\'s rows, ordered by orderInList', async () => {
    const { api, db, demo } = setup();
    db.seed('project_table', [{ ...demo.projects[0], rowGUID: 'other', rowOwnerGUID: 'someone-else' }]);
    const list = await api.readProjects(OWNER);
    expect(list.map((p) => p.rowJSON.name)).toEqual(['Project 1', 'Project 2']);
  });

  it('searchProjects: case-insensitive substring on rowJSON->>name, LIKE wildcards are literal', async () => {
    const { api, db, demo } = setup();
    db.seed('project_table', [{ ...demo.projects[0], rowGUID: 'pct', rowJSON: { ...demo.projects[0].rowJSON, name: '100% done_x' } }]);
    expect((await api.searchProjects(OWNER, 'ECT 2')).map((p) => p.rowJSON.name)).toEqual(['Project 2']);
    expect((await api.searchProjects(OWNER, '%')).map((p) => p.rowJSON.name)).toEqual(['100% done_x']);
    expect((await api.searchProjects(OWNER, '_')).map((p) => p.rowJSON.name)).toEqual(['100% done_x']);
    expect(await api.searchProjects(OWNER, '  ')).toHaveLength(3); // empty text = all
    expect(await api.searchProjects(OWNER, '', 1)).toHaveLength(1); // limit
  });

  it('buildProjectRow + createProjects + updateProject + deleteProject', async () => {
    const { api, db } = setup();
    const row = api.buildProjectRow(OWNER, 'Project 3', 2048, Date.UTC(2026, 9, 1));
    expect(row).toMatchObject({ rowOwnerGUID: OWNER, rowProgress: 0, orderInList: 3072, rowJSON: { rowKind: 'project', name: 'Project 3' } });
    expect(row.treePath).toBe(row.rowGUID.replace(/-/g, '_'));
    expect(row.rowJSON.projectStartAt).toBe('2026-10-01T00:00:00.000Z');

    const [inserted] = await api.createProjects([row]);
    expect(inserted.rowGUID).toBe(row.rowGUID);
    expect(await api.createProjects([])).toEqual([]);

    const updated = await api.updateProject(row.rowGUID, { rowGUID: 'hacked', treePath: 'hacked', rowJSON: { ...row.rowJSON, name: 'Renamed' } } as any);
    expect(updated.rowGUID).toBe(row.rowGUID); // key columns are never sent
    expect(updated.treePath).toBe(row.treePath);
    expect(updated.rowJSON.name).toBe('Renamed');

    await api.deleteProject(row.rowGUID);
    expect(db.rows('project_table').find((p) => p.rowGUID === row.rowGUID)).toBeUndefined();
  });

  it('createProject / readProject: one row in, one row out (null when missing)', async () => {
    const { api, P2 } = setup();
    const row = api.buildProjectRow(OWNER, 'Solo', null);
    const created = await api.createProject(row);
    expect(created.rowGUID).toBe(row.rowGUID);
    expect((await api.readProject(row.rowGUID))?.rowJSON.name).toBe('Solo');
    expect((await api.readProject(P2))?.rowJSON.name).toBe('Project 2');
    expect(await api.readProject('missing')).toBeNull();
  });

  it('errors from the database are thrown (RLS etc.)', async () => {
    const { api, db } = setup();
    db.failNext('new row violates row-level security policy', { table: 'project_table' });
    await expect(api.createProjects([api.buildProjectRow(OWNER, 'X', null)])).rejects.toThrow('row-level security');
  });
});

describe('project_task_table CRUD', () => {
  it('readProjectData: tasks (ordered) + deps of one project only', async () => {
    const { api, P1 } = setup();
    const data = await api.readProjectData(P1);
    expect(data.tasks).toHaveLength(8);
    expect(data.deps).toHaveLength(4);
    expect(data.tasks.every((t) => t.projectGUID === P1)).toBe(true);
  });

  it('readTask: one row or null', async () => {
    const { api, byName } = setup();
    expect((await api.readTask(byName('Task 112').rowGUID))?.rowJSON.name).toBe('Task 112');
    expect(await api.readTask('nope')).toBeNull();
  });

  it('buildTaskRow puts the row under its parent ltree path (or the project)', () => {
    const { api, P1, byName } = setup();
    const stage = byName('Stage 1');
    const inStage = api.buildTaskRow({ ownerGUID: OWNER, projectGUID: P1, parentTreePath: stage.treePath, rowKind: 'task', name: 'T', durationDays: 2, orderInList: 5, rowGUID: 'aaaa-bbbb' });
    expect(inStage.treePath).toBe(`${stage.treePath}.aaaa_bbbb`);
    const top = api.buildTaskRow({ ownerGUID: OWNER, projectGUID: P1, parentTreePath: null, rowKind: 'stage', name: 'S', durationDays: 0, orderInList: 1 });
    expect(top.treePath.split('.')[0]).toBe(P1.replace(/-/g, '_'));
    expect(top.rowJSON).toEqual({ rowKind: 'stage', name: 'S', durationDays: 0 });
  });

  it('createTask inserts one row and returns it', async () => {
    const { api, db, P1, byName } = setup();
    const row = api.buildTaskRow({ ownerGUID: OWNER, projectGUID: P1, parentTreePath: byName('Stage 2').treePath, rowKind: 'milestone', name: 'M', durationDays: 0, orderInList: 5000 });
    const created = await api.createTask(row);
    expect(created).toMatchObject({ rowGUID: row.rowGUID, rowJSON: { rowKind: 'milestone', name: 'M' } });
    expect(db.task(row.rowGUID)).toBeDefined();
  });

  it('createTasks strips timestamps; updateTask never sends rowGUID / projectGUID', async () => {
    const { api, db, P1, byName } = setup();
    const row = api.buildTaskRow({ ownerGUID: OWNER, projectGUID: P1, parentTreePath: byName('Stage 1').treePath, rowKind: 'task', name: 'New', durationDays: 1, orderInList: 9999 });
    await api.createTasks([{ ...row, created_at: 'x', updated_at: 'y' } as any]);
    expect(db.task(row.rowGUID)).not.toHaveProperty('created_at');

    const t = byName('Task 111');
    const res = await api.updateTask(t.rowGUID, { rowGUID: 'x', projectGUID: 'y', rowProgress: 55 } as any);
    expect(res.rowProgress).toBe(55);
    const sent = db.calls.filter((c) => c.op === 'update').pop()!;
    expect(sent.payload).toEqual({ rowProgress: 55 });
    expect(sent.filters).toEqual([['eq', 'rowGUID', t.rowGUID]]);
  });

  it('deleteTask of a stage removes the subtree and its dependencies (trigger)', async () => {
    const { api, db, byName } = setup();
    await api.deleteTask(byName('Stage 1').rowGUID);
    const names = db.rows('project_task_table').map((t) => t.rowJSON.name);
    expect(names).not.toContain('Task 111');
    expect(names).toContain('Task 121');
    expect(db.rows('project_task_dependencies_table').some((d) => d.rowGUID === byName('Task 113').rowGUID)).toBe(false);
  });

  it('applySchedule calls the pm_apply_schedule RPC with rows, finish and progress', async () => {
    const { api, db, P1, byName } = setup();
    const g = byName('Task 111').rowGUID;
    const n = await api.applySchedule(P1, [{ rowGUID: g, startAt: '2026-09-28T00:00:00.000Z', finishAt: '2026-10-01T00:00:00.000Z' }], '2026-10-20T00:00:00.000Z', 12.5);
    expect(n).toBe(1);
    expect(db.rpcCalls[0]).toEqual({
      fn: 'pm_apply_schedule',
      args: { p_project_guid: P1, p_rows: [expect.objectContaining({ rowGUID: g })], p_project_finish: '2026-10-20T00:00:00.000Z', p_project_progress: 12.5 },
    });
    expect(db.task(g)!.rowDuration).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('project_task_dependencies_table CRUD', () => {
  const edge = (s: ReturnType<typeof setup>, pred: string, succ: string, extra: any = {}) => ({
    rowGUID: s.byName(succ).rowGUID,
    rowDependsOnGUID: s.byName(pred).rowGUID,
    projectGUID: s.P1,
    rowOwnerGUID: OWNER,
    linkType: 'FS' as const,
    lagDays: 0,
    ...extra,
  });

  it('createDependencies: an empty rowJSON is not sent (DB default), a color is', async () => {
    const s = setup();
    await s.api.createDependencies([edge(s, 'Task 111', 'Task 112', { rowJSON: {} })]);
    expect(s.db.calls.filter((c) => c.op === 'insert').pop()!.payload[0]).not.toHaveProperty('rowJSON');
    const [d] = await s.api.createDependencies([edge(s, 'Task 121', 'Task 122', { linkType: 'SS', lagDays: 2, rowJSON: { dependencyColor: '#f00' } })]);
    expect(d).toMatchObject({ linkType: 'SS', lagDays: 2, rowJSON: { dependencyColor: '#f00' } });
    expect(await s.api.createDependencies([])).toEqual([]);
  });

  it('createDependency inserts one edge; a duplicate is refused by the DB', async () => {
    const s = setup();
    const d = await s.api.createDependency(edge(s, 'Task 111', 'Task 121', { linkType: 'FF' }));
    expect(d).toMatchObject({ rowGUID: s.byName('Task 121').rowGUID, linkType: 'FF' });
    await expect(s.api.createDependency(edge(s, 'Task 111', 'Task 121'))).rejects.toThrow('duplicate');
  });

  it('old schema without dependency rowJSON: insert retries without it (arrow kept, color lost)', async () => {
    const s = setup();
    s.db.dependencyRowJSONColumn = false;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [d] = await s.api.createDependencies([edge(s, 'Task 111', 'Task 112', { rowJSON: { dependencyColor: '#f00' } })]);
    expect(d.rowGUID).toBe(s.byName('Task 112').rowGUID);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('update_pm_tables_rowJSON.sql'));
    warn.mockRestore();
  });

  it('updateDependency sends only linkType / lagDays / rowJSON, filtered by both endpoints', async () => {
    const s = setup();
    const succ = s.byName('Task 113').rowGUID;
    const pred = s.byName('Task 111').rowGUID;
    await s.api.updateDependency(succ, pred, { linkType: 'FF', lagDays: 3, rowGUID: 'x' } as any);
    const call = s.db.calls.filter((c) => c.op === 'update').pop()!;
    expect(call.payload).toEqual({ linkType: 'FF', lagDays: 3 });
    expect(call.filters).toEqual([['eq', 'rowGUID', succ], ['eq', 'rowDependsOnGUID', pred]]);
    expect(s.db.rows('project_task_dependencies_table').find((d) => d.rowGUID === succ && d.rowDependsOnGUID === pred)).toMatchObject({ linkType: 'FF', lagDays: 3 });
  });

  it('updateDependency with a color on the old schema throws the migration hint', async () => {
    const s = setup();
    s.db.dependencyRowJSONColumn = false;
    await expect(s.api.updateDependency(s.byName('Task 113').rowGUID, s.byName('Task 111').rowGUID, { rowJSON: { dependencyColor: '#0f0' } })).rejects.toThrow(PM_MISSING_DEP_ROWJSON_HINT);
  });

  it('deleteDependency deletes one edge only, never a task', async () => {
    const s = setup();
    const before = s.db.rows('project_task_table').length;
    await s.api.deleteDependency(s.byName('Task 113').rowGUID, s.byName('Task 111').rowGUID);
    const deps = s.db.rows('project_task_dependencies_table').filter((d) => d.rowGUID === s.byName('Task 113').rowGUID);
    expect(deps.map((d) => d.rowDependsOnGUID)).toEqual([s.byName('Task 112').rowGUID]);
    expect(s.db.rows('project_task_table')).toHaveLength(before);
  });

  it('closure reads: upstream by descendantGUID, downstream by ancestorGUID, by depth', async () => {
    const s = setup();
    s.db.seed('project_task_dependency_closure_table', [
      { ancestorGUID: 'a', descendantGUID: 'c', depthLevel: 2 },
      { ancestorGUID: 'b', descendantGUID: 'c', depthLevel: 1 },
      { ancestorGUID: 'c', descendantGUID: 'd', depthLevel: 1 },
    ]);
    expect((await s.api.readUpstream('c')).map((r) => r.ancestorGUID)).toEqual(['b', 'a']);
    expect((await s.api.readDownstream('c')).map((r) => r.descendantGUID)).toEqual(['d']);
  });
});

export type { FakeSupabase };
