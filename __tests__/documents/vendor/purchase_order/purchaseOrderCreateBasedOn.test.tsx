/** @jest-environment jsdom */
// "Create based on → Product receipt" of a purchase order: the button of the form and the row menu of the list. Only a POSTED order offers it; the command is the one of kit8/documents/vendor/product_receipt.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf } from '../../../pm/ui/pmUiTestKit';

const mockDoc: Record<string, any> = {};
const mockToReceipt: Record<string, any> = {};
const mockAnswer: { current: any } = { current: null };
const mockTable = jest.fn();
const mockList = jest.fn();
jest.mock('../../../../kit8/documents/vendor/lineplace/useDocumentLineMenu', () => ({ useDocumentLineMenu: () => () => [{ testID: 'task-item', label: 'Open task', onPress: () => {} }] }));
jest.mock('../../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({
  usePurchaseOrderDocuments: () => mockDoc, usePurchaseOrderLinePlaces: () => ({}),
  usePurchaseOrderList: () => ({ answer: mockAnswer.current, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock('../../../../kit8/documents/vendor/product_receipt/useProductReceipt', () => ({ useCreateProductReceiptFromOrder: () => mockToReceipt }));
jest.mock('../../../../kit8/pm/view/task/finances/useTaskLineCatalogs', () => ({ useTaskLineCatalogs: () => require('../../../../kit8/pm/view/task/finances/taskLineCatalogs').emptyTaskLineCatalogs() }));
jest.mock('../../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, default: (p: any) => require('react').createElement('div', { 'data-testid': p.testID }), defaultTitleExtractor: () => '' }));
jest.mock('../../../../kit8/catalog/legal_entity/useLegalEntityData', () => ({ useLegalEntityData: () => ({ rows: [], countries: [], loaded: true, error: null }) }));
jest.mock('../../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
jest.mock('../../../../kit8/ui/components/common/ModalWindowListToSelect', () => ({ __esModule: true, default: (p: any) => { mockList(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../../kit8/ui/components/common/date_input/DateInputApp', () => ({ __esModule: true, default: ({ testID }: any) => require('react').createElement('div', { 'data-testid': testID }) }));
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => ({ __esModule: true, default: ({ testID }: any) => require('react').createElement('div', { 'data-testid': testID }) }));
const PMPurchaseOrderDocumentForm = require('../../../../kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentForm').default;
const PMPurchaseOrderDocumentList = require('../../../../kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentList').default;

const header = (over: Record<string, any> = {}) => ({
  guid: 'po1', number: 'PO-00001', status: 'draft', purchaseOrderNumber: 'ORD-5', day: '2026-10-18', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', contractInfo: 'S-1',
  currency: 'EUR', authorName: 'Anna', taskGUID: 't1', projectGUID: 'p1', projectName: 'Alpha', ...over,
});
const listRow = (guid: string, status: string) => ({
  documentGUID: guid, documentNumber: `PO-${guid}`, documentStatus: status, purchaseOrderNumber: '', purchaseOrderDateTime: null, purchaseOrderDay: null, legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: 'Acme',
  contractGUID: null, contractInfo: '', currency: 'EUR', folder: 'le-1:vp-1', taskGUID: 't1', projectGUID: 'p1', projectName: 'Alpha', independentInputAvailable: false, multiProject: false, multiProjectAvailable: false, authorGUID: '', authorName: '',
  lineCount: 1, sumBeforeVAT: 1, sumVAT: 0, sumWithVAT: 1,
});
beforeEach(() => {
  Object.keys(mockToReceipt).forEach((k) => delete mockToReceipt[k]);
  Object.assign(mockToReceipt, { create: jest.fn(async () => ({ documents: [{ documentGUID: 'r1', lineCount: 2 }], skipped: [] })), busy: false, error: null });
  mockAnswer.current = { totalCount: 2, totalsByCurrency: [], rows: [listRow('d1', 'draft'), listRow('d2', 'posted')] };
  (globalThis as any).__pmTestReduxState = { purchaseOrderLinesReusable: { entityDataFromServer: [{ rowGUID: 'l1', rowHeaderGUID: 'po1', genusGUID: 'timeGenus' }] }, partnerReusable: { entityDataFromServer: [] }, contractReusable: { entityDataFromServer: [] } };
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; });
const setDoc = (h: any) => { Object.keys(mockDoc).forEach((k) => delete mockDoc[k]); Object.assign(mockDoc, { headers: [h], isLoading: false, error: null, busy: false, setHeader: jest.fn(), post: jest.fn(), unpost: jest.fn(), remove: jest.fn(), addLine: jest.fn(), setLineTask: jest.fn(), refetch: jest.fn() }); };
const lastList = () => mockList.mock.calls.filter((c) => c[0].testID === 'purchase-order-create-based-on-list').at(-1)![0];

describe('the form', () => {
  it('a DRAFT has no "Create based on"; a POSTED order has it', () => {
    setDoc(header());
    renderUI(<PMPurchaseOrderDocumentForm documents={['po1']} />);
    expect(q('purchase-order-create-based-on')).toBeNull();
    cleanupUI();
    setDoc(header({ status: 'posted' }));
    renderUI(<PMPurchaseOrderDocumentForm documents={['po1']} />);
    expect(q('purchase-order-create-based-on')).not.toBeNull();
  });
  it('the button opens the list window with ONE item, the product receipt; choosing it makes the receipt of THIS order', async () => {
    setDoc(header({ status: 'posted' }));
    renderUI(<PMPurchaseOrderDocumentForm documents={['po1']} />);
    press('purchase-order-create-based-on');
    expect(lastList().visible).toBe(true);
    expect(lastList().items.map((i: any) => i.id)).toEqual(['productReceipt']);
    await act(async () => { lastList().onSelect('productReceipt'); });
    expect(mockToReceipt.create).toHaveBeenCalledWith('po1');
    expect(lastList().visible).toBe(false);
  });
  it('everything is already received: the form says so; an error of the database is shown', async () => {
    mockToReceipt.create = jest.fn(async () => ({ documents: [], skipped: [{ reason: 'nothingLeftToReceive' }] }));
    setDoc(header({ status: 'posted' }));
    renderUI(<PMPurchaseOrderDocumentForm documents={['po1']} />);
    press('purchase-order-create-based-on');
    await act(async () => { lastList().onSelect('productReceipt'); });
    expect(textOf('purchase-order-notice')).toBe('Everything ordered is already on a product receipt.');
    cleanupUI();
    mockToReceipt.error = 'boom';
    renderUI(<PMPurchaseOrderDocumentForm documents={['po1']} />);
    expect(textOf('purchase-order-create-error')).toBe('boom');
  });
});

describe('the list', () => {
  const menu = (guid: string) => { const close = jest.fn(); return { items: mockTable.mock.calls.at(-1)![0].extraMenuItems({ rowGUID: guid }, close), close }; };
  it('a POSTED order: "Create based on" → Product receipt (first), then the Task items; choosing it makes the receipt', async () => {
    renderUI(<PMPurchaseOrderDocumentList />);
    const { items, close } = menu('d2');
    expect(items.map((i: any) => i.label)).toEqual(['Create based on', 'Open task']);
    expect(items[0].submenu.map((i: any) => i.label)).toEqual(['Product receipt']);
    await act(async () => { items[0].submenu[0].onPress(); });
    expect(close).toHaveBeenCalled();
    expect(mockToReceipt.create).toHaveBeenCalledWith('d2');
  });
  it('a DRAFT order has no "Create based on"', () => {
    renderUI(<PMPurchaseOrderDocumentList />);
    expect(menu('d1').items.map((i: any) => i.label)).toEqual(['Open task']);
  });
});
