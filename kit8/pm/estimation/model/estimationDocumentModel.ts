// Estimation dashboard - the rows of a document (pure): new document / line rows, the recalculation that stores the sums of every line in the three currencies, the diff that decides what is
// written to the database, and the example documents the user can start from. Rows have the generic shape (rowGUID / rowOwnerGUID = the project / rowParentGUID / orderInList / rowJSON).
import { calcDocument, positionCost, positionInputOf, sumsOfLine, type CalcLine, type DocumentCalc } from './estimationCalc';
import type { EstimationDocumentJSON, EstimationDocKind, EstimationLineJSON, EstimationLineKind } from './estimationModel';
import type { TaskPlanRow } from './estimationTaskModel';

export interface EstimationRow<J = Record<string, any>> { rowGUID: string; rowOwnerGUID: string; rowParentGUID: string; orderInList: number; rowJSON: J }
export type DocumentRow = EstimationRow<EstimationDocumentJSON>;
export type LineRow = EstimationRow<EstimationLineJSON>;

export const newGUID = (): string => {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => { const r = (Math.random() * 16) | 0; return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
};

export function newDocumentRow(projectGUID: string, docKind: EstimationDocKind = 'local', extra: Partial<EstimationDocumentJSON> = {}): DocumentRow {
  return {
    rowGUID: newGUID(), rowOwnerGUID: projectGUID, rowParentGUID: 'empty', orderInList: Date.now(),
    rowJSON: { docKind, title: '', method: 'baseIndex', overheadPct: 0, profitPct: 0, index: 1, vatPct: 0, contingencyPct: 0, objectKind: 'nonProduction', rates: { budget: 1, accounting: 1, consolidation: 1 }, ...extra },
  };
}

/** the name a NEW document gets: `base` when it is free, else `base 2`, `base 3` ... (two documents with the same name cannot be told apart in the list of documents) */
export function nextDocumentTitle(base: string, taken: readonly string[]): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  if (!used.has(base.trim().toLowerCase())) return base;
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

/** the names shown for the documents of a project: the second and the next document with the SAME name get ` (2)`, ` (3)` ... (documents made before the names were unique) */
export function uniqueLabels(labels: readonly string[]): string[] {
  const seen = new Map<string, number>();
  const total = new Map<string, number>();
  for (const l of labels) total.set(l, (total.get(l) ?? 0) + 1);
  return labels.map((l) => {
    if ((total.get(l) ?? 0) < 2) return l;
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    return n === 1 ? l : `${l} (${n})`;
  });
}

export function newLineRow(projectGUID: string, documentGUID: string, lineKind: EstimationLineKind, parentGUID: string, orderInList: number, extra: Partial<EstimationLineJSON> = {}): LineRow {
  return { rowGUID: newGUID(), rowOwnerGUID: projectGUID, rowParentGUID: parentGUID || 'empty', orderInList, rowJSON: { documentGUID, lineKind, title: '', ...(lineKind === 'position' ? { qty: 1, unit: '' } : {}), ...extra } };
}

/** a norm of the norm book chosen for a POSITION: code, norm row, unit and the unit costs of its resources are written into the line; the quantity, the coefficient, the task and the typed
 *  description stay (the description is taken from the norm only while it is empty). Only a position takes a norm. */
export function applyNormToLine(line: LineRow, norm: { rowGUID: string; rowJSON: { code?: unknown; unit?: unknown } }, costs: { unitLabour: number; unitMachines: number; unitOperators: number; unitMaterials: number; unitOther: number; unitEquipment: number }, title: string): LineRow {
  if (line.rowJSON.lineKind !== 'position') return line;
  const j = line.rowJSON;
  return {
    ...line,
    rowJSON: {
      ...j,
      title: (j.title ?? '').trim() ? j.title : title,
      normCode: norm.rowJSON.code == null ? null : String(norm.rowJSON.code),
      normGUID: norm.rowGUID,
      unit: norm.rowJSON.unit == null ? j.unit ?? '' : String(norm.rowJSON.unit),
      unitLabour: costs.unitLabour, unitMachines: costs.unitMachines, unitOperators: costs.unitOperators, unitMaterials: costs.unitMaterials, unitOther: costs.unitOther, unitEquipment: costs.unitEquipment,
    },
  };
}

/** the lines with the three sums of every position and section stored (a line whose numbers changed gets new rowJSON; the others are returned as they are) */
export function recalcLines(lines: readonly LineRow[], doc: Partial<EstimationDocumentJSON> | null): { lines: LineRow[]; calc: DocumentCalc } {
  const calc = calcDocument(lines as unknown as CalcLine[], doc);
  const out = lines.map((l) => {
    if (l.rowJSON.lineKind === 'resource') return l;
    const cost = calc.byLine[l.rowGUID];
    if (!cost) return l;
    const s = sumsOfLine(cost, doc?.rates);
    const j = l.rowJSON;
    if (j.sumForBudget === s.sumForBudget && j.sumForAccounting === s.sumForAccounting && j.sumForConsolidation === s.sumForConsolidation) return l;
    return { ...l, rowJSON: { ...j, ...s } };
  });
  return { lines: out, calc };
}

/** what to write: the rows that are new or whose json / parent / order changed, and the guids that are gone */
export function diffRows<T extends EstimationRow>(prev: readonly T[], next: readonly T[]): { upserts: T[]; deletes: string[] } {
  const before = new Map(prev.map((r) => [r.rowGUID, r]));
  const upserts: T[] = [];
  for (const r of next) {
    const p = before.get(r.rowGUID);
    if (!p || p.rowParentGUID !== r.rowParentGUID || p.orderInList !== r.orderInList || JSON.stringify(p.rowJSON) !== JSON.stringify(r.rowJSON)) upserts.push(r);
    before.delete(r.rowGUID);
  }
  return { upserts, deletes: [...before.keys()] };
}

/** the tree order of the lines with their depth (what the table shows) */
export const treeOrder = (calc: DocumentCalc): { rowGUID: string; depth: number }[] => calc.order;

/** the rows below a line (itself included) */
export function subtreeGUIDs(lines: readonly LineRow[], guid: string): string[] {
  const kids = new Map<string, string[]>();
  for (const l of lines) { if (!kids.has(l.rowParentGUID)) kids.set(l.rowParentGUID, []); kids.get(l.rowParentGUID)!.push(l.rowGUID); }
  const out: string[] = [];
  const walk = (g: string) => { if (out.includes(g)) return; out.push(g); (kids.get(g) ?? []).forEach(walk); };
  walk(guid);
  return out;
}

// ---- examples the user can start from (the dashboard offers every layout as a ready estimate) -----------------------------------------------------------------------------
export type ExampleKey = 'estimateSheet' | 'quickQuote' | 'tradeBreakdown';

interface SamplePosition { title: string; code: string; unit: string; qty: number; labour: number; machines: number; operators: number; materials: number; coef?: number }
const SHEET: { section: string; positions: SamplePosition[] }[] = [
  { section: 'Section 1. Earthworks', positions: [
    { title: 'Excavation with hydraulic excavator, soil group 2, loading into trucks', code: 'SAMPLE 01-01-013-03', unit: '1000 m3', qty: 0.84, labour: 0, machines: 4815, operators: 620.4, materials: 0 },
    { title: 'Hand trimming of trench bottom', code: 'SAMPLE 01-02-057-01', unit: '100 m3', qty: 0.36, labour: 1260, machines: 0, operators: 0, materials: 0, coef: 1.2 },
    { title: 'Backfilling of trenches, soil from stockpile', code: 'SAMPLE 01-01-033-02', unit: '1000 m3', qty: 0.41, labour: 96.5, machines: 1730, operators: 205, materials: 0 } ] },
  { section: 'Section 2. Foundations', positions: [
    { title: 'Blinding concrete B7.5, 100 mm', code: 'SAMPLE 06-01-001-01', unit: '100 m3', qty: 0.18, labour: 3120, machines: 1960, operators: 340, materials: 41250 },
    { title: 'Reinforced concrete strip foundations, concrete B25', code: 'SAMPLE 06-01-001-16', unit: '100 m3', qty: 1.24, labour: 14980, machines: 6120, operators: 1105, materials: 187400 },
    { title: 'Horizontal waterproofing, two layers of membrane', code: 'SAMPLE 08-01-003-07', unit: '100 m2', qty: 5.2, labour: 842, machines: 96, operators: 18, materials: 7340 } ] },
  { section: 'Section 3. Superstructure walls', positions: [
    { title: 'Masonry of external walls, aerated concrete blocks 300 mm', code: 'SAMPLE 08-02-001-04', unit: '1 m3', qty: 148.04, labour: 412, machines: 66, operators: 12.5, materials: 3625 },
    { title: 'Lintels, precast reinforced concrete, installation', code: 'SAMPLE 09-03-012-02', unit: '100 pcs', qty: 0.62, labour: 3880, machines: 2410, operators: 380, materials: 9150 } ] },
];
const QUOTE: [string, string, string, number, number, number][] = [
  ['Plans and permitting', 'Design and layout', 'Unit', 1, 2500, 25], ['Plans and permitting', 'Permit application', 'Unit', 1, 1200, 25], ['General conditions', 'Site manager', 'Days', 18, 190, 25],
  ['Demolition', 'Strip out and haul away debris', 'Hourly', 24, 100, 25], ['Electrical', 'Recessed lighting, supply and fix', 'Each', 8, 175, 25], ['Plumbing', 'Relocate waste and supply pipework', 'Unit', 1, 2500, 25],
  ['Flooring', 'Porcelain tile floor, laid', 'Sqft', 250, 9, 30], ['Painting', 'Paint walls and ceilings, two coats', 'Sqft', 800, 1.75, 20],
];
const TRADES: [string, number, number][] = [['Surveying', 1000, 0], ['Erosion control', 1800, 1260], ['Sewer and water', 2000, 1700], ['Concrete paving', 700, 1400], ['Rebar and concrete', 3500, 5787], ['Structural metals', 6500, 16500], ['Roofing', 4500, 18765], ['Windows', 2750, 26000], ['Drywall', 4000, 5500]];

/** a ready estimate of one of the layouts: the document, its positions and the TASK PLAN it stands on (a stage per section / trade, a task per position; the positions name their task by
 *  `taskGUID`). The dashboard creates the tasks in the task tree of the project, then the lines. The numbers are illustrative samples, not price-book data. */
export interface ExampleEstimate { doc: DocumentRow; lines: LineRow[]; tasks: TaskPlanRow[] }

/** a position with its own task (under `parent`, null = under the project) */
function positionOnNewTask(projectGUID: string, documentGUID: string, tasks: TaskPlanRow[], parent: string | null, order: number, name: string, extra: Partial<EstimationLineJSON>): LineRow {
  const line = newLineRow(projectGUID, documentGUID, 'position', 'empty', order, extra);
  tasks.push({ rowGUID: newGUID(), parentGUID: parent, kind: 'task', name });
  return { ...line, rowJSON: { ...line.rowJSON, taskGUID: tasks[tasks.length - 1].rowGUID } };
}
const stageOf = (tasks: TaskPlanRow[], name: string): string => { const g = newGUID(); tasks.push({ rowGUID: g, parentGUID: null, kind: 'stage', name }); return g; };

export function exampleDocument(projectGUID: string, key: ExampleKey): ExampleEstimate {
  const tasks: TaskPlanRow[] = [];
  if (key === 'estimateSheet') {
    const doc = newDocumentRow(projectGUID, 'local', { title: 'Example: local estimate (earthworks, foundations, walls)', cipher: 'LS-01-01-01', overheadPct: 90, profitPct: 50, index: 8.74 });
    const lines: LineRow[] = [];
    let order = 10;
    for (const s of SHEET) {
      const stage = stageOf(tasks, s.section);
      for (const p of s.positions) {
        lines.push(positionOnNewTask(projectGUID, doc.rowGUID, tasks, stage, order, p.title, { title: p.title, normCode: p.code, unit: p.unit, qty: p.qty, unitLabour: p.labour, unitMachines: p.machines, unitOperators: p.operators, unitMaterials: p.materials, coefficients: p.coef ? [{ value: p.coef, justification: 'Cramped conditions' }] : [] }));
        order += 10;
      }
    }
    return { doc, lines, tasks };
  }
  if (key === 'quickQuote') {
    const doc = newDocumentRow(projectGUID, 'bid', { title: 'Example: quick quote (kitchen refurbishment)', method: 'commercial' });
    const lines = QUOTE.map(([category, title, unit, qty, cost, markup], i) => positionOnNewTask(projectGUID, doc.rowGUID, tasks, null, (i + 1) * 10, title, { title, category, unit, qty, unitOther: cost, markupPct: markup, status: i < 3 ? 'Complete' : 'Open' }));
    return { doc, lines, tasks };
  }
  const doc = newDocumentRow(projectGUID, 'object', { title: 'Example: trade breakdown (commercial building)', method: 'commercial', overheadPct: 0, profitPct: 0 });
  const lines: LineRow[] = [];
  TRADES.forEach(([trade, labour, material], i) => {
    const stage = stageOf(tasks, trade);
    lines.push(
      positionOnNewTask(projectGUID, doc.rowGUID, tasks, stage, (i + 1) * 10 + 1, `${trade} - labour`, { title: `${trade} - labour`, category: trade, qty: 1, unit: 'lump sum', unitLabour: labour }),
      positionOnNewTask(projectGUID, doc.rowGUID, tasks, stage, (i + 1) * 10 + 2, `${trade} - materials`, { title: `${trade} - materials`, category: trade, qty: 1, unit: 'lump sum', unitMaterials: material }));
  });
  return { doc, lines, tasks };
}

/** the columns of an INPUT template (a CSV the user fills in and pastes / imports): one row per position */
export const INPUT_TEMPLATE_COLUMNS = ['section', 'normCode', 'title', 'unit', 'qty', 'coefficient', 'unitLabour', 'unitMachines', 'unitOperators', 'unitMaterials', 'unitOther', 'unitEquipment', 'budgetItem', 'businessUnit'] as const;

/** the text of the input template: a header + the positions of the example (CSV, comma, quotes where needed) */
export function inputTemplateCsv(projectGUID: string): string {
  const q = (v: unknown) => { const t = v == null ? '' : String(v); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const { lines, tasks } = exampleDocument(projectGUID, 'estimateSheet');
  const taskById = new Map(tasks.map((t) => [t.rowGUID, t]));
  const stageName = (l: LineRow): string => { const t = taskById.get(l.rowJSON.taskGUID ?? ''); return (t?.parentGUID && taskById.get(t.parentGUID)?.name) || ''; };
  const rows = lines.filter((l) => l.rowJSON.lineKind === 'position').map((l) => {
    const j = l.rowJSON;
    return [stageName(l), j.normCode, j.title, j.unit, j.qty, (j.coefficients ?? [])[0]?.value ?? 1, j.unitLabour, j.unitMachines, j.unitOperators, j.unitMaterials, j.unitOther ?? 0, j.unitEquipment ?? 0, '', ''];
  });
  return '﻿' + [INPUT_TEMPLATE_COLUMNS.join(','), ...rows.map((r) => r.map(q).join(','))].join('\r\n') + '\r\n';
}

/** a CSV of the template (or an Excel paste, tab separated) -> the estimate of the table: ONE position per row, each on a task of its own (named by the description); the column `section` is the
 *  STAGE the task goes under (a stage of the project with that name is joined, else one is made once per name). Unknown columns are ignored. Returns the positions and the TASK PLAN to create. */
export function estimateFromTable(projectGUID: string, documentGUID: string, text: string, o: { startOrder?: number; existingStages?: ReadonlyMap<string, string> } = {}): { lines: LineRow[]; tasks: TaskPlanRow[] } {
  const clean = text.replace(/^﻿/, '');
  const delim = clean.split('\n', 1)[0].includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQ) { if (ch === '"') { if (clean[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === delim) { cur.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && clean[i + 1] === '\n') i++; cur.push(cell); cell = ''; if (cur.some((c) => c.trim())) rows.push(cur); cur = []; }
    else cell += ch;
  }
  cur.push(cell);
  if (cur.some((c) => c.trim())) rows.push(cur);
  if (rows.length < 2) return { lines: [], tasks: [] };
  const head = rows[0].map((h) => h.trim());
  const col = (name: string) => head.indexOf(name);
  const num = (r: string[], name: string): number | undefined => { const i = col(name); if (i < 0) return undefined; const v = Number(String(r[i] ?? '').replace(',', '.').replace(/\s/g, '')); return Number.isFinite(v) && String(r[i] ?? '').trim() !== '' ? v : undefined; };
  const txt = (r: string[], name: string): string => { const i = col(name); return i < 0 ? '' : String(r[i] ?? '').trim(); };
  const lines: LineRow[] = [];
  const tasks: TaskPlanRow[] = [];
  // a stage of the project with the same name (case does not matter) is joined; every new name makes ONE stage
  const stages = new Map<string, string>([...(o.existingStages ?? [])].map(([name, guid]) => [name.trim().toLowerCase(), guid]));
  let order = o.startOrder ?? 10;
  for (const r of rows.slice(1)) {
    const stageTitle = txt(r, 'section');
    let parent: string | null = null;
    if (stageTitle) {
      parent = stages.get(stageTitle.toLowerCase()) ?? null;
      if (!parent) { parent = newGUID(); stages.set(stageTitle.toLowerCase(), parent); tasks.push({ rowGUID: parent, parentGUID: null, kind: 'stage', name: stageTitle }); }
    }
    const title = txt(r, 'title');
    const task: TaskPlanRow = { rowGUID: newGUID(), parentGUID: parent, kind: 'task', name: title || txt(r, 'normCode') || `Position ${lines.length + 1}` };
    tasks.push(task);
    const coef = num(r, 'coefficient');
    lines.push(newLineRow(projectGUID, documentGUID, 'position', 'empty', order, {
      taskGUID: task.rowGUID,
      title, normCode: txt(r, 'normCode') || null, unit: txt(r, 'unit'), qty: num(r, 'qty') ?? 1,
      coefficients: coef && coef !== 1 ? [{ value: coef }] : [],
      unitLabour: num(r, 'unitLabour') ?? 0, unitMachines: num(r, 'unitMachines') ?? 0, unitOperators: num(r, 'unitOperators') ?? 0, unitMaterials: num(r, 'unitMaterials') ?? 0, unitOther: num(r, 'unitOther') ?? 0, unitEquipment: num(r, 'unitEquipment') ?? 0,
    }));
    order += 10;
  }
  return { lines, tasks };
}

export { positionCost, positionInputOf };
