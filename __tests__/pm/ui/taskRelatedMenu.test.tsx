/** @jest-environment jsdom */
// The submenus "Create based on this" (Fact input · Vendor Invoice · Subproject) and "Go to" (Vendor invoices · Fact input · Subproject) of the Task context menu (PMTaskRowMenu),
// built by useTaskRelatedMenu (the line menu of the Finances table has its tests in view/task/finances/taskFinancesUi.test.tsx).
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, press, q, renderUI, seedStore } from './pmUiTestKit';

const mockPush = jest.fn();
const mockFact = jest.fn();
const mockInvoice = jest.fn();
const mockOrder = jest.fn();
const mockCreateSub = jest.fn(async () => 'sub-1');
const mockOpenBoard = jest.fn();
// pmUiTestKit mocks expo-router itself: override with doMock + require AFTER the kit
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../kit8/documents/fact/input/useOpenFactInput', () => ({ useOpenFactInput: () => mockFact }));
jest.mock('../../../kit8/documents/vendor/invoice/useVendorInvoice', () => ({ useStartVendorInvoice: () => ({ start: mockInvoice, busy: false }) }));
jest.mock('../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({ useStartPurchaseOrder: () => ({ start: mockOrder, busy: false }) }));
jest.mock('../../../kit8/pm/subproject/useCreateSubproject', () => ({ useCreateSubproject: () => ({ create: (...a: any[]) => (mockCreateSub as any)(...a), busy: false }) }));
jest.mock('../../../kit8/pm/view/project/dashboardDeepLink', () => ({ ...jest.requireActual('../../../kit8/pm/view/project/dashboardDeepLink'), openProjectBoard: (...a: any[]) => mockOpenBoard(...a) }));

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

describe('Go to', () => {
  it('Vendor invoices / Fact input: the lists filtered for the TASK', () => {
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
    press('pm-row-menu-goto-fact-input');
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/fact/list', params: { taskGUID: t.rowGUID } });
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
