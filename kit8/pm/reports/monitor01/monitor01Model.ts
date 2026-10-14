// monitor01Model - the rows of monitor01_view (documentation/MONITOR01_WBS.html; SQL: PART 25) and everything the dashboard computes from them, all pure:
//   * the key of a row and the PATCH of a realtime event (the screen never refetches: it replaces one row by its key)
//   * the filters of the bar (startDate · finishDate · project · task · resource) and the tabs (Time · Material · Expense · All)
//   * the table: totals (per unit - hours and pieces are never added), the genus groups with their subtotals, the rows in the order of the sheet, the TotalsRow at the bottom
//   * the filter of the Sum explorer for a cell, a subtotal and a total
// The numbers come ready from the database (rest to contract and on-hand are generated columns): nothing is calculated here except sums of rows.
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import { parseDayInput } from '../../fact/factInputModel';

export interface Monitor01Row {
  rowOwnerGUID: string;
  genusGUID: string;
  resourceRoleGUID: string;
  measureUnit: string;
  /** 'YYYY-MM-01' */
  periodMonth: string;
  rowProjectGUID: string;
  rowOrganizationGUID?: string | null;
  rowOwnerUserGUID?: string;
  projectName: string;
  taskName: string;
  resourceRoleName: string;
  qtyPlanned: number;
  qtyContracted: number;
  /** the money of the plan (Σ sumForBudget of the plan movements) */
  sumForBudget: number;
  qtyRestToContract: number;
  qtyDelivered: number;
  qtyUsed: number;
  qtyOnHand: number;
  lineCount: number;
  hasStalePlan: boolean;
  updated_at?: string;
}

export type Monitor01Tab = 'time' | 'material' | 'expense' | 'all';
export const MONITOR01_TABS: { id: Monitor01Tab; title: string; icon: string; genus: string[] }[] = [
  { id: 'time', title: 'Time', icon: 'schedule', genus: [MANAGEMENT_GENUS.time] },
  { id: 'material', title: 'Material', icon: 'inventory_2', genus: [MANAGEMENT_GENUS.material] },
  { id: 'expense', title: 'Expense', icon: 'receipt_long', genus: [MANAGEMENT_GENUS.expense] },
  { id: 'all', title: 'All', icon: 'select_all', genus: [MANAGEMENT_GENUS.time, MANAGEMENT_GENUS.material, MANAGEMENT_GENUS.expense] },
];
export const MONITOR01_GENUS_ORDER: string[] = [MANAGEMENT_GENUS.time, MANAGEMENT_GENUS.material, MANAGEMENT_GENUS.expense];
export const monitor01GenusTitle = (genus: string): string => (genus === MANAGEMENT_GENUS.time ? 'Time' : genus === MANAGEMENT_GENUS.material ? 'Material' : genus === MANAGEMENT_GENUS.expense ? 'Expense' : genus);

/** the six numbers of the sheet, in the order of its columns */
export const MONITOR01_MEASURES = ['planned', 'contracted', 'restToContract', 'delivered', 'used', 'onHand'] as const;
export type Monitor01Measure = (typeof MONITOR01_MEASURES)[number];
export const MONITOR01_MEASURE_FIELD: Record<Monitor01Measure, keyof Monitor01Row> = {
  planned: 'qtyPlanned', contracted: 'qtyContracted', restToContract: 'qtyRestToContract', delivered: 'qtyDelivered', used: 'qtyUsed', onHand: 'qtyOnHand',
};
/** the header texts of the columns (the sheet's own spelling corrected; every header starts with a capital letter) */
export const MONITOR01_MEASURE_TITLE: Record<Monitor01Measure, string> = {
  planned: 'Planned', contracted: 'Contracted', restToContract: 'Rest to contract', delivered: 'Delivered', used: 'Actually used', onHand: 'On-hand',
};
/** the header texts of the dimension columns and of the money column */
export const MONITOR01_HEAD = { project: 'Project', role: 'Resource role', month: 'Month', task: 'Task name', unit: 'Unit', sumForBudget: 'Sum for budget' } as const;
/** the group header over the columns */
export const MONITOR01_MEASURE_GROUP: Record<Monitor01Measure, 'Plan' | 'Fact'> = { planned: 'Plan', contracted: 'Plan', restToContract: 'Plan', delivered: 'Fact', used: 'Fact', onHand: 'Fact' };

// ---- rows: key, parsing, patch ---------------------------------------------------------------------------------------------------------------------------
export const monitor01Key = (r: Pick<Monitor01Row, 'rowOwnerGUID' | 'genusGUID' | 'resourceRoleGUID' | 'measureUnit' | 'periodMonth'>): string =>
  [r.rowOwnerGUID, r.genusGUID, r.resourceRoleGUID ?? '', r.measureUnit ?? '', String(r.periodMonth).slice(0, 10)].join('|');

const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
/** a row as the database sends it (numeric may arrive as a string) → the typed row */
export function parseMonitor01Row(raw: any): Monitor01Row {
  return {
    rowOwnerGUID: String(raw.rowOwnerGUID),
    genusGUID: String(raw.genusGUID),
    resourceRoleGUID: String(raw.resourceRoleGUID ?? ''),
    measureUnit: String(raw.measureUnit ?? ''),
    periodMonth: String(raw.periodMonth).slice(0, 10),
    rowProjectGUID: String(raw.rowProjectGUID),
    rowOrganizationGUID: raw.rowOrganizationGUID ?? null,
    rowOwnerUserGUID: raw.rowOwnerUserGUID,
    projectName: String(raw.projectName ?? ''),
    taskName: String(raw.taskName ?? ''),
    resourceRoleName: String(raw.resourceRoleName ?? ''),
    qtyPlanned: num(raw.qtyPlanned),
    qtyContracted: num(raw.qtyContracted),
    sumForBudget: num(raw.sumForBudget),
    qtyRestToContract: raw.qtyRestToContract == null ? num(raw.qtyPlanned) - num(raw.qtyContracted) : num(raw.qtyRestToContract),
    qtyDelivered: num(raw.qtyDelivered),
    qtyUsed: num(raw.qtyUsed),
    qtyOnHand: raw.qtyOnHand == null ? num(raw.qtyDelivered) - num(raw.qtyUsed) : num(raw.qtyOnHand),
    lineCount: num(raw.lineCount),
    hasStalePlan: !!raw.hasStalePlan,
    updated_at: raw.updated_at,
  };
}

export interface Monitor01Event { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new?: any; old?: any }
/**
 * The rows after some realtime events: INSERT / UPDATE replace the row of the key, DELETE removes it. The map is copied only when something changed
 * (the screen compares references), and a row that did not change is the SAME object, so only its cells re-render.
 */
export function applyMonitor01Events(rows: ReadonlyMap<string, Monitor01Row>, events: Monitor01Event[]): ReadonlyMap<string, Monitor01Row> {
  let next: Map<string, Monitor01Row> | null = null;
  for (const e of events) {
    if (e.eventType === 'DELETE') {
      if (!e.old?.rowOwnerGUID) continue;
      const k = monitor01Key(e.old);
      if ((next ?? rows).has(k)) { next ??= new Map(rows); next.delete(k); }
    } else if (e.new?.rowOwnerGUID) {
      const row = parseMonitor01Row(e.new);
      const k = monitor01Key(row);
      const old = (next ?? rows).get(k);
      if (old && old.updated_at && old.updated_at === row.updated_at) continue;     // the same version again (a replay)
      next ??= new Map(rows);
      next.set(k, row);
    }
  }
  return next ?? rows;
}

// ---- filters ----------------------------------------------------------------------------------------------------------------------------------------------
export interface Monitor01Filters { startDate: string; finishDate: string; project: string; task: string; resource: string }
export const EMPTY_MONITOR01_FILTERS: Monitor01Filters = { startDate: '', finishDate: '', project: '', task: '', resource: '' };
export const monitor01FiltersActive = (f: Monitor01Filters): boolean => !!(f.startDate.trim() || f.finishDate.trim() || f.project.trim() || f.task.trim() || f.resource.trim());
/** an unreadable date is an error of the field, not a filter: the field is red and the rows are not cut */
export const monitor01DateErrors = (f: Monitor01Filters): { startDate: boolean; finishDate: boolean } => ({
  startDate: !!f.startDate.trim() && parseDayInput(f.startDate) === null,
  finishDate: !!f.finishDate.trim() && parseDayInput(f.finishDate) === null,
});

const lastDayOfMonth = (monthStart: string): string => {
  const [y, m] = monthStart.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const contains = (text: string, needle: string): boolean => !needle.trim() || text.toLowerCase().includes(needle.trim().toLowerCase());

/** A month is shown when it OVERLAPS [startDate, finishDate] (the rows are monthly). The names are matched with "contains", case-insensitive. */
export function filterMonitor01Rows(rows: Iterable<Monitor01Row>, f: Monitor01Filters): Monitor01Row[] {
  const from = parseDayInput(f.startDate);
  const to = parseDayInput(f.finishDate);
  const out: Monitor01Row[] = [];
  for (const r of rows) {
    if (from && lastDayOfMonth(r.periodMonth) < from) continue;
    if (to && r.periodMonth > to) continue;
    if (!contains(r.projectName, f.project) || !contains(r.taskName, f.task) || !contains(r.resourceRoleName, f.resource)) continue;
    out.push(r);
  }
  return out;
}

export function rowsOfTab(rows: Monitor01Row[], tab: Monitor01Tab): Monitor01Row[] {
  const genus = MONITOR01_TABS.find((t) => t.id === tab)?.genus ?? MONITOR01_GENUS_ORDER;
  return rows.filter((r) => genus.includes(r.genusGUID));
}

/** the order of the sheet: genus, role name, month, task name (then project, for the full data set) */
export function sortMonitor01Rows(rows: Monitor01Row[]): Monitor01Row[] {
  const g = (r: Monitor01Row) => { const i = MONITOR01_GENUS_ORDER.indexOf(r.genusGUID); return i < 0 ? 99 : i; };
  return [...rows].sort((a, b) =>
    g(a) - g(b) || a.resourceRoleName.localeCompare(b.resourceRoleName) || a.periodMonth.localeCompare(b.periodMonth) || a.taskName.localeCompare(b.taskName) || a.projectName.localeCompare(b.projectName));
}

// ---- totals ----------------------------------------------------------------------------------------------------------------------------------------------
export type Monitor01Sums = Record<Monitor01Measure, number>;
export interface Monitor01UnitTotal { unit: string; sums: Monitor01Sums; sumForBudget: number; rows: number }
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const emptySums = (): Monitor01Sums => ({ planned: 0, contracted: 0, restToContract: 0, delivered: 0, used: 0, onHand: 0 });
/** sums of rows PER UNIT (never one number for hours + pieces) */
export function totalsByUnit(rows: Monitor01Row[]): Monitor01UnitTotal[] {
  const map = new Map<string, Monitor01UnitTotal>();
  for (const r of rows) {
    const t = map.get(r.measureUnit) ?? { unit: r.measureUnit, sums: emptySums(), sumForBudget: 0, rows: 0 };
    for (const m of MONITOR01_MEASURES) t.sums[m] += r[MONITOR01_MEASURE_FIELD[m]] as number;
    t.sumForBudget += r.sumForBudget;
    t.rows += 1;
    map.set(r.measureUnit, t);
  }
  return [...map.values()].map((t) => ({ ...t, sumForBudget: round2(t.sumForBudget), sums: Object.fromEntries(MONITOR01_MEASURES.map((m) => [m, round2(t.sums[m])])) as Monitor01Sums })).sort((a, b) => a.unit.localeCompare(b.unit));
}

/**
 * The TotalsRow at the bottom of the table: `sumForBudget` (money - one number for all the rows shown) and `qty` (the six quantity columns, PER UNIT - hours and pieces are never added:
 * one line per unit). The quantity columns are blank on the line of the money alone when the rows have more than one unit.
 */
export interface Monitor01Totals { sumForBudget: number; qty: Monitor01UnitTotal[]; rows: Monitor01Row[] }
export function monitor01Totals(rows: Monitor01Row[]): Monitor01Totals {
  return { sumForBudget: round2(rows.reduce((a, r) => a + r.sumForBudget, 0)), qty: totalsByUnit(rows), rows };
}

// ---- the table: what the screen draws ----------------------------------------------------------------------------------------------------------------------
export type Monitor01Item =
  | { kind: 'total'; key: string; unit: string; sums: Monitor01Sums; sumForBudget: number; rows: Monitor01Row[] }
  | { kind: 'group'; key: string; genus: string }
  | { kind: 'subtotal'; key: string; genus: string; unit: string; sums: Monitor01Sums; sumForBudget: number; rows: Monitor01Row[] }
  | { kind: 'row'; key: string; row: Monitor01Row };

/** total rows (per unit) on top, then every genus: its caption, its subtotals (per unit), its rows */
export function buildMonitor01Items(rows: Monitor01Row[]): Monitor01Item[] {
  const sorted = sortMonitor01Rows(rows);
  const items: Monitor01Item[] = [];
  for (const t of totalsByUnit(sorted)) items.push({ kind: 'total', key: `total|${t.unit}`, unit: t.unit, sums: t.sums, sumForBudget: t.sumForBudget, rows: sorted.filter((r) => r.measureUnit === t.unit) });
  for (const genus of MONITOR01_GENUS_ORDER) {
    const own = sorted.filter((r) => r.genusGUID === genus);
    if (!own.length) continue;
    items.push({ kind: 'group', key: `group|${genus}`, genus });
    for (const t of totalsByUnit(own)) items.push({ kind: 'subtotal', key: `sub|${genus}|${t.unit}`, genus, unit: t.unit, sums: t.sums, sumForBudget: t.sumForBudget, rows: own.filter((r) => r.measureUnit === t.unit) });
    for (const r of own) items.push({ kind: 'row', key: monitor01Key(r), row: r });
  }
  return items;
}

// ---- the Sum explorer: the filter of the source transactions of a number --------------------------------------------------------------------------------------
export interface Monitor01DrillScope { projectGUID?: string | null; filters: Monitor01Filters }
/** the filter keys of monitor01_sum_sources for ONE row (a cell): exactly the keys of the row */
export function drillFilterOfRow(r: Monitor01Row): Record<string, any> {
  return { taskGUID: r.rowOwnerGUID, genusGUID: r.genusGUID, roleGUID: r.resourceRoleGUID, unit: r.measureUnit, month: r.periodMonth };
}
/**
 * the filter for SOME rows (a subtotal, a total): the genus and unit they share, the project, the date window, and - while a text filter is active - the tasks / roles that are shown,
 * so the list adds up to exactly the number on the screen
 */
export function drillFilterOfRows(rows: Monitor01Row[], scope: Monitor01DrillScope, shared: { genus?: string; unit?: string }): Record<string, any> {
  const out: Record<string, any> = {};
  if (shared.genus) out.genusGUID = shared.genus;
  if (shared.unit !== undefined) out.unit = shared.unit;
  if (scope.projectGUID) out.projectGUID = scope.projectGUID;
  const f = scope.filters;
  const from = parseDayInput(f.startDate);
  const to = parseDayInput(f.finishDate);
  if (from) out.fromMonth = `${from.slice(0, 7)}-01`;
  if (to) out.toMonth = `${to.slice(0, 7)}-01`;
  if (f.project.trim() || f.task.trim()) out.taskGUIDs = [...new Set(rows.map((r) => r.rowOwnerGUID))];
  if (f.resource.trim()) out.roleGUIDs = [...new Set(rows.map((r) => r.resourceRoleGUID))];
  return out;
}

/** the measures whose list is made of two lists (the operands), with their signs */
export function drillOperands(measure: Monitor01Measure): { measure: 'planned' | 'contracted' | 'delivered' | 'used'; sign: 1 | -1 }[] {
  switch (measure) {
    case 'planned': return [{ measure: 'planned', sign: 1 }];
    case 'contracted': return [{ measure: 'contracted', sign: 1 }];
    case 'restToContract': return [{ measure: 'planned', sign: 1 }, { measure: 'contracted', sign: -1 }];
    case 'delivered': return [{ measure: 'delivered', sign: 1 }];
    case 'used': return [{ measure: 'used', sign: 1 }];
    case 'onHand': return [{ measure: 'delivered', sign: 1 }, { measure: 'used', sign: -1 }];
  }
}

/** '2026-10-01' → 'Oct 2026' (the sheet's 10); the month is year-month because a project can cross years */
export function monthLabel(periodMonth: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(periodMonth || '');
  if (!m) return periodMonth || '';
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[+m[2] - 1] ?? m[2]} ${m[1]}`;
}
/** 12.5 → '12.5', 24 → '24', 0 → '0'; a fact column without data stays blank (as in the sheet) */
export function formatMonitor01Number(n: number, blankZero = false): string {
  if (!Number.isFinite(n)) return '';
  if (blankZero && n === 0) return '';
  return String(round2(n));
}
