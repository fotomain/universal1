// Project versions - Supabase layer (version/crud/api/versionApi.ts) on a tiny recording fake.
import { createVersionApi, isMissingFunctionError } from '../../../../kit8/pm/version/crud/api/versionApi';
import { PMMissingTableError } from '../../../../kit8/pm/crud/api/projectUserSettingsApi';

type Call = { table: string; op: string; filters: [string, any][]; order?: [string, any] };

function fakeSupabase(answers: { tables?: Record<string, { data?: any; error?: any }>; rpc?: Record<string, { data?: any; error?: any }> }) {
  const calls: Call[] = [];
  const rpcCalls: { fn: string; args: any }[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    calls.push(call);
    const result = () => Promise.resolve({ data: null, error: null, ...(answers.tables?.[table] || {}) });
    const b: any = {
      select: () => b,
      delete: () => ((call.op = 'delete'), b),
      eq: (col: string, v: any) => (call.filters.push([col, v]), b),
      order: (col: string, o: any) => ((call.order = [col, o]), b),
      then: (ok: any, fail: any) => result().then(ok, fail),
    };
    return b;
  };
  const rpc = (fn: string, args: any) => {
    rpcCalls.push({ fn, args });
    return Promise.resolve({ data: null, error: null, ...(answers.rpc?.[fn] || {}) });
  };
  return { sb: { from, rpc } as any, calls, rpcCalls };
}

describe('versionApi', () => {
  it('readProjectVersions: versions of the project, newest first, normalized', async () => {
    const f = fakeSupabase({ tables: { version_project_table: { data: [{ rowVersionGUID: 'v2-1', rowGUID: 'p', orderInList: '2', rowProgress: '50', rowJSON: { versionTitle: 'Second', versionCreatedAt: 'x' } }] } } });
    const r = await createVersionApi(f.sb).readProjectVersions('p');
    expect(r.missing).toBe(false);
    expect(r.rows[0]).toMatchObject({ rowVersionGUID: 'v2-1', orderInList: 2, rowProgress: 50 });
    expect(f.calls[0]).toMatchObject({ table: 'version_project_table', op: 'select', filters: [['rowGUID', 'p']], order: ['orderInList', { ascending: false }] });
  });

  it('readProjectVersions: table not created yet -> { missing: true }', async () => {
    const f = fakeSupabase({ tables: { version_project_table: { error: { code: 'PGRST205', message: "Could not find the table 'public.version_project_table' in the schema cache" } } } });
    expect(await createVersionApi(f.sb).readProjectVersions('p')).toEqual({ rows: [], missing: true });
  });

  it('readVersionData: tasks + dependencies of the version', async () => {
    const f = fakeSupabase({
      tables: {
        version_project_task_table: { data: [{ rowVersionGUID: 'v', rowGUID: 't1', orderInList: '1024', rowProgress: '0', rowJSON: { name: 'A' } }] },
        version_project_task_dependencies_table: { data: [{ rowVersionGUID: 'v', rowGUID: 't2', rowDependsOnGUID: 't1', lagDays: '2' }] },
      },
    });
    const d = await createVersionApi(f.sb).readVersionData('v');
    expect(d.versionGUID).toBe('v');
    expect(d.tasks[0]).toMatchObject({ rowGUID: 't1', orderInList: 1024 });
    expect(d.deps[0]).toMatchObject({ linkType: 'FS', lagDays: 2 });
    expect(f.calls.map((c) => [c.table, c.filters[0]])).toEqual([
      ['version_project_task_table', ['rowVersionGUID', 'v']],
      ['version_project_task_dependencies_table', ['rowVersionGUID', 'v']],
    ]);
  });

  it('save / restore / rename go through the RPCs', async () => {
    const f = fakeSupabase({ rpc: { pm_version_save: { data: 'new-version' }, pm_version_restore: { data: 'backup-version' } } });
    const api = createVersionApi(f.sb);
    expect(await api.saveProjectVersion('p', 'Baseline')).toBe('new-version');
    expect(await api.restoreProjectVersion('v1', 'Before restore')).toBe('backup-version');
    await api.renameProjectVersion('v1', 'New title');
    expect(f.rpcCalls).toEqual([
      { fn: 'pm_version_save', args: { p_project: 'p', p_title: 'Baseline' } },
      { fn: 'pm_version_restore', args: { p_version: 'v1', p_backup_title: 'Before restore' } },
      { fn: 'pm_version_set_title', args: { p_version: 'v1', p_title: 'New title' } },
    ]);
  });

  it('deleteProjectVersion deletes the version row (children: FK cascade)', async () => {
    const f = fakeSupabase({});
    await createVersionApi(f.sb).deleteProjectVersion('v1');
    expect(f.calls[0]).toMatchObject({ table: 'version_project_table', op: 'delete', filters: [['rowVersionGUID', 'v1']] });
  });

  it('SQL not run: the RPC is missing -> PMMissingTableError; other errors keep their message', async () => {
    const missing = fakeSupabase({ rpc: { pm_version_save: { error: { code: 'PGRST202', message: 'Could not find the function public.pm_version_save' } } } });
    await expect(createVersionApi(missing.sb).saveProjectVersion('p', 't')).rejects.toBeInstanceOf(PMMissingTableError);
    const denied = fakeSupabase({ rpc: { pm_version_restore: { error: { message: 'pm_gantt: version not found' } } } });
    await expect(createVersionApi(denied.sb).restoreProjectVersion('v', 't')).rejects.toThrow('version not found');
    expect(isMissingFunctionError({ code: '42883' }, 'x')).toBe(true);
    expect(isMissingFunctionError({ message: 'permission denied' }, 'pm_version_save')).toBe(false);
    expect(isMissingFunctionError(null, 'x')).toBe(false);
  });
});
