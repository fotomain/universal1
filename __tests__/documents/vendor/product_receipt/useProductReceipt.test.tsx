/** @jest-environment jsdom */
// The data hooks of the product receipt: the list, the documents of the form with their commands, "open", and the two "Create based on" commands (order → receipt, receipt → vendor invoice).
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../../../pm/ui/pmUiTestKit';

const fake: any = { calls: [] as { name: string; args: any }[], rpc: {} as Record<string, any> };
fake.client = { rpc: jest.fn(async (name: string, args: any) => { fake.calls.push({ name, args }); const r = fake.rpc[name]; return typeof r === 'function' ? r(args) : r ?? { data: null, error: null }; }) };
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false, navigate: jest.fn() }) }));
const { useCreateProductReceiptFromOrder, useCreateVendorInvoiceFromReceipt, useOpenProductReceipt, useProductReceiptDocuments, useProductReceiptList } = require('../../../../kit8/documents/vendor/product_receipt/useProductReceipt');
import { EMPTY_PRODUCT_RECEIPT_FILTER } from '../../../../kit8/documents/vendor/product_receipt/productReceiptModel';

const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const callsOf = (name: string) => fake.calls.filter((c: any) => c.name === name);
const docRow = (guid: string, over: Record<string, any> = {}) => ({ documentGUID: guid, documentNumber: `PR-${guid}`, documentStatus: 'draft', productReceiptNumber: '', productReceiptDay: null, legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', contractInfo: 'S-1', currency: 'EUR', taskGUID: 't1', projectGUID: 'p1', purchaseOrderGUID: 'po1', lineCount: 1, sumBeforeVAT: 10, sumVAT: 2, sumWithVAT: 12, ...over });
const listAnswer = (...rows: any[]) => ({ data: { totalCount: rows.length, totalsByCurrency: [], rows }, error: null });
let latest: any;
beforeEach(() => { fake.calls = []; fake.rpc = {}; });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('useProductReceiptList: the filter goes to the RPC as p_filter; totals per currency; an error is a message', async () => {
  fake.rpc.product_receipt_list = { data: { totalCount: 1, totalsByCurrency: [{ currency: 'EUR', count: 1, sumBeforeVAT: 10, sumVAT: 2, sumWithVAT: 12 }], rows: [docRow('d1')] }, error: null };
  function Probe() { latest = useProductReceiptList({ ...EMPTY_PRODUCT_RECEIPT_FILTER, partnerGUID: 'vp-list-1', fromDay: '20261001' }, 50, { purchaseOrderGUID: 'po1' }); return null; }
  renderUI(<Probe />);
  await flush();
  expect(callsOf('product_receipt_list')[0].args).toEqual({ p_filter: { purchaseOrderGUID: 'po1', partnerGUID: 'vp-list-1', fromDay: '2026-10-01' }, p_limit: 50, p_offset: 0 });
  expect(latest.answer.rows[0]).toMatchObject({ documentGUID: 'd1', sumWithVAT: 12, purchaseOrderGUID: 'po1' });
  cleanupUI();
  fake.rpc.product_receipt_list = { data: null, error: { message: 'permission denied' } };
  function Probe2() { latest = useProductReceiptList({ ...EMPTY_PRODUCT_RECEIPT_FILTER, author: 'err-case' }); return null; }
  renderUI(<Probe2 />);
  await flush();
  expect(latest.error).toBe('permission denied');
});

describe('useProductReceiptDocuments', () => {
  const mount = (guids: string[]) => { function Probe() { latest = useProductReceiptDocuments(guids); return null; } renderUI(<Probe />); };
  it('asks for the documents of the route (documentGUIDs) and keeps THEIR order; a missing one is left out', async () => {
    fake.rpc.product_receipt_list = listAnswer(docRow('dB'), docRow('dA'));
    mount(['dA', 'dB', 'dX']);
    await flush();
    expect(callsOf('product_receipt_list')[0].args.p_filter).toEqual({ documentGUIDs: ['dA', 'dB', 'dX'] });
    expect(latest.headers.map((h: any) => h.guid)).toEqual(['dA', 'dB']);
    expect(latest.headers[0]).toMatchObject({ number: 'PR-dA', status: 'draft', partnerTitle: 'Acme', purchaseOrderGUID: 'po1' });
  });
  it('no documents: nothing is asked', async () => {
    mount([]);
    await flush();
    expect(callsOf('product_receipt_list')).toHaveLength(0);
    expect(latest.headers).toEqual([]);
  });
  it('setHeader / post / unpost / remove / addLine call their RPC; the documents are read again; an error is shown and the command answers null / false', async () => {
    fake.rpc.product_receipt_list = listAnswer(docRow('dS'));
    fake.rpc.post_product_receipt = { data: { status: 'posted', lines: 2, problems: [] }, error: null };
    fake.rpc.unpost_product_receipt = { data: { status: 'draft', problems: [] }, error: null };
    fake.rpc.product_receipt_add_line = { data: 'new-line', error: null };
    mount(['dS']);
    await flush();
    const before = callsOf('product_receipt_list').length;
    await act(async () => { expect(await latest.setHeader('dS', { productReceiptNumber: 'GRN-1', productReceiptDateTime: '2026-10-20T00:00:00Z' })).toBe(true); });
    expect(callsOf('product_receipt_set_header')[0].args).toEqual({ p_header: 'dS', p_patch: { productReceiptNumber: 'GRN-1', productReceiptDateTime: '2026-10-20T00:00:00Z' } });
    await flush();
    expect(callsOf('product_receipt_list').length).toBeGreaterThan(before);
    await act(async () => { expect((await latest.post('dS')).status).toBe('posted'); });
    expect(callsOf('post_product_receipt')[0].args).toEqual({ p_header: 'dS' });
    await act(async () => { expect((await latest.unpost('dS')).status).toBe('draft'); });
    await act(async () => { expect(await latest.addLine('dS', 'materialGenus')).toBe(true); });
    expect(callsOf('product_receipt_add_line')[0].args).toEqual({ p_header: 'dS', p_genus: 'materialGenus' });
    await act(async () => { expect(await latest.remove('dS')).toBe(true); });
    expect(callsOf('delete_product_receipt')[0].args).toEqual({ p_header: 'dS' });
    fake.rpc.post_product_receipt = { data: null, error: { message: 'boom' } };
    await act(async () => { expect(await latest.post('dS')).toBeNull(); });
    expect(latest.error).toBe('boom');
  });
});

describe('"Create based on"', () => {
  const mountOrder = () => { function Probe() { latest = useCreateProductReceiptFromOrder(); return null; } renderUI(<Probe />); };
  const mountInvoice = () => { function Probe() { latest = useCreateVendorInvoiceFromReceipt(); return null; } renderUI(<Probe />); };

  it('purchase order → product receipt: the RPC gets the order, the new receipt opens (this window when no tab can be opened)', async () => {
    fake.rpc.create_product_receipt_from_order = { data: { documents: [{ documentGUID: 'r1', lineCount: 2 }], skipped: [] }, error: null };
    mountOrder();
    let answer: any;
    await act(async () => { answer = await latest.create('po1'); });
    expect(callsOf('create_product_receipt_from_order')[0].args).toEqual({ p_order: 'po1' });
    expect(answer.documents[0]).toEqual({ documentGUID: 'r1', lineCount: 2 });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/product-receipt', params: { documentGUID: 'r1' } });
    expect(latest.error).toBeNull();
  });
  it('nothing left to receive: no document, nothing opens, the answer says why', async () => {
    fake.rpc.create_product_receipt_from_order = { data: { documents: [], skipped: [{ reason: 'nothingLeftToReceive' }] }, error: null };
    mountOrder();
    let answer: any;
    await act(async () => { answer = await latest.create('po1'); });
    expect(answer.documents).toEqual([]);
    expect(answer.skipped).toEqual([{ reason: 'nothingLeftToReceive' }]);
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('a refusal of the database (the order is not posted) is the error text; nothing opens', async () => {
    fake.rpc.create_product_receipt_from_order = { data: null, error: { message: 'post the purchase order first' } };
    mountOrder();
    let answer: any = 'x';
    await act(async () => { answer = await latest.create('po1'); });
    expect(answer).toBeNull();
    expect(latest.error).toBe('post the purchase order first');
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('product receipt → vendor invoice: the RPC gets the receipt, the invoice form opens with the task of the receipt', async () => {
    fake.rpc.create_vendor_invoice_from_receipt = { data: { documents: [{ documentGUID: 'v1', lineCount: 2 }], skipped: [] }, error: null };
    mountInvoice();
    await act(async () => { await latest.create('r1', { taskGUID: 't1', projectGUID: 'p1' }); });
    expect(callsOf('create_vendor_invoice_from_receipt')[0].args).toEqual({ p_receipt: 'r1' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice', params: { taskGUID: 't1', projectGUID: 'p1', documentGUID: 'v1', documents: 'v1' } });
  });
  it('without a GUID nothing is called', async () => {
    mountOrder();
    await act(async () => { expect(await latest.create('')).toBeNull(); });
    expect(fake.calls).toHaveLength(0);
  });

  describe('on the web the new document opens in a NEW browser tab', () => {
    let open: jest.SpyInstance; let tab: { location: { href: string }; close: jest.Mock };
    beforeEach(() => { tab = { location: { href: '' }, close: jest.fn() }; open = jest.spyOn(window, 'open').mockImplementation(() => tab as any); });
    afterEach(() => open.mockRestore());
    it('a blank tab is opened INSIDE the click (before the call) and pointed at the receipt; the router is not used', async () => {
      fake.rpc.create_product_receipt_from_order = { data: { documents: [{ documentGUID: 'r1', lineCount: 1 }], skipped: [] }, error: null };
      mountOrder();
      let p: Promise<any>;
      act(() => { p = latest.create('po1'); });
      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenLastCalledWith('', '_blank');
      await act(async () => { await p; });
      expect(tab.location.href).toBe('/pm/project/task/product-receipt?documentGUID=r1');
      expect(mockPush).not.toHaveBeenCalled();
    });
    it('when nothing was made or the call failed the blank tab is closed again', async () => {
      fake.rpc.create_product_receipt_from_order = { data: { documents: [], skipped: [{ reason: 'nothingLeftToReceive' }] }, error: null };
      mountOrder();
      await act(async () => { await latest.create('po1'); });
      expect(tab.close).toHaveBeenCalledTimes(1);
      fake.rpc.create_product_receipt_from_order = { data: null, error: { message: 'boom' } };
      await act(async () => { await latest.create('po1'); });
      expect(tab.close).toHaveBeenCalledTimes(2);
    });
    it('useOpenProductReceipt: a new tab with the document; nothing without one', () => {
      function Probe() { latest = useOpenProductReceipt(); return null; }
      renderUI(<Probe />);
      latest({ taskGUID: 't1', documentGUID: 'd1' });
      expect(open).toHaveBeenLastCalledWith('/pm/project/task/product-receipt?taskGUID=t1&documentGUID=d1', '_blank');
      open.mockClear();
      latest({});
      expect(open).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
