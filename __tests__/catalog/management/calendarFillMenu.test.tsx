/** @jest-environment jsdom */
// The Fill menu of a management calendar, as in the document: Fill ▸ current year ▸ working days · 5 days a week · 6 days a week · all days,
// the previous year (and the next one) the same; days changed by hand are kept unless "Overwrite my manual changes" is on.
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: ({ name }: any) => require('react').createElement(require('react-native').Text, null, name) }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, label, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled, 'aria-disabled': !!disabled }, R.createElement(Text, null, label)) };
});
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => mockDispatch }));
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
const mockFill = jest.fn((_c: string, _y: number, _m: string, _o: boolean) => Promise.resolve(365));
jest.mock('../../../kit8/catalog/management/calendar/managementCalendarApi', () => ({ fillManagementCalendar: (c: string, y: number, m: string, o: boolean) => mockFill(c, y, m, o) }));

import CalendarFillMenu from '../../../kit8/catalog/management/calendar/CalendarFillMenu';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = async (id: string) => { await act(async () => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); }); };
const onFilled = jest.fn();
function mount(calendarGUID: string | null = 'workingDaysCalendar') {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<CalendarFillMenu calendarGUID={calendarGUID} currentYear={2026} onFilled={onFilled} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

it('no calendar selected: the Fill button is off', () => {
  mount(null);
  expect(q('calendar-fill-button')!.getAttribute('aria-disabled')).toBe('true');
});

it('Fill ▸ Current year / Previous year (and Next year) ▸ the four modes of the document', async () => {
  mount();
  expect(q('calendar-fill-menu')).toBeNull();
  await press('calendar-fill-button');
  expect(q('calendar-fill-year-2026')!.textContent).toContain('Current year · 2026');
  expect(q('calendar-fill-year-2025')!.textContent).toContain('Previous year · 2025');
  expect(q('calendar-fill-year-2027')!.textContent).toContain('Next year · 2027');
  expect(q('calendar-fill-2026-workingDays')).toBeNull(); // the modes show after the year is opened
  await press('calendar-fill-year-2026');
  expect(['workingDays', 'fiveDays', 'sixDays', 'allDays'].map((m) => q(`calendar-fill-2026-${m}`)!.textContent)).toEqual(['Working days', '5 days a week', '6 days a week', 'All days']);
});

it('a mode fills that year of the selected calendar, keeps manual days, reports and closes', async () => {
  mount();
  await press('calendar-fill-button');
  await press('calendar-fill-year-2025');
  await press('calendar-fill-2025-sixDays');
  expect(mockFill).toHaveBeenCalledWith('workingDaysCalendar', 2025, 'sixDays', false);
  expect(onFilled).toHaveBeenCalledWith(2025);
  expect(mockDispatch.mock.calls.map((c) => c[0]).some((a) => a.type === 'snackbar' && /2025: 365 days/.test(a.p.message))).toBe(true);
  expect(q('calendar-fill-menu')).toBeNull();
});

it('"Overwrite my manual changes" is passed to the fill', async () => {
  mount();
  await press('calendar-fill-button');
  await press('calendar-fill-overwrite');
  await press('calendar-fill-year-2026');
  await press('calendar-fill-2026-allDays');
  expect(mockFill).toHaveBeenCalledWith('workingDaysCalendar', 2026, 'allDays', true);
});

it('a refused fill is shown and the menu stays open', async () => {
  mockFill.mockRejectedValueOnce(new Error('calendar "x" does not exist'));
  mount();
  await press('calendar-fill-button');
  await press('calendar-fill-year-2026');
  await press('calendar-fill-2026-workingDays');
  expect(mockDispatch.mock.calls.map((c) => c[0]).some((a) => a.type === 'snackbar' && /could not be filled.*does not exist/.test(a.p.message))).toBe(true);
  expect(q('calendar-fill-menu')).not.toBeNull();
  expect(onFilled).not.toHaveBeenCalled();
});
