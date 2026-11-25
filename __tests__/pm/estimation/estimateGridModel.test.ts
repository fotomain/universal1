// The model of the estimate grid: the columns of a layout, one row per tree row (a task = its position, a stage = the sums below it), the text of a cell, the edits.
import {
  applyGridEdit, buildGridRows, editorBox, editorButtonSize, cellText, columnAtX, editSeed, fitText, gridColumns, isCellEditable, neighbourColumn, nextOption, parseGridInput, positionCountOf, removePositionOf, shareOf, singlePositionOf, wrapTitle,
  type CellContext,
} from '../../../kit8/pm/estimation/model/estimateGridModel';
import { calcDocument } from '../../../kit8/pm/estimation/model/estimationCalc';
import { newLineRow } from '../../../kit8/pm/estimation/model/estimationDocumentModel';
import { ESTIMATION_LAYOUTS, LAYOUT_COLUMNS } from '../../../kit8/pm/estimation/model/estimationLayouts';

const mk = (task: string | null, extra: Record<string, any> = {}, order = 10) => newLineRow('p', 'd', 'position', 'empty', order, { title: `L-${task}`, qty: 2, unitLabour: 100, ...(task ? { taskGUID: task } : {}), ...extra });
const children = { s: ['a', 'b'], b: ['c'] };
const kinds: Record<string, string> = { s: 'stage', a: 'task', b: 'stage', c: 'task', m: 'milestone' };
const input = (lines: any[], visible = ['s', 'a', 'b', 'c']) => ({ visible, childrenById: children, kindOf: (g: string) => kinds[g], lines, byLine: calcDocument(lines).byLine, doc: { rates: { budget: 2, accounting: 1, consolidation: 1 } } as any });
const ctx: CellContext = { sumKey: 'sumForBudget', area: 100, totalCurrent: 600 };

describe('gridColumns', () => {
  test('every layout has a description column and the columns in order, with x set and the width summed', () => {
    for (const l of ESTIMATION_LAYOUTS) {
      const { columns, contentWidth } = gridColumns(l.value);
      expect(columns.some((c) => c.key === 'title')).toBe(true);
      expect(columns[0].x).toBe(0);
      columns.slice(1).forEach((c, i) => expect(c.x).toBe(columns[i].x + columns[i].width));
      const last = columns[columns.length - 1];
      expect(contentWidth).toBe(last.x + last.width);
    }
  });
  test('the columns the user may hide are real columns of the layout; a hidden one is gone, the description never hides', () => {
    for (const l of ESTIMATION_LAYOUTS) {
      const keys = gridColumns(l.value).columns.map((c) => c.key);
      for (const c of LAYOUT_COLUMNS[l.value]) expect(keys).toContain(c.key);
    }
    const { columns } = gridColumns('simple', { hidden: new Set(['qty', 'title', 'unit']) });
    expect(columns.map((c) => c.key)).not.toContain('qty');
    expect(columns.map((c) => c.key)).not.toContain('unit');
    expect(columns.map((c) => c.key)).toContain('title');
  });
  test('the simple layout carries every calculation of the sheet; the shown-currency column is named with the currency; titles go through t', () => {
    const { columns } = gridColumns('simple', { currency: 'EUR', t: (s) => `T:${s}` });
    expect(columns.map((c) => c.key)).toEqual(['title', 'normCode', 'unit', 'qty', 'coefficient', 'unitLabour', 'unitMachines', 'unitOperators', 'unitMaterials', 'direct', 'current', 'sumShown']);
    expect(columns.find((c) => c.key === 'sumShown')!.title).toBe('T:In the view currency EUR');
    expect(columns[0].title).toBe('T:Description');
  });
  test('advanced has the three currencies and the two catalogs; quote has the price; trades the share', () => {
    const adv = gridColumns('advanced').columns;
    expect(adv.filter((c) => c.kind === 'sum').map((c) => c.sumKey)).toEqual(['sumForBudget', 'sumForAccounting', 'sumForConsolidation']);
    expect(adv.filter((c) => c.kind === 'catalog').map((c) => c.entity)).toEqual(['budgetItemReusable', 'businessUnitReusable']);
    expect(gridColumns('quote').columns.map((c) => c.kind)).toContain('price');
    expect(gridColumns('trades').columns.map((c) => c.kind)).toEqual(expect.arrayContaining(['perArea', 'share']));
  });
});

describe('buildGridRows', () => {
  const la = mk('a'), lc = mk('c', { unitLabour: 50 }), free = mk(null, { unitLabour: 999 });
  const rows = buildGridRows(input([la, lc, free]));

  test('ONE row per tree row, in the order of the tree', () => {
    expect(rows.map((r) => r.guid)).toEqual(['s', 'a', 'b', 'c']);
  });
  test('a leaf task carries its ONE position; a stage (also a stage inside a stage) is a summary with the sums below it', () => {
    expect(rows.map((r) => r.kind)).toEqual(['summary', 'task', 'summary', 'task']);
    expect(rows[1].line).toBe(la);
    expect(rows[3].line).toBe(lc);
    expect(rows[0].line).toBeNull();
    const cur = (i: number) => rows[i].cost.current;
    expect(cur(1)).toBe(200);
    expect(cur(3)).toBe(100);
    expect(cur(2)).toBe(cur(3)); // b has no own line
    expect(cur(0)).toBe(cur(1) + cur(3)); // the line with no task is in no row
    expect(rows.map((r) => r.positions)).toEqual([2, 1, 1, 1]);
  });
  test('the three currencies come from the rates of the document', () => {
    expect(rows[1].sums).toEqual({ sumForBudget: 400, sumForAccounting: 200, sumForConsolidation: 200 });
  });
  test('a task with several positions shows their sum and is read only; a milestone and a task with children are summaries', () => {
    const l1 = mk('a', {}, 10), l2 = mk('a', { qty: 1 }, 20);
    const r = buildGridRows(input([l1, l2], ['a']))[0];
    expect(r.multi).toBe(true);
    expect(r.line).toBeNull();
    expect(r.cost.current).toBe(300);
    expect(r.positions).toBe(2);
    expect(buildGridRows({ ...input([]), visible: ['m'], kindOf: (g) => kinds[g] })[0].kind).toBe('summary');
  });
  test('a cycle in the tree cannot loop', () => {
    const r = buildGridRows({ ...input([mk('x')]), visible: ['x', 'y'], childrenById: { x: ['y'], y: ['x'] }, kindOf: () => 'stage' });
    expect(r).toHaveLength(2);
  });
  test('the price of the quote layout adds the mark-up per line and sums up below a stage', () => {
    const q = mk('a', { markupPct: 10 }), q2 = mk('c', { markupPct: 0 });
    const r = buildGridRows(input([q, q2]));
    expect(r[1].price).toBe(220);
    expect(r[3].price).toBe(200);
    expect(r[0].price).toBe(420);
  });
});

describe('subtotals of a stage by unit', () => {
  const cols = Object.fromEntries(gridColumns('simple').columns.map((c) => [c.key, c]));
  const at = (lines: any[]) => buildGridRows(input(lines));
  test('every position below the stage counts in the same unit: the stage shows the unit and the sum of the quantities (also through a stage in a stage)', () => {
    const r = at([mk('a', { unit: 'm3', qty: 2 }), mk('c', { unit: 'm3', qty: 3.5 })]);
    expect(cellText(cols.unit, r[0], ctx)).toBe('m3');
    expect(cellText(cols.qty, r[0], ctx)).toBe('5.5');
    expect(cellText(cols.unit, r[2], ctx)).toBe('m3');
    expect(cellText(cols.qty, r[2], ctx)).toBe('3.5');
    // a task keeps showing its own position
    expect(cellText(cols.qty, r[1], ctx)).toBe('2');
  });
  test('different units, or a position without a unit, or no position: nothing is added up', () => {
    const mixed = at([mk('a', { unit: 'm3', qty: 2 }), mk('c', { unit: 'm2', qty: 3 })]);
    expect(cellText(cols.unit, mixed[0], ctx)).toBe('');
    expect(cellText(cols.qty, mixed[0], ctx)).toBe('');
    // the stage b has only c: one unit
    expect(cellText(cols.unit, mixed[2], ctx)).toBe('m2');
    const noUnit = at([mk('a', { unit: 'm3', qty: 2 }), mk('c', { qty: 3 })]);
    expect(cellText(cols.qty, noUnit[0], ctx)).toBe('');
    expect(cellText(cols.unit, at([])[0], ctx)).toBe('');
  });
  test('a task with several positions shows the subtotal too, and stays read only', () => {
    const r = buildGridRows(input([mk('a', { unit: 'kg', qty: 1 }), mk('a', { unit: 'kg', qty: 4 }, 20)], ['a']))[0];
    expect(cellText(cols.unit, r, ctx)).toBe('kg');
    expect(cellText(cols.qty, r, ctx)).toBe('5');
  });
});

describe('cellText', () => {
  const cols = Object.fromEntries(gridColumns('advanced').columns.map((c) => [c.key, c]));
  const quote = Object.fromEntries(gridColumns('quote').columns.map((c) => [c.key, c]));
  const trades = Object.fromEntries(gridColumns('trades').columns.map((c) => [c.key, c]));
  const la = mk('a', { unit: 'm3', normCode: '01-01', unitLabour: 5049.9477, budgetItemGUID: 'bi1', status: 'Open' });
  const rows = buildGridRows(input([la]));

  test('inputs show the stored value; a unit cost keeps its decimals; a stage shows no input value', () => {
    expect(cellText(cols.title, rows[1], ctx)).toBe('L-a');
    expect(cellText(cols.unit, rows[1], ctx)).toBe('m3');
    expect(cellText(cols.normCode, rows[1], ctx)).toBe('01-01');
    expect(cellText(cols.unitLabour, rows[1], ctx)).toBe('5,049.9477');
    expect(cellText(cols.qty, rows[1], ctx)).toBe('2');
    // a stage shows only the subtotal of unit and quantity (see 'subtotals of a stage by unit'), never an input value
    expect(cellText(cols.unitLabour, rows[0], ctx)).toBe('');
    expect(cellText(cols.title, rows[0], ctx)).toBe('');
    expect(cellText(cols.normCode, rows[0], ctx)).toBe('');
  });
  test('calculated cells show the money of the row; a stage shows the sum; zero is empty', () => {
    expect(cellText(cols['c-labour'], rows[1], ctx)).toBe('10,099.90');
    expect(cellText(cols['c-labour'], rows[0], ctx)).toBe('10,099.90');
    expect(cellText(cols['c-materials'], rows[1], ctx)).toBe('');
    expect(cellText(cols.current, rows[1], ctx)).toBe(cellText(cols.direct, rows[1], ctx));
  });
  test('the sum columns follow the currency of the view or their own currency', () => {
    expect(cellText(cols.sumForBudget, rows[1], ctx)).toBe('20,199.80');
    expect(cellText(cols.sumForAccounting, rows[1], ctx)).toBe('10,099.90');
    const shown = gridColumns('simple').columns.find((c) => c.key === 'sumShown')!;
    expect(cellText(shown, rows[1], { ...ctx, sumKey: 'sumForAccounting' })).toBe('10,099.90');
  });
  test('a catalog cell shows the name of the catalog element; quote price; trades per m2', () => {
    expect(cellText(cols.budgetItemGUID, rows[1], { ...ctx, nameOf: (e, g) => `${e}:${g}` })).toBe('budgetItemReusable:bi1');
    expect(cellText(cols.budgetItemGUID, rows[1], ctx)).toBe('');
    expect(cellText(quote.price, rows[1], ctx)).toBe('10,099.90');
    expect(cellText(quote.status, rows[1], ctx)).toBe('Open');
    expect(cellText(trades.perArea, rows[1], ctx)).toBe('101.00');
    expect(cellText(trades.perArea, rows[1], { ...ctx, area: 0 })).toBe('');
  });
  test('the share of a row in the document is bounded 0..1', () => {
    expect(shareOf({ ...rows[1], cost: { ...rows[1].cost, current: 300 } }, ctx)).toBe(0.5);
    expect(shareOf({ ...rows[1], cost: { ...rows[1].cost, current: 9999 } }, ctx)).toBe(1);
    expect(shareOf(rows[1], { ...ctx, totalCurrent: 0 })).toBe(0);
  });
  test('a task with several positions says how many in the description', () => {
    const r = buildGridRows(input([mk('a'), mk('a', {}, 20)], ['a']))[0];
    expect(cellText(cols.title, r, { ...ctx, t: (s) => s })).toBe('2 positions');
  });
});

describe('editing', () => {
  const col = (layout: any, key: string) => gridColumns(layout).columns.find((c) => c.key === key)!;
  const qty = col('simple', 'qty'), title = col('simple', 'title'), norm = col('simple', 'normCode'), direct = col('simple', 'direct');
  const rows = buildGridRows(input([mk('a')]));

  test('only a task row (one position, not a stage) takes input, in an input column, in a writable estimate', () => {
    expect(isCellEditable(qty, rows[1], false)).toBe(true);
    expect(isCellEditable(title, rows[1], false)).toBe(true);
    expect(isCellEditable(norm, rows[1], false)).toBe(true);
    expect(isCellEditable(direct, rows[1], false)).toBe(false);
    expect(isCellEditable(qty, rows[0], false)).toBe(false);
    expect(isCellEditable(qty, rows[1], true)).toBe(false);
    expect(isCellEditable(qty, undefined, false)).toBe(false);
    const multi = buildGridRows(input([mk('a'), mk('a', {}, 20)], ['a']))[0];
    expect(isCellEditable(qty, multi, false)).toBe(false);
    // a task with no position yet may be typed into (the position is made)
    expect(isCellEditable(qty, buildGridRows(input([]))[1], false)).toBe(true);
  });
  test('parse: a number accepts a comma and spaces, empty removes, a refused value says so', () => {
    expect(parseGridInput(qty, ' 1 234,5 ')).toEqual({ ok: true, value: 1234.5 });
    expect(parseGridInput(qty, '')).toEqual({ ok: true, value: undefined });
    expect(parseGridInput(qty, 'abc')).toEqual({ ok: false });
    expect(parseGridInput(qty, '-3')).toEqual({ ok: false });
    expect(parseGridInput(col('simple', 'coefficient'), '0')).toEqual({ ok: false });
    expect(parseGridInput(title, '  Wall ')).toEqual({ ok: true, value: 'Wall' });
  });
  test('typing into a task that has a position changes that line only', () => {
    const a = mk('a'), b = mk('c');
    const out = applyGridEdit([a, b], { projectGUID: 'p', documentGUID: 'd' }, 'a', qty, 7);
    expect(out[0].rowJSON.qty).toBe(7);
    expect(out[1]).toBe(b);
    expect(out[0].rowGUID).toBe(a.rowGUID);
  });
  test('an undefined value removes the key', () => {
    const out = applyGridEdit([mk('a', { unitMachines: 4 })], { projectGUID: 'p', documentGUID: 'd' }, 'a', col('simple', 'unitMachines'), undefined);
    expect('unitMachines' in out[0].rowJSON).toBe(false);
  });
  test('typing into a task with no position makes ONE position for it (quantity 1, the task given, the document and the project)', () => {
    const out = applyGridEdit([], { projectGUID: 'p', documentGUID: 'd' }, 't9', title, 'Slab');
    expect(out).toHaveLength(1);
    expect(out[0].rowJSON).toMatchObject({ taskGUID: 't9', lineKind: 'position', documentGUID: 'd', title: 'Slab', qty: 1 });
    expect(out[0].rowOwnerGUID).toBe('p');
    expect(positionCountOf(out, 't9')).toBe(1);
    // a second edit goes to the same line, never a second position
    const again = applyGridEdit(out, { projectGUID: 'p', documentGUID: 'd' }, 't9', qty, 3);
    expect(again).toHaveLength(1);
    expect(singlePositionOf(again, 't9')!.rowJSON.qty).toBe(3);
  });
  test('a task with several positions is not written to', () => {
    const lines = [mk('a'), mk('a', {}, 20)];
    expect(applyGridEdit(lines, { projectGUID: 'p', documentGUID: 'd' }, 'a', qty, 5)).toBe(lines);
  });
  test('the editor starts with the stored text; a select cell cycles', () => {
    expect(editSeed(title, rows[1])).toBe('L-a');
    expect(editSeed(qty, rows[0])).toBe('');
    const status = col('quote', 'status');
    expect(nextOption(status, '')).toBe('Open');
    expect(nextOption(status, 'Open')).toBe('Complete');
    expect(nextOption(status, 'Complete')).toBe('Open');
  });
  test('Remove the position takes the position of the task (and what is below it), nothing else', () => {
    const a = mk('a'), res = newLineRow('p', 'd', 'resource', a.rowGUID, 5, { title: 'res' }), b = mk('c');
    const out = removePositionOf([a, res, b], 'a');
    expect(out).toEqual([b]);
    expect(removePositionOf([b], 'zz')).toEqual([b]);
  });
});

describe('navigation and text', () => {
  const { columns } = gridColumns('simple');
  test('the column next to another stops at the edges; an unknown column goes to the first', () => {
    expect(neighbourColumn(columns, 'title', 1)).toBe('normCode');
    expect(neighbourColumn(columns, 'title', -1)).toBe('title');
    expect(neighbourColumn(columns, columns[columns.length - 1].key, 1)).toBe(columns[columns.length - 1].key);
    expect(neighbourColumn(columns, 'gone', 1)).toBe('title');
    expect(neighbourColumn([], 'x', 1)).toBeNull();
  });
  test('the column at a content x', () => {
    expect(columnAtX(columns, 5)!.key).toBe('title');
    expect(columnAtX(columns, columns[1].x)!.key).toBe('normCode');
    expect(columnAtX(columns, 1e9)).toBeNull();
  });
  const m = (s: string) => s.length * 10;
  test('text that does not fit is cut with an ellipsis', () => {
    expect(fitText('abc', 100, m)).toBe('abc');
    expect(fitText('abcdefghijkl', 60, m)).toBe('abcde…');
    expect(fitText('', 10, m)).toBe('');
  });
  test('a title is wrapped to at most two lines of the header', () => {
    expect(wrapTitle('Unit', 100, m)).toEqual(['Unit']);
    expect(wrapTitle('Total, current prices', 150, m)).toEqual(['Total, current', 'prices']);
    expect(wrapTitle('Total, current prices', 120, m)).toEqual(['Total,', 'current pri…']);
    expect(wrapTitle('Consolidation currency', 120, m).length).toBe(2);
    expect(wrapTitle('Averyveryverylongsingleword', 100, m)).toEqual(['Averyvery…']);
  });
});

describe('editorBox', () => {
  const { columns, contentWidth } = gridColumns('simple');
  const c = (k: string) => columns.find((x) => x.key === k)!;
  test('the editor is exactly the cell, also a number editor (its buttons shrink to fit; it never covers the next column)', () => {
    expect(editorBox(c('title'), contentWidth)).toEqual({ x: c('title').x, width: c('title').width });
    expect(editorBox(c('qty'), contentWidth)).toEqual({ x: c('qty').x, width: c('qty').width });
    expect(editorBox({ x: 950, width: 50, kind: 'number' }, 1000)).toEqual({ x: 950, width: 50 });
  });
});

describe('editorButtonSize', () => {
  // the three buttons (- + calculator) + 4 px of border + at least 40 px of digits must fit in the cell
  test('the buttons are 26 px in a wide cell and shrink in a narrow one; the row always fits the cell', () => {
    expect(editorButtonSize(300)).toBe(26);
    for (const w of [100, 110, 120, 130]) {
      const b = editorButtonSize(w);
      expect(b).toBeGreaterThanOrEqual(16);
      expect(b * 3 + 4 + 40).toBeLessThanOrEqual(w);
    }
  });
});
