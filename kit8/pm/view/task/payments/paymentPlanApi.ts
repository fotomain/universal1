// Payment plan - the RPCs post_task_payment_plan / unpost_task_payment_plan (kit8/sql/start/start2_sql_code.sql PART 37).
// The Supabase client is loaded when Post is pressed, so importing this file (a screen, a test) never creates the client.
import { rpcPostTaskPaymentPlan, rpcUnpostTaskPaymentPlan } from './paymentPlanModel';

const client = async () => (await import('../../../../supabase/supabase')).supabase;

/** what the database found wrong with a payment: the key of the problem (post_task_payment_plan) */
export type PaymentPostProblemKey =
  | 'budgetItemMissing' | 'budgetItemNotPayment' | 'payeeMissing' | 'contractMissing' | 'currencyMissing' | 'sumMissing' | 'dateMissing'
  | 'dateBeforeTaskStart' | 'dateAfterTaskEnd' | 'sumForAccountingMissing' | 'sumForBudgetMissing';
export interface PaymentPostProblem { lineGUID: string; problem: PaymentPostProblemKey | string }
export interface PostPaymentPlanResult { status: 'posted' | 'refused' | 'nothing'; lines: number; problems: PaymentPostProblem[] }

/** the sentence of each problem (English; pmT translates it where it is shown) */
export const PAYMENT_POST_PROBLEM_TEXT: Record<PaymentPostProblemKey, string> = {
  budgetItemMissing: 'no budget item',
  budgetItemNotPayment: 'the budget item is not a payment item of its direction',
  payeeMissing: 'no supplier / customer / person',
  contractMissing: 'no contract',
  currencyMissing: 'no currency',
  sumMissing: 'no sum',
  dateMissing: 'no planned date',
  dateBeforeTaskStart: 'the planned date is before the start of the task',
  dateAfterTaskEnd: 'the planned date is after the end of the task',
  sumForAccountingMissing: 'no sum in the accounting currency (exchange rate?)',
  sumForBudgetMissing: 'no sum in the budget currency (exchange rate?)',
};

/** Post: ALL the payments of the task or none; the days are the first and the last day of the task as the scheduler of the app shows them. Throws with the message of the database when it fails */
export async function postTaskPaymentPlan(taskGUID: string, firstDay: string | null, lastDay: string | null): Promise<PostPaymentPlanResult> {
  const supabase = await client();
  const { data, error } = await supabase.rpc(rpcPostTaskPaymentPlan, { p_task: taskGUID, p_task_start: firstDay, p_task_end: lastDay });
  if (error) throw new Error(error.message || String(error));
  const d: any = data || {};
  return {
    status: d.status === 'posted' || d.status === 'refused' ? d.status : 'nothing',
    lines: Number(d.lines) || 0,
    problems: Array.isArray(d.problems) ? d.problems.map((p: any) => ({ lineGUID: String(p?.lineGUID ?? ''), problem: String(p?.problem ?? '') })) : [],
  };
}

/** Unpost: the payments of the task are drafts again, their movements are deleted */
export async function unpostTaskPaymentPlan(taskGUID: string): Promise<void> {
  const supabase = await client();
  const { error } = await supabase.rpc(rpcUnpostTaskPaymentPlan, { p_task: taskGUID });
  if (error) throw new Error(error.message || String(error));
}
