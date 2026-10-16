/** @jest-environment jsdom */
// useDocumentLineMenu: the Task context menu items on a line of a vendor invoice / purchase order, and LinePlaceCell's tips.
import React from 'react';
import { act } from 'react';

const mockPush = jest.fn();
const mockDispatch = jest.fn();
const mockFact = jest.fn();
const mockInvoice = jest.fn();
const mockOrder = jest.fn();
const mockOpenLink = jest.fn();
const mockCopy = jest.fn(() => Promise.resolve(true));
const mockSetString = jest.fn(() => Promise.resolve());
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
jest.mock('expo-clipboard', () => ({ setStringAsync: (t: string) => mockSetString(t) }));
jest.mock('../../../../kit8/documents/fact/input/useOpenFactInput', () => ({ useOpenFactInput: () => mockFact }));
jest.mock('../../../../kit8/documents/vendor/invoice/useVendorInvoice', () => ({ useStartVendorInvoice: () => ({ start: mockInvoice }) }));
jest.mock('../../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({ useStartPurchaseOrder: () => ({ start: mockOrder }) }));
jest.mock('../../../../kit8/pm/view/project/dashboardDeepLink', () => ({ openDashboardLink: (...a: any[]) => mockOpenLink(...a) }));
jest.mock('../../../../kit8/pm/view/task/finances/copyLineGuid', () => ({ copyLineGUID: (...a: any[]) => mockCopy(...a) }));
jest.mock('../../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snack', payload: p }) }));

import { lineTaskOf, useDocumentLineMenu } from '../../../../kit8/documents/vendor/lineplace/useDocumentLineMenu';

const row: any = { rowGUID: 'l1', rowOwnerGUID: 't1', rowProjectGUID: 'p1', taskLineGUID: 'tl1', genusGUID: 'timeGenus' };
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const itemsOf = (r: any) => {
  const close = jest.fn();
  let build: any;
  const Probe = () => { build = useDocumentLineMenu('vi-lines'); return null; };
  const root = createRoot(document.createElement('div'));
  act(() => root.render(React.createElement(Probe)));
  const items = build(r, close);
  act(() => root.unmount());
  return { items, close };
};
const byId = (items: any[], s: string) => items.find((i) => i.testID === `vi-lines-menu-${s}-l1`);

beforeEach(() => jest.clearAllMocks());

describe('useDocumentLineMenu', () => {
  it('reads the task, project, task line and kind of a line row', () => {
    expect(lineTaskOf(row)).toEqual({ taskGUID: 't1', projectGUID: 'p1', taskLineGUID: 'tl1', genus: 'timeGenus' });
    expect(lineTaskOf({ rowGUID: 'x', taskLineGUID: null } as any).taskLineGUID).toBe('');
  });

  it('a line of a task line offers every Task menu command that works without the tree', () => {
    const { items } = itemsOf(row);
    expect(items.map((i) => i.label)).toEqual(['Open task', 'Open task line', 'Facts input', 'Vendor Invoice', 'Purchase Order', 'Copy task GUID', 'Copy line GUID']);
  });

  it('an independent line (no task line) has no "Open task line" and no "Copy line GUID"; a line with no task has no items', () => {
    const { items } = itemsOf({ ...row, taskLineGUID: null });
    expect(items.map((i) => i.label)).toEqual(['Open task', 'Facts input', 'Vendor Invoice', 'Purchase Order', 'Copy task GUID']);
    expect(itemsOf({ rowGUID: 'l9' }).items).toEqual([]);
  });

  it('each item closes the menu, then runs its command with the GUIDs of the line', async () => {
    let r = itemsOf(row);
    byId(r.items, 'open-task').onPress();
    expect(r.close).toHaveBeenCalled();
    expect(mockOpenLink).toHaveBeenLastCalledWith({ projectGUID: 'p1', taskGUID: 't1' }, expect.anything());
    byId(r.items, 'open-line').onPress();
    expect(mockOpenLink).toHaveBeenLastCalledWith({ projectGUID: 'p1', taskGUID: 't1', genus: 'timeGenus', lineGUID: 'tl1' }, expect.anything());
    byId(r.items, 'facts-input').onPress();
    expect(mockFact).toHaveBeenCalledWith({ taskGUID: 't1', projectGUID: 'p1', taskLineGUID: 'tl1', genus: 'timeGenus' });
    byId(r.items, 'vendor-invoice').onPress();
    expect(mockInvoice).toHaveBeenCalledWith({ taskGUID: 't1', projectGUID: 'p1' });
    byId(r.items, 'purchase-order').onPress();
    expect(mockOrder).toHaveBeenCalledWith({ taskGUID: 't1', projectGUID: 'p1' });
    byId(r.items, 'copy-task-guid').onPress();
    expect(mockSetString).toHaveBeenCalledWith('t1');
    byId(r.items, 'copy-line-guid').onPress();
    expect(mockCopy).toHaveBeenCalledWith('tl1', mockDispatch);
  });
});
