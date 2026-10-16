/** @jest-environment jsdom */
// The data hooks of the vendor invoice: the vendors of a task, the documents of the form with their commands, the list, the creation, the "open" command.
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../../../pm/ui/pmUiTestKit';

const fake: any = { calls: [] as { name: string; args: any }[], rpc: {} as Record<string, any> };
fake.client = { rpc: jest.fn(async (name: string, args: any) => { fake.calls.push({ name, args }); const r = fake.rpc[name]; return typeof r === 'function' ? r(args) : r ?? { data: null, error: null }; }) };
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false, navigate: jest.fn() }) }));
const { useCreateVendorInvoices, useOpenVendorInvoice, useStartVendorInvoice, useVendorCandidates, useVendorInvoiceDocuments, useVendorInvoiceList } = require('../../../../kit8/documents/vendor/invoice/useVendorInvoice');
import { EMPTY_VENDOR_INVOICE_FILTER } from '../../../../kit8/documents/vendor/invoice/vendorInvoiceModel';

const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const callsOf = (name: string) => fake.calls.filter((c: any) => c.name === name);
const docRow = (guid: string, over: Record<string, any> = {}) => ({ documentGUID: guid, documentNumber: `VI-${guid}`, documentStatus: 'draft', vendorInvoiceNumber: '', vendorInvoiceDay: null, legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', contractInfo: 'S-1', currency: 'EUR', folder: 'le-1:vp-1', authorName: 'Anna', lineCount: 1, sumBeforeVAT: '10', sumVAT: '2', sumWithVAT: '12', ...over });
const listAnswer = (...rows: any[]) => ({ data: { totalCount: rows.length, totalsByCurrency: [], rows }, error: null });
let latest: any;
beforeEach(() => { fake.calls = []; fake.rpc = {}; });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('useVendorCandidates: the RPC gets the task and the lines (null = every line); the answer is typed', async () => {
  fake.rpc.vendor_invoice_candidates = { data: { rows: [{ partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', lineCount: 2, lineGUIDs: ['l1', 'l2'] }], skipped: 1 }, error: null };
  function Probe() { latest = useVendorCandidates('task-a', ['l1', 'l2']); return null; }
  renderUI(<Probe />);
  await flush();
  expect(callsOf('vendor_invoice_candidates')[0].args).toEqual({ p_task: 'task-a', p_lines: ['l1', 'l2'] });
  expect(latest.rows[0]).toMatchObject({ partnerGUID: 'vp-1', lineGUIDs: ['l1', 'l2'] });
  expect(latest.skipped).toBe(1);
  cleanupUI();
  function Probe2() { latest = useVendorCandidates('task-b'); return null; }
  renderUI(<Probe2 />);
  await flush();
  expect(callsOf('vendor_invoice_candidates').at(-1).args).toEqual({ p_task: 'task-b', p_lines: null });
});

it('useVendorInvoiceList: the filter goes to the RPC as p_filter; totals per currency', async () => {
  fake.rpc.vendor_invoice_list = { data: { totalCount: 1, totalsByCurrency: [{ currency: 'EUR', count: 1, sumBeforeVAT: 10, sumVAT: 2, sumWithVAT: 12 }], rows: [docRow('d1')] }, error: null };
  function Probe() { latest = useVendorInvoiceList({ ...EMPTY_VENDOR_INVOICE_FILTER, partnerGUID: 'vp-list-1', fromDay: '20261001' }, 50); return null; }
  renderUI(<Probe />);
  await flush();
  expect(callsOf('vendor_invoice_list')[0].args).toEqual({ p_filter: { partnerGUID: 'vp-list-1', fromDay: '2026-10-01' }, p_limit: 50, p_offset: 0 });
  expect(latest.answer.rows[0]).toMatchObject({ documentGUID: 'd1', sumWithVAT: 12 });
  expect(latest.answer.totalsByCurrency[0]).toMatchObject({ currency: 'EUR', sumWithVAT: 12 });
  expect(latest.error).toBeNull();
});

it('useVendorInvoiceList: an error of the database is a message', async () => {
  fake.rpc.vendor_invoice_list = { data: null, error: { message: 'permission denied' } };
  function Probe() { latest = useVendorInvoiceList({ ...EMPTY_VENDOR_INVOICE_FILTER, author: 'err-case' }); return null; }
  renderUI(<Probe />);
  await flush();
  expect(latest.error).toBe('permission denied');
});

describe('useVendorInvoiceDocuments', () => {
  const mount = (guids: string[]) => { function Probe() { latest = useVendorInvoiceDocuments(guids); return null; } renderUI(<Probe />); };
  it('asks for the documents of the route (documentGUIDs) and keeps THEIR order; a missing one is left out', async () => {
    fake.rpc.vendor_invoice_list = listAnswer(docRow('dB'), docRow('dA'));
    mount(['dA', 'dB', 'dX']);
    await flush();
    expect(callsOf('vendor_invoice_list')[0].args.p_filter).toEqual({ documentGUIDs: ['dA', 'dB', 'dX'] });
    expect(latest.headers.map((h: any) => h.guid)).toEqual(['dA', 'dB']);
    expect(latest.headers[0]).toMatchObject({ number: 'VI-dA', status: 'draft', partnerTitle: 'Acme', legalEntityGUID: 'le-1' });
  });
  it('no documents: nothing is asked', async () => {
    mount([]);
    await flush();
    expect(callsOf('vendor_invoice_list')).toHaveLength(0);
    expect(latest.headers).toEqual([]);
  });
  it('setHeader: the RPC gets the patch, the documents are read again', async () => {
    fake.rpc.vendor_invoice_list = listAnswer(docRow('dS'));
    mount(['dS']);
    await flush();
    const before = callsOf('vendor_invoice_list').length;
    let ok: boolean | undefined;
    await act(async () => { ok = await latest.setHeader('dS', { vendorInvoiceNumber: 'INV-5', vendorInvoiceDateTime: '2026-10-20T00:00:00.000Z' }); });
    await flush();
    expect(ok).toBe(true);
    expect(callsOf('vendor_invoice_set_header')[0].args).toEqual({ p_header: 'dS', p_patch: { vendorInvoiceNumber: 'INV-5', vendorInvoiceDateTime: '2026-10-20T00:00:00.000Z' } });
    expect(callsOf('vendor_invoice_list').length).toBeGreaterThan(before);
  });
  it('post: a typed answer; a refusal is an answer, a failure is a message and null', async () => {
    fake.rpc.vendor_invoice_list = listAnswer(docRow('dP'));
    fake.rpc.post_vendor_invoice = { data: { status: 'refused', lines: 1, problems: [{ lineGUID: null, problem: 'invoiceNumberMissing' }] }, error: null };
    mount(['dP']);
    await flush();
    let answer: any;
    await act(async () => { answer = await latest.post('dP'); });
    expect(callsOf('post_vendor_invoice')[0].args).toEqual({ p_header: 'dP' });
    expect(answer).toEqual({ status: 'refused', lines: 1, problems: [{ lineGUID: null, problem: 'invoiceNumberMissing' }] });
    expect(latest.error).toBeNull();
    fake.rpc.post_vendor_invoice = { data: null, error: { message: 'boom' } };
    await act(async () => { answer = await latest.post('dP'); });
    expect(answer).toBeNull();
    expect(latest.error).toBe('boom');
    expect(latest.busy).toBe(false);
  });
  it('unpost and remove call their RPCs; a refused delete is false + the message', async () => {
    fake.rpc.vendor_invoice_list = listAnswer(docRow('dU'));
    fake.rpc.unpost_vendor_invoice = { data: { status: 'draft', problems: [] }, error: null };
    mount(['dU']);
    await flush();
    await act(async () => { await latest.unpost('dU'); });
    expect(callsOf('unpost_vendor_invoice')[0].args).toEqual({ p_header: 'dU' });
    let ok: boolean | undefined;
    await act(async () => { ok = await latest.remove('dU'); });
    expect(ok).toBe(true);
    expect(callsOf('delete_vendor_invoice')[0].args).toEqual({ p_header: 'dU' });
    fake.rpc.delete_vendor_invoice = { data: null, error: { message: 'a posted vendor invoice cannot be deleted: unpost it first' } };
    await act(async () => { ok = await latest.remove('dU'); });
    expect(ok).toBe(false);
    expect(latest.error).toContain('unpost it first');
  });
});

it('useCreateVendorInvoices: the selection, the legal entity; the answer is typed; a failure is a message', async () => {
  fake.rpc.create_vendor_invoices = { data: { documents: [{ documentGUID: 'n1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2 }], skipped: [] }, error: null };
  function Probe() { latest = useCreateVendorInvoices(); return null; }
  renderUI(<Probe />);
  let answer: any;
  await act(async () => { answer = await latest.create('t1', [{ partnerGUID: 'vp-1', contractGUID: 'vc-1', lineGUIDs: ['l1', 'l2'] }], 'le-2'); });
  expect(callsOf('create_vendor_invoices')[0].args).toEqual({ p_task: 't1', p_selection: [{ partnerGUID: 'vp-1', contractGUID: 'vc-1', lineGUIDs: ['l1', 'l2'] }], p_legal_entity: 'le-2' });
  expect(answer.documents).toEqual([{ documentGUID: 'n1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2 }]);
  fake.rpc.create_vendor_invoices = { data: null, error: { message: 'choose the legal entity of the invoice (the contract has none)' } };
  await act(async () => { answer = await latest.create('t1', [], null); });
  expect(answer).toBeNull();
  expect(latest.error).toContain('choose the legal entity');
  expect(callsOf('create_vendor_invoices').at(-1).args.p_legal_entity).toBeNull();
});

it('useVendorInvoiceDocuments.addLine: the RPC gets the document and the kind; an error of the database is the message', async () => {
  fake.rpc.vendor_invoice_list = listAnswer(docRow('dA'));
  fake.rpc.vendor_invoice_add_line = { data: 'new-line-guid', error: null };
  function Probe() { latest = useVendorInvoiceDocuments(['dA']); return null; }
  renderUI(<Probe />);
  await flush();
  let ok: boolean = false;
  await act(async () => { ok = await latest.addLine('dA', 'materialGenus'); });
  expect(ok).toBe(true);
  expect(callsOf('vendor_invoice_add_line')[0].args).toEqual({ p_header: 'dA', p_genus: 'materialGenus' });
  fake.rpc.vendor_invoice_add_line = { data: null, error: { message: 'independent invoice input is switched off in the project settings (Vendor)' } };
  await act(async () => { ok = await latest.addLine('dA', 'timeGenus'); });
  expect(ok).toBe(false);
  expect(latest.error).toContain('switched off');
});

it('useOpenVendorInvoice: the window of the vendors for a task, the form for a document; nothing without either', () => {
  function Probe() { latest = useOpenVendorInvoice(); return null; }
  renderUI(<Probe />);
  latest({ taskGUID: 't1', projectGUID: 'p1', lineGUIDs: ['l1'] });
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/project/task/vendor-invoice/new', params: { taskGUID: 't1', projectGUID: 'p1', lineGUIDs: 'l1' } });
  latest({ taskGUID: 't1', documentGUID: 'd1' });
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/project/task/vendor-invoice', params: { taskGUID: 't1', documentGUID: 'd1' } });
  mockPush.mockClear();
  latest({ taskGUID: '' });
  expect(mockPush).not.toHaveBeenCalled();
});

describe('useStartVendorInvoice - the context menu "Vendor Invoice" creates the invoice(s) at once', () => {
  const cand = (over: Record<string, any> = {}) => ({ partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', legalEntityGUID: 'le-1', lineCount: 2, lineGUIDs: ['l1', 'l2'], ...over });
  const mount = () => { function Probe() { latest = useStartVendorInvoice(); return null; } renderUI(<Probe />); };
  const start = async (p: any) => { await act(async () => { await latest.start(p); }); };

  it('every vendor + contract of the lines is created and the form opens on the first document (no choice window)', async () => {
    fake.rpc.vendor_invoice_candidates = { data: { rows: [cand(), cand({ partnerGUID: 'vp-2', contractGUID: null, lineGUIDs: ['l3'], lineCount: 1 })], skipped: 0 }, error: null };
    fake.rpc.create_vendor_invoices = { data: { documents: [{ documentGUID: 'n1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2 }], skipped: [] }, error: null };
    mount();
    await start({ taskGUID: 't1' });
    expect(callsOf('vendor_invoice_candidates')[0].args).toEqual({ p_task: 't1', p_lines: null });
    expect(callsOf('create_vendor_invoices')[0].args).toEqual({
      p_task: 't1', p_legal_entity: null,
      p_selection: [{ partnerGUID: 'vp-1', contractGUID: 'vc-1', lineGUIDs: ['l1', 'l2'] }, { partnerGUID: 'vp-2', contractGUID: null, lineGUIDs: ['l3'] }],
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice', params: { taskGUID: 't1', documentGUID: 'n1', documents: 'n1' } });
  });

  it('a line of the Finances table: only that line goes to the candidates (and the project to the form)', async () => {
    fake.rpc.vendor_invoice_candidates = { data: { rows: [cand({ lineGUIDs: ['l1'], lineCount: 1 })], skipped: 0 }, error: null };
    fake.rpc.create_vendor_invoices = { data: { documents: [{ documentGUID: 'n1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 1 }], skipped: [] }, error: null };
    mount();
    await start({ taskGUID: 't1', projectGUID: 'p1', lineGUIDs: ['l1'] });
    expect(callsOf('vendor_invoice_candidates')[0].args).toEqual({ p_task: 't1', p_lines: ['l1'] });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice', params: { taskGUID: 't1', projectGUID: 'p1', documentGUID: 'n1', documents: 'n1' } });
  });

  it('lines WITHOUT any vendor: ONE draft without a vendor is created at once (no legal entity asked) and the form opens', async () => {
    fake.rpc.vendor_invoice_candidates = { data: { rows: [], skipped: 2, skippedLineGUIDs: ['l1', 'l2'] }, error: null };
    fake.rpc.create_vendor_invoices = { data: { documents: [{ documentGUID: 'n1', partnerGUID: null, contractGUID: null, lineCount: 2 }], skipped: [] }, error: null };
    mount();
    await start({ taskGUID: 't1', projectGUID: 'p1', lineGUIDs: ['l1', 'l2'] });
    expect(callsOf('create_vendor_invoices')[0].args).toEqual({ p_task: 't1', p_legal_entity: null, p_selection: [{ partnerGUID: null, contractGUID: null, lineGUIDs: ['l1', 'l2'] }] });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice', params: { taskGUID: 't1', projectGUID: 'p1', documentGUID: 'n1', documents: 'n1' } });
  });

  it('nothing to invoice at all (no vendor, no line): nothing is created, the choice window opens (it says why) with the same lines', async () => {
    fake.rpc.vendor_invoice_candidates = { data: { rows: [], skipped: 0, skippedLineGUIDs: [] }, error: null };
    mount();
    await start({ taskGUID: 't1', projectGUID: 'p1', lineGUIDs: ['l1'] });
    expect(callsOf('create_vendor_invoices')).toHaveLength(0);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice/new', params: { taskGUID: 't1', projectGUID: 'p1', lineGUIDs: 'l1' } });
  });

  it('a contract without a legal entity needs a person: the choice window asks for it, nothing is created', async () => {
    fake.rpc.vendor_invoice_candidates = { data: { rows: [cand({ legalEntityGUID: null })], skipped: 0 }, error: null };
    mount();
    await start({ taskGUID: 't1' });
    expect(callsOf('create_vendor_invoices')).toHaveLength(0);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice/new', params: { taskGUID: 't1' } });
  });

  it('nothing left to invoice (the database made no document) or a failed call: the choice window opens', async () => {
    fake.rpc.vendor_invoice_candidates = { data: { rows: [cand()], skipped: 0 }, error: null };
    fake.rpc.create_vendor_invoices = { data: { documents: [], skipped: [{ partnerGUID: 'vp-1', contractGUID: 'vc-1', reason: 'nothing to invoice' }] }, error: null };
    mount();
    await start({ taskGUID: 't1' });
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/project/task/vendor-invoice/new', params: { taskGUID: 't1' } });
    fake.rpc.create_vendor_invoices = { data: null, error: { message: 'boom' } };
    await start({ taskGUID: 't1' });
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/project/task/vendor-invoice/new', params: { taskGUID: 't1' } });
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  describe('on the web the vendor invoice opens in a NEW browser tab', () => {
    let open: jest.SpyInstance; let tab: { location: { href: string } };
    beforeEach(() => { tab = { location: { href: '' } }; open = jest.spyOn(window, 'open').mockImplementation(() => tab as any); });
    afterEach(() => open.mockRestore());
    it('a blank tab is opened INSIDE the click (before any call) and pointed at the form of the first document; the router is not used', async () => {
      fake.rpc.vendor_invoice_candidates = { data: { rows: [cand(), cand({ partnerGUID: 'vp-2', contractGUID: null, lineGUIDs: ['l3'], lineCount: 1 })], skipped: 0 }, error: null };
      fake.rpc.create_vendor_invoices = { data: { documents: [{ documentGUID: 'n1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2 }, { documentGUID: 'n2', partnerGUID: 'vp-2', contractGUID: null, lineCount: 1 }], skipped: [] }, error: null };
      mount();
      let p: Promise<void>;
      act(() => { p = latest.start({ taskGUID: 't1', projectGUID: 'p1' }); });
      expect(open).toHaveBeenCalledTimes(1);                       // synchronously: before the first await
      expect(open).toHaveBeenLastCalledWith('', '_blank');
      expect(fake.calls).toHaveLength(1);                          // only the first call has started
      await act(async () => { await p; });
      expect(tab.location.href).toBe('/pm/project/task/vendor-invoice?taskGUID=t1&projectGUID=p1&documentGUID=n1&documents=n1%2Cn2');
      expect(open).toHaveBeenLastCalledWith('/pm/project/task/vendor-invoice?documentGUID=n2', '_blank');   // the second document: a tab of its own
      expect(mockPush).not.toHaveBeenCalled();
    });
    it('when the choice window is needed it opens in the same new tab', async () => {
      fake.rpc.vendor_invoice_candidates = { data: { rows: [], skipped: 0, skippedLineGUIDs: [] }, error: null };
      mount();
      await start({ taskGUID: 't1', projectGUID: 'p1', lineGUIDs: ['l1'] });
      expect(tab.location.href).toBe('/pm/project/task/vendor-invoice/new?taskGUID=t1&projectGUID=p1&lineGUIDs=l1');
      expect(mockPush).not.toHaveBeenCalled();
    });
    it('a blocked tab (window.open gives null): the router in this window, as before', async () => {
      open.mockImplementation(() => null);
      fake.rpc.vendor_invoice_candidates = { data: { rows: [cand()], skipped: 0 }, error: null };
      fake.rpc.create_vendor_invoices = { data: { documents: [{ documentGUID: 'n1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2 }], skipped: [] }, error: null };
      mount();
      await start({ taskGUID: 't1' });
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice', params: { taskGUID: 't1', documentGUID: 'n1', documents: 'n1' } });
    });
    it('useOpenVendorInvoice with a document: a new tab; a task only (the choice window): this window', () => {
      function Probe() { latest = useOpenVendorInvoice(); return null; }
      renderUI(<Probe />);
      latest({ taskGUID: 't1', projectGUID: 'p1', documentGUID: 'd1' });
      expect(open).toHaveBeenLastCalledWith('/pm/project/task/vendor-invoice?taskGUID=t1&projectGUID=p1&documentGUID=d1', '_blank');
      expect(mockPush).not.toHaveBeenCalled();
      latest({ taskGUID: 't1', lineGUIDs: ['l1'] });
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });

  it('nothing without a task', async () => {
    mount();
    await start({ taskGUID: '' });
    expect(fake.calls).toHaveLength(0);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
