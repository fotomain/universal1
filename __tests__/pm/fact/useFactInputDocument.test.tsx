/** @jest-environment jsdom */
// useFactInputDocument + factInputApi: the latest draft is shown, the first open makes a document, the commands call the RPCs / tables and re-read what they changed.
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../ui/pmUiTestKit';

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
jest.doMock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const { useFactInputDocument } = require('../../../kit8/pm/fact/useFactInputDocument');

const head = (guid: string, over: Record<string, any> = {}) => ({
  rowGUID: guid, rowProjectGUID: 'p1', rowOwnerGUID: 't1',
  rowJSON: { documentHeader: { documentNumber: `FI-${guid}`, documentStatus: 'draft', strongInput: false, created_at: '2026-10-14T08:00:00Z', ...over } },
});
const lineRow = (guid: string, header: string) => ({ rowGUID: guid, rowHeaderGUID: header, genusGUID: 'timeGenus', qtyForContract: 1, rowPeriodDatetime: '2026-10-14T00:00:00Z', rowJSON: {}, orderInList: 1 });
const task = { data: { projectGUID: 'p1', rowJSON: { name: 'task03' } }, error: null };

let latest: any;
let n = 0;
function Probe({ task: taskGUID, doc }: { task: string; doc?: string | null }) {
  latest = useFactInputDocument(taskGUID, doc);
  return React.createElement('div', null, String(latest.lines.length));
}
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const uid = () => `task-${++n}`;
const opsOf = (table: string, op: string): Op[] => fake.ops.filter((o: Op) => o.table === table && o.op === op);
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('what is shown', () => {
  it('the task name, the documents newest first, the latest DRAFT and its lines', async () => {
    resetFake({
      'project_task_table.select': task,
      'task_fact_header.select': { data: [head('h-posted', { documentStatus: 'posted', created_at: '2026-10-20T00:00:00Z' }), head('h-draft', { created_at: '2026-10-15T00:00:00Z' }), head('h-old', { created_at: '2026-10-01T00:00:00Z' })], error: null },
      'task_fact_timeline.select': (rec: Op) => ({ data: [lineRow('l1', 'h-draft'), lineRow('l2', 'h-draft')], error: null, rec }),
    });
    renderUI(<Probe task={uid()} />);
    await flush();
    expect(latest.taskName).toBe('task03');
    expect(latest.projectGUID).toBe('p1');
    expect(latest.documents).toHaveLength(3);
    expect(latest.header.guid).toBe('h-draft');
    expect(latest.lines).toHaveLength(2);
    const lineRead = opsOf('task_fact_timeline', 'select')[0];
    expect(lineRead.args).toContainEqual(['eq', 'rowHeaderGUID', 'h-draft']);
    expect(latest.error).toBeNull();
  });

  it('a given document is shown instead of the latest draft; picking another one switches', async () => {
    resetFake({
      'project_task_table.select': task,
      'task_fact_header.select': { data: [head('h1'), head('h2', { documentStatus: 'posted' })], error: null },
      'task_fact_timeline.select': { data: [], error: null },
    });
    renderUI(<Probe task={uid()} doc="h2" />);
    await flush();
    expect(latest.header.guid).toBe('h2');
    expect(latest.header.status).toBe('posted');
    act(() => latest.select('h1'));
    await flush();
    expect(latest.header.guid).toBe('h1');
  });

  it('a read error is shown', async () => {
    resetFake({ 'project_task_table.select': task, 'task_fact_header.select': { data: null, error: { message: 'permission denied' } } });
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
      'task_fact_header.select': () => ({ data: created ? [head('h-new')] : [], error: null }),
      'task_fact_timeline.select': { data: [lineRow('l1', 'h-new')], error: null },
      'rpc.task_fact_document_create': () => { created = true; return { data: 'h-new', error: null }; },
    });
    renderUI(<Probe task={t} />);
    await flush();
    expect(opsOf('rpc', 'task_fact_document_create')).toHaveLength(1);
    expect(opsOf('rpc', 'task_fact_document_create')[0].args[0]).toEqual({ p_task: t });
    expect(latest.header.guid).toBe('h-new');
    expect(latest.lines).toHaveLength(1);
  });

  it('a named document is never replaced by a new one', async () => {
    resetFake({ 'project_task_table.select': task, 'task_fact_header.select': { data: [], error: null } });
    renderUI(<Probe task={uid()} doc="h-asked" />);
    await flush();
    expect(opsOf('rpc', 'task_fact_document_create')).toHaveLength(0);
  });
});

describe('the commands', () => {
  const world = (extra: Record<string, any> = {}) => resetFake({
    'project_task_table.select': task,
    'task_fact_header.select': { data: [head('h1')], error: null },
    'task_fact_timeline.select': { data: [lineRow('l1', 'h1')], error: null },
    ...extra,
  });

  it('Post calls the RPC, returns the typed answer and re-reads the document', async () => {
    world({ 'rpc.post_task_fact_document': { data: { status: 'posted', lines: 1, problems: [] }, error: null } });
    renderUI(<Probe task={uid()} />);
    await flush();
    const before = opsOf('task_fact_header', 'select').length;
    let answer: any;
    await act(async () => { answer = await latest.post(); });
    await flush();
    expect(opsOf('rpc', 'post_task_fact_document')[0].args[0]).toEqual({ p_header: 'h1' });
    expect(answer).toEqual({ status: 'posted', lines: 1, problems: [] });
    expect(opsOf('task_fact_header', 'select').length).toBeGreaterThan(before);
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

  it('Unpost', async () => {
    world({ 'rpc.unpost_task_fact_document': { data: { status: 'draft', problems: [] }, error: null } });
    renderUI(<Probe task={uid()} />);
    await flush();
    await act(async () => { await latest.unpost(); });
    expect(opsOf('rpc', 'unpost_task_fact_document')[0].args[0]).toEqual({ p_header: 'h1' });
  });

  it('saveLine updates the line by its GUID and re-reads the lines (the database computes the sums)', async () => {
    world({ 'task_fact_timeline.update': { data: lineRow('l1', 'h1'), error: null } });
    renderUI(<Probe task={uid()} />);
    await flush();
    const reads = opsOf('task_fact_timeline', 'select').length;
    let ok: boolean | undefined;
    await act(async () => { ok = await latest.saveLine('l1', { qtyForContract: 7 }); });
    await flush();
    expect(ok).toBe(true);
    const upd = opsOf('task_fact_timeline', 'update')[0];
    expect(upd.args[0]).toEqual([{ qtyForContract: 7 }]);
    expect(upd.args).toContainEqual(['eq', 'rowGUID', 'l1']);
    expect(opsOf('task_fact_timeline', 'select').length).toBeGreaterThan(reads);
  });

  it('a refusal of the database is a message and false', async () => {
    world({ 'task_fact_timeline.update': { data: null, error: { message: 'strong fact input: only the date and the quantity of a line can be changed' } } });
    renderUI(<Probe task={uid()} />);
    await flush();
    let ok: boolean | undefined;
    await act(async () => { ok = await latest.saveLine('l1', { rowJSON: {} }); });
    expect(ok).toBe(false);
    expect(latest.error).toContain('only the date and the quantity');
    expect(latest.busy).toBe(false);
  });

  it('addLine inserts, removeLine deletes by GUID, removeDocument deletes the draft', async () => {
    world({ 'task_fact_timeline.insert': { data: lineRow('l9', 'h1'), error: null } });
    renderUI(<Probe task={uid()} />);
    await flush();
    await act(async () => { await latest.addLine({ rowHeaderGUID: 'h1', genusGUID: 'timeGenus', qtyForContract: 2 }); });
    expect(opsOf('task_fact_timeline', 'insert')[0].args[0]).toEqual([{ rowHeaderGUID: 'h1', genusGUID: 'timeGenus', qtyForContract: 2 }]);
    await act(async () => { await latest.removeLine('l1'); });
    expect(opsOf('task_fact_timeline', 'delete')[0].args).toContainEqual(['eq', 'rowGUID', 'l1']);
    await act(async () => { await latest.removeDocument(); });
    expect(opsOf('task_fact_header', 'delete')[0].args).toContainEqual(['eq', 'rowGUID', 'h1']);
  });

  it('New document creates one and shows it', async () => {
    let docs = [head('h1')];
    world({
      'task_fact_header.select': () => ({ data: docs, error: null }),
      'rpc.task_fact_document_create': () => { docs = [head('h2', { created_at: '2026-10-30T00:00:00Z' }), ...docs]; return { data: 'h2', error: null }; },
    });
    renderUI(<Probe task={uid()} />);
    await flush();
    let guid: string | null = null;
    await act(async () => { guid = await latest.newDocument(); });
    await flush();
    expect(guid).toBe('h2');
    expect(latest.header.guid).toBe('h2');
  });
});
