// customerInvoiceModel - the CUSTOMER INVOICE document (made from the Deliverable = Revenue lines of a task, the twin of the vendor invoice; SQL: PART 31 of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql).
//   ONE document = ONE customer + ONE contract (or none). rowOwnerGUID of the header = the legal entity (not unique).
//   customer_invoice_header  rowJSON { documentHeader { activeUser · created_at · documentNumber CI-00001 · documentStatus draft | posted · postedAt · postedBy · unpostedAt },
//                          customerInvoicePartner · customerInvoiceContract · customerInvoiceDateTime · customerInvoiceNumber · customerInvoiceFolder (derived) · customerInvoiceCurrency (derived) }
//   customer_invoice_lines   the lines of a document: task line, genus, qtyInvoiced · priceInvoiced · vatRatioInvoiced, the sums computed by the database
// Pure (no React, no Supabase): the rules and the texts are tested without a screen. The 0333Effect rounding correction is NOT built (the user said so).
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import { parseDayInput } from '../../fact/input/factInputModel';

export const CUSTOMER_INVOICE_HEADER_TABLE = 'customer_invoice_header';
export const CUSTOMER_INVOICE_LINES_TABLE = 'customer_invoice_lines';
/** the redux entities (SystemMetaData, customerInvoiceMetaData.ts) */
export const CUSTOMER_INVOICE_HEADER_ENTITY = 'customerInvoiceHeader';
export const CUSTOMER_INVOICE_LINES_ENTITY = 'customerInvoiceLinesReusable';
export const RPC_CUSTOMER_CANDIDATES = 'customer_invoice_candidates';
export const RPC_CUSTOMER_CREATE = 'create_customer_invoices';
export const RPC_CUSTOMER_SET_HEADER = 'customer_invoice_set_header';
export const RPC_CUSTOMER_ADD_LINE = 'customer_invoice_add_line';
export const RPC_CUSTOMER_POST = 'post_customer_invoice';
export const RPC_CUSTOMER_UNPOST = 'unpost_customer_invoice';
export const RPC_CUSTOMER_DELETE = 'delete_customer_invoice';
export const RPC_CUSTOMER_LIST = 'customer_invoice_list';

/** the screens: the form (app/pm/project/task/customer-invoice), the choice of the customers (…/new), the list (hamburger menu → Documents → Customer invoices) */
export const CUSTOMER_INVOICE_ROUTE = '/pm/project/task/customer-invoice';
export const CUSTOMER_INVOICE_NEW_ROUTE = '/pm/project/task/customer-invoice/new';
export const CUSTOMER_INVOICE_LIST_ROUTE = '/pm/customer-invoice/list';
/** the registrator type of the movements of a posted customer invoice (project_status_movements.rowRegistratorType) */
export const CUSTOMER_INVOICE_REGISTRATOR_TYPE = 'customerInvoiceHeader';

export type CustomerInvoiceStatus = 'draft' | 'posted';
export type CustomerInvoiceProblemCode = 'documentIsPosted' | 'documentIsNotPosted' | 'documentHasNoLines' | 'invoiceNumberMissing' | 'invoiceDateMissing' | 'quantityIsZero' | 'notYourProject' | 'customerMissing' | 'legalEntityMissing';

/** the tabs of the document: All (default) · Deliverable (the Revenue lines) */
export const CUSTOMER_INVOICE_ALL_TAB = 'all';
export const CUSTOMER_INVOICE_TABS: { id: string; title: string; icon: string; genus: string | null }[] = [
  { id: CUSTOMER_INVOICE_ALL_TAB, title: 'All', icon: 'select_all', genus: null },
  { id: MANAGEMENT_GENUS.revenue, title: 'Deliverable', icon: 'payments', genus: MANAGEMENT_GENUS.revenue },
];
export const customerInvoiceTabOf = (id: string | null | undefined): string => (CUSTOMER_INVOICE_TABS.some((t) => t.id === id) ? (id as string) : CUSTOMER_INVOICE_ALL_TAB);

// ---- the customers of the lines of a task (customer_invoice_candidates) ----------------------------------------------------------------------------------------------
export interface CustomerCandidate {
  partnerGUID: string;
  partnerTitle: string;
  contractGUID: string | null;
  contractInfo: string | null;
  contractCurrency: string | null;
  legalEntityGUID: string | null;
  lineCount: number;
  lineGUIDs: string[];
}
/** `skipped` lines have no customer (no contract and no partner); `skippedLineGUIDs` are those lines: ONE draft without a customer is made of them (the customer is chosen in the form) */
export interface CustomerCandidatesAnswer { rows: CustomerCandidate[]; skipped: number; skippedLineGUIDs: string[]; /** project setting userCanCreateCustomerInvoicesFromTasksWithEmptyCustomers (default true) */ noCustomerAllowed: boolean }
export function parseCandidates(data: any): CustomerCandidatesAnswer {
  const d = data && typeof data === 'object' ? data : {};
  const rows: CustomerCandidate[] = (Array.isArray(d.rows) ? d.rows : []).map((r: any) => ({
    partnerGUID: String(r.partnerGUID),
    partnerTitle: String(r.partnerTitle ?? r.partnerGUID ?? ''),
    contractGUID: r.contractGUID ? String(r.contractGUID) : null,
    contractInfo: r.contractInfo ? String(r.contractInfo) : null,
    contractCurrency: r.contractCurrency ? String(r.contractCurrency) : null,
    legalEntityGUID: r.legalEntityGUID ? String(r.legalEntityGUID) : null,
    lineCount: Number(r.lineCount) || 0,
    lineGUIDs: Array.isArray(r.lineGUIDs) ? r.lineGUIDs.map(String) : [],
  }));
  return { rows, skipped: Number(d.skipped) || 0, skippedLineGUIDs: Array.isArray(d.skippedLineGUIDs) ? d.skippedLineGUIDs.map(String) : [], noCustomerAllowed: d.noCustomerAllowed !== false };
}
/** the key of a (customer, contract) pair: ONE document each */
export const candidateKey = (c: Pick<CustomerCandidate, 'partnerGUID' | 'contractGUID'>): string => `${c.partnerGUID}|${c.contractGUID ?? ''}`;
/** the key of the document without a customer (the lines that have none): checked like a customer row */
export const NO_CUSTOMER_KEY = 'noCustomer';
export interface CustomerSelection { partnerGUID: string | null; contractGUID: string | null; lineGUIDs: string[] }
/** the selection the RPC takes: the checked customer pairs and, when NO_CUSTOMER_KEY is checked, ONE document without a customer of the lines that have none */
export const candidateSelection = (rows: CustomerCandidate[], checked: ReadonlySet<string>, noCustomerLineGUIDs: string[] = []): CustomerSelection[] => [
  ...rows.filter((r) => checked.has(candidateKey(r))).map((r) => ({ partnerGUID: r.partnerGUID as string | null, contractGUID: r.contractGUID, lineGUIDs: r.lineGUIDs })),
  ...(noCustomerLineGUIDs.length && checked.has(NO_CUSTOMER_KEY) ? [{ partnerGUID: null, contractGUID: null, lineGUIDs: noCustomerLineGUIDs }] : []),
];
/** the legal entity the window has to ask for: every checked pair that has none of its own (its contract names none) needs the one chosen in the window */
export const needsLegalEntity = (rows: CustomerCandidate[], checked: ReadonlySet<string>): boolean => rows.some((r) => checked.has(candidateKey(r)) && !r.legalEntityGUID);

/**
 * The context menu "Customer Invoice" creates the documents at once ("quick create"): every customer + contract of the lines is taken (no choice window).
 * The window stays for what needs a person: no customer found (it says why) or a contract without a legal entity (it asks for it).
 */
export type QuickCustomerInvoicePlan = { kind: 'create'; selection: CustomerSelection[] } | { kind: 'choose' };
export function quickCustomerInvoicePlan(rows: CustomerCandidate[], noCustomerLineGUIDs: string[] = []): QuickCustomerInvoicePlan {
  const all = new Set([...rows.map(candidateKey), ...(noCustomerLineGUIDs.length ? [NO_CUSTOMER_KEY] : [])]);
  if (!all.size || needsLegalEntity(rows, all)) return { kind: 'choose' };
  return { kind: 'create', selection: candidateSelection(rows, all, noCustomerLineGUIDs) };
}
/** which lines the quick create takes: a line of the Finances table asks (this line / the whole task), the task tree takes the whole task */
export type CustomerInvoiceScope = 'line' | 'task';
export const DEFAULT_CUSTOMER_INVOICE_SCOPE: CustomerInvoiceScope = 'line';
export const customerInvoiceLinesOfScope = (scope: CustomerInvoiceScope, lineGUID: string): string[] | undefined => (scope === 'line' ? [lineGUID] : undefined);

export interface CreatedDocument { documentGUID: string; partnerGUID: string | null; contractGUID: string | null; lineCount: number }
export interface CreateAnswer { documents: CreatedDocument[]; skipped: { partnerGUID: string | null; contractGUID: string | null; reason: string }[] }
export function parseCreateAnswer(data: any): CreateAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return {
    documents: (Array.isArray(d.documents) ? d.documents : []).map((x: any) => ({ documentGUID: String(x.documentGUID), partnerGUID: x.partnerGUID ? String(x.partnerGUID) : null, contractGUID: x.contractGUID ? String(x.contractGUID) : null, lineCount: Number(x.lineCount) || 0 })),
    skipped: (Array.isArray(d.skipped) ? d.skipped : []).map((x: any) => ({ partnerGUID: x.partnerGUID ? String(x.partnerGUID) : null, contractGUID: x.contractGUID ? String(x.contractGUID) : null, reason: String(x.reason ?? '') })),
  };
}

// ---- the list (customer_invoice_list) -------------------------------------------------------------------------------------------------------------------------------
export interface CustomerInvoiceListRow {
  documentGUID: string;
  documentNumber: string;
  documentStatus: CustomerInvoiceStatus;
  customerInvoiceNumber: string;
  customerInvoiceDateTime: string | null;
  customerInvoiceDay: string | null;
  legalEntityGUID: string;
  legalEntityTitle: string;
  partnerGUID: string;
  partnerTitle: string;
  contractGUID: string | null;
  contractInfo: string;
  currency: string;
  folder: string;
  /** the task the document was made from; the project setting independentInvoiceInputAvailable (lines can be added by hand to a draft) */
  taskGUID: string;
  /** the project of the document (header field customerInvoiceProject) and its name; independentInputAvailable = ITS setting independentInvoiceInputAvailable */
  projectGUID: string;
  projectName: string;
  independentInputAvailable: boolean;
  authorGUID: string;
  authorName: string;
  lineCount: number;
  sumBeforeVAT: number;
  sumVAT: number;
  sumWithVAT: number;
}
export interface CustomerInvoiceCurrencyTotal { currency: string; count: number; sumBeforeVAT: number; sumVAT: number; sumWithVAT: number }
export interface CustomerInvoiceListAnswer { totalCount: number; totalsByCurrency: CustomerInvoiceCurrencyTotal[]; rows: CustomerInvoiceListRow[] }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? round2(n) : 0; };
export function parseListAnswer(data: any): CustomerInvoiceListAnswer {
  const d = data && typeof data === 'object' ? data : {};
  const rows: CustomerInvoiceListRow[] = (Array.isArray(d.rows) ? d.rows : []).map((r: any) => ({
    documentGUID: String(r.documentGUID),
    documentNumber: String(r.documentNumber ?? ''),
    documentStatus: r.documentStatus === 'posted' ? 'posted' : 'draft',
    customerInvoiceNumber: String(r.customerInvoiceNumber ?? ''),
    customerInvoiceDateTime: r.customerInvoiceDateTime ?? null,
    customerInvoiceDay: r.customerInvoiceDay ?? null,
    legalEntityGUID: String(r.legalEntityGUID ?? ''),
    legalEntityTitle: String(r.legalEntityTitle ?? ''),
    partnerGUID: String(r.partnerGUID ?? ''),
    partnerTitle: String(r.partnerTitle ?? ''),
    contractGUID: r.contractGUID ? String(r.contractGUID) : null,
    contractInfo: String(r.contractInfo ?? ''),
    currency: String(r.currency ?? ''),
    folder: String(r.folder ?? ''),
    taskGUID: String(r.taskGUID ?? ''),
    projectGUID: String(r.projectGUID ?? ''),
    projectName: String(r.projectName ?? ''),
    independentInputAvailable: !!r.independentInputAvailable,
    authorGUID: String(r.authorGUID ?? ''),
    authorName: String(r.authorName ?? ''),
    lineCount: Number(r.lineCount) || 0,
    sumBeforeVAT: money(r.sumBeforeVAT),
    sumVAT: money(r.sumVAT),
    sumWithVAT: money(r.sumWithVAT),
  }));
  return {
    totalCount: Number(d.totalCount) || 0,
    totalsByCurrency: (Array.isArray(d.totalsByCurrency) ? d.totalsByCurrency : []).map((t: any) => ({ currency: String(t.currency ?? ''), count: Number(t.count) || 0, sumBeforeVAT: money(t.sumBeforeVAT), sumVAT: money(t.sumVAT), sumWithVAT: money(t.sumWithVAT) })),
    rows,
  };
}

/** the filters of the list: every column that is not a number (quick filters), each with a Clear icon in its field */
export interface CustomerInvoiceListFilter {
  number: string;
  fromDay: string;
  toDay: string;
  legalEntityGUID: string;
  partnerGUID: string;
  contractGUID: string;
  currency: string;
  status: string;
  author: string;
}
export const EMPTY_CUSTOMER_INVOICE_FILTER: CustomerInvoiceListFilter = { number: '', fromDay: '', toDay: '', legalEntityGUID: '', partnerGUID: '', contractGUID: '', currency: '', status: '', author: '' };
export const customerInvoiceFilterActive = (f: CustomerInvoiceListFilter): boolean => Object.values(f).some((v) => String(v || '').trim() !== '');
/** an unreadable date is an error of the field, not a filter */
export const customerInvoiceDateErrors = (f: CustomerInvoiceListFilter): { fromDay: boolean; toDay: boolean } => ({
  fromDay: !!f.fromDay.trim() && parseDayInput(f.fromDay) === null,
  toDay: !!f.toDay.trim() && parseDayInput(f.toDay) === null,
});
export function customerInvoiceFilterToRpc(f: CustomerInvoiceListFilter, extra: Record<string, any> = {}): Record<string, any> {
  const out: Record<string, any> = { ...extra };
  const from = parseDayInput(f.fromDay);
  const to = parseDayInput(f.toDay);
  if (from) out.fromDay = from;
  if (to) out.toDay = to;
  for (const k of ['number', 'legalEntityGUID', 'partnerGUID', 'contractGUID', 'currency', 'status', 'author'] as const) {
    if (f[k].trim()) out[k] = f[k].trim();
  }
  return out;
}

// ---- the header of the form ---------------------------------------------------------------------------------------------------------------------------------------
export interface CustomerInvoiceHeaderView {
  guid: string;
  number: string;
  status: CustomerInvoiceStatus;
  customerInvoiceNumber: string;
  /** 'YYYY-MM-DD' ('' = not set) */
  day: string;
  legalEntityGUID: string;
  partnerGUID: string;
  contractGUID: string | null;
  currency: string;
  authorName: string;
  partnerTitle: string;
  contractInfo: string;
  legalEntityTitle: string;
  /** optional so a test / a caller can leave them out: false */
  taskGUID?: string;
  projectGUID?: string;
  projectName?: string;
  independentInputAvailable?: boolean;
}
export function headerOfListRow(r: CustomerInvoiceListRow): CustomerInvoiceHeaderView {
  return {
    guid: r.documentGUID, number: r.documentNumber, status: r.documentStatus, customerInvoiceNumber: r.customerInvoiceNumber, day: r.customerInvoiceDay ?? '',
    legalEntityGUID: r.legalEntityGUID, partnerGUID: r.partnerGUID, contractGUID: r.contractGUID, currency: r.currency, authorName: r.authorName,
    partnerTitle: r.partnerTitle, contractInfo: r.contractInfo, legalEntityTitle: r.legalEntityTitle,
    taskGUID: r.taskGUID, projectGUID: r.projectGUID, projectName: r.projectName, independentInputAvailable: r.independentInputAvailable,
  };
}
export const canEditCustomerInvoice = (h: CustomerInvoiceHeaderView): boolean => h.status === 'draft';
export const canDeleteCustomerInvoice = (h: CustomerInvoiceHeaderView): boolean => h.status === 'draft';
export const canPostCustomerInvoice = (h: CustomerInvoiceHeaderView, lineCount: number): boolean => h.status === 'draft' && lineCount > 0;
export const canUnpostCustomerInvoice = (h: CustomerInvoiceHeaderView): boolean => h.status === 'posted';

/** what the user still has to fill before Post (the database refuses the same) */
export function customerInvoiceMissing(h: CustomerInvoiceHeaderView, lineCount: number): CustomerInvoiceProblemCode[] {
  const out: CustomerInvoiceProblemCode[] = [];
  if (lineCount === 0) out.push('documentHasNoLines');
  if (!h.partnerGUID) out.push('customerMissing');
  if (!h.legalEntityGUID) out.push('legalEntityMissing');
  if (!h.customerInvoiceNumber.trim()) out.push('invoiceNumberMissing');
  if (!h.day) out.push('invoiceDateMissing');
  return out;
}

export interface CustomerInvoicePostProblem { lineGUID: string | null; problem: CustomerInvoiceProblemCode | string }
export interface CustomerInvoicePostAnswer { status: 'posted' | 'refused' | 'draft'; lines: number; problems: CustomerInvoicePostProblem[] }
export function parsePostAnswer(data: any): CustomerInvoicePostAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return { status: d.status === 'posted' ? 'posted' : d.status === 'draft' ? 'draft' : 'refused', lines: Number(d.lines) || 0, problems: (Array.isArray(d.problems) ? d.problems : []).map((p: any) => ({ lineGUID: p.lineGUID ?? null, problem: String(p.problem ?? '') })) };
}
export function customerInvoiceProblemText(code: string): string {
  switch (code) {
    case 'documentIsPosted': return 'The document is already posted.';
    case 'documentIsNotPosted': return 'The document is not posted.';
    case 'documentHasNoLines': return 'The document has no lines.';
    case 'customerMissing': return 'Choose the customer of the customer invoice.';
    case 'legalEntityMissing': return 'Choose the legal entity of the customer invoice.';
    case 'invoiceNumberMissing': return 'Enter the number printed on the customer invoice.';
    case 'invoiceDateMissing': return 'Enter the date of the customer invoice.';
    case 'quantityIsZero': return 'A line has the quantity 0: delete it or enter the quantity.';
    case 'notYourProject': return 'A line belongs to a project that is not yours: only its owner can post this invoice.';
    default: return code;
  }
}

// ---- the lines -----------------------------------------------------------------------------------------------------------------------------------------------------
/** the rows of ONE document and, on a genus tab, of that genus */
export function customerInvoiceLinesOf(rows: any[] | null | undefined, headerGUID: string | null | undefined, tab: string = CUSTOMER_INVOICE_ALL_TAB): any[] {
  const genus = CUSTOMER_INVOICE_TABS.find((t) => t.id === tab)?.genus ?? null;
  return (rows || []).filter((r) => !!headerGUID && r.rowHeaderGUID === headerGUID && (genus === null || r.genusGUID === genus));
}
export interface CustomerInvoiceLineTotals { lineCount: number; sumBeforeVAT: number; sumVAT: number; sumWithVAT: number }
const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
export function customerInvoiceTotals(rows: any[]): CustomerInvoiceLineTotals {
  const sumBeforeVAT = round2((rows || []).reduce((a, r) => a + num(r.sumForContract), 0));
  const sumVAT = round2((rows || []).reduce((a, r) => a + num(r.vatForContract), 0));
  return { lineCount: (rows || []).length, sumBeforeVAT, sumVAT, sumWithVAT: round2(sumBeforeVAT + sumVAT) };
}
/** the twin of the database trigger: the sums of a line from its quantity, price and VAT % (the budget / accounting sums need the rate of the plan, which only the database has) */
export function customerInvoiceLineSums(qty: number, price: number, vatRatio: number): { sumForContract: number; vatForContract: number } {
  const sumForContract = round2(num(qty) * num(price));
  return { sumForContract, vatForContract: round2(sumForContract * num(vatRatio) / 100) };
}
export const formatMoney = (n: number | null | undefined): string => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

// ---- the folders of the list: legal entity → customer ------------------------------------------------------------------------------------------------------------------
export interface CustomerFolderNode { id: string; parentId: string | null; title: string; order: number }
/** the tree of the list = what the documents have: the legal entities, and under each the customers that invoiced it (the folder id of a document is `legalEntity:customer`, made by the database) */
export function customerInvoiceFolderNodes(rows: Pick<CustomerInvoiceListRow, 'legalEntityGUID' | 'legalEntityTitle' | 'partnerGUID' | 'partnerTitle'>[]): CustomerFolderNode[] {
  const entities = new Map<string, string>();
  const pairs = new Map<string, { parent: string; title: string }>();
  for (const r of rows || []) {
    if (!r.legalEntityGUID) continue;
    entities.set(r.legalEntityGUID, r.legalEntityTitle || r.legalEntityGUID);
    if (r.partnerGUID) pairs.set(`${r.legalEntityGUID}:${r.partnerGUID}`, { parent: r.legalEntityGUID, title: r.partnerTitle || r.partnerGUID });
  }
  const top = [...entities.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, title], i): CustomerFolderNode => ({ id, parentId: null, title, order: i }));
  const sub = [...pairs.entries()].sort((a, b) => a[1].title.localeCompare(b[1].title)).map(([id, p], i): CustomerFolderNode => ({ id, parentId: p.parent, title: p.title, order: i }));
  return [...top, ...sub];
}

// ---- opening the form ------------------------------------------------------------------------------------------------------------------------------------------------
export interface OpenCustomerInvoiceParams { taskGUID: string; projectGUID?: string | null; lineGUIDs?: string[] | null; documentGUID?: string | null; documents?: string[] | null }
export function customerInvoiceRouteParams(p: OpenCustomerInvoiceParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.taskGUID) out.taskGUID = p.taskGUID;
  if (p.projectGUID) out.projectGUID = p.projectGUID;
  if (p.lineGUIDs?.length) out.lineGUIDs = p.lineGUIDs.join(',');
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
export const customerInvoiceDocumentPath = (documentGUID: string): string => `${CUSTOMER_INVOICE_ROUTE}?documentGUID=${encodeURIComponent(documentGUID)}`;

