/** @jest-environment jsdom */
// PMProductReceiptDocumentList: a ReusableTable with a folders tree (legal entity → vendor), the quick filters, the totals PER CURRENCY, Open, and the row menu "Create based on → Vendor invoice" (a POSTED receipt only).
// The data hooks and the table are fakes.
import { act } from 'react';
import { cleanupUI, inputValue, press, q, renderUI, textOf, typeInto, wait } from '../../../pm/ui/pmUiTestKit';

const mockAnswer: { current: any } = { current: null };
const mockCalls: { filter: any; limit: number; extra: any }[] = [];
const mockRefetch = jest.fn();
const mockToInvoice: Record<string, any> = {};
const mockTaskMenu = jest.fn(() => [{ testID: 'task-item', label: 'Open task', onPress: () => {} }]);
jest.mock('../../../../kit8/documents/vendor/lineplace/useDocumentLineMenu', () => ({ useDocumentLineMenu: () => mockTaskMenu }));
jest.mock('../../../../kit8/documents/vendor/product_receipt/useProductReceipt', () => ({
  useProductReceiptList: (filter: any, limit: number, extra: any) => { mockCalls.push({ filter, limit, extra }); return { answer: mockAnswer.current, isLoading: false, error: null, refetch: mockRefetch }; },
  useCreateVendorInvoiceFromReceipt: () => mockToInvoice,
}));
jest.mock('../../../../kit8/catalog/legal_entity/useLegalEntityData', () => ({ useLegalEntityData: () => ({ rows: [{ rowGUID: 'le-1', rowJSON: { title: 'Acme SIA' } }], countries: [], loaded: true, error: null }) }));
jest.mock('../../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false, navigate: jest.fn() }) }));
const mockTable = jest.fn();
jest.mock('../../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: (p: any) => R.createElement(TextInput, { testID: p.testID, value: p.value, onChangeText: p.onSelect }) };
});
jest.mock('../../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText }: any) => R.createElement(TextInput, { testID, value, onChangeText }) };
});
const { default: PMProductReceiptDocumentList, PRODUCT_RECEIPT_LIST_FILTER_DEBOUNCE_MS } = require('../../../../kit8/documents/vendor/product_receipt/PMProductReceiptDocumentList');
import { PRODUCT_RECEIPT_HEADER_ENTITY, ProductReceiptListRow } from '../../../../kit8/documents/vendor/product_receipt/productReceiptModel';

const T = 'product-receipt-list';
const doc = (guid: string, over: Partial<ProductReceiptListRow> = {}): ProductReceiptListRow => ({
  documentGUID: guid, documentNumber: `PR-${guid}`, documentStatus: 'draft', productReceiptNumber: `GRN-${guid}`, productReceiptDateTime: null, productReceiptDay: '2026-10-20', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA',
  partnerGUID: 'vp-1', partnerTitle: 'Acme Supplies', contractGUID: 'vc-1', contractInfo: 'S-1 · Supply', currency: 'EUR', folder: 'le-1:vp-1', taskGUID: 't1', projectGUID: 'p1', projectName: 'Alpha', independentInputAvailable: false,
  multiProject: false, multiProjectAvailable: false, purchaseOrderGUID: 'po1', purchaseOrderDocument: 'PO-00001', purchaseOrderNumber: 'ORD-5', authorGUID: 'u1', authorName: 'Anna K', lineCount: 2, sumBeforeVAT: 50, sumVAT: 10.5, sumWithVAT: 60.5, ...over,
});
const settle = () => wait(PRODUCT_RECEIPT_LIST_FILTER_DEBOUNCE_MS + 60);
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const lastFilter = () => mockCalls[mockCalls.length - 1].filter;

beforeEach(() => {
  mockCalls.length = 0;
  Object.keys(mockToInvoice).forEach((k) => delete mockToInvoice[k]);
  Object.assign(mockToInvoice, { create: jest.fn(async () => ({ documents: [{ documentGUID: 'v1', lineCount: 1 }], skipped: [] })), busy: false, error: null });
  mockAnswer.current = {
    totalCount: 2,
    rows: [doc('d1'), doc('d2', { documentStatus: 'posted', partnerGUID: 'vp-2', partnerTitle: 'Beta', currency: 'USD', folder: 'le-1:vp-2', sumBeforeVAT: 100, sumVAT: 0, sumWithVAT: 100, purchaseOrderNumber: '', purchaseOrderDocument: 'PO-00002' })],
    totalsByCurrency: [{ currency: 'EUR', count: 1, sumBeforeVAT: 50, sumVAT: 10.5, sumWithVAT: 60.5 }, { currency: 'USD', count: 1, sumBeforeVAT: 100, sumVAT: 0, sumWithVAT: 100 }],
  };
  (globalThis as any).__pmTestReduxState = { partnerReusable: { entityDataFromServer: [] }, contractReusable: { entityDataFromServer: [] } };
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; });

describe('the table', () => {
  it('reads the documents of the redux entity (newest first); the cells read the list rows by GUID, the order column shows the order', () => {
    renderUI(<PMProductReceiptDocumentList />);
    expect(lastTable()).toMatchObject({ entityName: PRODUCT_RECEIPT_HEADER_ENTITY, listOwnerGUID: '*', listParentGUID: '*', reorderEnabled: false, itemLabel: 'Product receipt' });
    expect(lastTable().readParams).toEqual({ orderBy: 'created_at', ascending: false });
    const rf = lastTable().rowFilter;
    expect([rf({ rowGUID: 'd1' }), rf({ rowGUID: 'd2' }), rf({ rowGUID: 'not-listed' })]).toEqual([true, true, false]);
    const read = (key: string, guid: string) => lastTable().visualColumns.find((c: any) => c.key === key).fromStored(null, { rowGUID: guid });
    expect(read('productReceiptNumber', 'd1')).toBe('GRN-d1');
    expect(read('purchaseOrder', 'd1')).toBe('ORD-5');
    expect(read('purchaseOrder', 'd2')).toBe('PO-00002');
    expect(read('sumWithVAT', 'd2')).toBe(100);
    expect(read('status', 'd2')).toBe('Posted');
  });
  it('a click on a row opens the form; the + says that a receipt is made from a purchase order', () => {
    renderUI(<PMProductReceiptDocumentList />);
    lastTable().onRowOpen({ rowGUID: 'd1' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/product-receipt', params: { documentGUID: 'd1' } });
    lastTable().onRowOpen({ rowGUID: 'not-listed' });
    expect(mockPush).toHaveBeenCalledTimes(1);
    act(() => { lastTable().onAdd(); });
    expect(textOf(`${T}-hint`)).toContain('Create based on → Product receipt');
  });
  it('the folders: legal entity → vendor', () => {
    renderUI(<PMProductReceiptDocumentList />);
    expect(lastTable().foldersTree.nodes.map((n: any) => n.title)).toEqual(['Acme SIA', 'Acme Supplies', 'Beta']);
    expect(lastTable().foldersTree).toMatchObject({ folderField: 'productReceiptFolder' });
  });
});

describe('the row menu: Create based on → Vendor invoice', () => {
  const menu = (guid: string) => { const close = jest.fn(); const items = lastTable().extraMenuItems({ rowGUID: guid }, close); return { items, close }; };
  it('a POSTED receipt: "Create based on" with the item Vendor invoice (first), then the Task items', async () => {
    renderUI(<PMProductReceiptDocumentList />);
    const { items, close } = menu('d2');
    expect(items.map((i: any) => i.label)).toEqual(['Create based on', 'Open task']);
    expect(items[0].submenu.map((i: any) => i.label)).toEqual(['Vendor invoice']);
    await act(async () => { items[0].submenu[0].onPress(); });
    expect(close).toHaveBeenCalled();
    expect(mockToInvoice.create).toHaveBeenCalledWith('d2', { taskGUID: 't1', projectGUID: 'p1' });
  });
  it('a DRAFT receipt has no "Create based on"', () => {
    renderUI(<PMProductReceiptDocumentList />);
    expect(menu('d1').items.map((i: any) => i.label)).toEqual(['Open task']);
  });
  it('an error of the creation is shown above the table', () => {
    mockToInvoice.error = 'post the product receipt first';
    renderUI(<PMProductReceiptDocumentList />);
    expect(textOf(`${T}-create-error`)).toBe('post the product receipt first');
  });
});

describe('the filters and the totals', () => {
  it('the number filter is applied after a pause and sent to the database; Clear filters empties everything', async () => {
    renderUI(<PMProductReceiptDocumentList />);
    typeInto(`${T}-numberFilter`, 'GRN');
    expect(lastFilter().number).toBe('');
    await settle();
    expect(lastFilter().number).toBe('GRN');
    press(`${T}-clear`);
    await settle();
    expect(lastFilter().number).toBe('');
    expect(inputValue(`${T}-numberFilter`)).toBe('');
  });
  it('the task scope (Go to → Product receipts) goes to the database as taskGUID / taskLineGUID, with a chip', () => {
    renderUI(<PMProductReceiptDocumentList taskGUID="t1" taskLineGUID="l1" />);
    expect(mockCalls.at(-1)!.extra).toEqual({ taskGUID: 't1', taskLineGUID: 'l1' });
    expect(q(`${T}-scope`)).not.toBeNull();
  });
  it('the totals are PER CURRENCY, never added', () => {
    renderUI(<PMProductReceiptDocumentList />);
    expect(textOf(`${T}-totals`)).toContain('2 documents');
    expect(textOf(`${T}-total-EUR`)).toContain('60.50');
    expect(textOf(`${T}-total-USD`)).toContain('100.00');
  });
});
