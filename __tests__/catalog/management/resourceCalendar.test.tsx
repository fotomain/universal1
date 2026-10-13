/** @jest-environment jsdom */
// WP B/C of documentation/TIME_GENUS_CONTROL_WBS.html in the app: the model of a RESOURCE calendar (hours, the lock message) and the Fill menu of it
// (hours per day, "Follow project holidays", the custom week, the "!" help button, the report of the differences).
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: ({ name }: any) => require('react').createElement(require('react-native').Text, null, name) }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, label, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, label)) };
});
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => mockDispatch }));
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
const mockFill = jest.fn((..._a: any[]) => Promise.resolve(365));
const mockConsistency = jest.fn((..._a: any[]) => Promise.resolve([{ day: '2026-10-17' }, { day: '2026-10-18' }]));
jest.mock('../../../kit8/catalog/management/calendar/managementCalendarApi', () => ({
  fillManagementCalendar: (...a: any[]) => mockFill(...a),
  fetchCalendarConsistency: (...a: any[]) => mockConsistency(...a),
}));

import CalendarFillMenu, { CALENDAR_HELP_TEXT } from '../../../kit8/catalog/management/calendar/CalendarFillMenu';
import {
  calendarHoursPerDay, calendarLockMessage, dayRowHours, hasWeekPattern, isResourceCalendar,
} from '../../../kit8/catalog/management/calendar/managementCalendarModel';

const resourceCal: any = { rowGUID: 'partTime4hCalendar', rowJSON: { title: 'Part-time 4 h', kind: 'resource', hoursPerDay: 4 } };
const shiftCal: any = { rowGUID: 'shift', rowJSON: { title: 'Shift', kind: 'resource', hoursPerDay: 8, weekPattern: { mon: 0, tue: 8 } } };
const projectCal: any = { rowGUID: 'workingDaysCalendar', rowJSON: { title: 'Working days' } };

describe('the model of a resource calendar', () => {
  it('kind, hours per day, week pattern', () => {
    expect(isResourceCalendar(resourceCal)).toBe(true);
    expect(isResourceCalendar(projectCal)).toBe(false);
    expect(isResourceCalendar(null)).toBe(false);
    expect(calendarHoursPerDay(resourceCal)).toBe(4);
    expect(calendarHoursPerDay(projectCal)).toBe(8);
    expect(calendarHoursPerDay({ rowJSON: { hoursPerDay: 99 } } as any)).toBe(8);
    expect(hasWeekPattern(shiftCal)).toBe(true);
    expect(hasWeekPattern(resourceCal)).toBe(false);
  });
  it('the hours of a day row: its own, else hoursPerDay for an active day and 0 for an excluded one (an old row)', () => {
    expect(dayRowHours({ hours: 6, isActive: true })).toBe(6);
    expect(dayRowHours({ hours: 0, isActive: false })).toBe(0);
    expect(dayRowHours({ isActive: true }, 4)).toBe(4);
    expect(dayRowHours({ isActive: false }, 4)).toBe(0);
  });
});

describe('the calendar lock message (the twin of SQL organization_assert_capacity)', () => {
  const lock = { day: '2026-10-14', minHours: 8, resources: 1, example: 'Boris M' };
  it('lowering a booked day under its posted hours is refused, with the name', () => {
    expect(calendarLockMessage(lock, 8, 6)).toBe('Boris M has 8 h booked on 2026-10-14; the capacity cannot be less than 8 h.');
    expect(calendarLockMessage(lock, 8, 0)).toContain('cannot be less than 8 h');
  });
  it('raising or keeping the capacity is always allowed - an over-booked day can be repaired', () => {
    expect(calendarLockMessage(lock, 8, 10)).toBeNull();
    expect(calendarLockMessage(lock, 8, 8)).toBeNull();
    expect(calendarLockMessage({ ...lock, minHours: 12 }, 8, 9)).toBeNull();      // 8 -> 9 of 12 booked: still under, but raised
    expect(calendarLockMessage({ ...lock, minHours: 12 }, 9, 7)).not.toBeNull();  // 9 -> 7: lowered under the 12
  });
  it('a day without posted hours is not locked', () => {
    expect(calendarLockMessage(undefined, 8, 0)).toBeNull();
  });
  it('a lowering that stays at or above the posted hours is allowed', () => {
    expect(calendarLockMessage({ ...lock, minHours: 4 }, 8, 6)).toBeNull();
  });
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = async (id: string) => { await act(async () => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); }); };
function mount(calendar: any) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<CalendarFillMenu calendarGUID={calendar.rowGUID} calendar={calendar} currentYear={2026} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

describe('the Fill menu of a resource calendar', () => {
  it('a project calendar: no hours, no "follow", no help (as before)', async () => {
    mount(projectCal);
    await press('calendar-fill-button');
    expect(q('calendar-fill-resource')).toBeNull();
  });
  it('a resource calendar asks the hours, offers "Follow project holidays" (on) and explains itself with "!"', async () => {
    mount(resourceCal);
    await press('calendar-fill-button');
    expect(q('calendar-fill-resource')).not.toBeNull();
    expect((q('calendar-fill-hours') as HTMLInputElement).placeholder).toBe('4');
    expect(q('calendar-fill-follow')!.getAttribute('aria-checked')).toBe('true');
    expect(q('calendar-fill-help-text')).toBeNull();
    await press('calendar-fill-help');
    expect(q('calendar-fill-help-text')!.textContent).toBe(CALENDAR_HELP_TEXT);
    expect(CALENDAR_HELP_TEXT).toContain('cannot work less than the hours already planned');
    expect(CALENDAR_HELP_TEXT).toContain('You can always raise the hours');
  });
  it('Fill passes the options to SQL and tells how many days differ from the project calendars', async () => {
    mount(resourceCal);
    await press('calendar-fill-button');
    await press('calendar-fill-year-2026');
    await press('calendar-fill-2026-fiveDays');
    expect(mockFill).toHaveBeenCalledWith('partTime4hCalendar', 2026, 'fiveDays', false, { hours: null, followProjectHolidays: true });
    expect(mockConsistency).toHaveBeenCalledWith('partTime4hCalendar', 2026);
    const message = mockDispatch.mock.calls.map((c) => c[0]?.p?.message).find((m) => String(m).includes('days written'));
    expect(message).toContain('365 days written');
    expect(message).toContain('2 day(s) differ from the project calendars');
  });
  it('a custom week (weekPattern) adds its own mode', async () => {
    mount(shiftCal);
    await press('calendar-fill-button');
    await press('calendar-fill-year-2026');
    expect(q('calendar-fill-2026-pattern')).not.toBeNull();
    mount(resourceCal);
  });
  it('a refused Fill (a capacity under posted hours) is told with the message of the database', async () => {
    mockFill.mockRejectedValueOnce(new Error('calendar: Boris M has 8.00 h booked on 2026-10-14 (project / task: a / b); the capacity cannot be less than 8.00 h.'));
    mount(resourceCal);
    await press('calendar-fill-button');
    await press('calendar-fill-year-2026');
    await press('calendar-fill-2026-fiveDays');
    const message = mockDispatch.mock.calls.map((c) => c[0]?.p?.message).find((m) => String(m).includes('could not be filled'));
    expect(message).toContain('Boris M has 8.00 h booked');
  });
});
