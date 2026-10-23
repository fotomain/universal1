/** @jest-environment jsdom */
// CustomerInvoiceDocumentList: a ReusableTable with a folders tree (legal entity → customer), the quick filters of every non-number column (ONE row, each with a Clear icon), the totals PER CURRENCY,
// Open / the hint of the + button. The data hooks and the table are fakes.
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, mustGet, press, q, qa, renderUI, textOf, typeInto, wait } from '../../../pm/ui/pmUiTestKit';

const mockAnswer: { current: any } = { current: null };
const mockCalls: { filter: any; limit: number; extra?: any }[] = [];
const mockRefetch = jest.fn();
// the Task context menu items of a row have their own test (lineplace/useDocumentLineMenu.test.tsx)
const mockRowMenu = jest.fn(() => []);
jest.mock('../../../../kit8/documents/vendor/lineplace/useDocumentLineMenu', () => ({ useDocumentLineMenu: () => mockRowMenu }));
jest.mock('../../../../kit8/documents/customer/invoice/useCustomerInvoice', () => ({
  useCustomerInvoiceList: (filter: any, limit: number, extra?: any) => { mockCalls.push({ filter, limit, extra }); return { answer: mockAnswer.current, isLoading: false, error: (globalThis as any).__listError ?? null, refetch: mockRefetch }; },
}));
jest.mock('../../../../kit8/catalog/legal_entity/useLegalEntityData', () => ({ useLegalEntityData: () => ({ rows: [{ rowGUID: 'le-1', rowJSON: { title: 'Acme SIA' } }, { rowGUID: 'le-2', rowJSON: { title: 'Acme Holding' } }], countries: [], loaded: true, error: '', reload: jest.fn() }) }));
jest.mock('../../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false, navigate: jest.fn() }) }));
const mockTable = jest.fn();
jest.mock('../../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
const mockSelects: Record<string, any> = {};
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return R.createElement(TextInput, { testID: p.testID, value: p.value, onChangeText: p.onSelect }); } };
});
jest.mock('../../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, error }: any) => R.createElement(TextInput, { testID, value, onChangeText, accessibilityLabel: error ? 'error' : undefined }) };
});

// (required after the doMock of expo-router: the kit has its own mock of it)
const { default: CustomerInvoiceDocumentList, VENDOR_LIST_FILTER_DEBOUNCE_MS } = require('../../../../kit8/documents/customer/invoice/CustomerInvoiceDocumentList');
import { EMPTY_CUSTOMER_INVOICE_FILTER, CUSTOMER_INVOICE_HEADER_ENTITY, CustomerInvoiceListRow } from '../../../../kit8/documents/customer/invoice/customerInvoiceModel';

const T = 'customer-list';
const doc = (guid: string, over: Partial<CustomerInvoiceListRow> = {}): CustomerInvoiceListRow => ({
  documentGUID: guid, documentNumber: `VI-${guid}`, documentStatus: 'draft', customerInvoiceNumber: `INV-${guid}`, customerInvoiceDateTime: null, customerInvoiceDay: '2026-10-20', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA',
  partnerGUID: 'vp-1', partnerTitle: 'Acme Supplies', contractGUID: 'vc-1', contractInfo: 'S-1 · Supply', currency: 'EUR', folder: 'le-1:vp-1', authorGUID: 'u1', authorName: 'Anna K', lineCount: 2, sumBeforeVAT: 50, sumVAT: 10.5, sumWithVAT: 60.5, ...over,
});
const settle = () => wait(VENDOR_LIST_FILTER_DEBOUNCE_MS + 60);
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const lastFilter = () => mockCalls[mockCalls.length - 1].filter;

beforeEach(() => {
  mockCalls.length = 0;
  (globalThis as any).__listError = null;
  const rows = [doc('d1'), doc('d2', { documentStatus: 'posted', partnerGUID: 'vp-2', partnerTitle: 'Beta', contractGUID: 'vc-3', currency: 'USD', folder: 'le-1:vp-2', sumBeforeVAT: 100, sumVAT: 0, sumWithVAT: 100 })];
  mockAnswer.current = { totalCount: 2, rows, totalsByCurrency: [{ currency: 'EUR', count: 1, sumBeforeVAT: 50, sumVAT: 10.5, sumWithVAT: 60.5 }, { currency: 'USD', count: 1, sumBeforeVAT: 100, sumVAT: 0, sumWithVAT: 100 }] };
  (globalThis as any).__pmTestReduxState = {
    partnerReusable: { entityDataFromServer: [{ rowGUID: 'vp-1', rowJSON: { partnerTitle: 'Acme Supplies' } }, { rowGUID: 'vp-2', rowJSON: { partnerTitle: 'Beta Trade' } }] },
    contractReusable: { entityDataFromServer: [{ rowGUID: 'vc-1', rowOwnerGUID: 'vp-1', rowParentGUID: 'partner', rowJSON: { contractNumber: 'S-1', contractTitle: 'Supply', contractCurrency: 'EUR' } }, { rowGUID: 'vc-3', rowOwnerGUID: 'vp-2', rowParentGUID: 'partner', rowJSON: { contractNumber: 'B-1', contractCurrency: 'USD' } }] },
  };
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; });

describe('the table (ReusableTable with a folders tree)', () => {
  it('reads the documents of the redux entity (all owners, newest first); the cells read the list rows by GUID', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    expect(lastTable()).toMatchObject({ entityName: CUSTOMER_INVOICE_HEADER_ENTITY, listOwnerGUID: '*', listParentGUID: '*', reorderEnabled: false, itemLabel: 'Customer invoice' });
    expect(lastTable().readParams).toEqual({ orderBy: 'created_at', ascending: false });
    const rf = lastTable().rowFilter;
    expect([rf({ rowGUID: 'd1' }), rf({ rowGUID: 'd2' }), rf({ rowGUID: 'not-listed' })]).toEqual([true, true, false]);
    const read = (key: string, guid: string) => lastTable().visualColumns.find((c: any) => c.key === key).fromStored(null, { rowGUID: guid });
    expect(read('customerInvoiceNumber', 'd1')).toBe('INV-d1');
    expect(read('sumWithVAT', 'd2')).toBe(100);
    expect(read('status', 'd2')).toBe('Posted');
  });
  it('the folders: legal entity → customer, shown, rows belong to a folder by rowJSON.customerInvoiceFolder; no drag between folders', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    const ft = lastTable().foldersTree;
    expect(ft.nodes.map((n: any) => [n.id, n.title, n.parentId])).toEqual([['le-1', 'Acme SIA', null], ['le-1:vp-1', 'Acme Supplies', 'le-1'], ['le-1:vp-2', 'Beta', 'le-1']]);
    expect(ft).toMatchObject({ folderTarget: 'rowJSON', folderField: 'customerInvoiceFolder' });
    expect(lastTable().uxuiTable).toMatchObject({ showFoldersTree: true });
    expect(ft.onRowsDrop(['d1'], 'le-1')).toBeUndefined();
  });
  it('Open: a click on a row (and the menu command) opens the document; a row that is not listed does nothing', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    expect(lastTable().openLabel).toBe('Open customer invoice');
    lastTable().onRowOpen({ rowGUID: 'd2' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/customer-invoice', params: { documentGUID: 'd2' } });
    mockPush.mockClear();
    lastTable().onRowOpen({ rowGUID: 'zz' });
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('the + button says where a customer invoice is made (from a task); there is no manual create', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    expect(q(`${T}-hint`)).toBeNull();
    act(() => lastTable().onAdd());
    expect(textOf(`${T}-hint`)).toContain('Customer Invoice');
  });
  it('the empty text says it differently when filters are on', async () => {
    renderUI(<CustomerInvoiceDocumentList />);
    expect(lastTable().emptyText).toContain('No customer invoices yet');
    typeInto(`${T}-authorFilter`, 'zzz');
    await settle();
    expect(lastTable().emptyText).toContain('No customer invoice matches the filters');
  });
  it('a document made / posted elsewhere (the redux entity changes by realtime) reads the list again', () => {
    (globalThis as any).__pmTestReduxState = { ...(globalThis as any).__pmTestReduxState, [CUSTOMER_INVOICE_HEADER_ENTITY]: { entityDataFromServer: [{ rowGUID: 'd1', updated_at: '1', rowJSON: { documentHeader: { documentStatus: 'draft' } } }] } };
    const view = renderUI(<CustomerInvoiceDocumentList />);
    expect(mockRefetch).not.toHaveBeenCalled();
    (globalThis as any).__pmTestReduxState = { ...(globalThis as any).__pmTestReduxState, [CUSTOMER_INVOICE_HEADER_ENTITY]: { entityDataFromServer: [{ rowGUID: 'd1', updated_at: '2', rowJSON: { documentHeader: { documentStatus: 'posted' } } }] } };
    view.rerender(<CustomerInvoiceDocumentList />);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
  it('an error of the database is shown; Refresh reads again', () => {
    (globalThis as any).__listError = 'permission denied';
    renderUI(<CustomerInvoiceDocumentList />);
    expect(textOf(`${T}-error`)).toBe('permission denied');
    press(`${T}-refresh`);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe('the row menu: Create based on → Payment fact (a POSTED invoice)', () => {
  it('a posted document gets "Create based on → Payment fact" in front of the task items; a draft does not', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    const menu = lastTable().extraMenuItems;
    const close = jest.fn();
    const posted = menu({ rowGUID: 'd2' }, close);
    expect(posted[0]).toMatchObject({ testID: 'customer-list-menu-create-d2', label: 'Create based on' });
    expect(posted[0].submenu[0]).toMatchObject({ testID: 'customer-list-menu-create-payment-fact-d2', label: 'Payment fact' });
    expect(menu({ rowGUID: 'd1' }, close).some((i: any) => i.label === 'Create based on')).toBe(false);
  });
});

describe('the totals PER CURRENCY', () => {
  it('one line for each currency (never added together) and the number of documents', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    expect(textOf(`${T}-totals`)).toContain('2 documents');
    expect(textOf(`${T}-total-EUR`)).toContain('before VAT 50.00');
    expect(textOf(`${T}-total-EUR`)).toContain('with VAT 60.50');
    expect(textOf(`${T}-total-USD`)).toContain('with VAT 100.00');
    expect(qa(`${T}-total-`)).toEqual([`${T}-total-EUR`, `${T}-total-USD`]);
  });
});

describe('the quick filters', () => {
  it('one for every column that is not a number, in ONE row', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    const ids = [`${T}-numberFilter`, `${T}-dateFilter-from`, `${T}-dateFilter-to`, `${T}-legalEntityFilter`, `${T}-customerFilter`, `${T}-contractFilter`, `${T}-currencyFilter`, `${T}-statusFilter`, `${T}-authorFilter`];
    expectInOrder(ids);
    const inner = mustGet(`${T}-filters`).firstElementChild as HTMLElement;
    expect(getComputedStyle(inner).flexWrap).toBe('nowrap');
    ids.forEach((id) => expect(inner.contains(mustGet(id))).toBe(true));
  });
  it('they start empty and the selects are clearable (the label is the placeholder)', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    expect(lastFilter()).toEqual(EMPTY_CUSTOMER_INVOICE_FILTER);
    expect(q(`${T}-clear`)).toBeNull();
    ['legalEntityFilter', 'customerFilter', 'contractFilter', 'currencyFilter', 'statusFilter'].forEach((k) => expect(mockSelects[`${T}-${k}`]).toMatchObject({ clearable: true }));
    expect(mockSelects[`${T}-customerFilter`].placeholder).toBe('Customer');
  });
  it('the select items: legal entities, customers, contracts, currencies, statuses', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    expect(mockSelects[`${T}-legalEntityFilter`].items.map((i: any) => i.label)).toEqual(['Acme Holding', 'Acme SIA']);
    expect(mockSelects[`${T}-customerFilter`].items).toEqual([{ value: 'vp-1', label: 'Acme Supplies' }, { value: 'vp-2', label: 'Beta Trade' }]);
    expect(mockSelects[`${T}-contractFilter`].items.map((i: any) => i.label)).toEqual(['S-1 · Supply', 'B-1']);
    expect(mockSelects[`${T}-currencyFilter`].items.map((i: any) => i.value)).toEqual(['EUR', 'USD']);
    expect(mockSelects[`${T}-statusFilter`].items.map((i: any) => i.value)).toEqual(['draft', 'posted']);
  });
  it('typing is applied after a pause - not on every key', async () => {
    renderUI(<CustomerInvoiceDocumentList />);
    typeInto(`${T}-numberFilter`, 'INV');
    expect(lastFilter().number).toBe('');
    await settle();
    expect(lastFilter().number).toBe('INV');
  });
  it('the date: from and to; an unreadable one is an error of the field; 8 digits are read', async () => {
    renderUI(<CustomerInvoiceDocumentList />);
    typeInto(`${T}-dateFilter-from`, '20261001');
    typeInto(`${T}-dateFilter-to`, 'soon');
    expect(q(`${T}-dateFilter-to`)!.getAttribute('aria-label')).toBe('error');
    await settle();
    expect(lastFilter()).toMatchObject({ fromDay: '20261001', toDay: 'soon' });   // the RPC filter reads the digits and ignores the unreadable one (customerInvoiceFilterToRpc)
  });
  it('the selects set their filter; a customer also empties the contract (it belongs to the customer)', async () => {
    renderUI(<CustomerInvoiceDocumentList />);
    typeInto(`${T}-contractFilter`, 'vc-1');
    typeInto(`${T}-legalEntityFilter`, 'le-1');
    typeInto(`${T}-currencyFilter`, 'EUR');
    typeInto(`${T}-statusFilter`, 'posted');
    await settle();
    expect(lastFilter()).toMatchObject({ contractGUID: 'vc-1', legalEntityGUID: 'le-1', currency: 'EUR', status: 'posted' });
    typeInto(`${T}-customerFilter`, 'vp-2');
    await settle();
    expect(lastFilter()).toMatchObject({ partnerGUID: 'vp-2', contractGUID: '' });
  });
  it('with a customer chosen the contract select offers only ITS contracts', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    typeInto(`${T}-customerFilter`, 'vp-2');
    expect(mockSelects[`${T}-contractFilter`].items.map((i: any) => i.label)).toEqual(['B-1']);
  });
  it('Clear filters appears with a filter and empties them at once', async () => {
    renderUI(<CustomerInvoiceDocumentList />);
    typeInto(`${T}-numberFilter`, 'INV');
    expect(q(`${T}-clear`)).not.toBeNull();
    await settle();
    press(`${T}-clear`);
    expect(lastFilter()).toEqual(EMPTY_CUSTOMER_INVOICE_FILTER);
    expect(inputValue(`${T}-numberFilter`)).toBe('');
    expect(q(`${T}-clear`)).toBeNull();
  });
  it('the list asks for up to 1000 documents (the table has its own search, sort and column filters)', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    expect(mockCalls[mockCalls.length - 1].limit).toBe(1000);
  });
});

describe('the task / task line scope (menu "Go to → Customer invoices")', () => {
  it('no scope: no chip, nothing extra is sent to the database', () => {
    renderUI(<CustomerInvoiceDocumentList />);
    expect(q(`${T}-scope`)).toBeNull();
    expect(mockCalls[mockCalls.length - 1].extra).toEqual({});
  });
  it('taskGUID: a chip says it and the list RPC gets taskGUID; its x shows all the documents again', () => {
    renderUI(<CustomerInvoiceDocumentList taskGUID="t-1" />);
    expect(q(`${T}-scope`)).not.toBeNull();
    expect(textOf(`${T}-scope-label`)).toContain('Task:');
    expect(mockCalls[mockCalls.length - 1].extra).toEqual({ taskGUID: 't-1' });
    press(`${T}-scope-clear`);
    expect(q(`${T}-scope`)).toBeNull();
    expect(mockCalls[mockCalls.length - 1].extra).toEqual({});
  });
  it('taskLineGUID: both keys go to the database and the chip names the line', () => {
    renderUI(<CustomerInvoiceDocumentList taskGUID="t-1" taskLineGUID="aaaaaaaa-0000" />);
    expect(mockCalls[mockCalls.length - 1].extra).toEqual({ taskGUID: 't-1', taskLineGUID: 'aaaaaaaa-0000' });
    expect(textOf(`${T}-scope-label`)).toContain('Task line aaaaaaaa');
  });
  it('the scope does not touch the quick filters (Clear filters is for them only)', () => {
    renderUI(<CustomerInvoiceDocumentList taskGUID="t-1" />);
    expect(q(`${T}-clear`)).toBeNull();
    expect(lastFilter()).toEqual(EMPTY_CUSTOMER_INVOICE_FILTER);
  });
});
