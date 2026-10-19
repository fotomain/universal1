/** @jest-environment jsdom */
// PMTaskEditWindow (/pm/project/task/edit): 1st level tabs TabTaskEditMain (the task form of PMTaskEditModal, embedded) and TabTaskEditPlan (PMTaskEditView);
// taskEditWindowLink: the link a double click on the Gantt chart opens in a new browser window.
import './pmUiTestKit';
import React, { act } from 'react';
const hidden = (id: string) => window.getComputedStyle(q(id) as HTMLElement).display === 'none';
import { cleanupUI, fakeCrud, inputValue, press, q, renderUI, seedStore, typeInto } from './pmUiTestKit';
import { DEFAULT_TASK_EDIT_WINDOW_TAB, TASK_EDIT_ROUTE, openTaskEditWindow, parseTaskEditWindowParams, taskEditWindowParams, taskEditWindowPath } from '../../../kit8/pm/view/task/edit/taskEditWindowLink';

let mockCrud: any = {};
const mockNavigate = jest.fn();
jest.mock('../../../kit8/pm/crud/queries', () => ({
  usePMOwnerGUID: () => 'u1',
  useProjectRealtime: () => undefined,
  useReadProjectDataQuery: () => ({ isLoading: false, isFetched: true }),
  useReadProjectsQuery: () => ({}),
  useReadProjectUserSettingsQuery: () => ({}),
  useReadTaskQuery: () => ({ isLoading: false, data: null }),
}));
jest.mock('../../../kit8/pm/crud/usePMCrud', () => ({ usePMCrud: () => mockCrud }));
jest.mock('../../../kit8/pm/crud/kanban/useKanbanCommands', () => ({ useKanbanCommands: () => ({ setTaskKanbanProgress: jest.fn(), setTasksKanbanProgress: jest.fn() }) }));
jest.mock('../../../kit8/pm/view/undo/PMUndoProvider', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('../../../kit8/pm/view/task/finances/PMTaskEditView', () => ({ __esModule: true, default: (p: any) => <div data-testid="stub-plan-view" data-project={p.projectGUID} data-width={p.width} /> }));
jest.mock('../../../kit8/documents/fact/input/PMFactInputDocumentList', () => ({ __esModule: true, default: (p: any) => <div data-testid="stub-fact-list" data-task={p.taskGUID} data-project={p.projectGUID} /> }));
jest.mock('../../../kit8/documents/vendor/product_receipt/PMProductReceiptDocumentList', () => ({ __esModule: true, default: (p: any) => <div data-testid="stub-receipt-list" data-task={p.taskGUID} /> }));
jest.mock('../../../kit8/documents/vendor/invoice/VendorInvoiceDocumentList', () => ({ __esModule: true, default: (p: any) => <div data-testid="stub-invoice-list" data-task={p.taskGUID} /> }));
jest.mock('../../../kit8/documents/customer/invoice/CustomerInvoiceDocumentList', () => ({ __esModule: true, default: (p: any) => <div data-testid="stub-customer-list" data-task={p.taskGUID} /> }));
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: mockNavigate, replace: jest.fn(), back: jest.fn() }), useNavigation: () => ({ setOptions: jest.fn() }) }));

const PMTaskEditWindow = require('../../../kit8/pm/view/task/edit/PMTaskEditWindow').default;
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

beforeEach(() => { mockCrud = fakeCrud(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('taskEditWindowLink', () => {
  it('path: the Main tab is the default and is not written', () => {
    expect(taskEditWindowPath({ taskGUID: 't1', projectGUID: 'p1' })).toBe(`${TASK_EDIT_ROUTE}?taskGUID=t1&projectGUID=p1`);
    expect(taskEditWindowPath({ taskGUID: 't1', tab: 'TabTaskEditPlan' })).toBe(`${TASK_EDIT_ROUTE}?taskGUID=t1&tab=TabTaskEditPlan`);
    expect(taskEditWindowParams({ taskGUID: 't1', tab: DEFAULT_TASK_EDIT_WINDOW_TAB })).toEqual({ taskGUID: 't1' });
  });
  it('parse: only known tabs, an array param takes its first value, no task = empty GUID', () => {
    expect(parseTaskEditWindowParams({ taskGUID: 't1', projectGUID: 'p1', tab: 'TabTaskEditPlan' })).toEqual({ taskGUID: 't1', projectGUID: 'p1', tab: 'TabTaskEditPlan' });
    expect(parseTaskEditWindowParams({ taskGUID: 't1', tab: 'TabTaskEditFact' }).tab).toBe('TabTaskEditFact');
    expect(parseTaskEditWindowParams({ taskGUID: ['t1', 't2'], tab: 'nonsense' })).toEqual({ taskGUID: 't1', tab: 'TabTaskEditMain' });
    expect(parseTaskEditWindowParams({})).toEqual({ taskGUID: '', tab: 'TabTaskEditMain' });
    expect(parseTaskEditWindowParams(undefined).taskGUID).toBe('');
  });
  it('web: a NEW browser window; a blocked pop-up uses the router of this window', () => {
    const router = { push: jest.fn() };
    const open = jest.spyOn(window, 'open').mockReturnValue({} as any);
    openTaskEditWindow({ taskGUID: 't1', projectGUID: 'p1' }, router);
    expect(open).toHaveBeenCalledWith(`${TASK_EDIT_ROUTE}?taskGUID=t1&projectGUID=p1`, '_blank');
    expect(router.push).not.toHaveBeenCalled();
    open.mockReturnValue(null);
    openTaskEditWindow({ taskGUID: 't1' }, router);
    expect(router.push).toHaveBeenCalledWith({ pathname: TASK_EDIT_ROUTE, params: { taskGUID: 't1' } });
    open.mockRestore();
  });
});

describe('PMTaskEditWindow', () => {
  const openWindow = (name = 'Task 111', props: Record<string, any> = {}) => {
    const { byName } = seedStore();
    const t = byName(name);
    renderUI(<PMTaskEditWindow taskGUID={t.rowGUID} projectGUID={t.projectGUID} {...props} />);
    return t;
  };

  it('Main (the task form) is shown, Plan (PMTaskEditView) is hidden but mounted', () => {
    openWindow();
    expect(q('pm-task-edit-window-TabTaskEditMain')).not.toBeNull();
    expect(q('pm-task-edit-window-TabTaskEditPlan')).not.toBeNull();
    // the form of PMTaskEditModal, embedded: its own 2nd level tabs, fields and buttons
    for (const id of ['pm-task-edit-toptabs', 'pm-edit-name', 'pm-edit-days', 'pm-edit-save', 'pm-edit-cancel', 'pm-edit-delete', 'pm-edit-open', 'pm-edit-google-calendar']) expect(q(id)).not.toBeNull();
    expect(q('pm-task-edit-page')).not.toBeNull();
    expect(hidden('pm-task-edit-window-plan')).toBe(true);
    expect(hidden('pm-task-edit-window-main')).toBe(false);
  });

  it('the form is filled with the task; Save writes it and the window stays open', () => {
    const t = openWindow('Task 111');
    expect(inputValue('pm-edit-name')).toBe('Task 111');
    typeInto('pm-edit-name', 'Renamed in the window');
    press('pm-edit-save');
    expect(mockCrud.updateTask).toHaveBeenCalledTimes(1);
    const [guid, patch] = mockCrud.updateTask.mock.calls[0];
    expect(guid).toBe(t.rowGUID);
    expect(patch.rowJSON.taskDescription).toBe('Renamed in the window');
    expect(q('pm-edit-name')).not.toBeNull(); // not closed
    expect(usePMStore.getState().editingGUID).toBeNull(); // the Modal's store flag is not used
  });

  it('TabTaskEditPlan shows PMTaskEditView of the project with this task selected', () => {
    const t = openWindow('Task 112');
    press('pm-task-edit-window-TabTaskEditPlan');
    expect(usePMStore.getState().selectedGUID).toBe(t.rowGUID);
    expect(hidden('pm-task-edit-window-plan')).toBe(false);
    expect(hidden('pm-task-edit-window-main')).toBe(true);
  });

  it('TabTaskEditFact lists the fact input documents of THIS task; it is created on the first visit and kept', () => {
    const t = openWindow('Task 111');
    expect(q('stub-fact-list')).toBeNull(); // not visited yet: no database read
    expect(hidden('pm-task-edit-window-fact')).toBe(true);
    press('pm-task-edit-window-TabTaskEditFact');
    expect(hidden('pm-task-edit-window-fact')).toBe(false);
    expect(hidden('pm-task-edit-window-main')).toBe(true);
    const list = q('stub-fact-list') as HTMLElement;
    expect(list.getAttribute('data-task')).toBe(t.rowGUID);
    expect(list.getAttribute('data-project')).toBe(t.projectGUID);
    // TabFactInput: the 2nd level tab of the Fact tab holds the list
    expect(q('pm-task-edit-fact-tabs')).not.toBeNull();
    expect(q('pm-task-edit-fact-TabFactInput')).not.toBeNull();
    expect(q('pm-task-edit-tab-fact-input')!.contains(list)).toBe(true);
    press('pm-task-edit-window-TabTaskEditMain');
    expect(q('stub-fact-list')).not.toBeNull(); // kept
  });

  it('TabTaskEditFact: 2nd level tabs TabFactInput · TabProductReceipt · TabVendorInvoice · TabCustomerInvoice, each list of THIS task, created on its first visit and kept', () => {
    const t = openWindow('Task 111');
    press('pm-task-edit-window-TabTaskEditFact');
    const ids = Array.from(document.querySelectorAll('[data-testid^="pm-task-edit-fact-Tab"]')).map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(['pm-task-edit-fact-TabFactInput', 'pm-task-edit-fact-TabProductReceipt', 'pm-task-edit-fact-TabVendorInvoice', 'pm-task-edit-fact-TabCustomerInvoice']);
    // only the first tab is built; the other lists are not read before the user opens them
    expect(q('stub-fact-list')).not.toBeNull();
    expect(q('stub-receipt-list')).toBeNull();
    expect(q('stub-invoice-list')).toBeNull();
    expect(q('stub-customer-list')).toBeNull();
    press('pm-task-edit-fact-TabProductReceipt');
    expect(q('stub-receipt-list')!.getAttribute('data-task')).toBe(t.rowGUID);
    expect(hidden('pm-task-edit-fact-content-TabProductReceipt')).toBe(false);
    expect(hidden('pm-task-edit-fact-content-TabFactInput')).toBe(true);
    expect(q('pm-task-edit-tab-product-receipt')!.contains(q('stub-receipt-list'))).toBe(true);
    press('pm-task-edit-fact-TabVendorInvoice');
    expect(q('stub-invoice-list')!.getAttribute('data-task')).toBe(t.rowGUID);
    expect(hidden('pm-task-edit-fact-content-TabVendorInvoice')).toBe(false);
    expect(hidden('pm-task-edit-fact-content-TabProductReceipt')).toBe(true);
    expect(q('pm-task-edit-tab-vendor-invoice')!.contains(q('stub-invoice-list'))).toBe(true);
    press('pm-task-edit-fact-TabCustomerInvoice');
    expect(q('stub-customer-list')!.getAttribute('data-task')).toBe(t.rowGUID);
    expect(hidden('pm-task-edit-fact-content-TabCustomerInvoice')).toBe(false);
    expect(q('pm-task-edit-tab-customer-invoice')!.contains(q('stub-customer-list'))).toBe(true);
    press('pm-task-edit-fact-TabFactInput');
    expect(q('stub-receipt-list')).not.toBeNull(); // kept
    expect(q('stub-invoice-list')).not.toBeNull();
  });

  it('the Customer invoice tab is there only while the project switch customerInvoiceFunctionalityEnabled is on (the default)', () => {
    const t = openWindow('Task 111');
    act(() => usePMStore.setState((st: any) => ({ projectsById: { ...st.projectsById, [t.projectGUID]: { ...st.projectsById[t.projectGUID], rowJSON: { ...st.projectsById[t.projectGUID].rowJSON, customerInvoiceFunctionalityEnabled: false } } } })));
    press('pm-task-edit-window-TabTaskEditFact');
    expect(q('pm-task-edit-fact-TabCustomerInvoice')).toBeNull();
    expect(q('pm-task-edit-fact-TabVendorInvoice')).not.toBeNull();
  });

  it('the three 1st level tabs, in this order: Main · Plan · Fact', () => {
    openWindow();
    const ids = Array.from(document.querySelectorAll('[data-testid^="pm-task-edit-window-Tab"]')).map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(['pm-task-edit-window-TabTaskEditMain', 'pm-task-edit-window-TabTaskEditPlan', 'pm-task-edit-window-TabTaskEditFact']);
  });

  it('?tab=TabTaskEditFact opens on the Fact tab', () => {
    openWindow('Task 111', { tab: 'TabTaskEditFact' });
    expect(hidden('pm-task-edit-window-fact')).toBe(false);
    expect(q('stub-fact-list')).not.toBeNull();
  });

  it('an unsaved form survives a visit of the other tab', () => {
    openWindow('Task 111');
    typeInto('pm-edit-name', 'Draft');
    press('pm-task-edit-window-TabTaskEditPlan');
    press('pm-task-edit-window-TabTaskEditMain');
    expect(inputValue('pm-edit-name')).toBe('Draft');
  });

  it('?tab=TabTaskEditPlan opens on the Plan tab', () => {
    openWindow('Task 111', { tab: 'TabTaskEditPlan' });
    expect(hidden('pm-task-edit-window-plan')).toBe(false);
  });

  it('Delete asks crud (the window is not closed first); Details goes to the task page', () => {
    const t = openWindow('Task 111');
    press('pm-edit-delete');
    expect(mockCrud.deleteTask).toHaveBeenCalledWith(t.rowGUID);
    press('pm-edit-open');
    expect(mockCrud.openInfo).toHaveBeenCalledWith(t.rowGUID);
    expect(q('pm-edit-name')).not.toBeNull();
  });

  it('Cancel / X close the window: a window the script did not open goes to the dashboard', () => {
    openWindow('Task 111');
    const close = jest.spyOn(window, 'close').mockImplementation(() => undefined);
    press('pm-edit-cancel');
    expect(close).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled(); // window.closed stays false in jsdom
    close.mockRestore();
  });

  it('no task in the link / an unknown task say so', () => {
    seedStore();
    renderUI(<PMTaskEditWindow taskGUID="" />);
    expect(q('pm-task-edit-window-nolink')).not.toBeNull();
    cleanupUI();
    renderUI(<PMTaskEditWindow taskGUID="does-not-exist" />);
    expect(q('pm-task-edit-window-missing')).not.toBeNull();
  });
});
