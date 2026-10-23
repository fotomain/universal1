// Payment plan - the shift (days after the start or the end of the task) <-> the planned transaction date (pure, unit tested).
//   date = (the start or the end of the task, by paymentPlanTimelineAnchor) + paymentPlanTimelineShiftDays
//   The user types ONE of them; the other follows. Which one was typed is found by comparing the row with the SNAPSHOT of the last recalculation (paymentPlanDateSnapshot): the table
//   gives computeRowJSON only the new row, never the cell that changed. paymentPlanDateSource keeps the answer: the task moves => a 'shift' payment moves with it, a 'date' payment
//   keeps its date and gets a new shift.
//   Rules (documentation/PAYMENTS_PLAN_WBS.html section 4): the date is never before the task START; with the project switch paymentPlanAfterTaskFinishEnabled OFF it is also never after the
//   task END (so with the anchor "Task end" only shift 0 is possible); a typed date BEFORE the chosen anchor would need a negative shift - the shift stays empty and the line says
//   "choose the anchor Task start".
import { DEFAULT_PAYMENT_ANCHOR, paymentAnchorOf, paymentNumber, type PaymentAnchor, type PaymentDateSnapshot, type PaymentDateSource, type TaskPaymentPlanRowJSON } from './paymentPlanModel';

/** the first and the LAST day of the task, 'YYYY-MM-DD' (a milestone has one day; null = the schedule is not known yet) */
export interface PaymentTaskDays { start: string | null; end: string | null }

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isPaymentDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** 'YYYY-MM-DD' + n days (UTC arithmetic: no daylight saving shift) */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
/** whole days from a to b (b - a) */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** the day a shift is counted from (null = the task has no dates yet) */
export const anchorDayOf = (days: PaymentTaskDays, anchor: PaymentAnchor): string | null => (anchor === 'taskEnd' ? days.end : days.start);

/** date from the shift (null when the shift or the anchor day is not known) */
export function dateFromShift(days: PaymentTaskDays, anchor: PaymentAnchor, shift: number | null | undefined): string | null {
  const base = anchorDayOf(days, anchor);
  return base && typeof shift === 'number' && Number.isFinite(shift) ? addDays(base, Math.round(shift)) : null;
}
/** shift from the date: NEGATIVE when the date lies before the anchor (null when the date or the anchor day is not known) */
export function shiftFromDate(days: PaymentTaskDays, anchor: PaymentAnchor, date: string | null | undefined): number | null {
  const base = anchorDayOf(days, anchor);
  return base && isPaymentDay(date) ? diffDays(base, date) : null;
}

type DateFields = Pick<TaskPaymentPlanRowJSON, 'paymentPlanTimelineAnchor' | 'paymentPlanTimelineShiftDays' | 'paymentPlannedTransactionDate' | 'paymentPlanDateSource' | 'paymentPlanDateSnapshot'>;

/**
 * The fields to write after a change: shift, date, source, snapshot - only those that differ from `json` (so a row that is already right yields {}).
 * Called by computeRowJSON after a cell was edited (the new row), and by the screen when the task dates moved (the same row, new `days`).
 */
export function recomputePaymentDates(json: Partial<TaskPaymentPlanRowJSON>, days: PaymentTaskDays): Partial<DateFields> {
  const anchor = paymentAnchorOf(json.paymentPlanTimelineAnchor);
  const shiftIn = paymentNumber(json.paymentPlanTimelineShiftDays);
  const dateIn = isPaymentDay(json.paymentPlannedTransactionDate) ? json.paymentPlannedTransactionDate : null;
  const snap = json.paymentPlanDateSnapshot ?? null;
  const known: PaymentDateSource = json.paymentPlanDateSource === 'date' ? 'date' : 'shift';

  // which of the two did the user type?
  let source: PaymentDateSource;
  if (!snap) source = shiftIn === null && dateIn !== null ? 'date' : 'shift';
  else {
    const shiftChanged = shiftIn !== snap.shift;
    const dateChanged = dateIn !== snap.date;
    source = dateChanged && !shiftChanged ? 'date' : shiftChanged && !dateChanged ? 'shift' : known;
  }

  let shift = shiftIn;
  let date = dateIn;
  if (source === 'shift') {
    // an empty shift keeps the date as it is (a cleared shift is the user choosing to type the date)
    if (shiftIn !== null) date = dateFromShift(days, anchor, shiftIn) ?? dateIn;
    else source = 'date';
  }
  if (source === 'date') {
    const s = shiftFromDate(days, anchor, dateIn);
    // before the anchor: no negative shift, the line says why (paymentPlanProblems)
    shift = s !== null && s >= 0 ? s : null;
  }

  const next: DateFields = {
    paymentPlanTimelineAnchor: anchor,
    paymentPlanTimelineShiftDays: shift,
    paymentPlannedTransactionDate: date,
    paymentPlanDateSource: source,
    paymentPlanDateSnapshot: { shift, date, anchor },
  };
  const patch: Partial<DateFields> = {};
  for (const k of Object.keys(next) as (keyof DateFields)[]) {
    if (JSON.stringify((json as any)[k] ?? null) !== JSON.stringify((next as any)[k] ?? null)) (patch as any)[k] = (next as any)[k];
  }
  return patch;
}

/** the three dates rules as messages for the Errors column ([] = fine); `afterFinishOn` = the project switch paymentPlanAfterTaskFinishEnabled */
export function paymentDateProblems(json: Partial<TaskPaymentPlanRowJSON>, days: PaymentTaskDays, afterFinishOn: boolean): string[] {
  const out: string[] = [];
  const date = json.paymentPlannedTransactionDate;
  if (!isPaymentDay(date)) { out.push('Enter the shift in days or the planned date'); return out; }
  const anchor = paymentAnchorOf(json.paymentPlanTimelineAnchor);
  if (days.start && date < days.start) out.push('The planned date is before the start of the task');
  else if (days.end && date > days.end && !afterFinishOn) out.push('The planned date is after the end of the task (the project does not allow it)');
  const shift = shiftFromDate(days, anchor, date);
  if (shift !== null && shift < 0 && !(days.start && date < days.start)) out.push('The planned date is before the end of the task: choose the anchor "Task start"');
  return out;
}

export { DEFAULT_PAYMENT_ANCHOR };
export type { PaymentDateSnapshot };
