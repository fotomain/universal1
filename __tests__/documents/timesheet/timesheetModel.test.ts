// timesheetModel: the days of a period (both dates included), the period rules (the database checks them again), the settings per Person (Person -> Organization -> built-in default), hours and the 24-hour rule,
// states / commands, the order a line is filled in, the answers of the RPCs and the texts of the problems.
import {
  EMPTY_TIMESHEET_FILTER, TIMESHEET_ALL_WORK_CENTERS_KEY, TIMESHEET_ONLY_CURRENT_MONTH_KEY, TimesheetEntered, addDays, canDeleteTimesheet, canEditTimesheet, canPostTimesheet, canUnpostTimesheet, cellKey, createSkippedText,
  currentMonthPeriod, dayColumnTitle, dayCount, daysBetween, enteredMap, enteredOutside, headerOfRow, hoursOfDay, hoursOfLine, hoursOfSheet, isDay, isWeekend, lineEnabled, lineOfRow, listRowOf, monthEnd, monthStart,
  formatDateTime, parseCreateAnswer, parseListAnswer, parseMyWorkCenterAnswer, parsePostAnswer, rowTitleOf, timesheetFilterActive, timesheetFilterToRpc, timesheetHoursProblem, timesheetPeriodProblem, timesheetPath, timesheetListPath,
  timesheetProblemLine, timesheetProblemText, timesheetSettingOf, lineMenuAvailability, hourCostText, timesheetSettingsOf, todayDay,
} from '../../../kit8/documents/timesheet/timesheetModel';

const NOW = new Date('2026-10-21T10:00:00Z');

describe('days', () => {
  it('isDay accepts a real day only', () => {
    expect(isDay('2026-10-21')).toBe(true);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('21.10.2026')).toBe(false);
    expect(isDay(null)).toBe(false);
  });
  it('daysBetween: BOTH dates are included - 7 days = 7 columns', () => {
    expect(daysBetween('2026-10-05', '2026-10-11')).toHaveLength(7);
    expect(daysBetween('2026-10-05', '2026-10-05')).toEqual(['2026-10-05']);
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
  it('dayCount: a whole month, a leap February, a wrong period is 0', () => {
    expect(dayCount('2026-10-01', '2026-10-31')).toBe(31);
    expect(dayCount('2028-02-01', '2028-02-29')).toBe(29);
    expect(dayCount('2026-10-05', '2026-10-04')).toBe(0);
    expect(dayCount('x', '2026-10-04')).toBe(0);
    expect(daysBetween('2026-10-05', '2026-10-04')).toEqual([]);
  });
  it('addDays / monthStart / monthEnd / the current month', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(monthStart('2026-10-21')).toBe('2026-10-01');
    expect(monthEnd('2026-10-21')).toBe('2026-10-31');
    expect(monthEnd('2026-02-10')).toBe('2026-02-28');
    expect(todayDay(NOW)).toBe('2026-10-21');
    expect(currentMonthPeriod(NOW)).toEqual({ startDate: '2026-10-01', finishDate: '2026-10-31' });
  });
  it('weekdays: the column title and the weekend', () => {
    expect(dayColumnTitle('2026-10-21')).toBe('Wed 21');
    expect(isWeekend('2026-10-24')).toBe(true);
    expect(isWeekend('2026-10-25')).toBe(true);
    expect(isWeekend('2026-10-26')).toBe(false);
  });
});

describe('the period rules', () => {
  it('month switch on (default): both dates in ONE month and that month is today\'s', () => {
    expect(timesheetPeriodProblem('2026-10-01', '2026-10-31', true, NOW)).toBeNull();
    expect(timesheetPeriodProblem('2026-10-20', '2026-10-21', true, NOW)).toBeNull();
    expect(timesheetPeriodProblem('2026-09-01', '2026-09-30', true, NOW)).toBe('outsideCurrentMonth');
    expect(timesheetPeriodProblem('2026-10-20', '2026-11-02', true, NOW)).toBe('outsideCurrentMonth');
  });
  it('one day of tolerance for the time zone: the last day of the month still allows next month, the first day the previous one', () => {
    const lastDay = new Date('2026-10-31T23:30:00Z');
    expect(timesheetPeriodProblem('2026-11-01', '2026-11-30', true, lastDay)).toBeNull();
    const firstDay = new Date('2026-11-01T00:30:00Z');
    expect(timesheetPeriodProblem('2026-10-01', '2026-10-31', true, firstDay)).toBeNull();
    expect(timesheetPeriodProblem('2026-09-01', '2026-09-30', true, firstDay)).toBe('outsideCurrentMonth');
  });
  it('month switch off: any period of at most 62 days (both dates included)', () => {
    expect(dayCount('2026-08-01', '2026-10-01')).toBe(62);
    expect(timesheetPeriodProblem('2026-08-01', '2026-09-30', false, NOW)).toBeNull();            // 61 days
    expect(timesheetPeriodProblem('2026-08-01', '2026-10-01', false, NOW)).toBeNull();            // 62 days
    expect(timesheetPeriodProblem('2026-08-01', '2026-10-02', false, NOW)).toBe('tooLong');       // 63 days
  });
  it('a missing / reversed date is a problem in both modes', () => {
    expect(timesheetPeriodProblem('', '2026-10-01', true, NOW)).toBe('dateMissing');
    expect(timesheetPeriodProblem('2026-10-05', '2026-10-01', false, NOW)).toBe('finishBeforeStart');
  });
});

describe('the settings: Person -> Organization -> built-in default', () => {
  it('built-in defaults: the first is false, the second is true (opposite)', () => {
    expect(timesheetSettingsOf(null, null)).toEqual({ timesheetAllWorkCenterInputAvailable: false, timesheetOnlyCurrentMonthInputEnabled: true });
    expect(timesheetSettingOf(TIMESHEET_ALL_WORK_CENTERS_KEY, {}, {})).toEqual({ value: false, source: 'default' });
  });
  it('the Organization value is the default of a Person without a value', () => {
    expect(timesheetSettingOf(TIMESHEET_ALL_WORK_CENTERS_KEY, {}, { timesheetAllWorkCenterInputAvailable: true })).toEqual({ value: true, source: 'organization' });
    expect(timesheetSettingOf(TIMESHEET_ONLY_CURRENT_MONTH_KEY, null, { timesheetOnlyCurrentMonthInputEnabled: false })).toEqual({ value: false, source: 'organization' });
  });
  it('the value of the Person wins over the Organization', () => {
    expect(timesheetSettingOf(TIMESHEET_ALL_WORK_CENTERS_KEY, { timesheetAllWorkCenterInputAvailable: false }, { timesheetAllWorkCenterInputAvailable: true })).toEqual({ value: false, source: 'person' });
    expect(timesheetSettingOf(TIMESHEET_ONLY_CURRENT_MONTH_KEY, { timesheetOnlyCurrentMonthInputEnabled: false }, { timesheetOnlyCurrentMonthInputEnabled: true }).value).toBe(false);
  });
  it('a value that is not a boolean is "not stored"; the strings true / false of a JSON text are read', () => {
    expect(timesheetSettingOf(TIMESHEET_ALL_WORK_CENTERS_KEY, { timesheetAllWorkCenterInputAvailable: 'yes' }, null).source).toBe('default');
    expect(timesheetSettingOf(TIMESHEET_ALL_WORK_CENTERS_KEY, { timesheetAllWorkCenterInputAvailable: 'true' }, null).value).toBe(true);
  });
});

const rows = (...r: [string, string, number][]): TimesheetEntered[] => r.map(([lineGUID, day, hours]) => ({ lineGUID, day, hours }));
describe('hours', () => {
  const e = rows(['l1', '2026-10-05', 8], ['l1', '2026-10-06', 4.5], ['l2', '2026-10-05', 10]);
  const h = { startDate: '2026-10-01', finishDate: '2026-10-31' };
  it('totals of a line, a day and the sheet', () => {
    expect(hoursOfLine(e, 'l1')).toBe(12.5);
    expect(hoursOfDay(e, '2026-10-05')).toBe(18);
    expect(hoursOfSheet(e)).toBe(22.5);
    expect(hoursOfSheet([])).toBe(0);
  });
  it('enteredMap: only entered cells are in it (an empty cell is NOT there)', () => {
    const m = enteredMap(e);
    expect(m.get(cellKey('l1', '2026-10-05'))).toBe(8);
    expect(m.has(cellKey('l1', '2026-10-07'))).toBe(false);
  });
  it('empty and 0 are fine; a number above 24 is not; the day of the sheet is at most 24', () => {
    expect(timesheetHoursProblem(e, 'l1', '2026-10-07', null, h)).toBeNull();
    expect(timesheetHoursProblem(e, 'l1', '2026-10-07', 0, h)).toBeNull();
    expect(timesheetHoursProblem(e, 'l1', '2026-10-07', 25, h)).toBe('tooMany');
    expect(timesheetHoursProblem(e, 'l1', '2026-10-07', -1, h)).toBe('notNumber');
    expect(timesheetHoursProblem(e, 'l1', '2026-10-05', 10, h)).toBeNull();               // l2 has 10 and l1's own 8 is replaced by 10: 20
  });
  it('the cell being replaced does not count twice: 24 - the others', () => {
    expect(timesheetHoursProblem(e, 'l1', '2026-10-05', 14, h)).toBeNull();               // others = 10 (l2): 10 + 14 = 24
    expect(timesheetHoursProblem(e, 'l1', '2026-10-05', 14.5, h)).toBe('dayOver24');
    expect(timesheetHoursProblem(e, 'l3', '2026-10-05', 7, h)).toBe('dayOver24');        // others = 18: 18 + 7 = 25
  });
  it('a day outside the period is refused', () => {
    expect(timesheetHoursProblem(e, 'l1', '2026-11-01', 1, h)).toBe('outsidePeriod');
  });
  it('enteredOutside: the cells a shorter period would drop', () => {
    expect(enteredOutside(e, '2026-10-06', '2026-10-31')).toEqual(rows(['l1', '2026-10-05', 8], ['l2', '2026-10-05', 10]));
    expect(enteredOutside(e, '2026-10-01', '2026-10-31')).toEqual([]);
  });
});

describe('states, commands and the order a line is filled in', () => {
  it('a draft is edited and deleted; a posted sheet is unposted; Post needs at least one entered cell', () => {
    expect([canEditTimesheet({ status: 'draft' }), canEditTimesheet({ status: 'posted' })]).toEqual([true, false]);
    expect([canDeleteTimesheet({ status: 'draft' }), canDeleteTimesheet({ status: 'posted' })]).toEqual([true, false]);
    expect([canUnpostTimesheet({ status: 'draft' }), canUnpostTimesheet({ status: 'posted' })]).toEqual([false, true]);
    expect(canPostTimesheet({ status: 'draft' }, 0)).toBe(false);
    expect(canPostTimesheet({ status: 'draft' }, 3)).toBe(true);
    expect(canPostTimesheet({ status: 'posted' }, 3)).toBe(false);
  });
  it('Project -> Task -> Role -> Budget item -> Business unit -> hours: each is enabled after the one before it', () => {
    const h = { status: 'draft' as const, workCenter: 'wc1' };
    expect(lineEnabled({ project: '', task: '', role: '' }, h, 0)).toEqual({ project: true, task: false, role: false, budgetItem: false, businessUnit: false, hours: false });
    expect(lineEnabled({ project: 'p', task: '', role: '' }, h, 0)).toMatchObject({ task: true, role: false });
    expect(lineEnabled({ project: 'p', task: 't', role: '' }, h, 0)).toMatchObject({ role: true, budgetItem: false, hours: false });
    expect(lineEnabled({ project: 'p', task: 't', role: 'r' }, h, 0)).toMatchObject({ budgetItem: true, businessUnit: false, hours: true });
    expect(lineEnabled({ project: 'p', task: 't', role: 'r' }, h, 2)).toMatchObject({ businessUnit: true });
  });
  it('no work center: the role is closed; a posted sheet closes everything', () => {
    expect(lineEnabled({ project: 'p', task: 't', role: 'r' }, { status: 'draft', workCenter: '' }, 1)).toMatchObject({ role: false, hours: false });
    expect(Object.values(lineEnabled({ project: 'p', task: 't', role: 'r' }, { status: 'posted', workCenter: 'wc1' }, 1)).every((v) => v === false)).toBe(true);
  });
});

describe('rows and answers', () => {
  it('headerOfRow / lineOfRow / listRowOf read the database rows', () => {
    expect(headerOfRow({ rowGUID: 'h1', rowOrganizationGUID: 'o1', timesheetWorkCenter: 'wc1', startDate: '2026-10-01', finishDate: '2026-10-31', rowJSON: { documentHeader: { documentNumber: 'TS-00001', documentStatus: 'posted' } } }))
      .toEqual({ rowGUID: 'h1', organization: 'o1', workCenter: 'wc1', startDate: '2026-10-01', finishDate: '2026-10-31', documentNumber: 'TS-00001', status: 'posted' });
    expect(headerOfRow({ rowGUID: 'h2', startDate: '2026-10-01T00:00:00Z', finishDate: '2026-10-02' }).status).toBe('draft');
    expect(lineOfRow({ rowGUID: 'l1', timesheetLineProject: 'p', timesheetLineTask: 't', timesheetLineRole: 'r', timesheetLineHours: '12.50', unitSumForBudget: '100.000000' }))
      .toMatchObject({ rowGUID: 'l1', project: 'p', task: 't', role: 'r', budgetItem: '', hours: 12.5, unitSumForBudget: 100 });
    expect(lineOfRow({ rowGUID: 'l2' }).unitSumForBudget).toBeNull();
    expect(lineOfRow({ rowGUID: 'l3', rateSource: 'contract', unitPrice: '32.740000', unitPriceCurrency: 'EUR' })).toMatchObject({ rateSource: 'contract', unitPrice: 32.74, unitPriceCurrency: 'EUR' });
    expect(lineOfRow({ rowGUID: 'l4', rateSource: 'whatever' }).rateSource).toBe('');
    expect(listRowOf({ rowGUID: 'h1', documentNumber: 'TS-1', documentStatus: 'draft', workCenterTitle: 'Anna K', startDate: '2026-10-01', finishDate: '2026-10-31', lines: 2, hours: '8.00' }))
      .toMatchObject({ documentGUID: 'h1', workCenterTitle: 'Anna K', lineCount: 2, hours: 8 });
    expect(parseListAnswer(null)).toEqual([]);
    expect(listRowOf({ rowGUID: 'h2', postedAt: '2026-10-14T09:30:00.000Z' }).postedAt).toBe('2026-10-14T09:30:00.000Z');
    expect(listRowOf({ rowGUID: 'h3' }).postedAt).toBe('');
  });
  it('parsePostAnswer keeps the problems with their line and day', () => {
    const a = parsePostAnswer({ status: 'refused', lines: 2, problems: [{ lineGUID: 'l1', problem: 'noRate', day: '2026-10-05' }, { lineGUID: null, problem: 'dayOver24', day: '2026-10-06', hours: 30, otherSheet: 'TS-00001' }] });
    expect(a.status).toBe('refused');
    expect(a.problems).toEqual([{ lineGUID: 'l1', problem: 'noRate', day: '2026-10-05' }, { lineGUID: null, problem: 'dayOver24', day: '2026-10-06', hours: 30, otherSheet: 'TS-00001' }].map((p) => expect.objectContaining(p)));
    expect(parsePostAnswer({ status: 'posted', lines: 1, problems: [] }).status).toBe('posted');
    expect(parsePostAnswer({ status: 'draft' }).status).toBe('draft');
    expect(parsePostAnswer(null).status).toBe('refused');
  });
  it('parseCreateAnswer / parseMyWorkCenterAnswer', () => {
    expect(parseCreateAnswer({ status: 'created', documentGUID: 'd1' })).toEqual({ status: 'created', documentGUID: 'd1', skipped: [] });
    expect(parseCreateAnswer({ status: 'skipped', skipped: [{ reason: 'taskNotNormal' }] }).skipped).toEqual([{ reason: 'taskNotNormal' }]);
    expect(createSkippedText('taskNotNormal')).toMatch(/normal task/);
    expect(parseMyWorkCenterAnswer({ status: 'created', workCenter: 'wc1' })).toEqual({ status: 'created', workCenter: 'wc1' });
    expect(parseMyWorkCenterAnswer({ status: 'exists', workCenter: 'wc1' }).status).toBe('exists');
    expect(parseMyWorkCenterAnswer({ status: 'noPerson' }).status).toBe('noPerson');
    expect(parseMyWorkCenterAnswer({ status: 'whatever' }).status).toBe('needsBusinessUnit');
  });
  it('every problem of Post has a text; a line names its day and the other sheet', () => {
    for (const p of ['workCenterMissing', 'noHoursEntered', 'roleMissing', 'budgetItemMissing', 'noRate', 'dayOver24', 'dateInTheFuture', 'taskNotNormal', 'projectOrTaskMissing']) {
      expect(timesheetProblemText(p)).not.toBe(p);
    }
    expect(timesheetProblemText('somethingNew')).toBe('somethingNew');
    expect(timesheetProblemLine({ lineGUID: null, problem: 'dayOver24', day: '2026-10-06', hours: 30, otherSheet: 'TS-00001' })).toBe('The work center would have more than 24 hours on this day. · 2026-10-06 · 30 h · TS-00001');
  });
});

describe('the list filter and the paths', () => {
  it('only what is set (and a valid day) goes to the RPC', () => {
    expect(timesheetFilterActive(EMPTY_TIMESHEET_FILTER)).toBe(false);
    expect(timesheetFilterToRpc(EMPTY_TIMESHEET_FILTER)).toEqual({});
    expect(timesheetFilterToRpc({ workCenter: 'wc1', status: 'posted', startFrom: '2026-10-01', finishTo: 'x' }, { taskGUID: 't1' })).toEqual({ taskGUID: 't1', timesheetWorkCenter: 'wc1', status: 'posted', startFrom: '2026-10-01' });
    expect(timesheetFilterActive({ ...EMPTY_TIMESHEET_FILTER, status: 'draft' })).toBe(true);
  });
  it('routes', () => {
    expect(timesheetPath('a b')).toBe('/pm/timesheet/form?documentGUID=a%20b');
    expect(timesheetListPath()).toBe('/pm/timesheet/list');
    expect(timesheetListPath('t1')).toBe('/pm/timesheet/list?taskGUID=t1');
  });
  it('rowTitleOf reads the usual title keys, else the GUID', () => {
    expect(rowTitleOf({ rowGUID: 'g', rowJSON: { title: 'Role A' } })).toBe('Role A');
    expect(rowTitleOf({ rowGUID: 'g', rowJSON: { taskDescription: 'Task 1' } })).toBe('Task 1');
    expect(rowTitleOf({ rowGUID: 'g', rowJSON: { workCenterTitle: 'Anna K' } })).toBe('Anna K');
    expect(rowTitleOf({ rowGUID: 'g', rowJSON: {} })).toBe('g');
    expect(rowTitleOf(null)).toBe('');
  });
});

describe('the context menu of a line', () => {
  it('a draft: everything, but the ends of the list cannot move further', () => {
    expect(lineMenuAvailability({ canEdit: true, index: 1, count: 3 })).toEqual({ add: true, duplicate: true, moveUp: true, moveDown: true, delete: true });
    expect(lineMenuAvailability({ canEdit: true, index: 0, count: 3 })).toMatchObject({ moveUp: false, moveDown: true });
    expect(lineMenuAvailability({ canEdit: true, index: 2, count: 3 })).toMatchObject({ moveUp: true, moveDown: false });
    expect(lineMenuAvailability({ canEdit: true, index: 0, count: 1 })).toMatchObject({ moveUp: false, moveDown: false });
  });
  it('a posted sheet: nothing changes', () => {
    expect(Object.values(lineMenuAvailability({ canEdit: false, index: 1, count: 3 })).every((v) => v === false)).toBe(true);
  });
});

describe('the cost of an hour on a line and the problems of the price', () => {
  const l = (over: any = {}) => ({ role: 'r1', rateSource: '' as const, unitPrice: null, unitPriceCurrency: '', unitSumForBudget: null, ...over });
  it('the Time line numbers, the price with its currency, nothing chosen, no rate', () => {
    expect(hourCostText(l({ rateSource: 'taskLine', unitSumForBudget: 100 }))).toEqual({ text: '100', missing: false });
    expect(hourCostText(l({ rateSource: 'contract', unitPrice: 32.7381, unitPriceCurrency: 'EUR' }))).toEqual({ text: '32.74 EUR', missing: false });
    expect(hourCostText(l({ rateSource: 'role', unitPrice: 50 }))).toEqual({ text: '50', missing: false });
    expect(hourCostText(l({ role: '' }))).toEqual({ text: '', missing: false });
    expect(hourCostText(l())).toEqual({ text: 'no rate', missing: true });
  });
  it('the three problems of the price have their own text; an exchange rate problem adds the detail the database made', () => {
    for (const p of ['noContractRate', 'noRoleRate', 'noExchangeRate']) expect(timesheetProblemText(p)).not.toBe(p);
    expect(timesheetProblemLine({ lineGUID: 'l1', problem: 'noExchangeRate', day: '2026-10-05', detail: 'No Default exchange rate of ZZZ on or before 2026-10-05' }))
      .toBe('The price cannot be converted: an exchange rate is missing. · 2026-10-05 · No Default exchange rate of ZZZ on or before 2026-10-05');
    expect(timesheetProblemLine({ lineGUID: 'l1', problem: 'noRoleRate', day: '2026-10-05' })).toBe('There is no rate for the hour: the role has no rate on this day. · 2026-10-05');
  });
});

describe('formatDateTime (the posting date and time column)', () => {
  it('YYYY-MM-DD HH:MM in the time zone of the user; nothing for an empty or wrong value', () => {
    const d = new Date(2026, 9, 14, 9, 5, 30);
    expect(formatDateTime(d.toISOString())).toBe('2026-10-14 09:05');
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime('not a date')).toBe('');
  });
});
