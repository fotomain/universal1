/** @jest-environment jsdom */
// VendorInvoiceChoose ("Vendor Invoice" of the context menu): the vendors of the lines, a check box each, the legal entity when a checked contract has none, Create → one document per vendor + contract
// → the form opens with a tab for each document (and a browser tab of its own on the web).
import { act } from 'react';
import { cleanupUI, press, q, qa, renderUI, textOf } from '../ui/pmUiTestKit';

const mockCand: Record<string, any> = {};
const mockCreate = jest.fn();
jest.mock('../../../kit8/pm/vendor_invoice/useVendorInvoice', () => ({
  useVendorCandidates: () => mockCand,
  useCreateVendorInvoices: () => ({ create: (...a: any[]) => mockCreate(...a), busy: false, error: (globalThis as any).__createError ?? null }),
}));
const mockReplace = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => false, navigate: jest.fn() }) }));
const mockSelects: Record<string, any> = {};
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); }, defaultTitleExtractor: () => '' }));

const VendorInvoiceChoose = require('../../../kit8/pm/vendor_invoice/VendorInvoiceChoose').default;
import { VendorCandidate } from '../../../kit8/pm/vendor_invoice/vendorInvoiceModel';

const cand = (over: Partial<VendorCandidate> = {}): VendorCandidate => ({ partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', contractInfo: 'S-1 · Supply', contractCurrency: 'EUR', legalEntityGUID: 'le-1', lineCount: 2, lineGUIDs: ['l1', 'l2'], ...over });
const K = (c: VendorCandidate) => `${c.partnerGUID}|${c.contractGUID ?? ''}`;
function setCand(rows: VendorCandidate[], over: Record<string, any> = {}) {
  Object.keys(mockCand).forEach((k) => delete mockCand[k]);
  Object.assign(mockCand, { rows, skipped: 0, isLoading: false, error: null, refetch: jest.fn(), ...over });
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
beforeEach(() => { mockCreate.mockResolvedValue({ documents: [{ documentGUID: 'n1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2 }], skipped: [] }); (globalThis as any).__createError = null; });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('one row per (vendor, contract), all checked at the start: the vendor, the contract info, the currency, the lines', () => {
  const rows = [cand(), cand({ contractGUID: 'vc-2', contractInfo: 'S-2', contractCurrency: 'USD', lineCount: 1, lineGUIDs: ['l3'] }), cand({ partnerGUID: 'vp-2', partnerTitle: 'Beta', contractGUID: null, contractInfo: null, contractCurrency: null, legalEntityGUID: null, lineCount: 1, lineGUIDs: ['l4'] })];
  setCand(rows);
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  expect(qa('vendor-choose-row-')).toEqual(rows.map((r) => `vendor-choose-row-${K(r)}`));
  expect(textOf(`vendor-choose-row-${K(rows[0])}`)).toContain('Acme');
  expect(textOf(`vendor-choose-row-${K(rows[0])}`)).toContain('S-1 · Supply · EUR');
  expect(textOf(`vendor-choose-row-${K(rows[2])}`)).toContain('no contract');
  expect(textOf(`vendor-choose-row-${K(rows[2])}`)).toContain('1 lines');
  rows.forEach((r) => expect(q(`vendor-choose-row-${K(r)}`)!.getAttribute('aria-checked')).toBe('true'));
});

it('Create makes ONE document for each CHECKED pair - unchecked ones are not made', async () => {
  const rows = [cand(), cand({ contractGUID: 'vc-2', lineGUIDs: ['l3'], lineCount: 1 })];
  setCand(rows);
  renderUI(<VendorInvoiceChoose taskGUID="t1" projectGUID="p1" />);
  press(`vendor-choose-row-${K(rows[1])}`);                                 // uncheck S-2
  expect(q(`vendor-choose-row-${K(rows[1])}`)!.getAttribute('aria-checked')).toBe('false');
  press('vendor-choose-create');
  await flush();
  expect(mockCreate).toHaveBeenCalledWith('t1', [{ partnerGUID: 'vp-1', contractGUID: 'vc-1', lineGUIDs: ['l1', 'l2'] }], null);
});

it('nothing checked: Create is not available', () => {
  const rows = [cand()];
  setCand(rows);
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  press(`vendor-choose-row-${K(rows[0])}`);
  press('vendor-choose-create');
  expect(mockCreate).not.toHaveBeenCalled();
});

it('the legal entity is asked ONLY when a checked contract has none; Create waits for it', async () => {
  const rows = [cand(), cand({ contractGUID: 'vc-2', legalEntityGUID: null, lineGUIDs: ['l3'], lineCount: 1 })];
  setCand(rows);
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  expect(q('vendor-choose-legalEntity')).not.toBeNull();
  press('vendor-choose-create');
  await flush();
  expect(mockCreate).not.toHaveBeenCalled();                                // no legal entity chosen yet
  act(() => mockSelects['vendor-choose-legalEntity'].onChange('le-9'));
  press('vendor-choose-create');
  await flush();
  expect(mockCreate).toHaveBeenCalledWith('t1', expect.arrayContaining([expect.objectContaining({ contractGUID: 'vc-2' })]), 'le-9');
  cleanupUI();
  setCand([cand()]);
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  expect(q('vendor-choose-legalEntity')).toBeNull();
});

it('ONE document: the form opens on it', async () => {
  setCand([cand()]);
  renderUI(<VendorInvoiceChoose taskGUID="t1" projectGUID="p1" />);
  press('vendor-choose-create');
  await flush();
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice', params: { taskGUID: 't1', projectGUID: 'p1', documentGUID: 'n1', documents: 'n1' } });
});

it('SEVERAL documents: the form opens with a tab for each, and (web) the others open in browser tabs of their own', async () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  mockCreate.mockResolvedValue({ documents: [{ documentGUID: 'n1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2 }, { documentGUID: 'n2', partnerGUID: 'vp-1', contractGUID: 'vc-2', lineCount: 1 }, { documentGUID: 'n3', partnerGUID: 'vp-2', contractGUID: null, lineCount: 1 }], skipped: [] });
  setCand([cand(), cand({ contractGUID: 'vc-2' })]);
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  press('vendor-choose-create');
  await flush();
  expect(mockReplace.mock.calls[0][0].params).toMatchObject({ documentGUID: 'n1', documents: 'n1,n2,n3' });
  expect(open.mock.calls.map((c) => c[0])).toEqual(['/pm/project/task/vendor-invoice?documentGUID=n2', '/pm/project/task/vendor-invoice?documentGUID=n3']);
  expect(open.mock.calls.every((c) => c[1] === '_blank')).toBe(true);
  open.mockRestore();
});

it('nothing left to invoice: a message and no navigation', async () => {
  mockCreate.mockResolvedValue({ documents: [], skipped: [{ partnerGUID: 'vp-1', contractGUID: 'vc-1', reason: 'nothingLeftToInvoice' }] });
  const refetch = jest.fn();
  setCand([cand()], { refetch });
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  press('vendor-choose-create');
  await flush();
  expect(textOf('vendor-choose-notice')).toContain('Nothing is left to invoice');
  expect(mockReplace).not.toHaveBeenCalled();
  expect(refetch).toHaveBeenCalled();
});

it('a failure of the database is shown; no navigation', async () => {
  mockCreate.mockResolvedValue(null);
  (globalThis as any).__createError = 'choose the legal entity of the invoice (the contract has none)';
  setCand([cand()]);
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  press('vendor-choose-create');
  await flush();
  expect(textOf('vendor-choose-create-error')).toContain('choose the legal entity');
  expect(mockReplace).not.toHaveBeenCalled();
});

it('nothing at all (no vendor row, no line without a vendor): it says where a vendor comes from', () => {
  setCand([], { skipped: 0, skippedLineGUIDs: [] });
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  expect(textOf('vendor-choose-empty')).toContain('Main vendor');
});

it('lines WITHOUT a vendor are one more row ("No vendor"), checked at the start: Create makes a document with partnerGUID null', async () => {
  setCand([cand()], { skipped: 2, skippedLineGUIDs: ['n1', 'n2'] });
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  expect(q('vendor-choose-empty')).toBeNull();
  expect(q('vendor-choose-row-noVendor')!.getAttribute('aria-checked')).toBe('true');
  expect(textOf('vendor-choose-row-noVendor')).toContain('No vendor');
  expect(textOf('vendor-choose-row-noVendor')).toContain('2 lines');
  press('vendor-choose-create');
  await flush();
  expect(mockCreate).toHaveBeenCalledWith('t1', [expect.objectContaining({ partnerGUID: 'vp-1' }), { partnerGUID: null, contractGUID: null, lineGUIDs: ['n1', 'n2'] }], null);
});

it('only lines without a vendor: the window is not empty and needs no legal entity; unchecked = not made', async () => {
  setCand([], { skipped: 2, skippedLineGUIDs: ['n1', 'n2'] });
  renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  expect(q('vendor-choose-legalEntity')).toBeNull();
  press('vendor-choose-row-noVendor');
  expect(q('vendor-choose-create')).not.toBeNull();
  press('vendor-choose-create');
  await flush();
  expect(mockCreate).not.toHaveBeenCalled();
});

it('the vendors are all checked again when the list changes (a refresh)', () => {
  const rows = [cand()];
  setCand(rows);
  const view = renderUI(<VendorInvoiceChoose taskGUID="t1" />);
  press(`vendor-choose-row-${K(rows[0])}`);
  expect(q(`vendor-choose-row-${K(rows[0])}`)!.getAttribute('aria-checked')).toBe('false');
  setCand([cand(), cand({ contractGUID: 'vc-2' })]);
  view.rerender(<VendorInvoiceChoose taskGUID="t1" />);
  qa('vendor-choose-row-').forEach((id) => expect(q(id)!.getAttribute('aria-checked')).toBe('true'));
});
