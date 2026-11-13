// costCoefficients - every number the cost model (costModel.ts) uses, in ONE table, with its source.
// Spec: documentation/PRICE_PLAN_CALCULATOR.html section 4 "The coefficients". The screen shows them folded under "Model coefficients" and lets the administrator change them.
//   source M = measured on the local Docker database (2026-11-12) · B = from the benches of the project · A = assumption, to calibrate on a real project (task W2) · S = a rule of the spec / the calendar

export type CoefficientSource = 'M' | 'B' | 'A' | 'S';

export interface CostCoefficients {
  // disk (KB unless the name says otherwise)
  emptyDatabaseMB: number;
  kbTask: number;
  kbLinks: number;
  kbLine: number;
  kbPlanRow: number;
  kbReportPerLine: number;
  kbRoiTask: number;
  kbRoiHistory: number;
  kbDocument: number;
  cronRowsPerMonth: number;
  kbCronRow: number;
  bloat: number;
  walSystemGB: number;
  freeSpace: number;
  // CPU (milliseconds of work)
  msWorkerTask: number;
  msRoiTask: number;
  msReportBase: number;
  msReportPerLine: number;
  msDateBase: number;
  msDatePerTask: number;
  msLine: number;
  msDocument: number;
  msStamp: number;
  msPostBase: number;
  msPostPerPlanRow: number;
  msOpenBase: number;
  msOpenPerRow: number;
  msCronTick: number;
  rowsPerDateChange: number;
  peakFactor: number;
  workHours: number;
  workDaysPerMonth: number;
  hoursPerMonth: number;
  checksPerMinute: number;
  // memory
  ramBaseGB: number;
  hotShare: number;
  ramPerClientGB: number;
  // Realtime and traffic
  tabsPerUser: number;
  kbTaskJson: number;
  kbLineJson: number;
  kbReportJson: number;
  kbMessage: number;
  kbStamp: number;
  reportRowsPerLine: number;
  rowsPerDocument: number;
  // the choice of the machine
  targetLoad: number;
  tasksForSmall: number;
  tasksForMedium: number;
  tasksForLarge: number;
}

export const DEFAULT_COEFFICIENTS: CostCoefficients = {
  emptyDatabaseMB: 30,
  kbTask: 4.1,
  kbLinks: 5.8,
  kbLine: 3.85,
  kbPlanRow: 1.35,
  kbReportPerLine: 1.5,
  kbRoiTask: 0.4,
  kbRoiHistory: 0.3,
  kbDocument: 30,
  cronRowsPerMonth: 1555000,
  kbCronRow: 0.15,
  bloat: 1.3,
  walSystemGB: 2,
  freeSpace: 1.5,
  msWorkerTask: 1.1,
  msRoiTask: 1,
  msReportBase: 5,
  msReportPerLine: 0.025,
  msDateBase: 10,
  msDatePerTask: 0.04,
  msLine: 5,
  msDocument: 80,
  msStamp: 2,
  msPostBase: 30,
  msPostPerPlanRow: 0.5,
  msOpenBase: 5,
  msOpenPerRow: 0.03,
  msCronTick: 1,
  rowsPerDateChange: 5,
  peakFactor: 4,
  workHours: 176,
  workDaysPerMonth: 22,
  hoursPerMonth: 730,
  checksPerMinute: 20,
  ramBaseGB: 0.6,
  hotShare: 0.25,
  ramPerClientGB: 0.01,
  tabsPerUser: 1.5,
  kbTaskJson: 1.3,
  kbLineJson: 1.0,
  kbReportJson: 1.0,
  kbMessage: 1.5,
  kbStamp: 0.3,
  reportRowsPerLine: 1.12,
  rowsPerDocument: 5,
  targetLoad: 0.6,
  tasksForSmall: 2000,
  tasksForMedium: 10000,
  tasksForLarge: 50000,
};

export interface CoefficientInfo {
  key: keyof CostCoefficients;
  label: string;
  unit: string;
  source: CoefficientSource;
  group: 'Disk' | 'CPU' | 'Memory' | 'Realtime and traffic' | 'Choice of the machine';
}

export const COEFFICIENT_INFO: readonly CoefficientInfo[] = [
  { key: 'emptyDatabaseMB', label: 'Empty database with the seeds', unit: 'MB', source: 'M', group: 'Disk' },
  { key: 'kbTask', label: 'Task row with its indexes', unit: 'KB', source: 'M', group: 'Disk' },
  { key: 'kbLinks', label: 'Links of a task (dependency + closure)', unit: 'KB', source: 'M', group: 'Disk' },
  { key: 'kbLine', label: 'Task line row with its indexes', unit: 'KB', source: 'M', group: 'Disk' },
  { key: 'kbPlanRow', label: 'One plan row (plan movement + timeline + register movement)', unit: 'KB', source: 'M', group: 'Disk' },
  { key: 'kbReportPerLine', label: 'Report rows of a line', unit: 'KB', source: 'M', group: 'Disk' },
  { key: 'kbRoiTask', label: 'ROI rows of a task', unit: 'KB', source: 'M', group: 'Disk' },
  { key: 'kbRoiHistory', label: 'ROI history row', unit: 'KB', source: 'A', group: 'Disk' },
  { key: 'kbDocument', label: 'One posted document with its lines and movements', unit: 'KB', source: 'A', group: 'Disk' },
  { key: 'cronRowsPerMonth', label: 'pg_cron log rows a month', unit: 'rows', source: 'A', group: 'Disk' },
  { key: 'kbCronRow', label: 'pg_cron log row', unit: 'KB', source: 'A', group: 'Disk' },
  { key: 'bloat', label: 'Bloat of a database that is updated', unit: 'x', source: 'A', group: 'Disk' },
  { key: 'walSystemGB', label: 'Write ahead log and system on the disk', unit: 'GB', source: 'A', group: 'Disk' },
  { key: 'freeSpace', label: 'Free space kept on the disk', unit: 'x', source: 'A', group: 'Disk' },
  { key: 'msWorkerTask', label: 'Monitor01 worker, per posted task', unit: 'ms', source: 'M', group: 'CPU' },
  { key: 'msRoiTask', label: 'ROI step, per posted task', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msReportBase', label: 'Report request, base', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msReportPerLine', label: 'Report request, per line of the project', unit: 'ms', source: 'B', group: 'CPU' },
  { key: 'msDateBase', label: 'Date change, base', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msDatePerTask', label: 'Date change, per task of the project', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msLine', label: 'Line write', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msDocument', label: 'Document post', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msStamp', label: 'Small check of an open report (stamp)', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msPostBase', label: 'Post of a task, base', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msPostPerPlanRow', label: 'Post of a task, per plan row', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msOpenBase', label: 'Open of a project, base', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msOpenPerRow', label: 'Open of a project, per row read', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'msCronTick', label: 'One pg_cron tick', unit: 'ms', source: 'A', group: 'CPU' },
  { key: 'rowsPerDateChange', label: 'Rows written by one date change', unit: 'rows', source: 'A', group: 'CPU' },
  { key: 'peakFactor', label: 'Busy hour against the average working hour', unit: 'x', source: 'A', group: 'CPU' },
  { key: 'workHours', label: 'Working time of a month', unit: 'h', source: 'S', group: 'CPU' },
  { key: 'workDaysPerMonth', label: 'Working days of a month', unit: 'days', source: 'S', group: 'CPU' },
  { key: 'hoursPerMonth', label: 'Hours of a month (the pg_cron ticks run day and night)', unit: 'h', source: 'S', group: 'CPU' },
  { key: 'checksPerMinute', label: 'Checks a minute of an open Monitor01 (every 3 seconds)', unit: '1/min', source: 'S', group: 'CPU' },
  { key: 'ramBaseGB', label: 'Postgres and Supabase services', unit: 'GB', source: 'A', group: 'Memory' },
  { key: 'hotShare', label: 'Share of the database that is hot', unit: 'share', source: 'A', group: 'Memory' },
  { key: 'ramPerClientGB', label: 'Memory per client online', unit: 'GB', source: 'A', group: 'Memory' },
  { key: 'tabsPerUser', label: 'Realtime connections per user online', unit: 'x', source: 'A', group: 'Realtime and traffic' },
  { key: 'kbTaskJson', label: 'A task as JSON on the wire', unit: 'KB', source: 'A', group: 'Realtime and traffic' },
  { key: 'kbLineJson', label: 'A line as JSON on the wire', unit: 'KB', source: 'A', group: 'Realtime and traffic' },
  { key: 'kbReportJson', label: 'A report row as JSON on the wire', unit: 'KB', source: 'A', group: 'Realtime and traffic' },
  { key: 'kbMessage', label: 'A Realtime message', unit: 'KB', source: 'A', group: 'Realtime and traffic' },
  { key: 'kbStamp', label: 'Answer of a small check (stamp)', unit: 'KB', source: 'A', group: 'Realtime and traffic' },
  { key: 'reportRowsPerLine', label: 'Report rows per line', unit: 'x', source: 'M', group: 'Realtime and traffic' },
  { key: 'rowsPerDocument', label: 'Rows changed by one posted document', unit: 'rows', source: 'A', group: 'Realtime and traffic' },
  { key: 'targetLoad', label: 'Target load of the machine in the busy hour', unit: 'share', source: 'S', group: 'Choice of the machine' },
  { key: 'tasksForSmall', label: 'More tasks than this in one project: at least Small', unit: 'tasks', source: 'A', group: 'Choice of the machine' },
  { key: 'tasksForMedium', label: 'More tasks than this in one project: at least Medium', unit: 'tasks', source: 'A', group: 'Choice of the machine' },
  { key: 'tasksForLarge', label: 'More tasks than this in one project: at least Large', unit: 'tasks', source: 'A', group: 'Choice of the machine' },
];

const KEYS = Object.keys(DEFAULT_COEFFICIENTS) as (keyof CostCoefficients)[];

/** A stored set of changed coefficients: an object whose known keys are finite numbers >= 0 (unknown keys are ignored when it is used). */
export function isCoefficientOverrides(v: unknown): v is Partial<CostCoefficients> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every((x) => typeof x === 'number' && Number.isFinite(x));
}

/** The defaults with the valid changes on top; a bad or unknown value is ignored. */
export function mergeCoefficients(overrides: unknown): CostCoefficients {
  const out: CostCoefficients = { ...DEFAULT_COEFFICIENTS };
  if (!overrides || typeof overrides !== 'object') return out;
  for (const k of KEYS) {
    const v = (overrides as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

/** Only the coefficients that differ from the defaults (what is stored). */
export function coefficientChanges(c: CostCoefficients): Partial<CostCoefficients> {
  const out: Partial<CostCoefficients> = {};
  for (const k of KEYS) if (c[k] !== DEFAULT_COEFFICIENTS[k]) out[k] = c[k];
  return out;
}
