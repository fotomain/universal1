/** @jest-environment jsdom */
// "Facts input" is offered where a task GUID (the row menu of the task tree) is known; it opens the route of the fact document with the GUID. The
// right-click menu of the lines of the Finances table has the same item (PMProjectTaskFinancesCRUD: extraMenuItems → useOpenFactInput; its screen test is taskFinancesUi).
import { act } from 'react';
import { cleanupUI, fakeCrud, press, q, qa, renderUI, seedStore } from '../../../pm/ui/pmUiTestKit';

const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));

// "Vendor Invoice" CREATES the invoice(s) of the whole task (useStartVendorInvoice; its own tests: vendorInvoice/useVendorInvoice.test.tsx)
const mockStartVendorInvoice = jest.fn();
jest.doMock('../../../../kit8/documents/vendor/invoice/useVendorInvoice', () => ({ useStartVendorInvoice: () => ({ start: mockStartVendorInvoice, busy: false }) }));
const mockStartPurchaseOrder = jest.fn();
jest.doMock('../../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({ useStartPurchaseOrder: () => ({ start: mockStartPurchaseOrder, busy: false }) }));

const PMTaskRowMenu = require('../../../../kit8/pm/view/task/PMTaskRowMenu').default;
const { useOpenFactInput } = require('../../../../kit8/documents/fact/input/useOpenFactInput');
import React from 'react';
import { usePMStore } from '../../../../kit8/pm/store/store_pm';
import { FACT_INPUT_ROUTE } from '../../../../kit8/documents/fact/input/factInputModel';

afterEach(() => { cleanupUI(); jest.clearAllMocks(); act(() => usePMStore.getState().setRowMenu(null)); });

describe('the row menu of the task tree', () => {
  it('a task has "Facts input"; it closes the menu and opens the document of the task', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    act(() => usePMStore.getState().setRowMenu({ guid: task.rowGUID, x: 10, y: 10, source: 'tree' }));
    press('pm-row-menu-facts-input');
    expect(mockPush).toHaveBeenCalledWith({ pathname: FACT_INPUT_ROUTE, params: { taskGUID: task.rowGUID } });
    expect(usePMStore.getState().rowMenu).toBeNull();
  });
  it('a stage has no lines, so no facts', () => {
    const { byName } = seedStore();
    const stage = byName('Stage 1');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    act(() => usePMStore.getState().setRowMenu({ guid: stage.rowGUID, x: 10, y: 10, source: 'tree' }));
    expect(q('pm-row-menu')).not.toBeNull();
    expect(q('pm-row-menu-facts-input')).toBeNull();
  });
});

describe('"Vendor Invoice" - right after "Facts input" in the row menu of the task tree', () => {
  it('a task has it, AFTER "Facts input"; it closes the menu and CREATES the vendor invoice(s) of all the lines of the task (no choice window)', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    act(() => usePMStore.getState().setRowMenu({ guid: task.rowGUID, x: 10, y: 10, source: 'tree' }));
    const ids = qa('pm-row-menu-');
    const from = ids.indexOf('pm-row-menu-facts-input');
    const to = ids.indexOf('pm-row-menu-vendor-invoice');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    // nothing but the parts of the "Facts input" item itself (its icon / label) comes between the two items
    expect(ids.slice(from + 1, to).every((id) => id.startsWith('pm-row-menu-facts-input-'))).toBe(true);
    press('pm-row-menu-vendor-invoice');
    expect(mockStartVendorInvoice).toHaveBeenCalledWith({ taskGUID: task.rowGUID });
    expect(mockPush).not.toHaveBeenCalled();
    expect(usePMStore.getState().rowMenu).toBeNull();
  });
  it('a stage has no lines, so no vendor invoice', () => {
    const { byName } = seedStore();
    const stage = byName('Stage 1');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    act(() => usePMStore.getState().setRowMenu({ guid: stage.rowGUID, x: 10, y: 10, source: 'tree' }));
    expect(q('pm-row-menu-vendor-invoice')).toBeNull();
  });
});

describe('"Purchase Order" - right after "Vendor Invoice" in the row menu of the task tree', () => {
  it('a task has it AFTER "Vendor Invoice"; it closes the menu and CREATES the purchase order(s) of all the lines of the task (no choice window)', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    act(() => usePMStore.getState().setRowMenu({ guid: task.rowGUID, x: 10, y: 10, source: 'tree' }));
    const ids = qa('pm-row-menu-');
    const invoice = ids.indexOf('pm-row-menu-vendor-invoice');
    const order = ids.indexOf('pm-row-menu-purchase-order');
    expect(order).toBeGreaterThan(invoice);
    expect(ids.slice(invoice + 1, order).every((id) => id.startsWith('pm-row-menu-vendor-invoice-'))).toBe(true);
    press('pm-row-menu-purchase-order');
    expect(mockStartPurchaseOrder).toHaveBeenCalledWith({ taskGUID: task.rowGUID });
    expect(mockStartVendorInvoice).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(usePMStore.getState().rowMenu).toBeNull();
  });
  it('a stage has no lines, so no purchase order', () => {
    const { byName } = seedStore();
    const stage = byName('Stage 1');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    act(() => usePMStore.getState().setRowMenu({ guid: stage.rowGUID, x: 10, y: 10, source: 'tree' }));
    expect(q('pm-row-menu-purchase-order')).toBeNull();
  });
});

describe('useOpenFactInput - from anywhere a task GUID or a task line GUID is known', () => {
  function Opener({ params }: { params: any }) {
    const open = useOpenFactInput();
    return React.createElement('button', { 'data-testid': 'opener', onClick: () => open(params) });
  }
  it('passes the task, the line, the genus, the project and the document to the route', () => {
    renderUI(<Opener params={{ taskGUID: 't1', projectGUID: 'p1', taskLineGUID: 'l1', genus: 'materialGenus', documentGUID: 'd1' }} />);
    press('opener');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/fact', params: { taskGUID: 't1', projectGUID: 'p1', taskLineGUID: 'l1', genus: 'materialGenus', documentGUID: 'd1' } });
  });
  it('newWindow on the web: a NEW browser window, not the router; a blocked window falls back to the router', () => {
    const { Platform } = require('react-native');
    const realOS = Platform.OS;
    Platform.OS = 'web';
    function NewWin() {
      const open = useOpenFactInput();
      return React.createElement('button', { 'data-testid': 'opener-new', onClick: () => open({ taskGUID: 't1', projectGUID: 'p1' }, { newWindow: true }) });
    }
    const openSpy = jest.spyOn(window, 'open').mockReturnValue({} as any);
    try {
      renderUI(<NewWin />);
      press('opener-new');
      expect(openSpy).toHaveBeenCalledWith('/pm/project/task/fact?taskGUID=t1&projectGUID=p1', '_blank');
      expect(mockPush).not.toHaveBeenCalled();
      openSpy.mockReturnValue(null);
      press('opener-new');
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/fact', params: { taskGUID: 't1', projectGUID: 'p1' } });
    } finally {
      openSpy.mockRestore();
      Platform.OS = realOS;
    }
  });
  it('without a task GUID nothing is opened', () => {
    renderUI(<Opener params={{ taskGUID: '' }} />);
    press('opener');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
