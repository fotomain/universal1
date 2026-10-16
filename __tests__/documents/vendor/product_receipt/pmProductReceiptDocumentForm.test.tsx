/** @jest-environment jsdom */
// PMProductReceiptDocumentForm: the bar (Post is the LAST, a large button; "Create based on" only for a POSTED receipt), the header (the purchase order it came from), a TAB for each document, the DocumentTabs with their
// counts, the totals, "Create based on → Vendor invoice", and how the ReusableTable of the lines is configured in a draft and in a posted document. The data hooks and the table are fakes.
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, press, q, qa, renderUI, textOf, typeInto, wait } from '../../../pm/ui/pmUiTestKit';

const mockDoc: Record<string, any> = {};
const mockToInvoice: Record<string, any> = {};
const mockLineMenu = jest.fn(() => []);
jest.mock('../../../../kit8/documents/vendor/lineplace/useDocumentLineMenu', () => ({ useDocumentLineMenu: () => mockLineMenu }));
jest.mock('../../../../kit8/documents/vendor/product_receipt/useProductReceipt', () => ({
  useProductReceiptDocuments: () => mockDoc, useProductReceiptLinePlaces: () => ({}), useCreateVendorInvoiceFromReceipt: () => mockToInvoice,
}));
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
// the list window of "Create based on": a fake that shows what it was asked and lets the test choose
const mockList = jest.fn();
jest.mock('../../../../kit8/ui/components/common/ModalWindowListToSelect', () => ({ __esModule: true, default: (p: any) => { mockList(p); return require('react').createElement('div', { 'data-testid': p.testID, 'data-visible': String(!!p.visible) }); } }));
jest.doMock('../../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  const TextInputApp = ({ testID, value, disabled, onChangeText, label }: any) => R.createElement(TextInput, { testID, value, editable: !disabled, onChangeText, accessibilityLabel: label });
  return { __esModule: true, default: TextInputApp, TextInputApp };
});
const PMProductReceiptDocumentForm = require('../../../../kit8/documents/vendor/product_receipt/PMProductReceiptDocumentForm').default;
import { PRODUCT_RECEIPT_LINES_ENTITY, ProductReceiptHeaderView } from '../../../../kit8/documents/vendor/product_receipt/productReceiptModel';

const T = 'product-receipt';
const header = (guid: string, over: Partial<ProductReceiptHeaderView> = {}): ProductReceiptHeaderView => ({
  guid, number: `PR-${guid}`, status: 'draft', productReceiptNumber: '', day: '', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: `Vendor ${guid}`, contractGUID: 'vc-1', contractInfo: 'S-1 · Supply',
  currency: 'EUR', authorName: 'Anna', taskGUID: 't1', projectGUID: 'p1', projectName: 'Alpha', purchaseOrderGUID: 'po1', purchaseOrderDocument: 'PO-00001', purchaseOrderNumber: 'ORD-5', ...over,
});
const lines = (): any[] => [
  { rowGUID: 'l1', rowHeaderGUID: 'd1', genusGUID: 'timeGenus', sumForContract: '10.10', vatForContract: '2.12' },
  { rowGUID: 'l2', rowHeaderGUID: 'd1', genusGUID: 'materialGenus', sumForContract: '20', vatForContract: '4.2' },
  { rowGUID: 'l3', rowHeaderGUID: 'd1', genusGUID: 'materialGenus', sumForContract: '1', vatForContract: '0.21' },
  { rowGUID: 'x1', rowHeaderGUID: 'd2', genusGUID: 'timeGenus', sumForContract: 1000, vatForContract: 1000 },
];
function setDoc(headers: ProductReceiptHeaderView[], over: Record<string, any> = {}, rows: any[] = lines()) {
  Object.keys(mockDoc).forEach((k) => delete mockDoc[k]);
  Object.assign(mockDoc, {
    headers, isLoading: false, error: null, busy: false,
    setHeader: jest.fn(async () => true), post: jest.fn(async () => ({ status: 'posted', lines: 3, problems: [] })), unpost: jest.fn(async () => ({ status: 'draft', lines: 0, problems: [] })), remove: jest.fn(async () => true), addLine: jest.fn(async () => true), refetch: jest.fn(), ...over,
  });
  (globalThis as any).__pmTestReduxState = { [PRODUCT_RECEIPT_LINES_ENTITY]: { entityDataFromServer: rows } };
}
const readOnly = (id: string) => { const el = q(id) as HTMLInputElement; return el.readOnly || el.disabled; };
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const lastList = () => mockList.mock.calls.at(-1)![0];
const flush = () => act(async () => { await Promise.resolve(); });
beforeEach(() => {
  Object.keys(mockToInvoice).forEach((k) => delete mockToInvoice[k]);
  Object.assign(mockToInvoice, { create: jest.fn(async () => ({ documents: [{ documentGUID: 'v1', lineCount: 2 }], skipped: [] })), busy: false, error: null });
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; Object.keys(mockButtons).forEach((k) => delete mockButtons[k]); Object.keys(mockSelects).forEach((k) => delete mockSelects[k]); });

describe('the bar', () => {
  it('Delete · Close, and Post is the LAST - a large button; a draft has no "Create based on"', () => {
    setDoc([header('d1')]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expectInOrder([`${T}-delete`, `${T}-close`, `${T}-post`]);
    expect(mockButtons[`${T}-post`].size).toBe('large');
    expect(q(`${T}-create-based-on`)).toBeNull();
  });
  it('a posted document: Unpost, "Create based on", Close and the large Posted button (nothing to press), no Post, no Delete', () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} onClose={jest.fn()} />);
    expectInOrder([`${T}-unpost`, `${T}-create-based-on`, `${T}-close`, `${T}-posted`]);
    expect(mockButtons[`${T}-posted`]).toMatchObject({ size: 'large', icon: 'check' });
    expect(q(`${T}-post`)).toBeNull();
    expect(q(`${T}-delete`)).toBeNull();
  });
  it('a draft without lines cannot be posted', () => {
    setDoc([header('d1')], {}, []);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(q(`${T}-post`)).toBeNull();
  });
  it('the title and the subtitle: the vendor, the number of the document, the contract, the currency', () => {
    setDoc([header('d1')]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-title`)).toBe('Product receipt · Vendor d1');
    expect(textOf(`${T}-subtitle`)).toBe('PR-d1 · S-1 · Supply · EUR');
  });
  it('Post / Unpost / Delete / Close call their commands; a refusal lists the problems', async () => {
    const onClose = jest.fn();
    setDoc([header('d1')], { post: jest.fn(async () => ({ status: 'refused', lines: 3, problems: [{ lineGUID: null, problem: 'receiptNumberMissing' }, { lineGUID: 'l1', problem: 'quantityIsZero' }] })) });
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} onClose={onClose} />);
    press(`${T}-post`);
    await flush();
    expect(mockDoc.post).toHaveBeenCalledWith('d1');
    expect(textOf(`${T}-problems`)).toContain('The document was not posted');
    expect(textOf(`${T}-problem-0`)).toContain('number of the product receipt');
    expect(textOf(`${T}-problem-1`)).toContain('quantity 0');
    press(`${T}-close`);
    expect(onClose).toHaveBeenCalled();
    press(`${T}-delete`);
    await flush();
    expect(mockDoc.remove).toHaveBeenCalledWith('d1');
    expect(onClose).toHaveBeenCalledTimes(2);
    cleanupUI();
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    press(`${T}-unpost`);
    await flush();
    expect(mockDoc.unpost).toHaveBeenCalledWith('d1');
  });
});

describe('Create based on → Vendor invoice', () => {
  it('the button opens the list window with ONE item, the vendor invoice; choosing it makes the invoice of THIS receipt with its task', async () => {
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(lastList().visible).toBe(false);
    press(`${T}-create-based-on`);
    expect(lastList().visible).toBe(true);
    expect(lastList().items.map((i: any) => i.id)).toEqual(['vendorInvoice']);
    await act(async () => { lastList().onSelect('vendorInvoice'); });
    expect(mockToInvoice.create).toHaveBeenCalledWith('d1', { taskGUID: 't1', projectGUID: 'p1' });
    expect(lastList().visible).toBe(false);
  });
  it('nothing left to invoice: the form says why, nothing opens', async () => {
    mockToInvoice.create = jest.fn(async () => ({ documents: [], skipped: [{ reason: 'nothingLeftToInvoice' }] }));
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    press(`${T}-create-based-on`);
    await act(async () => { lastList().onSelect('vendorInvoice'); });
    expect(textOf(`${T}-notice`)).toBe('Everything received is already on a vendor invoice.');
  });
  it('an error of the database is shown', () => {
    mockToInvoice.error = 'post the product receipt first';
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-create-error`)).toBe('post the product receipt first');
  });
});

describe('the header', () => {
  it('shows the purchase order the receipt was made from (the number printed on it, else the system number) - read only', () => {
    setDoc([header('d1')]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(inputValue(`${T}-field-purchaseOrder`)).toBe('ORD-5');
    expect(readOnly(`${T}-field-purchaseOrder`)).toBe(true);
    cleanupUI();
    setDoc([header('d1', { purchaseOrderNumber: '' })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(inputValue(`${T}-field-purchaseOrder`)).toBe('PO-00001');
  });
  it('a draft: the legal entity, the vendor and the contract are selects, the number and the date are typed; a posted document is read only', () => {
    setDoc([header('d1')]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(Object.keys(mockSelects)).toEqual(expect.arrayContaining([`${T}-field-legalEntity`, `${T}-field-vendor`, `${T}-field-contract`]));
    expect(readOnly(`${T}-field-receiptNumber`)).toBe(false);
    expect(readOnly(`${T}-field-number`)).toBe(true);
    cleanupUI();
    setDoc([header('d1', { status: 'posted', productReceiptNumber: 'GRN-1' })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(readOnly(`${T}-field-receiptNumber`)).toBe(true);
    expect(inputValue(`${T}-field-vendor`)).toBe('Vendor d1');
  });
  it('the number of the receipt is saved a moment after the last key; a valid date too, a bad one never', async () => {
    setDoc([header('d1')]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    typeInto(`${T}-field-receiptNumber`, 'GRN-7');
    typeInto(`${T}-field-receiptDate`, '20261020');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { productReceiptDateTime: '2026-10-20T00:00:00.000Z' });
    typeInto(`${T}-field-receiptNumber`, 'GRN-8');
    await wait(600);
    expect(mockDoc.setHeader).toHaveBeenLastCalledWith('d1', { productReceiptNumber: 'GRN-8' });
    mockDoc.setHeader.mockClear();
    typeInto(`${T}-field-receiptDate`, '99999999');
    await wait(600);
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
  });
  it('the totals of the lines of the open document only', () => {
    setDoc([header('d1')]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-total-before`)).toContain('31.10');
    expect(textOf(`${T}-total-vat`)).toContain('6.53');
    expect(textOf(`${T}-total-with`)).toContain('37.63');
  });
});

describe('documents and lines', () => {
  it('a tab for each document; a click selects it and the table follows', () => {
    setDoc([header('d1'), header('d2')]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1', 'd2']} />);
    expect(qa(`${T}-document-`).filter((id) => !id.endsWith('browser-tab'))).toEqual([`${T}-document-d1`, `${T}-document-d2`]);
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'timeGenus' })).toBe(true);
    press(`${T}-document-d2`);
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'timeGenus' })).toBe(false);
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd2', genusGUID: 'timeGenus' })).toBe(true);
  });
  it('the tabs All · Time · Material · Expenses with their counts; a tab filters the table', () => {
    setDoc([header('d1')]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(textOf(`${T}-tab-all-count`)).toBe('3');
    expect(textOf(`${T}-tab-materialGenus-count`)).toBe('2');
    expect(q(`${T}-tab-expenseGenus-count`)).toBeNull();
    press(`${T}-tab-materialGenus`);
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'timeGenus' })).toBe(false);
    expect(lastTable().rowFilter({ rowHeaderGUID: 'd1', genusGUID: 'materialGenus' })).toBe(true);
  });
  it('the table: a draft is edited (quantity, price, VAT %), a posted one is read only; the lines are read by the header of the document', () => {
    setDoc([header('d1', { independentInputAvailable: false })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ entityName: PRODUCT_RECEIPT_LINES_ENTITY, readParams: { match: { rowHeaderGUID: 'd1' } }, crudPanelEnabled: true, addEnabled: false, reorderEnabled: false });
    const qty = lastTable().visualColumns.find((c: any) => c.key === 'qty');
    expect(qty).toMatchObject({ target: 'qtyReceived', editable: true });
    cleanupUI();
    setDoc([header('d1', { status: 'posted' })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(lastTable()).toMatchObject({ crudPanelEnabled: false, contextMenuEnabled: false });
    expect(lastTable().visualColumns.find((c: any) => c.key === 'qty').editable).toBe(false);
  });
  it('independent input (the project setting): a + adds a line of the kind of the tab', () => {
    setDoc([header('d1', { independentInputAvailable: true })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    expect(lastTable().addEnabled).toBe(true);
    press(`${T}-tab-expenseGenus`);
    lastTable().onAdd();
    expect(mockDoc.addLine).toHaveBeenCalledWith('d1', 'expenseGenus');
  });
  it('a Multi Project receipt (copied from the order) shows the project / task / task line columns, read only', () => {
    setDoc([header('d1', { multiProject: true })]);
    renderUI(<PMProductReceiptDocumentForm documents={['d1']} />);
    const keys = lastTable().visualColumns.map((c: any) => c.key);
    expect(keys.slice(0, 4)).toEqual(['n', 'productReceiptLineProject', 'productReceiptTaskGUID', 'productReceiptTaskLineGUID']);
    expect(q(`${T}-project-mode`)).toBeNull();
    expect(inputValue(`${T}-field-project`)).toBe('Alpha');
  });
  it('the document is not found: the text says so', () => {
    setDoc([]);
    renderUI(<PMProductReceiptDocumentForm documents={['nope']} />);
    expect(textOf(`${T}-empty`)).toBe('The product receipt was not found.');
  });
});
