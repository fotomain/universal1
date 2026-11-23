/** @jest-environment jsdom */
// PMProjectGoToButton: the "Go to" icon button of the project bar (after Actions) - the "Go to" submenu of the Task menu (useTaskRelatedMenu) for the SELECTED task.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, seedStore, wait } from './pmUiTestKit';

const mockPush = jest.fn();
const mockOpenDashboard = jest.fn();
const mockOpenList = jest.fn();
// pmUiTestKit mocks expo-router itself: override with doMock + require AFTER the kit
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../kit8/documents/fact/input/useOpenFactInput', () => ({ useOpenFactInput: () => jest.fn() }));
jest.mock('../../../kit8/documents/vendor/invoice/useVendorInvoice', () => ({ useStartVendorInvoice: () => ({ start: jest.fn(), busy: false }) }));
jest.mock('../../../kit8/documents/customer/invoice/useCustomerInvoice', () => ({ useStartCustomerInvoice: () => ({ start: jest.fn(), busy: false }) }));
jest.mock('../../../kit8/documents/payment/fact/usePaymentFact', () => ({ useStartPaymentFact: () => ({ start: jest.fn(), busy: false, error: null }) }));
jest.mock('../../../kit8/chat/useOpenTaskChat', () => ({ useOpenTaskChat: () => jest.fn() }));
jest.mock('../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({ useStartPurchaseOrder: () => ({ start: jest.fn(), busy: false }) }));
jest.mock('../../../kit8/documents/timesheet/useTimesheet', () => ({ useCreateTimesheetFromTask: () => ({ create: jest.fn(), busy: false, error: null }) }));
jest.mock('../../../kit8/pm/subproject/useCreateSubproject', () => ({ useCreateSubproject: () => ({ create: jest.fn(), busy: false }) }));
jest.mock('../../../kit8/pm/view/project/dashboardDeepLink', () => ({ ...jest.requireActual('../../../kit8/pm/view/project/dashboardDeepLink'), openDashboardLink: (...a: any[]) => mockOpenDashboard(...a) }));
jest.mock('../../../kit8/documents/taskScope/openTaskScopedList', () => ({ openTaskScopedList: (...a: any[]) => mockOpenList(...a) }));

const PMProjectGoToButton = require('../../../kit8/pm/view/project/buttons/PMProjectGoToButton').default;
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

function show(name: string | null, props: Record<string, any> = {}) {
  const { byName } = seedStore();
  const t = name ? byName(name) : null;
  act(() => usePMStore.getState().setSelected(t ? t.rowGUID : null));
  renderUI(<PMProjectGoToButton projectGUID={usePMStore.getState().selectedProjectGUID} color="#000" {...props} />);
  return t;
}
// the menu opens when measureInWindow answers (react-native-web: a timer)
const open = async () => { press('pm-project-goto'); await wait(80); };
const isDisabled = (id: string) => (q(id) as any)?.getAttribute('aria-disabled') === 'true' || (q(id) as any)?.hasAttribute('disabled');

describe('PMProjectGoToButton', () => {
  it('a selected task: the menu has the Go to items of the Task menu and an item opens the list of THAT task', async () => {
    const t = show('Task 111');
    expect(isDisabled('pm-project-goto')).toBe(false);
    expect(q('pm-project-goto-menu')).toBeNull();
    await open();
    expect(q('pm-project-goto-menu')).not.toBeNull();
    for (const i of ['timeline', 'vendor-invoices', 'payment-facts', 'purchase-orders', 'product-receipts', 'fact-input', 'timesheets']) expect(q(`pm-project-goto-goto-${i}`)).not.toBeNull();
    press('pm-project-goto-goto-vendor-invoices');
    expect(mockOpenList).toHaveBeenCalledTimes(1);
    expect(mockOpenList.mock.calls[0][1]).toEqual({ taskGUID: t.rowGUID, taskLineGUID: '' });
    expect(q('pm-project-goto-menu')).toBeNull(); // the menu closes
  });

  it('Timeline data opens the Budgets view of the dashboard for the task', async () => {
    const t = show('Task 111');
    await open();
    press('pm-project-goto-goto-timeline');
    expect(mockOpenDashboard.mock.calls[0][0]).toMatchObject({ taskGUID: t.rowGUID, view: 'budgets' });
  });

  it('no task selected, or a stage (it has no documents): the button is disabled and no menu opens', async () => {
    show(null);
    expect(isDisabled('pm-project-goto')).toBe(true);
    cleanupUI();
    show('Stage 1');
    expect(isDisabled('pm-project-goto')).toBe(true);
    await open();
    expect(q('pm-project-goto-menu')).toBeNull();
  });

  it('disabled by the bar (no project selected): no menu', async () => {
    show('Task 111', { disabled: true });
    await open();
    expect(q('pm-project-goto-menu')).toBeNull();
  });
});
