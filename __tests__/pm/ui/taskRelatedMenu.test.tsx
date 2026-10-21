/** @jest-environment jsdom */
// The submenus "Create based on this" (Fact input · Vendor Invoice · Subproject) and "Go to" (Vendor invoices · Purchase orders · Product receipts · Fact input · Subproject) of the Task context menu (PMTaskRowMenu),
// built by useTaskRelatedMenu (the line menu of the Finances table has its tests in view/task/finances/taskFinancesUi.test.tsx).
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, press, q, renderUI, seedStore, textOf } from './pmUiTestKit';

const mockPush = jest.fn();
const mockFact = jest.fn();
const mockInvoice = jest.fn();
const mockOrder = jest.fn();
const mockCustomer = jest.fn();
const mockCreateSub = jest.fn(async () => 'sub-1');
const mockTimesheet = jest.fn(async () => ({ status: 'created', documentGUID: 'ts-1', skipped: [] }));
const mockOpenBoard = jest.fn();
const mockOpenDashboard = jest.fn();
// pmUiTestKit mocks expo-router itself: override with doMock + require AFTER the kit
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../kit8/documents/fact/input/useOpenFactInput', () => ({ useOpenFactInput: () => mockFact }));
jest.mock('../../../kit8/documents/vendor/invoice/useVendorInvoice', () => ({ useStartVendorInvoice: () => ({ start: mockInvoice, busy: false }) }));
jest.mock('../../../kit8/documents/customer/invoice/useCustomerInvoice', () => ({ useStartCustomerInvoice: () => ({ start: mockCustomer, busy: false }) }));
jest.mock('../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({ useStartPurchaseOrder: () => ({ start: mockOrder, busy: false }) }));
jest.mock('../../../kit8/documents/timesheet/useTimesheet', () => ({ useCreateTimesheetFromTask: () => ({ create: (...a: any[]) => (mockTimesheet as any)(...a), busy: false, error: null }) }));
jest.mock('../../../kit8/pm/subproject/useCreateSubproject', () => ({ useCreateSubproject: () => ({ create: (...a: any[]) => (mockCreateSub as any)(...a), busy: false }) }));
jest.mock('../../../kit8/pm/view/project/dashboardDeepLink', () => ({ ...jest.requireActual('../../../kit8/pm/view/project/dashboardDeepLink'), openProjectBoard: (...a: any[]) => mockOpenBoard(...a), openDashboardLink: (...a: any[]) => mockOpenDashboard(...a) }));

const PMTaskRowMenu = require('../../../kit8/pm/view/task/PMTaskRowMenu').default;
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

afterEach(() => { cleanupUI(); jest.clearAllMocks(); act(() => usePMStore.getState().setRowMenu(null)); });

/** the menu of a task; `project` / `task` patch the rowJSON of the project / the task */
function open(name: string, patch: { project?: Record<string, any>; task?: Record<string, any> } = {}) {
  const { byName } = seedStore();
  const t = byName(name);
  act(() => {
    const s = usePMStore.getState();
    const p = s.projectsById[t.projectGUID];
    usePMStore.setState({
      projectsById: { ...s.projectsById, [t.projectGUID]: { ...p, rowJSON: { ...p.rowJSON, ...(patch.project || {}) } } },
      tasksById: { ...s.tasksById, [t.rowGUID]: { ...s.tasksById[t.rowGUID], rowJSON: { ...s.tasksById[t.rowGUID].rowJSON, ...(patch.task || {}) } } },
    });
  });
  renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
  act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 100, y: 80, source: 'tree' }));
  return t;
}
const ids = () => Array.from(document.querySelectorAll('[data-testid]')).map((e) => String(e.getAttribute('data-testid'))).filter((i) => !/-(icon|more)$/.test(i));

describe('Task menu: the two submenus sit BEFORE Delete, "Go to" right after "Create based on this"', () => {
  it('order: … Purchase Order · Create based on this · Go to · Delete', () => {
    open('Task 111');
    expectInOrder(['pm-row-menu-purchase-order', 'pm-row-menu-create', 'pm-row-menu-goto', 'pm-row-menu-delete']);
    const all = ids();
    expect(all.indexOf('pm-row-menu-goto')).toBe(all.indexOf('pm-row-menu-create') + 1);
  });
  it('the flat items stay (Facts input · Vendor Invoice · Purchase Order)', () => {
    open('Task 111');
    for (const i of ['facts-input', 'vendor-invoice', 'purchase-order']) expect(q(`pm-row-menu-${i}`)).not.toBeNull();
  });
  it('a stage (no lines, no documents) has no submenus', () => {
    open('Stage 1');
    expect(q('pm-row-menu-create')).toBeNull();
    expect(q('pm-row-menu-goto')).toBeNull();
    expect(q('pm-row-menu-delete')).not.toBeNull();
  });
});

describe('Create based on this', () => {
  it('Fact input and Vendor Invoice (the project switch Subprojects is off: no Subproject)', () => {
    const t = open('Task 111');
    press('pm-row-menu-create');
    expect(q('pm-row-menu-create-fact')).not.toBeNull();
    expect(q('pm-row-menu-create-vendor-invoice')).not.toBeNull();
    expect(q('pm-row-menu-create-subproject')).toBeNull();
    press('pm-row-menu-create-fact');
    expect(mockFact).toHaveBeenCalledWith({ taskGUID: t.rowGUID, projectGUID: t.projectGUID }, { newWindow: true });
    expect(usePMStore.getState().rowMenu).toBeNull();            // the item closes the menu
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 1, y: 1, source: 'tree' }));
    press('pm-row-menu-create');
    press('pm-row-menu-create-vendor-invoice');
    expect(mockInvoice).toHaveBeenCalledWith({ taskGUID: t.rowGUID, projectGUID: t.projectGUID });
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 1, y: 1, source: 'tree' }));
    press('pm-row-menu-create');
    expect(q('pm-row-menu-create-purchase-order')).not.toBeNull();       // after Vendor Invoice
    press('pm-row-menu-create-purchase-order');
    expect(mockOrder).toHaveBeenCalledWith({ taskGUID: t.rowGUID, projectGUID: t.projectGUID });
  });
  it('Subproject is there only while the project switch subprojectsFunctionalityEnabled is on; it creates and links the project of THIS task', () => {
    const t = open('Task 111', { project: { subprojectsFunctionalityEnabled: true } });
    press('pm-row-menu-create');
    expect(q('pm-row-menu-create-subproject')).not.toBeNull();
    press('pm-row-menu-create-subproject');
    expect(mockCreateSub).toHaveBeenCalledWith(t.rowGUID, t.projectGUID);
    expect(usePMStore.getState().rowMenu).toBeNull();
  });
  it('a task that already stands for a subproject: the item is disabled (a second link would replace the first)', () => {
    open('Task 111', { project: { subprojectsFunctionalityEnabled: true }, task: { taskIsSubproject: true, taskSubprojectGUID: 'sub-9' } });
    press('pm-row-menu-create');
    const item = q('pm-row-menu-create-subproject')!;
    expect(item).not.toBeNull();
    expect(item.getAttribute('aria-disabled')).toBe('true');
    press('pm-row-menu-create-subproject');
    expect(mockCreateSub).not.toHaveBeenCalled();
  });
  it('a milestone cannot stand for a subproject: no Subproject item even with the switch on', () => {
    open('Task 111', { project: { subprojectsFunctionalityEnabled: true }, task: { rowKind: 'milestone' } });
    press('pm-row-menu-create');
    expect(q('pm-row-menu-create-subproject')).toBeNull();
    expect(q('pm-row-menu-create-fact')).not.toBeNull();
  });
});

describe('Time sheet', () => {
  it('Create based on this → Time sheet makes a NEW draft for the TASK (always new); Go to → Time sheets opens the list of the task in a new window', () => {
    const t = open('Task 111');
    press('pm-row-menu-create');
    expect(q('pm-row-menu-create-timesheet')).not.toBeNull();
    press('pm-row-menu-create-timesheet');
    expect(mockTimesheet).toHaveBeenCalledWith(t.rowGUID, null);
    expect(usePMStore.getState().rowMenu).toBeNull();
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 1, y: 1, source: 'tree' }));
    press('pm-row-menu-create');
    press('pm-row-menu-create-timesheet');
    expect(mockTimesheet).toHaveBeenCalledTimes(2);                                 // never reused: every press asks for a new draft
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 1, y: 1, source: 'tree' }));
    press('pm-row-menu-goto');
    press('pm-row-menu-goto-timesheets');
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/timesheet/list', params: { taskGUID: t.rowGUID } });
  });
  it('the Time sheet item comes after Purchase Order; a milestone has no time sheet', () => {
    open('Task 111');
    press('pm-row-menu-create');
    expectInOrder(['pm-row-menu-create-purchase-order', 'pm-row-menu-create-timesheet']);
  });
  it('a stage has no submenus at all', () => {
    open('Stage 1');
    expect(q('pm-row-menu-create-timesheet')).toBeNull();
  });
});

describe('Go to', () => {
  it('Vendor invoices / Purchase orders / Product receipts / Fact input: the lists filtered for the TASK', () => {
    const t = open('Task 111');
    press('pm-row-menu-goto');
    press('pm-row-menu-goto-vendor-invoices');
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/vendor-invoice/list', params: { taskGUID: t.rowGUID } });
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 1, y: 1, source: 'tree' }));
    press('pm-row-menu-goto');
    press('pm-row-menu-goto-purchase-orders');
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/purchase-order/list', params: { taskGUID: t.rowGUID } });
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 1, y: 1, source: 'tree' }));
    press('pm-row-menu-goto');
    press('pm-row-menu-goto-product-receipts');
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/product-receipt/list', params: { taskGUID: t.rowGUID } });
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 1, y: 1, source: 'tree' }));
    press('pm-row-menu-goto');
    press('pm-row-menu-goto-fact-input');
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/fact/list', params: { taskGUID: t.rowGUID } });
  });
  it('Timeline data is FIRST: the Budgets view of the dashboard on its Timeline tab, in a new window, for the TASK (no line filter from the task menu)', () => {
    const t = open('Task 111');
    press('pm-row-menu-goto');
    const go = ids().filter((i) => /^pm-row-menu-goto-/.test(i));
    expect(go[0]).toBe('pm-row-menu-goto-timeline');
    expect(textOf('pm-row-menu-goto-timeline')).toContain('Timeline data');
    press('pm-row-menu-goto-timeline');
    expect(mockOpenDashboard).toHaveBeenCalledTimes(1);
    expect(mockOpenDashboard.mock.calls[0][0]).toEqual({ projectGUID: t.projectGUID, taskGUID: t.rowGUID, view: 'budgets', tab: 'TabPlanTimeline' });
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('Subproject only for a task that stands for a project; it opens that board', () => {
    open('Task 111');
    press('pm-row-menu-goto');
    expect(q('pm-row-menu-goto-subproject')).toBeNull();
    cleanupUI();
    open('Task 111', { task: { taskIsSubproject: true, taskSubprojectGUID: 'sub-9' } });
    press('pm-row-menu-goto');
    press('pm-row-menu-goto-subproject');
    expect(mockOpenBoard).toHaveBeenCalledWith('sub-9', expect.anything());
  });
  it('a task flagged as a subproject without a project (half saved) has no Go to → Subproject', () => {
    open('Task 111', { task: { taskIsSubproject: true, taskSubprojectGUID: null } });
    press('pm-row-menu-goto');
    expect(q('pm-row-menu-goto-subproject')).toBeNull();
  });
});

describe('Customer invoice (project switch customerInvoiceFunctionalityEnabled, true by default)', () => {
  it('Create based on this → Customer Invoice and Go to → Customer invoices are there by default; they work on the Deliverable (Revenue) lines of the TASK', () => {
    const t = open('Task 111');
    press('pm-row-menu-create');
    expect(q('pm-row-menu-create-customer-invoice')).not.toBeNull();
    press('pm-row-menu-create-customer-invoice');
    expect(mockCustomer).toHaveBeenCalledWith({ taskGUID: t.rowGUID, projectGUID: t.projectGUID });
    expect(usePMStore.getState().rowMenu).toBeNull();
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 1, y: 1, source: 'tree' }));
    press('pm-row-menu-goto');
    expect(q('pm-row-menu-goto-customer-invoices')).not.toBeNull();
    press('pm-row-menu-goto-customer-invoices');
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/customer-invoice/list', params: { taskGUID: t.rowGUID } });
  });
  it('the items come after Vendor Invoice (Create) and after Vendor invoices (Go to)', () => {
    open('Task 111');
    press('pm-row-menu-create');
    const create = ids().filter((i) => /^pm-row-menu-create-/.test(i));
    expect(create.indexOf('pm-row-menu-create-customer-invoice')).toBeGreaterThan(create.indexOf('pm-row-menu-create-purchase-order'));
    cleanupUI();
    open('Task 111');
    press('pm-row-menu-goto');
    const go = ids().filter((i) => /^pm-row-menu-goto-/.test(i));
    expect(go.indexOf('pm-row-menu-goto-customer-invoices')).toBe(go.indexOf('pm-row-menu-goto-vendor-invoices') + 1);
  });
  it('the switch OFF: neither item', () => {
    open('Task 111', { project: { customerInvoiceFunctionalityEnabled: false } });
    press('pm-row-menu-create');
    expect(q('pm-row-menu-create-fact')).not.toBeNull();
    expect(q('pm-row-menu-create-customer-invoice')).toBeNull();
    cleanupUI();
    open('Task 111', { project: { customerInvoiceFunctionalityEnabled: false } });
    press('pm-row-menu-goto');
    expect(q('pm-row-menu-goto-customer-invoices')).toBeNull();
  });
});

describe('Customer invoice in the line menu of the Finances table', () => {
  const { useTaskRelatedMenu } = require('../../../kit8/pm/view/task/useTaskRelatedMenu');
  let build: any;
  function Probe() { build = useTaskRelatedMenu(); return null; }
  const items = (ctx: any) => {
    const [create, goto] = build({ idPrefix: 'm', close: jest.fn(), ...ctx });
    return { create: create.submenu.map((i: any) => i.testID), goto: goto.submenu.map((i: any) => i.testID), createItems: create.submenu };
  };
  it('a Deliverable (Revenue) line: Customer Invoice and Customer invoices (no vendor items); a Material line: the vendor items only', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    renderUI(<Probe />);
    const rev = items({ taskGUID: t.rowGUID, projectGUID: t.projectGUID, taskLineGUID: 'l-rev', genus: 'revenueGenus', noVendor: true });
    expect(rev.create).toContain('m-create-customer-invoice');
    expect(rev.create).not.toContain('m-create-vendor-invoice');
    expect(rev.goto).toContain('m-goto-customer-invoices');
    const mat = items({ taskGUID: t.rowGUID, projectGUID: t.projectGUID, taskLineGUID: 'l-mat', genus: 'materialGenus' });
    expect(mat.create).toContain('m-create-vendor-invoice');
    expect(mat.create).not.toContain('m-create-customer-invoice');
    expect(mat.goto).not.toContain('m-goto-customer-invoices');
  });
  it('the LINE menu has Timeline data too: the Budgets view filtered by the task line GUID (a Material line, a Deliverable line - it has no vendor items but this one)', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    renderUI(<Probe />);
    const close = jest.fn();
    for (const [line, genus, noVendor] of [['l-time', 'timeGenus', false], ['l-mat', 'materialGenus', false], ['l-rev', 'revenueGenus', true]] as const) {
      mockOpenDashboard.mockClear();
      const [, goto] = build({ idPrefix: 'm', close, taskGUID: t.rowGUID, projectGUID: t.projectGUID, taskLineGUID: line, genus, noVendor });
      const item = goto.submenu.find((i: any) => i.testID === 'm-goto-timeline');
      expect(item).toMatchObject({ label: 'Timeline data', icon: 'timeline' });
      item.onPress();
      expect(close).toHaveBeenCalled();
      expect(mockOpenDashboard.mock.calls[0][0]).toEqual({ projectGUID: t.projectGUID, taskGUID: t.rowGUID, view: 'budgets', tab: 'TabPlanTimeline', lineGUID: line });
    }
  });
  it('the item of a Revenue line creates the invoice of THAT line (lineGUIDs), or asks first when the menu gives onCustomerInvoice', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    renderUI(<Probe />);
    const ask = jest.fn();
    items({ taskGUID: t.rowGUID, projectGUID: t.projectGUID, taskLineGUID: 'l-rev', genus: 'revenueGenus', noVendor: true }).createItems.find((i: any) => i.testID === 'm-create-customer-invoice').onPress();
    expect(mockCustomer).toHaveBeenCalledWith({ taskGUID: t.rowGUID, projectGUID: t.projectGUID, lineGUIDs: ['l-rev'] });
    mockCustomer.mockClear();
    items({ taskGUID: t.rowGUID, projectGUID: t.projectGUID, taskLineGUID: 'l-rev', genus: 'revenueGenus', noVendor: true, onCustomerInvoice: ask }).createItems.find((i: any) => i.testID === 'm-create-customer-invoice').onPress();
    expect(ask).toHaveBeenCalled();
    expect(mockCustomer).not.toHaveBeenCalled();
  });
});

describe('Task menu: Options opens PMTaskEditOptions (UX/UI only)', () => {
  it('"Options" calls crud.editOptions(taskGUID) and closes the menu; there is no "Edit" item', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    const crud = fakeCrud();
    renderUI(<PMTaskRowMenu crud={crud} />);
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 100, y: 80, source: 'tree' }));
    expect(q('pm-row-menu-edit')).toBeNull();
    expect(document.body.textContent).toContain('Options');
    const all = ids();
    expect(all.indexOf('pm-row-menu-options')).toBe(all.indexOf('pm-row-menu-delete') - 1); // Options stands right before Delete
    press('pm-row-menu-options');
    expect(crud.editOptions).toHaveBeenCalledWith(t.rowGUID);
    expect(crud.edit).not.toHaveBeenCalled(); // the full form is not the context menu's
    expect(usePMStore.getState().rowMenu).toBeNull();
  });
});
