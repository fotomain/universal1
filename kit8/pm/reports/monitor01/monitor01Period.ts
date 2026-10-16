// monitor01Period - pure part of SelectPeriodModal (a Google-Ads-style month-range picker: three years of months, click a month to start, click another to finish).
// Produces the SAME shape as Monitor01Filters: { startDate, finishDate } = the FIRST day of the earlier month .. the LAST day of the later month, 'YYYY-MM-DD'.

const pad2 = (n: number) => String(n).padStart(2, '0');

export interface MonitorPeriodMonth { year: number; month: number } // month: 0-11 (JS Date convention)

export const monitorPeriodSameMonth = (a: MonitorPeriodMonth, b: MonitorPeriodMonth): boolean => a.year === b.year && a.month === b.month;
/** a < b (earlier month) */
export const monitorPeriodBefore = (a: MonitorPeriodMonth, b: MonitorPeriodMonth): boolean => a.year !== b.year ? a.year < b.year : a.month < b.month;

export const monitorMonthFirstDay = (m: MonitorPeriodMonth): string => `${m.year}-${pad2(m.month + 1)}-01`;
/** day 0 of the next month = the last day of this one (handles Feb / leap years) */
export const monitorMonthLastDay = (m: MonitorPeriodMonth): string => {
  const d = new Date(Date.UTC(m.year, m.month + 1, 0));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

/** the three years shown, `center` in the middle (Prev / Next shift all three together, as the reference screenshot does) */
export const monitorPeriodYears = (center: number): [number, number, number] => [center - 1, center, center + 1];

export const MONITOR_PERIOD_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** two picked months, in whichever order they were clicked -> the filter range (earlier .. later; one month picked twice = that one month) */
export function monitorPeriodOf(a: MonitorPeriodMonth, b: MonitorPeriodMonth): { startDate: string; finishDate: string } {
  const [first, last] = monitorPeriodBefore(b, a) ? [b, a] : [a, b];
  return { startDate: monitorMonthFirstDay(first), finishDate: monitorMonthLastDay(last) };
}

/** 'YYYY-MM-DD' (any day of the month) -> that month, for showing an existing filter value on the grid; null when unreadable */
export function monitorPeriodMonthOfDay(day: string): MonitorPeriodMonth | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec((day || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  return month >= 0 && month <= 11 ? { year, month } : null;
}

/** is `m` inside [startMonth, finishMonth] (both inclusive, order not assumed) - what highlights the tiles between two picked months */
export function monitorPeriodMonthInRange(m: MonitorPeriodMonth, startMonth: MonitorPeriodMonth, finishMonth: MonitorPeriodMonth): boolean {
  const [first, last] = monitorPeriodBefore(finishMonth, startMonth) ? [finishMonth, startMonth] : [startMonth, finishMonth];
  return !monitorPeriodBefore(m, first) && !monitorPeriodBefore(last, m);
}
