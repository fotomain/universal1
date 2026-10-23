// paymentFactModel - the PAYMENT FACT document (documentation/PAYMENTS_FACT_WBS.html; SQL: PART 38 of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql): ONE bank transaction.
//   project_payment_fact_header  rowJSON { documentHeader { activeUser · created_at · documentNumber PF-00001 · documentStatus draft | posted · postedAt · postedBy · unpostedAt },
//                                paymentFactNumber (the bank statement reference) · paymentFactDate ('YYYY-MM-DD' = the day of the exchange rate) · moneyAccountFact · paymentFactPartner | paymentFactPerson (the payee) ·
//                                paymentFactDirection 'inbound' | 'outbound' · paymentFactBankAmount (optional control sum) · paymentFactTask (the task it was made for) · paymentFactFolder / paymentFactCurrency (derived) }
//   project_payment_fact_lines   rowHeaderGUID · rowProjectGUID · rowOwnerGUID (the task) · paymentPlanLineGUID (the plan payment it fulfils, or null) · rowJSON { paymentFactBudgetItem · paymentFactBusinessUnit ·
//                                paymentFactContract · paymentFactCurrency · sumForContract / sumForAccounting / sumForBudget / sumForMoneyAccount (ALL WITH VAT) · moneyAccountSumSource 'auto' | 'typed' · paymentFactFxProblem }
//   cash_account_ledger_movements  the POSTED lines, signed (inbound +, outbound -); cash_account_ledger_rests = the rest of the account per day (rebuilt by the database)
// The RULE: ONE bank transaction pays N contracts of the payee, with N budget items, business units, tasks and projects. The lines come from the POSTED payment plan ("Get from plan").
// Pure (no React, no Supabase): the rules and the texts are tested without a screen.
import { parseDayInput } from '../../fact/input/factInputModel';
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';

export const PAYMENT_FACT_HEADER_TABLE = 'project_payment_fact_header';
export const PAYMENT_FACT_LINES_TABLE = 'project_payment_fact_lines';
export const CASH_LEDGER_MOVEMENTS_TABLE = 'cash_account_ledger_movements';
/** the redux entities (SystemMetaData, paymentFactMetaData.ts) */
export const PAYMENT_FACT_HEADER_ENTITY = 'paymentFactHeader';
export const PAYMENT_FACT_LINES_ENTITY = 'paymentFactLinesReusable';
export const RPC_PAYMENT_FACT_CREATE = 'payment_fact_create';
export const RPC_PAYMENT_FACT_SET_HEADER = 'payment_fact_set_header';
export const RPC_PAYMENT_FACT_ADD_FROM_PLAN = 'payment_fact_add_from_plan';
export const RPC_PAYMENT_FACT_ADD_LINE = 'payment_fact_add_line';
export const RPC_PAYMENT_FACT_SET_LINE_TASK = 'payment_fact_set_line_task';
export const RPC_PAYMENT_FACT_CANDIDATES = 'payment_fact_plan_candidates';
export const RPC_PAYMENT_FACT_POST = 'post_payment_fact';
export const RPC_PAYMENT_FACT_UNPOST = 'unpost_payment_fact';
export const RPC_PAYMENT_FACT_DELETE = 'delete_payment_fact';
export const RPC_PAYMENT_FACT_LIST = 'payment_fact_list';
export const RPC_TASK_PAYMENT_PAID = 'task_payment_paid';
export const RPC_PF_FROM_VENDOR_INVOICE = 'create_payment_fact_from_vendor_invoice';
export const RPC_PF_FROM_CUSTOMER_INVOICE = 'create_payment_fact_from_customer_invoice';
export const RPC_CASH_LEDGER_REFRESH = 'cash_ledger_refresh_now';

/** the screens: the form (app/pm/project/task/payment-fact), the list (hamburger menu → Documents → Payment facts) */
export const PAYMENT_FACT_ROUTE = '/pm/project/task/payment-fact';
export { PAYMENT_FACT_LIST_ROUTE } from '../../taskScope/taskScopeModel';

export type PaymentFactStatus = 'draft' | 'posted';
export type PaymentFactDirection = 'outbound' | 'inbound';
export const PAYMENT_FACT_DIRECTIONS: { value: PaymentFactDirection; label: string; icon: string }[] = [
  { value: 'outbound', label: 'Outbound', icon: 'north_east' },
  { value: 'inbound', label: 'Inbound', icon: 'south_west' },
];
export const isPaymentFactDirection = (v: unknown): v is PaymentFactDirection => v === 'outbound' || v === 'inbound';
/** the budget items a direction can pick = the items of its payments genus */
export const paymentFactGenusOf = (d: PaymentFactDirection): string => (d === 'inbound' ? MANAGEMENT_GENUS.inboundPayment : MANAGEMENT_GENUS.outboundPayment);

export type PaymentFactProblemCode =
  | 'documentIsPosted' | 'documentIsNotPosted' | 'documentHasNoLines' | 'paymentFactNumberMissing' | 'paymentFactDateMissing' | 'moneyAccountMissing' | 'accountCurrencyMissing' | 'dateBeforeOpening'
  | 'payeeMissing' | 'directionMissing' | 'budgetItemMissing' | 'budgetItemNotPayment' | 'contractMissing' | 'currencyMissing' | 'sumMissing' | 'notYourProject'
  | 'sumForAccountingMissing' | 'sumForBudgetMissing' | 'sumForMoneyAccountMissing';

export function paymentFactProblemText(code: string): string {
  switch (code) {
    case 'documentIsPosted': return 'The document is already posted.';
    case 'documentIsNotPosted': return 'The document is not posted.';
    case 'documentHasNoLines': return 'The document has no lines.';
    case 'paymentFactNumberMissing': return 'Enter the number of the bank transaction.';
    case 'paymentFactDateMissing': return 'Enter the date of the bank transaction.';
    case 'moneyAccountMissing': return 'Choose the money account.';
    case 'accountCurrencyMissing': return 'The money account has no currency: enter it in the catalog.';
    case 'dateBeforeOpening': return 'The date is before the opening date of the money account.';
    case 'payeeMissing': return 'Choose the payee (a partner or a person).';
    case 'directionMissing': return 'Choose the direction (Outbound or Inbound).';
    case 'budgetItemMissing': return 'A line needs a budget item.';
    case 'budgetItemNotPayment': return 'The budget item of a line must be an item of the payments genus of the direction.';
    case 'contractMissing': return 'A line needs a contract.';
    case 'currencyMissing': return 'A line needs a currency (it comes from the contract).';
    case 'sumMissing': return 'A line needs a sum greater than 0.';
    case 'notYourProject': return 'A line belongs to a project that is not yours: only its owner can post this document.';
    case 'sumForAccountingMissing': return 'A line has no sum in the accounting currency: there is no exchange rate for the date.';
    case 'sumForBudgetMissing': return 'A line has no sum in the budget currency: there is no exchange rate for the date.';
    case 'sumForMoneyAccountMissing': return 'A line has no amount in the currency of the money account: type it, or add the exchange rate for the date.';
    default: return code;
  }
}

export interface PaymentFactPostProblem { lineGUID: string | null; problem: PaymentFactProblemCode | string }
export interface PaymentFactPostAnswer { status: 'posted' | 'refused' | 'draft'; lines: number; problems: PaymentFactPostProblem[] }
export function parsePostAnswer(data: any): PaymentFactPostAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return { status: d.status === 'posted' ? 'posted' : d.status === 'draft' ? 'draft' : 'refused', lines: Number(d.lines) || 0, problems: (Array.isArray(d.problems) ? d.problems : []).map((p: any) => ({ lineGUID: p.lineGUID ?? null, problem: String(p.problem ?? '') })) };
}

// ---- "Get from plan": the POSTED plan payments with something open (payment_fact_plan_candidates) ----------------------------------------------------------------------------------------------
export interface PlanCandidate {
  planLineGUID: string;
  taskGUID: string;
  taskTitle: string;
  projectGUID: string;
  projectName: string;
  direction: PaymentFactDirection;
  partnerGUID: string | null;
  personGUID: string | null;
  payeeTitle: string;
  contractGUID: string | null;
  contractInfo: string;
  budgetItem: string | null;
  businessUnit: string | null;
  currency: string;
  plannedDay: string;
  planSum: number;
  paid: number;
  open: number;
}
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
const money = (v: unknown): number => round2(num(v));
export function parseCandidates(data: any): PlanCandidate[] {
  const rows = data && typeof data === 'object' && Array.isArray(data.rows) ? data.rows : [];
  return rows.map((r: any) => ({
    planLineGUID: String(r.planLineGUID), taskGUID: String(r.taskGUID ?? ''), taskTitle: String(r.taskTitle ?? ''), projectGUID: String(r.projectGUID ?? ''), projectName: String(r.projectName ?? ''),
    direction: isPaymentFactDirection(r.direction) ? r.direction : 'outbound', partnerGUID: r.partnerGUID ? String(r.partnerGUID) : null, personGUID: r.personGUID ? String(r.personGUID) : null,
    payeeTitle: String(r.payeeTitle ?? ''), contractGUID: r.contractGUID ? String(r.contractGUID) : null, contractInfo: String(r.contractInfo ?? ''),
    budgetItem: r.budgetItem ? String(r.budgetItem) : null, businessUnit: r.businessUnit ? String(r.businessUnit) : null, currency: String(r.currency ?? ''),
    plannedDay: String(r.plannedDay ?? '').slice(0, 10), planSum: money(r.planSum), paid: money(r.paid), open: money(r.open),
  }));
}
/** the answer of payment_fact_add_from_plan: how many lines and why the others were left out */
export interface AddFromPlanAnswer { added: number; skipped: { planLineGUID: string; reason: string }[] }
export function parseAddFromPlanAnswer(data: any): AddFromPlanAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return { added: Number(d.added) || 0, skipped: (Array.isArray(d.skipped) ? d.skipped : []).map((s: any) => ({ planLineGUID: String(s.planLineGUID), reason: String(s.reason ?? '') })) };
}
export function skipReasonText(reason: string): string {
  switch (reason) {
    case 'planPaymentNotPosted': return 'The payment of the plan is not posted.';
    case 'notYourProject': return 'The payment belongs to a project that is not yours.';
    case 'wrongDirection': return 'The payment has the other direction.';
    case 'wrongPayee': return 'The payment is for another payee.';
    case 'nothingOpen': return 'Nothing of the payment is open.';
    default: return reason;
  }
}
export const candidatesOpenTotal = (rows: PlanCandidate[], checked: ReadonlySet<string>): number => round2(rows.filter((r) => checked.has(r.planLineGUID)).reduce((a, r) => a + r.open, 0));
/** the candidates that are for the same payee as the first checked one (a document has ONE payee): the others cannot be checked together with it */
export function candidatesOfSamePayee(rows: PlanCandidate[], first: PlanCandidate | undefined | null): PlanCandidate[] {
  if (!first) return rows;
  return rows.filter((r) => r.direction === first.direction && r.partnerGUID === first.partnerGUID && r.personGUID === first.personGUID);
}

/** what the plan has paid so far (task_payment_paid): per plan payment */
export interface PlanPaid { planLineGUID: string; planSum: number; paid: number; open: number }
export function parsePlanPaid(data: any): PlanPaid[] {
  return (Array.isArray(data) ? data : []).map((r: any) => ({ planLineGUID: String(r.planLineGUID), planSum: money(r.planSum), paid: money(r.paid), open: money(r.open) }));
}

// ---- the list (payment_fact_list) ------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface PaymentFactListRow {
  documentGUID: string;
  documentNumber: string;
  documentStatus: PaymentFactStatus;
  paymentFactNumber: string;
  paymentFactDay: string | null;
  moneyAccountGUID: string;
  moneyAccountTitle: string;
  legalEntityGUID: string;
  legalEntityTitle: string;
  /** the currency of the money account */
  currency: string;
  partnerGUID: string;
  personGUID: string;
  payeeTitle: string;
  direction: PaymentFactDirection | '';
  folder: string;
  bankAmount: number | null;
  taskGUID: string;
  projectGUID: string;
  projectCount: number;
  authorGUID: string;
  authorName: string;
  lineCount: number;
  sumForMoneyAccount: number;
}
export interface PaymentFactCurrencyTotal { currency: string; count: number; sumForMoneyAccount: number }
export interface PaymentFactListAnswer { totalCount: number; totalsByCurrency: PaymentFactCurrencyTotal[]; rows: PaymentFactListRow[] }
export function parseListAnswer(data: any): PaymentFactListAnswer {
  const d = data && typeof data === 'object' ? data : {};
  const rows: PaymentFactListRow[] = (Array.isArray(d.rows) ? d.rows : []).map((r: any) => ({
    documentGUID: String(r.documentGUID), documentNumber: String(r.documentNumber ?? ''), documentStatus: r.documentStatus === 'posted' ? 'posted' : 'draft',
    paymentFactNumber: String(r.paymentFactNumber ?? ''), paymentFactDay: r.paymentFactDay ?? null,
    moneyAccountGUID: String(r.moneyAccountGUID ?? ''), moneyAccountTitle: String(r.moneyAccountTitle ?? ''), legalEntityGUID: String(r.legalEntityGUID ?? ''), legalEntityTitle: String(r.legalEntityTitle ?? ''),
    currency: String(r.currency ?? ''), partnerGUID: String(r.partnerGUID ?? ''), personGUID: String(r.personGUID ?? ''), payeeTitle: String(r.payeeTitle ?? ''),
    direction: isPaymentFactDirection(r.direction) ? r.direction : '', folder: String(r.folder ?? ''), bankAmount: r.bankAmount === null || r.bankAmount === undefined ? null : money(r.bankAmount),
    taskGUID: String(r.taskGUID ?? ''), projectGUID: String(r.projectGUID ?? ''), projectCount: Number(r.projectCount) || 0,
    authorGUID: String(r.authorGUID ?? ''), authorName: String(r.authorName ?? ''), lineCount: Number(r.lineCount) || 0, sumForMoneyAccount: money(r.sumForMoneyAccount),
  }));
  return {
    totalCount: Number(d.totalCount) || 0,
    totalsByCurrency: (Array.isArray(d.totalsByCurrency) ? d.totalsByCurrency : []).map((t: any) => ({ currency: String(t.currency ?? ''), count: Number(t.count) || 0, sumForMoneyAccount: money(t.sumForMoneyAccount) })),
    rows,
  };
}

/** the filters of the list: every column that is not a number (quick filters), each with a Clear icon in its field */
export interface PaymentFactListFilter {
  number: string;
  fromDay: string;
  toDay: string;
  moneyAccountGUID: string;
  legalEntityGUID: string;
  partnerGUID: string;
  direction: string;
  currency: string;
  status: string;
  author: string;
}
export const EMPTY_PAYMENT_FACT_FILTER: PaymentFactListFilter = { number: '', fromDay: '', toDay: '', moneyAccountGUID: '', legalEntityGUID: '', partnerGUID: '', direction: '', currency: '', status: '', author: '' };
export const paymentFactFilterActive = (f: PaymentFactListFilter): boolean => Object.values(f).some((v) => String(v || '').trim() !== '');
export const paymentFactDateErrors = (f: PaymentFactListFilter): { fromDay: boolean; toDay: boolean } => ({
  fromDay: !!f.fromDay.trim() && parseDayInput(f.fromDay) === null,
  toDay: !!f.toDay.trim() && parseDayInput(f.toDay) === null,
});
export function paymentFactFilterToRpc(f: PaymentFactListFilter, extra: Record<string, any> = {}): Record<string, any> {
  const out: Record<string, any> = { ...extra };
  const from = parseDayInput(f.fromDay);
  const to = parseDayInput(f.toDay);
  if (from) out.fromDay = from;
  if (to) out.toDay = to;
  for (const k of ['number', 'moneyAccountGUID', 'legalEntityGUID', 'partnerGUID', 'direction', 'currency', 'status', 'author'] as const) {
    if (f[k].trim()) out[k] = f[k].trim();
  }
  return out;
}

// ---- the header of the form ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface PaymentFactHeaderView {
  guid: string;
  number: string;
  status: PaymentFactStatus;
  paymentFactNumber: string;
  /** 'YYYY-MM-DD' ('' = not set) */
  day: string;
  moneyAccountGUID: string;
  moneyAccountTitle: string;
  legalEntityTitle: string;
  /** the currency of the money account */
  currency: string;
  partnerGUID: string;
  personGUID: string;
  payeeTitle: string;
  direction: PaymentFactDirection | '';
  bankAmount: number | null;
  taskGUID: string;
  projectGUID: string;
  projectCount: number;
  authorName: string;
}
export function headerOfListRow(r: PaymentFactListRow): PaymentFactHeaderView {
  return {
    guid: r.documentGUID, number: r.documentNumber, status: r.documentStatus, paymentFactNumber: r.paymentFactNumber, day: r.paymentFactDay ?? '', moneyAccountGUID: r.moneyAccountGUID,
    moneyAccountTitle: r.moneyAccountTitle, legalEntityTitle: r.legalEntityTitle, currency: r.currency, partnerGUID: r.partnerGUID, personGUID: r.personGUID, payeeTitle: r.payeeTitle, direction: r.direction,
    bankAmount: r.bankAmount, taskGUID: r.taskGUID, projectGUID: r.projectGUID, projectCount: r.projectCount, authorName: r.authorName,
  };
}
export const canEditPaymentFact = (h: PaymentFactHeaderView): boolean => h.status === 'draft';
export const canDeletePaymentFact = (h: PaymentFactHeaderView): boolean => h.status === 'draft';
export const canPostPaymentFact = (h: PaymentFactHeaderView, lineCount: number): boolean => h.status === 'draft' && lineCount > 0;
export const canUnpostPaymentFact = (h: PaymentFactHeaderView): boolean => h.status === 'posted';
/** the payee and the direction are fixed once the document has lines (the database refuses the change): delete the lines first */
export const canChangePayee = (h: PaymentFactHeaderView, lineCount: number): boolean => h.status === 'draft' && lineCount === 0;
/** "Get from plan" needs a draft; a payee, when the document has one, narrows the list */
export const canGetFromPlan = (h: PaymentFactHeaderView): boolean => h.status === 'draft';

/** what the user still has to fill before Post (the database refuses the same) */
export function paymentFactMissing(h: PaymentFactHeaderView, lineCount: number): PaymentFactProblemCode[] {
  const out: PaymentFactProblemCode[] = [];
  if (lineCount === 0) out.push('documentHasNoLines');
  if (!h.paymentFactNumber.trim()) out.push('paymentFactNumberMissing');
  if (!h.day) out.push('paymentFactDateMissing');
  if (!h.moneyAccountGUID) out.push('moneyAccountMissing');
  if (!h.partnerGUID && !h.personGUID) out.push('payeeMissing');
  if (!h.direction) out.push('directionMissing');
  return out;
}

// ---- the lines -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** the rows of ONE document */
export function paymentFactLinesOf(rows: any[] | null | undefined, headerGUID: string | null | undefined): any[] {
  return (rows || []).filter((r) => !!headerGUID && r.rowHeaderGUID === headerGUID);
}
export interface PaymentFactLineTotals {
  lineCount: number;
  /** the real bank amount: the amounts in the currency of the money account */
  sumForMoneyAccount: number;
  /** per contract currency (currencies are never added) */
  byCurrency: { currency: string; sumForContract: number }[];
  /** lines whose amount of the account is still empty (a rate is missing) */
  withoutAccountSum: number;
}
const jsonNum = (r: any, key: string): number | null => { const v = r?.rowJSON?.[key]; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
export function paymentFactTotals(rows: any[]): PaymentFactLineTotals {
  const by = new Map<string, number>();
  let account = 0;
  let missing = 0;
  for (const r of rows || []) {
    const cur = String(r?.rowJSON?.paymentFactCurrency ?? '');
    by.set(cur, round2((by.get(cur) ?? 0) + (jsonNum(r, 'sumForContract') ?? 0)));
    const a = jsonNum(r, 'sumForMoneyAccount');
    if (a === null) missing += 1; else account += a;
  }
  return { lineCount: (rows || []).length, sumForMoneyAccount: round2(account), byCurrency: [...by.entries()].map(([currency, sumForContract]) => ({ currency, sumForContract })).sort((a, b) => a.currency.localeCompare(b.currency)), withoutAccountSum: missing };
}
/** the control amount of the header against the lines: null = there is no control amount; else the difference (0 = equal) */
export function bankAmountDifference(bankAmount: number | null | undefined, totals: Pick<PaymentFactLineTotals, 'sumForMoneyAccount'>): number | null {
  if (bankAmount === null || bankAmount === undefined) return null;
  return round2(num(bankAmount) - totals.sumForMoneyAccount);
}
/** a line that is not what the plan said: another sum than what was open, or another contract / budget item / currency (paymentFactPlanSum = what the plan payment was when the line was made) */
export function lineDiffersFromPlan(row: any): boolean {
  if (!row?.paymentPlanLineGUID) return false;
  const plan = jsonNum(row, 'paymentFactPlanSum');
  const sum = jsonNum(row, 'sumForContract');
  return plan !== null && sum !== null && sum !== plan;
}
/** the problems of ONE line the user can see before Post (the database refuses the same); the texts are translated by the caller */
export function paymentFactLineErrors(row: any): string[] {
  const j = row?.rowJSON || {};
  const out: string[] = [];
  if (!j.paymentFactContract) out.push('A line needs a contract.');
  if (!j.paymentFactBudgetItem) out.push('A line needs a budget item.');
  if (!j.paymentFactCurrency) out.push('A line needs a currency (it comes from the contract).');
  const sum = jsonNum(row, 'sumForContract');
  if (sum === null || sum <= 0) out.push('A line needs a sum greater than 0.');
  if (typeof j.paymentFactFxProblem === 'string' && j.paymentFactFxProblem) out.push(j.paymentFactFxProblem);
  return out;
}

export const lineIsTyped = (row: any): boolean => row?.rowJSON?.moneyAccountSumSource === 'typed';
export const formatMoney = (n: number | null | undefined): string => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

// ---- the folders of the list: money account → payee ----------------------------------------------------------------------------------------------------------------------------------------------
export interface PaymentFactFolderNode { id: string; parentId: string | null; title: string; order: number }
/** what the documents have: the money accounts, and under each the payees paid from it (the folder id of a document is `account:payee`, made by the database) */
export function paymentFactFolderNodes(rows: Pick<PaymentFactListRow, 'moneyAccountGUID' | 'moneyAccountTitle' | 'partnerGUID' | 'personGUID' | 'payeeTitle'>[]): PaymentFactFolderNode[] {
  const accounts = new Map<string, string>();
  const pairs = new Map<string, { parent: string; title: string }>();
  for (const r of rows || []) {
    if (!r.moneyAccountGUID) continue;
    accounts.set(r.moneyAccountGUID, r.moneyAccountTitle || r.moneyAccountGUID);
    const payee = r.partnerGUID || r.personGUID;
    if (payee) pairs.set(`${r.moneyAccountGUID}:${payee}`, { parent: r.moneyAccountGUID, title: r.payeeTitle || payee });
  }
  const top = [...accounts.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, title], i): PaymentFactFolderNode => ({ id, parentId: null, title, order: i }));
  const sub = [...pairs.entries()].sort((a, b) => a[1].title.localeCompare(b[1].title)).map(([id, p], i): PaymentFactFolderNode => ({ id, parentId: p.parent, title: p.title, order: i }));
  return [...top, ...sub];
}

// ---- opening the form ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface OpenPaymentFactParams { taskGUID?: string | null; projectGUID?: string | null; documentGUID?: string | null; documents?: string[] | null }
export function paymentFactRouteParams(p: OpenPaymentFactParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.taskGUID) out.taskGUID = p.taskGUID;
  if (p.projectGUID) out.projectGUID = p.projectGUID;
  if (p.documentGUID) out.documentGUID = p.documentGUID;
  if (p.documents?.length) out.documents = p.documents.join(',');
  return out;
}
/** the documents of the form: the `documents` list of the route (a tab each), else the one document */
export function documentsOfRoute(documentGUID: string | null | undefined, documents: string | null | undefined): string[] {
  const list = String(documents || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (documentGUID && !list.includes(documentGUID)) list.unshift(documentGUID);
  return [...new Set(list)];
}
/** the path of ONE document for a browser tab of its own (web): the same form route with that single document */
export const paymentFactDocumentPath = (documentGUID: string): string => `${PAYMENT_FACT_ROUTE}?documentGUID=${encodeURIComponent(documentGUID)}`;

// ---- "Create based on → Payment fact" of a vendor / customer invoice ------------------------------------------------------------------------------------------------------------------------------
export type PaymentFactInvoiceKind = 'vendor' | 'customer';
/** only a POSTED invoice is paid */
export const canCreatePaymentFactFromInvoice = (h: { status: string } | null | undefined): boolean => !!h && h.status === 'posted';
export interface CreatedFromInvoice { documentGUID: string; lineCount: number; taskGUID: string | null }
export interface CreateFromInvoiceAnswer { documents: CreatedFromInvoice[]; skipped: { reason: string }[] }
export function parseCreateFromInvoiceAnswer(data: any): CreateFromInvoiceAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return {
    documents: (Array.isArray(d.documents) ? d.documents : []).map((x: any) => ({ documentGUID: String(x.documentGUID), lineCount: Number(x.lineCount) || 0, taskGUID: x.taskGUID ? String(x.taskGUID) : null })),
    skipped: (Array.isArray(d.skipped) ? d.skipped : []).map((x: any) => ({ reason: String(x.reason ?? '') })),
  };
}
export function createFromInvoiceSkippedText(reason: string): string {
  return reason === 'nothingToPay' ? 'Nothing is left to pay: every line of the invoice is paid by a posted payment fact.' : reason;
}
/** the item of the menu "Create based on" of an invoice */
export const PAYMENT_FACT_BASED_ON_ITEM = { id: 'paymentFact', title: 'Payment fact', icon: 'account_balance' } as const;
export const paymentFactBasedOnSubtitle = (kind: PaymentFactInvoiceKind): string => (kind === 'customer'
  ? 'One draft bank transaction (inbound) that receives what the customer still owes on this invoice'
  : 'One draft bank transaction (outbound) that pays what is still open on this invoice');
