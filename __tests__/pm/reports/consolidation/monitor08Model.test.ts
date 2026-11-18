// Monitor08 Consolidation: the lines of the table from the rows of consolidation_report (kit8/pm/reports/consolidation/monitor08Model.ts)
import { buildMonitor08Lines, monitor08BasisText, monitor08Footer, parseConsolidationReportRow, type ConsolidationReportRow } from '../../../../kit8/pm/reports/consolidation/monitor08Model';

const row = (o: Partial<ConsolidationReportRow>): ConsolidationReportRow => ({
  project: 'pa', projectName: 'A', month: null, kind: 'used', side: 'purchase', qty: 1, amount: 0, net: 0, vat: 0, vatInCost: 0, budgetCurrency: 'EUR', budgetNet: 0, budgetVat: 0, budgetVatInCost: 0, currency: 'EUR', ...o,
});
// the golden example of the document: A (EUR) 5 000 used, B (USD) 10 000 used = 8 000 EUR and 4 000 USD sold = 3 200 EUR
const rows = [
  row({ project: 'pa', projectName: 'A', kind: 'used', amount: 5050, net: 5000, vat: 1050, vatInCost: 50, budgetNet: 5000, budgetVat: 1050, budgetVatInCost: 50 }),
  row({ project: 'pb', projectName: 'B', kind: 'used', amount: 8080, net: 8000, vat: 1680, vatInCost: 80, budgetCurrency: 'USD', budgetNet: 10000, budgetVat: 2100, budgetVatInCost: 100 }),
  row({ project: 'pb', projectName: 'B', kind: 'sold', side: 'sale', amount: 3200, net: 3200, vat: 672, budgetCurrency: 'USD', budgetNet: 4000, budgetVat: 840 }),
  row({ project: 'pb', projectName: 'B', kind: 'used', side: 'sale', amount: 999 }), // the revenue of a fact input: no column
];

describe('Monitor08 lines', () => {
  it('consolidation basis: the amounts of the database, one currency, the footer adds them', () => {
    const lines = buildMonitor08Lines(rows, 'consolidation', 'cost');
    expect(lines.map((l) => [l.projectName, l.currency, l.amounts.used, l.amounts.customerInvoice])).toEqual([['A', 'EUR', 5050, 0], ['B', 'EUR', 8080, 3200]]);
    const f = monitor08Footer(lines);
    expect(f.currency).toBe('EUR');
    expect(f.amounts!.used).toBe(13130);
    expect(f.amounts!.customerInvoice).toBe(3200);
  });
  it('project basis: each project in its own budget currency on the VAT basis; different currencies are NOT added', () => {
    const net = buildMonitor08Lines(rows, 'project', 'net');
    expect(net.map((l) => [l.currency, l.amounts.used])).toEqual([['EUR', 5000], ['USD', 10000]]);
    const gross = buildMonitor08Lines(rows, 'project', 'gross');
    expect(gross.map((l) => l.amounts.used)).toEqual([6050, 12100]);
    const f = monitor08Footer(net);
    expect(f.currency).toBeNull();
    expect(f.amounts).toBeNull();
    expect(f.mixed).toEqual(['EUR', 'USD']);
  });
  it('one project in the project basis IS added (one currency)', () => {
    const f = monitor08Footer(buildMonitor08Lines(rows.filter((r) => r.project === 'pb'), 'project', 'cost'));
    expect(f.currency).toBe('USD');
    expect(f.amounts!.used).toBe(10100);
  });
  it('by month: a line per project and month, sorted by name then month', () => {
    const m = [row({ month: '2030-02-01', amount: 2 }), row({ month: '2030-01-01', amount: 1 }), row({ project: 'pb', projectName: 'B', month: '2030-01-01', amount: 5 })];
    expect(buildMonitor08Lines(m, 'consolidation', 'cost').map((l) => [l.projectName, l.month, l.amounts.used])).toEqual([['A', '2030-01-01', 1], ['A', '2030-02-01', 2], ['B', '2030-01-01', 5]]);
  });
  it('an empty report has no currency and zero amounts', () => {
    const f = monitor08Footer([]);
    expect(f.currency).toBeNull();
    expect(f.amounts!.plan).toBe(0);
  });
});

describe('the rows of the database and the header', () => {
  it('parses the snake case names and the strings of numeric columns', () => {
    const r = parseConsolidationReportRow({ o_project: 'p', o_project_name: 'P', o_month: '2030-01-01', o_kind: 'plan', o_side: 'sale', o_qty: '2', o_amount: '10.50', o_net: 10, o_vat: null, o_vat_in_cost: 0, o_budget_currency: 'usd', o_budget_net: '9', o_currency: 'EUR' });
    expect(r).toMatchObject({ project: 'p', projectName: 'P', month: '2030-01-01', kind: 'plan', side: 'sale', qty: 2, amount: 10.5, vat: 0 });
  });
  it('says what the numbers are', () => {
    expect(monitor08BasisText('consolidation', 'EUR', 'VAT: purchase without, sale without', 'Cost')).toBe('Amounts in EUR (consolidation) · VAT: purchase without, sale without (set by the organization)');
    expect(monitor08BasisText('project', 'EUR', '', 'Net of VAT')).toContain('budget currency of each project');
  });
});
