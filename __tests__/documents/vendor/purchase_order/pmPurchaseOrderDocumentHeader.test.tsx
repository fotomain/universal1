/** @jest-environment jsdom */
// PMPurchaseOrderDocumentHeader: the fields of the header of a purchase order (number, project with the chevron, legal entity, vendor, contract, currency, order number, date, totals): what is editable in a draft
// and what is only shown in a posted document. The inputs are fakes that tell whether they are disabled.
import { cleanupUI, press, q, renderUI, textOf, typeInto } from '../../../pm/ui/pmUiTestKit';

jest.mock('../../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, disabled, error }: any) => R.createElement(TextInput, { testID, value, onChangeText, editable: !disabled, accessibilityLabel: error ? 'error' : undefined }) };
});
const mockSelects: Record<string, any> = {};
jest.mock('../../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); }, defaultTitleExtractor: () => '' }));
jest.doMock('../../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  const TextInputApp = ({ testID, value, disabled, onChangeText, label }: any) => R.createElement(TextInput, { testID, value, editable: !disabled, onChangeText, accessibilityLabel: label });
  return { __esModule: true, default: TextInputApp, TextInputApp };
});
const Header = require('../../../../kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentHeader').default;
import React from 'react';
import { PurchaseOrderHeaderView } from '../../../../kit8/documents/vendor/purchase_order/purchaseOrderModel';

const header = (over: Partial<PurchaseOrderHeaderView> = {}): PurchaseOrderHeaderView => ({
  guid: 'd1', number: 'PO-00001', status: 'draft', purchaseOrderNumber: '', day: '', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: 'Acme Supplies', contractGUID: 'vc-1', contractInfo: 'S-1 · Supply',
  currency: 'EUR', authorName: 'Anna', projectName: 'Project 1', ...over,
});
const totals = { lineCount: 3, sumBeforeVAT: 31.1, sumVAT: 6.53, sumWithVAT: 37.63 };
const setHeader = jest.fn(async () => true);
const view = (h: PurchaseOrderHeaderView, over: Record<string, any> = {}) => (
  <Header header={h} edit={h.status === 'draft'} multi={false} number="" day="" dayError={false} onNumber={jest.fn()} onDay={jest.fn()} totals={totals} setHeader={setHeader} onOpenModeMenu={jest.fn()} {...over} />
);
const readOnly = (id: string) => { const el = q(id) as HTMLInputElement; return el.readOnly || el.disabled; };
afterEach(() => { cleanupUI(); jest.clearAllMocks(); Object.keys(mockSelects).forEach((k) => delete mockSelects[k]); });

it('shows the document number, the project, the currency and the totals; the number of the document and the currency are never editable', () => {
  renderUI(view(header()));
  expect((q('purchase-order-field-number') as HTMLInputElement).value).toBe('PO-00001');
  expect((q('purchase-order-field-project') as HTMLInputElement).value).toBe('Project 1');
  expect((q('purchase-order-field-currency') as HTMLInputElement).value).toBe('EUR');
  expect(readOnly('purchase-order-field-number')).toBe(true);
  expect(readOnly('purchase-order-field-project')).toBe(true);
  expect(readOnly('purchase-order-field-currency')).toBe(true);
  expect(textOf('purchase-order-total-before')).toContain('31.10');
  expect(textOf('purchase-order-total-vat')).toContain('6.53');
  expect(textOf('purchase-order-total-with')).toContain('37.63');
});

it('a DRAFT: the legal entity, the vendor and the contract are catalog selects that save at once (a new vendor does not send a contract)', () => {
  renderUI(view(header()));
  mockSelects['purchase-order-field-legalEntity'].onChange('le-2');
  expect(setHeader).toHaveBeenLastCalledWith('d1', { legalEntityGUID: 'le-2' });
  mockSelects['purchase-order-field-vendor'].onChange('vp-2');
  expect(setHeader).toHaveBeenLastCalledWith('d1', { purchaseOrderPartner: 'vp-2' });
  mockSelects['purchase-order-field-contract'].onChange('vc-3');
  expect(setHeader).toHaveBeenLastCalledWith('d1', { purchaseOrderContract: 'vc-3' });
  mockSelects['purchase-order-field-vendor'].onChange(null);
  expect(setHeader).toHaveBeenLastCalledWith('d1', { purchaseOrderPartner: '' });
  expect(mockSelects['purchase-order-field-contract'].rowOwnerGUID).toBe('vp-1');           // the contracts of THIS vendor
});

it('a draft without a vendor: the contract select is disabled until a vendor is chosen', () => {
  renderUI(view(header({ partnerGUID: '', contractGUID: null, partnerTitle: '' })));
  expect(mockSelects['purchase-order-field-contract'].disabled).toBe(true);
});

it('a POSTED document: the fields are plain texts (nothing to change)', () => {
  renderUI(view(header({ status: 'posted' })));
  for (const f of ['legalEntity', 'vendor', 'contract', 'orderNumber', 'orderDate']) expect(q(`purchase-order-field-${f}`)).not.toBeNull();
  expect(mockSelects['purchase-order-field-vendor']).toBeUndefined();
  expect(readOnly('purchase-order-field-vendor')).toBe(true);
  expect(readOnly('purchase-order-field-orderNumber')).toBe(true);
  expect(readOnly('purchase-order-field-orderDate')).toBe(true);
  expect((q('purchase-order-field-vendor') as HTMLInputElement).value).toBe('Acme Supplies');
});

it('the order number and the date are typed here: the form gets the text', () => {
  const onNumber = jest.fn();
  const onDay = jest.fn();
  renderUI(view(header(), { onNumber, onDay, number: 'ORD-5', day: '2026-10-18' }));
  expect((q('purchase-order-field-orderNumber') as HTMLInputElement).value).toBe('ORD-5');
  typeInto('purchase-order-field-orderNumber', 'ORD-6');
  expect(onNumber).toHaveBeenCalledWith('ORD-6');
  typeInto('purchase-order-field-orderDate', '20261019');
  expect(onDay).toHaveBeenCalledWith('20261019');
});

it('the chevron next to the Project field (only when the project setting offers Multi Project) asks the form to open the mode menu', () => {
  const onOpenModeMenu = jest.fn();
  renderUI(view(header(), { onOpenModeMenu }));
  expect(q('purchase-order-project-mode')).toBeNull();
  cleanupUI();
  renderUI(view(header({ multiProjectAvailable: true }), { onOpenModeMenu }));
  press('purchase-order-project-mode');
  expect(onOpenModeMenu).toHaveBeenCalled();
  cleanupUI();
  renderUI(view(header({ multiProjectAvailable: true, status: 'posted' }), { onOpenModeMenu }));
  expect(q('purchase-order-project-mode')).toBeNull();
});

it('Multi Project: the label of the Project field says it', () => {
  renderUI(view(header({ multiProject: true }), { multi: true }));
  expect((q('purchase-order-field-project') as HTMLInputElement).getAttribute('aria-label')).toBe('Project · Multi Project');
});
