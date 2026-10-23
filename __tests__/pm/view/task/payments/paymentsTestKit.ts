// Shared fixtures of the payment plan tests (the name ends with TestKit: jest does not run it as a test).
import { buildRateBook } from '../../../../../kit8/catalog/currency/exchange/currencyConvert';
import { rateKeyOf } from '../../../../../kit8/catalog/currency/exchange/currencyExchangeModel';
import { fxProjectOf } from '../../../../../kit8/pm/view/task/finances/taskLineFx';
import { emptyTaskLineCatalogs, type TaskLineCatalogData } from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import type { PaymentComputeContext } from '../../../../../kit8/pm/view/task/payments/paymentPlanCompute';
import type { PaymentTaskDays } from '../../../../../kit8/pm/view/task/payments/paymentPlanDates';

export const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any, orderInList = 0) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON });
const cur = (guid: string, code: string) => ({ rowGUID: guid, rowJSON: { currencyCode: code, decimalDigits: 2 } });
const rate = (owner: string, day: string, ratio: number, rateType?: string) => ({ rowGUID: `${owner}-${day}-${rateType}`, rowOwnerGUID: owner, rowParentGUID: rateKeyOf(day, rateType), rowJSON: { startingDate: day, currencyRatio: ratio, rateType: rateType ?? 'Default' } });

/** the task: 10 days, 2026-10-01 .. 2026-10-10 */
export const DAYS: PaymentTaskDays = { start: '2026-10-01', end: '2026-10-10' };

export const project = fxProjectOf({ currencyForContract: 'USD', currencyForAccounting: 'EUR', currencyForBudget: 'GBP' });
const currencies = [cur('c-eur', 'EUR'), cur('c-usd', 'USD'), cur('c-gbp', 'GBP')];
const rates = [
  rate('c-usd', '2026-01-02', 1.05), rate('c-usd', '2026-10-05', 1.25), rate('c-gbp', '2026-01-02', 0.85),
  rate('c-usd', '2026-01-01', 1.2, 'Budget'), rate('c-gbp', '2026-01-01', 0.9, 'Budget'),
];
export const fxContext = () => ({ book: buildRateBook(currencies, rates), project });

/** contracts, partners, persons and budget items of the fixtures */
export function paymentData(): TaskLineCatalogData {
  const d = emptyTaskLineCatalogs();
  d.budgetItem = [
    row('bi_out', 'budgetItemCatalog', 'f1', { title: 'Vendor payments', managementGenusItem: 'outboundPaymentGenus' }),
    row('bi_out2', 'budgetItemCatalog', 'f1', { title: 'Salary payments', managementGenusItem: 'outboundPaymentGenus' }),
    row('bi_in', 'budgetItemCatalog', 'f1', { title: 'Customer receipts', managementGenusItem: 'inboundPaymentGenus' }),
    row('bi_time', 'budgetItemCatalog', 'f2', { title: 'Time', managementGenusItem: 'timeGenus' }),
  ];
  d.partner = [
    row('partnerA', 'partnerCatalog', 'empty', { partnerTitle: 'A', partnerIsSupplier: true, supplierData: { paymentTermsDays: 14, paymentTimelineShiftDays: 45 } }),
    row('partnerB', 'partnerCatalog', 'empty', { partnerTitle: 'B', partnerIsSupplier: true, supplierData: { paymentTermsDays: 14, paymentTimelineShiftDays: 21 } }),
    row('partnerC', 'partnerCatalog', 'empty', { partnerTitle: 'C', partnerIsSupplier: true, supplierData: { paymentTermsDays: 14 } }),
    row('custA', 'partnerCatalog', 'empty', { partnerTitle: 'Cust', partnerIsCustomer: true, customerData: { paymentTermsDays: 30, paymentTimelineShiftDays: 12 } }),
  ];
  d.contract = [
    // a supplier contract with everything: its own shift (30), a budget item, a business unit
    row('c_sup', 'partnerA', 'partner', { contractPartyType: 'partner', supplierRole: true, contractCurrency: 'USD', paymentTimelineShiftDays: 30, paymentBudgetItemOutbound: 'bi_out', businessUnitAssigned: 'bu1' }),
    // no shift, no item: the partner's payment terms (21) decide
    row('c_supB', 'partnerB', 'partner', { contractPartyType: 'partner', supplierRole: true, contractCurrency: 'EUR' }),
    // no shift anywhere
    row('c_supC', 'partnerC', 'partner', { contractPartyType: 'partner', supplierRole: true, contractCurrency: 'EUR' }),
    row('c_cust', 'custA', 'partner', { contractPartyType: 'partner', customerRole: true, contractCurrency: 'EUR', paymentTimelineShiftDays: 10, paymentBudgetItemInbound: 'bi_in' }),
    // a customer contract that holds an item of the wrong genus (an old choice)
    row('c_custBad', 'custA', 'partner', { contractPartyType: 'partner', customerRole: true, contractCurrency: 'EUR', paymentBudgetItemInbound: 'bi_time' }),
    row('c_person', 'pers1', 'person', { contractPartyType: 'person', contractCurrency: 'EUR', paymentBudgetItemOutbound: 'bi_out2' }),
    row('c_bothRoles', 'partnerA', 'partner', { contractPartyType: 'partner', supplierRole: true, customerRole: true, contractCurrency: 'EUR', paymentBudgetItemOutbound: 'bi_out', paymentBudgetItemInbound: 'bi_in' }),
  ];
  return d;
}

export function paymentCtx(direction: 'outbound' | 'inbound' = 'outbound', over: Partial<PaymentComputeContext> = {}): PaymentComputeContext {
  const d = paymentData();
  return { data: { contract: d.contract, partner: d.partner, budgetItem: d.budgetItem }, direction, days: DAYS, fx: null, projectCurrency: null, ...over };
}
