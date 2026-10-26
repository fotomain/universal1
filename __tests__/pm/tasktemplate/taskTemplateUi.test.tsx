/** @jest-environment jsdom */
// Task templates UI: the two items of the task menu, the "Save to template" window, the "Fill from template" picker.
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, mustGet, OWNER, press, q, qa, renderUI, seedStore, textOf, typeInto } from '../ui/pmUiTestKit';

const mockCommands: Record<string, jest.Mock> = {};
let mockRows: any[] = [];
// the menus / windows read the commands and the list from the hooks of crud/useTaskTemplates (they need the Supabase / react-query providers): the plain openers stay real
jest.mock('../../../kit8/pm/tasktemplate/crud/useTaskTemplates', () => ({
  ...jest.requireActual('../../../kit8/pm/tasktemplate/crud/useTaskTemplates'),
  useTaskTemplateCommands: () =>
    new Proxy({}, { get: (_t, k: string) => (k === 'validateTitle' ? jest.requireActual('../../../kit8/pm/tasktemplate/model/taskTemplateTypes').validateTaskTemplateTitle : (mockCommands[k] ??= jest.fn())) }),
  useTaskTemplatesQuery: () => ({ data: { rows: mockRows, missing: false }, isLoading: false }),
}));
jest.mock('../../../kit8/documents/fact/input/useOpenFactInput', () => ({ useOpenFactInput: () => jest.fn() }));
jest.mock('../../../kit8/documents/vendor/invoice/useVendorInvoice', () => ({ useStartVendorInvoice: () => ({ start: jest.fn(), busy: false }) }));
jest.mock('../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({ useStartPurchaseOrder: () => ({ start: jest.fn(), busy: false }) }));
jest.mock('../../../kit8/documents/customer/invoice/useCustomerInvoice', () => ({ useStartCustomerInvoice: () => ({ start: jest.fn(), busy: false }) }));
jest.mock('../../../kit8/documents/payment/fact/usePaymentFact', () => ({ useStartPaymentFact: () => ({ start: jest.fn(), busy: false, error: null }) }));
jest.mock('../../../kit8/documents/timesheet/useTimesheet', () => ({ useCreateTimesheetFromTask: () => ({ create: jest.fn(), busy: false, error: null }) }));
jest.mock('../../../kit8/pm/subproject/useCreateSubproject', () => ({ useCreateSubproject: () => ({ create: jest.fn(), busy: false }) }));

const PMTaskRowMenu = require('../../../kit8/pm/view/task/PMTaskRowMenu').default;
const PMTaskTemplateWindows = require('../../../kit8/pm/tasktemplate/view/PMTaskTemplateWindows').default;
const { usePMStore } = require('../../../kit8/pm/store/store_pm');
const { usePMTaskTemplateStore } = require('../../../kit8/pm/tasktemplate/store/store_task_template');
const { normalizeTaskTemplate } = require('../../../kit8/pm/tasktemplate/model/taskTemplateTypes');

const tpl = (guid: string, title: string, owner: string, json: Record<string, any> = {}) =>
  normalizeTaskTemplate({ rowGUID: guid, rowOrganizationGUID: 'org', rowOwnerGUID: owner, created_at: '2026-10-26T10:00:00.000Z', rowJSON: { templateTitle: title, templateKind: 'stage', templateRowCount: 3, templateLineCount: 4, ...json } });

beforeEach(() => {
  mockRows = [];
  act(() => usePMTaskTemplateStore.setState({ savePrompt: null, fillPickerTaskGUID: null, busy: false }));
});
afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
  for (const k of Object.keys(mockCommands)) delete mockCommands[k];
  act(() => usePMStore.getState().setRowMenu(null));
});

describe('the task menu', () => {
  function openMenu() {
    const { byName } = seedStore();
    const t = byName('Task 111');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 100, y: 80, source: 'tree' }));
    return t;
  }
  it('has "Save to template" and "Fill from template", after Duplicate and before Copy task info', () => {
    openMenu();
    expectInOrder(['pm-row-menu-duplicate', 'pm-row-menu-save-to-template', 'pm-row-menu-fill-from-template', 'pm-row-menu-copy-info']);
    expect(textOf('pm-row-menu-save-to-template')).toContain('Save to template');
    expect(textOf('pm-row-menu-fill-from-template')).toContain('Fill from template');
  });
  it('Save to template opens the title window with the name of the task; Fill from template opens the picker for the task; the menu closes', () => {
    const t = openMenu();
    press('pm-row-menu-save-to-template');
    expect(usePMStore.getState().rowMenu).toBeNull();
    expect(usePMTaskTemplateStore.getState().savePrompt).toEqual({ mode: 'save', taskGUID: t.rowGUID, title: t.rowJSON.taskDescription, description: '' });
    act(() => usePMTaskTemplateStore.getState().setSavePrompt(null));
    act(() => usePMStore.getState().setRowMenu({ guid: t.rowGUID, x: 100, y: 80, source: 'tree' }));
    press('pm-row-menu-fill-from-template');
    expect(usePMTaskTemplateStore.getState().fillPickerTaskGUID).toBe(t.rowGUID);
  });
});

describe('the "Save to template" window', () => {
  const open = (extra: Record<string, any> = {}) => {
    renderUI(<PMTaskTemplateWindows ownerGUID={OWNER} projectGUID="p1" />);
    act(() => usePMTaskTemplateStore.getState().setSavePrompt({ mode: 'save', taskGUID: 'task-1', title: 'Pour concrete', description: '', ...extra }));
  };
  it('shows the title of the task; an empty title is refused under the input, nothing is saved', () => {
    open();
    expect(textOf('pm-task-template-save-heading')).toBe('Save to template');
    expect((mustGet('pm-task-template-title-input') as HTMLInputElement).value).toBe('Pour concrete');
    typeInto('pm-task-template-title-input', '   ');
    press('pm-task-template-save-ok');
    expect(textOf('pm-task-template-title-error')).toBe('Enter a template title');
    expect(mockCommands.saveTemplate).toBeUndefined();
  });
  it('Save template: the task, the title and the description go to the command, then the window closes', async () => {
    open();
    mockCommands.saveTemplate = jest.fn(async () => 'new-guid');
    mockCommands.closeSavePrompt = jest.fn();
    typeInto('pm-task-template-title-input', 'Foundation');
    typeInto('pm-task-template-description-input', 'for houses');
    await act(async () => { press('pm-task-template-save-ok'); });
    expect(mockCommands.saveTemplate).toHaveBeenCalledWith('task-1', 'Foundation', 'for houses');
    expect(mockCommands.closeSavePrompt).toHaveBeenCalled();
  });
  it('a failed save keeps the window open', async () => {
    open();
    mockCommands.saveTemplate = jest.fn(async () => null);
    mockCommands.closeSavePrompt = jest.fn();
    await act(async () => { press('pm-task-template-save-ok'); });
    expect(mockCommands.saveTemplate).toHaveBeenCalled();
    expect(mockCommands.closeSavePrompt).not.toHaveBeenCalled();
  });
  it('rename: the heading and the command are the rename ones', async () => {
    open({ mode: 'rename', taskGUID: undefined, templateGUID: 'tpl-1', title: 'Old', description: 'd' });
    expect(textOf('pm-task-template-save-heading')).toBe('Rename template');
    mockCommands.renameTemplate = jest.fn(async () => true);
    typeInto('pm-task-template-title-input', 'New');
    await act(async () => { press('pm-task-template-save-ok'); });
    expect(mockCommands.renameTemplate).toHaveBeenCalledWith('tpl-1', 'New', 'd');
  });
});

describe('the "Fill from template" picker', () => {
  const open = (rows: any[]) => {
    mockRows = rows;
    seedStore();
    renderUI(<PMTaskTemplateWindows ownerGUID={OWNER} projectGUID="p1" />);
    act(() => usePMTaskTemplateStore.getState().setFillPickerTaskGUID('task-9'));
  };
  it('says so when there is no template', () => {
    open([]);
    expect(textOf('pm-task-template-empty')).toContain('Save to template');
  });
  it('lists the templates of the organization with their texts; search narrows the list', () => {
    open([tpl('a', 'Foundation', OWNER), tpl('b', 'Roof', 'someone-else', { templateKind: 'task', templateRowCount: 1, templateLineCount: 2, templateCreatedByEmail: 'bob@acme.test' })]);
    expect(qa('pm-task-template-row-')).toEqual(['pm-task-template-row-a', 'pm-task-template-row-b']);
    expect(textOf('pm-task-template-row-a')).toContain('Stage · 3 rows · 4 lines');
    expect(textOf('pm-task-template-row-a')).toContain('by you');
    expect(textOf('pm-task-template-row-b')).toContain('by bob@acme.test');
    typeInto('pm-task-template-search', 'roo');
    expect(qa('pm-task-template-row-')).toEqual(['pm-task-template-row-b']);
    typeInto('pm-task-template-search', 'zzz');
    expect(textOf('pm-task-template-empty')).toBe('Nothing found');
  });
  it('only the templates of the user have Rename and Delete', () => {
    open([tpl('a', 'Foundation', OWNER), tpl('b', 'Roof', 'someone-else')]);
    expect(q('pm-task-template-rename-a')).not.toBeNull();
    expect(q('pm-task-template-delete-a')).not.toBeNull();
    expect(q('pm-task-template-rename-b')).toBeNull();
    expect(q('pm-task-template-delete-b')).toBeNull();
  });
  it('select + Fill: the command gets the template, the task and replace = false; the window closes after a success', async () => {
    const rows = [tpl('a', 'Foundation', OWNER), tpl('b', 'Roof', 'someone-else')];
    open(rows);
    mockCommands.fillTask = jest.fn(async () => ({ mode: 'tree', tasks: 2, lines: 4, dependencies: 1 }));
    mockCommands.closeFillPicker = jest.fn();
    await act(async () => { press('pm-task-template-fill-ok'); });
    expect(mockCommands.fillTask).not.toHaveBeenCalled(); // nothing selected
    press('pm-task-template-row-b');
    await act(async () => { press('pm-task-template-fill-ok'); });
    expect(mockCommands.fillTask).toHaveBeenCalledWith(rows[1], 'task-9', false);
    expect(mockCommands.closeFillPicker).toHaveBeenCalled();
  });
  it('"Replace what the row has now" sends replace = true; a cancelled / failed fill keeps the window', async () => {
    const rows = [tpl('a', 'Foundation', OWNER)];
    open(rows);
    mockCommands.fillTask = jest.fn(async () => null);
    mockCommands.closeFillPicker = jest.fn();
    press('pm-task-template-row-a');
    press('pm-task-template-replace');
    await act(async () => { press('pm-task-template-fill-ok'); });
    expect(mockCommands.fillTask).toHaveBeenCalledWith(rows[0], 'task-9', true);
    expect(mockCommands.closeFillPicker).not.toHaveBeenCalled();
  });
  it('a big template (more than 500 rows) shows a note when it is selected', () => {
    open([tpl('a', 'Small', OWNER), tpl('b', 'Huge', OWNER, { templateRowCount: 4000 })]);
    press('pm-task-template-row-a');
    expect(q('pm-task-template-big-note')).toBeNull();
    press('pm-task-template-row-b');
    expect(textOf('pm-task-template-big-note')).toContain('big template');
  });
  it('Delete of an own template goes to the command; Rename opens the rename window', async () => {
    const rows = [tpl('a', 'Foundation', OWNER)];
    open(rows);
    mockCommands.removeTemplate = jest.fn(async () => true);
    mockCommands.openRename = jest.fn();
    press('pm-task-template-rename-a');
    expect(mockCommands.openRename).toHaveBeenCalledWith(rows[0]);
    await act(async () => { press('pm-task-template-delete-a'); });
    expect(mockCommands.removeTemplate).toHaveBeenCalledWith(rows[0]);
  });
});
