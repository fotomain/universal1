/** @jest-environment jsdom */
// Right click on a CELL of the task tree: "Copy cell" in the row menu, "Paste cell" when the copied value fits the column and the cell can be edited.
import { act } from 'react';
import { cleanupUI, fakeCrud, press, q, renderUI, seedStore } from '../../ui/pmUiTestKit';

jest.mock('expo-clipboard', () => ({ __esModule: true, setStringAsync: jest.fn(async () => undefined) }));
const mockSetString = require('expo-clipboard').setStringAsync as jest.Mock;
jest.mock('../../../../kit8/documents/fact/input/useOpenFactInput', () => ({ useOpenFactInput: () => jest.fn() }));
jest.mock('../../../../kit8/documents/vendor/invoice/useVendorInvoice', () => ({ useStartVendorInvoice: () => ({ start: jest.fn(), busy: false }) }));
jest.mock('../../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({ useStartPurchaseOrder: () => ({ start: jest.fn(), busy: false }) }));
jest.mock('../../../../kit8/documents/customer/invoice/useCustomerInvoice', () => ({ useStartCustomerInvoice: () => ({ start: jest.fn(), busy: false }) }));
jest.mock('../../../../kit8/documents/payment/fact/usePaymentFact', () => ({ useStartPaymentFact: () => ({ start: jest.fn(), busy: false, error: null }) }));
jest.mock('../../../../kit8/documents/timesheet/useTimesheet', () => ({ useCreateTimesheetFromTask: () => ({ create: jest.fn(), busy: false, error: null }) }));
jest.mock('../../../../kit8/pm/subproject/useCreateSubproject', () => ({ useCreateSubproject: () => ({ create: jest.fn(), busy: false }) }));
jest.mock('../../../../kit8/pm/tasktemplate/crud/useTaskTemplates', () => ({
  ...jest.requireActual('../../../../kit8/pm/tasktemplate/crud/useTaskTemplates'),
  useTaskTemplateCommands: () => new Proxy({}, { get: () => jest.fn() }),
  useTaskTemplatesQuery: () => ({ data: { rows: [], missing: false }, isLoading: false }),
}));

const PMTaskRowMenu = require('../../../../kit8/pm/view/task/PMTaskRowMenu').default;
const { usePMStore } = require('../../../../kit8/pm/store/store_pm');
const { cellClipboard, readCell, copyCell, pasteCell, canPasteCell, cellFamilyOf } = require('../../../../kit8/pm/view/tree/cellClipboard');

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
  act(() => { usePMStore.getState().setRowMenu(null); cellClipboard.set(null); });
});

describe('the cell clipboard (pure)', () => {
  test('a column family: Start, Finish, Days, % and custom columns are copied; Kanban and the name are not', () => {
    expect(cellFamilyOf('taskStartDate')).toBe('start');
    expect(cellFamilyOf('start')).toBe('start');
    expect(cellFamilyOf('taskFinishDate')).toBe('finish');
    expect(cellFamilyOf('taskDuration')).toBe('duration');
    expect(cellFamilyOf('progress')).toBe('progress');
    expect(cellFamilyOf('kanban')).toBeNull();
    expect(cellFamilyOf(null)).toBeNull();
  });

  test('the start of one task pastes into the start of another: the same command as the inline editor (a start constraint of the date)', async () => {
    const { byName } = seedStore();
    const a = byName('Task 111'), b = byName('Task 112');
    const clip = readCell(a.rowGUID, 'taskStartDate');
    expect(clip).toMatchObject({ family: 'start', value: usePMStore.getState().schedule[a.rowGUID].startMs });
    expect(await copyCell(a.rowGUID, 'taskStartDate')).toBe(true);
    expect(mockSetString).toHaveBeenCalledWith(clip.text);
    expect(cellClipboard.get()).toMatchObject({ family: 'start' });
    const crud = fakeCrud();
    expect(pasteCell(cellClipboard.get(), b.rowGUID, 'taskStartDate', crud)).toBeNull();
    expect(crud.setStartConstraint).toHaveBeenCalledWith(b.rowGUID, clip.value);
  });

  test('a value is pasted only into a column of its own kind', () => {
    const { byName } = seedStore();
    const a = byName('Task 111');
    const clip = readCell(a.rowGUID, 'progress');
    expect(canPasteCell(clip, 'progress')).toBe(true);
    expect(canPasteCell(clip, 'taskStartDate')).toBe(false);
    expect(canPasteCell(null, 'progress')).toBe(false);
    const crud = fakeCrud();
    expect(pasteCell(clip, a.rowGUID, 'taskStartDate', crud)).toMatch(/does not fit/);
    expect(crud.setStartConstraint).not.toHaveBeenCalled();
    expect(pasteCell({ ...clip, value: 40 }, a.rowGUID, 'progress', crud)).toBeNull();
    expect(crud.setProgress).toHaveBeenCalledWith(a.rowGUID, 40);
  });

  test('a duration is pasted as days', () => {
    const { byName } = seedStore();
    const a = byName('Task 111'), b = byName('Task 112');
    const clip = readCell(a.rowGUID, 'taskDuration');
    const crud = fakeCrud();
    expect(pasteCell(clip, b.rowGUID, 'taskDuration', crud)).toBeNull();
    expect(crud.setDurationDays).toHaveBeenCalledWith(b.rowGUID, clip.value);
  });
});

describe('the row menu of a cell', () => {
  function open(guid: string, cellField: string | null, cellEditable = true) {
    act(() => usePMStore.getState().setRowMenu({ guid, x: 100, y: 80, source: 'tree', cellField, cellEditable }));
  }

  test('a right click on a cell has Copy cell; with nothing copied there is no Paste cell; outside a cell neither', () => {
    const { byName } = seedStore();
    const a = byName('Task 111');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    open(a.rowGUID, 'taskStartDate');
    expect(q('pm-row-menu-copy-cell')).not.toBeNull();
    expect(q('pm-row-menu-paste-cell')).toBeNull();
    open(a.rowGUID, null);
    expect(q('pm-row-menu-copy-cell')).toBeNull();
    expect(q('pm-row-menu-paste-cell')).toBeNull();
  });

  test('Copy cell on one task, Paste cell on the Start of another task writes the date', async () => {
    const { byName } = seedStore();
    const a = byName('Task 111'), b = byName('Task 112');
    const crud = fakeCrud();
    renderUI(<PMTaskRowMenu crud={crud} />);
    open(a.rowGUID, 'taskStartDate');
    await act(async () => { press('pm-row-menu-copy-cell'); });
    const copied = cellClipboard.get();
    expect(copied).toMatchObject({ family: 'start' });
    open(b.rowGUID, 'taskStartDate');
    expect(q('pm-row-menu-paste-cell')).not.toBeNull();
    act(() => press('pm-row-menu-paste-cell'));
    expect(crud.setStartConstraint).toHaveBeenCalledWith(b.rowGUID, copied.value);
  });

  test('no Paste cell on another kind of column or on a cell that cannot be edited (a stage rolls up)', async () => {
    const { byName } = seedStore();
    const a = byName('Task 111'), b = byName('Task 112');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    await act(async () => { await copyCell(a.rowGUID, 'taskStartDate'); });
    open(b.rowGUID, 'progress');
    expect(q('pm-row-menu-paste-cell')).toBeNull();
    open(b.rowGUID, 'taskStartDate', false);
    expect(q('pm-row-menu-paste-cell')).toBeNull();
    expect(q('pm-row-menu-copy-cell')).not.toBeNull();
  });
});
