// monitor01Model - the rows of monitor01_view (documentation/MONITOR01_WBS.html; SQL: PART 25) and everything the dashboard computes from them, all pure:
//   * the key of a row and the PATCH of a realtime event (the screen never refetches: it replaces one row by its key)
//   * the filters of the bar (startDate · finishDate typed, Project · Task · Resource picked from a list - monitor01*Options, exact GUID) and the tabs (Time · Material · Expense · All)
//   * the table: the totals (per unit - hours and pieces are never added) and the TREE Project → Resource role → Month (ascending) → Task name, every node with its subtotal (per unit) and
//     collapsible (the set of collapsed nodes lives on the screen), the TotalsRow at the bottom
//   * the filter of the Sum explorer for a cell, a subtotal and a total
// The numbers come ready from the database (rest to contract and on-hand are generated columns): nothing is calculated here except sums of rows.
import { amountOfVatBasis, VatBasis } from '../../vat/vatBasis';
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import { parseDayInput } from '../../../documents/fact/input/factInputModel';

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
  qtyReceived: number;
  /** the quantity of the POSTED vendor invoices (the column Vendor Invoiced, after Received) */
  qtyVendorInvoiced: number;
  /** the money of the POSTED vendor invoices (Σ sumForBudget of the 'invoiced' movements, the same money as the Budget column; the column Sum under Vendor Invoice) */
  sumVendorInvoiced: number;
  /** the quantity of the POSTED customer invoices (the group Customer Invoice, the last one: column Qty; the 'sold' movements of the register; made of the Deliverable = Revenue lines) */
  qtyCustomerInvoiced: number;
  /** the money of the POSTED customer invoices (Σ sumForBudget of the 'sold' movements; the column Sum under Customer Invoice) */
  sumCustomerInvoiced: number;
  /** VAT basis (documentation/VENDOR_INVOICE_DOC.html section 13): the three money fields above are NET; these are the VAT and the part of it that is cost (a customer invoice's VAT is never cost).
   *  The screen shows the money of the basis the user picked (applyMonitor01VatBasis). Missing = 0. */
  vatBudget?: number; vatInCostBudget?: number; vatVendorInvoiced?: number; vatInCostVendorInvoiced?: number; vatCustomerInvoiced?: number;
  /** the quantity of the POSTED purchase orders (the column Ordered, the first of the Fact group; SQL PART 28: 'ordered' movements) */
  qtyOrdered: number;
  qtyUsed: number;
  qtyOnHand: number;
  lineCount: number;
  hasStalePlan: boolean;
  updated_at?: string;
}

export type Monitor01Tab = 'time' | 'material' | 'expense' | 'deliverable' | 'all';
export const MONITOR01_TABS: { id: Monitor01Tab; title: string; icon: string; genus: string[] }[] = [
  { id: 'time', title: 'Time', icon: 'schedule', genus: [MANAGEMENT_GENUS.time] },
  { id: 'material', title: 'Material', icon: 'inventory_2', genus: [MANAGEMENT_GENUS.material] },
  { id: 'expense', title: 'Expense', icon: 'receipt_long', genus: [MANAGEMENT_GENUS.expense] },
  // the Deliverable (Revenue) genus is in the report only through the posted customer invoices (group Customer Invoice)
  { id: 'deliverable', title: 'Deliverable', icon: 'payments', genus: [MANAGEMENT_GENUS.revenue] },
  { id: 'all', title: 'All', icon: 'select_all', genus: [MANAGEMENT_GENUS.time, MANAGEMENT_GENUS.material, MANAGEMENT_GENUS.expense, MANAGEMENT_GENUS.revenue] },
];
export const MONITOR01_GENUS_ORDER: string[] = [MANAGEMENT_GENUS.time, MANAGEMENT_GENUS.material, MANAGEMENT_GENUS.expense, MANAGEMENT_GENUS.revenue];
export const monitor01GenusTitle = (genus: string): string => (genus === MANAGEMENT_GENUS.time ? 'Time' : genus === MANAGEMENT_GENUS.material ? 'Material' : genus === MANAGEMENT_GENUS.expense ? 'Expense' : genus === MANAGEMENT_GENUS.revenue ? 'Deliverable' : genus);

/** the numbers of the sheet, in the order of its columns (Ordered = the posted purchase orders, first of the Fact group) */
export const MONITOR01_MEASURES = ['planned', 'contracted', 'restToContract', 'ordered', 'received', 'vendorInvoiced', 'used', 'onHand', 'customerInvoiced'] as const;
export type Monitor01Measure = (typeof MONITOR01_MEASURES)[number];
export const MONITOR01_MEASURE_FIELD: Record<Monitor01Measure, keyof Monitor01Row> = {
  planned: 'qtyPlanned', contracted: 'qtyContracted', restToContract: 'qtyRestToContract', ordered: 'qtyOrdered', received: 'qtyReceived', vendorInvoiced: 'qtyVendorInvoiced', used: 'qtyUsed', onHand: 'qtyOnHand', customerInvoiced: 'qtyCustomerInvoiced',
};
/** the header texts of the columns (the sheet's own spelling corrected; every header starts with a capital letter) */
export const MONITOR01_MEASURE_TITLE: Record<Monitor01Measure, string> = {
  planned: 'Planned', contracted: 'Contracted', restToContract: 'Rest to contract', ordered: 'Ordered', received: 'Received', vendorInvoiced: 'Vendor Invoiced', used: 'Actually used', onHand: 'On-hand', customerInvoiced: 'Customer Invoiced',
};
/** the header texts of the dimension columns and of the money column */
export const MONITOR01_HEAD = { project: 'Project', role: 'Resource role', month: 'Month', task: 'Task name', unit: 'Unit', sumForBudget: 'Budget' } as const;
/** the group Vendor Invoice (1st level, after Fact) has two columns (2nd level): its quantity and its money */
export const MONITOR01_VENDOR_INVOICE_HEAD = { group: 'Vendor Invoice', qty: 'Quantity', sum: 'Amount' } as const;
/** the group Customer Invoice (1st level, the LAST one, after Vendor Invoice) has the same two columns */
export const MONITOR01_CUSTOMER_INVOICE_HEAD = { group: 'Customer Invoice', qty: 'Quantity', sum: 'Amount' } as const;
/** the group header over the columns */
export const MONITOR01_MEASURE_GROUP: Record<Monitor01Measure, 'Plan' | 'Fact' | 'Vendor Invoice' | 'Customer Invoice'> = { planned: 'Plan', contracted: 'Plan', restToContract: 'Plan', ordered: 'Fact', received: 'Fact', vendorInvoiced: 'Vendor Invoice', used: 'Fact', onHand: 'Fact', customerInvoiced: 'Customer Invoice' };

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
    qtyReceived: num(raw.qtyReceived),
    qtyVendorInvoiced: num(raw.qtyVendorInvoiced),
    sumVendorInvoiced: num(raw.sumVendorInvoiced),
    qtyCustomerInvoiced: num(raw.qtyCustomerInvoiced),
    sumCustomerInvoiced: num(raw.sumCustomerInvoiced),
    vatBudget: num(raw.vatBudget),
    vatInCostBudget: num(raw.vatInCostBudget),
    vatVendorInvoiced: num(raw.vatVendorInvoiced),
    vatInCostVendorInvoiced: num(raw.vatInCostVendorInvoiced),
    vatCustomerInvoiced: num(raw.vatCustomerInvoiced),
    qtyOrdered: num(raw.qtyOrdered),
    qtyUsed: num(raw.qtyUsed),
    qtyOnHand: raw.qtyOnHand == null ? num(raw.qtyReceived) - num(raw.qtyUsed) : num(raw.qtyOnHand),
    lineCount: num(raw.lineCount),
    hasStalePlan: !!raw.hasStalePlan,
    updated_at: raw.updated_at,
  };
}

/**
 * The rows on a VAT basis: the three money fields (sumForBudget, sumVendorInvoiced, sumCustomerInvoiced) become net + the VAT that is cost (basis 'cost'), net ('net') or net + all VAT ('gross');
 * everything below (the tree, the subtotals, the totals row) keeps working on those fields. A customer invoice's VAT is never cost, so on 'cost' its amount stays net.
 */
export function applyMonitor01VatBasis(rows: Monitor01Row[], basis: VatBasis): Monitor01Row[] {
  if (basis === 'net') return rows;
  return rows.map((r) => ({
    ...r,
    sumForBudget: amountOfVatBasis(r.sumForBudget, r.vatBudget, r.vatInCostBudget, basis),
    sumVendorInvoiced: amountOfVatBasis(r.sumVendorInvoiced, r.vatVendorInvoiced, r.vatInCostVendorInvoiced, basis),
    sumCustomerInvoiced: amountOfVatBasis(r.sumCustomerInvoiced, r.vatCustomerInvoiced, 0, basis),
  }));
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

// ---- the stamp: "did my rows change, is the worker keeping up?" ------------------------------------------------------------------------------------------------------
export interface Monitor01Stamp { count: number; maxUpdatedAt: number | null; queued: number; queuedAgeSeconds: number }
const time = (v: unknown): number | null => { if (v == null || v === '') return null; const t = typeof v === 'number' ? v : Date.parse(String(v)); return Number.isFinite(t) ? t : null; };
/** the answer of monitor01_stamp → typed (a missing field is 0 / null, never an exception) */
export function parseMonitor01Stamp(data: any): Monitor01Stamp {
  const d = data && typeof data === 'object' ? data : {};
  return { count: num(d.count), maxUpdatedAt: time(d.maxUpdatedAt), queued: num(d.queued), queuedAgeSeconds: num(d.queuedAgeSeconds) };
}
/** the same two numbers of the rows the screen holds */
export function monitor01LocalStamp(rows: Iterable<Monitor01Row>): { count: number; maxUpdatedAt: number | null } {
  let count = 0; let max: number | null = null;
  for (const r of rows) { count += 1; const t = time(r.updated_at); if (t !== null && (max === null || t > max)) max = t; }
  return { count, maxUpdatedAt: max };
}
/** the server has another set of rows than the screen: another number, or a newer change (a row the screen holds with NO updated_at is not compared by time) */
export function monitor01StampDiffers(server: Pick<Monitor01Stamp, 'count' | 'maxUpdatedAt'>, local: { count: number; maxUpdatedAt: number | null }): boolean {
  if (server.count !== local.count) return true;
  return server.maxUpdatedAt !== null && local.maxUpdatedAt !== null && server.maxUpdatedAt !== local.maxUpdatedAt;
}

// ---- filters ----------------------------------------------------------------------------------------------------------------------------------------------
// project / task / resource are GUIDs (rowProjectGUID / rowOwnerGUID / resourceRoleGUID), picked from a list (monitor01*Options below) - never typed free text:
// a name is not a key (two tasks can share a name), so the filter must be exact. '' = "not filtered" (also the clear value of the select).
export interface Monitor01Filters { startDate: string; finishDate: string; projectGUID: string; taskGUID: string; resourceGUID: string }
export const EMPTY_MONITOR01_FILTERS: Monitor01Filters = { startDate: '', finishDate: '', projectGUID: '', taskGUID: '', resourceGUID: '' };
/**
 * The radio Projects | Subprojects | All (subprojects, documentation/SUBPROJECTS_BRD_TRD.html): 'projects' keeps the rows of the projects that are NOT a subproject of any task, 'subprojects' the rows of the ones that are, 'all' everything.
 * `subprojectGUIDs` null = the radio is not shown (no project of the organization uses subprojects): no row is cut.
 */
export function filterMonitor01RowsByProjectKind<T extends { rowProjectGUID: string }>(rows: T[], kind: 'projects' | 'subprojects' | 'all', subprojectGUIDs: ReadonlySet<string> | null): T[] {
  if (!subprojectGUIDs || kind === 'all') return rows;
  return rows.filter((r) => (kind === 'subprojects' ? subprojectGUIDs.has(r.rowProjectGUID) : !subprojectGUIDs.has(r.rowProjectGUID)));
}

export const monitor01FiltersActive = (f: Monitor01Filters): boolean => !!(f.startDate.trim() || f.finishDate.trim() || f.projectGUID.trim() || f.taskGUID.trim() || f.resourceGUID.trim());
/** an unreadable date is an error of the field, not a filter: the field is red and the rows are not cut */
export const monitor01DateErrors = (f: Monitor01Filters): { startDate: boolean; finishDate: boolean } => ({
  startDate: !!f.startDate.trim() && parseDayInput(f.startDate) === null,
  finishDate: !!f.finishDate.trim() && parseDayInput(f.finishDate) === null,
});

const lastDayOfMonth = (monthStart: string): string => {
  const [y, m] = monthStart.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** A month is shown when it OVERLAPS [startDate, finishDate] (the rows are monthly). project / task / resource are exact GUID matches. */
export function filterMonitor01Rows(rows: Iterable<Monitor01Row>, f: Monitor01Filters): Monitor01Row[] {
  const from = parseDayInput(f.startDate);
  const to = parseDayInput(f.finishDate);
  const out: Monitor01Row[] = [];
  for (const r of rows) {
    if (from && lastDayOfMonth(r.periodMonth) < from) continue;
    if (to && r.periodMonth > to) continue;
    if (f.projectGUID && r.rowProjectGUID !== f.projectGUID) continue;
    if (f.taskGUID && r.rowOwnerGUID !== f.taskGUID) continue;
    if (f.resourceGUID && r.resourceRoleGUID !== f.resourceGUID) continue;
    out.push(r);
  }
  return out;
}

export interface Monitor01SelectOption { value: string; label: string }
const optionsOf = (rows: readonly Monitor01Row[], guidOf: (r: Monitor01Row) => string, nameOf: (r: Monitor01Row) => string, projectGUID?: string | null): Monitor01SelectOption[] => {
  const byGUID = new Map<string, string>();
  for (const r of rows) {
    if (projectGUID && r.rowProjectGUID !== projectGUID) continue;
    const guid = guidOf(r);
    if (guid && !byGUID.has(guid)) byGUID.set(guid, nameOf(r) || guid);
  }
  return [...byGUID.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
};
/** the items of the Project select (standalone mode): every project that has at least one row */
export const monitor01ProjectOptions = (rows: readonly Monitor01Row[]): Monitor01SelectOption[] => optionsOf(rows, (r) => r.rowProjectGUID, (r) => r.projectName);
/** the items of the Task select, narrowed to one project when `projectGUID` is given (as the Contract select of the vendor invoice filter narrows with its Partner) */
export const monitor01TaskOptions = (rows: readonly Monitor01Row[], projectGUID?: string | null): Monitor01SelectOption[] => optionsOf(rows, (r) => r.rowOwnerGUID, (r) => r.taskName, projectGUID);
/** the items of the Resource select, narrowed to one project when `projectGUID` is given. Rows with no role (a Material / Expense line without one) are not offered: an empty value would clash with "not filtered". */
export const monitor01ResourceOptions = (rows: readonly Monitor01Row[], projectGUID?: string | null): Monitor01SelectOption[] => optionsOf(rows, (r) => r.resourceRoleGUID, (r) => r.resourceRoleName, projectGUID);

export function rowsOfTab(rows: Monitor01Row[], tab: Monitor01Tab): Monitor01Row[] {
  const genus = MONITOR01_TABS.find((t) => t.id === tab)?.genus ?? MONITOR01_GENUS_ORDER;
  return rows.filter((r) => genus.includes(r.genusGUID));
}

/** the order of the tree: project, genus (Time, Material, Expense), role name, MONTH ASCENDING, task name */
export function sortMonitor01Rows(rows: Monitor01Row[]): Monitor01Row[] {
  const g = (r: Monitor01Row) => { const i = MONITOR01_GENUS_ORDER.indexOf(r.genusGUID); return i < 0 ? 99 : i; };
  return [...rows].sort((a, b) =>
    a.projectName.localeCompare(b.projectName) || a.rowProjectGUID.localeCompare(b.rowProjectGUID) || g(a) - g(b) || a.resourceRoleName.localeCompare(b.resourceRoleName)
    || a.resourceRoleGUID.localeCompare(b.resourceRoleGUID) || a.periodMonth.localeCompare(b.periodMonth) || a.taskName.localeCompare(b.taskName) || a.rowOwnerGUID.localeCompare(b.rowOwnerGUID));
}

// ---- totals ----------------------------------------------------------------------------------------------------------------------------------------------
export type Monitor01Sums = Record<Monitor01Measure, number>;
export interface Monitor01UnitTotal { unit: string; sums: Monitor01Sums; sumForBudget: number; sumVendorInvoiced: number; sumCustomerInvoiced: number; rows: number }
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const emptySums = (): Monitor01Sums => ({ planned: 0, contracted: 0, restToContract: 0, ordered: 0, received: 0, vendorInvoiced: 0, used: 0, onHand: 0, customerInvoiced: 0 });
/** sums of rows PER UNIT (never one number for hours + pieces) */
export function totalsByUnit(rows: Monitor01Row[]): Monitor01UnitTotal[] {
  const map = new Map<string, Monitor01UnitTotal>();
  for (const r of rows) {
    const t = map.get(r.measureUnit) ?? { unit: r.measureUnit, sums: emptySums(), sumForBudget: 0, sumVendorInvoiced: 0, sumCustomerInvoiced: 0, rows: 0 };
    for (const m of MONITOR01_MEASURES) t.sums[m] += r[MONITOR01_MEASURE_FIELD[m]] as number;
    t.sumForBudget += r.sumForBudget;
    t.sumVendorInvoiced += r.sumVendorInvoiced;
    t.sumCustomerInvoiced += r.sumCustomerInvoiced;
    t.rows += 1;
    map.set(r.measureUnit, t);
  }
  return [...map.values()].map((t) => ({ ...t, sumForBudget: round2(t.sumForBudget), sumVendorInvoiced: round2(t.sumVendorInvoiced), sumCustomerInvoiced: round2(t.sumCustomerInvoiced), sums: Object.fromEntries(MONITOR01_MEASURES.map((m) => [m, round2(t.sums[m])])) as Monitor01Sums })).sort((a, b) => a.unit.localeCompare(b.unit));
}

/**
 * The TotalsRow at the bottom of the table: `sumForBudget` (money - one number for all the rows shown) and `qty` (the six quantity columns, PER UNIT - hours and pieces are never added:
 * one line per unit). The quantity columns are blank on the line of the money alone when the rows have more than one unit.
 */
export interface Monitor01Totals { sumForBudget: number; sumVendorInvoiced: number; sumCustomerInvoiced: number; qty: Monitor01UnitTotal[]; rows: Monitor01Row[] }
export function monitor01Totals(rows: Monitor01Row[]): Monitor01Totals {
  return { sumForBudget: round2(rows.reduce((a, r) => a + r.sumForBudget, 0)), sumVendorInvoiced: round2(rows.reduce((a, r) => a + r.sumVendorInvoiced, 0)), sumCustomerInvoiced: round2(rows.reduce((a, r) => a + r.sumCustomerInvoiced, 0)), qty: totalsByUnit(rows), rows };
}

// ---- the table: what the screen draws ----------------------------------------------------------------------------------------------------------------------
//   Total (per unit)
//   Project 1                      ┐ every node has a subtotal (one line per unit: hours and pieces are never added) and a chevron: collapsed, its children are not in the list
//     Resource role                │
//       Month (ascending)          │
//         Task name                ┘ the rows of monitor01_view
export type Monitor01Level = 'project' | 'role' | 'month';
export const MONITOR01_LEVELS: Monitor01Level[] = ['project', 'role', 'month'];
export type Monitor01Item =
  | { kind: 'total'; key: string; unit: string; sums: Monitor01Sums; sumForBudget: number; sumVendorInvoiced: number; sumCustomerInvoiced: number; rows: Monitor01Row[] }
  | {
    kind: 'node'; key: string;
    /** the node (the same for every unit line of it): what the chevron collapses */
    nodeKey: string; level: Monitor01Level; label: string; projectGUID: string; genus?: string; roleGUID?: string; month?: string;
    /** the first line of the node (the one with the chevron and the label); more units of the node follow as plain subtotal lines */
    first: boolean; expanded: boolean; unit: string; sums: Monitor01Sums; sumForBudget: number; sumVendorInvoiced: number; sumCustomerInvoiced: number; rows: Monitor01Row[];
  }
  | { kind: 'row'; key: string; row: Monitor01Row };

export const monitor01ProjectKey = (projectGUID: string): string => `p|${projectGUID}`;
export const monitor01RoleKey = (r: Pick<Monitor01Row, 'rowProjectGUID' | 'genusGUID' | 'resourceRoleGUID'>): string => `${monitor01ProjectKey(r.rowProjectGUID)}|r|${r.genusGUID}|${r.resourceRoleGUID ?? ''}`;
export const monitor01MonthKey = (r: Pick<Monitor01Row, 'rowProjectGUID' | 'genusGUID' | 'resourceRoleGUID' | 'periodMonth'>): string => `${monitor01RoleKey(r)}|m|${String(r.periodMonth).slice(0, 10)}`;

/** every node of the tree of these rows (what "Collapse all" collapses) */
export function monitor01NodeKeys(rows: Iterable<Monitor01Row>): Set<string> {
  const keys = new Set<string>();
  for (const r of rows) { keys.add(monitor01ProjectKey(r.rowProjectGUID)); keys.add(monitor01RoleKey(r)); keys.add(monitor01MonthKey(r)); }
  return keys;
}

/** the rows of a list grouped by a key, in the order of the first row of each key (the rows are sorted, so the groups are too) */
function groupInOrder<T>(rows: T[], keyOf: (r: T) => string): { key: string; rows: T[] }[] {
  const out: { key: string; rows: T[] }[] = [];
  const at = new Map<string, { key: string; rows: T[] }>();
  for (const r of rows) {
    const k = keyOf(r);
    let g = at.get(k);
    if (!g) { g = { key: k, rows: [] }; at.set(k, g); out.push(g); }
    g.rows.push(r);
  }
  return out;
}

/** the total rows (per unit) on top, then the tree Project → Resource role → Month → Task; the nodes in `collapsed` show their subtotal only */
export function buildMonitor01Items(rows: Monitor01Row[], collapsed: ReadonlySet<string> = new Set()): Monitor01Item[] {
  const sorted = sortMonitor01Rows(rows);
  const items: Monitor01Item[] = [];
  for (const t of totalsByUnit(sorted)) items.push({ kind: 'total', key: `total|${t.unit}`, unit: t.unit, sums: t.sums, sumForBudget: t.sumForBudget, sumVendorInvoiced: t.sumVendorInvoiced, sumCustomerInvoiced: t.sumCustomerInvoiced, rows: sorted.filter((r) => r.measureUnit === t.unit) });

  /** the subtotal lines of a node (one per unit); returns whether its children are shown */
  const pushNode = (nodeKey: string, level: Monitor01Level, label: string, own: Monitor01Row[], extra: { genus?: string; roleGUID?: string; month?: string }): boolean => {
    const expanded = !collapsed.has(nodeKey);
    totalsByUnit(own).forEach((t, i) => items.push({
      kind: 'node', key: `node|${nodeKey}|${t.unit}`, nodeKey, level, label, projectGUID: own[0].rowProjectGUID, ...extra, first: i === 0, expanded, unit: t.unit, sums: t.sums, sumForBudget: t.sumForBudget, sumVendorInvoiced: t.sumVendorInvoiced, sumCustomerInvoiced: t.sumCustomerInvoiced,
      rows: own.filter((r) => r.measureUnit === t.unit),
    }));
    return expanded;
  };

  for (const project of groupInOrder(sorted, (r) => monitor01ProjectKey(r.rowProjectGUID))) {
    if (!pushNode(project.key, 'project', project.rows[0].projectName, project.rows, {})) continue;
    for (const role of groupInOrder(project.rows, monitor01RoleKey)) {
      const first = role.rows[0];
      if (!pushNode(role.key, 'role', first.resourceRoleName, role.rows, { genus: first.genusGUID, roleGUID: first.resourceRoleGUID })) continue;
      for (const month of groupInOrder(role.rows, monitor01MonthKey)) {
        if (!pushNode(month.key, 'month', monthLabel(month.rows[0].periodMonth), month.rows, { genus: first.genusGUID, roleGUID: first.resourceRoleGUID, month: month.rows[0].periodMonth })) continue;
        for (const r of month.rows) items.push({ kind: 'row', key: monitor01Key(r), row: r });
      }
    }
  }
  return items;
}

// ---- the Sum explorer: the filter of the source transactions of a number --------------------------------------------------------------------------------------
export interface Monitor01DrillScope { projectGUID?: string | null; filters: Monitor01Filters }
/** the filter keys of monitor01_sum_sources for ONE row (a cell): exactly the keys of the row */
export function drillFilterOfRow(r: Monitor01Row): Record<string, any> {
  return { taskGUID: r.rowOwnerGUID, genusGUID: r.genusGUID, roleGUID: r.resourceRoleGUID, unit: r.measureUnit, month: r.periodMonth };
}
/** the dashboard link of a Task name line: the task, the Finances tab of its genus and - when the line is known - the line of the sum (dashboardDeepLink.ts) */
export function dashboardLinkOfRow(r: Monitor01Row, lineGUID?: string | null): { projectGUID: string; taskGUID: string; genus: string; lineGUID?: string } {
  return { projectGUID: r.rowProjectGUID, taskGUID: r.rowOwnerGUID, genus: r.genusGUID, ...(lineGUID ? { lineGUID } : {}) };
}
/**
 * the filter for SOME rows (a subtotal, a total): the genus and unit they share, the project, the date window, and - while a Project / Task / Resource filter is set - the tasks / roles that
 * are shown, so the list adds up to exactly the number on the screen
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
  if (f.projectGUID.trim() || f.taskGUID.trim()) out.taskGUIDs = [...new Set(rows.map((r) => r.rowOwnerGUID))];
  if (f.resourceGUID.trim()) out.roleGUIDs = [...new Set(rows.map((r) => r.resourceRoleGUID))];
  return out;
}

/**
 * the filter for a NODE of the tree (a subtotal line of a project, a role or a month): the unit of the line, the project the node is in, the role (and its genus) from the role level on, the month at the month level,
 * and what the active filters cut - so the list adds up to exactly the number of the line
 */
export function drillFilterOfNode(node: Extract<Monitor01Item, { kind: 'node' }>, scope: Monitor01DrillScope): Record<string, any> {
  const out = drillFilterOfRows(node.rows, scope, { unit: node.unit, genus: node.level === 'project' ? undefined : node.genus });
  out.projectGUID = node.projectGUID;
  if (node.level !== 'project' && node.roleGUID !== undefined) out.roleGUID = node.roleGUID;
  if (node.level === 'month' && node.month) out.month = node.month;
  return out;
}

/** the measures whose list is made of two lists (the operands), with their signs */
export function drillOperands(measure: Monitor01Measure): { measure: 'planned' | 'contracted' | 'ordered' | 'received' | 'vendorInvoiced' | 'customerInvoiced' | 'used'; sign: 1 | -1 }[] {
  switch (measure) {
    case 'planned': return [{ measure: 'planned', sign: 1 }];
    case 'contracted': return [{ measure: 'contracted', sign: 1 }];
    case 'restToContract': return [{ measure: 'planned', sign: 1 }, { measure: 'contracted', sign: -1 }];
    case 'ordered': return [{ measure: 'ordered', sign: 1 }];
    case 'received': return [{ measure: 'received', sign: 1 }];
    case 'vendorInvoiced': return [{ measure: 'vendorInvoiced', sign: 1 }];
    case 'customerInvoiced': return [{ measure: 'customerInvoiced', sign: 1 }];
    case 'used': return [{ measure: 'used', sign: 1 }];
    case 'onHand': return [{ measure: 'received', sign: 1 }, { measure: 'used', sign: -1 }];
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
