import { calcDocument } from '../../../kit8/pm/estimation/model/estimationCalc';
import { diffRows, estimateFromTable, exampleDocument, inputTemplateCsv, newDocumentRow, newLineRow, recalcLines, subtreeGUIDs } from '../../../kit8/pm/estimation/model/estimationDocumentModel';

const P = '11111111-1111-1111-1111-111111111111';

describe('example documents', () => {
  it('the estimate sheet example gives the totals of the documentation (rounded lines)', () => {
    const { doc, lines, tasks } = exampleDocument(P, 'estimateSheet');
    expect(doc.rowJSON).toMatchObject({ docKind: 'local', overheadPct: 90, profitPct: 50, index: 8.74 });
    // the structure is the TASK TREE: a stage per section, a task per position, no section lines
    expect(lines.filter((l) => l.rowJSON.lineKind === 'section')).toHaveLength(0);
    expect(lines.filter((l) => l.rowJSON.lineKind === 'position')).toHaveLength(8);
    expect(tasks.filter((t) => t.kind === 'stage').map((t) => t.name)).toEqual(['Section 1. Earthworks', 'Section 2. Foundations', 'Section 3. Superstructure walls']);
    expect(tasks.filter((t) => t.kind === 'task')).toHaveLength(8);
    // every position stands on a task of its own, under its stage
    const byGUID = new Map(tasks.map((t) => [t.rowGUID, t]));
    expect(new Set(lines.map((l) => l.rowJSON.taskGUID)).size).toBe(8);
    expect(lines.every((l) => byGUID.get(l.rowJSON.taskGUID!)?.kind === 'task' && byGUID.get(byGUID.get(l.rowJSON.taskGUID!)!.parentGUID!)?.kind === 'stage')).toBe(true);
    // a plan lists a parent before its children
    expect(tasks.every((t, i) => !t.parentGUID || tasks.findIndex((x) => x.rowGUID === t.parentGUID) < i)).toBe(true);
    const calc = calcDocument(lines, doc.rowJSON);
    expect(calc.total.direct).toBe(932243.71);
    expect(calc.total.current).toBe(9270015.98);
    expect(lines.every((l) => l.rowOwnerGUID === P && l.rowJSON.documentGUID === doc.rowGUID)).toBe(true);
  });
  it('the quick quote and the trade breakdown examples are documents of their own kind with their lines', () => {
    const q = exampleDocument(P, 'quickQuote');
    expect(q.doc.rowJSON.docKind).toBe('bid');
    expect(q.lines).toHaveLength(8);
    expect(q.tasks).toHaveLength(8); // a quote is a flat list: one task per job, directly under the project
    expect(q.tasks.every((t) => t.kind === 'task' && t.parentGUID === null)).toBe(true);
    expect(q.lines[0].rowJSON).toMatchObject({ category: 'Plans and permitting', markupPct: 25, status: 'Complete' });
    const t = exampleDocument(P, 'tradeBreakdown');
    expect(t.tasks.filter((x) => x.kind === 'stage')).toHaveLength(9);
    expect(t.lines.every((l) => l.rowJSON.taskGUID)).toBe(true);
    expect(calcDocument(t.lines, t.doc.rowJSON).total.direct).toBe(103662);
  });
});

describe('recalcLines', () => {
  const { doc, lines } = exampleDocument(P, 'estimateSheet');
  const rated = { ...doc.rowJSON, rates: { budget: 1, accounting: 1, consolidation: 1.1 } };
  const { lines: out, calc } = recalcLines(lines, rated);
  it('stores the total of every position in the budget, accounting and consolidation currency (a section line of an older document too)', () => {
    const pos = out.find((l) => l.rowJSON.lineKind === 'position')!;
    expect(pos.rowJSON.sumForAccounting).toBe(calc.byLine[pos.rowGUID].current);
    expect(pos.rowJSON.sumForConsolidation).toBe(Math.round(calc.byLine[pos.rowGUID].current * 1.1 * 100) / 100);
    const oldSec = newLineRow(P, 'd', 'section', 'empty', 10, { title: 'Old section' });
    const oldPos = newLineRow(P, 'd', 'position', oldSec.rowGUID, 20, { title: 'P', qty: 1, unitMaterials: 100 });
    const old = recalcLines([oldSec, oldPos], rated);
    expect(old.lines[0].rowJSON.sumForBudget).toBe(old.calc.byLine[oldSec.rowGUID].current);
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
  it('the template is a CSV with a byte order mark whose rows read back as the same positions, on tasks under stages', () => {
    const csv = inputTemplateCsv(P);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split('\r\n')[0].slice(1)).toBe('section,normCode,title,unit,qty,coefficient,unitLabour,unitMachines,unitOperators,unitMaterials,unitOther,unitEquipment,budgetItem,businessUnit');
    // the column `section` is the stage of the task
    expect(csv.split('\r\n')[1]).toMatch(/^Section 1\. Earthworks,/);
    const { lines, tasks } = estimateFromTable(P, 'doc1', csv);
    expect(tasks.filter((t) => t.kind === 'stage').map((t) => t.name)).toEqual(['Section 1. Earthworks', 'Section 2. Foundations', 'Section 3. Superstructure walls']);
    expect(lines.filter((l) => l.rowJSON.lineKind === 'position')).toHaveLength(8);
    expect(lines.some((l) => l.rowJSON.lineKind === 'section')).toBe(false);
    const stageOf = new Map(tasks.map((t) => [t.rowGUID, t.parentGUID]));
    expect(lines.every((l) => !!stageOf.get(l.rowJSON.taskGUID!))).toBe(true);
    const calc = calcDocument(lines, { overheadPct: 90, profitPct: 50, index: 8.74 });
    expect(calc.total.current).toBe(9270015.98);
  });
  it('an Excel paste (tab separated, decimal comma, quoted cell with a line break) is read too: a task per row, directly under the project without a section; junk gives nothing', () => {
    const text = 'title\tqty\tunitMaterials\nWall\t2,5\t10\n"Floor\nlevel"\t1\t4,5\n';
    const { lines, tasks } = estimateFromTable(P, 'doc1', text);
    expect(lines.map((l) => [l.rowJSON.title, l.rowJSON.qty, l.rowJSON.unitMaterials])).toEqual([['Wall', 2.5, 10], ['Floor\nlevel', 1, 4.5]]);
    expect(tasks.map((t) => [t.kind, t.parentGUID, t.name])).toEqual([['task', null, 'Wall'], ['task', null, 'Floor\nlevel']]);
    expect(lines.map((l) => l.rowJSON.taskGUID)).toEqual(tasks.map((t) => t.rowGUID));
    expect(estimateFromTable(P, 'doc1', 'only a header')).toEqual({ lines: [], tasks: [] });
  });
  it('a row joins the stage of the project that has its name (case does not matter); every other new name makes ONE stage; a row with no description is named after its norm', () => {
    const text = 'section,normCode,title,qty\nFoundations,N-1,Slab,1\nfoundations,N-2,,2\nRoof,N-3,Tiles,3\nRoof,,,4\n';
    const { lines, tasks } = estimateFromTable(P, 'doc1', text, { existingStages: new Map([['Foundations', 'stage-existing']]) });
    expect(tasks.filter((t) => t.kind === 'stage').map((t) => t.name)).toEqual(['Roof']); // Foundations exists: no second one
    expect(tasks.filter((t) => t.kind === 'task').map((t) => [t.name, t.parentGUID === 'stage-existing' ? 'existing' : 'new'])).toEqual([['Slab', 'existing'], ['N-2', 'existing'], ['Tiles', 'new'], ['Position 4', 'new']]);
    expect(lines).toHaveLength(4);
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
