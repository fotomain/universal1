// The strip above the table of Monitor01 (documentation/ROI_DOC.html section 7.1): the money of the month totals on the VAT basis of the screen.
import { RoiMonthRow } from '../../../../kit8/pm/reports/roi/roiApi';
import { zeroMoney } from '../../../../kit8/pm/reports/roi/roiModel';
import { roiStripIsEmpty, roiStripOf } from '../../../../kit8/pm/reports/roi/roiStripModel';

const row = (month: string, o: Record<string, number>): RoiMonthRow => ({ projectGUID: 'p1', month, money: { ...zeroMoney(), ...o } });
const months = [
  row('2026-09-01', { costPlanNet: 140 }),
  row('2026-10-01', { costPlanNet: 1000, costPlanVat: 200, costPlanVatInCost: 50, costInvoicedNet: 900, costInvoicedVat: 180, costInvoicedVatInCost: 0, revenueInvoicedNet: 1200, revenueInvoicedVat: 240 }),
];

describe('roiStripOf', () => {
  it('Cost basis (the default): net + the VAT that is cost; a customer invoice is net (its VAT is never cost)', () => {
    expect(roiStripOf(months, 'cost')).toEqual({ costPlan: 1190, vendorInvoiced: 900, customerInvoiced: 1200, months: 2 });
  });
  it('Net basis and With VAT basis', () => {
    expect(roiStripOf(months, 'net')).toMatchObject({ costPlan: 1140, vendorInvoiced: 900, customerInvoiced: 1200 });
    expect(roiStripOf(months, 'gross')).toMatchObject({ costPlan: 1340, vendorInvoiced: 1080, customerInvoiced: 1440 });
  });
  it('the period is by month', () => {
    expect(roiStripOf(months, 'net', { from: '2026-10-05', to: null })).toMatchObject({ costPlan: 1000, months: 1 });
    expect(roiStripOf(months, 'net', { from: null, to: '2026-09-30' })).toMatchObject({ costPlan: 140, customerInvoiced: 0 });
  });
  it('nothing is empty', () => {
    expect(roiStripIsEmpty(roiStripOf([], 'cost'))).toBe(true);
    expect(roiStripIsEmpty(roiStripOf(months, 'cost'))).toBe(false);
  });
});
