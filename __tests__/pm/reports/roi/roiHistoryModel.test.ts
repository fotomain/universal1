// The points and the chart data of Monitor03_ROIHistory (documentation/ROI_DOC.html section 7.3).
import { RoiHistoryRow, RoiMonthRow } from '../../../../kit8/pm/reports/roi/roiApi';
import { RoiMoney, zeroMoney } from '../../../../kit8/pm/reports/roi/roiModel';
import { cumulateMonthRows, roiMonthsBetween, ROI_MAX_FILLED_MONTHS, filterHistoryRows, pointsOfHistory, pointsOfMonthCurve, roiChartData, roiDaysBetween, roiSeriesSegments } from '../../../../kit8/pm/reports/roi/roiHistoryModel';
import { roiNiceTicks } from '../../../../kit8/pm/reports/monitor03/Monitor03Chart';

const NONE = { includeSaleVat: false, includePurchaseVat: false };
const m = (o: Partial<RoiMoney>): RoiMoney => ({ ...zeroMoney(), ...o });
const hist = (day: string, reason: string, o: Partial<RoiMoney>): RoiHistoryRow => ({ projectGUID: 'p1', day, reason, money: m(o) });

// the page: plan cost 5000 all the time, the plan revenue 5400 then 5100, then the invoices
const log: RoiHistoryRow[] = [
  hist('2026-10-01', 'history on', { costPlanNet: 5000, revenuePlanNet: 5400 }),
  hist('2026-10-09', 'plan', { costPlanNet: 5000, revenuePlanNet: 5100 }),
  hist('2026-10-14', 'vendor invoice', { costPlanNet: 5000, revenuePlanNet: 5100, costInvoicedNet: 900 }),
  hist('2026-10-20', 'customer invoice', { costPlanNet: 5000, revenuePlanNet: 5100, costInvoicedNet: 900, revenueInvoicedNet: 1200 }),
];

describe('the points', () => {
  it('"as seen": one point per row of the log, oldest first, with its reason and the ratios of the project\'s switches', () => {
    const pts = pointsOfHistory([...log].reverse(), NONE);
    expect(pts.map((p) => p.x)).toEqual(['2026-10-01', '2026-10-09', '2026-10-14', '2026-10-20']);
    expect(pts.map((p) => p.reason)).toEqual(['history on', 'plan', 'vendor invoice', 'customer invoice']);
    expect(Math.round((pts[0].line.roi1 as number) * 1000) / 1000).toBe(0.08);
    expect(Math.round((pts[1].line.roi1 as number) * 1000) / 1000).toBe(0.02);
    expect(pts[2].line.roi4).toBe(-1);                                   // 900 of cost, no customer invoice yet
    expect(Math.round((pts[3].line.roi4 as number) * 1000) / 1000).toBe(0.333);
  });
  it('the tax switches redraw the whole log (the rows hold the components)', () => {
    const withVat = pointsOfHistory([hist('2026-10-20', '', { costInvoicedNet: 900, costInvoicedVat: 180, revenueInvoicedNet: 1200, revenueInvoicedVat: 240 })], { includeSaleVat: true, includePurchaseVat: true });
    expect(withVat[0].line.billedRevenue).toBe(1440);
    expect(withVat[0].line.factCost).toBe(1080);
  });
  it('"business month": the rows are cumulative already; one point per month', () => {
    const rows: RoiMonthRow[] = [
      { projectGUID: 'p1', month: '2026-10-01', money: m({ costPlanNet: 1140, revenuePlanNet: 1500 }) },
      { projectGUID: 'p1', month: '2026-09-01', money: m({ costPlanNet: 140 }) },
    ];
    const pts = pointsOfMonthCurve(rows, NONE);
    expect(pts.map((p) => p.x)).toEqual(['2026-09-01', '2026-10-01']);
    expect(pts[0].line.roi1).toBe(-1);                                   // no revenue yet: -100 %
  });
});

describe('the chart data', () => {
  it('x = days since the first point (a real time axis), y = percent', () => {
    expect(roiDaysBetween('2026-10-01', '2026-10-20')).toBe(19);
    const d = roiChartData(pointsOfHistory(log, NONE), ['roi1', 'roi4']);
    expect(d.empty).toBe(false);
    expect(d.xMax).toBe(19);
    expect(d.series[0].points.map((p) => p.x)).toEqual([0, 8, 13, 19]);
    expect(d.series[0].points.map((p) => p.y)).toEqual([8, 2, 2, 2]);
  });
  it('a point without a ratio (no cost) is a GAP (null), never 0; ROI4 has no cost fact before the first vendor invoice', () => {
    const d = roiChartData(pointsOfHistory(log, NONE), ['roi4']);
    expect(d.series[0].points.map((p) => p.y)).toEqual([null, null, -100, 33.3]);
  });
  it('the y range always contains the zero line and every drawn value, with a margin', () => {
    const d = roiChartData(pointsOfHistory(log, NONE), ['roi1', 'roi2', 'roi3', 'roi4']);
    expect(d.yMin).toBeLessThan(-100);
    expect(d.yMax).toBeGreaterThan(8);
    expect(d.yMin).toBeLessThan(0);
    expect(d.yMax).toBeGreaterThan(0);
  });
  it('nothing: empty', () => {
    const d = roiChartData([], ['roi1']);
    expect(d.empty).toBe(true);
    expect(d.series[0].points).toEqual([]);
  });
  it('a step line goes horizontal to the next x, then vertical; a straight line joins the points; a gap breaks the line', () => {
    const pts = [{ x: 0, y: 10, index: 0 }, { x: 10, y: 30, index: 1 }, { x: 20, y: null, index: 2 }, { x: 30, y: 5, index: 3 }];
    expect(roiSeriesSegments(pts, true)).toEqual([[{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 30 }], [{ x: 30, y: 5 }]]);
    expect(roiSeriesSegments(pts, false)).toEqual([[{ x: 0, y: 10 }, { x: 10, y: 30 }], [{ x: 30, y: 5 }]]);
  });
  it('round ticks around zero', () => {
    const t = roiNiceTicks(-108, 14);
    expect(t).toContain(0);
    expect(t[0]).toBeGreaterThanOrEqual(-108);
    expect(t[t.length - 1]).toBeLessThanOrEqual(14);
  });
});

describe('the period', () => {
  const months: RoiMonthRow[] = [
    { projectGUID: 'p1', month: '2026-10-01', money: m({ costPlanNet: 1000, revenueInvoicedNet: 1200 }) },
    { projectGUID: 'p1', month: '2026-09-01', money: m({ costPlanNet: 4000 }) },
    { projectGUID: 'p1', month: '2026-11-01', money: m({ costPlanNet: 500 }) },
  ];
  it('cumulateMonthRows with fill: every month of a closed period is a row; no data before the first month, the totals stay after the last', () => {
    const filled = cumulateMonthRows(months, { from: '2026-07-01', to: '2026-12-31' }, true);
    expect(filled.map((r) => r.month)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01']);
    expect(filled.map((r) => r.money.costPlanNet)).toEqual([0, 0, 4000, 5000, 5500, 5500]);
    // an open period cannot be filled: the months with data only
    expect(cumulateMonthRows(months, { from: '2026-07-01', to: null }, true).map((r) => r.month)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
    // without fill nothing changes
    expect(cumulateMonthRows(months, { from: '2026-07-01', to: '2026-12-31' }).map((r) => r.month)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
  });
  it('roiMonthsBetween counts the months across a year end and is capped', () => {
    expect(roiMonthsBetween('2026-11-20', '2027-02-03')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01']);
    expect(roiMonthsBetween('2027-02-01', '2026-11-01')).toEqual([]);
    expect(roiMonthsBetween('2000-01-01', '2999-12-31')).toHaveLength(ROI_MAX_FILLED_MONTHS);
  });
  it('cumulateMonthRows sums the months from the first one (sorted), not from the start of the project', () => {
    expect(cumulateMonthRows(months).map((r) => [r.month, r.money.costPlanNet])).toEqual([['2026-09-01', 4000], ['2026-10-01', 5000], ['2026-11-01', 5500]]);
    expect(cumulateMonthRows(months, { from: '2026-10-15', to: null }).map((r) => [r.month, r.money.costPlanNet])).toEqual([['2026-10-01', 1000], ['2026-11-01', 1500]]);
    expect(cumulateMonthRows(months, { from: null, to: '2026-10-02' }).map((r) => r.month)).toEqual(['2026-09-01', '2026-10-01']);
    expect(cumulateMonthRows(months, { from: '2027-01-01', to: null })).toEqual([]);
  });
  it('the rows are not changed', () => {
    cumulateMonthRows(months);
    expect(months[0].money.costPlanNet).toBe(1000);
  });
  it('filterHistoryRows keeps the days in [from, to] inclusive, either end open', () => {
    expect(filterHistoryRows(log, { from: '2026-10-09', to: '2026-10-14' }).map((r) => r.day)).toEqual(['2026-10-09', '2026-10-14']);
    expect(filterHistoryRows(log, { from: '2026-10-15', to: null }).map((r) => r.day)).toEqual(['2026-10-20']);
    expect(filterHistoryRows(log).length).toBe(4);
  });
});
