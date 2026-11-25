// Estimation dashboard - the calculation engine (pure: no React, no Supabase). ONE implementation: the dashboard, the exports and the tests all use it, SQL does not repeat it.
//   position:   k = qty x coef ; labour / machines / materials / other = k x unit cost ; operators are INSIDE machines (they only enter the payroll)
//               direct = labour + machines + materials + other ; payroll = labour + operators ; overheads = payroll x norm % ; profit = payroll x norm %
//               base = direct + overheads + profit + equipment ; current = base x index        (equipment carries no overheads / profit)
//   rounding:   every line result to 2 decimals (kopecks), the totals are sums of rounded lines; object / summary estimates are shown in THOUSANDS with 2 decimals
//   summary:    chapters 1 - 12, totals after 1-7, 1-8, 1-9, 1-12, then the contingency (a % of 1-12) and the VAT (a % of 1-12 + contingency)
import type { EstimationCoefficient, EstimationDocumentJSON, EstimationLineJSON, EstimationObjectKind, EstimationSums } from './estimationModel';

export const round2 = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100 + (n < 0 ? -1e-9 : 1e-9)) / 100;
export const toThousands = (n: number): number => round2(n / 1000);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

// ---- coefficients -----------------------------------------------------------------------------------------------------------------------------------------------------------
/** the result of several coefficients: ONE additive rule (each coefficient above / below 1 adds its difference to 1) with 7 decimals, as the Methodology does for coefficients of one group */
export function combineCoefficients(list: readonly EstimationCoefficient[] | undefined | null, mode: 'additive' | 'multiplicative' = 'additive'): number {
  const values = (list ?? []).map((c) => num(c?.value, 1)).filter((v) => v > 0);
  if (!values.length) return 1;
  const r = mode === 'multiplicative' ? values.reduce((a, v) => a * v, 1) : 1 + values.reduce((a, v) => a + (v - 1), 0);
  return Math.round(r * 1e7) / 1e7;
}

// ---- one position ------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface PositionInput {
  qty: number;
  coef: number;
  unitLabour: number;
  unitMachines: number;
  unitOperators: number;
  unitMaterials: number;
  unitOther: number;
  unitEquipment: number;
  overheadPct: number;
  profitPct: number;
  index: number;
}

export interface CostBreakdown {
  labour: number;
  machines: number;
  operators: number;
  materials: number;
  other: number;
  equipment: number;
  direct: number;
  payroll: number;
  overheads: number;
  profit: number;
  base: number;
  current: number;
}

export const EMPTY_COST: CostBreakdown = { labour: 0, machines: 0, operators: 0, materials: 0, other: 0, equipment: 0, direct: 0, payroll: 0, overheads: 0, profit: 0, base: 0, current: 0 };
const COST_KEYS = Object.keys(EMPTY_COST) as (keyof CostBreakdown)[];

export function positionCost(p: PositionInput): CostBreakdown {
  const k = p.qty * p.coef;
  const labour = round2(k * p.unitLabour);
  const machines = round2(k * p.unitMachines);
  const operators = round2(k * p.unitOperators);
  const materials = round2(k * p.unitMaterials);
  const other = round2(k * p.unitOther);
  const equipment = round2(k * p.unitEquipment);
  const direct = round2(labour + machines + materials + other);
  const payroll = round2(labour + operators);
  const overheads = round2((payroll * p.overheadPct) / 100);
  const profit = round2((payroll * p.profitPct) / 100);
  const base = round2(direct + overheads + profit + equipment);
  const current = round2(base * p.index);
  return { labour, machines, operators, materials, other, equipment, direct, payroll, overheads, profit, base, current };
}

export const addCost = (a: CostBreakdown, b: CostBreakdown): CostBreakdown => {
  const r = { ...EMPTY_COST };
  for (const k of COST_KEYS) r[k] = round2(a[k] + b[k]);
  return r;
};

/** the input of a position from its line + the defaults of the document (a line may override the norms and the index) */
export function positionInputOf(line: Partial<EstimationLineJSON>, doc?: Partial<EstimationDocumentJSON> | null): PositionInput {
  return {
    qty: num(line.qty, 0),
    coef: combineCoefficients([...(line.coefficients ?? []), ...(num(line.coefficient, 1) !== 1 && num(line.coefficient, 1) > 0 ? [{ value: num(line.coefficient, 1) }] : [])]),
    unitLabour: num(line.unitLabour),
    unitMachines: num(line.unitMachines),
    unitOperators: num(line.unitOperators),
    unitMaterials: num(line.unitMaterials),
    unitOther: num(line.unitOther),
    unitEquipment: num(line.unitEquipment),
    overheadPct: line.overheadPct == null ? num(doc?.overheadPct) : num(line.overheadPct),
    profitPct: line.profitPct == null ? num(doc?.profitPct) : num(line.profitPct),
    index: line.index == null ? num(doc?.index, 1) : num(line.index, 1),
  };
}

// ---- the three currencies ----------------------------------------------------------------------------------------------------------------------------------------------------------
export interface CurrencyRates { budget: number; accounting: number; consolidation: number }
export const SAME_CURRENCY: CurrencyRates = { budget: 1, accounting: 1, consolidation: 1 };

/** an amount of the document currency in the budget, accounting and consolidation currency of the project: ALL THREE are stored (nothing is recalculated when the user switches the view) */
export function inThreeCurrencies(amount: number, rates: Partial<CurrencyRates> | null | undefined): EstimationSums {
  const r = { ...SAME_CURRENCY, ...(rates ?? {}) };
  return { sumForBudget: round2(amount * num(r.budget, 1)), sumForAccounting: round2(amount * num(r.accounting, 1)), sumForConsolidation: round2(amount * num(r.consolidation, 1)) };
}

// ---- a document: the tree of lines and its roll-up -----------------------------------------------------------------------------------------------------------------------
export interface CalcLine {
  rowGUID: string;
  rowParentGUID: string;
  orderInList?: number;
  rowJSON: Partial<EstimationLineJSON>;
}

export interface DocumentCalc {
  /** per line: positions = their own cost, sections = the sum of everything below them */
  byLine: Record<string, CostBreakdown>;
  /** the sum of the top-level lines */
  total: CostBreakdown;
  /** the total of the current prices in the three currencies */
  sums: EstimationSums;
  /** the lines in tree order with their depth (what a table shows) */
  order: { rowGUID: string; depth: number }[];
  /** lines whose parent does not exist (kept at the top, so nothing disappears) */
  orphans: string[];
}

export function calcDocument(lines: readonly CalcLine[], doc?: Partial<EstimationDocumentJSON> | null): DocumentCalc {
  const byGUID = new Map(lines.map((l) => [l.rowGUID, l]));
  const children = new Map<string, CalcLine[]>();
  const orphans: string[] = [];
  for (const l of lines) {
    const p = l.rowParentGUID && l.rowParentGUID !== 'empty' ? l.rowParentGUID : 'empty';
    const key = p === 'empty' || byGUID.has(p) ? p : 'empty';
    if (key === 'empty' && p !== 'empty') orphans.push(l.rowGUID);
    if (!children.has(key)) children.set(key, []);
    children.get(key)!.push(l);
  }
  for (const list of children.values()) list.sort((a, b) => (a.orderInList ?? 0) - (b.orderInList ?? 0));
  const byLine: Record<string, CostBreakdown> = {};
  const order: { rowGUID: string; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (l: CalcLine, depth: number): CostBreakdown => {
    if (seen.has(l.rowGUID)) return EMPTY_COST; // a cycle cannot loop
    seen.add(l.rowGUID);
    order.push({ rowGUID: l.rowGUID, depth });
    let cost = EMPTY_COST;
    if (l.rowJSON.lineKind === 'position') cost = positionCost(positionInputOf(l.rowJSON, doc));
    for (const c of children.get(l.rowGUID) ?? []) cost = addCost(cost, visit(c, depth + 1));
    byLine[l.rowGUID] = cost;
    return cost;
  };
  let total = EMPTY_COST;
  for (const top of children.get('empty') ?? []) total = addCost(total, visit(top, 0));
  return { byLine, total, sums: inThreeCurrencies(total.current, doc?.rates), order, orphans };
}

/** what to store in a position / section row after a calculation: its current-price total in the three currencies */
export const sumsOfLine = (cost: CostBreakdown, rates: Partial<CurrencyRates> | null | undefined): EstimationSums => inThreeCurrencies(cost.current, rates);

// ---- the quick quote layout: cost -> price with a mark-up ---------------------------------------------------------------------------------------------------------------
export interface QuoteLine { qty: number; unitCost: number; markupPct: number }
export function quoteTotals(lines: readonly QuoteLine[]): { cost: number; profit: number; price: number; marginPct: number } {
  let cost = 0;
  let price = 0;
  for (const l of lines) {
    const c = round2(l.qty * l.unitCost);
    cost += c;
    price += round2(c * (1 + l.markupPct / 100));
  }
  cost = round2(cost);
  price = round2(price);
  return { cost, profit: round2(price - cost), price, marginPct: price ? Math.round(((price - cost) / price) * 1000) / 10 : 0 };
}

// ---- the summary estimate -------------------------------------------------------------------------------------------------------------------------------------------------------
export interface ChapterRow {
  chapter: number;
  title: string;
  construction: number;
  installation: number;
  equipment: number;
  other: number;
}

export const SUMMARY_CHAPTERS: { chapter: number; title: string }[] = [
  { chapter: 1, title: 'Preparation of the construction site' },
  { chapter: 2, title: 'Main construction objects' },
  { chapter: 3, title: 'Auxiliary and service objects' },
  { chapter: 4, title: 'Energy facilities' },
  { chapter: 5, title: 'Transport facilities and communications' },
  { chapter: 6, title: 'External networks and structures: water supply, sewerage, heating, gas' },
  { chapter: 7, title: 'Landscaping and site improvement' },
  { chapter: 8, title: 'Temporary buildings and structures' },
  { chapter: 9, title: 'Other works and costs' },
  { chapter: 10, title: "Client's supervision and technical oversight" },
  { chapter: 11, title: 'Training of operating staff' },
  { chapter: 12, title: 'Design, surveys, expert review, author supervision' },
];

export interface SummaryColumns { construction: number; installation: number; equipment: number; other: number; total: number }
const sumCols = (rows: readonly ChapterRow[]): SummaryColumns => {
  const c = { construction: 0, installation: 0, equipment: 0, other: 0 };
  for (const r of rows) { c.construction += r.construction; c.installation += r.installation; c.equipment += r.equipment; c.other += r.other; }
  return { ...c, total: c.construction + c.installation + c.equipment + c.other };
};
const thousand = (c: SummaryColumns): SummaryColumns => ({ construction: toThousands(c.construction), installation: toThousands(c.installation), equipment: toThousands(c.equipment), other: toThousands(c.other), total: toThousands(c.total) });

export interface SummaryEstimate {
  chapters: { chapter: number; title: string; cols: SummaryColumns }[];
  /** cumulative totals after chapters 1-7, 1-8, 1-9 and 1-12 */
  after: { to7: SummaryColumns; to8: SummaryColumns; to9: SummaryColumns; to12: SummaryColumns };
  contingency: SummaryColumns;
  vat: SummaryColumns;
  grand: SummaryColumns;
  warnings: string[];
}

/** the cap of the contingency by the kind of the object: <= 2 % non-production, <= 3 % production and linear, <= 10 % unique, hazardous and technically complex objects */
export const contingencyCap = (kind: EstimationObjectKind | undefined): number => (kind === 'unique' ? 10 : kind === 'production' || kind === 'linear' ? 3 : 2);

/** the amounts of `rows` are in the document currency (units); the result is in THOUSANDS with 2 decimals */
export function summaryEstimate(rows: readonly ChapterRow[], opts: { contingencyPct?: number; vatPct?: number; objectKind?: EstimationObjectKind } = {}): SummaryEstimate {
  const chapters = SUMMARY_CHAPTERS.map(({ chapter, title }) => ({ chapter, title, cols: sumCols(rows.filter((r) => r.chapter === chapter)) }));
  const upTo = (n: number) => sumCols(rows.filter((r) => r.chapter <= n));
  const to12 = upTo(12);
  const pct = (cols: SummaryColumns, p: number): SummaryColumns => {
    const c = { construction: (cols.construction * p) / 100, installation: (cols.installation * p) / 100, equipment: (cols.equipment * p) / 100, other: (cols.other * p) / 100 };
    return { ...c, total: c.construction + c.installation + c.equipment + c.other };
  };
  const contingency = pct(to12, num(opts.contingencyPct));
  const base = { construction: to12.construction + contingency.construction, installation: to12.installation + contingency.installation, equipment: to12.equipment + contingency.equipment, other: to12.other + contingency.other, total: to12.total + contingency.total };
  const vat = pct(base, num(opts.vatPct));
  const grand: SummaryColumns = { construction: base.construction + vat.construction, installation: base.installation + vat.installation, equipment: base.equipment + vat.equipment, other: base.other + vat.other, total: base.total + vat.total };
  const warnings: string[] = [];
  const cap = contingencyCap(opts.objectKind);
  if (num(opts.contingencyPct) > cap) warnings.push(`The contingency of ${num(opts.contingencyPct)} % is above the usual cap of ${cap} % for this kind of object.`);
  return {
    chapters: chapters.map((c) => ({ ...c, cols: thousand(c.cols) })),
    after: { to7: thousand(upTo(7)), to8: thousand(upTo(8)), to9: thousand(upTo(9)), to12: thousand(to12) },
    contingency: thousand(contingency),
    vat: thousand(vat),
    grand: thousand(grand),
    warnings,
  };
}

// ---- the ciphers of the documents (summary SSRSS, object OS-xx-xx, local LS-xx-xx-xx, separate SR-n) ------------------------------------------------------------------
const pad2 = (n: number): string => String(Math.max(0, Math.floor(n))).padStart(2, '0');
export const cipherLocal = (objectNo: number, lineNo: number, localNo: number): string => `LS-${pad2(objectNo)}-${pad2(lineNo)}-${pad2(localNo)}`;
export const cipherObject = (chapter: number, lineNo: number): string => `OS-${pad2(chapter)}-${pad2(lineNo)}`;
export const cipherSeparate = (n: number): string => `SR-${Math.max(1, Math.floor(n))}`;
export const cipherSummary = (stage?: number): string => (stage ? `SSRSS-${pad2(stage)}` : 'SSRSS-01');
