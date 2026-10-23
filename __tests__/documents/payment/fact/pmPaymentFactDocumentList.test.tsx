/** @jest-environment jsdom */
// PMPaymentFactDocumentList: a ReusableTable with a folders tree (money account → payee), the quick filters of every non-number column (ONE row, each with a Clear icon), the totals PER CURRENCY, Open / the +
// button (an empty draft), the scope of a task and of one direction (the sub-tabs of the task window). The data hooks and the table are fakes.
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, mustGet, press, q, qa, renderUI, textOf, typeInto, wait } from '../../../pm/ui/pmUiTestKit';

const mockAnswer: { current: any } = { current: null };
const mockCalls: { filter: any; limit: number; extra?: any }[] = [];
const mockRefetch = jest.fn();
jest.mock('../../../../kit8/documents/payment/fact/usePaymentFact', () => ({
  usePaymentFactList: (filter: any, limit: number, extra?: any) => { mockCalls.push({ filter, limit, extra }); return { answer: mockAnswer.current, isLoading: false, error: (globalThis as any).__listError ?? null, refetch: mockRefetch }; },
}));
const mockCreate = jest.fn(async () => 'new-doc');
jest.mock('../../../../kit8/documents/payment/fact/paymentFactApi', () => ({ createPaymentFact: (...a: any[]) => (mockCreate as any)(...a) }));
const mockShow = jest.fn();
jest.mock('../../../../kit8/documents/payment/fact/paymentFactNavigation', () => ({ showPaymentFact: (...a: any[]) => mockShow(...a) }));
jest.mock('../../../../kit8/catalog/legal_entity/useLegalEntityData', () => ({ useLegalEntityData: () => ({ rows: [{ rowGUID: 'le-1', rowJSON: { title: 'Acme SIA' } }, { rowGUID: 'le-2', rowJSON: { title: 'Acme Holding' } }], countries: [], loaded: true, error: '', reload: jest.fn() }) }));
jest.mock('../../../../kit8/catalog/money_account/useMoneyAccountData', () => ({ useMoneyAccountData: () => ({ rows: [{ rowGUID: 'ma-1', rowJSON: { moneyAccountTitle: 'Bank EUR', moneyAccountCurrency: 'EUR' } }, { rowGUID: 'ma-2', rowJSON: { moneyAccountTitle: 'Bank USD', moneyAccountCurrency: 'USD' } }], legalEntities: [], loaded: true, error: '', reload: jest.fn() }) }));
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

const { default: PMPaymentFactDocumentList, PAYMENT_FACT_FILTER_DEBOUNCE_MS } = require('../../../../kit8/documents/payment/fact/PMPaymentFactDocumentList');
import { EMPTY_PAYMENT_FACT_FILTER, PAYMENT_FACT_HEADER_ENTITY, PaymentFactListRow } from '../../../../kit8/documents/payment/fact/paymentFactModel';

const T = 'payment-fact-list';
const doc = (guid: string, over: Partial<PaymentFactListRow> = {}): PaymentFactListRow => ({
  documentGUID: guid, documentNumber: `PF-${guid}`, documentStatus: 'draft', paymentFactNumber: `BANK-${guid}`, paymentFactDay: '2030-01-05', moneyAccountGUID: 'ma-1', moneyAccountTitle: 'Bank EUR', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA',
  currency: 'EUR', partnerGUID: 'pt-1', personGUID: '', payeeTitle: 'Supplier One', direction: 'outbound', folder: 'ma-1:pt-1', bankAmount: null, taskGUID: 't-1', projectGUID: 'p-1', projectCount: 1, authorGUID: 'u1', authorName: 'Anna K', lineCount: 2,
  sumForMoneyAccount: 300.5, ...over,
});
const settle = () => wait(PAYMENT_FACT_FILTER_DEBOUNCE_MS + 60);
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const lastFilter = () => mockCalls[mockCalls.length - 1].filter;
const lastExtra = () => mockCalls[mockCalls.length - 1].extra;

beforeEach(() => {
  mockCalls.length = 0;
  (globalThis as any).__listError = null;
  mockAnswer.current = {
    totalCount: 2,
    rows: [doc('d1'), doc('d2', { documentStatus: 'posted', moneyAccountGUID: 'ma-2', moneyAccountTitle: 'Bank USD', currency: 'USD', partnerGUID: 'pt-2', payeeTitle: 'Beta', folder: 'ma-2:pt-2', sumForMoneyAccount: 125, direction: 'inbound' })],
    totalsByCurrency: [{ currency: 'EUR', count: 1, sumForMoneyAccount: 300.5 }, { currency: 'USD', count: 1, sumForMoneyAccount: 125 }],
  };
  (globalThis as any).__pmTestReduxState = { partnerReusable: { entityDataFromServer: [{ rowGUID: 'pt-1', rowJSON: { partnerTitle: 'Supplier One' } }, { rowGUID: 'pt-2', rowJSON: { partnerTitle: 'Beta Trade' } }] } };
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; });

describe('the table (ReusableTable with a folders tree)', () => {
  it('reads the documents of the redux entity (all owners, newest first); the cells read the list rows by GUID', () => {
    renderUI(<PMPaymentFactDocumentList />);
    expect(lastTable()).toMatchObject({ entityName: PAYMENT_FACT_HEADER_ENTITY, listOwnerGUID: '*', listParentGUID: '*', reorderEnabled: false, itemLabel: 'Payment fact' });
    expect(lastTable().readParams).toEqual({ orderBy: 'created_at', ascending: false });
    const rf = lastTable().rowFilter;
    expect([rf({ rowGUID: 'd1' }), rf({ rowGUID: 'd2' }), rf({ rowGUID: 'not-listed' })]).toEqual([true, true, false]);
    const read = (key: string, guid: string) => lastTable().visualColumns.find((c: any) => c.key === key).fromStored(null, { rowGUID: guid });
    expect(read('paymentFactNumber', 'd1')).toBe('BANK-d1');
    expect(read('sumForMoneyAccount', 'd2')).toBe(125);
    expect(read('status', 'd2')).toBe('Posted');
    expect(read('direction', 'd2')).toBe('Inbound');
    expect(read('payee', 'd1')).toBe('Supplier One');
  });
  it('the folders: money account → payee, rows belong to a folder by rowJSON.paymentFactFolder; no drag between folders', () => {
    renderUI(<PMPaymentFactDocumentList />);
    const ft = lastTable().foldersTree;
    expect(ft.nodes.map((n: any) => [n.id, n.title, n.parentId])).toEqual([['ma-1', 'Bank EUR', null], ['ma-2', 'Bank USD', null], ['ma-2:pt-2', 'Beta', 'ma-2'], ['ma-1:pt-1', 'Supplier One', 'ma-1']]);
    expect(ft).toMatchObject({ folderTarget: 'rowJSON', folderField: 'paymentFactFolder' });
    expect(lastTable().uxuiTable).toMatchObject({ showFoldersTree: true });
    expect(ft.onRowsDrop(['d1'], 'ma-1')).toBeUndefined();
  });
  it('Open: a click on a row opens the document; a row that is not listed does nothing', () => {
    renderUI(<PMPaymentFactDocumentList />);
    expect(lastTable().openLabel).toBe('Open payment fact');
    lastTable().onRowOpen({ rowGUID: 'd2' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/payment-fact', params: { documentGUID: 'd2' } });
    mockPush.mockClear();
    lastTable().onRowOpen({ rowGUID: 'zz' });
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('the empty text says it differently when filters are on', async () => {
    renderUI(<PMPaymentFactDocumentList />);
    expect(lastTable().emptyText).toContain('No payment facts yet');
    typeInto(`${T}-authorFilter`, 'zzz');
    await settle();
    expect(lastTable().emptyText).toContain('No payment fact matches the filters');
  });
  it('a document made / posted elsewhere (the redux entity changes by realtime) reads the list again', () => {
    (globalThis as any).__pmTestReduxState = { ...(globalThis as any).__pmTestReduxState, [PAYMENT_FACT_HEADER_ENTITY]: { entityDataFromServer: [{ rowGUID: 'd1', updated_at: '1', rowJSON: { documentHeader: { documentStatus: 'draft' } } }] } };
    const view = renderUI(<PMPaymentFactDocumentList />);
    expect(mockRefetch).not.toHaveBeenCalled();
    (globalThis as any).__pmTestReduxState = { ...(globalThis as any).__pmTestReduxState, [PAYMENT_FACT_HEADER_ENTITY]: { entityDataFromServer: [{ rowGUID: 'd1', updated_at: '2', rowJSON: { documentHeader: { documentStatus: 'posted' } } }] } };
    view.rerender(<PMPaymentFactDocumentList />);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
  it('an error of the database is shown; Refresh reads again', () => {
    (globalThis as any).__listError = 'permission denied';
    renderUI(<PMPaymentFactDocumentList />);
    expect(textOf(`${T}-error`)).toBe('permission denied');
    press(`${T}-refresh`);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe('the + button makes an empty draft and opens it', () => {
  it('without a scope: no task, no direction; the document opens (a new browser tab on the web)', async () => {
    renderUI(<PMPaymentFactDocumentList />);
    await act(async () => { await lastTable().onAdd(); });
    expect(mockCreate).toHaveBeenCalledWith(expect.anything(), { taskGUID: null, direction: null });
    expect(mockShow).toHaveBeenCalledWith(expect.anything(), { documentGUID: 'new-doc', taskGUID: null }, { newWindow: true });
    expect(mockRefetch).toHaveBeenCalled();
  });
  it('in the sub-tab Outbound of a task: the draft is for that task and direction', async () => {
    renderUI(<PMPaymentFactDocumentList taskGUID="t-1" direction="outbound" />);
    await act(async () => { await lastTable().onAdd(); });
    expect(mockCreate).toHaveBeenCalledWith(expect.anything(), { taskGUID: 't-1', direction: 'outbound' });
    expect(mockShow.mock.calls[0][1]).toEqual({ documentGUID: 'new-doc', taskGUID: 't-1' });
  });
  it('a failure is shown and nothing opens', async () => {
    mockCreate.mockRejectedValueOnce(new Error('not your project'));
    renderUI(<PMPaymentFactDocumentList />);
    await act(async () => { await lastTable().onAdd(); });
    expect(textOf(`${T}-create-error`)).toBe('not your project');
    expect(mockShow).not.toHaveBeenCalled();
  });
});

describe('the totals PER CURRENCY', () => {
  it('one line for each currency of the money accounts (never added together) and the number of documents', () => {
    renderUI(<PMPaymentFactDocumentList />);
    expect(textOf(`${T}-totals`)).toContain('2 documents');
    expect(textOf(`${T}-total-EUR`)).toContain('300.50');
    expect(textOf(`${T}-total-USD`)).toContain('125.00');
    expect(qa(`${T}-total-`)).toEqual([`${T}-total-EUR`, `${T}-total-USD`]);
  });
});

describe('the quick filters', () => {
  it('one for every column that is not a number, in ONE row', () => {
    renderUI(<PMPaymentFactDocumentList />);
    const ids = [`${T}-numberFilter`, `${T}-dateFilter-from`, `${T}-dateFilter-to`, `${T}-legalEntityFilter`, `${T}-accountFilter`, `${T}-payeeFilter`, `${T}-directionFilter`, `${T}-currencyFilter`, `${T}-statusFilter`, `${T}-authorFilter`];
    expectInOrder(ids);
    const inner = mustGet(`${T}-filters`).firstElementChild as HTMLElement;
    expect(getComputedStyle(inner).flexWrap).toBe('nowrap');
    ids.forEach((id) => expect(inner.contains(mustGet(id))).toBe(true));
  });
  it('they start empty and the selects are clearable (the label is the placeholder)', () => {
    renderUI(<PMPaymentFactDocumentList />);
    expect(lastFilter()).toEqual(EMPTY_PAYMENT_FACT_FILTER);
    expect(q(`${T}-clear`)).toBeNull();
    ['legalEntityFilter', 'accountFilter', 'payeeFilter', 'directionFilter', 'currencyFilter', 'statusFilter'].forEach((k) => expect(mockSelects[`${T}-${k}`]).toMatchObject({ clearable: true }));
    expect(mockSelects[`${T}-accountFilter`].placeholder).toBe('Money account');
  });
  it('the select items: legal entities, money accounts (with their currency), payees, currencies, statuses, directions', () => {
    renderUI(<PMPaymentFactDocumentList />);
    expect(mockSelects[`${T}-legalEntityFilter`].items.map((i: any) => i.label)).toEqual(['Acme Holding', 'Acme SIA']);
    expect(mockSelects[`${T}-accountFilter`].items).toEqual([{ value: 'ma-1', label: 'Bank EUR · EUR' }, { value: 'ma-2', label: 'Bank USD · USD' }]);
    expect(mockSelects[`${T}-payeeFilter`].items).toEqual([{ value: 'pt-2', label: 'Beta Trade' }, { value: 'pt-1', label: 'Supplier One' }]);
    expect(mockSelects[`${T}-currencyFilter`].items.map((i: any) => i.value)).toEqual(['EUR', 'USD']);
    expect(mockSelects[`${T}-statusFilter`].items.map((i: any) => i.value)).toEqual(['draft', 'posted']);
    expect(mockSelects[`${T}-directionFilter`].items.map((i: any) => i.value)).toEqual(['outbound', 'inbound']);
  });
  it('typing is applied after a pause - not on every key', async () => {
    renderUI(<PMPaymentFactDocumentList />);
    typeInto(`${T}-numberFilter`, 'BANK');
    expect(lastFilter().number).toBe('');
    await settle();
    expect(lastFilter().number).toBe('BANK');
  });
  it('the date: from and to; an unreadable one is an error of the field; 8 digits are read', async () => {
    renderUI(<PMPaymentFactDocumentList />);
    typeInto(`${T}-dateFilter-from`, '20300101');
    typeInto(`${T}-dateFilter-to`, 'soon');
    expect(q(`${T}-dateFilter-to`)!.getAttribute('aria-label')).toBe('error');
    await settle();
    expect(lastFilter()).toMatchObject({ fromDay: '20300101', toDay: 'soon' });
  });
  it('the selects set their filter', async () => {
    renderUI(<PMPaymentFactDocumentList />);
    typeInto(`${T}-accountFilter`, 'ma-1');
    typeInto(`${T}-payeeFilter`, 'pt-2');
    typeInto(`${T}-directionFilter`, 'inbound');
    typeInto(`${T}-statusFilter`, 'posted');
    await settle();
    expect(lastFilter()).toMatchObject({ moneyAccountGUID: 'ma-1', partnerGUID: 'pt-2', direction: 'inbound', status: 'posted' });
  });
  it('Clear filters appears with a filter and empties them at once', async () => {
    renderUI(<PMPaymentFactDocumentList />);
    typeInto(`${T}-numberFilter`, 'B');
    expect(q(`${T}-clear`)).not.toBeNull();
    await settle();
    press(`${T}-clear`);
    expect(lastFilter()).toEqual(EMPTY_PAYMENT_FACT_FILTER);
    expect(inputValue(`${T}-numberFilter`)).toBe('');
    expect(q(`${T}-clear`)).toBeNull();
  });
  it('the list asks for up to 1000 documents', () => {
    renderUI(<PMPaymentFactDocumentList />);
    expect(mockCalls[mockCalls.length - 1].limit).toBe(1000);
  });
});

describe('the scope: a task (menu "Go to → Payment facts") and one direction (the sub-tabs of the task window)', () => {
  it('no scope: no chip, nothing extra is sent to the database', () => {
    renderUI(<PMPaymentFactDocumentList />);
    expect(q(`${T}-scope`)).toBeNull();
    expect(lastExtra()).toEqual({});
  });
  it('taskGUID: a chip says it and the RPC gets taskGUID; its x shows all the documents again', () => {
    renderUI(<PMPaymentFactDocumentList taskGUID="t-1" />);
    expect(textOf(`${T}-scope-label`)).toContain('Task:');
    expect(lastExtra()).toEqual({ taskGUID: 't-1' });
    press(`${T}-scope-clear`);
    expect(q(`${T}-scope`)).toBeNull();
    expect(lastExtra()).toEqual({});
  });
  it('a direction: the RPC gets it, the title says it and the Direction filter is not offered', () => {
    renderUI(<PMPaymentFactDocumentList taskGUID="t-1" direction="inbound" />);
    expect(lastExtra()).toEqual({ taskGUID: 't-1', direction: 'inbound' });
    expect(textOf(`${T}-title`)).toContain('Inbound');
    expect(q(`${T}-directionFilter`)).toBeNull();
    press(`${T}-scope-clear`);
    expect(lastExtra()).toEqual({ direction: 'inbound' });
  });
  it('the scope does not touch the quick filters', () => {
    renderUI(<PMPaymentFactDocumentList taskGUID="t-1" />);
    expect(q(`${T}-clear`)).toBeNull();
    expect(lastFilter()).toEqual(EMPTY_PAYMENT_FACT_FILTER);
  });
});
