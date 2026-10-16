// monitor01Period: the pure part of SelectPeriodModal - the three years shown, the range of two picked months (whichever order), the month of an existing
// filter day, and which tiles are "in range".
import {
  MONITOR_PERIOD_MONTH_NAMES, monitorMonthFirstDay, monitorMonthLastDay, monitorPeriodBefore, monitorPeriodMonthInRange, monitorPeriodMonthOfDay, monitorPeriodOf, monitorPeriodSameMonth, monitorPeriodYears,
} from '../../../../kit8/pm/reports/monitor01/monitor01Period';

describe('monitorPeriodYears', () => {
  it('the center year with one before and one after', () => {
    expect(monitorPeriodYears(2016)).toEqual([2015, 2016, 2017]);
    expect(monitorPeriodYears(2000)).toEqual([1999, 2000, 2001]);
  });
});

describe('monitorMonthFirstDay / monitorMonthLastDay', () => {
  it('the first and the last day of the month, zero-padded', () => {
    expect(monitorMonthFirstDay({ year: 2026, month: 0 })).toBe('2026-01-01');
    expect(monitorMonthLastDay({ year: 2026, month: 0 })).toBe('2026-01-31');
    expect(monitorMonthLastDay({ year: 2026, month: 3 })).toBe('2026-04-30');     // April: 30 days
  });
  it('February: the leap year is right', () => {
    expect(monitorMonthLastDay({ year: 2026, month: 1 })).toBe('2026-02-28');    // 2026 is not a leap year
    expect(monitorMonthLastDay({ year: 2028, month: 1 })).toBe('2028-02-29');    // 2028 is
  });
  it('December rolls into the next year, not out of range', () => {
    expect(monitorMonthFirstDay({ year: 2026, month: 11 })).toBe('2026-12-01');
    expect(monitorMonthLastDay({ year: 2026, month: 11 })).toBe('2026-12-31');
  });
});

describe('monitorPeriodBefore / monitorPeriodSameMonth', () => {
  it('compares year first, then month', () => {
    expect(monitorPeriodBefore({ year: 2026, month: 0 }, { year: 2027, month: 0 })).toBe(true);
    expect(monitorPeriodBefore({ year: 2026, month: 5 }, { year: 2026, month: 6 })).toBe(true);
    expect(monitorPeriodBefore({ year: 2026, month: 6 }, { year: 2026, month: 5 })).toBe(false);
    expect(monitorPeriodBefore({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBe(false);
  });
  it('same year and month, regardless of how the object was built', () => {
    expect(monitorPeriodSameMonth({ year: 2026, month: 9 }, { year: 2026, month: 9 })).toBe(true);
    expect(monitorPeriodSameMonth({ year: 2026, month: 9 }, { year: 2026, month: 10 })).toBe(false);
  });
});

describe('monitorPeriodOf: two picked months -> the filter range', () => {
  it('the later one picked first is still the finish', () => {
    expect(monitorPeriodOf({ year: 2026, month: 9 }, { year: 2026, month: 5 })).toEqual({ startDate: '2026-06-01', finishDate: '2026-10-31' });
    expect(monitorPeriodOf({ year: 2026, month: 5 }, { year: 2026, month: 9 })).toEqual({ startDate: '2026-06-01', finishDate: '2026-10-31' });
  });
  it('across years', () => {
    expect(monitorPeriodOf({ year: 2027, month: 1 }, { year: 2026, month: 10 })).toEqual({ startDate: '2026-11-01', finishDate: '2027-02-28' });
  });
  it('the same month twice: a one-month period', () => {
    expect(monitorPeriodOf({ year: 2026, month: 9 }, { year: 2026, month: 9 })).toEqual({ startDate: '2026-10-01', finishDate: '2026-10-31' });
  });
});

describe('monitorPeriodMonthOfDay: an existing filter value -> the month shown on the grid', () => {
  it('reads year and month from any day of the month', () => {
    expect(monitorPeriodMonthOfDay('2026-10-14')).toEqual({ year: 2026, month: 9 });
    expect(monitorPeriodMonthOfDay('2026-01-01')).toEqual({ year: 2026, month: 0 });
    expect(monitorPeriodMonthOfDay('2026-12-31')).toEqual({ year: 2026, month: 11 });
  });
  it('empty or unreadable: null (opens on the current year instead)', () => {
    expect(monitorPeriodMonthOfDay('')).toBeNull();
    expect(monitorPeriodMonthOfDay('soon')).toBeNull();
    expect(monitorPeriodMonthOfDay('2026-13-01')).toBeNull();
  });
});

describe('monitorPeriodMonthInRange: which tiles sit between two picked months', () => {
  const start = { year: 2026, month: 5 };
  const finish = { year: 2026, month: 9 };
  it('the edges and everything between are in range', () => {
    expect(monitorPeriodMonthInRange(start, start, finish)).toBe(true);
    expect(monitorPeriodMonthInRange(finish, start, finish)).toBe(true);
    expect(monitorPeriodMonthInRange({ year: 2026, month: 7 }, start, finish)).toBe(true);
  });
  it('outside the range, and the order of start/finish does not matter', () => {
    expect(monitorPeriodMonthInRange({ year: 2026, month: 4 }, start, finish)).toBe(false);
    expect(monitorPeriodMonthInRange({ year: 2026, month: 10 }, start, finish)).toBe(false);
    expect(monitorPeriodMonthInRange({ year: 2026, month: 7 }, finish, start)).toBe(true);     // picked in the "wrong" order
  });
  it('across years', () => {
    expect(monitorPeriodMonthInRange({ year: 2027, month: 1 }, { year: 2026, month: 10 }, { year: 2027, month: 2 })).toBe(true);
    expect(monitorPeriodMonthInRange({ year: 2025, month: 11 }, { year: 2026, month: 10 }, { year: 2027, month: 2 })).toBe(false);
  });
});

it('twelve month names, Jan first', () => {
  expect(MONITOR_PERIOD_MONTH_NAMES).toHaveLength(12);
  expect(MONITOR_PERIOD_MONTH_NAMES[0]).toBe('Jan');
  expect(MONITOR_PERIOD_MONTH_NAMES[11]).toBe('Dec');
});
