// kit8/pm/view/project/estimation/fillProjectFromEstimation.ts with a fake API: the order of the writes, Append / Replace, the rollback of a failed fill, a cancel, the partial failure of a Replace.
import { EstimationFillCancelledError, EstimationFillPartialError, fillProjectFromEstimation } from '../../../../../kit8/pm/view/project/estimation/fillProjectFromEstimation';
import { buildTreePath, projectTreePath } from '../../../../../kit8/pm/view/project/scheduling';

const P1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const P2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const S = 'bbbbbbbb-0000-4000-8000-000000000001', A = 'bbbbbbbb-0000-4000-8000-000000000002', B = 'bbbbbbbb-0000-4000-8000-000000000003';

const row = (guid: string, name: string, json: any = {}): any => ({ rowGUID: guid, treePath: projectTreePath(guid), rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name, ...json } });
const source = row(P2, 'Estimate', { currencyForBudget: 'EUR' });
const target = row(P1, 'Hall 12', { currencyForBudget: 'EUR', keep: 'me' });
const task = (guid: string, parent: string, desc: string, order: number, kind = 'task'): any => ({ rowGUID: guid, treePath: buildTreePath(parent, guid), projectGUID: P2, rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: order, rowJSON: { rowKind: kind, taskDescription: desc } });
const stage = task(S, projectTreePath(P2), 'Stage', 1, 'stage');
const a = task(A, stage.treePath, 'A', 1);
const b = task(B, stage.treePath, 'B', 2);
const deps: any[] = [{ rowGUID: B, rowDependsOnGUID: A, projectGUID: P2, rowOwnerGUID: 'u', linkType: 'FS', lagDays: 0, rowJSON: {} }];
const lines: any[] = [{ rowGUID: 'l1', rowOwnerGUID: A, rowParentGUID: 'timeGenus', orderInList: 1, rowJSON: { taskIsPosted: true, sumForBudget: 5 } }, { rowGUID: 'l2', rowOwnerGUID: B, rowParentGUID: 'materialGenus', orderInList: 1, rowJSON: {} }];

function fakeApi(over: any = {}) {
  const log: string[] = [];
  const calls: any = { importTasks: [], createDependencies: [], createTaskLines: [], deleted: [], updated: [] };
  const api: any = {
    readProjectData: async () => ({ tasks: [stage, a, b], deps }),
    readProjectTaskLines: async () => lines,
    importTasks: async (_p: string, rows: any[]) => { log.push('tasks'); calls.importTasks.push(rows); },
    createDependencies: async (rows: any[]) => { log.push('links'); calls.createDependencies.push(rows); },
    createTaskLines: async (rows: any[]) => { log.push('lines'); calls.createTaskLines.push(rows); },
    deleteTaskRoots: async (_p: string, roots: string[]) => { log.push('delete'); calls.deleted.push(roots); return roots.length; },
    readProject: async () => ({ ...target, rowJSON: { ...target.rowJSON, fresh: true } }),
    updateProject: async (_g: string, patch: any) => { log.push('note'); calls.updated.push(patch); return target; },
    ...over,
  };
  return { api, log, calls };
}
let n = 0;
const base = (over: any = {}) => ({ source, target, ownerGUID: 'u', mode: null, existingRoots: [], dropCurrencySums: false, makeGUID: () => `g-${++n}`, now: () => '2026-12-02T10:14:00.000Z', ...over });

describe('fillProjectFromEstimation', () => {
  beforeEach(() => { n = 0; });

  it('an empty project: tasks, then links, then lines, then the note; nothing is deleted', async () => {
    const { api, log, calls } = fakeApi();
    const r = await fillProjectFromEstimation(api, base());
    expect(log).toEqual(['tasks', 'links', 'lines', 'note']);
    expect(r).toEqual({ mode: 'empty', tasks: 3, links: 1, lines: 2, removedRoots: 0 });
    expect(calls.importTasks[0]).toHaveLength(3);
    expect(calls.createTaskLines[0].every((l: any) => l.rowJSON.taskIsPosted === false)).toBe(true);
    expect(calls.deleted).toEqual([]);
  });

  it('the note keeps the FRESH row of the project (updateProject replaces rowJSON) and says what was done', async () => {
    const { api, calls } = fakeApi();
    await fillProjectFromEstimation(api, base());
    expect(calls.updated[0].rowJSON).toMatchObject({ fresh: true, keep: 'me', projectEstimationLastFill: { at: '2026-12-02T10:14:00.000Z', sourceGUID: P2, mode: 'empty', tasks: 3, lines: 2 } });
  });

  it('Append: the old rows stay, the new top-level rows are behind them', async () => {
    const { api, calls } = fakeApi();
    const r = await fillProjectFromEstimation(api, base({ mode: 'append', existingRoots: [{ rowGUID: 'old1', orderInList: 4 }] }));
    expect(r.mode).toBe('append');
    expect(calls.deleted).toEqual([]);
    const stageCopy = calls.importTasks[0].find((t: any) => t.rowJSON.rowKind === 'stage');
    expect(stageCopy.orderInList).toBeGreaterThan(4);
  });

  it('Replace: the old top-level rows are deleted AFTER everything was written', async () => {
    const { api, log, calls } = fakeApi();
    const r = await fillProjectFromEstimation(api, base({ mode: 'replace', existingRoots: [{ rowGUID: 'old1', orderInList: 1 }, { rowGUID: 'old2', orderInList: 2 }] }));
    expect(log).toEqual(['tasks', 'links', 'lines', 'delete', 'note']);
    expect(calls.deleted).toEqual([['old1', 'old2']]);
    expect(r.removedRoots).toBe(2);
  });

  it('a failure while writing takes the NEW top-level rows back; the old rows are never touched', async () => {
    const { api, log, calls } = fakeApi({ createDependencies: async () => { throw new Error('links refused'); } });
    await expect(fillProjectFromEstimation(api, base({ mode: 'replace', existingRoots: [{ rowGUID: 'old1', orderInList: 1 }] }))).rejects.toThrow('links refused');
    expect(log).toEqual(['tasks', 'delete']);
    expect(calls.deleted).toHaveLength(1);
    expect(calls.deleted[0]).not.toContain('old1');
    expect(calls.deleted[0]).toHaveLength(1); // the one new top-level row (the stage)
    expect(calls.updated).toEqual([]);
  });

  it('a failing rollback does not hide the first error', async () => {
    const { api } = fakeApi({ createTaskLines: async () => { throw new Error('first'); }, deleteTaskRoots: async () => { throw new Error('second'); } });
    await expect(fillProjectFromEstimation(api, base())).rejects.toThrow('first');
  });

  it('a Replace whose delete fails: both old and new rows exist, the error says so, nothing is rolled back', async () => {
    let deletes = 0;
    const { api, calls } = fakeApi({ deleteTaskRoots: async () => { deletes++; throw new Error('guard refused'); } });
    await expect(fillProjectFromEstimation(api, base({ mode: 'replace', existingRoots: [{ rowGUID: 'old1', orderInList: 1 }] }))).rejects.toBeInstanceOf(EstimationFillPartialError);
    expect(deletes).toBe(1);
    expect(calls.updated).toEqual([]);
  });

  it('a cancel between two chunks: the new rows are taken back', async () => {
    let stop = false;
    const { api, log } = fakeApi({ importTasks: async () => { log.push('tasks'); stop = true; } });
    await expect(fillProjectFromEstimation(api, base({ isCancelled: () => stop }))).rejects.toBeInstanceOf(EstimationFillCancelledError);
    expect(log).toEqual(['tasks', 'delete']);
  });

  it('chunks: 500 tasks a chunk', async () => {
    const many = Array.from({ length: 1200 }, (_, i) => task(`cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`, projectTreePath(P2), `T${i}`, i));
    const { api, calls } = fakeApi({ readProjectData: async () => ({ tasks: many, deps: [] }), readProjectTaskLines: async () => [] });
    await fillProjectFromEstimation(api, base());
    expect(calls.importTasks.map((c: any[]) => c.length)).toEqual([500, 500, 200]);
  });

  it('reports its steps with a growing fraction; the texts carry {{n}}', async () => {
    const { api } = fakeApi();
    const steps: [string, number, any][] = [];
    await fillProjectFromEstimation(api, base({ onStep: (t: string, f: number, v: any) => steps.push([t, f, v]) }));
    expect(steps[0][0]).toBe('Reading the estimation');
    expect(steps.find((s) => s[0] === 'Writing {{n}} tasks')![2]).toEqual({ n: 3 });
    expect(steps[steps.length - 1]).toEqual(['Done', 1, undefined]);
    const fractions = steps.map((s) => s[1]);
    expect([...fractions].sort((x, y) => x - y)).toEqual(fractions);
  });

  it('refuses a project filled from itself and an estimation with no tasks', async () => {
    await expect(fillProjectFromEstimation(fakeApi().api, base({ source: target }))).rejects.toThrow('itself');
    await expect(fillProjectFromEstimation(fakeApi({ readProjectData: async () => ({ tasks: [], deps: [] }) }).api, base())).rejects.toThrow('no tasks');
  });

  it('currencies that differ: the lines come without the sums of the estimation', async () => {
    const { api, calls } = fakeApi();
    await fillProjectFromEstimation(api, base({ dropCurrencySums: true }));
    expect(calls.createTaskLines[0][0].rowJSON.sumForBudget).toBeNull();
  });
});
