import { copyOrderAfter, copyProject, copyProjectName, planProjectCopy, ProjectCopyApi } from '../../../kit8/catalog/project/copy/projectCopy';
import { buildTreePath, projectTreePath } from '../../../kit8/pm/view/project/scheduling';

const SRC = 'aaaaaaaa-0000-4000-8000-000000000001';
const T_STAGE = 'bbbbbbbb-0000-4000-8000-000000000001';
const T_A = 'bbbbbbbb-0000-4000-8000-000000000002';
const T_B = 'bbbbbbbb-0000-4000-8000-000000000003';

const source: any = {
  rowGUID: SRC,
  treePath: projectTreePath(SRC),
  rowParentGUID: 'org-1',
  rowOwnerGUID: 'user-1',
  rowDuration: '2026-02-01T00:00:00Z',
  rowProgress: 40,
  orderInList: 2048,
  created_at: 'x',
  updated_at: 'y',
  rowJSON: { rowKind: 'project', name: 'CAKE1', projectStartAt: '2026-01-01T00:00:00Z', skipWeekends: true, projectIsReadonly: true, currencyForBudget: 'EUR' },
};

const task = (guid: string, parentPath: string, desc: string, extra: any = {}): any => ({
  rowGUID: guid,
  treePath: buildTreePath(parentPath, guid),
  projectGUID: SRC,
  rowOwnerGUID: 'user-1',
  rowDuration: null,
  rowProgress: 10,
  orderInList: 1,
  rowJSON: { rowKind: 'task', taskDescription: desc, durationDays: 2, ...extra },
});
const stage = task(T_STAGE, projectTreePath(SRC), 'Stage', { rowKind: 'stage' });
const taskA = task(T_A, stage.treePath, 'A', { taskIsSubproject: true, taskSubprojectGUID: 'other-project' });
const taskB = task(T_B, stage.treePath, 'B');
const deps: any[] = [{ rowGUID: T_B, rowDependsOnGUID: T_A, projectGUID: SRC, rowOwnerGUID: 'user-1', linkType: 'FS', lagDays: 0, rowJSON: {} }];
const lines: any[] = [
  { rowGUID: 'line-1', rowOwnerGUID: T_A, rowParentGUID: 'timeGenus', orderInList: 1, rowJSON: { taskIsPosted: true, sumForBudget: 5 } },
  { rowGUID: 'line-2', rowOwnerGUID: T_B, rowParentGUID: 'materialGenus', orderInList: 1, rowJSON: { sumForBudget: 7 } },
  { rowGUID: 'line-3', rowOwnerGUID: 'gone-task', rowParentGUID: 'materialGenus', orderInList: 1, rowJSON: {} },
];

function fakeApi() {
  const calls: any = { createProject: [], importTasks: [], createDependencies: [], createTaskLines: [], deleteProject: [], reads: 0 };
  const api: any = {
    readProjectData: async () => {
      calls.reads++;
      return { tasks: [stage, taskA, taskB], deps };
    },
    readProjectTaskLines: async () => lines,
    createProject: async (row: any) => {
      calls.createProject.push(row);
      return row;
    },
    deleteProject: async (g: string) => void calls.deleteProject.push(g),
    importTasks: async (g: string, rows: any[]) => void calls.importTasks.push({ g, rows }),
    createDependencies: async (rows: any[]) => void calls.createDependencies.push(...rows),
    createTaskLines: async (rows: any[]) => void calls.createTaskLines.push(...rows),
  };
  return { api: api as ProjectCopyApi, calls };
}

let n = 0;
const makeGUID = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

describe('copyProjectName', () => {
  it('adds (copy), then (copy 2), (copy 3) ...', () => {
    expect(copyProjectName('CAKE1', ['CAKE1'])).toBe('CAKE1 (copy)');
    expect(copyProjectName('CAKE1', ['CAKE1', 'CAKE1 (copy)'])).toBe('CAKE1 (copy 2)');
    expect(copyProjectName('CAKE1', ['cake1 (copy)', 'CAKE1 (copy 2)'])).toBe('CAKE1 (copy 3)');
  });
  it('copying a copy does not stack the suffix', () => {
    expect(copyProjectName('CAKE1 (copy)', ['CAKE1', 'CAKE1 (copy)'])).toBe('CAKE1 (copy 2)');
  });
  it('an empty name still gives a name', () => {
    expect(copyProjectName('', [])).toBe('Project (copy)');
  });
});

describe('copyOrderAfter', () => {
  it('goes between the source and the next project', () => {
    expect(copyOrderAfter(10, [10, 20, 30])).toBe(15);
  });
  it('goes after the last project', () => {
    const o = copyOrderAfter(30, [10, 20, 30]);
    expect(o).toBeGreaterThan(30);
  });
});

describe('planProjectCopy', () => {
  it('has a NEW guid + tree path, the settings of the source, no organization / timestamps, never read-only', () => {
    const row = planProjectCopy(source, 'user-1', 'CAKE1 (copy)', 3000, makeGUID);
    expect(row.rowGUID).not.toBe(SRC);
    expect(row.treePath).toBe(projectTreePath(row.rowGUID));
    expect(row.rowJSON.name).toBe('CAKE1 (copy)');
    expect(row.rowJSON.skipWeekends).toBe(true);
    expect((row.rowJSON as any).currencyForBudget).toBe('EUR');
    expect((row.rowJSON as any).projectIsReadonly).toBeUndefined();
    expect(row.rowProgress).toBe(0);
    expect(row.rowDuration).toBeNull();
    expect(row.orderInList).toBe(3000);
    expect((row as any).rowParentGUID).toBeUndefined();
    expect(row.created_at).toBeUndefined();
    expect(row.updated_at).toBeUndefined();
  });
  it('does not change the source', () => {
    planProjectCopy(source, 'user-1', 'x', 1, makeGUID);
    expect(source.rowJSON.projectIsReadonly).toBe(true);
    expect(source.rowJSON.name).toBe('CAKE1');
  });
});

describe('copyProject', () => {
  it('Copy: one new project row, nothing else is read or written', async () => {
    const { api, calls } = fakeApi();
    const r = await copyProject(api, source, 'user-1', { withTasks: false, name: 'CAKE1 (copy)', orderInList: 3000, makeGUID });
    expect(calls.createProject).toHaveLength(1);
    expect(calls.createProject[0].rowGUID).not.toBe(SRC);
    expect(calls.reads).toBe(0);
    expect(calls.importTasks).toHaveLength(0);
    expect(calls.createTaskLines).toHaveLength(0);
    expect(r).toMatchObject({ tasks: 0, dependencies: 0, taskLines: 0 });
  });

  it('Copy with Tasks: every task / link / line has a new id on the NEW project; the source ids are gone', async () => {
    const { api, calls } = fakeApi();
    const r = await copyProject(api, source, 'user-1', { withTasks: true, name: 'CAKE1 (copy)', orderInList: 3000, makeGUID });
    const newProject = calls.createProject[0].rowGUID;
    const tasks = calls.importTasks.flatMap((c: any) => c.rows);
    expect(calls.importTasks.every((c: any) => c.g === newProject)).toBe(true);
    expect(tasks).toHaveLength(3);
    expect(r).toMatchObject({ tasks: 3, dependencies: 1, taskLines: 2 });
    for (const t of tasks) {
      expect(t.projectGUID).toBe(newProject);
      expect([T_STAGE, T_A, T_B]).not.toContain(t.rowGUID);
      expect(t.treePath.startsWith(projectTreePath(newProject))).toBe(true);
      expect(t.treePath).not.toContain(projectTreePath(SRC));
    }
    // parents before children, and the children hang under the NEW stage
    const newStage = tasks[0];
    expect(newStage.rowJSON.rowKind).toBe('stage');
    expect(tasks[1].treePath.startsWith(newStage.treePath + '.')).toBe(true);
    // the link is on the new ids
    const ids = tasks.map((t: any) => t.rowGUID);
    expect(calls.createDependencies).toHaveLength(1);
    expect(ids).toContain(calls.createDependencies[0].rowGUID);
    expect(ids).toContain(calls.createDependencies[0].rowDependsOnGUID);
    // lines: new ids on the new tasks, UNPOSTED, the line of a task that is not in the project is dropped
    expect(calls.createTaskLines).toHaveLength(2);
    for (const l of calls.createTaskLines) {
      expect(['line-1', 'line-2', 'line-3']).not.toContain(l.rowGUID);
      expect(ids).toContain(l.rowOwnerGUID);
      expect(l.rowJSON.taskIsPosted).toBe(false);
    }
    expect(calls.createTaskLines.map((l: any) => l.rowJSON.sumForBudget).sort()).toEqual([5, 7]);
  });

  it('the copied task is no subproject origin', async () => {
    const { api, calls } = fakeApi();
    await copyProject(api, source, 'user-1', { withTasks: true, name: 'c', orderInList: 1, makeGUID });
    const tasks = calls.importTasks.flatMap((c: any) => c.rows);
    expect(tasks.some((t: any) => t.rowJSON.taskIsSubproject || t.rowJSON.taskSubprojectGUID)).toBe(false);
    // the source object is untouched
    expect(taskA.rowJSON.taskIsSubproject).toBe(true);
  });

  it('a failure after the project row exists deletes the half-made copy and rethrows', async () => {
    const { api, calls } = fakeApi();
    (api as any).createTaskLines = async () => {
      throw new Error('boom');
    };
    await expect(copyProject(api, source, 'user-1', { withTasks: true, name: 'c', orderInList: 1, makeGUID })).rejects.toThrow('boom');
    expect(calls.deleteProject).toEqual([calls.createProject[0].rowGUID]);
  });

  it('a broken source (no parent) stops BEFORE anything is created', async () => {
    const { api, calls } = fakeApi();
    (api as any).readProjectData = async () => ({ tasks: [taskA], deps: [] }); // parent stage is missing
    await expect(copyProject(api, source, 'user-1', { withTasks: true, name: 'c', orderInList: 1, makeGUID })).rejects.toThrow(/no parent/);
    expect(calls.createProject).toHaveLength(0);
  });

  it('big projects are written in chunks of 500 tasks', async () => {
    const { api, calls } = fakeApi();
    const many = Array.from({ length: 1201 }, (_, i) => task(`cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`, projectTreePath(SRC), `T${i}`));
    (api as any).readProjectData = async () => ({ tasks: many, deps: [] });
    (api as any).readProjectTaskLines = async () => [];
    await copyProject(api, source, 'user-1', { withTasks: true, name: 'c', orderInList: 1, makeGUID });
    expect(calls.importTasks.map((c: any) => c.rows.length)).toEqual([500, 500, 201]);
  });

  describe('Copy with BIM', () => {
    it('copies tasks first, then the BIM model with the id map (old task -> new task) of the plan', async () => {
      const { api, calls } = fakeApi();
      const copyBim = jest.fn(async (_s: string, _t: string, _m: Record<string, string>) => ({ copied: true, elements: 3 }));
      const r = await copyProject(api, source, 'user-1', { withTasks: false, withBim: true, copyBim, name: 'CAKE1 (copy)', orderInList: 3000, makeGUID });
      expect(calls.importTasks).toHaveLength(1);
      expect(copyBim).toHaveBeenCalledTimes(1);
      const [src, target, idMap] = copyBim.mock.calls[0];
      expect(src).toBe(SRC);
      expect(target).toBe(r.project.rowGUID);
      expect(Object.keys(idMap).sort()).toEqual([T_A, T_B, T_STAGE].sort());
      const newIds = new Set(calls.importTasks[0].rows.map((t: any) => t.rowGUID));
      for (const v of Object.values(idMap)) expect(newIds.has(v)).toBe(true);
      expect(r.bimElements).toBe(3);
      expect(r.tasks).toBe(3);
    });

    it('a failing BIM copy deletes the half-made project and passes the error on', async () => {
      const { api, calls } = fakeApi();
      const copyBim = jest.fn(async () => {
        throw new Error('storage refused');
      });
      await expect(copyProject(api, source, 'user-1', { withTasks: true, withBim: true, copyBim, name: 'x', orderInList: 1, makeGUID })).rejects.toThrow('storage refused');
      expect(calls.deleteProject).toHaveLength(1);
      expect(calls.deleteProject[0]).toBe(calls.createProject[0].rowGUID);
    });

    it('a source without a BIM model is still a good copy (bimElements 0)', async () => {
      const { api } = fakeApi();
      const copyBim = jest.fn(async () => ({ copied: false, elements: 0 }));
      const r = await copyProject(api, source, 'user-1', { withTasks: true, withBim: true, copyBim, name: 'x', orderInList: 1, makeGUID });
      expect(r.bimElements).toBe(0);
      expect(r.tasks).toBe(3);
    });

    it('withBim without the copy function stops before anything is written', async () => {
      const { api, calls } = fakeApi();
      await expect(copyProject(api, source, 'user-1', { withTasks: true, withBim: true, name: 'x', orderInList: 1, makeGUID })).rejects.toThrow('BIM copy function');
      expect(calls.createProject).toHaveLength(0);
    });
  });
});
