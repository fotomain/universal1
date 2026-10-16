/** @jest-environment jsdom */
// PMPurchaseOrderDocumentForm: the bar (Post is the LAST, a large button; Posted is the same size), the form (TextInputApp / DateInputApp / the catalog select), a TAB for each document, the DocumentTabs
// All · Time · Material · Expenses with their counts, the totals, and how the ReusableTable of the lines is configured in a draft and in a posted document. The data hook and the table are fakes.
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, press, q, qa, renderUI, textOf, typeInto, wait } from '../../../pm/ui/pmUiTestKit';

const mockDoc: Record<string, any> = {};
const mockPlaces: Record<string, any> = {};
// the project tree window carries the whole dashboard (Skia): a fake that shows what it was asked
const mockPicker = jest.fn();
jest.mock('../../../../kit8/pm/view/project/pick/PMProjectPickerModal', () => ({ __esModule: true, default: (p: any) => { mockPicker(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({ usePurchaseOrderDocuments: () => mockDoc, usePurchaseOrderLinePlaces: () => mockPlaces }));
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
const PMPurchaseOrderDocumentForm = require('../../../../kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentForm').default;
import { PURCHASE_ORDER_LINES_ENTITY, PurchaseOrderHeaderView } from '../../../../kit8/documents/vendor/purchase_order/purchaseOrderModel';

const header = (guid: string, over: Partial<PurchaseOrderHeaderView> = {}): PurchaseOrderHeaderView => ({
  guid, number: `PO-${guid}`, status: 'draft', purchaseOrderNumber: '', day: '', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: `Vendor ${guid}`, contractGUID: 'vc-1', contractInfo: 'S-1 · Supply',
  currency: 'EUR', authorName: 'Anna', ...over,
});
const lines = (): any[] => [
  { rowGUID: 'l1', rowHeaderGUID: 'd1', genusGUID: 'timeGenus', sumForContract: '10.10', vatForContract: '2.12' },
  { rowGUID: 'l2', rowHeaderGUID: 'd1', genusGUID: 'materialGenus', sumForContract: '20', vatForContract: '4.2' },
  { rowGUID: 'l3', rowHeaderGUID: 'd1', genusGUID: 'materialGenus', sumForContract: '1', vatForContract: '0.21' },
  { rowGUID: 'x1', rowHeaderGUID: 'd2', genusGUID: 'timeGenus', sumForContract: 1000, vatForContract: 1000 },
];
function setDoc(headers: PurchaseOrderHeaderView[], over: Record<string, any> = {}, rows: any[] = lines()) {
  Object.keys(mockDoc).forEach((k) => delete mockDoc[k]);
  Object.assign(mockDoc, {
    headers, isLoading: false, error: null, busy: false,
    setHeader: jest.fn(async () => true), post: jest.fn(async () => ({ status: 'posted', lines: 3, problems: [] })), unpost: jest.fn(async () => ({ status: 'draft', lines: 0, problems: [] })), remove: jest.fn(async () => true), addLine: jest.fn(async () => true), setLineTask: jest.fn(async () => true), refetch: jest.fn(), ...over,
  });
  (globalThis as any).__pmTestReduxState = { [PURCHASE_ORDER_LINES_ENTITY]: { entityDataFromServer: rows } };
}
const readOnly = (id: string) => { const el = q(id) as HTMLInputElement; return el.readOnly || el.disabled; };
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const flush = () => act(async () => { await Promise.resolve(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; Object.keys(mockButtons).forEach((k) => delete mockButtons[k]); Object.keys(mockSelects).forEach((k) => delete mockSelects[k]); });

describe('the bar', () => {
  it('Delete · Unpost · Close, and Post is the LAST - a large button', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expectInOrder(['purchase-order-delete', 'purchase-order-close', 'purchase-order-post']);
    const ids = qa('purchase-order-').filter((id) => ['delete', 'unpost', 'close', 'posted', 'post'].some((k) => id === `purchase-order-${k}`));
    expect(ids[ids.length - 1]).toBe('purchase-order-post');
    expect(mockButtons['purchase-order-post'].size).toBe('large');
  });
  it('a posted document: Unpost and the large Posted button (nothing to press), no Post, no Delete', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expect(q('purchase-order-posted')).not.toBeNull();
    expect(mockButtons['purchase-order-posted']).toMatchObject({ size: 'large', icon: 'check' });
    expect(mockButtons['purchase-order-unpost'].size).toBe('small');
    expect(q('purchase-order-post')).toBeNull();
    expect(q('purchase-order-delete')).toBeNull();
  });
  it('a draft without lines cannot be posted', () => {
    setDoc([header('d1')], {}, []);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(q('purchase-order-post')).toBeNull();
  });
  it('the title and the subtitle: the vendor, the number of the document, the contract, the currency', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(textOf('purchase-order-title')).toBe('Purchase order · Vendor d1');
    expect(textOf('purchase-order-subtitle')).toBe('PO-d1 · S-1 · Supply · EUR');
    cleanupUI();
    setDoc([header('d1', { contractGUID: null, contractInfo: '', currency: '' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(textOf('purchase-order-subtitle')).toBe('PO-d1 · no contract');
  });
  it('Post / Unpost / Delete / Close call their commands; a refusal lists the problems', async () => {
    const onClose = jest.fn();
    setDoc([header('d1')], { post: jest.fn(async () => ({ status: 'refused', lines: 3, problems: [{ lineGUID: null, problem: 'orderNumberMissing' }, { lineGUID: 'l1', problem: 'quantityIsZero' }] })) });
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} onClose={onClose} />);
    press('purchase-order-post');
    await flush();
    expect(mockDoc.post).toHaveBeenCalledWith('d1');
    expect(textOf('purchase-order-problems')).toContain('The document was not posted');
    expect(textOf('purchase-order-problem-0')).toContain('number printed');
    expect(textOf('purchase-order-problem-1')).toContain('quantity 0');
    press('purchase-order-close');
    expect(onClose).toHaveBeenCalled();
    press('purchase-order-delete');
    await flush();
    expect(mockDoc.remove).toHaveBeenCalledWith('d1');
    expect(onClose).toHaveBeenCalledTimes(2);                                // the last document is gone: the form closes
    cleanupUI();
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    press('purchase-order-unpost');
    await flush();
    expect(mockDoc.unpost).toHaveBeenCalledWith('d1');
  });
  it('an error of the database is shown', () => {
    setDoc([header('d1')], { error: 'row-level security' });
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(textOf('purchase-order-error')).toBe('row-level security');
  });
});

describe('a tab for each document (one vendor + one contract each)', () => {
  it('one document: no strip; several: a tab each, with the vendor, the contract, the number', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(q('purchase-order-documents')).toBeNull();
    cleanupUI();
    setDoc([header('d1'), header('d2', { contractInfo: 'S-2', status: 'posted' }), header('d3', { contractGUID: null, contractInfo: '' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1', 'd2', 'd3']} />);
    expect(qa('purchase-order-document-').filter((id) => !id.endsWith('-browser-tab'))).toEqual(['purchase-order-document-d1', 'purchase-order-document-d2', 'purchase-order-document-d3']);
    expect(textOf('purchase-order-document-d2')).toContain('Vendor d2');
    expect(textOf('purchase-order-document-d2')).toContain('S-2 · PO-d2 · Posted');
    expect(textOf('purchase-order-document-d3')).toContain('no contract');
  });
  it('a click on a tab shows THAT document (the title, the table of its lines)', () => {
    setDoc([header('d1'), header('d2', { status: 'posted' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1', 'd2']} />);
    expect(textOf('purchase-order-title')).toContain('Vendor d1');
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'timeGenus' })).toBe(true);
    press('purchase-order-document-d2');
    expect(textOf('purchase-order-title')).toContain('Vendor d2');
    expect(q('purchase-order-posted')).not.toBeNull();
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'timeGenus' })).toBe(false);
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd2', genusGUID: 'timeGenus' })).toBe(true);
  });
  it('web: every tab has a button that opens the document in a browser tab of its own', () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    setDoc([header('d1'), header('d2')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1', 'd2']} />);
    press('purchase-order-document-d2-browser-tab');
    expect(open).toHaveBeenCalledWith('/pm/project/task/purchase-order?documentGUID=d2', '_blank');
    open.mockRestore();
  });
});

describe('the form of the document', () => {
  it('number, legal entity, vendor, contract, currency (read only), the order number and date (editable in a draft)', () => {
    setDoc([header('d1', { purchaseOrderNumber: 'INV-1', day: '2026-10-20' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(inputValue('purchase-order-field-number')).toBe('PO-d1');
    expect(inputValue('purchase-order-field-currency')).toBe('EUR');
    expect(inputValue('purchase-order-field-orderNumber')).toBe('INV-1');
    expect(inputValue('purchase-order-field-orderDate')).toBe('2026-10-20');
    // an unposted document: the vendor and the contract are selects (changeable)
    expect(mockSelects['purchase-order-field-vendor']).toMatchObject({ entityName: 'partnerReusable', value: 'vp-1' });
    expect(mockSelects['purchase-order-field-contract']).toMatchObject({ entityName: 'contractReusable', value: 'vc-1' });
    expect(readOnly('purchase-order-field-orderNumber')).toBe(false);
    expect(mockSelects['purchase-order-field-legalEntity']).toMatchObject({ entityName: 'legalEntityReusable', value: 'le-1' });
  });
  it('a posted document: everything is read only (the legal entity is a text)', () => {
    setDoc([header('d1', { status: 'posted', purchaseOrderNumber: 'INV-1', day: '2026-10-20' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(readOnly('purchase-order-field-orderNumber')).toBe(true);
    expect(readOnly('purchase-order-field-orderDate')).toBe(true);
    expect(inputValue('purchase-order-field-legalEntity')).toBe('Acme SIA');
    expect(inputValue('purchase-order-field-vendor')).toBe('Vendor d1');
    expect(inputValue('purchase-order-field-contract')).toBe('S-1 · Supply');
    expect(readOnly('purchase-order-field-vendor')).toBe(true);
  });
  it('the number and the date are saved a moment after the last key; a legal entity at once; an unreadable date is not saved', async () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    typeInto('purchase-order-field-orderNumber', 'INV-77');
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenCalledWith('d1', { purchaseOrderNumber: 'INV-77' });
    typeInto('purchase-order-field-orderDate', 'soon');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenCalledTimes(1);
    expect(q('purchase-order-field-orderDate')!.getAttribute('aria-label')).toBe('error');
    typeInto('purchase-order-field-orderDate', '2026-10-20');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { purchaseOrderDateTime: '2026-10-20T00:00:00.000Z' });
    act(() => mockSelects['purchase-order-field-legalEntity'].onChange('le-9'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { legalEntityGUID: 'le-9' });
  });
  it('what is missing before Post is told in a line', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(textOf('purchase-order-missing')).toContain('number printed');
    expect(textOf('purchase-order-missing')).toContain('date of the purchase order');
    cleanupUI();
    setDoc([header('d1', { purchaseOrderNumber: 'X', day: '2026-10-20' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(q('purchase-order-missing')).toBeNull();
  });
  it('the totals of the document: before VAT, VAT, with VAT (not the lines of another document)', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(textOf('purchase-order-totals')).toContain('3 lines');
    expect(textOf('purchase-order-total-before')).toContain('31.1');
    expect(textOf('purchase-order-total-vat')).toContain('6.53');
    expect(textOf('purchase-order-total-with')).toContain('37.63');
  });
});

describe('DocumentTabs: All (default) · Time · Material · Expenses', () => {
  it('the order and the counts of lines', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(qa('purchase-order-tab-').filter((id) => !id.endsWith('-count'))).toEqual(['purchase-order-tab-all', 'purchase-order-tab-timeGenus', 'purchase-order-tab-materialGenus', 'purchase-order-tab-expenseGenus']);
    expect(textOf('purchase-order-tab-all-count')).toBe('3');
    expect(textOf('purchase-order-tab-timeGenus-count')).toBe('1');
    expect(textOf('purchase-order-tab-materialGenus-count')).toBe('2');
    expect(q('purchase-order-tab-expenseGenus-count')).toBeNull();
  });
  it('All is open at the start and shows every line of the document; a tab filters to its genus', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    const all = lastTable().rowFilter;
    expect(lines().filter(all).map((r) => r.rowGUID)).toEqual(['l1', 'l2', 'l3']);
    press('purchase-order-tab-materialGenus');
    expect(lines().filter(lastTable().rowFilter).map((r) => r.rowGUID)).toEqual(['l2', 'l3']);
    press('purchase-order-tab-all');
    expect(lines().filter(lastTable().rowFilter)).toHaveLength(3);
  });
});

describe('the table of the lines', () => {
  it('reads the lines of THIS document through the redux entity; no new lines (they come from the task lines)', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ entityName: PURCHASE_ORDER_LINES_ENTITY, listOwnerGUID: '*', listParentGUID: '*', addEnabled: false, reorderEnabled: false, realtime: true });
    expect(lastTable().readParams).toEqual({ match: { rowHeaderGUID: 'd1' } });
  });
  it('DRAFT: update (qty, price, VAT %), delete, selection', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ crudPanelEnabled: true, contextMenuEnabled: true, selectionEnabled: true });
    const editable = lastTable().visualColumns.filter((c: any) => c.editable === true).map((c: any) => c.key);
    expect(editable).toEqual(['qty', 'price', 'vat']);
  });
  it('POSTED: read only - no panel, no menu, no selection, no editable cell', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ crudPanelEnabled: false, contextMenuEnabled: false, selectionEnabled: false });
    expect(lastTable().visualColumns.filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
  });
  it('no document: no table, a message', () => {
    setDoc([]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['dX']} />);
    expect(mockTable).not.toHaveBeenCalled();
    expect(textOf('purchase-order-empty')).toContain('not found');
  });
});

describe('a draft WITHOUT a vendor (made from task lines that have none)', () => {
  const noVendor = (over: Partial<PurchaseOrderHeaderView> = {}) => header('d1', { partnerGUID: '', partnerTitle: '', contractGUID: null, contractInfo: '', legalEntityGUID: '', legalEntityTitle: '', currency: '', ...over });
  it('the vendor and its contract are selects in the TextInputApp look (the contract waits for the vendor); there is NO Set vendor button', () => {
    setDoc([noVendor()]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(mockSelects['purchase-order-field-vendor']).toMatchObject({ entityName: 'partnerReusable', value: null, asInput: true });
    expect(mockSelects['purchase-order-field-contract']).toMatchObject({ entityName: 'contractReusable', rowParentGUID: 'partner', disabled: true, asInput: true });
    expect(mockSelects['purchase-order-field-legalEntity']).toMatchObject({ asInput: true });
    expect(mockButtons['purchase-order-set-vendor']).toBeUndefined();
    expect(q('purchase-order-set-vendor')).toBeNull();
    expect(textOf('purchase-order-title')).toContain('No vendor');
  });
  it('the vendor is saved AT ONCE when it is chosen; the contract at once when it is chosen; clearing sends an empty value', () => {
    setDoc([noVendor()]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    act(() => mockSelects['purchase-order-field-vendor'].onChange('vp-2'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { purchaseOrderPartner: 'vp-2' });
    act(() => mockSelects['purchase-order-field-vendor'].onChange(null));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { purchaseOrderPartner: '' });
  });
  it('with a vendor chosen its contracts open; a contract is saved at once (the vendor stays changeable until Post)', () => {
    setDoc([noVendor({ partnerGUID: 'vp-2', partnerTitle: 'Beta', legalEntityGUID: 'le-1' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(mockSelects['purchase-order-field-vendor']).toMatchObject({ value: 'vp-2' });
    expect(mockSelects['purchase-order-field-contract']).toMatchObject({ rowOwnerGUID: 'vp-2', disabled: false });
    act(() => mockSelects['purchase-order-field-contract'].onChange('vc-3'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { purchaseOrderContract: 'vc-3' });
    act(() => mockSelects['purchase-order-field-contract'].onChange(null));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { purchaseOrderContract: '' });
  });
  it('the line of what is missing names the vendor and the legal entity; the tab says "No vendor"', () => {
    setDoc([noVendor(), header('d2')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1', 'd2']} />);
    expect(textOf('purchase-order-missing')).toContain('Choose the vendor');
    expect(textOf('purchase-order-missing')).toContain('Choose the legal entity');
    expect(textOf('purchase-order-document-d1')).toContain('No vendor');
  });
  it('an UNPOSTED document made WITH a vendor can change it too: the selects hold the vendor and the contract; a change is saved at once', () => {
    setDoc([header('d1', { partnerGUID: 'vp-1', contractGUID: 'vc-1' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(mockSelects['purchase-order-field-vendor']).toMatchObject({ value: 'vp-1' });
    expect(mockSelects['purchase-order-field-contract']).toMatchObject({ value: 'vc-1', rowOwnerGUID: 'vp-1', disabled: false });
    act(() => mockSelects['purchase-order-field-vendor'].onChange('vp-2'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { purchaseOrderPartner: 'vp-2' });
  });
  it('a POSTED document never offers the selects', () => {
    setDoc([noVendor({ status: 'posted', partnerGUID: 'vp-2', partnerTitle: 'Beta', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(mockSelects['purchase-order-field-vendor']).toBeUndefined();
    expect(readOnly('purchase-order-field-vendor')).toBe(true);
  });
});

describe('independent input (project setting independentInvoiceInputAvailable)', () => {
  it('the header shows the project of the document (read only)', () => {
    setDoc([header('d1', { projectGUID: 'p1', projectName: 'Alpha', independentInputAvailable: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(inputValue('purchase-order-field-project')).toBe('Alpha');
    expect(readOnly('purchase-order-field-project')).toBe(true);
  });
  it('ON in a draft: the + of the table adds a line of the kind of the tab by the database (All: Time); role / resource / unit of the columns can be filled in', () => {
    setDoc([header('d1', { independentInputAvailable: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ addEnabled: true, crudPanelEnabled: true });
    act(() => lastTable().onAdd());
    expect(mockDoc.addLine).toHaveBeenLastCalledWith('d1', 'timeGenus');
    const cols = lastTable().visualColumns;
    expect(['role', 'resource', 'unit'].map((k) => cols.find((c: any) => c.key === k).editable)).toEqual([true, true, true]);
    // a line that came from a task line cannot be described by hand
    expect(cols.find((c: any) => c.key === 'role').validate('x', { taskLineGUID: 'tl-1' })).toContain('task line');
    expect(cols.find((c: any) => c.key === 'role').validate('x', { taskLineGUID: null })).toBeNull();
    press('purchase-order-tab-materialGenus');
    act(() => lastTable().onAdd());
    expect(mockDoc.addLine).toHaveBeenLastCalledWith('d1', 'materialGenus');
  });
  it('OFF: no add button, role / resource / unit stay read only (lines come from the task lines)', () => {
    setDoc([header('d1', { independentInputAvailable: false })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ addEnabled: false });
    expect(lastTable().onAdd).toBeUndefined();
    expect(['role', 'resource', 'unit'].map((k) => lastTable().visualColumns.find((c: any) => c.key === k).editable)).toEqual([false, false, false]);
  });
  it('a POSTED document: no add even when the setting is on', () => {
    setDoc([header('d1', { status: 'posted', independentInputAvailable: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ addEnabled: false });
  });
});


describe('Multi Project (project setting multiProjectVendorInvoceNeeded)', () => {
  const GUID = '1ea2b3c4-0000-4000-8000-000000000001';
  const colOf = (key: string): any => lastTable().visualColumns.find((c: any) => c.key === key);
  const cell = (key: string, row: any = { rowGUID: 'l1' }) => colOf(key).renderCell(row);

  it('the chevron at the left of the Project field is there only when the project setting offers it; it opens Single Project | Multi Project', () => {
    setDoc([header('d1')]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(q('purchase-order-project-mode')).toBeNull();
    cleanupUI();
    setDoc([header('d1', { multiProjectAvailable: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expectInOrder(['purchase-order-project-mode', 'purchase-order-field-project']);
    expect(q('purchase-order-project-mode-list-window')).toBeNull();
    press('purchase-order-project-mode');
    expect(q('purchase-order-project-mode-list-item-single')).not.toBeNull();
    expect(q('purchase-order-project-mode-list-item-multi')).not.toBeNull();
  });
  it('a posted document has no chevron', () => {
    setDoc([header('d1', { multiProjectAvailable: true, status: 'posted' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(q('purchase-order-project-mode')).toBeNull();
  });
  it('picking Multi Project saves it at once; picking the mode the document has changes nothing; Single saves false', () => {
    setDoc([header('d1', { multiProjectAvailable: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    press('purchase-order-project-mode');
    press('purchase-order-project-mode-list-item-single');
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    press('purchase-order-project-mode');
    press('purchase-order-project-mode-list-item-multi');
    expect(mockDoc.setHeader).toHaveBeenCalledWith('d1', { purchaseOrderMultiProject: true });
    cleanupUI();
    setDoc([header('d1', { multiProject: true, multiProjectAvailable: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    press('purchase-order-project-mode');
    press('purchase-order-project-mode-list-item-single');
    expect(mockDoc.setHeader).toHaveBeenCalledWith('d1', { purchaseOrderMultiProject: false });
  });
  it('the Project field says Multi Project; the lines table has the three place fields only then', () => {
    setDoc([header('d1', { multiProject: true, multiProjectAvailable: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect((q('purchase-order-field-project') as HTMLInputElement).getAttribute('aria-label')).toBe('Project · Multi Project');
    expect(lastTable().visualColumns.map((c: any) => c.key).slice(0, 4)).toEqual(['n', 'purchaseOrderLineProject', 'purchaseOrderTaskGUID', 'purchaseOrderTaskLineGUID']);
    cleanupUI();
    setDoc([header('d1', { multiProjectAvailable: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(lastTable().visualColumns.map((c: any) => c.key)).not.toContain('purchaseOrderTaskGUID');
  });
  it('variant 1: Paste takes the GUID from the clipboard - a task GUID sets the task, a line GUID sets the task line', async () => {
    mockClipboardText = `GUID copied: ${GUID}`;
    setDoc([header('d1', { multiProject: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    await act(async () => { await cell('purchaseOrderTaskGUID').props.onPaste(); });
    expect(mockDoc.setLineTask).toHaveBeenLastCalledWith('l1', GUID, null);
    await act(async () => { await cell('purchaseOrderTaskLineGUID').props.onPaste(); });
    expect(mockDoc.setLineTask).toHaveBeenLastCalledWith('l1', null, GUID);
  });
  it('Paste with no GUID on the clipboard says so and changes nothing', async () => {
    mockClipboardText = 'hello';
    setDoc([header('d1', { multiProject: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    await act(async () => { await cell('purchaseOrderTaskGUID').props.onPaste(); });
    expect(mockDoc.setLineTask).not.toHaveBeenCalled();
    expect(textOf('purchase-order-place-error')).toContain('no GUID');
  });
  it('Clear sends both null (back to the task and the project of the document)', async () => {
    setDoc([header('d1', { multiProject: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    await act(async () => { cell('purchaseOrderTaskLineGUID').props.onClear(); });
    expect(mockDoc.setLineTask).toHaveBeenLastCalledWith('l1', null, null);
  });
  it('variant 2: Select opens the project tree window - for a line in line mode, for a task in task mode; its answer sets the line / the task', async () => {
    setDoc([header('d1', { multiProject: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(mockPicker).not.toHaveBeenCalled();                                       // not even loaded until it is opened
    await act(async () => { cell('purchaseOrderTaskLineGUID').props.onPick(); });
    await flush(); await flush();
    expect(mockPicker.mock.calls.at(-1)![0]).toMatchObject({ mode: 'line', visible: true });
    await act(async () => { mockPicker.mock.calls.at(-1)![0].onPick({ projectGUID: 'p2', taskGUID: 't2', taskLineGUID: 'tl2' }); });
    expect(mockDoc.setLineTask).toHaveBeenLastCalledWith('l1', null, 'tl2');
    expect(q('purchase-order-picker')).toBeNull();                                   // closed after the answer
    await act(async () => { cell('purchaseOrderTaskGUID').props.onPick(); });
    await flush(); await flush();
    expect(mockPicker.mock.calls.at(-1)![0]).toMatchObject({ mode: 'task' });
    await act(async () => { mockPicker.mock.calls.at(-1)![0].onPick({ projectGUID: 'p2', taskGUID: 't2', taskLineGUID: null }); });
    expect(mockDoc.setLineTask).toHaveBeenLastCalledWith('l1', 't2', null);
  });
  it('a line mode window answered with only a TASK (button "Select this task") sets the task', async () => {
    setDoc([header('d1', { multiProject: true })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    await act(async () => { cell('purchaseOrderTaskLineGUID').props.onPick(); });
    await flush(); await flush();
    await act(async () => { mockPicker.mock.calls.at(-1)![0].onPick({ projectGUID: 'p2', taskGUID: 't2', taskLineGUID: null }); });
    expect(mockDoc.setLineTask).toHaveBeenLastCalledWith('l1', 't2', null);
  });
  it('a posted document: the place cells have no buttons', () => {
    setDoc([header('d1', { multiProject: true, status: 'posted' })]);
    renderUI(<PMPurchaseOrderDocumentForm documents={['d1']} />);
    expect(cell('purchaseOrderTaskGUID').props.editable).toBe(false);
  });
});
