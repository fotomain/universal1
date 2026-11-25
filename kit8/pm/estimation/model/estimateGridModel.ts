// Estimation dashboard - the model of the ESTIMATE GRID (pure: no React, no Skia). The grid stands right of the task tree like the Gantt chart: ONE grid row per tree row, on the SAME scroll
// (`grid/EstimateGridPane`). What a row shows:
//   a TASK (a leaf task = the row that may carry an estimate, `canCarryEstimate`) = its ONE position: description, norm, unit, quantity, unit costs ... typed in place, the calculated money
//   a STAGE / summary task (anything else)                                    = the SUMS of every task below it (read only, bold), as the stage rows of an estimate book
//   a task with several positions (an older / imported document)              = the sum of its positions, read only, marked with the number of positions
// The COLUMNS are the ones of the layout the user picked (simple / advanced / quote / trades) minus the columns the user hid in the document; every column title stands in ONE header row, as the
// titles of the tree columns. Every calculation is `estimationCalc` (one implementation).
import { addCost, EMPTY_COST, inThreeCurrencies, round2, type CostBreakdown } from './estimationCalc';
import { newLineRow, subtreeGUIDs, type LineRow } from './estimationDocumentModel';
import type { EstimationDocumentJSON, EstimationSumKey, EstimationSums } from './estimationModel';
import type { EstimationLayout } from './estimationLayouts';

export type GridColumnKind = 'text' | 'norm' | 'number' | 'calc' | 'sum' | 'catalog' | 'select' | 'price' | 'perArea' | 'share';
export interface GridColumn {
  key: string;
  title: string;
  width: number;
  kind: GridColumnKind;
  align: 'left' | 'right' | 'center';
  /** the key of the line json an input column writes (default: key) */
  field?: string;
  min?: number;
  max?: number;
  /** a catalog column: the redux entity of the catalog */
  entity?: string;
  /** a select column: the values */
  options?: string[];
  /** a calc column: what it shows of the cost breakdown */
  pick?: (c: CostBreakdown) => number;
  /** a sum column: which currency (absent = the one the user switched to) */
  sumKey?: EstimationSumKey;
  bold?: boolean;
  /** left edge in content coordinates (set by `gridColumns`) */
  x: number;
}

export interface GridColumnsContext {
  /** `pmT` (a title is translated here, the model stays pure) */
  t?: (text: string, params?: Record<string, string | number>) => string;
  /** the currency code of the view, written in the title of the "shown currency" column */
  currency?: string;
  /** the columns the user hid in the document (`rowJSON.hiddenColumns`); the description never hides */
  hidden?: ReadonlySet<string>;
}

const COST_PICK: Record<string, (c: CostBreakdown) => number> = {
  direct: (c) => c.direct, current: (c) => c.current, base: (c) => c.base, payroll: (c) => c.payroll, overheads: (c) => c.overheads, profit: (c) => c.profit,
  'c-labour': (c) => c.labour, 'c-machines': (c) => c.machines, 'c-operators': (c) => c.operators, 'c-materials': (c) => c.materials, 'c-other': (c) => c.other, 'c-equipment': (c) => c.equipment,
};

type Def = Omit<GridColumn, 'x' | 'title' | 'align'> & { title: string; align?: GridColumn['align'] };
const text = (key: string, title: string, width: number, extra: Partial<Def> = {}): Def => ({ key, title, width, kind: 'text', ...extra });
const number = (key: string, title: string, width: number, extra: Partial<Def> = {}): Def => ({ key, title, width, kind: 'number', align: 'right', min: 0, max: 1e12, ...extra });
const calc = (key: string, title: string, width: number, bold = false): Def => ({ key, title, width, kind: 'calc', align: 'right', pick: COST_PICK[key.replace(/^cost$/, 'direct')] ?? COST_PICK.direct, bold });

/** the columns of a layout (before hiding), in order */
function layoutDefs(layout: EstimationLayout, currencyTitle: string): Def[] {
  const title = text('title', 'Description', 320);
  const norm: Def = { key: 'normCode', title: 'Norm / justification', width: 200, kind: 'norm', align: 'center' };
  const unit = text('unit', 'Unit', 90);
  const qty = number('qty', 'Quantity', 110);
  const coef = number('coefficient', 'Coef.', 90, { min: 0.0001, max: 1000 });
  const uL = number('unitLabour', 'Labour / unit', 120);
  const uM = number('unitMachines', 'Machines / unit', 130);
  const uO = number('unitOperators', 'of which operators', 130);
  const uMat = number('unitMaterials', 'Materials / unit', 130);
  if (layout === 'simple') {
    return [title, norm, unit, qty, coef, uL, uM, uO, uMat, calc('direct', 'Direct costs', 130), calc('current', 'Total, current prices', 150, true), { key: 'sumShown', title: currencyTitle, width: 150, kind: 'sum', align: 'right', bold: true }];
  }
  if (layout === 'advanced') {
    return [
      title, norm, unit, qty, coef, uL, uM, uO, uMat, number('unitOther', 'Other / unit', 110), number('unitEquipment', 'Equipment / unit', 130),
      number('overheadPct', 'Overheads, %', 110, { max: 1000 }), number('profitPct', 'Profit, %', 100, { max: 1000 }), number('index', 'Index', 90, { max: 1e6 }),
      { key: 'budgetItemGUID', title: 'Budget item', width: 200, kind: 'catalog', align: 'left', entity: 'budgetItemReusable' },
      { key: 'businessUnitGUID', title: 'Business unit', width: 180, kind: 'catalog', align: 'left', entity: 'businessUnitReusable' },
      text('takeoffRef', 'Takeoff ref.', 110),
      calc('c-labour', 'Labour', 110), calc('c-machines', 'Machines', 110), calc('c-operators', 'Operators', 100), calc('c-materials', 'Materials', 120), calc('c-other', 'Other', 90), calc('c-equipment', 'Equipment', 110),
      calc('direct', 'Direct costs', 130), calc('payroll', 'Payroll', 110), calc('overheads', 'Overheads', 110), calc('profit', 'Profit', 100), calc('base', 'Total, base prices', 140), calc('current', 'Total, current prices', 150, true),
      { key: 'sumForBudget', title: 'Budget currency', width: 130, kind: 'sum', align: 'right', sumKey: 'sumForBudget' },
      { key: 'sumForAccounting', title: 'Accounting currency', width: 140, kind: 'sum', align: 'right', sumKey: 'sumForAccounting' },
      { key: 'sumForConsolidation', title: 'Consolidation currency', width: 150, kind: 'sum', align: 'right', sumKey: 'sumForConsolidation' },
    ];
  }
  if (layout === 'quote') {
    return [
      text('category', 'Category', 190), title, unit, qty, number('unitOther', 'Cost per unit', 120), calc('cost', 'Cost', 120), number('markupPct', 'Mark-up, %', 100, { max: 1000 }),
      { key: 'price', title: 'Price', width: 130, kind: 'price', align: 'right', bold: true },
      { key: 'status', title: 'Status', width: 120, kind: 'select', align: 'left', options: ['Open', 'Complete'] },
    ];
  }
  return [
    { ...title, title: 'Trade / description', width: 260 }, number('unitLabour', 'Labour', 120), number('unitMaterials', 'Materials', 120), calc('current', 'Total, current prices', 150, true),
    { key: 'perArea', title: 'Per m2', width: 110, kind: 'perArea', align: 'right' }, { key: 'share', title: 'Share', width: 150, kind: 'share', align: 'left' },
  ];
}

/** the columns of the grid for the layout and the document: hidden ones removed, `x` set; `contentWidth` = where the last one ends */
export function gridColumns(layout: EstimationLayout, ctx: GridColumnsContext = {}): { columns: GridColumn[]; contentWidth: number } {
  const t = ctx.t ?? ((s: string) => s);
  const currencyTitle = `${t('In the view currency')} ${ctx.currency ?? ''}`.trim();
  let x = 0;
  const columns: GridColumn[] = [];
  for (const d of layoutDefs(layout, currencyTitle)) {
    if (ctx.hidden?.has(d.key) && d.key !== 'title') continue;
    columns.push({ ...d, title: d.key === 'sumShown' ? d.title : t(d.title), align: d.align ?? 'left', x });
    x += d.width;
  }
  return { columns, contentWidth: x };
}

// ---- the rows: one per tree row --------------------------------------------------------------------------------------------------------------------------------------------------
export interface GridRow {
  /** the task (tree row) */
  guid: string;
  /** 'task' = a leaf task that may carry a position; 'summary' = the sums of the tasks below */
  kind: 'task' | 'summary';
  /** the ONE position of a task (null: none yet, or the row is a summary, or the task has several) */
  line: LineRow | null;
  /** positions of the row itself and of everything below it */
  positions: number;
  /** a task with more than one position: shown as their sum, read only */
  multi: boolean;
  cost: CostBreakdown;
  sums: EstimationSums;
  /** the sum of the prices of the quote layout (cost x (1 + mark-up)) */
  price: number;
  /** the unit of everything in the row when it is ONE unit (a stage whose tasks all count in m3); null = different units or a position without a unit; undefined = no position */
  unit: string | null | undefined;
  /** the sum of the quantities of the positions in the row (meaningful when `unit` is a unit) */
  qty: number;
}

export interface GridRowsInput {
  /** the rows of the tree in the order it shows them (the PM store's `visibleRows`) */
  visible: readonly string[];
  childrenById: Record<string, readonly string[] | undefined>;
  /** `rowKind` of a task row */
  kindOf: (guid: string) => string | undefined;
  lines: readonly LineRow[];
  /** `calcDocument().byLine` */
  byLine: Record<string, CostBreakdown>;
  doc?: Partial<EstimationDocumentJSON> | null;
}

/** the positions of every task, in the order of the document */
export function positionsByTask(lines: readonly LineRow[]): Map<string, LineRow[]> {
  const out = new Map<string, LineRow[]>();
  for (const l of lines) {
    const g = l.rowJSON.taskGUID;
    if (!g || l.rowJSON.lineKind !== 'position') continue;
    if (!out.has(g)) out.set(g, []);
    out.get(g)!.push(l);
  }
  for (const list of out.values()) list.sort((a, b) => a.orderInList - b.orderInList);
  return out;
}

/** the ONE position of a task (null when it has none or several) */
export const singlePositionOf = (lines: readonly LineRow[], taskGUID: string): LineRow | null => {
  const own = positionsByTask(lines).get(taskGUID) ?? [];
  return own.length === 1 ? own[0] : null;
};
export const positionCountOf = (lines: readonly LineRow[], taskGUID: string): number => positionsByTask(lines).get(taskGUID)?.length ?? 0;

/** THE RULE of the dashboard: only a task without subtasks carries an estimate (`rowKind` task) */
const carries = (kind: string | undefined, hasChildren: boolean): boolean => kind === 'task' && !hasChildren;

export function buildGridRows(input: GridRowsInput): GridRow[] {
  const own = positionsByTask(input.lines);
  const price = (l: LineRow): number => round2((input.byLine[l.rowGUID]?.direct ?? 0) * (1 + (Number(l.rowJSON.markupPct) || 0) / 100));
  type Total = { cost: CostBreakdown; positions: number; price: number; unit: string | null | undefined; qty: number };
  const memo = new Map<string, Total>();
  const mergeUnit = (a: string | null | undefined, b: string | null | undefined): string | null | undefined => (a === undefined ? b : b === undefined ? a : a === b ? a : null);
  const visiting = new Set<string>();
  const total = (guid: string): Total => {
    const hit = memo.get(guid);
    if (hit) return hit;
    if (visiting.has(guid)) return { cost: EMPTY_COST, positions: 0, price: 0, unit: undefined, qty: 0 };
    visiting.add(guid);
    let cost = EMPTY_COST;
    let positions = 0;
    let sumPrice = 0;
    let unit: string | null | undefined;
    let qty = 0;
    for (const l of own.get(guid) ?? []) {
      cost = addCost(cost, input.byLine[l.rowGUID] ?? EMPTY_COST); positions += 1; sumPrice = round2(sumPrice + price(l));
      unit = mergeUnit(unit, String(l.rowJSON.unit ?? '').trim() || null);
      qty += Number(l.rowJSON.qty) || 0;
    }
    for (const k of input.childrenById[guid] ?? []) { const c = total(k); cost = addCost(cost, c.cost); positions += c.positions; sumPrice = round2(sumPrice + c.price); unit = mergeUnit(unit, c.unit); qty += c.qty; }
    visiting.delete(guid);
    const r: Total = { cost, positions, price: sumPrice, unit, qty: Math.round(qty * 1e4) / 1e4 };
    memo.set(guid, r);
    return r;
  };
  return input.visible.map((guid): GridRow => {
    const hasChildren = (input.childrenById[guid]?.length ?? 0) > 0;
    const t = total(guid);
    const mine = own.get(guid) ?? [];
    const kind = carries(input.kindOf(guid), hasChildren) ? 'task' : 'summary';
    return { guid, kind, line: kind === 'task' && mine.length === 1 ? mine[0] : null, positions: t.positions, multi: kind === 'task' && mine.length > 1, cost: t.cost, sums: inThreeCurrencies(t.cost.current, input.doc?.rates), price: t.price, unit: t.unit, qty: t.qty };
  });
}

// ---- the text of a cell -----------------------------------------------------------------------------------------------------------------------------------------------------------
const group = (n: number, d: number): string => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtMoney = (n: number | undefined | null): string => (typeof n === 'number' && Number.isFinite(n) && n !== 0 ? group(n, 2) : '');
/** an input number: up to 4 decimals (a unit cost has them), no trailing zeros */
export const fmtNumber = (n: unknown): string => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '');

export interface CellContext {
  sumKey: EstimationSumKey;
  /** the area of the object (m2) of the document: the column Per m2 */
  area: number;
  /** the total of the current prices of the whole document: the column Share */
  totalCurrent: number;
  /** the title of a catalog element (a catalog column) */
  nameOf?: (entity: string, guid: string) => string;
  t?: (text: string, params?: Record<string, string | number>) => string;
}

/** the share (0..1) of a row in the whole document (the bar of the trade layout) */
export const shareOf = (row: GridRow, ctx: CellContext): number => (ctx.totalCurrent ? Math.max(0, Math.min(1, row.cost.current / ctx.totalCurrent)) : 0);

export function cellText(col: GridColumn, row: GridRow, ctx: CellContext): string {
  const j = (row.line?.rowJSON ?? null) as Record<string, any> | null;
  const field = col.field ?? col.key;
  // the SUBTOTAL of a stage (or of a task with several positions): when every position below it counts in the same unit, that unit and the sum of the quantities
  if (!row.line && row.positions > 0 && (col.key === 'unit' || col.key === 'qty')) return typeof row.unit === 'string' ? (col.key === 'unit' ? row.unit : fmtNumber(row.qty)) : '';
  switch (col.kind) {
    case 'text':
      if (col.key === 'title' && row.multi) return `${row.positions} ${(ctx.t ?? ((s: string) => s))('positions')}`;
      return j ? String(j[field] ?? '') : '';
    case 'norm':
    case 'select':
      return j ? String(j[field] ?? '') : '';
    case 'number':
      return j ? fmtNumber(j[field]) : '';
    case 'catalog':
      return j && j[field] ? (ctx.nameOf?.(col.entity ?? '', String(j[field])) ?? '') : '';
    case 'calc':
      return fmtMoney(col.pick ? col.pick(row.cost) : 0);
    case 'sum':
      return fmtMoney(row.sums[col.sumKey ?? ctx.sumKey]);
    case 'price':
      return fmtMoney(row.price);
    case 'perArea':
      return ctx.area ? fmtMoney(row.cost.current / ctx.area) : '';
    default:
      return '';
  }
}

// ---- editing ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** a cell the user may type into: a task row (not a stage, not a task with several positions) in an input column */
export const isCellEditable = (col: GridColumn, row: GridRow | undefined, readOnly: boolean): boolean =>
  !readOnly && !!row && row.kind === 'task' && !row.multi && (col.kind === 'text' || col.kind === 'number' || col.kind === 'norm' || col.kind === 'catalog' || col.kind === 'select');

/** the text the editor starts with */
export function editSeed(col: GridColumn, row: GridRow | undefined): string {
  const v = (row?.line?.rowJSON as Record<string, any> | undefined)?.[col.field ?? col.key];
  return v == null ? '' : String(v);
}

export type ParsedInput = { ok: true; value: number | string | undefined } | { ok: false };
/** the typed text of a cell -> the value to store (empty = the value is removed); a number accepts a comma and spaces and is refused outside the column's range */
export function parseGridInput(col: GridColumn, raw: string): ParsedInput {
  const s = raw.trim();
  if (col.kind !== 'number') return { ok: true, value: s === '' ? undefined : s };
  if (s === '') return { ok: true, value: undefined };
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return { ok: false };
  if (col.min != null && n < col.min) return { ok: false };
  if (col.max != null && n > col.max) return { ok: false };
  return { ok: true, value: n };
}

export interface GridEditContext { projectGUID: string; documentGUID: string }

/** write a value into the position of a task; a task that has none gets one (the quantity 1, the task given). A value of `undefined` removes the key. */
export function applyGridEdit(lines: readonly LineRow[], ctx: GridEditContext, taskGUID: string, col: GridColumn, value: number | string | undefined): LineRow[] {
  const field = col.field ?? col.key;
  const own = singlePositionOf(lines, taskGUID);
  if (own) {
    return lines.map((l) => {
      if (l.rowGUID !== own.rowGUID) return l;
      const rowJSON: Record<string, any> = { ...l.rowJSON, [field]: value };
      if (value === undefined) delete rowJSON[field];
      return { ...l, rowJSON: rowJSON as LineRow['rowJSON'] };
    });
  }
  if (positionCountOf(lines, taskGUID) > 0) return lines as LineRow[]; // several positions: read only
  const order = lines.reduce((m, l) => Math.max(m, l.orderInList), 0) + 10;
  const row = newLineRow(ctx.projectGUID, ctx.documentGUID, 'position', 'empty', order, { taskGUID, ...(value === undefined ? {} : { [field]: value }) } as any);
  return [...lines, row];
}

/** the next value of a select cell (Open -> Complete -> Open) */
export const nextOption = (col: GridColumn, current: string): string => {
  const o = col.options ?? [];
  return o.length ? o[(Math.max(0, o.indexOf(current)) + (o.includes(current) ? 1 : 0)) % o.length] : current;
};

/** the position of a task (and everything below it) is removed */
export function removePositionOf(lines: readonly LineRow[], taskGUID: string): LineRow[] {
  const gone = new Set<string>();
  for (const l of positionsByTask(lines).get(taskGUID) ?? []) subtreeGUIDs(lines as LineRow[], l.rowGUID).forEach((g) => gone.add(g));
  return gone.size ? lines.filter((l) => !gone.has(l.rowGUID)) : (lines as LineRow[]);
}

/** the column next to `key` (+1 right, -1 left); stays at the edge */
export function neighbourColumn(columns: readonly GridColumn[], key: string | null, dir: 1 | -1): string | null {
  if (!columns.length) return null;
  const i = columns.findIndex((c) => c.key === key);
  if (i < 0) return columns[0].key;
  return columns[Math.max(0, Math.min(columns.length - 1, i + dir))].key;
}

/** the column under the content x (null: right of the last column) */
export function columnAtX(columns: readonly GridColumn[], x: number): GridColumn | null {
  for (const c of columns) if (x >= c.x && x < c.x + c.width) return c;
  return null;
}

// ---- header / cell text that fits ---------------------------------------------------------------------------------------------------------------------------------
/** `text` cut with a "…" so that it fits `maxWidth` (the measure is the font's) */
export function fitText(text: string, maxWidth: number, measure: (s: string) => number): string {
  if (!text || measure(text) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && measure(`${s}…`) > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** a column title in at most two lines (the header row is as high as the header of the tree and holds the names of ALL columns on one level) */
export function wrapTitle(title: string, maxWidth: number, measure: (s: string) => number): string[] {
  if (measure(title) <= maxWidth) return [title];
  const words = title.split(/\s+/).filter(Boolean);
  let first = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = first ? `${first} ${words[i]}` : words[i];
    if (first && measure(next) > maxWidth) break;
    first = next;
  }
  const rest = words.slice(i).join(' ');
  return rest ? [fitText(first, maxWidth, measure), fitText(rest, maxWidth, measure)] : [fitText(first, maxWidth, measure)];
}

/** where the editor of a cell stands (content x): EXACTLY the cell - a number editor (- + calculator inside) shrinks its buttons to fit the column, it never grows over the next column */
export function editorBox(col: Pick<GridColumn, 'x' | 'width' | 'kind'>, _contentWidth: number): { x: number; width: number } {
  return { x: col.x, width: col.width };
}

/** the size of the - / + / calculator buttons of a number editor: 26, smaller in a narrow column so that the three buttons and a few digits stay INSIDE the cell */
export function editorButtonSize(width: number): number {
  return Math.max(16, Math.min(26, Math.floor((width - 4 - 40) / 3)));
}
