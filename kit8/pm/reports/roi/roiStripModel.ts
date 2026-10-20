// roiStripModel - the numbers of the strip above the table of Monitor01 (documentation/ROI_DOC.html section 7.1): the money of the project(s) for the period from the MONTH TOTALS, on the VAT basis of the screen.
// Pure. These are the money columns of Monitor01 itself: Budget (the cost plan), Vendor Invoice Amount, Customer Invoice Amount - the same movements, so the strip and the table agree.
import { amountOfVatBasis, VatBasis, VAT_BASIS_DEFAULT } from '../../vat/vatBasis';
import type { RoiMonthRow } from './roiApi';
import { RoiMoney, sumMoney } from './roiModel';
import { roiMonthInPeriod } from './roiReportModel';

export interface RoiStrip { costPlan: number; vendorInvoiced: number; customerInvoiced: number; months: number }

export function roiStripOf(months: readonly RoiMonthRow[], basis: VatBasis = VAT_BASIS_DEFAULT, period: { from: string | null; to: string | null } = { from: null, to: null }): RoiStrip {
  const inPeriod = months.filter((m) => roiMonthInPeriod(m.month, period.from, period.to));
  const m: RoiMoney = sumMoney(inPeriod.map((x) => x.money));
  return {
    costPlan: amountOfVatBasis(m.costPlanNet, m.costPlanVat, m.costPlanVatInCost, basis),
    vendorInvoiced: amountOfVatBasis(m.costInvoicedNet, m.costInvoicedVat, m.costInvoicedVatInCost, basis),
    // the VAT of a customer invoice is never cost: its "in cost" part is 0
    customerInvoiced: amountOfVatBasis(m.revenueInvoicedNet, m.revenueInvoicedVat, 0, basis),
    months: new Set(inPeriod.map((x) => x.month)).size,
  };
}

export const roiStripIsEmpty = (s: RoiStrip): boolean => s.costPlan === 0 && s.vendorInvoiced === 0 && s.customerInvoiced === 0;
