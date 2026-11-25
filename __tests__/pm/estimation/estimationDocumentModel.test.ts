import { calcDocument } from '../../../kit8/pm/estimation/model/estimationCalc';
import { diffRows, exampleDocument, inputTemplateCsv, linesFromTable, newDocumentRow, newLineRow, recalcLines, subtreeGUIDs } from '../../../kit8/pm/estimation/model/estimationDocumentModel';

const P = '11111111-1111-1111-1111-111111111111';

describe('example documents', () => {
  it('the estimate sheet example gives the totals of the documentation (rounded lines)', () => {
    const { doc, lines } = exampleDocument(P, 'estimateSheet');
    expect(doc.rowJSON).toMatchObject({ docKind: 'local', overheadPct: 90, profitPct: 50, index: 8.74 });
    expect(lines.filter((l) => l.rowJSON.lineKind === 'section')).toHaveLength(3);
    expect(lines.filter((l) => l.rowJSON.lineKind === 'position')).toHaveLength(8);
    const calc = calcDocument(lines, doc.rowJSON);
    expect(calc.total.direct).toBe(932243.71);
    expect(calc.total.current).toBe(9270015.98);
    expect(lines.every((l) => l.rowOwnerGUID === P && l.rowJSON.documentGUID === doc.rowGUID)).toBe(true);
  });
  it('the quick quote and the trade breakdown examples are documents of their own kind with their lines', () => {
    const q = exampleDocument(P, 'quickQuote');
    expect(q.doc.rowJSON.docKind).toBe('bid');
    expect(q.lines).toHaveLength(8);
    expect(q.lines[0].rowJSON).toMatchObject({ category: 'Plans and permitting', markupPct: 25, status: 'Complete' });
    const t = exampleDocument(P, 'tradeBreakdown');
    expect(t.lines.filter((l) => l.rowJSON.lineKind === 'section')).toHaveLength(9);
    expect(calcDocument(t.lines, t.doc.rowJSON).total.direct).toBe(103662);
  });
});

describe('recalcLines', () => {
  const { doc, lines } = exampleDocument(P, 'estimateSheet');
  const rated = { ...doc.rowJSON, rates: { budget: 1, accounting: 1, consolidation: 1.1 } };
  const { lines: out, calc } = recalcLines(lines, rated);
  it('stores the total of every position and section in the budget, accounting and consolidation currency', () => {
    const sec = out.find((l) => l.rowJSON.lineKind === 'section')!;
    expect(sec.rowJSON.sumForBudget).toBe(calc.byLine[sec.rowGUID].current);
    expect(sec.rowJSON.sumForConsolidation).toBe(Math.round(calc.byLine[sec.rowGUID].current * 1.1 * 100) / 100);
    const pos = out.find((l) => l.rowJSON.lineKind === 'position')!;
    expect(pos.rowJSON.sumForAccounting).toBe(calc.byLine[pos.rowGUID].current);
  });
  it('a second recalculation changes nothing (same object returned) and the diff is empty', () => {
    const again = recalcLines(out, rated).lines;
    expect(again.every((l, i) => l === out[i])).toBe(true);
    expect(diffRows(out, again)).toEqual({ upserts: [], deletes: [] });
  });
});

describe('diffRows / subtree', () => {
  it('finds new, changed, moved and deleted rows', () => {
    const a = newLineRow(P, 'd', 'section', 'empty', 10, { title: 'A' });
    const b = newLineRow(P, 'd', 'position', a.rowGUID, 20, { title: 'B', qty: 1 });
    const c = newLineRow(P, 'd', 'position', a.rowGUID, 30, { title: 'C', qty: 1 });
    const next = [a, { ...b, rowJSON: { ...b.rowJSON, qty: 2 } }, { ...c, orderInList: 5 }, newLineRow(P, 'd', 'position', 'empty', 40)];
    const d = diffRows([a, b, c], next);
    expect(d.upserts.map((r) => r.rowGUID)).toEqual([b.rowGUID, c.rowGUID, next[3].rowGUID]);
    expect(diffRows([a, b, c], [a]).deletes).toEqual([b.rowGUID, c.rowGUID]);
    expect(subtreeGUIDs([a, b, c], a.rowGUID)).toEqual([a.rowGUID, b.rowGUID, c.rowGUID]);
    expect(newDocumentRow(P).rowJSON.docKind).toBe('local');
  });
});

describe('the input template (CSV) and the paste of a table', () => {
  it('the template is a CSV with a byte order mark whose rows read back as the same positions', () => {
    const csv = inputTemplateCsv(P);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split('\r\n')[0].slice(1)).toBe('section,normCode,title,unit,qty,coefficient,unitLabour,unitMachines,unitOperators,unitMaterials,unitOther,unitEquipment,budgetItem,businessUnit');
    const lines = linesFromTable(P, 'doc1', csv);
    expect(lines.filter((l) => l.rowJSON.lineKind === 'section').map((l) => l.rowJSON.title)).toEqual(['Section 1. Earthworks', 'Section 2. Foundations', 'Section 3. Superstructure walls']);
    expect(lines.filter((l) => l.rowJSON.lineKind === 'position')).toHaveLength(8);
    const calc = calcDocument(lines, { overheadPct: 90, profitPct: 50, index: 8.74 });
    expect(calc.total.current).toBe(9270015.98);
  });
  it('an Excel paste (tab separated, decimal comma, quoted cell with a line break) is read too; junk gives nothing', () => {
    const text = 'title\tqty\tunitMaterials\nWall\t2,5\t10\n"Floor\nlevel"\t1\t4,5\n';
    const lines = linesFromTable(P, 'doc1', text);
    expect(lines.map((l) => [l.rowJSON.title, l.rowJSON.qty, l.rowJSON.unitMaterials])).toEqual([['Wall', 2.5, 10], ['Floor\nlevel', 1, 4.5]]);
    expect(linesFromTable(P, 'doc1', 'only a header')).toEqual([]);
  });
});

import { normToUnitCosts } from '../../../kit8/pm/estimation/model/normCosting';
describe('a norm -> the unit costs of a position', () => {
  const priced = new Map<string, any>([
    ['91.01.01-035', { code: '91.01.01-035', price: 12.5, operatorPay: 3, resourceKind: 'machine' }],
    ['01.7.03.01-0001', { code: '01.7.03.01-0001', price: 2, resourceKind: 'material' }],
    ['08.1.02', { code: '08.1.02', price: 100, resourceKind: 'equipment' }],
    ['no.price', { code: 'no.price', price: null }],
  ]);
  it('labour from the typed rate, machines with the operators inside, materials, equipment; unpriced resources are listed', () => {
    const c = normToUnitCosts([
      { code: '1-100-38', qty: 2 }, { code: '2', qty: 1.6 }, { code: '91.01.01-035', qty: 1.6 }, { code: '01.7.03.01-0001', qty: 10 }, { code: '08.1.02', qty: 1 }, { code: 'no.price', qty: 1 }, { code: '99.9', qty: 1 },
    ], priced, { labourRate: 5 });
    expect(c).toEqual({ unitLabour: 10, unitMachines: 20, unitOperators: 4.8, unitMaterials: 20, unitOther: 0, unitEquipment: 100, missing: ['no.price', '99.9'] });
  });
  it('a norm with no resources is a position with zero costs', () => {
    expect(normToUnitCosts([], new Map(), { labourRate: 0 })).toMatchObject({ unitLabour: 0, missing: [] });
  });
});

import { applyTableRows, newLineRow as nlr } from '../../../kit8/pm/estimation/model/estimationDocumentModel';
describe('applyTableRows (the table of the sheet -> the lines of the document)', () => {
  const ctx = { projectGUID: 'p1', documentGUID: 'd1', taskGUID: 't1' };
  test('a deleted section takes everything below it; the lines that were not shown stay', () => {
    const sec = nlr('p1', 'd1', 'section', 'empty', 1, { title: 'S', taskGUID: 't1' });
    const pos = nlr('p1', 'd1', 'position', sec.rowGUID, 2, { taskGUID: 't1' });
    const other = nlr('p1', 'd1', 'position', 'empty', 3, { taskGUID: 't2' });
    const out = applyTableRows([sec, pos, other], [sec, pos], [], ctx);
    expect(out.map((l) => l.rowGUID)).toEqual([other.rowGUID]);
  });
  test('a duplicated row keeps the copied values and its task; a new row gets the task of the tree', () => {
    const a = nlr('p1', 'd1', 'position', 'empty', 1, { title: 'A', qty: 4, taskGUID: 't1' });
    const out = applyTableRows([a], [a], [a, { rowGUID: 'dup', rowParentGUID: 'empty', orderInList: 2, rowJSON: { ...a.rowJSON } }, { rowGUID: 'blank', orderInList: 3, rowJSON: {} }], ctx);
    expect(out).toHaveLength(3);
    expect(out.find((l) => l.rowGUID === 'dup')!.rowJSON).toMatchObject({ title: 'A', qty: 4, taskGUID: 't1', lineKind: 'position', documentGUID: 'd1' });
    expect(out.find((l) => l.rowGUID === 'blank')!.rowJSON).toMatchObject({ lineKind: 'position', taskGUID: 't1', qty: 1 });
    expect(out.find((l) => l.rowGUID === 'blank')!.rowOwnerGUID).toBe('p1');
  });
});
