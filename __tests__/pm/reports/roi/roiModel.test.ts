// The ROI rules (documentation/ROI_DOC.html sections 3, 4, 6): the fixture of the page, the tax switches, the ratio, sum-first-divide-last. The same numbers are in kit8/docker/tests/92_roi.sql.
import { ROI_MONEY_KEYS, RoiMoney, addMoney, formatRoi, formatRoiMoney, moneyOf, roiOfMoney, roiRatio, roiTone, sumMoney, zeroMoney } from '../../../../kit8/pm/reports/roi/roiModel';
import { roiTaxOf, roiValuesOf } from '../../../../kit8/pm/reports/roi/roiSettings';

const NONE = { includeSaleVat: false, includePurchaseVat: false };
/** the fixture: plan cost 1000 (VAT 200), plan revenue 1500 (VAT 300), fact input 1100 (VAT 220), vendor invoices 900 (VAT 180), customer invoices 1200 (VAT 240); all the VAT recoverable */
const fixture = (): RoiMoney => ({
  ...zeroMoney(),
  costPlanNet: 1000, costPlanVat: 200,
  revenuePlanNet: 1500, revenuePlanVat: 300,
  revenueUsedNet: 1100, revenueUsedVat: 220,
  costInvoicedNet: 900, costInvoicedVat: 180,
  revenueInvoicedNet: 1200, revenueInvoicedVat: 240,
});
const pct = (v: number | null) => (v === null ? null : Math.round(v * 10000) / 10000);

describe('the four ROI kinds of the fixture (tax switches OFF)', () => {
  const l = roiOfMoney(fixture(), NONE);
  it('the five values: recoverable VAT is no cost, so the cost is the net', () => {
    expect(l).toMatchObject({ planCost: 1000, factCost: 900, planRevenue: 1500, usedRevenue: 1100, billedRevenue: 1200 });
  });
  it('ROI1 plan-plan 50 %, ROI2 plan-fact input 10 %, ROI3 plan-invoiced 20 %, ROI4 fact-fact 33.3 %', () => {
    expect([pct(l.roi1), pct(l.roi2), pct(l.roi3), pct(l.roi4)]).toEqual([0.5, 0.1, 0.2, 0.3333]);
  });
});

describe('the tax switches choose components, nothing else', () => {
  it('sale VAT only: revenue + VAT -> 80 % / 32 % / 44 % / 60 %', () => {
    const l = roiOfMoney(fixture(), { includeSaleVat: true, includePurchaseVat: false });
    expect([pct(l.roi1), pct(l.roi2), pct(l.roi3), pct(l.roi4)]).toEqual([0.8, 0.32, 0.44, 0.6]);
  });
  it('purchase VAT only: cost + ALL the VAT -> 25 % / -8.3 % / 0 % / 11.1 %', () => {
    const l = roiOfMoney(fixture(), { includeSaleVat: false, includePurchaseVat: true });
    expect([pct(l.roi1), pct(l.roi2), pct(l.roi3), pct(l.roi4)]).toEqual([0.25, -0.0833, 0, 0.1111]);
  });
  it('both: equal rates on both sides -> the ratio stays, the profit grows', () => {
    const l = roiOfMoney(fixture(), { includeSaleVat: true, includePurchaseVat: true });
    expect([pct(l.roi1), pct(l.roi3), pct(l.roi4)]).toEqual([0.5, 0.2, 0.3333]);
    expect(l.billedRevenue - l.factCost).toBeGreaterThan(1200 - 900);
  });
  it('the VAT that is cost (not recoverable) is in the cost even when the purchase VAT is not included; a revenue VAT is never cost', () => {
    const m = { ...zeroMoney(), costPlanNet: 1000, costPlanVat: 200, costPlanVatInCost: 50, revenueInvoicedNet: 1200, revenueInvoicedVat: 240 };
    expect(roiOfMoney(m, NONE).planCost).toBe(1050);
    expect(roiOfMoney(m, { includeSaleVat: false, includePurchaseVat: true }).planCost).toBe(1200);
    expect(roiOfMoney(m, { includeSaleVat: true, includePurchaseVat: false }).billedRevenue).toBe(1440);
  });
});

describe('cost that is never invoiced (ROI4)', () => {
  it('the cost fact is the vendor invoices PLUS the own cost (fact input of the lines without a vendor)', () => {
    const m = { ...fixture(), costOwnNet: 100 };
    expect(roiOfMoney(m, NONE).factCost).toBe(1000);
    expect(pct(roiOfMoney(m, NONE).roi4)).toBe(0.2);
  });
  it('the own cost has its own VAT components, chosen by the same switches', () => {
    const m = { ...zeroMoney(), costOwnNet: 100, costOwnVat: 20, costOwnVatInCost: 5, revenueInvoicedNet: 200 };
    expect(roiOfMoney(m, NONE).factCost).toBe(105);
    expect(roiOfMoney(m, { includeSaleVat: false, includePurchaseVat: true }).factCost).toBe(120);
  });
});

describe('no cost = no value; money is added first, the ratio is taken last', () => {
  it('a ratio without cost is null, never 0 and never infinity; no revenue is -100 %', () => {
    expect(roiRatio(1500, 0)).toBeNull();
    expect(roiRatio(0, 1000)).toBe(-1);
    const l = roiOfMoney(zeroMoney(), NONE);
    expect([l.roi1, l.roi2, l.roi3, l.roi4]).toEqual([null, null, null, null]);
  });
  it('the ROI of two tasks is the ROI of the SUM, not the average of the two ratios', () => {
    const a: RoiMoney = { ...zeroMoney(), costPlanNet: 100, revenuePlanNet: 500 };     // +400 %
    const b: RoiMoney = { ...zeroMoney(), costPlanNet: 4000, revenuePlanNet: 3600 };   // -10 %
    const both = roiOfMoney(addMoney(a, b), NONE).roi1 as number;
    expect(both).toBe(0);                                    // (500 + 3600 - 4100) / 4100
    const average = ((roiOfMoney(a, NONE).roi1 as number) + (roiOfMoney(b, NONE).roi1 as number)) / 2;
    expect(average).toBeCloseTo(1.95, 5);                    // what an average of ratios would wrongly show: +195 %
  });
  it('sumMoney adds every component', () => {
    const s = sumMoney([fixture(), fixture()]);
    for (const k of ROI_MONEY_KEYS) expect(s[k]).toBe(fixture()[k] * 2);
  });
});

describe('moneyOf reads a database row', () => {
  it('numbers, numeric text, null and missing', () => {
    const m = moneyOf({ costPlanNet: '1000.50', revenuePlanNet: 3, costOwnNet: null } as any);
    expect(m.costPlanNet).toBe(1000.5);
    expect(m.revenuePlanNet).toBe(3);
    expect(m.costOwnNet).toBe(0);
    expect(m.revenueInvoicedNet).toBe(0);
    expect(moneyOf(null)).toEqual(zeroMoney());
  });
});

describe('formats', () => {
  it('percent with one decimal, null as "-", money with spaces', () => {
    expect(formatRoi(0.5)).toBe('50.0 %');
    expect(formatRoi(-0.0833)).toBe('-8.3 %');
    expect(formatRoi(null)).toBe('-');
    expect(formatRoiMoney(1234567.5)).toBe('1 234 567.50');
    expect(formatRoiMoney(-1000)).toBe('-1 000.00');
  });
  it('the tone: >= 0 positive, < 0 negative, null none (never red)', () => {
    expect([roiTone(0), roiTone(0.1), roiTone(-0.1), roiTone(null)]).toEqual(['positive', 'positive', 'negative', 'none']);
  });
});

describe('the project switches (a missing key is OFF)', () => {
  it('roiValuesOf: every key false while never saved', () => {
    expect(roiValuesOf(null)).toEqual({ roiForTasksFunctionalityEnabled: false, roiHistoryFunctionalityEnabled: false, projectROIIncludeAllTaxes: false, projectROIIncludeSaleVAT: false, projectROIIncludePurchaseVAT: false });
    expect(roiValuesOf({ projectROIIncludeSaleVAT: 'yes' as any }).projectROIIncludeSaleVAT).toBe(false);
  });
  it('the master turns both VAT switches on', () => {
    expect(roiTaxOf({})).toEqual({ includeSaleVat: false, includePurchaseVat: false });
    expect(roiTaxOf({ projectROIIncludeAllTaxes: true })).toEqual({ includeSaleVat: true, includePurchaseVat: true });
    expect(roiTaxOf({ projectROIIncludeSaleVAT: true })).toEqual({ includeSaleVat: true, includePurchaseVat: false });
    expect(roiTaxOf({ projectROIIncludePurchaseVAT: true })).toEqual({ includeSaleVat: false, includePurchaseVat: true });
  });
});
