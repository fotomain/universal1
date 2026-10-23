// Payment plan - the derived fields of a payment after a cell changed (pure; the table's computeRowJSON). Order of the rules:
//  1. paymentPlanPaymentDirection = the sub-tab
//  2. the PAYEE: a partner OR a person (Outbound only). When both are set the one that is NOT the kind of the last time is the new choice (paymentPlanPayeeKind). A contract that is not
//     a contract of the payee goes; a contract chosen with no payee gives its payee (the owner of the contract)
//  3. the currency = the currency of the contract, else the currency of the project (never typed)
//  4. the BUDGET ITEM follows the contract (paymentBudgetItemOutbound / Inbound of the contract) while it is empty or still the item the app took last time (paymentPlanBudgetItemAuto,
//     like priceAutoTaskLine); a different item is the user's choice (paymentPlanBudgetItemSource = 'line') and stays when the contract changes
//  5. the business unit of an empty field = businessUnitAssigned of the contract
//  6. the shift of a payment with neither shift nor date = contract -> payment terms of the partner (supplier data for Outbound, customer data for Inbound) -> 0
//  7. shift <-> date (paymentPlanDates.ts)  ·  8. the sums in the accounting / budget currency (paymentPlanMoney.ts)
//  9. paymentIsPosted = false: ANY change of a payment makes its posting out of date (the database does the same); only post_task_payment_plan sets it true.
import type { DefRow } from '../../../../catalog/product/productModel';
import { contractPaymentBudgetItem, contractPaymentShift } from '../../../../catalog/contract/contractPaymentModel';
import { partnerPaymentShift } from '../../../../catalog/partner/partnerModel';
import { paymentDateProblems, recomputePaymentDates, type PaymentTaskDays } from './paymentPlanDates';
import { computePaymentFx, paymentFxProblem, type PaymentFxContext } from './paymentPlanMoney';
import { isPaymentBudgetItemOf, paymentNumber, paymentPayeeOf, type PaymentDirection, type TaskPaymentPlanRowJSON } from './paymentPlanModel';

/** the catalog rows the rules read (the lists of useTaskLineCatalogs) */
export interface PaymentCatalogs {
  contract: DefRow<any>[];
  partner: DefRow<any>[];
  budgetItem: DefRow<any>[];
}
export const emptyPaymentCatalogs = (): PaymentCatalogs => ({ contract: [], partner: [], budgetItem: [] });

export interface PaymentComputeContext {
  data: PaymentCatalogs;
  direction: PaymentDirection;
  /** the first and last day of the task */
  days: PaymentTaskDays;
  /** the exchange rates (null while they are being read, or the project converts into no currency) */
  fx?: PaymentFxContext | null;
  /** the project's default currency, used while the payment has no contract */
  projectCurrency?: string | null;
}

const isSet = (v: unknown): v is string => typeof v === 'string' && v !== '' && v !== 'empty';
const upper = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : null);

export function computePaymentPlanRowJSON(ctx: PaymentComputeContext, json: Partial<TaskPaymentPlanRowJSON>): Partial<TaskPaymentPlanRowJSON> {
  const patch: Partial<TaskPaymentPlanRowJSON> = { paymentIsPosted: false };
  let merged: Partial<TaskPaymentPlanRowJSON> = { ...json, paymentIsPosted: false };
  const apply = (p: Partial<TaskPaymentPlanRowJSON>) => { Object.assign(patch, p); merged = { ...merged, ...p }; };
  const { data, direction } = ctx;

  // 1. the direction
  if (merged.paymentPlanPaymentDirection !== direction) apply({ paymentPlanPaymentDirection: direction });

  // 2. the payee
  if (direction === 'inbound' && isSet(merged.paymentPlanPerson)) apply({ paymentPlanPerson: null });
  if (isSet(merged.paymentPlanPartner) && isSet(merged.paymentPlanPerson)) {
    // both: the new choice is the kind that was NOT the payee before
    if (merged.paymentPlanPayeeKind === 'person') apply({ paymentPlanPerson: null });
    else apply({ paymentPlanPartner: null });
  }
  let contract = isSet(merged.paymentPlanContract) ? data.contract.find((c) => c.rowGUID === merged.paymentPlanContract) : undefined;
  let payee = paymentPayeeOf(merged);
  if (contract && !payee) {
    // a contract was chosen first: its owner is the payee (a person only on Outbound)
    const kind = contract.rowParentGUID === 'person' ? 'person' : 'partner';
    if (!(kind === 'person' && direction === 'inbound')) {
      apply(kind === 'person' ? { paymentPlanPerson: contract.rowOwnerGUID } : { paymentPlanPartner: contract.rowOwnerGUID });
      payee = paymentPayeeOf(merged);
    }
  }
  if (contract && (!payee || contract.rowOwnerGUID !== payee.guid)) {
    apply({ paymentPlanContract: null });
    contract = undefined;
  }
  const kindNow = paymentPayeeOf(merged)?.kind ?? null;
  if (merged.paymentPlanPayeeKind !== kindNow) apply({ paymentPlanPayeeKind: kindNow });
  payee = paymentPayeeOf(merged);

  // 3. the currency
  const currency = upper(contract?.rowJSON?.contractCurrency) ?? upper(ctx.projectCurrency);
  if (merged.paymentPlanCurrency !== currency) apply({ paymentPlanCurrency: currency });

  // 4. the budget item
  const fromContract = contract ? contractPaymentBudgetItem(contract.rowJSON, direction) : null;
  const item = isSet(merged.paymentPlanBudgetItem) ? merged.paymentPlanBudgetItem : null;
  if (item === null || item === merged.paymentPlanBudgetItemAuto) {
    // follows the contract (an item the catalog does not know as a payment item of the direction is not taken: the contract may hold an old choice)
    const row = fromContract ? data.budgetItem.find((b) => b.rowGUID === fromContract) : undefined;
    const taken = fromContract && (data.budgetItem.length === 0 || isPaymentBudgetItemOf(direction, row)) ? fromContract : null;
    if (item !== taken) apply({ paymentPlanBudgetItem: taken });
    if (merged.paymentPlanBudgetItemAuto !== taken) apply({ paymentPlanBudgetItemAuto: taken });
    const src = taken ? 'contract' : null;
    if (merged.paymentPlanBudgetItemSource !== src) apply({ paymentPlanBudgetItemSource: src });
  } else if (merged.paymentPlanBudgetItemSource !== 'line') apply({ paymentPlanBudgetItemSource: 'line' });

  // 5. the business unit
  const unit = contract?.rowJSON?.businessUnitAssigned;
  if (!isSet(merged.paymentPlanBusinessUnit) && isSet(unit)) apply({ paymentPlanBusinessUnit: unit });

  // 6. the shift of a payment that has neither a shift nor a date
  if (paymentNumber(merged.paymentPlanTimelineShiftDays) === null && !isSet(merged.paymentPlannedTransactionDate)) {
    apply({ paymentPlanTimelineShiftDays: defaultPaymentShift(data, direction, contract, payee) });
  }

  // 7. shift <-> date
  apply(recomputePaymentDates(merged, ctx.days));

  // 8. the converted sums
  if (ctx.fx) apply(computePaymentFx(ctx.fx, merged));
  return patch;
}

/** contract -> payment terms of the partner (supplier data for Outbound, customer data for Inbound) -> 0 */
export function defaultPaymentShift(data: PaymentCatalogs, direction: PaymentDirection, contract: DefRow<any> | undefined, payee: { kind: 'partner' | 'person'; guid: string } | null): number {
  const fromContract = contract ? contractPaymentShift(contract.rowJSON) : null;
  if (fromContract !== null) return fromContract;
  if (payee?.kind === 'partner') {
    const fromPartner = partnerPaymentShift(data.partner.find((p) => p.rowGUID === payee.guid)?.rowJSON, direction);
    if (fromPartner !== null) return fromPartner;
  }
  return 0;
}

/** every problem of a payment as a message for the Errors column ([] = fine); also what Post checks */
export function paymentPlanProblems(ctx: PaymentComputeContext & { afterFinishOn: boolean }, json: Partial<TaskPaymentPlanRowJSON>): string[] {
  const out: string[] = [];
  const item = isSet(json.paymentPlanBudgetItem) ? ctx.data.budgetItem.find((b) => b.rowGUID === json.paymentPlanBudgetItem) : undefined;
  if (!isSet(json.paymentPlanBudgetItem)) out.push('Choose the budget item');
  else if (ctx.data.budgetItem.length > 0 && !isPaymentBudgetItemOf(ctx.direction, item)) out.push(`The budget item is not an ${ctx.direction} payment item`);
  if (!paymentPayeeOf(json)) out.push(ctx.direction === 'inbound' ? 'Choose the customer' : 'Choose the supplier or the person');
  if (!isSet(json.paymentPlanContract)) out.push('Choose the contract');
  else if (!isSet(json.paymentPlanCurrency)) out.push('The currency of the payment is unknown');
  out.push(...paymentDateProblems(json, ctx.days, ctx.afterFinishOn));
  const sum = paymentNumber(json.sumForContract);
  if (sum === null || sum <= 0) out.push('Enter the sum (with VAT)');
  const fx = paymentFxProblem(ctx.fx, json);
  if (fx) out.push(fx);
  return out;
}
