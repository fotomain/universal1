// Task templates - Supabase layer (kit8/pm/tasktemplate/api/taskTemplateApi.ts) on a tiny recording fake.
import { createTaskTemplateApi } from '../../../kit8/pm/tasktemplate/api/taskTemplateApi';
import { PMMissingTableError } from '../../../kit8/pm/crud/api/projectUserSettingsApi';

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

describe('taskTemplateApi', () => {
  it('readTaskTemplates: every template of the organization (RLS decides), newest first, normalized', async () => {
    const f = fakeSupabase({ tables: { task_template_header: { data: [{ rowGUID: 't1', orderInList: '2', rowJSON: { templateTitle: 'A', templateRowCount: '3' } }] } } });
    const r = await createTaskTemplateApi(f.sb).readTaskTemplates();
    expect(r.missing).toBe(false);
    expect(r.rows[0]).toMatchObject({ rowGUID: 't1', orderInList: 2, rowJSON: { templateTitle: 'A', templateRowCount: 3, templateKind: 'task' } });
    expect(f.calls[0]).toMatchObject({ table: 'task_template_header', op: 'select', filters: [], order: ['created_at', { ascending: false }] });
  });

  it('readTaskTemplates: table not created yet -> { missing: true }', async () => {
    const f = fakeSupabase({ tables: { task_template_header: { error: { code: 'PGRST205', message: "Could not find the table 'public.task_template_header' in the schema cache" } } } });
    expect(await createTaskTemplateApi(f.sb).readTaskTemplates()).toEqual({ rows: [], missing: true });
  });

  it('save / fill / rename go through the RPCs with the SQL argument names', async () => {
    const f = fakeSupabase({ rpc: { task_template_save: { data: 'new-template' }, task_template_fill: { data: { mode: 'tree', tasks: 2, lines: 4, dependencies: 1 } } } });
    const api = createTaskTemplateApi(f.sb);
    expect(await api.saveTaskTemplate('task-1', 'Foundation', 'text')).toBe('new-template');
    expect(await api.fillFromTaskTemplate('tpl-1', 'task-2', true)).toEqual({ mode: 'tree', tasks: 2, lines: 4, dependencies: 1 });
    await api.renameTaskTemplate('tpl-1', 'New title');
    expect(f.rpcCalls).toEqual([
      { fn: 'task_template_save', args: { p_task: 'task-1', p_title: 'Foundation', p_description: 'text' } },
      { fn: 'task_template_fill', args: { p_template: 'tpl-1', p_task: 'task-2', p_replace: true } },
      { fn: 'task_template_set_title', args: { p_template: 'tpl-1', p_title: 'New title', p_description: null } },
    ]);
  });

  it('delete is a DELETE of the header (its rows follow in the database)', async () => {
    const f = fakeSupabase({});
    await createTaskTemplateApi(f.sb).deleteTaskTemplate('tpl-1');
    expect(f.calls[0]).toMatchObject({ table: 'task_template_header', op: 'delete', filters: [['rowGUID', 'tpl-1']] });
  });

  it('an RPC that is not there (SQL not run) -> PMMissingTableError; another error is passed on as it is', async () => {
    const missing = fakeSupabase({ rpc: { task_template_save: { error: { code: 'PGRST202', message: 'Could not find the function public.task_template_save' } } } });
    await expect(createTaskTemplateApi(missing.sb).saveTaskTemplate('t', 'x')).rejects.toBeInstanceOf(PMMissingTableError);
    const refused = fakeSupabase({ rpc: { task_template_fill: { error: { message: 'task_template: task not found' } } } });
    await expect(createTaskTemplateApi(refused.sb).fillFromTaskTemplate('a', 'b', false)).rejects.toThrow('task not found');
  });
});
