/** @jest-environment jsdom */
// PMPaymentFactDocumentForm: the bar (Get from plan · Delete · Unpost · Close, Post is the LAST and large), the header (TextInputApp / DateInputApp / the catalog selects), a TAB for each document, the totals,
// "Get from plan", the table of the lines (draft / posted), the task of an unplanned line. The data hooks, the table and the windows are fakes.
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, press, q, qa, renderUI, textOf, typeInto, wait } from '../../../pm/ui/pmUiTestKit';

const mockDoc: Record<string, any> = {};
const mockPicker = jest.fn();
const mockPlan = jest.fn();
let mockPlaces: Record<string, any> = {};
const mockLineMenu = jest.fn(() => []);
jest.mock('../../../../kit8/documents/vendor/lineplace/useDocumentLineMenu', () => ({ useDocumentLineMenu: () => mockLineMenu }));
jest.mock('../../../../kit8/pm/view/project/pick/PMProjectPickerModal', () => ({ __esModule: true, default: (p: any) => { mockPicker(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../../kit8/documents/payment/fact/usePaymentFact', () => ({ usePaymentFactDocuments: () => mockDoc }));
jest.mock('../../../../kit8/documents/payment/fact/usePaymentFactPlaces', () => ({ usePaymentFactPlaces: () => mockPlaces }));
jest.mock('../../../../kit8/documents/payment/fact/PMPaymentFactGetFromPlan', () => ({ __esModule: true, default: (p: any) => { mockPlan(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../../kit8/pm/view/task/finances/useTaskLineCatalogs', () => ({ useTaskLineCatalogs: () => require('../../../../kit8/pm/view/task/finances/taskLineCatalogs').emptyTaskLineCatalogs() }));
const mockButtons: Record<string, any> = {};
jest.mock('../../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const Real = jest.requireActual('../../../../kit8/ui/components/common/ButtonApp').default;
  const Spy = (p: any) => { if (p.testID) mockButtons[p.testID] = p; return R.createElement(Real, p); };
  return { __esModule: true, default: Spy, ButtonApp: Spy };
});
const mockTable = jest.fn();
jest.mock('../../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, disabled, error }: any) => R.createElement(TextInput, { testID, value, onChangeText, editable: !disabled, accessibilityLabel: error ? 'error' : undefined }) };
});
const mockDirection: Record<string, any> = {};
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => ({ __esModule: true, default: (p: any) => { mockDirection[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); } }));
const mockSelects: Record<string, any> = {};
jest.mock('../../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); }, defaultTitleExtractor: () => '' }));
jest.doMock('../../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  const TextInputApp = ({ testID, value, disabled, onChangeText, label }: any) => R.createElement(TextInput, { testID, value, editable: !disabled, onChangeText, accessibilityLabel: label });
  return { __esModule: true, default: TextInputApp, TextInputApp };
});
let mockClipboardText = '';
jest.doMock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true), getStringAsync: jest.fn(async () => mockClipboardText) }));
const PMPaymentFactDocumentForm = require('../../../../kit8/documents/payment/fact/PMPaymentFactDocumentForm').default;
import { PAYMENT_FACT_LINES_ENTITY, PaymentFactHeaderView } from '../../../../kit8/documents/payment/fact/paymentFactModel';

const T = 'payment-fact';
const header = (guid: string, over: Partial<PaymentFactHeaderView> = {}): PaymentFactHeaderView => ({
  guid, number: `PF-${guid}`, status: 'draft', paymentFactNumber: '', day: '', moneyAccountGUID: 'ma-1', moneyAccountTitle: 'Bank EUR', legalEntityTitle: 'Acme', currency: 'EUR', partnerGUID: 'pt-1', personGUID: '', payeeTitle: `Supplier ${guid}`,
  direction: 'outbound', bankAmount: null, taskGUID: 't-1', projectGUID: 'p-1', projectCount: 1, authorName: 'Anna', ...over,
});
const lines = (): any[] => [
  { rowGUID: 'l1', rowHeaderGUID: 'd1', rowProjectGUID: 'p-1', rowOwnerGUID: 't-1', paymentPlanLineGUID: 'pl-1', rowJSON: { paymentFactContract: 'c1', paymentFactBudgetItem: 'bi', paymentFactCurrency: 'EUR', sumForContract: 100, sumForMoneyAccount: 100 } },
  { rowGUID: 'l2', rowHeaderGUID: 'd1', rowProjectGUID: 'p-2', rowOwnerGUID: 't-2', paymentPlanLineGUID: null, rowJSON: { paymentFactContract: 'c2', paymentFactBudgetItem: 'bi', paymentFactCurrency: 'EUR', sumForContract: 200.5, sumForMoneyAccount: 200.5 } },
  { rowGUID: 'l3', rowHeaderGUID: 'd1', rowProjectGUID: 'p-1', rowOwnerGUID: 't-1', paymentPlanLineGUID: null, rowJSON: { paymentFactCurrency: 'USD', sumForContract: 10 } },
  { rowGUID: 'x1', rowHeaderGUID: 'd2', rowJSON: { sumForContract: 1000, sumForMoneyAccount: 1000, paymentFactCurrency: 'EUR' } },
];
function setDoc(headers: PaymentFactHeaderView[], over: Record<string, any> = {}, rows: any[] = lines()) {
  Object.keys(mockDoc).forEach((k) => delete mockDoc[k]);
  Object.assign(mockDoc, {
    headers, isLoading: false, error: null, busy: false,
    setHeader: jest.fn(async () => true), post: jest.fn(async () => ({ status: 'posted', lines: 3, problems: [] })), unpost: jest.fn(async () => ({ status: 'draft', lines: 0, problems: [] })), remove: jest.fn(async () => true),
    addLine: jest.fn(async () => true), addFromPlan: jest.fn(async () => ({ added: 1, skipped: [] })), setLineTask: jest.fn(async () => true), refetch: jest.fn(), ...over,
  });
  mockPlaces = {};
  (globalThis as any).__pmTestReduxState = { [PAYMENT_FACT_LINES_ENTITY]: { entityDataFromServer: rows } };
}
const readOnly = (id: string) => { const el = q(id) as HTMLInputElement; return el.readOnly || el.disabled; };
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const flush = () => act(async () => { await Promise.resolve(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; for (const o of [mockButtons, mockSelects, mockDirection]) Object.keys(o).forEach((k) => delete o[k]); });

describe('the bar', () => {
  it('Get from plan · Delete · Close, and Post is the LAST - a large button', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expectInOrder([`${T}-get-from-plan`, `${T}-delete`, `${T}-close`, `${T}-post`]);
    const ids = qa(`${T}-`).filter((id) => ['get-from-plan', 'delete', 'unpost', 'close', 'posted', 'post'].some((k) => id === `${T}-${k}`));
    expect(ids[ids.length - 1]).toBe(`${T}-post`);
    expect(mockButtons[`${T}-post`].size).toBe('large');
  });
  it('a posted document: Unpost and the large Posted button (nothing to press); no Post, no Delete, no Get from plan', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expect(mockButtons[`${T}-posted`]).toMatchObject({ size: 'large', icon: 'check' });
    expect(mockButtons[`${T}-unpost`].size).toBe('small');
    for (const k of ['post', 'delete', 'get-from-plan']) expect(q(`${T}-${k}`)).toBeNull();
  });
  it('a draft without lines cannot be posted', () => {
    setDoc([header('d1')], {}, []);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(q(`${T}-post`)).toBeNull();
    expect(q(`${T}-get-from-plan`)).not.toBeNull();
  });
  it('the title and the subtitle: the payee, the number of the document, the account, the currency, the number of projects', () => {
    setDoc([header('d1', { projectCount: 2 })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-title`)).toBe('Payment fact · Supplier d1');
    expect(textOf(`${T}-subtitle`)).toBe('PF-d1 · Bank EUR · EUR · 2 projects');
    cleanupUI();
    setDoc([header('d1', { payeeTitle: '', moneyAccountTitle: '', currency: '' })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-title`)).toBe('Payment fact · No payee');
    expect(textOf(`${T}-subtitle`)).toBe('PF-d1 · no money account');
  });
  it('Post / Unpost / Delete / Close call their commands; a refusal lists the problems', async () => {
    const onClose = jest.fn();
    setDoc([header('d1')], { post: jest.fn(async () => ({ status: 'refused', lines: 3, problems: [{ lineGUID: null, problem: 'moneyAccountMissing' }, { lineGUID: 'l1', problem: 'sumMissing' }] })) });
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} onClose={onClose} />);
    press(`${T}-post`);
    await flush();
    expect(mockDoc.post).toHaveBeenCalledWith('d1');
    expect(textOf(`${T}-problems`)).toContain('The document was not posted');
    expect(textOf(`${T}-problem-0`)).toContain('money account');
    expect(textOf(`${T}-problem-1`)).toContain('sum greater than 0');
    press(`${T}-close`);
    expect(onClose).toHaveBeenCalled();
    press(`${T}-delete`);
    await flush();
    expect(mockDoc.remove).toHaveBeenCalledWith('d1');
    expect(onClose).toHaveBeenCalledTimes(2);
    cleanupUI();
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    press(`${T}-unpost`);
    await flush();
    expect(mockDoc.unpost).toHaveBeenCalledWith('d1');
  });
  it('an error of the database is shown', () => {
    setDoc([header('d1')], { error: 'row-level security' });
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-error`)).toBe('row-level security');
  });
});

describe('a tab for each document', () => {
  it('one document: no strip; several: a tab each, with the payee, the account and the number', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(q(`${T}-documents`)).toBeNull();
    cleanupUI();
    setDoc([header('d1'), header('d2', { status: 'posted' }), header('d3', { moneyAccountTitle: '', payeeTitle: '' })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1', 'd2', 'd3']} />);
    expect(qa(`${T}-document-`).filter((id) => !id.endsWith('-browser-tab'))).toEqual([`${T}-document-d1`, `${T}-document-d2`, `${T}-document-d3`]);
    expect(textOf(`${T}-document-d2`)).toContain('Supplier d2');
    expect(textOf(`${T}-document-d2`)).toContain('Bank EUR · PF-d2 · Posted');
    expect(textOf(`${T}-document-d3`)).toContain('No payee');
    press(`${T}-document-d2`);
    expect(textOf(`${T}-title`)).toContain('Supplier d2');
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd2' })).toBe(true);
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1' })).toBe(false);
  });
  it('web: every tab has a button that opens the document in a browser tab of its own', () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    setDoc([header('d1'), header('d2')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1', 'd2']} />);
    press(`${T}-document-d2-browser-tab`);
    expect(open).toHaveBeenCalledWith('/pm/project/task/payment-fact?documentGUID=d2', '_blank');
    open.mockRestore();
  });
});

describe('the header', () => {
  it('number, date, bank number, money account, currency (read only), direction, payee; editable in a draft', () => {
    setDoc([header('d1', { paymentFactNumber: 'BANK-1', day: '2030-01-05' })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(inputValue(`${T}-field-number`)).toBe('PF-d1');
    expect(inputValue(`${T}-field-date`)).toBe('2030-01-05');
    expect(inputValue(`${T}-field-bankNumber`)).toBe('BANK-1');
    expect(inputValue(`${T}-field-currency`)).toBe('EUR');
    expect(readOnly(`${T}-field-bankNumber`)).toBe(false);
    expect(mockSelects[`${T}-field-account`]).toMatchObject({ entityName: 'moneyAccountReusable', value: 'ma-1', asInput: true });
    expect(mockDirection[`${T}-field-direction`]).toMatchObject({ value: 'outbound' });
    expect(mockDirection[`${T}-field-direction`].items.map((i: any) => i.value)).toEqual(['outbound', 'inbound']);
  });
  it('the payee: a partner and (Outbound only) a person - chosen while the document has no lines; saved at once; an inbound document has no person', () => {
    setDoc([header('d1', { partnerGUID: '', payeeTitle: '' })], {}, []);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(mockSelects[`${T}-field-partner`]).toMatchObject({ entityName: 'partnerReusable', value: null });
    expect(mockSelects[`${T}-field-person`]).toMatchObject({ entityName: 'personReusable' });
    act(() => mockSelects[`${T}-field-partner`].onChange('pt-2'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { paymentFactPartner: 'pt-2' });
    act(() => mockSelects[`${T}-field-person`].onChange('pe-1'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { paymentFactPerson: 'pe-1' });
    act(() => mockSelects[`${T}-field-partner`].onChange(null));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { paymentFactPartner: '' });
    act(() => mockDirection[`${T}-field-direction`].onSelect('inbound'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { paymentFactDirection: 'inbound' });
    cleanupUI();
    Object.keys(mockSelects).forEach((k) => delete mockSelects[k]);
    setDoc([header('d1', { partnerGUID: '', payeeTitle: '', direction: 'inbound' })], {}, []);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(mockSelects[`${T}-field-person`]).toBeUndefined();
  });
  it('the balance role (PART 39): "By direction" until chosen; Customer / Vendor are saved at once; a posted document cannot change it', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(mockDirection[`${T}-field-balanceRole`]).toMatchObject({ value: 'direction', disabled: false });
    expect(mockDirection[`${T}-field-balanceRole`].items.map((i: any) => i.value)).toEqual(['direction', 'customer', 'vendor']);
    act(() => mockDirection[`${T}-field-balanceRole`].onSelect('customer'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { paymentFactBalanceRole: 'customer' });
    act(() => mockDirection[`${T}-field-balanceRole`].onSelect('direction'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { paymentFactBalanceRole: '' });
    cleanupUI();
    setDoc([header('d1', { status: 'posted', balanceRole: 'vendor', paymentFactNumber: 'B', day: '2030-01-05' })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(mockDirection[`${T}-field-balanceRole`]).toMatchObject({ value: 'vendor', disabled: true });
  });
  it('with lines the payee and the direction are fixed (a text, a disabled select); a posted document is read only', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(mockSelects[`${T}-field-partner`]).toBeUndefined();
    expect(inputValue(`${T}-field-payee`)).toBe('Supplier d1');
    expect(mockDirection[`${T}-field-direction`].disabled).toBe(true);
    cleanupUI();
    Object.keys(mockSelects).forEach((k) => delete mockSelects[k]);
    setDoc([header('d1', { status: 'posted', paymentFactNumber: 'B', day: '2030-01-05' })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(readOnly(`${T}-field-bankNumber`)).toBe(true);
    expect(readOnly(`${T}-field-date`)).toBe(true);
    expect(mockSelects[`${T}-field-account`]).toBeUndefined();
    expect(inputValue(`${T}-field-account`)).toBe('Bank EUR');
  });
  it('the number, the date and the bank amount are saved a moment after the last key; the account at once; an unreadable date is not saved', async () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    typeInto(`${T}-field-bankNumber`, 'BANK-77');
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenCalledWith('d1', { paymentFactNumber: 'BANK-77' });
    typeInto(`${T}-field-date`, 'soon');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenCalledTimes(1);
    expect(q(`${T}-field-date`)!.getAttribute('aria-label')).toBe('error');
    typeInto(`${T}-field-date`, '20300105');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { paymentFactDate: '2030-01-05' });
    typeInto(`${T}-field-bankAmount`, '123,5');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { paymentFactBankAmount: 123.5 });
    typeInto(`${T}-field-bankAmount`, '');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { paymentFactBankAmount: null });
    act(() => mockSelects[`${T}-field-account`].onChange('ma-9'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { moneyAccountFact: 'ma-9' });
  });
  it('what is missing before Post is told in a line', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-missing`)).toContain('number of the bank transaction');
    expect(textOf(`${T}-missing`)).toContain('date of the bank transaction');
    cleanupUI();
    setDoc([header('d1', { paymentFactNumber: 'X', day: '2030-01-05' })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(q(`${T}-missing`)).toBeNull();
  });
  it('the totals: the amount of the money account, the contract sums PER currency, the lines without an amount (not the lines of another document)', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-totals`)).toContain('3 lines');
    expect(textOf(`${T}-total-account`)).toContain('300.5');
    expect(textOf(`${T}-total-contract-EUR`)).toContain('300.5');
    expect(textOf(`${T}-total-contract-USD`)).toContain('10');
    expect(textOf(`${T}-total-missing`)).toContain('1 lines have no amount');
  });
  it('the control amount of the bank: a difference is told, equal is told', async () => {
    setDoc([header('d1', { bankAmount: 300.5 })], {}, lines().slice(0, 2));
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-total-diff`)).toContain('equal');
    cleanupUI();
    setDoc([header('d1', { bankAmount: 310 })], {}, lines().slice(0, 2));
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-total-diff`)).toContain('9.5');
  });
});

describe('Get from plan', () => {
  it('the button opens the window with the document and its task; Add calls addFromPlan and tells why a payment was left out', async () => {
    setDoc([header('d1')], { addFromPlan: jest.fn(async () => ({ added: 1, skipped: [{ planLineGUID: 'x', reason: 'wrongPayee' }, { planLineGUID: 'y', reason: 'nothingOpen' }] })) });
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(q(`${T}-plan`)).toBeNull();
    press(`${T}-get-from-plan`);
    expect(q(`${T}-plan`)).not.toBeNull();
    const p = mockPlan.mock.calls.at(-1)![0];
    expect(p).toMatchObject({ visible: true, taskGUID: 't-1', header: { guid: 'd1' } });
    await act(async () => { await p.onAdd(['pl-1', 'pl-2']); });
    expect(mockDoc.addFromPlan).toHaveBeenCalledWith('d1', ['pl-1', 'pl-2']);
    expect(textOf(`${T}-notice`)).toContain('another payee');
    expect(textOf(`${T}-notice`)).toContain('Nothing of the payment is open');
    act(() => p.onClose());
    expect(q(`${T}-plan`)).toBeNull();
  });
});

describe('the table of the lines', () => {
  it('reads the lines of THIS document (several projects and tasks) through the redux entity', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ entityName: PAYMENT_FACT_LINES_ENTITY, listOwnerGUID: '*', listParentGUID: '*', reorderEnabled: false, realtime: true });
    expect(lastTable().readParams).toEqual({ match: { rowHeaderGUID: 'd1' } });
    expect(lines().filter(lastTable().rowFilter).map((r) => r.rowGUID)).toEqual(['l1', 'l2', 'l3']);
  });
  it('DRAFT: the panel, the menu, the selection, the + (an unplanned line on the task of the document)', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ crudPanelEnabled: true, contextMenuEnabled: true, selectionEnabled: true, addEnabled: true });
    expect(lastTable().extraMenuItems).toBe(mockLineMenu);
    act(() => lastTable().onAdd());
    expect(mockDoc.addLine).toHaveBeenCalledWith('d1', 't-1');
    const keys = lastTable().visualColumns.filter((c: any) => c.editable === true).map((c: any) => c.key);
    expect(keys).toEqual(expect.arrayContaining(['contract', 'budgetItem', 'sum', 'sumAccount']));
    expect(keys).not.toContain('sumAcc');
  });
  it('POSTED: read only - no panel, no menu, no selection, no add, no editable cell', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ crudPanelEnabled: false, contextMenuEnabled: false, selectionEnabled: false, addEnabled: false });
    expect(lastTable().visualColumns.filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
  });
  it('the Errors column shows only while a line has a problem (the line l3 has no contract, budget item, sum)', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(lastTable().visualColumns[0].key).toBe('errors');
    cleanupUI();
    setDoc([header('d1')], {}, lines().slice(0, 2));
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    expect(lastTable().visualColumns.some((c: any) => c.key === 'errors')).toBe(false);
  });
  it('no document: no table, a message', () => {
    setDoc([]);
    renderUI(<PMPaymentFactDocumentForm documents={['dX']} />);
    expect(mockTable).not.toHaveBeenCalled();
    expect(textOf(`${T}-empty`)).toContain('not found');
  });
});

describe('the task of an unplanned line (paste · select in the project tree · clear)', () => {
  const placeCell = () => lastTable().visualColumns.find((c: any) => c.key === 'task');
  it('the cell of a line without a plan payment has the three actions in a draft; a line of a plan payment has none', () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    const col = placeCell();
    expect(col.editable).toBe(false);
    const cell = (row: any) => col.renderCell(row).props;
    expect(cell({ rowGUID: 'l2', paymentPlanLineGUID: null })).toMatchObject({ field: 'task', editable: true, testID: 'payment-fact-place-task-l2' });
    expect(cell({ rowGUID: 'l1', paymentPlanLineGUID: 'pl-1' }).editable).toBe(false);
  });
  it('Paste: the GUID of the clipboard becomes the task of the line (setLineTask); no GUID = a message and nothing changes', async () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    const row = { rowGUID: 'l2' };
    const actions = placeCell().renderCell(row).props;
    mockClipboardText = 'task 3F2504E0-4F89-11D3-9A0C-0305E82C3301 copied';
    await act(async () => { await actions.onPaste(); });
    expect(mockDoc.setLineTask).toHaveBeenCalledWith('l2', '3f2504e0-4f89-11d3-9a0c-0305e82c3301');
    mockDoc.setLineTask.mockClear();
    mockClipboardText = 'nothing here';
    await act(async () => { await actions.onPaste(); });
    expect(mockDoc.setLineTask).not.toHaveBeenCalled();
    expect(textOf(`${T}-place-error`)).toContain('no GUID');
  });
  it('Select opens the project tree window (mode task); the answer is the task of the line; Clear goes back to the task of the document', async () => {
    setDoc([header('d1')]);
    renderUI(<PMPaymentFactDocumentForm documents={['d1']} />);
    const actions = placeCell().renderCell({ rowGUID: 'l2' }).props;
    act(() => actions.onPick());
    await flush();
    await flush();
    const p = mockPicker.mock.calls.at(-1)![0];
    expect(p.mode).toBe('task');
    act(() => p.onPick({ projectGUID: 'p-9', taskGUID: 't-9', taskLineGUID: null }));
    expect(mockDoc.setLineTask).toHaveBeenCalledWith('l2', 't-9');
    await act(async () => { await actions.onClear(); });
    expect(mockDoc.setLineTask).toHaveBeenLastCalledWith('l2', 't-1');
  });
});
