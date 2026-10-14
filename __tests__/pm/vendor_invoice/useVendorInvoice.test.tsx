/** @jest-environment jsdom */
// The data hooks of the vendor invoice: the vendors of a task, the documents of the form with their commands, the list, the creation, the "open" command.
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../ui/pmUiTestKit';

const fake: any = { calls: [] as { name: string; args: any }[], rpc: {} as Record<string, any> };
fake.client = { rpc: jest.fn(async (name: string, args: any) => { fake.calls.push({ name, args }); const r = fake.rpc[name]; return typeof r === 'function' ? r(args) : r ?? { data: null, error: null }; }) };
jest.doMock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false, navigate: jest.fn() }) }));
const { useCreateVendorInvoices, useOpenVendorInvoice, useVendorCandidates, useVendorInvoiceDocuments, useVendorInvoiceList } = require('../../../kit8/pm/vendor_invoice/useVendorInvoice');
import { EMPTY_VENDOR_INVOICE_FILTER } from '../../../kit8/pm/vendor_invoice/vendorInvoiceModel';

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
