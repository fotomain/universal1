/** @jest-environment jsdom */
// The 2nd level tabs of the task window's Fact tab have a TIP with the number of documents of the task ("Vendor invoice - 3 documents").
import { act } from 'react';
import { cleanupUI, press, q, renderUI, seedStore } from './pmUiTestKit';

const mockRpc = jest.fn();
const mockClient = { rpc: (...a: any[]) => mockRpc(...a) };      // ONE client, as the real provider: a new object every render would read the numbers again and again
jest.doMock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockClient }) }));
// the lists are tested elsewhere
for (const t of ['TabFactInput', 'TabProductReceipt', 'TabVendorInvoice', 'TabCustomerInvoice']) jest.doMock(`../../../kit8/pm/view/task/edit/${t}`, () => ({ __esModule: true, default: () => null }));
const mockTipTexts: (string | undefined)[] = [];
jest.doMock('../../../kit8/pm/inner/tooltip/PMTooltip', () => ({
  ...jest.requireActual('../../../kit8/pm/inner/tooltip/PMTooltip'),
  usePMTip: (text?: string) => { mockTipTexts.push(text); return { accessibilityHint: text }; },
}));

const TabTaskEditFact = require('../../../kit8/pm/view/task/edit/TabTaskEditFact').default;
const { documentCountText, TASK_DOCUMENT_RPC } = require('../../../kit8/pm/view/task/edit/useTaskDocumentCounts');
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); mockTipTexts.length = 0; });
const answers: Record<string, number | null> = { task_fact_document_list: 2, product_receipt_list: 0, vendor_invoice_list: 1, customer_invoice_list: 12 };
beforeEach(() => {
  mockRpc.mockImplementation(async (name: string) => (answers[name] === null ? { data: null, error: { message: 'x' } } : { data: { totalCount: answers[name], rows: [] }, error: null }));
});
const mount = () => { seedStore({} as any); act(() => { usePMStore.setState({ projectsById: { p1: { rowJSON: { customerInvoiceFunctionalityEnabled: true } } } as any }); }); renderUI(<TabTaskEditFact projectGUID="p1" taskGUID="t1" />); };

describe('documentCountText', () => {
  it('one, many, none, unknown', () => {
    expect([documentCountText(3), documentCountText(1), documentCountText(0), documentCountText(null), documentCountText(undefined)]).toEqual(['3 documents', '1 document', 'No documents', '', '']);
  });
});

describe('the tips of the Fact sub tabs', () => {
  it('each tab asks its list RPC for the documents of THIS task (one row is enough: the answer has totalCount)', async () => {
    mount(); await flush();
    for (const k of ['TabFactInput', 'TabProductReceipt', 'TabVendorInvoice', 'TabCustomerInvoice']) {
      expect(mockRpc).toHaveBeenCalledWith(TASK_DOCUMENT_RPC[k], { p_filter: { taskGUID: 't1' }, p_limit: 1, p_offset: 0 });
    }
  });
  it('the tip of a tab = its name + the number of documents', async () => {
    mount(); await flush();
    expect(mockTipTexts).toEqual(expect.arrayContaining(['Fact input - 2 documents', 'Product receipt - No documents', 'Vendor invoice - 1 document', 'Customer invoice - 12 documents']));
    expect(q('pm-task-edit-fact-TabVendorInvoice')!.getAttribute('aria-label')).toBe('Vendor invoice - 1 document');
  });
  it('a kind that cannot be read: the tip is the name alone', async () => {
    answers.vendor_invoice_list = null;
    mount(); await flush();
    expect(mockTipTexts).toContain('Vendor invoice');
    answers.vendor_invoice_list = 1;
  });
  it('the numbers are read again after a change of tab', async () => {
    mount(); await flush();
    const before = mockRpc.mock.calls.length;
    press('pm-task-edit-fact-TabVendorInvoice'); await flush();
    expect(mockRpc.mock.calls.length).toBeGreaterThan(before);
  });
  it('without the customer switch there is no Customer invoice tab and no call for it', async () => {
    seedStore({} as any);
    act(() => { usePMStore.setState({ projectsById: { p1: { rowJSON: { customerInvoiceFunctionalityEnabled: false } } } as any }); });
    renderUI(<TabTaskEditFact projectGUID="p1" taskGUID="t1" />); await flush();
    expect(q('pm-task-edit-fact-TabCustomerInvoice')).toBeNull();
    expect(mockRpc).not.toHaveBeenCalledWith('customer_invoice_list', expect.anything());
  });
});
