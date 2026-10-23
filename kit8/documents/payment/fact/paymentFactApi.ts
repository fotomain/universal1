// paymentFactApi - the calls of the payment fact. Every function takes the Supabase client (useSupabase().supabase), so a test passes a fake one.
// The header is written ONLY by these RPCs; the sum / contract / budget item / business unit of a line of a draft are written by the ReusableTable through the redux entity (paymentFactMetaData.ts).
import {
  AddFromPlanAnswer, PaymentFactListAnswer, PaymentFactListFilter, PaymentFactPostAnswer, PlanCandidate, PlanPaid, RPC_CASH_LEDGER_REFRESH, RPC_PAYMENT_FACT_ADD_FROM_PLAN, RPC_PAYMENT_FACT_ADD_LINE, RPC_PAYMENT_FACT_CANDIDATES,
  RPC_PAYMENT_FACT_CREATE, RPC_PAYMENT_FACT_DELETE, RPC_PAYMENT_FACT_LIST, RPC_PAYMENT_FACT_POST, RPC_PAYMENT_FACT_SET_HEADER, RPC_PAYMENT_FACT_SET_LINE_TASK, RPC_PAYMENT_FACT_UNPOST, RPC_TASK_PAYMENT_PAID,
  paymentFactFilterToRpc, parseAddFromPlanAnswer, parseCandidates, parseListAnswer, parsePlanPaid, parsePostAnswer, PaymentFactDirection,
} from './paymentFactModel';

type Client = any;
const fail = (error: any): never => { throw new Error(error?.message || String(error)); };

/** a new DRAFT; with a task (the lines default to it), a direction and the plan payments to start from. Returns the GUID of the document */
export async function createPaymentFact(client: Client, params: { taskGUID?: string | null; direction?: PaymentFactDirection | null; planLineGUIDs?: string[] | null } = {}): Promise<string> {
  const { data, error } = await client.rpc(RPC_PAYMENT_FACT_CREATE, { p_task: params.taskGUID || null, p_direction: params.direction || null, p_plan_lines: params.planLineGUIDs && params.planLineGUIDs.length ? params.planLineGUIDs : null });
  if (error) fail(error);
  return String(data);
}

/** the documents with their totals (filter: PaymentFactListFilter; `extra` = keys the screen sets itself, e.g. documentGUIDs, taskGUID) */
export async function fetchPaymentFactList(client: Client, filter: PaymentFactListFilter | null, extra: Record<string, any> = {}, limit = 1000, offset = 0): Promise<PaymentFactListAnswer> {
  const p_filter = filter ? paymentFactFilterToRpc(filter, extra) : { ...extra };
  const { data, error } = await client.rpc(RPC_PAYMENT_FACT_LIST, { p_filter, p_limit: limit, p_offset: offset });
  if (error) fail(error);
  return parseListAnswer(data);
}

export interface PaymentFactHeaderPatch {
  paymentFactNumber?: string;
  /** 'YYYY-MM-DD' or '' */
  paymentFactDate?: string | null;
  moneyAccountFact?: string | null;
  paymentFactDirection?: PaymentFactDirection | null;
  paymentFactPartner?: string | null;
  paymentFactPerson?: string | null;
  paymentFactBankAmount?: number | null;
  paymentFactTask?: string | null;
}
/** the number, date, money account, payee (partner OR person) and direction of a DRAFT */
export async function setPaymentFactHeader(client: Client, headerGUID: string, patch: PaymentFactHeaderPatch): Promise<void> {
  const { error } = await client.rpc(RPC_PAYMENT_FACT_SET_HEADER, { p_header: headerGUID, p_patch: patch });
  if (error) fail(error);
}

/** the POSTED plan payments that still have something open (for the header's payee and direction; `filter` narrows what the header has not fixed) */
export async function fetchPlanCandidates(client: Client, headerGUID: string | null, filter: { direction?: string; partnerGUID?: string; personGUID?: string; taskGUID?: string } = {}): Promise<PlanCandidate[]> {
  const { data, error } = await client.rpc(RPC_PAYMENT_FACT_CANDIDATES, { p_header: headerGUID, p_filter: filter });
  if (error) fail(error);
  return parseCandidates(data);
}

/** "Get from plan": one line per plan payment, the attributes copied, the sum = what is still open */
export async function addFromPlan(client: Client, headerGUID: string, planLineGUIDs: string[]): Promise<AddFromPlanAnswer> {
  const { data, error } = await client.rpc(RPC_PAYMENT_FACT_ADD_FROM_PLAN, { p_header: headerGUID, p_plan_lines: planLineGUIDs });
  if (error) fail(error);
  return parseAddFromPlanAnswer(data);
}

/** ONE line that comes from no plan payment (an unplanned payment); returns the GUID of the line */
export async function addPaymentFactLine(client: Client, headerGUID: string, taskGUID?: string | null): Promise<string> {
  const { data, error } = await client.rpc(RPC_PAYMENT_FACT_ADD_LINE, { p_header: headerGUID, p_task: taskGUID || null });
  if (error) fail(error);
  return String(data);
}

/** the task (and so the project) of an independent line */
export async function setPaymentFactLineTask(client: Client, lineGUID: string, taskGUID: string): Promise<void> {
  const { error } = await client.rpc(RPC_PAYMENT_FACT_SET_LINE_TASK, { p_line: lineGUID, p_task: taskGUID });
  if (error) fail(error);
}

export async function postPaymentFact(client: Client, headerGUID: string): Promise<PaymentFactPostAnswer> {
  const { data, error } = await client.rpc(RPC_PAYMENT_FACT_POST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

export async function unpostPaymentFact(client: Client, headerGUID: string): Promise<PaymentFactPostAnswer> {
  const { data, error } = await client.rpc(RPC_PAYMENT_FACT_UNPOST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

/** a DRAFT document (and its lines) is deleted; a posted one is not */
export async function deletePaymentFact(client: Client, headerGUID: string): Promise<void> {
  const { error } = await client.rpc(RPC_PAYMENT_FACT_DELETE, { p_header: headerGUID });
  if (error) fail(error);
}

/** what the posted payment facts have paid of each posted plan payment of a task (the columns Paid / Open of the payment plan) */
export async function fetchTaskPaymentPaid(client: Client, taskGUID: string): Promise<PlanPaid[]> {
  const { data, error } = await client.rpc(RPC_TASK_PAYMENT_PAID, { p_task: taskGUID });
  if (error) fail(error);
  return parsePlanPaid(data);
}

/** the button "Refresh rests": the database works off the queue of the exchange rate changes now. Returns { changed, queue } */
export async function refreshCashLedger(client: Client): Promise<{ changed: number; queue: number }> {
  const { data, error } = await client.rpc(RPC_CASH_LEDGER_REFRESH);
  if (error) fail(error);
  return { changed: Number(data?.changed) || 0, queue: Number(data?.queue) || 0 };
}
