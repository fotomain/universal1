/** @jest-environment jsdom */
// VendorInvoiceDocumentForm: the bar (Post is the LAST, a large button; Posted is the same size), the form (TextInputApp / DateInputApp / the catalog select), a TAB for each document, the DocumentTabs
// All · Time · Material · Expenses with their counts, the totals, and how the ReusableTable of the lines is configured in a draft and in a posted document. The data hook and the table are fakes.
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, press, q, qa, renderUI, textOf, typeInto, wait } from '../ui/pmUiTestKit';

const mockDoc: Record<string, any> = {};
jest.mock('../../../kit8/pm/vendor_invoice/useVendorInvoice', () => ({ useVendorInvoiceDocuments: () => mockDoc }));
jest.mock('../../../kit8/pm/view/task/finances/useTaskLineCatalogs', () => ({ useTaskLineCatalogs: () => require('../../../kit8/pm/view/task/finances/taskLineCatalogs').emptyTaskLineCatalogs() }));
const mockButtons: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const Real = jest.requireActual('../../../kit8/ui/components/common/ButtonApp').default;
  const Spy = (p: any) => { if (p.testID) mockButtons[p.testID] = p; return R.createElement(Real, p); };
  return { __esModule: true, default: Spy, ButtonApp: Spy };
});
const mockTable = jest.fn();
jest.mock('../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, disabled, error }: any) => R.createElement(TextInput, { testID, value, onChangeText, editable: !disabled, accessibilityLabel: error ? 'error' : undefined }) };
});
const mockSelects: Record<string, any> = {};
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); }, defaultTitleExtractor: () => '' }));

// (doMock AFTER the kit's own mock, and the form is required after it: the kit's TextInputApp does not tell whether it is disabled)
// a TextInputApp that tells whether it is disabled (the kit's one does not)
jest.doMock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  const TextInputApp = ({ testID, value, disabled, onChangeText, label }: any) => R.createElement(TextInput, { testID, value, editable: !disabled, onChangeText, accessibilityLabel: label });
  return { __esModule: true, default: TextInputApp, TextInputApp };
});
const VendorInvoiceDocumentForm = require('../../../kit8/pm/vendor_invoice/VendorInvoiceDocumentForm').default;
import { VENDOR_INVOICE_LINES_ENTITY, VendorInvoiceHeaderView } from '../../../kit8/pm/vendor_invoice/vendorInvoiceModel';

const header = (guid: string, over: Partial<VendorInvoiceHeaderView> = {}): VendorInvoiceHeaderView => ({
  guid, number: `VI-${guid}`, status: 'draft', vendorInvoiceNumber: '', day: '', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: `Vendor ${guid}`, contractGUID: 'vc-1', contractInfo: 'S-1 · Supply',
  currency: 'EUR', authorName: 'Anna', ...over,
});
const lines = (): any[] => [
  { rowGUID: 'l1', rowHeaderGUID: 'd1', genusGUID: 'timeGenus', sumForContract: '10.10', vatForContract: '2.12' },
  { rowGUID: 'l2', rowHeaderGUID: 'd1', genusGUID: 'materialGenus', sumForContract: '20', vatForContract: '4.2' },
  { rowGUID: 'l3', rowHeaderGUID: 'd1', genusGUID: 'materialGenus', sumForContract: '1', vatForContract: '0.21' },
  { rowGUID: 'x1', rowHeaderGUID: 'd2', genusGUID: 'timeGenus', sumForContract: 1000, vatForContract: 1000 },
];
function setDoc(headers: VendorInvoiceHeaderView[], over: Record<string, any> = {}, rows: any[] = lines()) {
  Object.keys(mockDoc).forEach((k) => delete mockDoc[k]);
  Object.assign(mockDoc, {
    headers, isLoading: false, error: null, busy: false,
    setHeader: jest.fn(async () => true), post: jest.fn(async () => ({ status: 'posted', lines: 3, problems: [] })), unpost: jest.fn(async () => ({ status: 'draft', lines: 0, problems: [] })), remove: jest.fn(async () => true), refetch: jest.fn(), ...over,
  });
  (globalThis as any).__pmTestReduxState = { [VENDOR_INVOICE_LINES_ENTITY]: { entityDataFromServer: rows } };
}
const readOnly = (id: string) => { const el = q(id) as HTMLInputElement; return el.readOnly || el.disabled; };
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const flush = () => act(async () => { await Promise.resolve(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; Object.keys(mockButtons).forEach((k) => delete mockButtons[k]); });

describe('the bar', () => {
  it('Delete · Unpost · Close, and Post is the LAST - a large button', () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expectInOrder(['vendor-invoice-delete', 'vendor-invoice-close', 'vendor-invoice-post']);
    const ids = qa('vendor-invoice-').filter((id) => ['delete', 'unpost', 'close', 'posted', 'post'].some((k) => id === `vendor-invoice-${k}`));
    expect(ids[ids.length - 1]).toBe('vendor-invoice-post');
    expect(mockButtons['vendor-invoice-post'].size).toBe('large');
  });
  it('a posted document: Unpost and the large Posted button (nothing to press), no Post, no Delete', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expect(q('vendor-invoice-posted')).not.toBeNull();
    expect(mockButtons['vendor-invoice-posted']).toMatchObject({ size: 'large', icon: 'check' });
    expect(mockButtons['vendor-invoice-unpost'].size).toBe('small');
    expect(q('vendor-invoice-post')).toBeNull();
    expect(q('vendor-invoice-delete')).toBeNull();
  });
  it('a draft without lines cannot be posted', () => {
    setDoc([header('d1')], {}, []);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(q('vendor-invoice-post')).toBeNull();
  });
  it('the title and the subtitle: the vendor, the number of the document, the contract, the currency', () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('vendor-invoice-title')).toBe('Vendor invoice · Vendor d1');
    expect(textOf('vendor-invoice-subtitle')).toBe('VI-d1 · S-1 · Supply · EUR');
    cleanupUI();
    setDoc([header('d1', { contractGUID: null, contractInfo: '', currency: '' })]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('vendor-invoice-subtitle')).toBe('VI-d1 · no contract');
  });
  it('Post / Unpost / Delete / Close call their commands; a refusal lists the problems', async () => {
    const onClose = jest.fn();
    setDoc([header('d1')], { post: jest.fn(async () => ({ status: 'refused', lines: 3, problems: [{ lineGUID: null, problem: 'invoiceNumberMissing' }, { lineGUID: 'l1', problem: 'quantityIsZero' }] })) });
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} onClose={onClose} />);
    press('vendor-invoice-post');
    await flush();
    expect(mockDoc.post).toHaveBeenCalledWith('d1');
    expect(textOf('vendor-invoice-problems')).toContain('The document was not posted');
    expect(textOf('vendor-invoice-problem-0')).toContain('number printed');
    expect(textOf('vendor-invoice-problem-1')).toContain('quantity 0');
    press('vendor-invoice-close');
    expect(onClose).toHaveBeenCalled();
    press('vendor-invoice-delete');
    await flush();
    expect(mockDoc.remove).toHaveBeenCalledWith('d1');
    expect(onClose).toHaveBeenCalledTimes(2);                                // the last document is gone: the form closes
    cleanupUI();
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    press('vendor-invoice-unpost');
    await flush();
    expect(mockDoc.unpost).toHaveBeenCalledWith('d1');
  });
  it('an error of the database is shown', () => {
    setDoc([header('d1')], { error: 'row-level security' });
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('vendor-invoice-error')).toBe('row-level security');
  });
});

describe('a tab for each document (one vendor + one contract each)', () => {
  it('one document: no strip; several: a tab each, with the vendor, the contract, the number', () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(q('vendor-invoice-documents')).toBeNull();
    cleanupUI();
    setDoc([header('d1'), header('d2', { contractInfo: 'S-2', status: 'posted' }), header('d3', { contractGUID: null, contractInfo: '' })]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1', 'd2', 'd3']} />);
    expect(qa('vendor-invoice-document-').filter((id) => !id.endsWith('-browser-tab'))).toEqual(['vendor-invoice-document-d1', 'vendor-invoice-document-d2', 'vendor-invoice-document-d3']);
    expect(textOf('vendor-invoice-document-d2')).toContain('Vendor d2');
    expect(textOf('vendor-invoice-document-d2')).toContain('S-2 · VI-d2 · Posted');
    expect(textOf('vendor-invoice-document-d3')).toContain('no contract');
  });
  it('a click on a tab shows THAT document (the title, the table of its lines)', () => {
    setDoc([header('d1'), header('d2', { status: 'posted' })]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1', 'd2']} />);
    expect(textOf('vendor-invoice-title')).toContain('Vendor d1');
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'timeGenus' })).toBe(true);
    press('vendor-invoice-document-d2');
    expect(textOf('vendor-invoice-title')).toContain('Vendor d2');
    expect(q('vendor-invoice-posted')).not.toBeNull();
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'timeGenus' })).toBe(false);
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd2', genusGUID: 'timeGenus' })).toBe(true);
  });
  it('web: every tab has a button that opens the document in a browser tab of its own', () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    setDoc([header('d1'), header('d2')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1', 'd2']} />);
    press('vendor-invoice-document-d2-browser-tab');
    expect(open).toHaveBeenCalledWith('/pm/project/task/vendor-invoice?documentGUID=d2', '_blank');
    open.mockRestore();
  });
});

describe('the form of the document', () => {
  it('number, legal entity, vendor, contract, currency (read only), the invoice number and date (editable in a draft)', () => {
    setDoc([header('d1', { vendorInvoiceNumber: 'INV-1', day: '2026-10-20' })]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(inputValue('vendor-invoice-field-number')).toBe('VI-d1');
    expect(inputValue('vendor-invoice-field-vendor')).toBe('Vendor d1');
    expect(inputValue('vendor-invoice-field-contract')).toBe('S-1 · Supply');
    expect(inputValue('vendor-invoice-field-currency')).toBe('EUR');
    expect(inputValue('vendor-invoice-field-invoiceNumber')).toBe('INV-1');
    expect(inputValue('vendor-invoice-field-invoiceDate')).toBe('2026-10-20');
    expect(readOnly('vendor-invoice-field-vendor')).toBe(true);
    expect(readOnly('vendor-invoice-field-invoiceNumber')).toBe(false);
    expect(mockSelects['vendor-invoice-field-legalEntity']).toMatchObject({ entityName: 'legalEntityReusable', value: 'le-1' });
  });
  it('a posted document: everything is read only (the legal entity is a text)', () => {
    setDoc([header('d1', { status: 'posted', vendorInvoiceNumber: 'INV-1', day: '2026-10-20' })]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(readOnly('vendor-invoice-field-invoiceNumber')).toBe(true);
    expect(readOnly('vendor-invoice-field-invoiceDate')).toBe(true);
    expect(inputValue('vendor-invoice-field-legalEntity')).toBe('Acme SIA');
  });
  it('the number and the date are saved a moment after the last key; a legal entity at once; an unreadable date is not saved', async () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    typeInto('vendor-invoice-field-invoiceNumber', 'INV-77');
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenCalledWith('d1', { vendorInvoiceNumber: 'INV-77' });
    typeInto('vendor-invoice-field-invoiceDate', 'soon');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenCalledTimes(1);
    expect(q('vendor-invoice-field-invoiceDate')!.getAttribute('aria-label')).toBe('error');
    typeInto('vendor-invoice-field-invoiceDate', '2026-10-20');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { vendorInvoiceDateTime: '2026-10-20T00:00:00.000Z' });
    act(() => mockSelects['vendor-invoice-field-legalEntity'].onChange('le-9'));
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { legalEntityGUID: 'le-9' });
  });
  it('what is missing before Post is told in a line', () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('vendor-invoice-missing')).toContain('number printed');
    expect(textOf('vendor-invoice-missing')).toContain('date of the vendor invoice');
    cleanupUI();
    setDoc([header('d1', { vendorInvoiceNumber: 'X', day: '2026-10-20' })]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(q('vendor-invoice-missing')).toBeNull();
  });
  it('the totals of the document: before VAT, VAT, with VAT (not the lines of another document)', () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(textOf('vendor-invoice-totals')).toContain('3 lines');
    expect(textOf('vendor-invoice-total-before')).toContain('31.1');
    expect(textOf('vendor-invoice-total-vat')).toContain('6.53');
    expect(textOf('vendor-invoice-total-with')).toContain('37.63');
  });
});

describe('DocumentTabs: All (default) · Time · Material · Expenses', () => {
  it('the order and the counts of lines', () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(qa('vendor-invoice-tab-').filter((id) => !id.endsWith('-count'))).toEqual(['vendor-invoice-tab-all', 'vendor-invoice-tab-timeGenus', 'vendor-invoice-tab-materialGenus', 'vendor-invoice-tab-expenseGenus']);
    expect(textOf('vendor-invoice-tab-all-count')).toBe('3');
    expect(textOf('vendor-invoice-tab-timeGenus-count')).toBe('1');
    expect(textOf('vendor-invoice-tab-materialGenus-count')).toBe('2');
    expect(q('vendor-invoice-tab-expenseGenus-count')).toBeNull();
  });
  it('All is open at the start and shows every line of the document; a tab filters to its genus', () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    const all = lastTable().rowFilter;
    expect(lines().filter(all).map((r) => r.rowGUID)).toEqual(['l1', 'l2', 'l3']);
    press('vendor-invoice-tab-materialGenus');
    expect(lines().filter(lastTable().rowFilter).map((r) => r.rowGUID)).toEqual(['l2', 'l3']);
    press('vendor-invoice-tab-all');
    expect(lines().filter(lastTable().rowFilter)).toHaveLength(3);
  });
});

describe('the table of the lines', () => {
  it('reads the lines of THIS document through the redux entity; no new lines (they come from the task lines)', () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ entityName: VENDOR_INVOICE_LINES_ENTITY, listOwnerGUID: '*', listParentGUID: '*', addEnabled: false, reorderEnabled: false, realtime: true });
    expect(lastTable().readParams).toEqual({ match: { rowHeaderGUID: 'd1' } });
  });
  it('DRAFT: update (qty, price, VAT %), delete, selection', () => {
    setDoc([header('d1')]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ crudPanelEnabled: true, contextMenuEnabled: true, selectionEnabled: true });
    const editable = lastTable().visualColumns.filter((c: any) => c.editable === true).map((c: any) => c.key);
    expect(editable).toEqual(['qty', 'price', 'vat']);
  });
  it('POSTED: read only - no panel, no menu, no selection, no editable cell', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<VendorInvoiceDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ crudPanelEnabled: false, contextMenuEnabled: false, selectionEnabled: false });
    expect(lastTable().visualColumns.filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
  });
  it('no document: no table, a message', () => {
    setDoc([]);
    renderUI(<VendorInvoiceDocumentForm documents={['dX']} />);
    expect(mockTable).not.toHaveBeenCalled();
    expect(textOf('vendor-invoice-empty')).toContain('not found');
  });
});
