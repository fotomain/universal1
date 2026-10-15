// vendorInvoiceModel - the VENDOR INVOICE document (documentation/PROJECT_STATE_WBS.html; SQL: PART 26 of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql).
//   ONE document = ONE vendor + ONE contract (or none). rowOwnerGUID of the header = the legal entity (not unique).
//   vendor_invoice_header  rowJSON { documentHeader { activeUser · created_at · documentNumber VI-00001 · documentStatus draft | posted · postedAt · postedBy · unpostedAt },
//                          vendorInvoicePartner · vendorInvoiceContract · vendorInvoiceDateTime · vendorInvoiceNumber · vendorInvoiceFolder (derived) · vendorInvoiceCurrency (derived) }
//   vendor_invoice_lines   the lines of a document: task line, genus, qtyInvoiced · priceInvoiced · vatRatioInvoiced, the sums computed by the database
// Pure (no React, no Supabase): the rules and the texts are tested without a screen. The 0333Effect rounding correction is NOT built (the user said so).
import { MANAGEMENT_GENUS } from '../../catalog/management/genus/managementGenusModel';
import { parseDayInput } from '../fact/factInputModel';

export const VENDOR_INVOICE_HEADER_TABLE = 'vendor_invoice_header';
export const VENDOR_INVOICE_LINES_TABLE = 'vendor_invoice_lines';
/** the redux entities (SystemMetaData, vendorInvoiceMetaData.ts) */
export const VENDOR_INVOICE_HEADER_ENTITY = 'vendorInvoiceHeader';
export const VENDOR_INVOICE_LINES_ENTITY = 'vendorInvoiceLinesReusable';
export const RPC_VENDOR_CANDIDATES = 'vendor_invoice_candidates';
export const RPC_VENDOR_CREATE = 'create_vendor_invoices';
export const RPC_VENDOR_SET_HEADER = 'vendor_invoice_set_header';
export const RPC_VENDOR_ADD_LINE = 'vendor_invoice_add_line';
export const RPC_VENDOR_POST = 'post_vendor_invoice';
export const RPC_VENDOR_UNPOST = 'unpost_vendor_invoice';
export const RPC_VENDOR_DELETE = 'delete_vendor_invoice';
export const RPC_VENDOR_LIST = 'vendor_invoice_list';

/** the screens: the form (app/pm/project/task/vendor-invoice), the choice of the vendors (…/new), the list (hamburger menu → Budgets → Vendor invoices) */
export const VENDOR_INVOICE_ROUTE = '/pm/project/task/vendor-invoice';
export const VENDOR_INVOICE_NEW_ROUTE = '/pm/project/task/vendor-invoice/new';
export const VENDOR_INVOICE_LIST_ROUTE = '/pm/vendor-invoice/list';
/** the registrator type of the movements of a posted vendor invoice (project_status_movements.rowRegistratorType) */
export const VENDOR_INVOICE_REGISTRATOR_TYPE = 'vendorInvoiceHeader';

export type VendorInvoiceStatus = 'draft' | 'posted';
export type VendorInvoiceProblemCode = 'documentIsPosted' | 'documentIsNotPosted' | 'documentHasNoLines' | 'invoiceNumberMissing' | 'invoiceDateMissing' | 'quantityIsZero' | 'notYourProject' | 'vendorMissing' | 'legalEntityMissing';

/** the tabs of the document: All (default) · Time · Material · Expenses - exactly as the Finances table of a task */
export const VENDOR_INVOICE_ALL_TAB = 'all';
export const VENDOR_INVOICE_TABS: { id: string; title: string; icon: string; genus: string | null }[] = [
  { id: VENDOR_INVOICE_ALL_TAB, title: 'All', icon: 'select_all', genus: null },
  { id: MANAGEMENT_GENUS.time, title: 'Time', icon: 'schedule', genus: MANAGEMENT_GENUS.time },
  { id: MANAGEMENT_GENUS.material, title: 'Material', icon: 'inventory_2', genus: MANAGEMENT_GENUS.material },
  { id: MANAGEMENT_GENUS.expense, title: 'Expenses', icon: 'receipt_long', genus: MANAGEMENT_GENUS.expense },
];
export const vendorInvoiceTabOf = (id: string | null | undefined): string => (VENDOR_INVOICE_TABS.some((t) => t.id === id) ? (id as string) : VENDOR_INVOICE_ALL_TAB);

// ---- the vendors of the lines of a task (vendor_invoice_candidates) ----------------------------------------------------------------------------------------------
export interface VendorCandidate {
  partnerGUID: string;
  partnerTitle: string;
  contractGUID: string | null;
  contractInfo: string | null;
  contractCurrency: string | null;
  legalEntityGUID: string | null;
  lineCount: number;
  lineGUIDs: string[];
}
/** `skipped` lines have no vendor (no contract, partner or main vendor); `skippedLineGUIDs` are those lines: ONE draft without a vendor is made of them (the vendor is chosen in the form) */
export interface VendorCandidatesAnswer { rows: VendorCandidate[]; skipped: number; skippedLineGUIDs: string[]; /** project setting userCanCreateVendorInvoicesFromTasksWithEmptyVendors (default true) */ noVendorAllowed: boolean }
export function parseCandidates(data: any): VendorCandidatesAnswer {
  const d = data && typeof data === 'object' ? data : {};
  const rows: VendorCandidate[] = (Array.isArray(d.rows) ? d.rows : []).map((r: any) => ({
    partnerGUID: String(r.partnerGUID),
    partnerTitle: String(r.partnerTitle ?? r.partnerGUID ?? ''),
    contractGUID: r.contractGUID ? String(r.contractGUID) : null,
    contractInfo: r.contractInfo ? String(r.contractInfo) : null,
    contractCurrency: r.contractCurrency ? String(r.contractCurrency) : null,
    legalEntityGUID: r.legalEntityGUID ? String(r.legalEntityGUID) : null,
    lineCount: Number(r.lineCount) || 0,
    lineGUIDs: Array.isArray(r.lineGUIDs) ? r.lineGUIDs.map(String) : [],
  }));
  return { rows, skipped: Number(d.skipped) || 0, skippedLineGUIDs: Array.isArray(d.skippedLineGUIDs) ? d.skippedLineGUIDs.map(String) : [], noVendorAllowed: d.noVendorAllowed !== false };
}
/** the key of a (vendor, contract) pair: ONE document each */
export const candidateKey = (c: Pick<VendorCandidate, 'partnerGUID' | 'contractGUID'>): string => `${c.partnerGUID}|${c.contractGUID ?? ''}`;
/** the key of the document without a vendor (the lines that have none): checked like a vendor row */
export const NO_VENDOR_KEY = 'noVendor';
export interface VendorSelection { partnerGUID: string | null; contractGUID: string | null; lineGUIDs: string[] }
/** the selection the RPC takes: the checked vendor pairs and, when NO_VENDOR_KEY is checked, ONE document without a vendor of the lines that have none */
export const candidateSelection = (rows: VendorCandidate[], checked: ReadonlySet<string>, noVendorLineGUIDs: string[] = []): VendorSelection[] => [
  ...rows.filter((r) => checked.has(candidateKey(r))).map((r) => ({ partnerGUID: r.partnerGUID as string | null, contractGUID: r.contractGUID, lineGUIDs: r.lineGUIDs })),
  ...(noVendorLineGUIDs.length && checked.has(NO_VENDOR_KEY) ? [{ partnerGUID: null, contractGUID: null, lineGUIDs: noVendorLineGUIDs }] : []),
];
/** the legal entity the window has to ask for: every checked pair that has none of its own (its contract names none) needs the one chosen in the window */
export const needsLegalEntity = (rows: VendorCandidate[], checked: ReadonlySet<string>): boolean => rows.some((r) => checked.has(candidateKey(r)) && !r.legalEntityGUID);

/**
 * The context menu "Vendor Invoice" creates the documents at once ("quick create"): every vendor + contract of the lines is taken (no choice window).
 * The window stays for what needs a person: no vendor found (it says why) or a contract without a legal entity (it asks for it).
 */
export type QuickVendorInvoicePlan = { kind: 'create'; selection: VendorSelection[] } | { kind: 'choose' };
export function quickVendorInvoicePlan(rows: VendorCandidate[], noVendorLineGUIDs: string[] = []): QuickVendorInvoicePlan {
  const all = new Set([...rows.map(candidateKey), ...(noVendorLineGUIDs.length ? [NO_VENDOR_KEY] : [])]);
  if (!all.size || needsLegalEntity(rows, all)) return { kind: 'choose' };
  return { kind: 'create', selection: candidateSelection(rows, all, noVendorLineGUIDs) };
}
/** which lines the quick create takes: a line of the Finances table asks (this line / the whole task), the task tree takes the whole task */
export type VendorInvoiceScope = 'line' | 'task';
export const DEFAULT_VENDOR_INVOICE_SCOPE: VendorInvoiceScope = 'line';
export const vendorInvoiceLinesOfScope = (scope: VendorInvoiceScope, lineGUID: string): string[] | undefined => (scope === 'line' ? [lineGUID] : undefined);

export interface CreatedDocument { documentGUID: string; partnerGUID: string | null; contractGUID: string | null; lineCount: number }
export interface CreateAnswer { documents: CreatedDocument[]; skipped: { partnerGUID: string | null; contractGUID: string | null; reason: string }[] }
export function parseCreateAnswer(data: any): CreateAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return {
    documents: (Array.isArray(d.documents) ? d.documents : []).map((x: any) => ({ documentGUID: String(x.documentGUID), partnerGUID: x.partnerGUID ? String(x.partnerGUID) : null, contractGUID: x.contractGUID ? String(x.contractGUID) : null, lineCount: Number(x.lineCount) || 0 })),
    skipped: (Array.isArray(d.skipped) ? d.skipped : []).map((x: any) => ({ partnerGUID: x.partnerGUID ? String(x.partnerGUID) : null, contractGUID: x.contractGUID ? String(x.contractGUID) : null, reason: String(x.reason ?? '') })),
  };
}

// ---- the list (vendor_invoice_list) -------------------------------------------------------------------------------------------------------------------------------
export interface VendorInvoiceListRow {
  documentGUID: string;
  documentNumber: string;
  documentStatus: VendorInvoiceStatus;
  vendorInvoiceNumber: string;
  vendorInvoiceDateTime: string | null;
  vendorInvoiceDay: string | null;
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
  /** the project of the document (header field vendorInvoiceProject) and its name; independentInputAvailable = ITS setting independentInvoiceInputAvailable */
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
export interface VendorInvoiceCurrencyTotal { currency: string; count: number; sumBeforeVAT: number; sumVAT: number; sumWithVAT: number }
export interface VendorInvoiceListAnswer { totalCount: number; totalsByCurrency: VendorInvoiceCurrencyTotal[]; rows: VendorInvoiceListRow[] }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? round2(n) : 0; };
export function parseListAnswer(data: any): VendorInvoiceListAnswer {
  const d = data && typeof data === 'object' ? data : {};
  const rows: VendorInvoiceListRow[] = (Array.isArray(d.rows) ? d.rows : []).map((r: any) => ({
    documentGUID: String(r.documentGUID),
    documentNumber: String(r.documentNumber ?? ''),
    documentStatus: r.documentStatus === 'posted' ? 'posted' : 'draft',
    vendorInvoiceNumber: String(r.vendorInvoiceNumber ?? ''),
    vendorInvoiceDateTime: r.vendorInvoiceDateTime ?? null,
    vendorInvoiceDay: r.vendorInvoiceDay ?? null,
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
export interface VendorInvoiceListFilter {
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
export const EMPTY_VENDOR_INVOICE_FILTER: VendorInvoiceListFilter = { number: '', fromDay: '', toDay: '', legalEntityGUID: '', partnerGUID: '', contractGUID: '', currency: '', status: '', author: '' };
export const vendorInvoiceFilterActive = (f: VendorInvoiceListFilter): boolean => Object.values(f).some((v) => String(v || '').trim() !== '');
/** an unreadable date is an error of the field, not a filter */
export const vendorInvoiceDateErrors = (f: VendorInvoiceListFilter): { fromDay: boolean; toDay: boolean } => ({
  fromDay: !!f.fromDay.trim() && parseDayInput(f.fromDay) === null,
  toDay: !!f.toDay.trim() && parseDayInput(f.toDay) === null,
});
export function vendorInvoiceFilterToRpc(f: VendorInvoiceListFilter, extra: Record<string, any> = {}): Record<string, any> {
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
export interface VendorInvoiceHeaderView {
  guid: string;
  number: string;
  status: VendorInvoiceStatus;
  vendorInvoiceNumber: string;
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
export function headerOfListRow(r: VendorInvoiceListRow): VendorInvoiceHeaderView {
  return {
    guid: r.documentGUID, number: r.documentNumber, status: r.documentStatus, vendorInvoiceNumber: r.vendorInvoiceNumber, day: r.vendorInvoiceDay ?? '',
    legalEntityGUID: r.legalEntityGUID, partnerGUID: r.partnerGUID, contractGUID: r.contractGUID, currency: r.currency, authorName: r.authorName,
    partnerTitle: r.partnerTitle, contractInfo: r.contractInfo, legalEntityTitle: r.legalEntityTitle,
    taskGUID: r.taskGUID, projectGUID: r.projectGUID, projectName: r.projectName, independentInputAvailable: r.independentInputAvailable,
  };
}
export const canEditVendorInvoice = (h: VendorInvoiceHeaderView): boolean => h.status === 'draft';
export const canDeleteVendorInvoice = (h: VendorInvoiceHeaderView): boolean => h.status === 'draft';
export const canPostVendorInvoice = (h: VendorInvoiceHeaderView, lineCount: number): boolean => h.status === 'draft' && lineCount > 0;
export const canUnpostVendorInvoice = (h: VendorInvoiceHeaderView): boolean => h.status === 'posted';

/** what the user still has to fill before Post (the database refuses the same) */
export function vendorInvoiceMissing(h: VendorInvoiceHeaderView, lineCount: number): VendorInvoiceProblemCode[] {
  const out: VendorInvoiceProblemCode[] = [];
  if (lineCount === 0) out.push('documentHasNoLines');
  if (!h.partnerGUID) out.push('vendorMissing');
  if (!h.legalEntityGUID) out.push('legalEntityMissing');
  if (!h.vendorInvoiceNumber.trim()) out.push('invoiceNumberMissing');
  if (!h.day) out.push('invoiceDateMissing');
  return out;
}

export interface VendorInvoicePostProblem { lineGUID: string | null; problem: VendorInvoiceProblemCode | string }
export interface VendorInvoicePostAnswer { status: 'posted' | 'refused' | 'draft'; lines: number; problems: VendorInvoicePostProblem[] }
export function parsePostAnswer(data: any): VendorInvoicePostAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return { status: d.status === 'posted' ? 'posted' : d.status === 'draft' ? 'draft' : 'refused', lines: Number(d.lines) || 0, problems: (Array.isArray(d.problems) ? d.problems : []).map((p: any) => ({ lineGUID: p.lineGUID ?? null, problem: String(p.problem ?? '') })) };
}
export function vendorInvoiceProblemText(code: string): string {
  switch (code) {
    case 'documentIsPosted': return 'The document is already posted.';
    case 'documentIsNotPosted': return 'The document is not posted.';
    case 'documentHasNoLines': return 'The document has no lines.';
    case 'vendorMissing': return 'Choose the vendor of the vendor invoice.';
    case 'legalEntityMissing': return 'Choose the legal entity of the vendor invoice.';
    case 'invoiceNumberMissing': return 'Enter the number printed on the vendor invoice.';
    case 'invoiceDateMissing': return 'Enter the date of the vendor invoice.';
    case 'quantityIsZero': return 'A line has the quantity 0: delete it or enter the quantity.';
    case 'notYourProject': return 'A line belongs to a project that is not yours: only its owner can post this invoice.';
    default: return code;
  }
}

// ---- the lines -----------------------------------------------------------------------------------------------------------------------------------------------------
/** the rows of ONE document and, on a genus tab, of that genus */
export function vendorInvoiceLinesOf(rows: any[] | null | undefined, headerGUID: string | null | undefined, tab: string = VENDOR_INVOICE_ALL_TAB): any[] {
  const genus = VENDOR_INVOICE_TABS.find((t) => t.id === tab)?.genus ?? null;
  return (rows || []).filter((r) => !!headerGUID && r.rowHeaderGUID === headerGUID && (genus === null || r.genusGUID === genus));
}
export interface VendorInvoiceLineTotals { lineCount: number; sumBeforeVAT: number; sumVAT: number; sumWithVAT: number }
const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
export function vendorInvoiceTotals(rows: any[]): VendorInvoiceLineTotals {
  const sumBeforeVAT = round2((rows || []).reduce((a, r) => a + num(r.sumForContract), 0));
  const sumVAT = round2((rows || []).reduce((a, r) => a + num(r.vatForContract), 0));
  return { lineCount: (rows || []).length, sumBeforeVAT, sumVAT, sumWithVAT: round2(sumBeforeVAT + sumVAT) };
}
/** the twin of the database trigger: the sums of a line from its quantity, price and VAT % (the budget / accounting sums need the rate of the plan, which only the database has) */
export function vendorInvoiceLineSums(qty: number, price: number, vatRatio: number): { sumForContract: number; vatForContract: number } {
  const sumForContract = round2(num(qty) * num(price));
  return { sumForContract, vatForContract: round2(sumForContract * num(vatRatio) / 100) };
}
export const formatMoney = (n: number | null | undefined): string => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

// ---- the folders of the list: legal entity → vendor ------------------------------------------------------------------------------------------------------------------
export interface VendorFolderNode { id: string; parentId: string | null; title: string; order: number }
/** the tree of the list = what the documents have: the legal entities, and under each the vendors that invoiced it (the folder id of a document is `legalEntity:vendor`, made by the database) */
export function vendorInvoiceFolderNodes(rows: Pick<VendorInvoiceListRow, 'legalEntityGUID' | 'legalEntityTitle' | 'partnerGUID' | 'partnerTitle'>[]): VendorFolderNode[] {
  const entities = new Map<string, string>();
  const pairs = new Map<string, { parent: string; title: string }>();
  for (const r of rows || []) {
    if (!r.legalEntityGUID) continue;
    entities.set(r.legalEntityGUID, r.legalEntityTitle || r.legalEntityGUID);
    if (r.partnerGUID) pairs.set(`${r.legalEntityGUID}:${r.partnerGUID}`, { parent: r.legalEntityGUID, title: r.partnerTitle || r.partnerGUID });
  }
  const top = [...entities.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, title], i): VendorFolderNode => ({ id, parentId: null, title, order: i }));
  const sub = [...pairs.entries()].sort((a, b) => a[1].title.localeCompare(b[1].title)).map(([id, p], i): VendorFolderNode => ({ id, parentId: p.parent, title: p.title, order: i }));
  return [...top, ...sub];
}

// ---- opening the form ------------------------------------------------------------------------------------------------------------------------------------------------
export interface OpenVendorInvoiceParams { taskGUID: string; projectGUID?: string | null; lineGUIDs?: string[] | null; documentGUID?: string | null; documents?: string[] | null }
export function vendorInvoiceRouteParams(p: OpenVendorInvoiceParams): Record<string, string> {
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
export const vendorInvoiceDocumentPath = (documentGUID: string): string => `${VENDOR_INVOICE_ROUTE}?documentGUID=${encodeURIComponent(documentGUID)}`;
