// The help for the CFO behind the four layout buttons: complete, in the same terms as the sheet, and its worked examples are CALCULATED by the sheet's own functions.
import { layoutHelp, EXAMPLE_POSITION } from '../../../kit8/pm/estimation/model/layoutHelpModel';
import { positionCost } from '../../../kit8/pm/estimation/model/estimationCalc';

const LAYOUTS = ['simple', 'advanced', 'quote', 'trades'] as const;
const text = (l: typeof LAYOUTS[number]) => JSON.stringify(layoutHelp(l));
const numbers = (l: typeof LAYOUTS[number]) => layoutHelp(l).sections.flatMap((s) => s.blocks).filter((b: any) => b.type === 'numbers') as any[];

test('every layout button has a help with what it is, when a CFO uses it, the columns, how the numbers are made, what to watch and the common rules', () => {
  for (const l of LAYOUTS) {
    const titles = layoutHelp(l).sections.map((s) => s.title);
    expect(titles).toEqual(expect.arrayContaining(['What it is', 'When a CFO uses it', 'How the numbers are made', 'What to watch', 'Rules common to all four layouts']));
    expect(titles.some((t) => /columns/i.test(t))).toBe(true);
    expect(layoutHelp(l).heading.length).toBeGreaterThan(3);
    expect(numbers(l).length).toBeGreaterThan(0);
  }
  // the heading is the label of the button
  expect(LAYOUTS.map((l) => layoutHelp(l).heading)).toEqual(['Estimate sheet', 'Advanced (resource matrix)', 'Quick quote', 'Trade breakdown']);
});

test('the worked example of the estimate sheet and of the matrix is calculated by positionCost, never typed', () => {
  const c = positionCost(EXAMPLE_POSITION);
  for (const l of ['simple', 'advanced'] as const) {
    const rows = numbers(l)[0].rows as [string, string][];
    const last = rows[rows.length - 1];
    expect(last[1]).toBe(c.current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    expect(rows.find((r) => r[0].startsWith('Direct costs'))![1]).toBe(c.direct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }
  // the numbers of the example themselves: 100 × (5 + 20 + 10) = 3 500 direct; payroll 100 × (5 + 4) = 900; ×80 % = 720 and ×50 % = 450; + equipment 600 = 5 270 base; × 5 = 26 350
  expect(c).toMatchObject({ direct: 3500, payroll: 900, overheads: 720, profit: 450, equipment: 600, base: 5270, current: 26350 });
});

test('the quote help: price = cost × (1 + mark-up) and it warns that the mark-up is on cost, not on price', () => {
  const rows = numbers('quote')[0].rows as [string, string][];
  expect(rows.map((r) => r[1])).toEqual(['300.00', '75.00', '375.00']);
  expect(text('quote')).toContain('25 of 125');
});

test('the trade help explains per m² (needs the area) and the share of the whole', () => {
  const rows = numbers('trades')[0].rows as [string, string][];
  expect(rows[0][1]).toBe('5,000.00');
  expect(rows[1][1]).toBe('50.00');
  expect(rows[2][1]).toBe('50.00 %');
  expect(text('trades')).toContain('AREA');
});

test('every column the layout lets the user hide is described in its help', () => {
  const must: Record<string, string[]> = { simple: ['Coef.', 'Labour / unit', 'Machines / unit', 'Materials / unit'], advanced: ['Index', 'Budget item', 'Takeoff ref.', 'Equipment'], quote: ['Mark-up, %', 'Status', 'Cost per unit'], trades: ['Per m2', 'Share'] };
  for (const l of LAYOUTS) for (const m of must[l]) expect(text(l)).toContain(m);
});
