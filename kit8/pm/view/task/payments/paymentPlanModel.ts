// Payment plan of a task - the row model (pure). documentation/PAYMENTS_PLAN_WBS.html · SQL PART 37 (task_payment_plan_lines + task_payment_plan_movements).
//   One row = one planned PAYMENT of a task. rowOwnerGUID = the task, rowParentGUID = the direction ('outbound' | 'inbound' = the sub-tab), rowJSON = TaskPaymentPlanRowJSON.
//   The three sums (sumForContract / sumForAccounting / sumForBudget) are all WITH VAT - cash. On a task line sumForBudget is NET: the names are the same, the meaning is not.
//   Post (post_task_payment_plan) copies the payments into task_payment_plan_movements; ANY change of a payment makes it unposted again (paymentIsPosted = false).
import { MANAGEMENT_GENUS } from '../../../../catalog/management/genus/managementGenusModel';

/** Supabase table of the planned payments (SQL PART 37) */
export const taskPaymentPlanTable = 'task_payment_plan_lines';
/** the table of the POSTED payments (read only for the client) */
export const taskPaymentPlanMovementsTable = 'task_payment_plan_movements';
/** SystemMetaData / redux entity key */
export const TASK_PAYMENT_PLAN_ENTITY = 'taskPaymentPlanReusable';
/** the RPCs of Post / unpost (kit8/sql/start/start2_sql_code.sql PART 37) */
export const rpcPostTaskPaymentPlan = 'post_task_payment_plan';
export const rpcUnpostTaskPaymentPlan = 'unpost_task_payment_plan';

/** the first level tab of the Finances view of a task, and its sub-tabs */
export const PAYMENT_TAB_ID = 'TabPayments';
export type PaymentDirection = 'outbound' | 'inbound';
export type PaymentSubTab = PaymentDirection | 'cashFlow';

export interface PaymentSubTabDef { id: PaymentSubTab; title: string; icon: string }
/** Outbound · Inbound · Cash flow (EMPTY: the place of a later report) */
export const PAYMENT_SUB_TABS: PaymentSubTabDef[] = [
  { id: 'outbound', title: 'Outbound', icon: 'north_east' },
  { id: 'inbound', title: 'Inbound', icon: 'south_west' },
  { id: 'cashFlow', title: 'Cash flow', icon: 'show_chart' },
];
export const isPaymentDirection = (v: unknown): v is PaymentDirection => v === 'outbound' || v === 'inbound';

/** the payments genus of a direction: the budget item of a payment is an item of it (managementGenusTable) */
export const paymentGenusOf = (direction: PaymentDirection): string => (direction === 'inbound' ? MANAGEMENT_GENUS.inboundPayment : MANAGEMENT_GENUS.outboundPayment);
/** the budget items a direction can pick */
export const isPaymentBudgetItemOf = (direction: PaymentDirection, item: { rowJSON?: Record<string, any> } | null | undefined): boolean =>
  !!item && item.rowJSON?.managementGenusItem === paymentGenusOf(direction);

/** what the shift is counted from: the start or the end of the task */
export type PaymentAnchor = 'taskStart' | 'taskEnd';
export const PAYMENT_ANCHORS: { value: PaymentAnchor; label: string }[] = [
  { value: 'taskStart', label: 'Task start' },
  { value: 'taskEnd', label: 'Task end' },
];
export const DEFAULT_PAYMENT_ANCHOR: PaymentAnchor = 'taskStart';
export const paymentAnchorOf = (v: unknown): PaymentAnchor => (v === 'taskEnd' ? 'taskEnd' : DEFAULT_PAYMENT_ANCHOR);

/** which of shift / date the user typed last: the other one follows it */
export type PaymentDateSource = 'shift' | 'date';

/** what the last recalculation saw: tells which of shift / date / anchor the user changed (paymentPlanDates.ts) */
export interface PaymentDateSnapshot { shift: number | null; date: string | null; anchor: PaymentAnchor }

/** where a payment came from: made by a fill button from the lines of a genus (refresh replaces those) | typed by hand (null) */
export interface PaymentPlanSource { genus: string; taskLineGUIDs: string[] }

export interface TaskPaymentPlanRowJSON {
  paymentPlanPaymentDirection: PaymentDirection | null;
  /** budgetItemTable.rowGUID of the PAYMENTS genus of the direction. Default: the item of the contract; the user can change it (paymentPlanBudgetItemSource = 'line') */
  paymentPlanBudgetItem: string | null;
  /** 'contract' = taken from the contract (follows a change of the contract) | 'line' = chosen on the payment (kept) */
  paymentPlanBudgetItemSource: 'contract' | 'line' | null;
  /** the last item the app took from the contract: while paymentPlanBudgetItem equals it (or is empty) the item follows the contract (like priceAutoTaskLine) */
  paymentPlanBudgetItemAuto: string | null;
  /** what the payee was the last time: 'partner' | 'person' (tells which of the two the user chose when both are set) */
  paymentPlanPayeeKind: 'partner' | 'person' | null;
  /** businessUnitTable.rowGUID */
  paymentPlanBusinessUnit: string | null;
  /** the payee: a partner (supplier for Outbound, customer for Inbound) ... */
  paymentPlanPartner: string | null;
  /** ... or a person (Outbound only); never both */
  paymentPlanPerson: string | null;
  /** contractTable.rowGUID of the payee */
  paymentPlanContract: string | null;
  /** ISO code; default: the currency of the contract */
  paymentPlanCurrency: string | null;
  paymentPlanTimelineAnchor: PaymentAnchor | null;
  /** days after the anchor, >= 0; default: contract -> partner payment terms -> 0 */
  paymentPlanTimelineShiftDays: number | null;
  /** 'YYYY-MM-DD' */
  paymentPlannedTransactionDate: string | null;
  paymentPlanDateSource: PaymentDateSource | null;
  paymentPlanDateSnapshot: PaymentDateSnapshot | null;
  /** WITH VAT, in paymentPlanCurrency */
  sumForContract: number | null;
  /** WITH VAT, in the accounting / budget currency of the project: a snapshot of the exchange rate of paymentPlannedTransactionDate (paymentPlanMoney.ts) */
  sumForAccounting: number | null;
  sumForBudget: number | null;
  paymentPlanFxSnapshot: PaymentFxSnapshot | null;
  paymentPlanSource: PaymentPlanSource | null;
  /** false for a new payment; ANY change sets it false again (also the database); only post_task_payment_plan sets it true */
  paymentIsPosted: boolean;
  /** set by Post, never cleared: a payment that was posted once and changed since is "Post needed", not "Post" */
  paymentEverPosted: boolean;
}

/** the rates a payment converted its sum with, and the day they were taken for */
export interface PaymentFxSnapshot {
  from: string;
  day: string;
  inputs: string;
  accounting?: { to: string; rateType: string; rate: number };
  budget?: { to: string; rateType: string; rate: number };
}

export interface TaskPaymentPlanRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList?: number;
  rowJSON: Partial<TaskPaymentPlanRowJSON>;
}

export const emptyPaymentPlanLine = (): TaskPaymentPlanRowJSON => ({
  paymentPlanPaymentDirection: null, paymentPlanBudgetItem: null, paymentPlanBudgetItemSource: null, paymentPlanBudgetItemAuto: null, paymentPlanPayeeKind: null, paymentPlanBusinessUnit: null, paymentPlanPartner: null, paymentPlanPerson: null,
  paymentPlanContract: null, paymentPlanCurrency: null, paymentPlanTimelineAnchor: null, paymentPlanTimelineShiftDays: null, paymentPlannedTransactionDate: null,
  paymentPlanDateSource: null, paymentPlanDateSnapshot: null, sumForContract: null, sumForAccounting: null, sumForBudget: null, paymentPlanFxSnapshot: null, paymentPlanSource: null,
  paymentIsPosted: false, paymentEverPosted: false,
});

const isSet = (v: unknown): v is string => typeof v === 'string' && v !== '' && v !== 'empty';
/** the payee of a payment: a partner or a person (null = not chosen) */
export const paymentPayeeOf = (j: Partial<TaskPaymentPlanRowJSON>): { kind: 'partner' | 'person'; guid: string } | null =>
  isSet(j.paymentPlanPartner) ? { kind: 'partner', guid: j.paymentPlanPartner } : isSet(j.paymentPlanPerson) ? { kind: 'person', guid: j.paymentPlanPerson } : null;

/** the payments of a direction */
export const paymentsOfDirection = (rows: TaskPaymentPlanRow[], direction: PaymentDirection): TaskPaymentPlanRow[] =>
  (rows || []).filter((r) => r.rowParentGUID === direction);

export type PaymentPostState = 'post' | 'posted' | 'postNeeded';
/**
 * The state of the Post button of the payments of ONE task: no payment = 'post' (nothing yet); every payment posted = 'posted'; some payment is posted or was posted once
 * (paymentEverPosted) but not now = 'postNeeded'; never posted = 'post'. (The same three states as the task lines, taskLinePlanModel.ts.)
 */
export function paymentPostState(rows: TaskPaymentPlanRow[]): PaymentPostState {
  const list = rows || [];
  if (list.length === 0) return 'post';
  if (list.every((r) => r.rowJSON?.paymentIsPosted === true)) return 'posted';
  return list.some((r) => r.rowJSON?.paymentIsPosted === true || r.rowJSON?.paymentEverPosted === true) ? 'postNeeded' : 'post';
}

/** a number the database may send as a string */
export const paymentNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
