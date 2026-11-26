import { addDaysToDay, autoFormatCompactDate, autoFormatTypedDay, parseRelativeDays } from '../../kit8/ui/components/common/date_input/dateInputFormat';

describe('autoFormatCompactDate (live typing of a day)', () => {
  it('eight digits that make a date become YYYY-MM-DD (YYYYMMDD first, then DDMMYYYY)', () => {
    expect(autoFormatCompactDate('20261130')).toBe('2026-11-30');
    expect(autoFormatCompactDate('30112026')).toBe('2026-11-30');
    expect(autoFormatCompactDate('20122026')).toBe('2026-12-20');
  });
  it('anything else is returned as typed', () => {
    ['', '2026113', '202611301', '20261340', '2026-11-30', '30.11.2026', 't', 'abc'].forEach((t) => expect(autoFormatCompactDate(t)).toBe(t));
  });
});

describe('autoFormatTypedDay (a filter field: t = today, (day(n)) = today + n)', () => {
  const now = new Date(2026, 10, 25, 23, 30); // 25 Nov 2026, late evening: the LOCAL day counts
  it('t, T and " t " become today as YYYY-MM-DD', () => {
    ['t', 'T', ' t '].forEach((x) => expect(autoFormatTypedDay(x, now)).toBe('2026-11-25'));
  });
  it('eight digits still turn into a day; every other text stays', () => {
    expect(autoFormatTypedDay('20261130', now)).toBe('2026-11-30');
    ['', 'to', 'today', '(', '(day(-1', '(day(-1)', '(day(x))', '2026-11-30', 'tt'].forEach((x) => expect(autoFormatTypedDay(x, now)).toBe(x));
  });
  it('(day(n)) becomes the real date once the brackets are closed; across a month / year border; spaces and case do not matter', () => {
    expect(autoFormatTypedDay('(day(-1))', now)).toBe('2026-11-24');
    expect(autoFormatTypedDay('(day(0))', now)).toBe('2026-11-25');
    expect(autoFormatTypedDay('(day(7))', now)).toBe('2026-12-02');
    expect(autoFormatTypedDay('(day(+10))', now)).toBe('2026-12-05');
    expect(autoFormatTypedDay(' ( DAY( -30 ) ) ', now)).toBe('2026-10-26');
    expect(autoFormatTypedDay('(day(37))', now)).toBe('2027-01-01');
  });
});

describe('relative days of a date "between" (+5 / -5)', () => {
  it('parseRelativeDays: a sign and a number of days; a plain number or a date is not relative', () => {
    expect([parseRelativeDays('+5'), parseRelativeDays('-5'), parseRelativeDays(' + 12 '), parseRelativeDays('-3d'), parseRelativeDays('+2 days'), parseRelativeDays('+0')]).toEqual([5, -5, 12, -3, 2, 0]);
    ['5', '', '+', '++5', '+5.5', '2026-11-30', '-', 't', '(day(-1))', '+100000'].forEach((x) => expect(parseRelativeDays(x)).toBeNull());
  });
  it('addDaysToDay crosses month and year borders; a wrong day gives null', () => {
    expect(addDaysToDay('2026-11-30', 5)).toBe('2026-12-05');
    expect(addDaysToDay('2026-11-30', -5)).toBe('2026-11-25');
    expect(addDaysToDay('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysToDay('2026-03-02', -2)).toBe('2026-02-28');
    expect(addDaysToDay('2026-11-30', 0)).toBe('2026-11-30');
    expect(addDaysToDay('soon', 1)).toBeNull();
  });
});
