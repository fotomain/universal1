import { runBimImport, type BimImportDeps } from '../../kit8/pm/bim/import/runBimImport';
import { BimImportError } from '../../kit8/pm/bim/import/bimImportModel';
import type { PMProjectRow } from '../../kit8/pm/model/types';
import { readExampleBundle } from './bimTestKit';

const P = 'aabd1dde-97e6-4359-97e4-0efcb847589b';
const project = (json: any = {}): PMProjectRow => ({ rowGUID: P, treePath: 'x', rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name: 'BIM target', ...json } } as any);

function make(opts: { existing?: PMProjectRow; tasks?: number; confirm?: boolean; convertFails?: boolean; rowsFail?: boolean } = {}) {
  const calls: string[] = [];
  const bundle = readExampleBundle();
  const created: any[] = [];
  const imported: any[] = [];
  let committed: any = null;
  let failed: any = null;
  const deps: BimImportDeps = {
    ownerGUID: 'u',
    getProject: () => opts.existing,
    confirmReplace: async (i) => {
      calls.push(`confirm:${i.tasks}`);
      return opts.confirm !== false;
    },
    api: {
      readProjectData: async () => ({ tasks: Array.from({ length: opts.tasks ?? 0 }, (_, i) => ({ rowGUID: `t${i}` })), deps: [] } as any),
      deleteProjectTasks: async () => void calls.push('deleteTasks'),
      importTasks: async (_p: string, rows: any[]) => void (calls.push(`importTasks:${rows.length}`), imported.push(...rows)),
      updateProject: async () => ({} as any),
      createProject: async (row: any) => (calls.push('createProject'), created.push(row), row),
    } as any,
    cloud: {
      begin: async () => (calls.push('begin'), { modelGUID: 'M', revision: 1, storagePrefix: `${P}/M` }),
      addRows: async (_m: string, kind: string, rows: any[]) => {
        if (opts.rowsFail && kind === 'elements') throw new Error('rows refused');
        calls.push(`rows:${kind}:${rows.length}`);
        return rows.length;
      },
      commit: async (m: string, counts: any, info: any) => ((committed = { m, counts, info }), calls.push('commit'), { modelGUID: m, revision: 1, counts: { ...counts, tasks: 58 } }),
      fail: async (m: string, text: string, paths: string[]) => (calls.push('fail'), (failed = { m, text, paths })),
    } as any,
    convert: async (params) => {
      calls.push('convert');
      if (opts.convertFails) throw new Error('converter down');
      expect(params.modelGUID).toBe('M');
      return bundle;
    },
  };
  return { deps, calls, created, imported, get committed() { return committed; }, get failed() { return failed; }, bundle };
}

const input = { projectGUID: P, projectName: 'BIM example 1', source: { kind: 'url' as const, url: 'https://raw.githubusercontent.com/x/Structure%20Walls.ifc' }, options: { granularity: 'auto' as const, skipEmptyStoreys: true } };

describe('runBimImport', () => {
  it('a new project: made, begin -> convert -> tasks -> rows -> commit, in this order', async () => {
    const t = make();
    const out = await runBimImport(t.deps, input);
    expect(out.status).toBe('imported');
    expect(t.calls).toEqual(['createProject', 'begin', 'convert', 'importTasks:62', 'rows:storeys:4', 'rows:chunks:4', 'rows:elements:58', 'rows:properties:58', 'commit']);
    expect(t.created[0].rowGUID).toBe(P);
    expect(t.created[0].rowJSON.name).toBe('BIM example 1');
    expect(t.committed.counts).toEqual({ storeys: 4, chunks: 4, elements: 58, properties: 58 });
    expect(t.committed.info.unitScale).toBe(0.3048);
  });

  it('the elements point to the NEW task ids the importer made, not to the ids of the file', async () => {
    const t = make();
    let sent: any[] = [];
    const add = t.deps.cloud.addRows;
    t.deps.cloud.addRows = async (m, kind, rows) => (kind === 'elements' && (sent = rows), add(m, kind, rows));
    await runBimImport(t.deps, input);
    const newIds = new Set(t.imported.map((r) => r.rowGUID));
    const fileIds = new Set(t.bundle.project.tasks.map((x) => x.rowGUID));
    expect(sent).toHaveLength(58);
    for (const e of sent) {
      expect(newIds.has(e.taskGUID)).toBe(true);
      expect(fileIds.has(e.taskGUID)).toBe(false);
    }
  });

  it('a project that has tasks and is NOT a BIM project is refused before anything happens', async () => {
    const t = make({ existing: project(), tasks: 3 });
    await expect(runBimImport(t.deps, input)).rejects.toThrow(/not a BIM project/);
    expect(t.calls).toEqual([]);
  });

  it('a BIM project asks first; No = nothing changes', async () => {
    const t = make({ existing: project({ projectIsBIMBased: true }), tasks: 7, confirm: false });
    expect(await runBimImport(t.deps, input)).toEqual({ status: 'cancelled' });
    expect(t.calls).toEqual(['confirm:7']);
  });

  it('a BIM project, Yes: the old tasks are deleted after the conversion, before the new ones come', async () => {
    const t = make({ existing: project({ projectIsBIMBased: true }), tasks: 7 });
    await runBimImport(t.deps, input);
    expect(t.calls.slice(0, 5)).toEqual(['confirm:7', 'begin', 'convert', 'deleteTasks', 'importTasks:62']);
  });

  it('an empty existing project is used as it is (no createProject)', async () => {
    const t = make({ existing: project(), tasks: 0 });
    await runBimImport(t.deps, input);
    expect(t.calls).not.toContain('createProject');
  });

  it('the converter fails: bim_import_fail, no task was written', async () => {
    const t = make({ convertFails: true });
    await expect(runBimImport(t.deps, input)).rejects.toThrow('converter down');
    expect(t.calls).toEqual(['createProject', 'begin', 'convert', 'fail']);
    expect(t.failed).toMatchObject({ m: 'M', text: 'converter down', paths: [] });
  });

  it('the rows fail after the tasks were written: bim_import_fail with the uploaded files + the tasks of this import go again', async () => {
    const t = make({ rowsFail: true });
    await expect(runBimImport(t.deps, input)).rejects.toThrow('rows refused');
    expect(t.calls.slice(-2)).toEqual(['fail', 'deleteTasks']);
    expect(t.failed.paths).toHaveLength(4);
    expect(t.failed.paths[0]).toMatch(new RegExp(`^${P}/M/[0-9a-f]{64}\\.bimc$`));
    expect(t.calls).not.toContain('commit');
  });

  it('a bundle the check refuses (a link between tasks) is a failure too', async () => {
    const t = make();
    const bad = { ...t.bundle, project: { ...t.bundle.project, dependencies: [{} as any] } };
    t.deps.convert = async () => bad;
    await expect(runBimImport(t.deps, input)).rejects.toBeInstanceOf(BimImportError);
    expect(t.calls).toContain('fail');
  });

  it('progress goes up to 100', async () => {
    const t = make();
    const seen: number[] = [];
    await runBimImport(t.deps, { ...input, onStep: (p) => void seen.push(p) });
    expect(seen[0]).toBeLessThan(10);
    expect(seen[seen.length - 1]).toBe(100);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
});
