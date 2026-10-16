/** @jest-environment jsdom */
// PMPurchaseOrderDocumentLines: the DocumentTabs All · Time · Material · Expenses with their counts, and how the ReusableTable of the lines is configured (draft / posted / independent input). The table is a fake.
import { cleanupUI, expectInOrder, press, q, renderUI, textOf } from '../../../pm/ui/pmUiTestKit';

const mockTable = jest.fn();
jest.mock('../../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
const Lines = require('../../../../kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentLines').default;
import React from 'react';
import { PurchaseOrderHeaderView } from '../../../../kit8/documents/vendor/purchase_order/purchaseOrderModel';

const header = (over: Partial<PurchaseOrderHeaderView> = {}): PurchaseOrderHeaderView => ({
  guid: 'd1', number: 'PO-00001', status: 'draft', purchaseOrderNumber: '', day: '', legalEntityGUID: 'le-1', legalEntityTitle: '', partnerGUID: 'vp-1', partnerTitle: '', contractGUID: null, contractInfo: '', currency: 'EUR', authorName: '', ...over,
});
const COLUMNS = [{ key: 'n', title: '#', type: 'rowNumber' }];
const view = (over: Record<string, any> = {}) => (
  <Lines header={header()} tab="all" onTab={jest.fn()} counts={{ all: 3, timeGenus: 1, materialGenus: 2, expenseGenus: 0 }} columns={COLUMNS} rowFilter={() => true} edit independent={false} multi={false} loading={false} onAddLine={jest.fn()} {...over} />
);
const lastTable = () => mockTable.mock.calls.at(-1)![0];
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('the four tabs in their order; the counts on the tabs that have lines', () => {
  renderUI(view());
  expectInOrder(['purchase-order-tab-all', 'purchase-order-tab-timeGenus', 'purchase-order-tab-materialGenus', 'purchase-order-tab-expenseGenus']);
  expect(textOf('purchase-order-tab-all-count')).toBe('3');
  expect(textOf('purchase-order-tab-materialGenus-count')).toBe('2');
  expect(q('purchase-order-tab-expenseGenus-count')).toBeNull();
  expect(q('purchase-order-tab-all')!.getAttribute('aria-selected')).toBe('true');
});

it('a press on a tab asks the form for that tab', () => {
  const onTab = jest.fn();
  renderUI(view({ onTab }));
  press('purchase-order-tab-timeGenus');
  expect(onTab).toHaveBeenCalledWith('timeGenus');
});

it('a DRAFT: the table is editable, its lines can be selected and deleted, but no line is added unless independent input is on', () => {
  renderUI(view());
  expect(lastTable()).toMatchObject({ entityName: 'purchaseOrderLinesReusable', crudPanelEnabled: true, contextMenuEnabled: true, selectionEnabled: true, addEnabled: false, realtime: true, visualColumns: COLUMNS });
  expect(lastTable().onAdd).toBeUndefined();
  expect(lastTable().readParams).toEqual({ match: { rowHeaderGUID: 'd1' } });
});

it('independent input: the + adds a line of the kind of the tab (All: Time) by the database', () => {
  const onAddLine = jest.fn();
  renderUI(view({ independent: true, onAddLine }));
  expect(lastTable().addEnabled).toBe(true);
  lastTable().onAdd();
  expect(onAddLine).toHaveBeenLastCalledWith('timeGenus');
  cleanupUI();
  renderUI(view({ independent: true, onAddLine, tab: 'materialGenus' }));
  lastTable().onAdd();
  expect(onAddLine).toHaveBeenLastCalledWith('materialGenus');
});

it('a POSTED document: the table is read only', () => {
  renderUI(view({ header: header({ status: 'posted' }), edit: false }));
  expect(lastTable()).toMatchObject({ crudPanelEnabled: false, contextMenuEnabled: false, selectionEnabled: false, addEnabled: false });
});

it('no document: the not found text; while loading: the loading text', () => {
  renderUI(view({ header: null }));
  expect(textOf('purchase-order-empty')).toBe('The purchase order was not found.');
  cleanupUI();
  renderUI(view({ header: null, loading: true }));
  expect(q('purchase-order-empty')).toBeNull();
});
