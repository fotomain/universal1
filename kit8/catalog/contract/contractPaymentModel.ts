// Contract - the payment plan keys (documentation/PAYMENTS_PLAN_WBS.html). All OPTIONAL, all in contractTable.rowJSON (no SQL), on the contract of a PARTNER and on the contract of a PERSON:
//   paymentTimelineShiftDays    days after the start or the end of a task the contract pays (>= 0): the manager's value for his forecast - the default shift of a payment of this contract
//   paymentBudgetItemOutbound   budgetItemTable.rowGUID of the OUTBOUND payments genus: the budget item of a payment TO this payee (a person's contract, a supplier's contract)
//   paymentBudgetItemInbound    budgetItemTable.rowGUID of the INBOUND payments genus: the budget item of a payment FROM this payee (a customer's contract)
// A person is only paid: his contract has the outbound item only. A partner contract has the item(s) of its role (supplierRole -> outbound, customerRole -> inbound; no role flag = both).
import { MANAGEMENT_GENUS } from '../management/genus/managementGenusModel';

export type ContractPaymentDirection = 'outbound' | 'inbound';

export const CONTRACT_PAYMENT_KEYS = {
  shiftDays: 'paymentTimelineShiftDays',
  budgetItemOutbound: 'paymentBudgetItemOutbound',
  budgetItemInbound: 'paymentBudgetItemInbound',
} as const;

const isSet = (v: unknown): v is string => typeof v === 'string' && v !== '' && v !== 'empty';

/** the directions a contract can pay: a person's contract Outbound; a partner's by its role flags (none = both) */
export function contractPaymentDirections(c: { contractPartyType?: string; supplierRole?: boolean; customerRole?: boolean } | null | undefined): ContractPaymentDirection[] {
  if (!c || c.contractPartyType === 'person') return ['outbound'];
  const out: ContractPaymentDirection[] = [];
  if (c.supplierRole) out.push('outbound');
  if (c.customerRole) out.push('inbound');
  return out.length ? out : ['outbound', 'inbound'];
}

/** the budget item the contract gives to a payment of a direction (null = none) */
export function contractPaymentBudgetItem(json: Record<string, any> | null | undefined, direction: ContractPaymentDirection): string | null {
  const v = json?.[direction === 'inbound' ? CONTRACT_PAYMENT_KEYS.budgetItemInbound : CONTRACT_PAYMENT_KEYS.budgetItemOutbound];
  return isSet(v) ? v : null;
}

/** the shift of the contract in days (null = not set; 0 is a value) */
export function contractPaymentShift(json: Record<string, any> | null | undefined): number | null {
  const v = json?.[CONTRACT_PAYMENT_KEYS.shiftDays];
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** the keys to store from a form (a key that is empty is not written, so a save clears it; an item of a direction the contract cannot pay is dropped) */
export function normalizeContractPayment(v: Record<string, any> | null | undefined, c: { contractPartyType?: string; supplierRole?: boolean; customerRole?: boolean }): Record<string, string | number> {
  const dirs = contractPaymentDirections(c);
  const out: Record<string, string | number> = {};
  const shift = contractPaymentShift(v);
  if (shift !== null) out[CONTRACT_PAYMENT_KEYS.shiftDays] = shift;
  const o = contractPaymentBudgetItem(v, 'outbound');
  const i = contractPaymentBudgetItem(v, 'inbound');
  if (o && dirs.includes('outbound')) out[CONTRACT_PAYMENT_KEYS.budgetItemOutbound] = o;
  if (i && dirs.includes('inbound')) out[CONTRACT_PAYMENT_KEYS.budgetItemInbound] = i;
  return out;
}

/** the budget items a contract can give to a payment: the items of the payments genus of the direction (a folder is no choice) */
export const isContractPaymentBudgetItem = (direction: ContractPaymentDirection, item: { rowJSON?: Record<string, any> } | null | undefined): boolean =>
  !!item && item.rowJSON?.managementGenusItem === (direction === 'inbound' ? MANAGEMENT_GENUS.inboundPayment : MANAGEMENT_GENUS.outboundPayment);
