/** @jest-environment jsdom */
// PMTimesheetDocumentForm: the bar (Post is the LAST and a large button; Posted / Unpost for a posted sheet), the header (organization disabled, work center, dates), the rules of the period (month switch, asks
// before entered hours are dropped), "Create work center", the problems of Post (each names its line and day). The data hooks and the two big children are fakes.
import { act } from 'react';
import { cleanupUI, expectInOrder, press, q, qa, renderUI, textOf, typeInto } from '../../pm/ui/pmUiTestKit';

const mockDoc: Record<string, any> = {};
const mockOptions: Record<string, any> = {};
const mockMy: Record<string, any> = {};
jest.mock('../../../kit8/documents/timesheet/useTimesheet', () => ({ useTimesheetDocument: () => mockDoc, useTimesheetOptions: () => mockOptions, useMyWorkCenter: () => mockMy }));
const mockLines = jest.fn();
jest.mock('../../../kit8/documents/timesheet/PMTimesheetDocumentLines', () => ({ __esModule: true, default: (p: any) => { mockLines(p); return require('react').createElement('div', { 'data-testid': 'lines-stub' }); } }));
jest.mock('../../../kit8/pm/reports/monitor01/SelectPeriodButton', () => ({ __esModule: true, default: (p: any) => require('react').createElement('div', { 'data-testid': p.testID }) }));
const mockButtons: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const Real = jest.requireActual('../../../kit8/ui/components/common/ButtonApp').default;
  const Spy = (p: any) => { if (p.testID) mockButtons[p.testID] = p; return R.createElement(Real, p); };
  return { __esModule: true, default: Spy, ButtonApp: Spy };
});
const mockSelects: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/SelectItemFromListApp', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, disabled, error }: any) => R.createElement(TextInput, { testID, value, onChangeText, editable: !disabled, accessibilityLabel: error ? 'error' : undefined }) };
});
const mockAsk = jest.fn();
jest.mock('../../../kit8/ui/components/common/ModalAskComponent', () => ({ ModalAskComponent: (p: any) => { mockAsk(p); return require('react').createElement('div', { 'data-testid': p.testID, 'data-visible': String(!!p.visible) }); } }));
const mockUnits = jest.fn();
jest.mock('../../../kit8/ui/components/common/ModalWindowListToSelect', () => ({ __esModule: true, default: (p: any) => { mockUnits(p); return require('react').createElement('div', { 'data-testid': p.testID, 'data-visible': String(!!p.visible) }); } }));
jest.doMock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  const TextInputApp = ({ testID, value, disabled, onChangeText, label }: any) => R.createElement(TextInput, { testID, value, editable: !disabled, onChangeText, accessibilityLabel: label });
  return { __esModule: true, default: TextInputApp, TextInputApp };
});
const mockDispatch = jest.fn();
jest.doMock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => mockDispatch, useSelector: (fn: any) => fn({ uxuiState: {}, ...((globalThis as any).__pmTestReduxState || {}) }) }));
const PMTimesheetDocumentForm = require('../../../kit8/documents/timesheet/PMTimesheetDocumentForm').default;
import { TimesheetHeader, TimesheetLine } from '../../../kit8/documents/timesheet/timesheetModel';

const T = 'timesheet';
const NOW = new Date();
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const firstOfMonth = ymd(new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1)));
const lastOfMonth = ymd(new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 0)));
const day = (n: number) => ymd(new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), n)));
const header = (over: Partial<TimesheetHeader> = {}): TimesheetHeader => ({ rowGUID: 'h1', organization: 'o1', workCenter: 'wc1', startDate: firstOfMonth, finishDate: lastOfMonth, documentNumber: 'TS-00001', status: 'draft', ...over });
const line = (guid: string, over: Partial<TimesheetLine> = {}): TimesheetLine => ({ rowGUID: guid, project: 'p1', task: 't1', role: 'r1', budgetItem: 'b1', businessUnit: '', orderInList: 1, hours: 0, unitSumForBudget: 100, rateSource: 'taskLine', unitPrice: null, unitPriceCurrency: '', ...over });
function setDoc(h: TimesheetHeader | null, over: Record<string, any> = {}) {
  Object.keys(mockDoc).forEach((k) => delete mockDoc[k]);
  Object.assign(mockDoc, {
    header: h, lines: [line('l1')], entered: [{ lineGUID: 'l1', day: day(3), hours: 8 }], isLoading: false, error: null, busy: false,
    setHeader: jest.fn(async () => true), addLine: jest.fn(async () => 'new'), setLine: jest.fn(async () => true), deleteLine: jest.fn(async () => true), setHours: jest.fn(async () => true),
    post: jest.fn(async () => ({ status: 'posted', lines: 1, problems: [] })), unpost: jest.fn(async () => ({ status: 'draft', lines: 0, problems: [] })), remove: jest.fn(async () => true), ...over,
  });
}
function setOptions(over: Record<string, any> = {}) {
  Object.keys(mockOptions).forEach((k) => delete mockOptions[k]);
  Object.assign(mockOptions, { switches: { allWorkCenters: false, onlyCurrentMonth: true }, workCenters: [{ value: 'wc1', label: 'Anna K' }], projects: [], isLoading: false, titleOf: jest.fn(async (_t: string, id: string) => `Title of ${id}`), ...over });
}
function setMy(over: Record<string, any> = {}) {
  Object.keys(mockMy).forEach((k) => delete mockMy[k]);
  Object.assign(mockMy, { workCenter: 'wc1', isLoading: false, busy: false, error: null, create: jest.fn(async () => ({ status: 'created', workCenter: 'wc-new' })), unitChoices: null, closeUnitChoices: jest.fn(), ...over });
}
beforeEach(() => { setOptions(); setMy(); (globalThis as any).__pmTestReduxState = { activeUserState: { userOrganization: { rowGUID: 'o1', title: 'Acme Org' } } }; });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; [mockButtons, mockSelects].forEach((m) => Object.keys(m).forEach((k) => delete m[k])); });
const flush = () => act(async () => { await Promise.resolve(); });
const lastAsk = () => mockAsk.mock.calls.at(-1)![0];
const lastUnits = () => mockUnits.mock.calls.at(-1)![0];
const show = (onClose = jest.fn()) => { renderUI(<PMTimesheetDocumentForm documentGUID="h1" onClose={onClose} />); return onClose; };

describe('the bar', () => {
  it('a draft with entered hours: Delete · Close · Post - and Post is the LAST, a large button', () => {
    setDoc(header());
    show();
    expectInOrder([`${T}-delete`, `${T}-close`, `${T}-post`]);
    expect(mockButtons[`${T}-post`]).toMatchObject({ size: 'large', title: 'Post' });
    expect(q(`${T}-posted`)).toBeNull();
    expect(q(`${T}-unpost`)).toBeNull();
    expect(textOf(`${T}-title`)).toBe('Time sheet · TS-00001');
  });
  it('Post is not offered while no hour is entered', () => {
    setDoc(header(), { entered: [] });
    show();
    expect(q(`${T}-post`)).toBeNull();
  });
  it('a posted sheet: Unpost · Close · Posted (the same large size); no Delete, no Post', () => {
    setDoc(header({ status: 'posted' }));
    show();
    expectInOrder([`${T}-unpost`, `${T}-close`, `${T}-posted`]);
    expect(mockButtons[`${T}-posted`]).toMatchObject({ size: 'large' });
    expect(q(`${T}-delete`)).toBeNull();
    expect(q(`${T}-post`)).toBeNull();
  });
  it('Post posts; Unpost unposts; Delete deletes and closes', async () => {
    setDoc(header());
    const onClose = show();
    press(`${T}-post`);
    await flush();
    expect(mockDoc.post).toHaveBeenCalledTimes(1);
    press(`${T}-delete`);
    await flush();
    expect(mockDoc.remove).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanupUI();
    setDoc(header({ status: 'posted' }));
    show();
    press(`${T}-unpost`);
    await flush();
    expect(mockDoc.unpost).toHaveBeenCalledTimes(1);
  });
});

describe('the snack bar', () => {
  const lastSnack = () => mockDispatch.mock.calls.map((c) => c[0]).filter((a: any) => a?.payload?.message).at(-1);
  it('after a successful Post: "Time sheet TS-00001 posted: 8 hours, 1 cells" (not an error)', async () => {
    setDoc(header());
    show();
    press(`${T}-post`);
    await flush();
    expect(lastSnack().payload).toMatchObject({ message: 'Time sheet TS-00001 posted: 8 hours, 1 cells', isError: false });
  });
  it('a refused Post shows the problems, no snack bar', async () => {
    mockDispatch.mockClear();
    setDoc(header(), { post: jest.fn(async () => ({ status: 'refused', lines: 1, problems: [{ lineGUID: 'l1', problem: 'roleMissing' }] })) });
    show();
    press(`${T}-post`);
    await flush();
    expect(lastSnack()).toBeUndefined();
  });
  it('after Unpost: the sheet is a draft again', async () => {
    setDoc(header({ status: 'posted' }));
    show();
    press(`${T}-unpost`);
    await flush();
    expect(lastSnack().payload.message).toBe('Time sheet TS-00001 unposted: it is a draft again');
  });
});

describe('the header', () => {
  it('the organization is shown and DISABLED; the number too; the dates can be edited in a draft only', () => {
    setDoc(header());
    show();
    expect((q(`${T}-field-organization`) as HTMLInputElement).value).toBe('Acme Org');
    expect((q(`${T}-field-organization`) as HTMLInputElement).disabled || (q(`${T}-field-organization`) as HTMLInputElement).readOnly).toBe(true);
    expect((q(`${T}-field-number`) as HTMLInputElement).value).toBe('TS-00001');
    expect((q(`${T}-field-startDate`) as HTMLInputElement).readOnly).toBe(false);
    cleanupUI();
    setDoc(header({ status: 'posted' }));
    show();
    expect((q(`${T}-field-startDate`) as HTMLInputElement).readOnly).toBe(true);
    expect(q(`${T}-period-button`)).toBeNull();
  });
  it('the work center select lists what the user may pick', () => {
    setDoc(header());
    show();
    expect(mockSelects[`${T}-field-workCenter`].items).toEqual([{ value: 'wc1', label: 'Anna K' }]);
    expect(mockSelects[`${T}-field-workCenter`].value).toBe('wc1');
  });
  it('the hours of the sheet and the number of lines are shown', () => {
    setDoc(header());
    show();
    expect(textOf(`${T}-totals`)).toContain('8');
  });
});

describe('the period', () => {
  it('a valid period inside the month is saved - BOTH dates together', async () => {
    setDoc(header({ startDate: day(1), finishDate: day(28) }), { entered: [] });
    show();
    typeInto(`${T}-field-startDate`, day(5));
    await flush();
    expect(mockDoc.setHeader).toHaveBeenCalledWith({ startDate: day(5), finishDate: day(28) });
  });
  it('the month switch is on: a period outside the current month is refused with a message and not saved', async () => {
    setDoc(header({ startDate: day(1), finishDate: day(28) }), { entered: [] });
    show();
    typeInto(`${T}-field-startDate`, '2020-01-05');
    await flush();
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    expect(textOf(`${T}-period-message`)).toMatch(/inside the current month/);
  });
  it('the month switch is off: any period up to 62 days; a longer one is refused', async () => {
    setOptions({ switches: { allWorkCenters: false, onlyCurrentMonth: false } });
    setDoc(header({ startDate: day(1), finishDate: day(28) }), { entered: [] });
    show();
    typeInto(`${T}-field-startDate`, '2020-01-05');
    await flush();
    expect(textOf(`${T}-period-message`)).toMatch(/at most 62 days/);
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    typeInto(`${T}-field-startDate`, ymd(new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1))));
    typeInto(`${T}-field-finishDate`, day(10));
    await flush();
  });
  it('a finish date before the start date is refused', async () => {
    setDoc(header({ startDate: day(10), finishDate: day(28) }), { entered: [] });
    show();
    typeInto(`${T}-field-finishDate`, day(2));
    await flush();
    expect(textOf(`${T}-period-message`)).toMatch(/before the start date/);
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
  });
  it('a shorter period that would drop entered hours ASKS first; Change saves it, Cancel does not', async () => {
    setDoc(header({ startDate: day(1), finishDate: day(28) }));                      // 8 hours on day 3
    show();
    typeInto(`${T}-field-startDate`, day(5));
    await flush();
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    expect(lastAsk()).toMatchObject({ visible: true });
    expect(lastAsk().modalBody).toMatch(/1 cells/);
    act(() => lastAsk().onCancel());
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    expect(lastAsk()).toMatchObject({ visible: false });
    typeInto(`${T}-field-startDate`, day(6));
    await flush();
    act(() => lastAsk().onConfirm());
    expect(mockDoc.setHeader).toHaveBeenCalledWith({ startDate: day(6), finishDate: day(28) });
  });
  it('a quick choice is offered inside the month only while the month switch is on', () => {
    setDoc(header());
    show();
    expect(q(`${T}-quick-thisMonth`)).not.toBeNull();
    expect(q(`${T}-quick-previousMonth`)).toBeNull();
    cleanupUI();
    setOptions({ switches: { allWorkCenters: false, onlyCurrentMonth: false } });
    setDoc(header());
    show();
    expect(q(`${T}-quick-previousMonth`)).not.toBeNull();
  });
});

describe('the work center', () => {
  it('a sheet made from a Time line keeps THAT work center: it is added to the select with its title although the user may not pick it', async () => {
    setDoc(header({ workCenter: 'wc-other' }));
    show();
    await flush();
    expect(mockOptions.titleOf).toHaveBeenCalledWith('workCenterTable', 'wc-other');
    expect(mockSelects[`${T}-field-workCenter`].items).toEqual([{ value: 'wc-other', label: 'Title of wc-other' }, { value: 'wc1', label: 'Anna K' }]);
    expect(mockSelects[`${T}-field-workCenter`].value).toBe('wc-other');
  });
  it('a work center that is in the list is not asked for again', async () => {
    setDoc(header());
    show();
    await flush();
    expect(mockOptions.titleOf).not.toHaveBeenCalled();
  });
  it('a new work center asks first when roles / budget items are chosen (they are cleared); else it is saved at once', async () => {
    setDoc(header());
    show();
    act(() => mockSelects[`${T}-field-workCenter`].onSelect('wc2'));
    expect(mockDoc.setHeader).not.toHaveBeenCalled();
    expect(lastAsk()).toMatchObject({ visible: true });
    act(() => lastAsk().onConfirm());
    expect(mockDoc.setHeader).toHaveBeenCalledWith({ timesheetWorkCenter: 'wc2' });
    cleanupUI();
    jest.clearAllMocks();
    setDoc(header(), { lines: [line('l1', { role: '', budgetItem: '' })] });
    show();
    act(() => mockSelects[`${T}-field-workCenter`].onSelect('wc2'));
    expect(mockDoc.setHeader).toHaveBeenCalledWith({ timesheetWorkCenter: 'wc2' });
  });
  it('"Create work center": shown while the user has none; it makes the work center and the sheet takes it', async () => {
    setMy({ workCenter: '' });
    setDoc(header({ workCenter: '' }));
    show();
    expect(q(`${T}-create-work-center`)).not.toBeNull();
    press(`${T}-create-work-center`);
    await flush();
    expect(mockMy.create).toHaveBeenCalledWith(null);
    expect(mockDoc.setHeader).toHaveBeenCalledWith({ timesheetWorkCenter: 'wc-new' });
  });
  it('the button is not shown when the user has a work center, nor in a posted sheet', () => {
    setDoc(header());
    show();
    expect(q(`${T}-create-work-center`)).toBeNull();
    cleanupUI();
    setMy({ workCenter: '' });
    setDoc(header({ status: 'posted', workCenter: 'wc1' }));
    show();
    expect(q(`${T}-create-work-center`)).toBeNull();
  });
  it('when the database cannot tell the business unit the user chooses it in a window, then the work center is made', async () => {
    setMy({ workCenter: '', unitChoices: [{ value: 'bu1', label: 'Unit 1' }, { value: 'bu2', label: 'Unit 2' }], create: jest.fn(async () => ({ status: 'created', workCenter: 'wc-new' })) });
    setDoc(header({ workCenter: '' }));
    show();
    expect(lastUnits()).toMatchObject({ visible: true, items: [{ id: 'bu1', title: 'Unit 1' }, { id: 'bu2', title: 'Unit 2' }] });
    act(() => lastUnits().onSelect('bu2'));
    await flush();
    expect(mockMy.closeUnitChoices).toHaveBeenCalled();
    expect(mockMy.create).toHaveBeenCalledWith('bu2');
    expect(mockDoc.setHeader).toHaveBeenCalledWith({ timesheetWorkCenter: 'wc-new' });
  });
  it('a sheet with no work center says what to do', () => {
    setMy({ workCenter: '' });
    setDoc(header({ workCenter: '' }));
    show();
    expect(textOf(`${T}-no-work-center`)).toMatch(/Create work center/);
  });
});

describe('Post refused: the problems name their line and day', () => {
  it('a list of problems under the bar', async () => {
    setDoc(header(), { lines: [line('l1'), line('l2')], post: jest.fn(async () => ({ status: 'refused', lines: 2, problems: [
      { lineGUID: 'l2', problem: 'noRate', day: day(3) }, { lineGUID: null, problem: 'dayOver24', day: day(4), hours: 30, otherSheet: 'TS-00001' }, { lineGUID: 'l1', problem: 'roleMissing' }] })) });
    show();
    press(`${T}-post`);
    await flush();
    expect(qa(`${T}-problem-`)).toHaveLength(3);
    expect(textOf(`${T}-problem-0`)).toContain('Line 2: There is no rate for the hour');
    expect(textOf(`${T}-problem-0`)).toContain(day(3));
    expect(textOf(`${T}-problem-1`)).toContain('more than 24 hours');
    expect(textOf(`${T}-problem-1`)).toContain('TS-00001');
    expect(textOf(`${T}-problem-2`)).toContain('Line 1: A line with hours needs its role');
    expect(q(`${T}-posted`)).toBeNull();
  });
  it('a successful Post shows no problem', async () => {
    setDoc(header());
    show();
    press(`${T}-post`);
    await flush();
    expect(q(`${T}-problems`)).toBeNull();
  });
  it('an error of a command is shown as text', () => {
    setDoc(header(), { error: 'time sheet: more than 24 hours on 2026-10-03' });
    show();
    expect(textOf(`${T}-error`)).toContain('more than 24 hours');
  });
});

describe('the lines child gets the hooks', () => {
  it('the sheet, its lines, its entered hours and the commands of the document', () => {
    setDoc(header());
    show();
    const p = mockLines.mock.calls.at(-1)![0];
    expect(p).toMatchObject({ edit: true, lines: [expect.objectContaining({ rowGUID: 'l1' })], entered: [{ lineGUID: 'l1', day: day(3), hours: 8 }] });
    p.onAddLine();
    expect(mockDoc.addLine).toHaveBeenCalled();
    p.onSetHours('l1', day(4), 2);
    expect(mockDoc.setHours).toHaveBeenCalledWith('l1', day(4), 2);
    p.onDeleteLine('l1');
    expect(mockDoc.deleteLine).toHaveBeenCalledWith('l1');
    p.onSetLine('l1', { timesheetLineRole: 'r2' });
    expect(mockDoc.setLine).toHaveBeenCalledWith('l1', { timesheetLineRole: 'r2' });
  });
  it('a posted sheet is not editable', () => {
    setDoc(header({ status: 'posted' }));
    show();
    expect(mockLines.mock.calls.at(-1)![0].edit).toBe(false);
  });
});
