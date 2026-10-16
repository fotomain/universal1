/** @jest-environment jsdom */
// useFactInputDocument + factInputApi: the documents of the task come from the RPC task_fact_document_list (newest first), the latest DRAFT is shown, the first open makes a document,
// the commands call the RPCs / the header table and re-read the documents. The LINES are the business of the ReusableTable (redux entity), not of this hook.
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../../../pm/ui/pmUiTestKit';

interface Op { table: string; op: string; args: any[] }
const fake: any = {};
// a table call: a chainable, awaitable builder; the result comes from fake.results[table][op]
function builder(table: string, op: string, first: any[]) {
  const record: Op = { table, op, args: [first] };
  fake.ops.push(record);
  const result = () => {
    const r = fake.results[`${table}.${op}`];
    return typeof r === 'function' ? r(record) : r ?? { data: [], error: null };
  };
  const b: any = new Proxy({}, {
    get: (_t, k: string) => {
      if (k === 'then') return (res: any, rej: any) => Promise.resolve(result()).then(res, rej);
      if (k === 'single' || k === 'maybeSingle') return () => Promise.resolve(result());
      return (...a: any[]) => { record.args.push([k, ...a]); return b; };
    },
  });
  return b;
}
function resetFake(results: Record<string, any>) {
  fake.ops = [] as Op[];
  fake.results = results;
  fake.client = {
    from: jest.fn((table: string) => ({
      select: (...a: any[]) => builder(table, 'select', a),
      insert: (...a: any[]) => builder(table, 'insert', a),
      update: (...a: any[]) => builder(table, 'update', a),
      delete: (...a: any[]) => builder(table, 'delete', a),
    })),
    rpc: jest.fn(async (name: string, args: any) => { fake.ops.push({ table: 'rpc', op: name, args: [args] }); const r = fake.results[`rpc.${name}`]; return typeof r === 'function' ? r(args) : r ?? { data: null, error: null }; }),
  };
}
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const { useFactInputDocument } = require('../../../../kit8/documents/fact/input/useFactInputDocument');

const row = (guid: string, over: Record<string, any> = {}) => ({
  documentGUID: guid, documentNumber: `FI-${guid}`, documentStatus: 'draft', strongInput: false, authorGUID: 'u1', authorName: 'Anna K', createdAt: '2026-10-14T08:00:00Z', postedAt: null, unpostedAt: null,
  projectGUID: 'p1', projectName: 'Alpha', taskGUID: 't1', taskName: 'task03', lineCount: 2, firstDay: null, lastDay: null, sumForBudget: '10.5', sumForContract: '20', sumForAccounting: '30.25', ...over,
});
const list = (...rows: any[]) => ({ data: { totalCount: rows.length, totals: { sumForBudget: 0, sumForContract: 0, sumForAccounting: 0 }, rows }, error: null });
const task = { data: { projectGUID: 'p1', rowJSON: { name: 'task03' } }, error: null };

let latest: any;
let n = 0;
function Probe({ task: taskGUID, doc }: { task: string; doc?: string | null }) {
  latest = useFactInputDocument(taskGUID, doc);
  return React.createElement('div', null, String(latest.documents.length));
}
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const uid = () => `task-${++n}`;
const opsOf = (table: string, op: string): Op[] => fake.ops.filter((o: Op) => o.table === table && o.op === op);
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('what is shown', () => {
  it('the task name, the documents newest first (with totals as numbers), the latest DRAFT', async () => {
    const t = uid();
    resetFake({
      'project_task_table.select': task,
      'rpc.task_fact_document_list': list(row('h-posted', { documentStatus: 'posted' }), row('h-draft'), row('h-old')),
    });
    renderUI(<Probe task={t} />);
    await flush();
    expect(latest.taskName).toBe('task03');
    expect(latest.projectGUID).toBe('p1');
    expect(latest.documents).toHaveLength(3);
    expect(latest.documents[1].sumForAccounting).toBe(30.25);
    expect(latest.header).toMatchObject({ guid: 'h-draft', number: 'FI-h-draft', status: 'draft', strong: false, userName: 'Anna K' });
    expect(opsOf('rpc', 'task_fact_document_list')[0].args[0]).toEqual({ p_filter: { taskGUID: t }, p_limit: 200, p_offset: 0 });
    expect(latest.error).toBeNull();
  });

  it('no lines query: the lines belong to the table', async () => {
    resetFake({ 'project_task_table.select': task, 'rpc.task_fact_document_list': list(row('h1')) });
    renderUI(<Probe task={uid()} />);
    await flush();
    expect(opsOf('task_fact_usage_timeline', 'select')).toHaveLength(0);
  });

  it('a given document is shown instead of the latest draft; picking another one switches', async () => {
    resetFake({ 'project_task_table.select': task, 'rpc.task_fact_document_list': list(row('h1'), row('h2', { documentStatus: 'posted' })) });
    renderUI(<Probe task={uid()} doc="h2" />);
    await flush();
    expect(latest.header.guid).toBe('h2');
    expect(latest.header.status).toBe('posted');
    act(() => latest.select('h1'));
    await flush();
    expect(latest.header.guid).toBe('h1');
  });

  it('a picked document that disappeared falls back to the default one', async () => {
    resetFake({ 'project_task_table.select': task, 'rpc.task_fact_document_list': list(row('h1')) });
    renderUI(<Probe task={uid()} doc="gone" />);
    await flush();
    expect(latest.header.guid).toBe('h1');
  });

  it('only posted documents: the newest is shown', async () => {
    resetFake({ 'project_task_table.select': task, 'rpc.task_fact_document_list': list(row('h1', { documentStatus: 'posted' }), row('h2', { documentStatus: 'posted' })) });
    renderUI(<Probe task={uid()} />);
    await flush();
    expect(latest.header.guid).toBe('h1');
  });

  it('a read error is shown', async () => {
    resetFake({ 'project_task_table.select': task, 'rpc.task_fact_document_list': { data: null, error: { message: 'permission denied' } } });
    renderUI(<Probe task={uid()} />);
    await flush();
    expect(latest.error).toBe('permission denied');
  });
});

describe('the first open', () => {
  it('a task without any document gets one - with all its lines (task_fact_document_create) - ONCE', async () => {
    const t = uid();
    let created = false;
    resetFake({
      'project_task_table.select': task,
      'rpc.task_fact_document_list': () => (created ? list(row('h-new')) : list()),
      'rpc.task_fact_document_create': () => { created = true; return { data: 'h-new', error: null }; },
    });
    renderUI(<Probe task={t} />);
    await flush();
    expect(opsOf('rpc', 'task_fact_document_create')).toHaveLength(1);
    expect(opsOf('rpc', 'task_fact_document_create')[0].args[0]).toEqual({ p_task: t });
    expect(latest.header.guid).toBe('h-new');
  });

  it('a named document is never replaced by a new one', async () => {
    resetFake({ 'project_task_table.select': task, 'rpc.task_fact_document_list': list() });
    renderUI(<Probe task={uid()} doc="h-asked" />);
    await flush();
    expect(opsOf('rpc', 'task_fact_document_create')).toHaveLength(0);
  });
});

describe('the commands', () => {
  const world = (extra: Record<string, any> = {}) => resetFake({ 'project_task_table.select': task, 'rpc.task_fact_document_list': list(row('h1')), ...extra });

  it('Post calls the RPC, returns the typed answer and re-reads the documents', async () => {
    world({ 'rpc.post_task_fact_document': { data: { status: 'posted', lines: 1, problems: [] }, error: null } });
    renderUI(<Probe task={uid()} />);
    await flush();
    const before = opsOf('rpc', 'task_fact_document_list').length;
    let answer: any;
    await act(async () => { answer = await latest.post(); });
    await flush();
    expect(opsOf('rpc', 'post_task_fact_document')[0].args[0]).toEqual({ p_header: 'h1' });
    expect(answer).toEqual({ status: 'posted', lines: 1, problems: [] });
    expect(opsOf('rpc', 'task_fact_document_list').length).toBeGreaterThan(before);
  });

  it('a refused Post is an answer, not an error', async () => {
    world({ 'rpc.post_task_fact_document': { data: { status: 'refused', lines: 1, problems: [{ lineGUID: 'l1', problem: 'dateInTheFuture' }] }, error: null } });
    renderUI(<Probe task={uid()} />);
    await flush();
    let answer: any;
    await act(async () => { answer = await latest.post(); });
    expect(answer.status).toBe('refused');
    expect(answer.problems[0]).toEqual({ lineGUID: 'l1', problem: 'dateInTheFuture' });
    expect(latest.error).toBeNull();
  });

  it('a failing Post is a message and null', async () => {
    world({ 'rpc.post_task_fact_document': { data: null, error: { message: 'boom' } } });
    renderUI(<Probe task={uid()} />);
    await flush();
    let answer: any = 'x';
    await act(async () => { answer = await latest.post(); });
    expect(answer).toBeNull();
    expect(latest.error).toBe('boom');
    expect(latest.busy).toBe(false);
  });

  it('Unpost', async () => {
    world({ 'rpc.unpost_task_fact_document': { data: { status: 'draft', problems: [] }, error: null } });
    renderUI(<Probe task={uid()} />);
    await flush();
    await act(async () => { await latest.unpost(); });
    expect(opsOf('rpc', 'unpost_task_fact_document')[0].args[0]).toEqual({ p_header: 'h1' });
  });

  it('removeDocument deletes the draft header by its GUID and returns true', async () => {
    world({ 'task_fact_header.delete': { data: null, error: null } });
    renderUI(<Probe task={uid()} />);
    await flush();
    let ok: boolean | undefined;
    await act(async () => { ok = await latest.removeDocument(); });
    expect(ok).toBe(true);
    expect(opsOf('task_fact_header', 'delete')[0].args).toContainEqual(['eq', 'rowGUID', 'h1']);
  });

  it('a refused delete is a message and false', async () => {
    world({ 'task_fact_header.delete': { data: null, error: { message: 'a posted document cannot be deleted' } } });
    renderUI(<Probe task={uid()} />);
    await flush();
    let ok: boolean | undefined;
    await act(async () => { ok = await latest.removeDocument(); });
    expect(ok).toBe(false);
    expect(latest.error).toContain('cannot be deleted');
  });

  it('New document creates one and shows it', async () => {
    let docs = [row('h1')];
    world({
      'rpc.task_fact_document_list': () => list(...docs),
      'rpc.task_fact_document_create': () => { docs = [row('h2', { createdAt: '2026-10-30T00:00:00Z' }), ...docs]; return { data: 'h2', error: null }; },
    });
    renderUI(<Probe task={uid()} />);
    await flush();
    let guid: string | null = null;
    await act(async () => { guid = await latest.newDocument(); });
    await flush();
    expect(guid).toBe('h2');
    expect(latest.header.guid).toBe('h2');
  });

  it('refreshLines does not throw without a redux entity action (it only dispatches)', async () => {
    world();
    renderUI(<Probe task={uid()} />);
    await flush();
    expect(() => latest.refreshLines()).not.toThrow();
  });
});
