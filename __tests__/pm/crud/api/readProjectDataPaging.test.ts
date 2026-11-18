// A request to Supabase returns at most 1000 rows. A project of 1 958 tasks (CAKE1) was read as its first 1000 by orderInList: 732 of them had their parent stage outside the
// slice and were drawn at the ROOT of the project, 958 tasks and 1 878 links were missing. readProjectData / the template reader read ALL pages now.
import { createPMApi } from '../../../../kit8/pm/crud/api/api_pm';
import { readAllPages } from '../../../../kit8/pm/crud/api/apiUtils';
import { buildTreePath, projectTreePath } from '../../../../kit8/pm/view/project/scheduling';
import { createFakeSupabase } from '../fakeSupabaseTestKit';

const P = '8e3e5544-5d86-4831-b116-420e6f9bde87';
const OWNER = '11111111-1111-4111-8111-111111111111';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** 10 stages > 20 batch stages each... the shape of CAKE1: ops have SMALL orderInList, their batch stages a big one, so the first 1000 rows by order miss many parents */
function bigProject() {
  const tasks: any[] = [];
  let n = 1;
  const add = (parent: any | null, kind: string, order: number) => {
    const rowGUID = id(n++);
    const treePath = buildTreePath(parent ? parent.treePath : projectTreePath(P), rowGUID);
    const t = { rowGUID, treePath, projectGUID: P, rowOwnerGUID: OWNER, rowDuration: null, rowProgress: 0, orderInList: order, rowJSON: { rowKind: kind, taskDescription: `${kind} ${n}`, durationDays: 1 } };
    tasks.push(t);
    return t;
  };
  for (let s = 0; s < 10; s++) {
    const stage = add(null, 'stage', 1024 * (s + 1));
    for (let b = 0; b < 20; b++) {
      const batch = add(stage, 'stage', 100000 + 1024 * (b + 1)); // a big order: the stage comes AFTER the tasks of the others
      for (let o = 0; o < 10; o++) add(batch, 'task', 1024 * (o + 1)); // equal orders everywhere: the page order must not skip or double rows
    }
  }
  const leaves = tasks.filter((t) => t.rowJSON.rowKind === 'task');
  const deps = leaves.slice(1).map((t, i) => ({ rowGUID: t.rowGUID, rowDependsOnGUID: leaves[i].rowGUID, projectGUID: P, rowOwnerGUID: OWNER, linkType: 'FS', lagDays: 0, rowJSON: {} }));
  return { tasks, deps };
}

describe('a project with more than 1000 tasks', () => {
  it('readProjectData returns EVERY task and link, each task once, every parent present (nothing is drawn at the root)', async () => {
    const { tasks, deps } = bigProject();
    expect(tasks.length).toBeGreaterThan(2000);
    expect(deps.length).toBeGreaterThan(1900);
    const db = createFakeSupabase();
    db.seed('project_table', [{ rowGUID: P, treePath: projectTreePath(P), rowOwnerGUID: OWNER, rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { name: 'Big', rowKind: 'project' } }]);
    db.seed('project_task_table', tasks);
    db.seed('project_task_dependencies_table', deps);
    const data = await createPMApi(db as any).readProjectData(P);
    expect(data.tasks).toHaveLength(tasks.length);
    expect(data.deps).toHaveLength(deps.length);
    expect(new Set(data.tasks.map((t) => t.rowGUID)).size).toBe(tasks.length);
    const paths = new Set(data.tasks.map((t) => t.treePath));
    const orphans = data.tasks.filter((t) => t.treePath.split('.').length > 2 && !paths.has(t.treePath.split('.').slice(0, -1).join('.')));
    expect(orphans).toHaveLength(0);
    // the tasks keep the order of the plan (orderInList ascending)
    expect(data.tasks.map((t) => t.orderInList)).toEqual([...data.tasks.map((t) => t.orderInList)].sort((a, b) => a - b));
  });

  it('what ONE unpaged request returns is the broken picture (the reason of the fix)', async () => {
    const { tasks } = bigProject();
    const db = createFakeSupabase();
    db.seed('project_task_table', tasks);
    const one = await db.from('project_task_table').select('*').eq('projectGUID', P).order('orderInList', { ascending: true });
    expect((one.data as any[]).length).toBe(1000);
    const paths = new Set((one.data as any[]).map((t) => t.treePath));
    const orphans = (one.data as any[]).filter((t) => t.treePath.split('.').length > 2 && !paths.has(t.treePath.split('.').slice(0, -1).join('.')));
    expect(orphans.length).toBeGreaterThan(500);
  });

  it('readAllPages stops on the first short page and raises the error of a page', async () => {
    const calls: number[] = [];
    const rows = await readAllPages(async (from, to) => { calls.push(from); return { data: Array.from({ length: Math.max(0, Math.min(to + 1, 2500) - from) }, (_, i) => from + i), error: null }; });
    expect(rows).toHaveLength(2500);
    expect(calls).toEqual([0, 1000, 2000]);
    await expect(readAllPages(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom');
  });
});
