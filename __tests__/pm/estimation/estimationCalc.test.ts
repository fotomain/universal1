import { addCost, calcDocument, combineCoefficients, contingencyCap, EMPTY_COST, inThreeCurrencies, positionCost, positionInputOf, quoteTotals, round2, summaryEstimate, SUMMARY_CHAPTERS, toThousands } from '../../../kit8/pm/estimation/model/estimationCalc';
import type { CalcLine } from '../../../kit8/pm/estimation/model/estimationCalc';

// the sample estimate of the documentation prototypes (illustrative numbers): 8 positions, overhead 90 % and profit 50 % of the payroll, index 8.74
const SAMPLE: [string, number, number, number, number, number, number][] = [
  // title, qty, labour, machines, operators (inside machines), materials, coef
  ['Excavation', 0.84, 0, 4815, 620.4, 0, 1],
  ['Hand trimming', 0.36, 1260, 0, 0, 0, 1.2],
  ['Backfilling', 0.41, 96.5, 1730, 205, 0, 1],
  ['Blinding concrete', 0.18, 3120, 1960, 340, 41250, 1],
  ['Strip foundations', 1.24, 14980, 6120, 1105, 187400, 1],
  ['Waterproofing', 5.2, 842, 96, 18, 7340, 1],
  ['Masonry', 148.04, 412, 66, 12.5, 3625, 1],
  ['Lintels', 0.62, 3880, 2410, 380, 9150, 1],
];
const DOC = { overheadPct: 90, profitPct: 50, index: 8.74, rates: { budget: 1, accounting: 1, consolidation: 1.1 } };
const lines = (): CalcLine[] => [
  { rowGUID: 's1', rowParentGUID: 'empty', orderInList: 1, rowJSON: { lineKind: 'section', title: 'Section 1' } },
  ...SAMPLE.map(([title, qty, unitLabour, unitMachines, unitOperators, unitMaterials, c], i): CalcLine => ({
    rowGUID: `p${i + 1}`, rowParentGUID: 's1', orderInList: i + 1,
    rowJSON: { lineKind: 'position', title, qty, unitLabour, unitMachines, unitOperators, unitMaterials, coefficients: c === 1 ? [] : [{ value: c }] },
  })),
];

describe('rounding and coefficients', () => {
  it('round2 rounds half up to kopecks and is safe for junk', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(NaN)).toBe(0);
    expect(toThousands(1234567.891)).toBe(1234.57);
  });
  it('coefficients combine additively with 7 decimals (or multiplicatively on request)', () => {
    expect(combineCoefficients([])).toBe(1);
    expect(combineCoefficients([{ value: 1.2 }, { value: 1.15 }])).toBeCloseTo(1.35, 7);
    expect(combineCoefficients([{ value: 1.2 }, { value: 1.15 }], 'multiplicative')).toBeCloseTo(1.38, 7);
    expect(combineCoefficients([{ value: 0 }, { value: 1.1 }])).toBeCloseTo(1.1, 7);
  });
});

describe('one position', () => {
  it('operators are inside machines, overhead and profit are percentages of the payroll, equipment has none', () => {
    const c = positionCost({ qty: 1.24, coef: 1, unitLabour: 14980, unitMachines: 6120, unitOperators: 1105, unitMaterials: 187400, unitOther: 0, unitEquipment: 1000, overheadPct: 90, profitPct: 50, index: 8.74 });
    expect(c.labour).toBe(18575.2);
    expect(c.machines).toBe(7588.8);
    expect(c.operators).toBe(1370.2);
    expect(c.direct).toBe(258540);
    expect(c.payroll).toBe(19945.4);
    expect(c.overheads).toBe(17950.86);
    expect(c.profit).toBe(9972.7);
    expect(c.equipment).toBe(1240);
    expect(c.base).toBe(287703.56);
    expect(c.current).toBe(round2(287703.56 * 8.74));
  });
  it('a line overrides the norms and the index of the document; missing numbers are zero', () => {
    const i = positionInputOf({ qty: 2, overheadPct: 10, index: 2 }, { overheadPct: 90, profitPct: 50, index: 8 });
    expect(i.overheadPct).toBe(10);
    expect(i.profitPct).toBe(50);
    expect(i.index).toBe(2);
    expect(positionCost(positionInputOf({}, null)).current).toBe(0);
  });
});

describe('a document', () => {
  const calc = calcDocument(lines(), DOC);
  it('matches the sample totals (line results rounded to kopecks, totals = sums of rounded lines)', () => {
    expect(calc.total.direct).toBe(932243.71);
    expect(calc.total.payroll).toBe(91713.46);
    expect(calc.total.overheads).toBe(82542.12);
    expect(calc.total.profit).toBe(45856.73);
    expect(calc.total.base).toBe(1060642.56);
    expect(calc.total.current).toBe(9270015.98);
  });
  it('a section holds the sum of its positions and the table order is the tree order', () => {
    expect(calc.byLine.s1).toEqual(calc.total);
    expect(calc.byLine.p5.direct).toBe(258540);
    expect(calc.order.map((o) => o.rowGUID)).toEqual(['s1', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
    expect(calc.order.map((o) => o.depth)).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 1]);
  });
  it('the total is stored in the budget, accounting and consolidation currency', () => {
    expect(calc.sums.sumForBudget).toBe(9270015.98);
    expect(calc.sums.sumForAccounting).toBe(9270015.98);
    expect(calc.sums.sumForConsolidation).toBe(round2(9270015.98 * 1.1));
    expect(inThreeCurrencies(100, { consolidation: 0.5 })).toEqual({ sumForBudget: 100, sumForAccounting: 100, sumForConsolidation: 50 });
  });
  it('an orphan line stays at the top and a cycle cannot loop', () => {
    const l: CalcLine[] = [
      { rowGUID: 'a', rowParentGUID: 'missing', rowJSON: { lineKind: 'position', qty: 1, unitMaterials: 10 } },
      { rowGUID: 'x', rowParentGUID: 'y', rowJSON: { lineKind: 'section' } },
      { rowGUID: 'y', rowParentGUID: 'x', rowJSON: { lineKind: 'section' } },
    ];
    const c = calcDocument(l, { index: 1 });
    expect(c.orphans).toContain('a');
    expect(c.total.direct).toBe(10);
    expect(c.order.length).toBeLessThanOrEqual(3);
  });
  it('an empty document is zero', () => {
    const c = calcDocument([], null);
    expect(c.total).toEqual(EMPTY_COST);
    expect(addCost(EMPTY_COST, EMPTY_COST)).toEqual(EMPTY_COST);
  });
});

describe('quick quote', () => {
  it('cost, profit, margin and price', () => {
    const q = quoteTotals([{ qty: 1, unitCost: 2500, markupPct: 25 }, { qty: 8, unitCost: 175, markupPct: 25 }, { qty: 250, unitCost: 9, markupPct: 30 }, { qty: 800, unitCost: 1.75, markupPct: 20 }]);
    expect(q.cost).toBe(7550);
    expect(q.price).toBe(9480);
    expect(q.profit).toBe(1930);
    expect(q.marginPct).toBe(20.4);
    expect(quoteTotals([]).price).toBe(0);
  });
});

describe('summary estimate (chapters 1 - 12)', () => {
  const rows = [
    { chapter: 1, title: '', construction: 1000, installation: 0, equipment: 0, other: 0 },
    { chapter: 2, title: '', construction: 100000, installation: 20000, equipment: 30000, other: 0 },
    { chapter: 8, title: '', construction: 3000, installation: 0, equipment: 0, other: 0 },
    { chapter: 9, title: '', construction: 0, installation: 0, equipment: 0, other: 5000 },
    { chapter: 12, title: '', construction: 0, installation: 0, equipment: 0, other: 6000 },
  ];
  const s = summaryEstimate(rows, { contingencyPct: 2, vatPct: 20 });
  it('has the twelve chapters and the cumulative totals after 1-7, 1-8, 1-9 and 1-12', () => {
    expect(s.chapters.map((c) => c.chapter)).toEqual(SUMMARY_CHAPTERS.map((c) => c.chapter));
    expect(s.chapters[1].cols.total).toBe(150);
    expect(s.after.to7.total).toBe(151);
    expect(s.after.to8.total).toBe(154);
    expect(s.after.to9.total).toBe(159);
    expect(s.after.to12.total).toBe(165);
  });
  it('the contingency is a percent of chapters 1-12 and the VAT of chapters 1-12 + the contingency, in thousands', () => {
    expect(s.contingency.total).toBe(3.3);
    expect(s.vat.total).toBe(33.66);
    expect(s.grand.total).toBe(201.96);
    expect(s.grand.other).toBe(round2(s.vat.other + (11 + 0.22) * 1));
  });
  it('warns when the contingency is above the cap of the kind of object', () => {
    expect(contingencyCap('nonProduction')).toBe(2);
    expect(contingencyCap('production')).toBe(3);
    expect(contingencyCap('unique')).toBe(10);
    expect(summaryEstimate(rows, { contingencyPct: 5, objectKind: 'production' }).warnings).toHaveLength(1);
    expect(summaryEstimate(rows, { contingencyPct: 3, objectKind: 'production' }).warnings).toHaveLength(0);
  });
});
