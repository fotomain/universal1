/** @jest-environment jsdom */
// DocumentActionsGoTo: the buttons "Actions" and "Go to" of the bar of a document form (vendor invoice): the items of the Task menu for the task of the document.
import { cleanupUI, press, q, renderUI, wait } from '../../pm/ui/pmUiTestKit';

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

const DocumentActionsGoTo = require('../../../kit8/documents/taskScope/DocumentActionsGoTo').default;

afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

const show = async (props: Record<string, any> = {}) => {
  renderUI(<DocumentActionsGoTo taskGUID="t1" projectGUID="p1" testID="inv" {...props} />);
  await wait(30); // the rowJSON of the task is read
};
// the menu opens when measureInWindow answers (react-native-web: a timer)
const open = async (id: string) => { press(id); await wait(80); };

describe('DocumentActionsGoTo', () => {
  it('no task or no project (an independent document): nothing is shown', async () => {
    await show({ taskGUID: '' });
    expect(q('inv-actions')).toBeNull();
    expect(q('inv-goto')).toBeNull();
  });

  it('Go to: Open task + the Go to items of the Task menu, for THE task of the document', async () => {
    await show();
    await open('inv-goto');
    expect(q('inv-goto-menu')).not.toBeNull();
    for (const i of ['open-task']) expect(q(`inv-goto-${i}`)).not.toBeNull();
    for (const i of ['timeline', 'vendor-invoices', 'payment-facts', 'purchase-orders', 'product-receipts', 'fact-input', 'timesheets']) expect(q(`inv-task-goto-${i}`)).not.toBeNull();
    press('inv-task-goto-purchase-orders');
    expect(mockOpenList.mock.calls[0][1]).toEqual({ taskGUID: 't1', taskLineGUID: '' });
    expect(q('inv-goto-menu')).toBeNull(); // the menu closes
  });

  it('Open task opens the dashboard at the task', async () => {
    await show();
    await open('inv-goto');
    press('inv-goto-open-task');
    expect(mockOpenDashboard.mock.calls[0][0]).toEqual({ projectGUID: 'p1', taskGUID: 't1' });
  });

  it('Actions: the items of the document first, then the Create based on items of the Task menu', async () => {
    const mine = jest.fn();
    await show({ actionItems: [{ testID: 'inv-actions-mine', label: 'Payment fact (pays this invoice)', icon: 'account_balance', onPress: mine }] });
    await open('inv-actions');
    expect(q('inv-actions-menu')).not.toBeNull();
    expect(q('inv-task-create-fact')).not.toBeNull();
    expect(q('inv-task-create-purchase-order')).not.toBeNull();
    press('inv-actions-mine');
    expect(mine).toHaveBeenCalledTimes(1);
    expect(q('inv-actions-menu')).toBeNull();
  });

  it('alwaysShow (the toolbar of a list): without a task the icon buttons are there but disabled; with a task they open the menus', async () => {
    await show({ taskGUID: '', variant: 'icons', alwaysShow: true, disabled: true });
    expect(q('inv-actions')).not.toBeNull();
    await open('inv-goto');
    expect(q('inv-goto-menu')).toBeNull();
    cleanupUI();
    await show({ variant: 'icons', alwaysShow: true });
    await open('inv-goto');
    expect(q('inv-goto-menu')).not.toBeNull();
    expect(q('inv-task-goto-timeline')).not.toBeNull();
  });
  it('a document without ONE task (time sheet, payment fact): its own list is under Go to; Actions has nothing and is disabled', async () => {
    await show({ taskGUID: '', ownList: { route: '/pm/timesheet/list', label: 'Time sheets', icon: 'schedule' } });
    expect(q('inv-actions')).not.toBeNull();
    await open('inv-actions');
    expect(q('inv-actions-menu')).toBeNull();
    await open('inv-goto');
    expect(q('inv-goto-own-list')).not.toBeNull();
    expect(q('inv-goto-open-task')).toBeNull();
    press('inv-goto-own-list');
    expect(mockOpenList.mock.calls[0][0]).toBe('/pm/timesheet/list');
    expect(mockOpenList.mock.calls[0][1]).toEqual({ taskGUID: '', taskLineGUID: '' });
  });
  it('the project may be left out (a fact input form knows only the task): until the database has told it, the Task menu items wait', async () => {
    await show({ projectGUID: '' });
    await open('inv-goto');
    expect(q('inv-task-goto-timeline')).toBeNull(); // no project known (the test client answers nothing): the Task menu items wait for it
  });
  it('kind: only the items logically related to the document are shown (a purchase order: no Customer invoices / Time sheets / Subproject; Actions has no task items)', async () => {
    await show({ kind: 'purchaseOrder' });
    await open('inv-goto');
    for (const i of ['timeline', 'vendor-invoices', 'purchase-orders', 'product-receipts']) expect(q(`inv-task-goto-${i}`)).not.toBeNull();
    for (const i of ['customer-invoices', 'timesheets', 'fact-input', 'payment-facts']) expect(q(`inv-task-goto-${i}`)).toBeNull();
    expect(q('inv-goto-open-task')).not.toBeNull();
    cleanupUI();
    await show({ kind: 'purchaseOrder' });
    await open('inv-actions');
    expect(q('inv-actions-menu')).toBeNull(); // nothing to create from the task: disabled
    cleanupUI();
    await show({ kind: 'factInput' });
    await open('inv-actions');
    expect(q('inv-task-create-vendor-invoice')).not.toBeNull();
    expect(q('inv-task-create-time-sheet')).toBeNull();
    expect(q('inv-task-create-purchase-order')).toBeNull();
  });
  it('disabled by the form (a command is running): no menu', async () => {
    await show({ disabled: true });
    await open('inv-goto');
    expect(q('inv-goto-menu')).toBeNull();
  });
});
