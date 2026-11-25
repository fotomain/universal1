// Project estimation - the pure part (no React, no Supabase). documentation/ESTIMATION/PROJECT_ESTIMATION.html
//   The ESTIMATION of a project (project1) is another, ordinary project (project2): project_table.rowJSON.projectEstimationGUID names it.
//   Project settings -> Estimation shows the sums of the task lines of project2 per budget item (SQL project_estimation_summary) and copies it into project1.
// Here: the key, the summary as the app uses it, the rows / totals of the table, the reasons that disable Fill, the rules of the two modes, the plan of the fill.

import type { PMTaskDependencyRow, PMTaskRow } from '../../../model/types';
import type { PMProjectRow } from '../../../model/types';
import { buildProjectExchangeFile, type PMExchangeTaskLine } from '../../../crud/exchange/project/projectExchangeFormat';
import { planProjectImport } from '../../../crud/exchange/project/import/planProjectImport';

export const ESTIMATION_KEY = 'projectEstimationGUID' as const;
export const ESTIMATION_LAST_FILL_KEY = 'projectEstimationLastFill' as const;

/** the part of the Project settings draft that belongs to this tab */
export interface PMProjectEstimationValues {
  projectEstimationGUID?: string | null;
  /** the Estimation dashboard (kit8/pm/estimation): show the regulation-specific wording (the Methodology, its forms, its country) in the dashboard and in the exported documents. FALSE by default */
  useGOSTInformationInDocuments?: boolean;
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** the estimation named by a project row / draft: a GUID, or null (absent, empty, not a GUID) */
export function estimationLinkOf(json: { projectEstimationGUID?: unknown } | null | undefined): string | null {
  const v = json?.projectEstimationGUID;
  return typeof v === 'string' && GUID_RE.test(v.trim()) ? v.trim().toLowerCase() : null;
}

/** what the Project settings window keeps of this tab (the draft) and writes into rowJSON; null clears the link */
export const estimationValuesOf = (json: { projectEstimationGUID?: unknown; useGOSTInformationInDocuments?: unknown } | null | undefined): PMProjectEstimationValues => ({ projectEstimationGUID: estimationLinkOf(json), useGOSTInformationInDocuments: json?.useGOSTInformationInDocuments === true });

/** a project may name any OTHER project as its estimation (the database refuses itself too); a project that is not saved yet (no GUID) may name any */
export const canBeEstimationOf = (projectGUID: string | null | undefined, candidateGUID: string | null | undefined): boolean =>
  !!candidateGUID && (!projectGUID || candidateGUID.toLowerCase() !== projectGUID.toLowerCase());

// ---- the summary (the answer of project_estimation_summary) -----------------------------------------------------------------------------------------------------------------

export type EstimationKind = 'cost' | 'revenue';

export interface EstimationItemSum {
  /** null = the lines with no budget item */
  budgetItemGUID: string | null;
  kind: EstimationKind;
  lines: number;
  /** net, in the budget currency of the project (the saved snapshot of the lines) */
  sumForBudget: number;
  vatForBudget: number;
  linesWithoutSum: number;
}

export interface EstimationRoot { rowGUID: string; orderInList: number }

export interface EstimationProjectSummary {
  projectGUID: string;
  name: string;
  currencyForBudget: string;
  currencyForAccounting: string;
  tasks: number;
  links: number;
  lines: number;
  linesWithoutItem: number;
  linesWithoutSum: number;
  items: EstimationItemSum[];
  // the target only
  postedTasks: number;
  documents: number;
  readonly: boolean;
  canCreate: boolean;
  roots: EstimationRoot[];
}

export interface EstimationSummary {
  source: EstimationProjectSummary;
  /** null = the project is not saved yet */
  target: EstimationProjectSummary | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

function parseProject(raw: any): EstimationProjectSummary {
  return {
    projectGUID: text(raw?.projectGUID),
    name: text(raw?.name),
    currencyForBudget: text(raw?.currencyForBudget).toUpperCase(),
    currencyForAccounting: text(raw?.currencyForAccounting).toUpperCase(),
    tasks: num(raw?.tasks),
    links: num(raw?.links),
    lines: num(raw?.lines),
    linesWithoutItem: num(raw?.linesWithoutItem),
    linesWithoutSum: num(raw?.linesWithoutSum),
    items: (Array.isArray(raw?.items) ? raw.items : []).map((i: any): EstimationItemSum => ({
      budgetItemGUID: typeof i?.budgetItemGUID === 'string' && i.budgetItemGUID ? i.budgetItemGUID : null,
      kind: i?.kind === 'revenue' ? 'revenue' : 'cost',
      lines: num(i?.lines),
      sumForBudget: num(i?.sumForBudget),
      vatForBudget: num(i?.vatForBudget),
      linesWithoutSum: num(i?.linesWithoutSum),
    })),
    postedTasks: num(raw?.postedTasks),
    documents: num(raw?.documents),
    readonly: raw?.readonly === true,
    canCreate: raw?.canCreate === true,
    roots: (Array.isArray(raw?.roots) ? raw.roots : []).map((r: any): EstimationRoot => ({ rowGUID: text(r?.rowGUID), orderInList: num(r?.orderInList) })).filter((r: EstimationRoot) => !!r.rowGUID),
  };
}

/** the jsonb of project_estimation_summary -> the app's shape (numbers arrive as numbers or strings) */
export function parseEstimationSummary(raw: any): EstimationSummary {
  return { source: parseProject(raw?.source), target: raw?.target ? parseProject(raw.target) : null };
}

// ---- the rows of the table ---------------------------------------------------------------------------------------------------------------------------------------------------

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** the currency of two projects differs when the budget OR the accounting currency does (a missing one equals a missing one) */
export function currenciesDiffer(a: Pick<EstimationProjectSummary, 'currencyForBudget' | 'currencyForAccounting'>, b: Pick<EstimationProjectSummary, 'currencyForBudget' | 'currencyForAccounting'>): boolean {
  return a.currencyForBudget !== b.currencyForBudget || a.currencyForAccounting !== b.currencyForAccounting;
}

/** the budget currency of the estimation and of the project differ (a project with no budget currency has no budget sums: nothing to convert) */
export const estimationCurrencyDiffers = (sourceCurrency: string | null | undefined, targetCurrency: string | null | undefined): boolean =>
  !!sourceCurrency && !!targetCurrency && sourceCurrency.toUpperCase() !== targetCurrency.toUpperCase();

/** the id of the row of a budget item in the table */
export const NO_BUDGET_ITEM_ROW = 'estimation-no-budget-item';
export const estimationRowId = (kind: EstimationKind, budgetItemGUID: string | null): string => `${kind}:${budgetItemGUID ?? NO_BUDGET_ITEM_ROW}`;

export interface EstimationTableRow {
  rowGUID: string;
  budgetItemGUID: string | null;
  kind: EstimationKind;
  /** task lines of the estimation on this item */
  lines: number;
  /** net, in the budget currency of the ESTIMATION project */
  estimate: number;
  vat: number;
  /** the estimate in the budget currency of the project that is filled (null = the same currency, or no rate) */
  converted: number | null;
  /** the sum of the project that is filled now (its own lines), in ITS budget currency; null = no project yet */
  projectNow: number | null;
  /** (converted or estimate) - projectNow; null when it cannot be told (a missing rate / no project) */
  difference: number | null;
  linesWithoutSum: number;
}

/**
 * One row per (kind, budget item) over BOTH projects: an item that only the project has still shows (estimate 0), so "Estimate - now" is complete.
 * rate = the units of the target budget currency for 1 unit of the source budget currency (null = no rate; ignored while the currencies are the same).
 * targetCurrency = the budget currency of a project that is not saved yet (a saved project's own is in summary.target).
 */
export function estimationRows(summary: EstimationSummary, rate: number | null, targetCurrency?: string | null): EstimationTableRow[] {
  const { source, target } = summary;
  const differ = estimationCurrencyDiffers(source.currencyForBudget, target?.currencyForBudget ?? targetCurrency);
  const out = new Map<string, EstimationTableRow>();
  const rowOf = (i: EstimationItemSum): EstimationTableRow => {
    const id = estimationRowId(i.kind, i.budgetItemGUID);
    let r = out.get(id);
    if (!r) {
      r = { rowGUID: id, budgetItemGUID: i.budgetItemGUID, kind: i.kind, lines: 0, estimate: 0, vat: 0, converted: null, projectNow: target ? 0 : null, difference: null, linesWithoutSum: 0 };
      out.set(id, r);
    }
    return r;
  };
  for (const i of source.items) {
    const r = rowOf(i);
    r.lines += i.lines;
    r.estimate = round2(r.estimate + i.sumForBudget);
    r.vat = round2(r.vat + i.vatForBudget);
    r.linesWithoutSum += i.linesWithoutSum;
  }
  if (target) for (const i of target.items) {
    const r = rowOf(i);
    r.projectNow = round2((r.projectNow ?? 0) + i.sumForBudget);
  }
  for (const r of out.values()) {
    r.converted = differ && rate != null ? round2(r.estimate * rate) : null;
    const base = differ ? r.converted : r.estimate;
    r.difference = target && base != null && r.projectNow != null ? round2(base - r.projectNow) : null;
  }
  // cost first (revenue after it), then by the order the database gave; the line with no budget item last of its kind
  const kindRank = (k: EstimationKind) => (k === 'cost' ? 0 : 1);
  return [...out.values()].sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || Number(a.budgetItemGUID === null) - Number(b.budgetItemGUID === null));
}

export interface EstimationTotals {
  cost: number;
  revenue: number;
  profit: number;
  /** ROI1 = profit / cost; null when there is no cost */
  roi: number | null;
}

/** cost, revenue, profit and ROI1 of a list of (kind, sum): the formula of the ROI reports (docs ROI_DOC.html) */
export function estimationTotals(items: readonly { kind: EstimationKind; value: number }[]): EstimationTotals {
  const cost = round2(items.filter((i) => i.kind === 'cost').reduce((s, i) => s + i.value, 0));
  const revenue = round2(items.filter((i) => i.kind === 'revenue').reduce((s, i) => s + i.value, 0));
  const profit = round2(revenue - cost);
  return { cost, revenue, profit, roi: cost > 0 ? Math.round((profit / cost) * 10000) / 10000 : null };
}

/** the three totals of the footer: the estimate (project2 currency), the estimate in the currency of project1 (when it differs), the project now */
export function estimationFooter(rows: readonly EstimationTableRow[]): { estimate: EstimationTotals; converted: EstimationTotals | null; now: EstimationTotals | null } {
  const hasConverted = rows.some((r) => r.converted != null);
  const hasNow = rows.some((r) => r.projectNow != null);
  return {
    estimate: estimationTotals(rows.map((r) => ({ kind: r.kind, value: r.estimate }))),
    converted: hasConverted ? estimationTotals(rows.map((r) => ({ kind: r.kind, value: r.converted ?? 0 }))) : null,
    now: hasNow ? estimationTotals(rows.map((r) => ({ kind: r.kind, value: r.projectNow ?? 0 }))) : null,
  };
}

// ---- Fill: when it is possible, the two modes --------------------------------------------------------------------------------------------------------------------------------

export type FillBlockReason =
  | 'noEstimation'
  | 'loading'
  | 'estimationMissing'
  | 'estimationEmpty'
  | 'projectNotSaved'
  | 'unsavedSettings'
  | 'projectReadonly'
  | 'noRight';

export interface FillBlockInput {
  /** the estimation the (saved) project names */
  savedEstimationGUID: string | null;
  /** the estimation in the window now (the draft) */
  draftEstimationGUID: string | null;
  projectSaved: boolean;
  loading: boolean;
  /** the summary could not be read (the estimation is not found / not readable) */
  summary: EstimationSummary | null;
}

/** why Fill is disabled (null = it can be pressed). The order is the order the user can fix things. */
export function fillBlockReason(i: FillBlockInput): FillBlockReason | null {
  if (!i.draftEstimationGUID) return 'noEstimation';
  if (!i.projectSaved) return 'projectNotSaved';
  if (i.savedEstimationGUID !== i.draftEstimationGUID) return 'unsavedSettings';
  if (i.loading) return 'loading';
  if (!i.summary) return 'estimationMissing';
  if (i.summary.source.tasks === 0) return 'estimationEmpty';
  const t = i.summary.target;
  if (t?.readonly) return 'projectReadonly';
  if (t && !t.canCreate) return 'noRight';
  return null;
}

export type FillMode = 'empty' | 'append' | 'replace';

/** the user is asked Append or Replace only while the project has rows of its own */
export const fillNeedsModeQuestion = (target: Pick<EstimationProjectSummary, 'tasks'> | null): boolean => !!target && target.tasks > 0;

/** Replace deletes the old rows: not while something of the project is posted or a document exists. null = it may be chosen */
export function replaceBlockedReason(target: Pick<EstimationProjectSummary, 'postedTasks' | 'documents'> | null): 'posted' | 'documents' | null {
  if (!target) return null;
  if (target.postedTasks > 0) return 'posted';
  if (target.documents > 0) return 'documents';
  return null;
}

/** after the fill the sums of the lines are in the wrong currency while the budget / accounting currency of the two projects differs: Recalculate is offered */
export const fillNeedsRecalculation = (source: EstimationProjectSummary, target: EstimationProjectSummary | null): boolean => !!target && currenciesDiffer(source, target);

// ---- the plan of the fill (pure: the rows to write) ---------------------------------------------------------------------------------------------------------------------------

/** the keys of a task line that hold sums in the currencies of the PROJECT the line was made in: a fill into a project with other currencies drops them */
export const LINE_PROJECT_CURRENCY_KEYS = ['sumForAccounting', 'sumVATForAccounting', 'sumForBudget', 'sumVATForBudget', 'fxSnapshotTaskLine'] as const;

export function lineWithoutProjectCurrencySums(rowJSON: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...rowJSON };
  for (const k of LINE_PROJECT_CURRENCY_KEYS) if (k in out) out[k] = null;
  return out;
}

/** the task of the copy is no subproject origin (the link rows belong to project2), as in Copy with Tasks */
const withoutSubprojectMark = (t: PMTaskRow): PMTaskRow => {
  const { taskIsSubproject: _a, taskSubprojectGUID: _b, ...rest } = (t.rowJSON || {}) as any;
  return { ...t, rowJSON: rest };
};

export interface EstimationFillPlan {
  /** parents before children */
  tasks: PMTaskRow[];
  dependencies: PMTaskDependencyRow[];
  taskLines: PMExchangeTaskLine[];
  /** the new top-level rows (what a rollback deletes) */
  newRoots: string[];
  idMap: Record<string, string>;
}

/**
 * The rows that put the estimation (source tasks / links / lines) into the target project: new ids, tree paths under the target (planProjectImport = the planner of Copy with Tasks),
 * the new top-level rows behind the ones the target has (so "Append" keeps the user's order and a rollback is "delete these roots"), the lines UNPOSTED, and - when the currencies
 * of the two projects differ - without the sums that are in the currencies of the estimation project.
 * The project settings of the estimation are NOT used: the target keeps its own (the plan's projectRowJSON is never written).
 */
export function planEstimationFill(args: {
  source: PMProjectRow;
  tasks: PMTaskRow[];
  dependencies: PMTaskDependencyRow[];
  taskLines: PMExchangeTaskLine[];
  target: PMProjectRow;
  ownerGUID: string;
  existingRoots: readonly EstimationRoot[];
  dropCurrencySums: boolean;
  newGUID: () => string;
}): EstimationFillPlan {
  const file = buildProjectExchangeFile(args.source, args.tasks, args.dependencies, undefined, new Date(0), args.taskLines);
  const plan = planProjectImport(file, args.target, args.ownerGUID, args.newGUID);
  const offset = args.existingRoots.reduce((m, r) => Math.max(m, r.orderInList), 0);
  const newRoots: string[] = [];
  const tasks = plan.tasks.map((t) => {
    const clean = withoutSubprojectMark(t);
    if (clean.treePath.split('.').length !== 2) return clean;
    newRoots.push(clean.rowGUID);
    return offset > 0 ? { ...clean, orderInList: offset + 1 + (Number(clean.orderInList) || 0) } : clean;
  });
  const taskLines = args.dropCurrencySums ? plan.taskLines.map((l) => ({ ...l, rowJSON: lineWithoutProjectCurrencySums(l.rowJSON) })) : plan.taskLines;
  return { tasks, dependencies: plan.dependencies, taskLines, newRoots, idMap: plan.idMap };
}
