// The printed forms of an estimate (pure): a document + its lines -> a FORM = a title block, column titles, rows and total rows with numbers (Excel keeps them as numbers and the totals as
// formulas; the PDF prints the same rows as text). The wording follows the project switch useGOSTInformationInDocuments: OFF (default) = neutral English wording, no country, no authority,
// no form number; ON = the names of the forms of the Methodology (Order 421/pr) are added. Every text goes through `t` (pmT in the app): the forms follow the language of the interface.
import { calcDocument, positionInputOf, summaryEstimate, SUMMARY_CHAPTERS, round2, type ChapterRow, type CostBreakdown } from '../model/estimationCalc';
import { buildEstimateOutline, type OutlineEntry, type OutlineTask } from '../model/estimateOutlineModel';
import type { DocumentRow, LineRow } from '../model/estimationDocumentModel';
import { BASIS_TO_SUM_KEY, type EstimationCurrencyBasis, type EstimationDocKind, type EstimationLineJSON } from '../model/estimationModel';
import { buildXlsx, cellRef, type XlsxCell, type XlsxSheet } from './xlsxWriter';

export type Translate = (text: string, values?: Record<string, string | number>) => string;
export const identity: Translate = (text, values) => (values ? text.replace(/\{\{(\w+)\}\}/g, (_, k) => String(values[k] ?? '')) : text);

export interface FormColumn { title: string; width: number; kind: 'text' | 'money' | 'qty' | 'int' }
/** sumPositions: in Excel the money cells of this row are SUMIF formulas over the numbered rows (the positions) above it */
export interface FormRow { cells: (string | number | null)[]; bold?: boolean; section?: boolean; total?: boolean; sumPositions?: boolean }
export interface Form { title: string; subtitle: string; header: string[]; columns: FormColumn[]; rows: FormRow[]; fileName: string; sheetName: string }

/** `tasks` = the task tree of the estimation project: the stages are the headings of the forms and the tasks give the order (without it a document is outlined by its own older section lines) */
export interface FormOptions { gost: boolean; t: Translate; basis: EstimationCurrencyBasis; currency: string; now?: Date; tasks?: readonly OutlineTask[] | null }

export function docKindTitle(kind: EstimationDocKind, o: Pick<FormOptions, 'gost' | 't'>): string {
  const { t, gost } = o;
  switch (kind) {
    case 'local': return gost ? t('Local estimate (form of the Methodology, appendix 2)') : t('Local estimate');
    case 'object': return gost ? t('Object estimate (form of the Methodology, appendix 5)') : t('Object estimate');
    case 'summary': return gost ? t('Summary estimate of construction cost (form of the Methodology, appendix 6)') : t('Summary estimate of construction cost');
    case 'separate': return t('Estimate of separate costs');
    default: return t('Quotation');
  }
}

const dateText = (d?: Date): string => (d ?? new Date()).toISOString().slice(0, 10);
const safeFile = (s: string): string => s.replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim().slice(0, 80) || 'estimate';
const headerOf = (doc: DocumentRow, o: FormOptions): string[] => {
  const h = doc.rowJSON.header ?? {};
  return [
    ...(doc.rowJSON.cipher ? [`${o.t('Cipher')}: ${doc.rowJSON.cipher}`] : []),
    ...(h.client ? [`${o.t('Client')}: ${h.client}`] : []),
    ...(h.basis ? [`${o.t('Basis')}: ${h.basis}`] : []),
    `${o.t('Method')}: ${doc.rowJSON.method === 'baseIndex' ? o.t('base prices and an index') : doc.rowJSON.method === 'commercial' ? o.t('commercial') : String(doc.rowJSON.method ?? '')}` + (doc.rowJSON.priceLevelDate ? ` · ${o.t('Price level')}: ${doc.rowJSON.priceLevelDate}` : ''),
    `${o.t('Currency')}: ${o.currency}`,
  ];
};

const ZERO: CostBreakdown = { labour: 0, machines: 0, operators: 0, materials: 0, other: 0, equipment: 0, direct: 0, payroll: 0, overheads: 0, profit: 0, base: 0, current: 0 };

/** the heading row of a stage / section (the sums of everything below it) */
const headingText = (e: Exclude<OutlineEntry, { type: 'position' }>, t: Translate): string =>
  e.type === 'unplaced' ? t('Lines without a task') : e.type === 'stage' && e.wbs ? `${e.wbs}. ${e.title}` : e.title;

/** the local estimate: stages (the tasks that have tasks below them) as headings, positions (norm, unit, quantity, coefficient, unit cost, total, index, total in current prices) in the order
 *  of the task tree, and the totals of the estimate */
export function buildLocalEstimateForm(doc: DocumentRow, lines: readonly LineRow[], o: FormOptions): Form {
  const { t } = o;
  const calc = calcDocument(lines, doc.rowJSON);
  const outline = buildEstimateOutline({ tasks: o.tasks, lines, byLine: calc.byLine, doc: doc.rowJSON });
  const columns: FormColumn[] = [
    { title: t('No'), width: 6, kind: 'int' }, { title: t('Justification'), width: 20, kind: 'text' }, { title: t('Description of works and costs'), width: 50, kind: 'text' }, { title: t('Unit'), width: 10, kind: 'text' },
    { title: t('Quantity'), width: 12, kind: 'qty' }, { title: t('Coefficient'), width: 11, kind: 'qty' }, { title: t('Unit cost, base prices'), width: 16, kind: 'money' }, { title: t('Total, base prices'), width: 16, kind: 'money' },
    { title: t('Index'), width: 9, kind: 'qty' }, { title: t('Total, current prices'), width: 18, kind: 'money' },
  ];
  const rows: FormRow[] = [];
  let n = 0;
  for (const e of outline.entries) {
    if (e.type !== 'position') { rows.push({ cells: [null, null, headingText(e, t), null, null, null, null, e.cost.base, null, e.cost.current], section: true, bold: true }); continue; }
    const l = e.line;
    const cost = calc.byLine[l.rowGUID] ?? ZERO;
    const j = l.rowJSON;
    const k = (j.qty ?? 0) || 1;
    const idx = j.index ?? doc.rowJSON.index ?? 1;
    rows.push({ cells: [++n, j.normCode ?? '', e.title, j.unit ?? '', j.qty ?? 0, calcCoef(j), round2(cost.base / k), cost.base, idx, cost.current] });
  }
  const T = calc.total;
  const sumRow = (label: string, base: number | null, cur: number | null, bold = false): FormRow => ({ cells: [null, null, label, null, null, null, null, base, null, cur], bold, total: true });
  rows.push(sumRow(t('Total direct costs'), T.direct, round2(T.direct * (doc.rowJSON.index ?? 1))));
  rows.push(sumRow(t('Payroll (labour and machine operators)'), T.payroll, null));
  rows.push(sumRow(t('Overheads'), T.overheads, round2(T.overheads * (doc.rowJSON.index ?? 1))));
  rows.push(sumRow(t('Estimated profit'), T.profit, round2(T.profit * (doc.rowJSON.index ?? 1))));
  if (T.equipment) rows.push(sumRow(t('Equipment'), T.equipment, round2(T.equipment * (doc.rowJSON.index ?? 1))));
  rows.push({ ...sumRow(t('TOTAL'), T.base, T.current, true), sumPositions: true });
  const sums = calc.sums[BASIS_TO_SUM_KEY[o.basis]];
  rows.push({ cells: [null, null, `${t('Total in the currency of the view')} (${o.basis})`, null, null, null, null, null, null, sums], bold: true, total: true });
  const title = doc.rowJSON.title || docKindTitle(doc.rowJSON.docKind, o);
  const h = doc.rowJSON.header ?? {};
  return {
    title, subtitle: docKindTitle(doc.rowJSON.docKind, o), header: [...headerOf(doc, o), ...(h.compiledBy ? [`${t('Compiled by')}: ${h.compiledBy}`] : []), ...(h.approvedBy ? [`${t('Approved by')}: ${h.approvedBy}`] : [])],
    columns, rows, fileName: safeFile(`${doc.rowJSON.cipher ? doc.rowJSON.cipher + '_' : ''}${title}`), sheetName: doc.rowJSON.cipher || title,
  };
}
const calcCoef = (j: Partial<EstimationLineJSON>): number => positionInputOf(j).coef;

/** the resources of a document: the sums of labour, machines, operators, materials, other and equipment per position (in the order of the task tree, a stage heading carries its sums) and in total (a resource sheet) */
export function buildResourceSheet(doc: DocumentRow, lines: readonly LineRow[], o: FormOptions): Form {
  const { t } = o;
  const calc = calcDocument(lines, doc.rowJSON);
  const outline = buildEstimateOutline({ tasks: o.tasks, lines, byLine: calc.byLine, doc: doc.rowJSON });
  const columns: FormColumn[] = [{ title: t('No'), width: 6, kind: 'int' }, { title: t('Description of works and costs'), width: 50, kind: 'text' }, { title: t('Labour'), width: 14, kind: 'money' }, { title: t('Machines'), width: 14, kind: 'money' }, { title: t('of which operators'), width: 14, kind: 'money' }, { title: t('Materials'), width: 14, kind: 'money' }, { title: t('Other'), width: 12, kind: 'money' }, { title: t('Equipment'), width: 14, kind: 'money' }];
  const rows: FormRow[] = [];
  let n = 0;
  for (const e of outline.entries) {
    if (e.type !== 'position') { rows.push({ cells: [null, headingText(e, t), e.cost.labour, e.cost.machines, e.cost.operators, e.cost.materials, e.cost.other, e.cost.equipment], section: true, bold: true }); continue; }
    const c = calc.byLine[e.line.rowGUID] ?? ZERO;
    rows.push({ cells: [++n, e.title, c.labour, c.machines, c.operators, c.materials, c.other, c.equipment] });
  }
  const T = calc.total;
  rows.push({ cells: [null, t('TOTAL'), T.labour, T.machines, T.operators, T.materials, T.other, T.equipment], bold: true, total: true, sumPositions: true });
  return { title: `${t('Resource sheet')}: ${doc.rowJSON.title ?? ''}`.trim(), subtitle: t('Resource sheet'), header: headerOf(doc, o), columns, rows, fileName: safeFile(`${t('Resource sheet')}_${doc.rowJSON.title ?? ''}`), sheetName: t('Resource sheet') };
}

/** the quotation: category, description, unit, quantity, cost, mark-up, price - for the quick quote layout. The positions stand in the order of the task tree; a position with no typed category
 *  takes the name of the stage its task stands in */
export function buildQuotationForm(doc: DocumentRow, lines: readonly LineRow[], o: FormOptions): Form {
  const { t } = o;
  const outline = buildEstimateOutline({ tasks: o.tasks, lines, byLine: {}, doc: doc.rowJSON });
  const columns: FormColumn[] = [{ title: t('No'), width: 6, kind: 'int' }, { title: t('Category'), width: 24, kind: 'text' }, { title: t('Description'), width: 44, kind: 'text' }, { title: t('Unit'), width: 10, kind: 'text' }, { title: t('Quantity'), width: 12, kind: 'qty' }, { title: t('Cost per unit'), width: 14, kind: 'money' }, { title: t('Cost'), width: 14, kind: 'money' }, { title: t('Mark-up, %'), width: 11, kind: 'money' }, { title: t('Price'), width: 14, kind: 'money' }];
  const rows: FormRow[] = [];
  let n = 0;
  let cost = 0;
  let price = 0;
  for (const e of outline.positions) {
    const j = e.line.rowJSON;
    const unit = (j.unitOther ?? 0) + (j.unitMaterials ?? 0) + (j.unitLabour ?? 0) + (j.unitMachines ?? 0);
    const c = round2((j.qty ?? 0) * unit);
    const p = round2(c * (1 + (j.markupPct ?? 0) / 100));
    cost += c; price += p;
    rows.push({ cells: [++n, j.category || e.stage || '', e.title, j.unit ?? '', j.qty ?? 0, unit, c, j.markupPct ?? 0, p] });
  }
  rows.push({ cells: [null, null, t('TOTAL'), null, null, null, round2(cost), null, round2(price)], bold: true, total: true, sumPositions: true });
  rows.push({ cells: [null, null, t('Profit'), null, null, null, null, null, round2(price - cost)], bold: true, total: true });
  return { title: doc.rowJSON.title || t('Quotation'), subtitle: t('Quotation'), header: headerOf(doc, o), columns, rows, fileName: safeFile(doc.rowJSON.title || t('Quotation')), sheetName: t('Quotation') };
}

/** the summary estimate of the documents of the project: every 'local' / 'separate' document is a line of its chapter (rowJSON.chapter, default 2) in the column of its work kind */
export function summaryRowsOf(docs: { doc: DocumentRow; total: CostBreakdown }[]): ChapterRow[] {
  return docs.filter((d) => d.doc.rowJSON.docKind === 'local' || d.doc.rowJSON.docKind === 'separate').map(({ doc, total }) => {
    const j = doc.rowJSON as any;
    const chapter = Number(j.chapter) >= 1 && Number(j.chapter) <= 12 ? Number(j.chapter) : 2;
    const kind = (j.workKind as string) || (doc.rowJSON.docKind === 'separate' ? 'other' : 'construction');
    const equipment = round2(total.equipment * (doc.rowJSON.index ?? 1));
    const works = round2(total.current - equipment);
    return { chapter, title: String(doc.rowJSON.title ?? ''), construction: kind === 'construction' ? works : 0, installation: kind === 'installation' ? works : 0, equipment, other: kind === 'other' ? works : 0 };
  });
}

export function buildSummaryForm(rows: readonly ChapterRow[], o: FormOptions & { contingencyPct: number; vatPct: number; title?: string; objectKind?: any }): Form {
  const { t } = o;
  const s = summaryEstimate(rows, { contingencyPct: o.contingencyPct, vatPct: o.vatPct, objectKind: o.objectKind });
  const columns: FormColumn[] = [{ title: t('Chapter'), width: 9, kind: 'text' }, { title: t('Name of chapters, objects, works and costs'), width: 56, kind: 'text' }, { title: t('Construction works'), width: 16, kind: 'money' }, { title: t('Installation works'), width: 16, kind: 'money' }, { title: t('Equipment'), width: 16, kind: 'money' }, { title: t('Other costs'), width: 16, kind: 'money' }, { title: t('Total'), width: 16, kind: 'money' }];
  const rowOf = (a: string | null, b: string, c: { construction: number; installation: number; equipment: number; other: number; total: number }, bold = false, total = false): FormRow => ({ cells: [a, b, c.construction, c.installation, c.equipment, c.other, c.total], bold, total });
  const rowsOut: FormRow[] = [];
  const title = (n: number, fallback: string) => t(fallback);
  for (const c of s.chapters) {
    rowsOut.push(rowOf(String(c.chapter), title(c.chapter, c.title), c.cols));
    if (c.chapter === 7) rowsOut.push(rowOf(null, t('Total, chapters 1 - 7'), s.after.to7, true, true));
    if (c.chapter === 8) rowsOut.push(rowOf(null, t('Total, chapters 1 - 8'), s.after.to8, true, true));
    if (c.chapter === 9) rowsOut.push(rowOf(null, t('Total, chapters 1 - 9'), s.after.to9, true, true));
  }
  rowsOut.push(rowOf(null, t('Total, chapters 1 - 12'), s.after.to12, true, true));
  rowsOut.push(rowOf(null, t('Contingency, {{p}} %', { p: o.contingencyPct }), s.contingency, false, true));
  rowsOut.push(rowOf(null, t('VAT, {{p}} %', { p: o.vatPct }), s.vat, false, true));
  rowsOut.push(rowOf(null, t('TOTAL WITH VAT'), s.grand, true, true));
  const name = o.title || docKindTitle('summary', o);
  return { title: name, subtitle: docKindTitle('summary', o), header: [`${t('Currency')}: ${o.currency} (${t('thousands')})`, ...s.warnings], columns, rows: rowsOut, fileName: safeFile(name), sheetName: t('Summary') };
}

export const formToTextRows = (f: Form, fmt: (n: number) => string = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })): { headers: string[]; rows: string[][] } => ({
  headers: f.columns.map((c) => c.title),
  rows: f.rows.map((r) => r.cells.map((c, i) => (c === null || c === undefined ? '' : typeof c === 'number' ? (f.columns[i].kind === 'int' ? String(c) : fmt(c)) : String(c)))),
});

/** the forms as one .xlsx: a sheet per form, the totals of the local estimate are SUM formulas over the lines above them */
export function formsToXlsx(forms: readonly Form[]): Uint8Array {
  const sheets: XlsxSheet[] = forms.map((f) => {
    const rows: (XlsxCell | string | number | null)[][] = [[{ v: f.title, s: 'title' }], [{ v: f.subtitle, s: 'subtitle' }], ...f.header.map((h) => [{ v: h, s: 'note' as const }]), []];
    const headRow = rows.length;
    rows.push(f.columns.map((c) => ({ v: c.title, s: 'head' as const })));
    const first = rows.length;
    f.rows.forEach((r) => {
      const excelRow = rows.length;
      rows.push(r.cells.map((v, ci): XlsxCell => {
        const kind = f.columns[ci]?.kind ?? 'text';
        if (v === null || v === undefined) return { v: null, s: r.bold ? 'bold' : 'text' };
        if (typeof v === 'string') return { v, s: r.bold ? 'bold' : 'text' };
        const s = r.total || r.section ? 'moneyBold' : kind === 'qty' ? 'qty' : kind === 'int' ? 'int' : 'money';
        // the total of the positions above: a formula (the cached value is the number), so a changed number in Excel moves the total
        if (r.sumPositions && kind === 'money') return { v, f: `SUMIF(${cellRef(0, first)}:${cellRef(0, excelRow - 1)},">0",${cellRef(ci, first)}:${cellRef(ci, excelRow - 1)})`, s: 'moneyBold' };
        return { v, s };
      }));
    });
    return { name: f.sheetName, widths: f.columns.map((c) => c.width), rows, merges: [`A1:${cellRef(Math.max(0, f.columns.length - 1), 0)}`], freezeRow: headRow + 1 };
  });
  return buildXlsx(sheets);
}

export { SUMMARY_CHAPTERS };
