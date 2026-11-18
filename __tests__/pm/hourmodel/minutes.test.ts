import { ceilToStep, formatClock, formatMinutes, parseClock, parseMinutes, slotMinutesOf, wholeMinutesOf } from '../../../kit8/pm/hourmodel/minutes';

describe('minutes', () => {
  test('parseMinutes reads minutes, hours, days, compounds and a bare number', () => {
    expect(parseMinutes('90m')).toEqual({ minutes: 90, roundedUp: false });
    expect(parseMinutes('1h30m')).toEqual({ minutes: 90, roundedUp: false });
    expect(parseMinutes('1h 30m')?.minutes).toBe(90);
    expect(parseMinutes('1.5h')?.minutes).toBe(90);
    expect(parseMinutes('1,5h')?.minutes).toBe(90);
    expect(parseMinutes('2d', 'minute', 480)?.minutes).toBe(960);
    expect(parseMinutes('1d4h', 'minute', 480)?.minutes).toBe(720);
    expect(parseMinutes('45', 'minute')?.minutes).toBe(45);
    expect(parseMinutes('2', 'hour')?.minutes).toBe(120);
    expect(parseMinutes('3', 'day', 420)?.minutes).toBe(1260);
    expect(parseMinutes('0')?.minutes).toBe(0);
  });
  test('seconds are rounded UP to a whole minute and say so', () => {
    expect(parseMinutes('45s')).toEqual({ minutes: 1, roundedUp: true });
    expect(parseMinutes('1m30s')).toEqual({ minutes: 2, roundedUp: true });
    expect(parseMinutes('1.2m')).toEqual({ minutes: 2, roundedUp: true });
  });
  test('not a duration', () => {
    for (const t of ['', '  ', 'abc', '-5', '1x', '1h xx']) expect(parseMinutes(t)).toBeNull();
  });
  test('formatMinutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(0)).toBe('0');
    expect(formatMinutes(-4)).toBe('0');
  });
  test('clock text', () => {
    expect(parseClock('09:15')).toBe(555);
    expect(parseClock('9:15')).toBe(555);
    expect(parseClock('24:00')).toBe(1440);
    expect(parseClock('24:01')).toBeNull();
    expect(parseClock('09:15:30')).toBeNull();
    expect(parseClock('25:00')).toBeNull();
    expect(formatClock(555)).toBe('09:15');
    expect(formatClock(1440)).toBe('24:00');
  });
  test('whole minutes and the step', () => {
    expect(wholeMinutesOf(90)).toBe(90);
    expect(wholeMinutesOf('90')).toBe(90);
    expect(wholeMinutesOf(1.5)).toBeNull();
    expect(wholeMinutesOf(-1)).toBeNull();
    expect(wholeMinutesOf(null)).toBeNull();
    expect(slotMinutesOf(30)).toBe(30);
    expect(slotMinutesOf(7)).toBe(15);
    expect(slotMinutesOf(undefined)).toBe(15);
    expect(ceilToStep(16, 15)).toBe(30);
    expect(ceilToStep(15, 15)).toBe(15);
  });
});
