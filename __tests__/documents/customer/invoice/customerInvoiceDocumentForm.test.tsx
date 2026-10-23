/** @jest-environment jsdom */
// CustomerInvoiceDocumentForm: the bar (Post is the LAST, a large button; Posted is the same size), the form (TextInputApp / DateInputApp / the catalog select), a TAB for each document, the DocumentTabs
// All · Time · Material · Expenses with their counts, the totals, and how the ReusableTable of the lines is configured in a draft and in a posted document. The data hook and the table are fakes.
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, press, q, qa, renderUI, textOf, typeInto, wait } from '../../../pm/ui/pmUiTestKit';

const mockDoc: Record<string, any> = {};
const mockPlaces: Record<string, any> = {};
// the project tree window carries the whole dashboard (Skia): a fake that shows what it was asked
const mockPicker = jest.fn();
// the Task context menu items of a line have their own test (lineplace/useDocumentLineMenu.test.tsx): here the table only has to receive them
const mockLineMenu = jest.fn(() => []);
jest.mock('../../../../kit8/documents/vendor/lineplace/useDocumentLineMenu', () => ({ useDocumentLineMenu: () => mockLineMenu }));
jest.mock('../../../../kit8/pm/view/project/pick/PMProjectPickerModal', () => ({ __esModule: true, default: (p: any) => { mockPicker(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../../kit8/documents/customer/invoice/useCustomerInvoice', () => ({ useCustomerInvoiceDocuments: () => mockDoc, useCustomerInvoiceLinePlaces: () => mockPlaces }));
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
const mockSelects: Record<string, any> = {};
jest.mock('../../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); }, defaultTitleExtractor: () => '' }));

// (doMock AFTER the kit's own mock, and the form is required after it: the kit's TextInputApp does not tell whether it is disabled)
// a TextInputApp that tells whether it is disabled (the kit's one does not)
jest.doMock('../../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  const TextInputApp = ({ testID, value, disabled, onChangeText, label }: any) => R.createElement(TextInput, { testID, value, editable: !disabled, onChangeText, accessibilityLabel: label });
  return { __esModule: true, default: TextInputApp, TextInputApp };
});
// the clipboard of the Paste buttons (the kit's mock only copies)
let mockClipboardText = '';
jest.doMock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true), getStringAsync: jest.fn(async () => mockClipboardText) }));
const CustomerInvoiceDocumentForm = require('../../../../kit8/documents/customer/invoice/CustomerInvoiceDocumentForm').default;
import { CUSTOMER_INVOICE_LINES_ENTITY, CustomerInvoiceHeaderView } from '../../../../kit8/documents/customer/invoice/customerInvoiceModel';

const header = (guid: string, over: Partial<CustomerInvoiceHeaderView> = {}): CustomerInvoiceHeaderView => ({
  guid, number: `CI-${guid}`, status: 'draft', customerInvoiceNumber: '', day: '', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: `Customer ${guid}`, contractGUID: 'vc-1', contractInfo: 'S-1 · Supply',
  currency: 'EUR', authorName: 'Anna', ...over,
});
const lines = (): any[] => [
  { rowGUID: 'l1', rowHeaderGUID: 'd1', genusGUID: 'revenueGenus', sumForContract: '10.10', vatForContract: '2.12' },
  { rowGUID: 'l2', rowHeaderGUID: 'd1', genusGUID: 'revenueGenus', sumForContract: '20', vatForContract: '4.2' },
  { rowGUID: 'l3', rowHeaderGUID: 'd1', genusGUID: 'revenueGenus', sumForContract: '1', vatForContract: '0.21' },
  { rowGUID: 'x1', rowHeaderGUID: 'd2', genusGUID: 'revenueGenus', sumForContract: 1000, vatForContract: 1000 },
];
function setDoc(headers: CustomerInvoiceHeaderView[], over: Record<string, any> = {}, rows: any[] = lines()) {
  Object.keys(mockDoc).forEach((k) => delete mockDoc[k]);
  Object.assign(mockDoc, {
    headers, isLoading: false, error: null, busy: false,
    setHeader: jest.fn(async () => true), post: jest.fn(async () => ({ status: 'posted', lines: 3, problems: [] })), unpost: jest.fn(async () => ({ status: 'draft', lines: 0, problems: [] })), remove: jest.fn(async () => true), addLine: jest.fn(async () => true), setLineTask: jest.fn(async () => true), refetch: jest.fn(), ...over,
  });
  (globalThis as any).__pmTestReduxState = { [CUSTOMER_INVOICE_LINES_ENTITY]: { entityDataFromServer: rows } };
}
const readOnly = (id: string) => { const el = q(id) as HTMLInputElement; return el.readOnly || el.disabled; };
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const flush = () => act(async () => { await Promise.resolve(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; Object.keys(mockButtons).forEach((k) => delete mockButtons[k]); Object.keys(mockSelects).forEach((k) => delete mockSelects[k]); });

describe('the bar', () => {
  it('Delete · Unpost · Close, and Post is the LAST - a large button', () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expectInOrder(['customer-invoice-delete', 'customer-invoice-close', 'customer-invoice-post']);
    const ids = qa('customer-invoice-').filter((id) => ['delete', 'unpost', 'close', 'posted', 'post'].some((k) => id === `customer-invoice-${k}`));
    expect(ids[ids.length - 1]).toBe('customer-invoice-post');
    expect(mockButtons['customer-invoice-post'].size).toBe('large');
  });
  it('a posted document: Unpost and the large Posted button (nothing to press), no Post, no Delete', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expect(q('customer-invoice-posted')).not.toBeNull();
    expect(mockButtons['customer-invoice-posted']).toMatchObject({ size: 'large', icon: 'check' });
    expect(mockButtons['customer-invoice-unpost'].size).toBe('small');
    expect(q('customer-invoice-post')).toBeNull();
    expect(q('customer-invoice-delete')).toBeNull();
  });
  it('a draft without lines cannot be posted', () => {
    setDoc([header('d1')], {}, []);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(q('customer-invoice-post')).toBeNull();
  });
  it('the title and the subtitle: the customer, the number of the document, the contract, the currency', () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('customer-invoice-title')).toBe('Customer invoice · Customer d1');
    expect(textOf('customer-invoice-subtitle')).toBe('CI-d1 · S-1 · Supply · EUR');
    cleanupUI();
    setDoc([header('d1', { contractGUID: null, contractInfo: '', currency: '' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('customer-invoice-subtitle')).toBe('CI-d1 · no contract');
  });
  it('Post / Unpost / Delete / Close call their commands; a refusal lists the problems', async () => {
    const onClose = jest.fn();
    setDoc([header('d1')], { post: jest.fn(async () => ({ status: 'refused', lines: 3, problems: [{ lineGUID: null, problem: 'invoiceNumberMissing' }, { lineGUID: 'l1', problem: 'quantityIsZero' }] })) });
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} onClose={onClose} />);
    press('customer-invoice-post');
    await flush();
    expect(mockDoc.post).toHaveBeenCalledWith('d1');
    expect(textOf('customer-invoice-problems')).toContain('The document was not posted');
    expect(textOf('customer-invoice-problem-0')).toContain('number printed');
    expect(textOf('customer-invoice-problem-1')).toContain('quantity 0');
    press('customer-invoice-close');
    expect(onClose).toHaveBeenCalled();
    press('customer-invoice-delete');
    await flush();
    expect(mockDoc.remove).toHaveBeenCalledWith('d1');
    expect(onClose).toHaveBeenCalledTimes(2);                                // the last document is gone: the form closes
    cleanupUI();
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    press('customer-invoice-unpost');
    await flush();
    expect(mockDoc.unpost).toHaveBeenCalledWith('d1');
  });
  it('an error of the database is shown', () => {
    setDoc([header('d1')], { error: 'row-level security' });
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('customer-invoice-error')).toBe('row-level security');
  });
});

describe('Create based on → Payment fact (a POSTED invoice)', () => {
  it('a posted invoice has the button before Close, a draft has none', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expectInOrder(['customer-invoice-unpost', 'customer-invoice-create-based-on', 'customer-invoice-close', 'customer-invoice-posted']);
    cleanupUI();
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expect(q('customer-invoice-create-based-on')).toBeNull();
  });
});

describe('a tab for each document (one customer + one contract each)', () => {
  it('one document: no strip; several: a tab each, with the customer, the contract, the number', () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(q('customer-invoice-documents')).toBeNull();
    cleanupUI();
    setDoc([header('d1'), header('d2', { contractInfo: 'S-2', status: 'posted' }), header('d3', { contractGUID: null, contractInfo: '' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1', 'd2', 'd3']} />);
    expect(qa('customer-invoice-document-').filter((id) => !id.endsWith('-browser-tab'))).toEqual(['customer-invoice-document-d1', 'customer-invoice-document-d2', 'customer-invoice-document-d3']);
    expect(textOf('customer-invoice-document-d2')).toContain('Customer d2');
    expect(textOf('customer-invoice-document-d2')).toContain('S-2 · CI-d2 · Posted');
    expect(textOf('customer-invoice-document-d3')).toContain('no contract');
  });
  it('a click on a tab shows THAT document (the title, the table of its lines)', () => {
    setDoc([header('d1'), header('d2', { status: 'posted' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1', 'd2']} />);
    expect(textOf('customer-invoice-title')).toContain('Customer d1');
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'timeGenus' })).toBe(true);
    press('customer-invoice-document-d2');
    expect(textOf('customer-invoice-title')).toContain('Customer d2');
    expect(q('customer-invoice-posted')).not.toBeNull();
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'timeGenus' })).toBe(false);
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd2', genusGUID: 'timeGenus' })).toBe(true);
  });
  it('web: every tab has a button that opens the document in a browser tab of its own', () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    setDoc([header('d1'), header('d2')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1', 'd2']} />);
    press('customer-invoice-document-d2-browser-tab');
    expect(open).toHaveBeenCalledWith('/pm/project/task/customer-invoice?documentGUID=d2', '_blank');
    open.mockRestore();
  });
});

describe('the form of the document', () => {
  it('number, legal entity, customer, contract, currency (read only), the invoice number and date (editable in a draft)', () => {
    setDoc([header('d1', { customerInvoiceNumber: 'INV-1', day: '2026-10-20' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(inputValue('customer-invoice-field-number')).toBe('CI-d1');
    expect(inputValue('customer-invoice-field-currency')).toBe('EUR');
    expect(inputValue('customer-invoice-field-invoiceNumber')).toBe('INV-1');
    expect(inputValue('customer-invoice-field-invoiceDate')).toBe('2026-10-20');
    // an unposted document: the customer and the contract are selects (changeable)
    expect(mockSelects['customer-invoice-field-customer']).toMatchObject({ entityName: 'partnerReusable', value: 'vp-1' });
    expect(mockSelects['customer-invoice-field-contract']).toMatchObject({ entityName: 'contractReusable', value: 'vc-1' });
    expect(readOnly('customer-invoice-field-invoiceNumber')).toBe(false);
    expect(mockSelects['customer-invoice-field-legalEntity']).toMatchObject({ entityName: 'legalEntityReusable', value: 'le-1' });
  });
  it('a posted document: everything is read only (the legal entity is a text)', () => {
    setDoc([header('d1', { status: 'posted', customerInvoiceNumber: 'INV-1', day: '2026-10-20' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(readOnly('customer-invoice-field-invoiceNumber')).toBe(true);
    expect(readOnly('customer-invoice-field-invoiceDate')).toBe(true);
    expect(inputValue('customer-invoice-field-legalEntity')).toBe('Acme SIA');
    expect(inputValue('customer-invoice-field-customer')).toBe('Customer d1');
    expect(inputValue('customer-invoice-field-contract')).toBe('S-1 · Supply');
    expect(readOnly('customer-invoice-field-customer')).toBe(true);
  });
  it('the number and the date are saved a moment after the last key; a legal entity at once; an unreadable date is not saved', async () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    typeInto('customer-invoice-field-invoiceNumber', 'INV-77');
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenCalledWith('d1', { customerInvoiceNumber: 'INV-77' });
    typeInto('customer-invoice-field-invoiceDate', 'soon');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenCalledTimes(1);
    expect(q('customer-invoice-field-invoiceDate')!.getAttribute('aria-label')).toBe('error');
    typeInto('customer-invoice-field-invoiceDate', '2026-10-20');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { customerInvoiceDateTime: '2026-10-20T00:00:00.000Z' });
    act(() => mockSelects['customer-invoice-field-legalEntity'].onChange('le-9'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { legalEntityGUID: 'le-9' });
  });
  it('what is missing before Post is told in a line', () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('customer-invoice-missing')).toContain('number printed');
    expect(textOf('customer-invoice-missing')).toContain('date of the customer invoice');
    cleanupUI();
    setDoc([header('d1', { customerInvoiceNumber: 'X', day: '2026-10-20' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(q('customer-invoice-missing')).toBeNull();
  });
  it('the totals of the document: before VAT, VAT, with VAT (not the lines of another document)', () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('customer-invoice-totals')).toContain('3 lines');
    expect(textOf('customer-invoice-total-before')).toContain('31.1');
    expect(textOf('customer-invoice-total-vat')).toContain('6.53');
    expect(textOf('customer-invoice-total-with')).toContain('37.63');
  });
});

describe('DocumentTabs: All (default) · Deliverable', () => {
  it('the order and the counts of lines', () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(qa('customer-invoice-tab-').filter((id) => !id.endsWith('-count'))).toEqual(['customer-invoice-tab-all', 'customer-invoice-tab-revenueGenus']);
    expect(textOf('customer-invoice-tab-all-count')).toBe('3');
    expect(textOf('customer-invoice-tab-revenueGenus-count')).toBe('3');
  });
  it('All is open at the start and shows every line of the document; the Deliverable tab filters to the Revenue genus', () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    const all = lastTable().rowFilter;
    expect(lines().filter(all).map((r) => r.rowGUID)).toEqual(['l1', 'l2', 'l3']);
    press('customer-invoice-tab-revenueGenus');
    expect(lines().filter(lastTable().rowFilter).map((r) => r.rowGUID)).toEqual(['l1', 'l2', 'l3']);
    press('customer-invoice-tab-all');
    expect(lines().filter(lastTable().rowFilter)).toHaveLength(3);
  });
});

describe('the table of the lines', () => {
  it('reads the lines of THIS document through the redux entity; no new lines (they come from the task lines)', () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ entityName: CUSTOMER_INVOICE_LINES_ENTITY, listOwnerGUID: '*', listParentGUID: '*', addEnabled: false, reorderEnabled: false, realtime: true });
    expect(lastTable().readParams).toEqual({ match: { rowHeaderGUID: 'd1' } });
  });
  it('DRAFT: update (qty, price, VAT rate, the two accounting sums), delete, selection', () => {
    setDoc([header('d1')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ crudPanelEnabled: true, contextMenuEnabled: true, selectionEnabled: true });
    expect(lastTable().extraMenuItems).toBe(mockLineMenu); // the Task context menu items of a line
    const editable = lastTable().visualColumns.filter((c: any) => c.editable === true).map((c: any) => c.key);
    expect(editable).toEqual(['qty', 'price', 'vat', 'sumForAccountingBeforeVAT', 'sumForAccountingVAT']);
  });
  it('POSTED: read only - no panel, no menu, no selection, no editable cell', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ crudPanelEnabled: false, contextMenuEnabled: false, selectionEnabled: false });
    expect(lastTable().visualColumns.filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
  });
  it('no document: no table, a message', () => {
    setDoc([]);
    renderUI(<CustomerInvoiceDocumentForm documents={['dX']} />);
    expect(mockTable).not.toHaveBeenCalled();
    expect(textOf('customer-invoice-empty')).toContain('not found');
  });
});

describe('a draft WITHOUT a customer (made from task lines that have none)', () => {
  const noCustomer = (over: Partial<CustomerInvoiceHeaderView> = {}) => header('d1', { partnerGUID: '', partnerTitle: '', contractGUID: null, contractInfo: '', legalEntityGUID: '', legalEntityTitle: '', currency: '', ...over });
  it('the customer and its contract are selects in the TextInputApp look (the contract waits for the customer); there is NO Set customer button', () => {
    setDoc([noCustomer()]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(mockSelects['customer-invoice-field-customer']).toMatchObject({ entityName: 'partnerReusable', value: null, asInput: true });
    expect(mockSelects['customer-invoice-field-contract']).toMatchObject({ entityName: 'contractReusable', rowParentGUID: 'partner', disabled: true, asInput: true });
    expect(mockSelects['customer-invoice-field-legalEntity']).toMatchObject({ asInput: true });
    expect(mockButtons['customer-invoice-set-customer']).toBeUndefined();
    expect(q('customer-invoice-set-customer')).toBeNull();
    expect(textOf('customer-invoice-title')).toContain('No customer');
  });
  it('the customer is saved AT ONCE when it is chosen; the contract at once when it is chosen; clearing sends an empty value', () => {
    setDoc([noCustomer()]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    act(() => mockSelects['customer-invoice-field-customer'].onChange('vp-2'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { customerInvoicePartner: 'vp-2' });
    act(() => mockSelects['customer-invoice-field-customer'].onChange(null));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { customerInvoicePartner: '' });
  });
  it('with a customer chosen its contracts open; a contract is saved at once (the customer stays changeable until Post)', () => {
    setDoc([noCustomer({ partnerGUID: 'vp-2', partnerTitle: 'Beta', legalEntityGUID: 'le-1' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(mockSelects['customer-invoice-field-customer']).toMatchObject({ value: 'vp-2' });
    expect(mockSelects['customer-invoice-field-contract']).toMatchObject({ rowOwnerGUID: 'vp-2', disabled: false });
    act(() => mockSelects['customer-invoice-field-contract'].onChange('vc-3'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { customerInvoiceContract: 'vc-3' });
    act(() => mockSelects['customer-invoice-field-contract'].onChange(null));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { customerInvoiceContract: '' });
  });
  it('the line of what is missing names the customer and the legal entity; the tab says "No customer"', () => {
    setDoc([noCustomer(), header('d2')]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1', 'd2']} />);
    expect(textOf('customer-invoice-missing')).toContain('Choose the customer');
    expect(textOf('customer-invoice-missing')).toContain('Choose the legal entity');
    expect(textOf('customer-invoice-document-d1')).toContain('No customer');
  });
  it('an UNPOSTED document made WITH a customer can change it too: the selects hold the customer and the contract; a change is saved at once', () => {
    setDoc([header('d1', { partnerGUID: 'vp-1', contractGUID: 'vc-1' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(mockSelects['customer-invoice-field-customer']).toMatchObject({ value: 'vp-1' });
    expect(mockSelects['customer-invoice-field-contract']).toMatchObject({ value: 'vc-1', rowOwnerGUID: 'vp-1', disabled: false });
    act(() => mockSelects['customer-invoice-field-customer'].onChange('vp-2'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { customerInvoicePartner: 'vp-2' });
  });
  it('a POSTED document never offers the selects', () => {
    setDoc([noCustomer({ status: 'posted', partnerGUID: 'vp-2', partnerTitle: 'Beta', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme' })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(mockSelects['customer-invoice-field-customer']).toBeUndefined();
    expect(readOnly('customer-invoice-field-customer')).toBe(true);
  });
});

describe('independent input (the project switch customerInvoiceFunctionalityEnabled)', () => {
  it('the header shows the project of the document (read only)', () => {
    setDoc([header('d1', { projectGUID: 'p1', projectName: 'Alpha', independentInputAvailable: true })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(inputValue('customer-invoice-field-project')).toBe('Alpha');
    expect(readOnly('customer-invoice-field-project')).toBe(true);
  });
  it('ON in a draft: the + of the table adds a Revenue line by the database; role / resource / unit of the columns can be filled in', () => {
    setDoc([header('d1', { independentInputAvailable: true })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ addEnabled: true, crudPanelEnabled: true });
    act(() => lastTable().onAdd());
    expect(mockDoc.addLine).toHaveBeenLastCalledWith('d1', 'revenueGenus');
    const cols = lastTable().visualColumns;
    expect(['role', 'resource', 'unit'].map((k) => cols.find((c: any) => c.key === k).editable)).toEqual([true, true, true]);
    // a line that came from a task line cannot be described by hand
    expect(cols.find((c: any) => c.key === 'role').validate('x', { taskLineGUID: 'tl-1' })).toContain('task line');
    expect(cols.find((c: any) => c.key === 'role').validate('x', { taskLineGUID: null })).toBeNull();
    press('customer-invoice-tab-revenueGenus');
    act(() => lastTable().onAdd());
    expect(mockDoc.addLine).toHaveBeenLastCalledWith('d1', 'revenueGenus');
  });
  it('OFF: no add button, role / resource / unit stay read only (lines come from the task lines)', () => {
    setDoc([header('d1', { independentInputAvailable: false })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ addEnabled: false });
    expect(lastTable().onAdd).toBeUndefined();
    expect(['role', 'resource', 'unit'].map((k) => lastTable().visualColumns.find((c: any) => c.key === k).editable)).toEqual([false, false, false]);
  });
  it('a POSTED document: no add even when the setting is on', () => {
    setDoc([header('d1', { status: 'posted', independentInputAvailable: true })]);
    renderUI(<CustomerInvoiceDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ addEnabled: false });
  });
});
