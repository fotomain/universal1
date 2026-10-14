// factInputModel - the FACT INPUT document of a task (documentation/FACT_INPUT.html; SQL: PART 24 of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql).
//
//   task_fact_header    the document: rowJSON.documentHeader { projectTaskGUID (read only) · activeUser · created_at · documentNumber · documentStatus · strongInput · postedAt · postedBy · unpostedAt }
//   task_fact_usage_timeline  its lines: the fields of task_line_plan_timeline + rowHeaderGUID · genusGUID · qtyForContract (the ONLY quantity a user states) · periodDay · rowJSON (what the line is)
//
//   project setting factStrongInputByTaskLine (false by default), copied into the header when the document is created:
//     true   the lines of the task go into the document WITH their task line GUID; users cannot add lines, only delete and update (the date and qtyForContract)
//     false  the lines are copied DISCONNECTED from the task line GUIDs; users add lines freely
//
// Everything here is pure (no React, no Supabase), so the rules are tested without a screen: the twin of the database rules (sums, states) and the texts of the problems.
import { MANAGEMENT_GENUS } from '../../catalog/management/genus/managementGenusModel';
import { parseCompactDateDigits } from '../../ui/components/common/date_input/dateInputFormat';

export const FACT_HEADER_TABLE = 'task_fact_header';
export const FACT_USAGE_TIMELINE_TABLE = 'task_fact_usage_timeline';
/** the sums made by pg_cron for Monitor01 (read only) */
export const FACT_SUMMARY_TABLE = 'project_status_month_turnover';
export const RPC_FACT_CREATE = 'task_fact_document_create';
export const RPC_FACT_POST = 'post_task_fact_document';
export const RPC_FACT_UNPOST = 'unpost_task_fact_document';
/** the list of documents with their totals (filters: FactListFilter) */
export const RPC_FACT_LIST = 'task_fact_document_list';
/** the redux entity of the lines (SystemMetaData, factMetaData.ts): the ReusableTable of the form reads / edits task_fact_usage_timeline through it */
export const FACT_USAGE_TIMELINE_ENTITY = 'taskFactUsageTimelineReusable';
/** the redux entity (SystemMetaData key) of the fact DOCUMENTS (task_fact_header): the table of the Actuals list reads them, realtime, and deletes a draft through it */
export const FACT_HEADER_ENTITY = 'taskFactHeader';
/** the list screen (hamburger menu → Budgets → Actuals) */
export const FACT_LIST_ROUTE = '/pm/fact/list';
/** the route of the screen (app/pm/project/task/fact): ?taskGUID=…&taskLineGUID=…&genus=…&projectGUID=…&documentGUID=… */
export const FACT_INPUT_ROUTE = '/pm/project/task/fact';
/** the project setting (project_table.rowJSON) */
export const FACT_STRONG_INPUT_SETTING = 'factStrongInputByTaskLine';

export type FactDocumentStatus = 'draft' | 'posted';
export type FactPostProblemCode = 'documentIsPosted' | 'documentIsNotPosted' | 'documentHasNoLines' | 'dateInTheFuture' | 'taskLineMissing';

/** the tabs of the document (DocumentTabs), like the genus tabs of the Finances table */
export const FACT_TABS: { genus: string; title: string; icon: string }[] = [
  { genus: MANAGEMENT_GENUS.time, title: 'Time', icon: 'schedule' },
  { genus: MANAGEMENT_GENUS.material, title: 'Material', icon: 'inventory_2' },
  { genus: MANAGEMENT_GENUS.expense, title: 'Expenses', icon: 'receipt_long' },
  { genus: MANAGEMENT_GENUS.revenue, title: 'Revenues', icon: 'payments' },
];
export const FACT_DEFAULT_GENUS = FACT_TABS[0].genus;
export const factGenusOf = (genus: string | null | undefined): string => (FACT_TABS.some((t) => t.genus === genus) ? (genus as string) : FACT_DEFAULT_GENUS);

export interface FactDocumentHeaderJSON {
  /** read only: = rowOwnerGUID */
  projectTaskGUID?: string;
  activeUser?: string;
  created_at?: string;
  documentNumber?: string;
  documentStatus?: FactDocumentStatus;
  strongInput?: boolean;
  postedAt?: string;
  postedBy?: string;
  unpostedAt?: string;
}
export interface FactHeaderRow {
  rowGUID: string;
  rowProjectGUID: string;
  rowOwnerGUID: string;
  rowJSON: { documentHeader?: FactDocumentHeaderJSON } & Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

/** what a fact line says about itself (copied from the task line when the document is created; typed in the free mode) */
export interface FactLineJSON {
  resourceRoleItem?: string;
  taskResourceItem?: string;
  taskResourceKind?: 'person' | 'equipment';
  measureUnitTaskLine?: string;
  budgetItemTaskLine?: string;
  taskLinePartnerItem?: string;
  taskResourceContract?: string;
  taskLinePartnerContract?: string;
  priceTaskLine?: number;
  /** the budget sum of ONE unit (sumForBudget / qty of the task line) */
  unitSumForBudget?: number;
  /** the accounting sum of ONE unit (sumForAccounting / qty of the task line) */
  unitSumForAccounting?: number;
  /** businessUnitTable.rowGUID of the task line (the list filters by it) */
  businessUnitTaskLine?: string;
  note?: string;
}
export interface FactLineRow {
  rowGUID: string;
  rowProjectGUID: string;
  rowOwnerGUID: string;
  rowHeaderGUID: string;
  /** timestamptz: the start of the day; EDITABLE in every line */
  rowPeriodDatetime: string;
  taskLineGUID: string | null;
  genusGUID: string;
  /** the quantity of the task line: read only */
  qtyForBudget: number | null;
  /** the quantity the user states */
  qtyForContract: number;
  sumForContract: number | null;
  sumForBudget: number | null;
  /** the sum in the accounting currency of the project (null = none) */
  sumForAccounting: number | null;
  periodDay?: string | null;
  orderInList: number;
  rowJSON: FactLineJSON;
  created_at?: string;
  updated_at?: string;
}

export interface FactPostProblem { lineGUID: string | null; problem: FactPostProblemCode | string }
export interface FactPostAnswer { status: 'posted' | 'refused' | 'draft'; lines: number; problems: FactPostProblem[] }

/** project setting -> boolean (missing = false: the free input) */
export const factStrongInputOf = (projectJSON: Record<string, any> | null | undefined): boolean => projectJSON?.[FACT_STRONG_INPUT_SETTING] === true;

export interface FactHeaderView {
  guid: string;
  number: string;
  status: FactDocumentStatus;
  strong: boolean;
  user: string;
  /** the name of the author (the list RPC reads it from userTable); empty = unknown */
  userName?: string;
  createdAt: string;
  postedAt: string | null;
  unpostedAt: string | null;
}
export function factHeaderOf(row: FactHeaderRow): FactHeaderView {
  const h = row?.rowJSON?.documentHeader || {};
  return {
    guid: row.rowGUID,
    number: h.documentNumber || '',
    status: h.documentStatus === 'posted' ? 'posted' : 'draft',
    strong: h.strongInput === true,
    user: h.activeUser || '',
    createdAt: h.created_at || row.created_at || '',
    postedAt: h.postedAt || null,
    unpostedAt: h.unpostedAt || null,
  };
}

/** the draft documents first-created-last: the one the menu item opens ("the latest draft of the task") */
export function latestDraft(rows: FactHeaderRow[]): FactHeaderRow | undefined {
  return [...(rows || [])]
    .filter((r) => factHeaderOf(r).status === 'draft')
    .sort((a, b) => factHeaderOf(b).createdAt.localeCompare(factHeaderOf(a).createdAt))[0];
}

/** the Post button: Post (a draft) · Posted · Post needed (a document that was unposted, changed and is a draft again) */
export type FactPostState = 'post' | 'posted' | 'postNeeded';
export function factPostState(h: FactHeaderView): FactPostState {
  if (h.status === 'posted') return 'posted';
  return h.unpostedAt ? 'postNeeded' : 'post';
}

// ---- what the user may do with a document (the database enforces the same by RLS / triggers) ----
export const canEditLines = (h: FactHeaderView): boolean => h.status === 'draft';
/** the strong input: no new lines, only delete and update */
export const canAddLines = (h: FactHeaderView): boolean => h.status === 'draft' && !h.strong;
export const canDeleteLines = (h: FactHeaderView): boolean => h.status === 'draft';
export const canPost = (h: FactHeaderView, lineCount: number): boolean => h.status === 'draft' && lineCount > 0;
export const canUnpost = (h: FactHeaderView): boolean => h.status === 'posted';
export const canDeleteDocument = (h: FactHeaderView): boolean => h.status === 'draft';

export const linesOfGenus = (lines: FactLineRow[], genus: string): FactLineRow[] => (lines || []).filter((l) => l.genusGUID === genus);

/** the genus of the line the user clicked: a strong line knows its task line; a free line does not, so the caller's genus is used */
export function genusOfTaskLine(lines: FactLineRow[], taskLineGUID: string | null | undefined, fallback?: string | null): string {
  const hit = taskLineGUID ? (lines || []).find((l) => l.taskLineGUID === taskLineGUID) : undefined;
  return factGenusOf(hit?.genusGUID ?? fallback);
}

// ---- the money: the TypeScript twin of the trigger task_fact_usage_timeline_before_write ----
/** 2 digits, half UP on the DECIMAL value (like numeric in PostgreSQL): 2.5 x 3.33 = 8.325 → 8.33, not 8.32 of the binary float */
const round2 = (n: number): number => { const s = Number(n.toPrecision(12)); return Math.round(s * 100 + (s >= 0 ? 1e-7 : -1e-7)) / 100; };
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function factLineSums(qtyForContract: number, json: FactLineJSON | null | undefined): { sumForContract: number | null; sumForBudget: number | null; sumForAccounting: number | null } {
  const qty = isNum(qtyForContract) ? qtyForContract : 0;
  return {
    sumForContract: isNum(json?.priceTaskLine) ? round2(qty * (json as FactLineJSON).priceTaskLine!) : null,
    sumForBudget: isNum(json?.unitSumForBudget) ? round2(qty * (json as FactLineJSON).unitSumForBudget!) : null,
    sumForAccounting: isNum(json?.unitSumForAccounting) ? round2(qty * (json as FactLineJSON).unitSumForAccounting!) : null,
  };
}

export interface FactUnitTotal { unit: string; qty: number; sumForContract: number | null }
/** the totals of some lines: per unit (hours and pieces are never added); the sum of the money is added only when every line of the unit has one */
export function factTotalsByUnit(lines: FactLineRow[]): FactUnitTotal[] {
  const map = new Map<string, FactUnitTotal & { complete: boolean }>();
  for (const l of lines || []) {
    const unit = l.rowJSON?.measureUnitTaskLine || '';
    const t = map.get(unit) || { unit, qty: 0, sumForContract: 0, complete: true };
    t.qty = round2(t.qty + (isNum(l.qtyForContract) ? l.qtyForContract : 0));
    if (isNum(l.sumForContract)) t.sumForContract = round2((t.sumForContract || 0) + l.sumForContract);
    else t.complete = false;
    map.set(unit, t);
  }
  return [...map.values()].map(({ complete, ...t }) => ({ ...t, sumForContract: complete ? t.sumForContract : null }));
}

// ---- the date and the quantity as the user types them ----
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_EU = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
/** 'YYYY-MM-DD', 'DD.MM.YYYY', or eight digits (20260101 / 20122026) → 'YYYY-MM-DD' (a real calendar day), else null */
export function parseDayInput(text: string | null | undefined): string | null {
  const s = String(text ?? '').trim();
  let y: number, m: number, d: number;
  const a = DAY.exec(s);
  const b = DAY_EU.exec(s);
  const c = parseCompactDateDigits(s);
  if (c) { y = c.y; m = c.m; d = c.d; }
  else if (a) { y = +a[1]; m = +a[2]; d = +a[3]; }
  else if (b) { y = +b[3]; m = +b[2]; d = +b[1]; }
  else return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** the value of rowPeriodDatetime for a day: the start of the day (UTC, like the movements of the plan) */
export const dayToPeriodDatetime = (day: string): string => `${day}T00:00:00.000Z`;
/** the day a rowPeriodDatetime / periodDay value stands for (the same +12 h rule as the database: a zone offset never moves the day) */
export function dayOfPeriod(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return String(value).slice(0, 10);
  return new Date(t + 12 * 3600 * 1000).toISOString().slice(0, 10);
}
/** a quantity: a number ≥ 0 with a point or a comma, at most 2 decimals; else null */
export function parseQtyInput(text: string | number | null | undefined): number | null {
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? round2(text) : null;
  const s = String(text ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}
export const formatQty = (n: number | null | undefined): string => (isNum(n) ? String(round2(n)) : '');

// ---- the answers of Post ----
/** the answer of post_task_fact_document / unpost_task_fact_document → a typed answer (a missing field never throws) */
export function parseFactAnswer(data: any): FactPostAnswer {
  const d = data && typeof data === 'object' ? data : {};
  const status = d.status === 'posted' || d.status === 'draft' ? d.status : 'refused';
  const problems: FactPostProblem[] = Array.isArray(d.problems) ? d.problems.map((p: any) => ({ lineGUID: p?.lineGUID ?? null, problem: String(p?.problem ?? '') })) : [];
  return { status, lines: Number(d.lines) || 0, problems };
}
/** the sentence for a problem (the texts go through pmT in the screen) */
export function factProblemText(code: string): string {
  switch (code) {
    case 'documentIsPosted': return 'The document is already posted';
    case 'documentIsNotPosted': return 'The document is not posted';
    case 'documentHasNoLines': return 'The document has no lines';
    case 'dateInTheFuture': return 'A fact cannot be dated in the future';
    case 'taskLineMissing': return 'The task line of this line was deleted: delete the line';
    default: return code || 'Unknown problem';
  }
}

/** a new line of the FREE mode (the database fills project / task / day grain / sums) */
export function newFreeLine(header: { guid: string }, genus: string, day: string, orderInList: number, json: FactLineJSON = {}): Omit<FactLineRow, 'rowGUID' | 'rowProjectGUID' | 'rowOwnerGUID'> {
  return {
    rowHeaderGUID: header.guid,
    rowPeriodDatetime: dayToPeriodDatetime(day),
    taskLineGUID: null,
    genusGUID: factGenusOf(genus),
    qtyForBudget: null,
    qtyForContract: 0,
    sumForContract: null,
    sumForBudget: null,
    sumForAccounting: null,
    orderInList,
    rowJSON: json,
  };
}

/** the parameters of the screen route */
export interface OpenFactInputParams { taskGUID: string; projectGUID?: string | null; taskLineGUID?: string | null; genus?: string | null; documentGUID?: string | null }
export function factInputRouteParams(p: OpenFactInputParams): Record<string, string> {
  const out: Record<string, string> = { taskGUID: p.taskGUID };
  if (p.projectGUID) out.projectGUID = p.projectGUID;
  if (p.taskLineGUID) out.taskLineGUID = p.taskLineGUID;
  if (p.genus) out.genus = p.genus;
  if (p.documentGUID) out.documentGUID = p.documentGUID;
  return out;
}

// ---- the list of documents (task_fact_document_list) --------------------------------------------------------------------------------------------------------------
/** the fast filters of the list screen; an empty value = no filter */
export interface FactListFilter {
  /** factTimelinePeriod: 'YYYY-MM-DD' (typed in any form the date input reads) */
  fromDay: string;
  toDay: string;
  /** factProjectFilter: project_table.rowGUID */
  projectGUID: string;
  /** factBusinessUnitFilter: businessUnitTable.rowGUID */
  businessUnitGUID: string;
  /** factRoleFilter: resourceRoleTable.rowGUID */
  roleGUID: string;
  /** factResourceFilter: personTable / equipmentTable / productTable rowGUID */
  resourceGUID: string;
  /** authorFilter: a part of the name / e-mail of the author */
  author: string;
}
export const EMPTY_FACT_LIST_FILTER: FactListFilter = { fromDay: '', toDay: '', projectGUID: '', businessUnitGUID: '', roleGUID: '', resourceGUID: '', author: '' };
export const factListFilterActive = (f: FactListFilter): boolean => Object.values(f).some((v) => String(v || '').trim() !== '');
/** an unreadable date is an error of the field, not a filter */
export const factListDateErrors = (f: FactListFilter): { fromDay: boolean; toDay: boolean } => ({
  fromDay: !!f.fromDay.trim() && parseDayInput(f.fromDay) === null,
  toDay: !!f.toDay.trim() && parseDayInput(f.toDay) === null,
});
/** the filter as the RPC takes it: only what is set (and readable) */
export function factListFilterToRpc(f: FactListFilter, extra: Record<string, any> = {}): Record<string, any> {
  const out: Record<string, any> = { ...extra };
  const from = parseDayInput(f.fromDay);
  const to = parseDayInput(f.toDay);
  if (from) out.fromDay = from;
  if (to) out.toDay = to;
  if (f.projectGUID.trim()) out.projectGUID = f.projectGUID.trim();
  if (f.businessUnitGUID.trim()) out.businessUnitGUID = f.businessUnitGUID.trim();
  if (f.roleGUID.trim()) out.roleGUID = f.roleGUID.trim();
  if (f.resourceGUID.trim()) out.resourceGUID = f.resourceGUID.trim();
  if (f.author.trim()) out.author = f.author.trim();
  return out;
}

/** a row of the list: the document, its project and task, its author and the totals of ALL its lines */
export interface FactListRow {
  documentGUID: string;
  documentNumber: string;
  documentStatus: FactDocumentStatus;
  strongInput: boolean;
  authorGUID: string;
  authorName: string;
  createdAt: string;
  postedAt: string | null;
  unpostedAt: string | null;
  projectGUID: string;
  projectName: string;
  taskGUID: string;
  taskName: string;
  lineCount: number;
  firstDay: string | null;
  lastDay: string | null;
  sumForBudget: number;
  sumForContract: number;
  sumForAccounting: number;
}
export interface FactListTotals { sumForBudget: number; sumForContract: number; sumForAccounting: number }
export interface FactListAnswer { totalCount: number; totals: FactListTotals; rows: FactListRow[] }

const money = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? round2(n) : 0; };
/** the answer of task_fact_document_list → typed (numeric strings become numbers; a missing field never throws) */
export function parseFactListAnswer(data: any): FactListAnswer {
  const d = data && typeof data === 'object' ? data : {};
  const rows: FactListRow[] = (Array.isArray(d.rows) ? d.rows : []).map((r: any) => ({
    documentGUID: String(r.documentGUID),
    documentNumber: String(r.documentNumber ?? ''),
    documentStatus: r.documentStatus === 'posted' ? 'posted' : 'draft',
    strongInput: r.strongInput === true,
    authorGUID: String(r.authorGUID ?? ''),
    authorName: String(r.authorName ?? ''),
    createdAt: String(r.createdAt ?? ''),
    postedAt: r.postedAt ?? null,
    unpostedAt: r.unpostedAt ?? null,
    projectGUID: String(r.projectGUID ?? ''),
    projectName: String(r.projectName ?? ''),
    taskGUID: String(r.taskGUID ?? ''),
    taskName: String(r.taskName ?? ''),
    lineCount: Number(r.lineCount) || 0,
    firstDay: r.firstDay ?? null,
    lastDay: r.lastDay ?? null,
    sumForBudget: money(r.sumForBudget),
    sumForContract: money(r.sumForContract),
    sumForAccounting: money(r.sumForAccounting),
  }));
  const t = d.totals && typeof d.totals === 'object' ? d.totals : {};
  return { totalCount: Number(d.totalCount) || 0, totals: { sumForBudget: money(t.sumForBudget), sumForContract: money(t.sumForContract), sumForAccounting: money(t.sumForAccounting) }, rows };
}
/** the header of the form from a row of the list (the list RPC with taskGUID gives the documents of a task, newest first) */
export function factHeaderFromListRow(r: FactListRow): FactHeaderView {
  return { guid: r.documentGUID, number: r.documentNumber, status: r.documentStatus, strong: r.strongInput, user: r.authorGUID, userName: r.authorName, createdAt: r.createdAt, postedAt: r.postedAt, unpostedAt: r.unpostedAt };
}
/** the latest DRAFT of a list of documents (newest first), as the form opens it */
export function latestDraftOf(rows: FactListRow[]): FactListRow | undefined {
  return (rows || []).find((r) => r.documentStatus === 'draft');
}

// ---- a line made by the table (ReusableTable → createOne → task_fact_usage_timeline) -----------------------------------------------------------------------------------
/** the control keys the form puts into the rowJSON of a NEW row (newRowDefaults); the saga turns them into columns and they never reach the database as JSON */
export const FACT_NEW_ROW_KEYS = { header: 'factHeaderGUID', genus: 'factGenusGUID', day: 'factDay' } as const;
/**
 * What the table's createOne sends ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON }) → the row of task_fact_usage_timeline: the header, the genus (the tab) and the day come
 * from the control keys, the quantity starts at 0, rowParentGUID (a def-table column that this table does not have) is dropped.
 */
export function factLineInsert(payload: Record<string, any>): Record<string, any> {
  const json = { ...(payload?.rowJSON || {}) };
  const header = json[FACT_NEW_ROW_KEYS.header];
  const genus = json[FACT_NEW_ROW_KEYS.genus];
  const day = json[FACT_NEW_ROW_KEYS.day];
  delete json[FACT_NEW_ROW_KEYS.header]; delete json[FACT_NEW_ROW_KEYS.genus]; delete json[FACT_NEW_ROW_KEYS.day];
  // the nulls of an untouched new row are not kept in the description of the line
  const clean = Object.fromEntries(Object.entries(json).filter(([, v]) => v !== null && v !== undefined && v !== ''));
  return {
    rowGUID: payload.rowGUID,
    rowOwnerGUID: payload.rowOwnerGUID,
    rowHeaderGUID: header,
    genusGUID: factGenusOf(genus),
    rowPeriodDatetime: day ? dayToPeriodDatetime(String(day).slice(0, 10)) : dayToPeriodDatetime(new Date().toISOString().slice(0, 10)),
    qtyForContract: 0,
    orderInList: payload.orderInList ?? 0,
    rowJSON: clean,
  };
}

// ---- the live totals of a document (from the lines the table holds) ------------------------------------------------------------------------------------------------
export interface FactDocumentTotals { lineCount: number; sumForBudget: number; sumForContract: number; sumForAccounting: number }
/** the lines (rows of the redux entity) of ONE document, optionally of one tab */
export function factRowsOf(rows: any[] | null | undefined, headerGUID: string | null | undefined, genus?: string | null): any[] {
  return (Array.isArray(rows) ? rows : []).filter((r) => (r.rowHeaderGUID ?? r.rowJSON?.[FACT_NEW_ROW_KEYS.header]) === headerGUID && (!genus || (r.genusGUID ?? r.rowJSON?.[FACT_NEW_ROW_KEYS.genus]) === genus));
}
/** sums in cents, so the total of the lines is exactly the total of the document; a missing sum counts 0 */
export function factTotalsOf(rows: any[]): FactDocumentTotals {
  const cents = (v: unknown) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const t = rows.reduce((a, r) => ({ b: a.b + cents(r.sumForBudget), c: a.c + cents(r.sumForContract), a: a.a + cents(r.sumForAccounting) }), { b: 0, c: 0, a: 0 });
  return { lineCount: rows.length, sumForBudget: t.b / 100, sumForContract: t.c / 100, sumForAccounting: t.a / 100 };
}
