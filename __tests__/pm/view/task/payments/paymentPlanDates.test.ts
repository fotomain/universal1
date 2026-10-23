// Shift <-> planned date: the anchor (task start | task end), which of the two the user typed, the task that moves, the three date rules.
import { addDays, anchorDayOf, dateFromShift, diffDays, isPaymentDay, paymentDateProblems, recomputePaymentDates, shiftFromDate } from '../../../../../kit8/pm/view/task/payments/paymentPlanDates';
import { DAYS } from './paymentsTestKit';

describe('day arithmetic (UTC, no daylight saving)', () => {
  it('adds and subtracts days across months, years and the leap day', () => {
    expect(addDays('2026-10-01', 30)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-10-01', '2026-10-31')).toBe(30);
    expect(diffDays('2026-10-10', '2026-10-01')).toBe(-9);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);   // the clocks change that weekend in Europe
  });
  it('knows a real day', () => {
    expect(isPaymentDay('2026-10-01')).toBe(true);
    expect(isPaymentDay('2026-02-30')).toBe(false);
    expect(isPaymentDay('01.10.2026')).toBe(false);
    expect(isPaymentDay(null)).toBe(false);
  });
});

describe('date from shift and shift from date', () => {
  it('Task start counts from the first day, Task end from the last day', () => {
    expect(anchorDayOf(DAYS, 'taskStart')).toBe('2026-10-01');
    expect(anchorDayOf(DAYS, 'taskEnd')).toBe('2026-10-10');
    expect(dateFromShift(DAYS, 'taskStart', 5)).toBe('2026-10-06');
    expect(dateFromShift(DAYS, 'taskEnd', 5)).toBe('2026-10-15');
    expect(dateFromShift(DAYS, 'taskEnd', 0)).toBe('2026-10-10');
    expect(shiftFromDate(DAYS, 'taskStart', '2026-10-06')).toBe(5);
    expect(shiftFromDate(DAYS, 'taskEnd', '2026-10-15')).toBe(5);
  });
  it('a date before the anchor is a NEGATIVE shift (the caller refuses it); a task with no dates gives null', () => {
    expect(shiftFromDate(DAYS, 'taskEnd', '2026-10-05')).toBe(-5);
    expect(dateFromShift({ start: null, end: null }, 'taskStart', 3)).toBeNull();
    expect(shiftFromDate({ start: null, end: null }, 'taskStart', '2026-10-05')).toBeNull();
    expect(dateFromShift(DAYS, 'taskStart', null)).toBeNull();
  });
});

describe('recomputePaymentDates: the user types ONE, the other follows', () => {
  it('a new payment with a shift gets its date (source shift) and a snapshot', () => {
    const p = recomputePaymentDates({ paymentPlanTimelineAnchor: 'taskStart', paymentPlanTimelineShiftDays: 5 }, DAYS);
    expect(p).toMatchObject({ paymentPlannedTransactionDate: '2026-10-06', paymentPlanDateSource: 'shift', paymentPlanDateSnapshot: { shift: 5, date: '2026-10-06', anchor: 'taskStart' } });
  });
  it('a typed shift after the snapshot: the date follows', () => {
    const snap = { shift: 5, date: '2026-10-06', anchor: 'taskStart' as const };
    const p = recomputePaymentDates({ paymentPlanTimelineAnchor: 'taskStart', paymentPlanTimelineShiftDays: 9, paymentPlannedTransactionDate: '2026-10-06', paymentPlanDateSource: 'shift', paymentPlanDateSnapshot: snap }, DAYS);
    expect(p.paymentPlannedTransactionDate).toBe('2026-10-10');
    expect(p.paymentPlanDateSnapshot).toMatchObject({ shift: 9, date: '2026-10-10' });
  });
  it('a typed date after the snapshot: the shift follows and the source is the date', () => {
    const snap = { shift: 5, date: '2026-10-06', anchor: 'taskStart' as const };
    const p = recomputePaymentDates({ paymentPlanTimelineAnchor: 'taskStart', paymentPlanTimelineShiftDays: 5, paymentPlannedTransactionDate: '2026-10-20', paymentPlanDateSource: 'shift', paymentPlanDateSnapshot: snap }, DAYS);
    expect(p).toMatchObject({ paymentPlanTimelineShiftDays: 19, paymentPlanDateSource: 'date' });
    expect(p.paymentPlannedTransactionDate).toBeUndefined();   // the date stays as typed: nothing to write
  });
  it('a date typed on an empty payment (no shift yet) is the source', () => {
    const p = recomputePaymentDates({ paymentPlannedTransactionDate: '2026-10-04' }, DAYS);
    expect(p).toMatchObject({ paymentPlanTimelineShiftDays: 3, paymentPlanDateSource: 'date', paymentPlanTimelineAnchor: 'taskStart' });
  });
  it('the anchor changes: a SHIFT payment keeps its shift and moves its date; a DATE payment keeps its date and gets a new shift', () => {
    const shiftRow = { paymentPlanTimelineAnchor: 'taskEnd' as const, paymentPlanTimelineShiftDays: 5, paymentPlannedTransactionDate: '2026-10-06', paymentPlanDateSource: 'shift' as const, paymentPlanDateSnapshot: { shift: 5, date: '2026-10-06', anchor: 'taskStart' as const } };
    expect(recomputePaymentDates(shiftRow, DAYS).paymentPlannedTransactionDate).toBe('2026-10-15');
    const dateRow = { ...shiftRow, paymentPlanDateSource: 'date' as const, paymentPlannedTransactionDate: '2026-10-20' };
    const p = recomputePaymentDates({ ...dateRow, paymentPlanDateSnapshot: { shift: 5, date: '2026-10-20', anchor: 'taskStart' } }, DAYS);
    expect(p.paymentPlanTimelineShiftDays).toBe(10);
  });
  it('the task moves: a SHIFT payment moves with it, a DATE payment keeps the date and gets a new shift', () => {
    const moved = { start: '2026-10-05', end: '2026-10-14' };
    const shiftRow = { paymentPlanTimelineAnchor: 'taskStart' as const, paymentPlanTimelineShiftDays: 5, paymentPlannedTransactionDate: '2026-10-06', paymentPlanDateSource: 'shift' as const, paymentPlanDateSnapshot: { shift: 5, date: '2026-10-06', anchor: 'taskStart' as const } };
    expect(recomputePaymentDates(shiftRow, moved)).toMatchObject({ paymentPlannedTransactionDate: '2026-10-10' });
    const dateRow = { ...shiftRow, paymentPlanDateSource: 'date' as const };
    expect(recomputePaymentDates(dateRow, moved)).toMatchObject({ paymentPlanTimelineShiftDays: 1 });
  });
  it('the task moves past a DATE payment: no negative shift - the shift is empty and the line says why', () => {
    const moved = { start: '2026-10-20', end: '2026-10-25' };
    const row = { paymentPlanTimelineAnchor: 'taskStart' as const, paymentPlanTimelineShiftDays: 5, paymentPlannedTransactionDate: '2026-10-06', paymentPlanDateSource: 'date' as const, paymentPlanDateSnapshot: { shift: 5, date: '2026-10-06', anchor: 'taskStart' as const } };
    const p = recomputePaymentDates(row, moved);
    expect(p.paymentPlanTimelineShiftDays).toBeNull();
    expect(paymentDateProblems({ ...row, ...p }, moved, true)).toContain('The planned date is before the start of the task');
  });
  it('a row that is already right gives {} (the screen writes nothing)', () => {
    const row = { paymentPlanTimelineAnchor: 'taskStart' as const, paymentPlanTimelineShiftDays: 5, paymentPlannedTransactionDate: '2026-10-06', paymentPlanDateSource: 'shift' as const, paymentPlanDateSnapshot: { shift: 5, date: '2026-10-06', anchor: 'taskStart' as const } };
    expect(recomputePaymentDates(row, DAYS)).toEqual({});
  });
  it('a task with no dates yet keeps what is typed', () => {
    const p = recomputePaymentDates({ paymentPlanTimelineShiftDays: 5, paymentPlannedTransactionDate: '2026-10-06' }, { start: null, end: null });
    expect(p.paymentPlannedTransactionDate).toBeUndefined();
    expect(p.paymentPlanTimelineShiftDays).toBeUndefined();
  });
});

describe('the date rules (project switch paymentPlanAfterTaskFinishEnabled)', () => {
  const j = (date: string | null, anchor: 'taskStart' | 'taskEnd' = 'taskStart') => ({ paymentPlannedTransactionDate: date, paymentPlanTimelineAnchor: anchor });
  it('no date: the user is asked for one', () => {
    expect(paymentDateProblems(j(null), DAYS, true)).toEqual(['Enter the shift in days or the planned date']);
  });
  it('before the start of the task is always wrong', () => {
    expect(paymentDateProblems(j('2026-09-30'), DAYS, true)).toEqual(['The planned date is before the start of the task']);
    expect(paymentDateProblems(j('2026-09-30'), DAYS, false)).toEqual(['The planned date is before the start of the task']);
  });
  it('after the end: allowed while the switch is on (the default), wrong while it is off; the last day is fine', () => {
    expect(paymentDateProblems(j('2026-10-25'), DAYS, true)).toEqual([]);
    expect(paymentDateProblems(j('2026-10-25'), DAYS, false)).toEqual(['The planned date is after the end of the task (the project does not allow it)']);
    expect(paymentDateProblems(j('2026-10-10'), DAYS, false)).toEqual([]);
  });
  it('a date inside the task with the anchor Task end needs a negative shift: choose Task start', () => {
    expect(paymentDateProblems(j('2026-10-05', 'taskEnd'), DAYS, true)).toEqual(['The planned date is before the end of the task: choose the anchor "Task start"']);
    expect(paymentDateProblems(j('2026-10-10', 'taskEnd'), DAYS, false)).toEqual([]);
  });
});
