// purchaseOrderModel - the PURCHASE ORDER document, the twin of the VENDOR INVOICE (kit8/documents/vendor/invoice; documentation/PURCHASE_ORDER.html; SQL: PART 28 of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql).
//   Its posting writes 'ordered' movements (column Ordered of Monitor01); the quantity of a new line = what is not on a PURCHASE ORDER yet.
//   ONE document = ONE vendor + ONE contract (or none). rowOwnerGUID of the header = the legal entity (not unique).
//   purchase_order_header  rowJSON { documentHeader { activeUser · created_at · documentNumber PO-00001 · documentStatus draft | posted · postedAt · postedBy · unpostedAt },
//                          purchaseOrderPartner · purchaseOrderContract · purchaseOrderDateTime · purchaseOrderNumber · purchaseOrderFolder (derived) · purchaseOrderCurrency (derived) }
//   purchase_order_lines   the lines of a document: task line, genus, qtyOrdered · priceOrdered · vatRatioOrdered, the sums computed by the database
// Pure (no React, no Supabase): the rules and the texts are tested without a screen. The 0333Effect rounding correction is NOT built (the user said so).
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import { parseDayInput } from '../../fact/input/factInputModel';

export const PURCHASE_ORDER_HEADER_TABLE = 'purchase_order_header';
export const PURCHASE_ORDER_LINES_TABLE = 'purchase_order_lines';
/** the redux entities (SystemMetaData, purchaseOrderMetaData.ts) */
export const PURCHASE_ORDER_HEADER_ENTITY = 'purchaseOrderHeader';
export const PURCHASE_ORDER_LINES_ENTITY = 'purchaseOrderLinesReusable';
export const RPC_PO_CANDIDATES = 'purchase_order_candidates';
export const RPC_PO_CREATE = 'create_purchase_orders';
export const RPC_PO_SET_HEADER = 'purchase_order_set_header';
export const RPC_PO_ADD_LINE = 'purchase_order_add_line';
export const RPC_PO_SET_LINE_TASK = 'purchase_order_set_line_task';
export const RPC_PO_LINE_PLACES = 'purchase_order_line_places';
export const RPC_PO_POST = 'post_purchase_order';
export const RPC_PO_UNPOST = 'unpost_purchase_order';
export const RPC_PO_DELETE = 'delete_purchase_order';
export const RPC_PO_LIST = 'purchase_order_list';

/** the screens: the form (app/pm/project/task/purchase-order), the choice of the vendors (…/new), the list (hamburger menu → Budgets → Purchase orders) */
export const PURCHASE_ORDER_ROUTE = '/pm/project/task/purchase-order';
export const PURCHASE_ORDER_NEW_ROUTE = '/pm/project/task/purchase-order/new';
export const PURCHASE_ORDER_LIST_ROUTE = '/pm/purchase-order/list';
/** the registrator type of the movements of a posted purchase order (project_status_movements.rowRegistratorType) */
export const PURCHASE_ORDER_REGISTRATOR_TYPE = 'purchaseOrderHeader';

export type PurchaseOrderStatus = 'draft' | 'posted';
export type PurchaseOrderProblemCode = 'documentIsPosted' | 'documentIsNotPosted' | 'documentHasNoLines' | 'orderNumberMissing' | 'orderDateMissing' | 'quantityIsZero' | 'notYourProject' | 'vendorMissing' | 'legalEntityMissing';

/** the tabs of the document: All (default) · Time · Material · Expenses - exactly as the Finances table of a task */
export const PURCHASE_ORDER_ALL_TAB = 'all';
export const PURCHASE_ORDER_TABS: { id: string; title: string; icon: string; genus: string | null }[] = [
  { id: PURCHASE_ORDER_ALL_TAB, title: 'All', icon: 'select_all', genus: null },
  { id: MANAGEMENT_GENUS.time, title: 'Time', icon: 'schedule', genus: MANAGEMENT_GENUS.time },
  { id: MANAGEMENT_GENUS.material, title: 'Material', icon: 'inventory_2', genus: MANAGEMENT_GENUS.material },
  { id: MANAGEMENT_GENUS.expense, title: 'Expenses', icon: 'receipt_long', genus: MANAGEMENT_GENUS.expense },
];
export const purchaseOrderTabOf = (id: string | null | undefined): string => (PURCHASE_ORDER_TABS.some((t) => t.id === id) ? (id as string) : PURCHASE_ORDER_ALL_TAB);

// ---- the vendors of the lines of a task (purchase_order_candidates = the rules of the vendor invoice: kit8/documents/vendor/invoice) ----------------------------------------------------------------
export { candidateKey, candidateSelection, needsLegalEntity, NO_VENDOR_KEY, parseCandidates } from '../invoice/vendorInvoiceModel';
export type { VendorCandidate, VendorCandidatesAnswer, VendorSelection } from '../invoice/vendorInvoiceModel';
import { candidateKey, candidateSelection, needsLegalEntity, NO_VENDOR_KEY } from '../invoice/vendorInvoiceModel';
import type { VendorCandidate, VendorSelection } from '../invoice/vendorInvoiceModel';

/**
 * The context menu "Purchase Order" creates the documents at once ("quick create"): every vendor + contract of the lines is taken (no choice window).
 * The window stays for what needs a person: no vendor found (it says why) or a contract without a legal entity (it asks for it).
 */
export type QuickPurchaseOrderPlan = { kind: 'create'; selection: VendorSelection[] } | { kind: 'choose' };
export function quickPurchaseOrderPlan(rows: VendorCandidate[], noVendorLineGUIDs: string[] = []): QuickPurchaseOrderPlan {
  const all = new Set([...rows.map(candidateKey), ...(noVendorLineGUIDs.length ? [NO_VENDOR_KEY] : [])]);
  if (!all.size || needsLegalEntity(rows, all)) return { kind: 'choose' };
  return { kind: 'create', selection: candidateSelection(rows, all, noVendorLineGUIDs) };
}
/** which lines the quick create takes: a line of the Finances table asks (this line / the whole task), the task tree takes the whole task */
export type PurchaseOrderScope = 'line' | 'task';
export const DEFAULT_PURCHASE_ORDER_SCOPE: PurchaseOrderScope = 'line';
export const purchaseOrderLinesOfScope = (scope: PurchaseOrderScope, lineGUID: string): string[] | undefined => (scope === 'line' ? [lineGUID] : undefined);

export { parseCreateAnswer } from '../invoice/vendorInvoiceModel';
export type { CreateAnswer, CreatedDocument } from '../invoice/vendorInvoiceModel';

// ---- the list (purchase_order_list) -------------------------------------------------------------------------------------------------------------------------------
export interface PurchaseOrderListRow {
  documentGUID: string;
  documentNumber: string;
  documentStatus: PurchaseOrderStatus;
  purchaseOrderNumber: string;
  purchaseOrderDateTime: string | null;
  purchaseOrderDay: string | null;
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
  /** the project of the document (header field purchaseOrderProject) and its name; independentInputAvailable = ITS setting independentInvoiceInputAvailable */
  projectGUID: string;
  projectName: string;
  independentInputAvailable: boolean;
  /** Multi Project mode of the document (header purchaseOrderMultiProject) and the project setting multiProjectVendorInvoceNeeded of ITS project */
  multiProject: boolean;
  multiProjectAvailable: boolean;
  authorGUID: string;
  authorName: string;
  lineCount: number;
  sumBeforeVAT: number;
  sumVAT: number;
  sumWithVAT: number;
}
export interface PurchaseOrderCurrencyTotal { currency: string; count: number; sumBeforeVAT: number; sumVAT: number; sumWithVAT: number }
export interface PurchaseOrderListAnswer { totalCount: number; totalsByCurrency: PurchaseOrderCurrencyTotal[]; rows: PurchaseOrderListRow[] }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? round2(n) : 0; };
export function parseListAnswer(data: any): PurchaseOrderListAnswer {
  const d = data && typeof data === 'object' ? data : {};
  const rows: PurchaseOrderListRow[] = (Array.isArray(d.rows) ? d.rows : []).map((r: any) => ({
    documentGUID: String(r.documentGUID),
    documentNumber: String(r.documentNumber ?? ''),
    documentStatus: r.documentStatus === 'posted' ? 'posted' : 'draft',
    purchaseOrderNumber: String(r.purchaseOrderNumber ?? ''),
    purchaseOrderDateTime: r.purchaseOrderDateTime ?? null,
    purchaseOrderDay: r.purchaseOrderDay ?? null,
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
    multiProject: !!r.multiProject,
    multiProjectAvailable: !!r.multiProjectAvailable,
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
export interface PurchaseOrderListFilter {
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
export const EMPTY_PURCHASE_ORDER_FILTER: PurchaseOrderListFilter = { number: '', fromDay: '', toDay: '', legalEntityGUID: '', partnerGUID: '', contractGUID: '', currency: '', status: '', author: '' };
export const purchaseOrderFilterActive = (f: PurchaseOrderListFilter): boolean => Object.values(f).some((v) => String(v || '').trim() !== '');
/** an unreadable date is an error of the field, not a filter */
export const purchaseOrderDateErrors = (f: PurchaseOrderListFilter): { fromDay: boolean; toDay: boolean } => ({
  fromDay: !!f.fromDay.trim() && parseDayInput(f.fromDay) === null,
  toDay: !!f.toDay.trim() && parseDayInput(f.toDay) === null,
});
export function purchaseOrderFilterToRpc(f: PurchaseOrderListFilter, extra: Record<string, any> = {}): Record<string, any> {
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
export interface PurchaseOrderHeaderView {
  guid: string;
  number: string;
  status: PurchaseOrderStatus;
  purchaseOrderNumber: string;
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
  /** Multi Project mode (the lines may belong to other tasks / projects) and whether the project setting offers it */
  multiProject?: boolean;
  multiProjectAvailable?: boolean;
}
export function headerOfListRow(r: PurchaseOrderListRow): PurchaseOrderHeaderView {
  return {
    guid: r.documentGUID, number: r.documentNumber, status: r.documentStatus, purchaseOrderNumber: r.purchaseOrderNumber, day: r.purchaseOrderDay ?? '',
    legalEntityGUID: r.legalEntityGUID, partnerGUID: r.partnerGUID, contractGUID: r.contractGUID, currency: r.currency, authorName: r.authorName,
    partnerTitle: r.partnerTitle, contractInfo: r.contractInfo, legalEntityTitle: r.legalEntityTitle,
    taskGUID: r.taskGUID, projectGUID: r.projectGUID, projectName: r.projectName, independentInputAvailable: r.independentInputAvailable,
    multiProject: r.multiProject, multiProjectAvailable: r.multiProjectAvailable,
  };
}
export const canEditPurchaseOrder = (h: PurchaseOrderHeaderView): boolean => h.status === 'draft';
export const canDeletePurchaseOrder = (h: PurchaseOrderHeaderView): boolean => h.status === 'draft';
export const canPostPurchaseOrder = (h: PurchaseOrderHeaderView, lineCount: number): boolean => h.status === 'draft' && lineCount > 0;
export const canUnpostPurchaseOrder = (h: PurchaseOrderHeaderView): boolean => h.status === 'posted';

/** what the user still has to fill before Post (the database refuses the same) */
export function purchaseOrderMissing(h: PurchaseOrderHeaderView, lineCount: number): PurchaseOrderProblemCode[] {
  const out: PurchaseOrderProblemCode[] = [];
  if (lineCount === 0) out.push('documentHasNoLines');
  if (!h.partnerGUID) out.push('vendorMissing');
  if (!h.legalEntityGUID) out.push('legalEntityMissing');
  if (!h.purchaseOrderNumber.trim()) out.push('orderNumberMissing');
  if (!h.day) out.push('orderDateMissing');
  return out;
}

export interface PurchaseOrderPostProblem { lineGUID: string | null; problem: PurchaseOrderProblemCode | string }
export interface PurchaseOrderPostAnswer { status: 'posted' | 'refused' | 'draft'; lines: number; problems: PurchaseOrderPostProblem[] }
export function parsePostAnswer(data: any): PurchaseOrderPostAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return { status: d.status === 'posted' ? 'posted' : d.status === 'draft' ? 'draft' : 'refused', lines: Number(d.lines) || 0, problems: (Array.isArray(d.problems) ? d.problems : []).map((p: any) => ({ lineGUID: p.lineGUID ?? null, problem: String(p.problem ?? '') })) };
}
export function purchaseOrderProblemText(code: string): string {
  switch (code) {
    case 'documentIsPosted': return 'The document is already posted.';
    case 'documentIsNotPosted': return 'The document is not posted.';
    case 'documentHasNoLines': return 'The document has no lines.';
    case 'vendorMissing': return 'Choose the vendor of the purchase order.';
    case 'legalEntityMissing': return 'Choose the legal entity of the purchase order.';
    case 'orderNumberMissing': return 'Enter the number printed on the purchase order.';
    case 'orderDateMissing': return 'Enter the date of the purchase order.';
    case 'quantityIsZero': return 'A line has the quantity 0: delete it or enter the quantity.';
    case 'notYourProject': return 'A line belongs to a project that is not yours: only its owner can post this purchase order.';
    default: return code;
  }
}

// ---- the lines -----------------------------------------------------------------------------------------------------------------------------------------------------
/** the rows of ONE document and, on a genus tab, of that genus */
export function purchaseOrderLinesOf(rows: any[] | null | undefined, headerGUID: string | null | undefined, tab: string = PURCHASE_ORDER_ALL_TAB): any[] {
  const genus = PURCHASE_ORDER_TABS.find((t) => t.id === tab)?.genus ?? null;
  return (rows || []).filter((r) => !!headerGUID && r.rowHeaderGUID === headerGUID && (genus === null || r.genusGUID === genus));
}
export interface PurchaseOrderLineTotals { lineCount: number; sumBeforeVAT: number; sumVAT: number; sumWithVAT: number }
const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
export function purchaseOrderTotals(rows: any[]): PurchaseOrderLineTotals {
  const sumBeforeVAT = round2((rows || []).reduce((a, r) => a + num(r.sumForContract), 0));
  const sumVAT = round2((rows || []).reduce((a, r) => a + num(r.vatForContract), 0));
  return { lineCount: (rows || []).length, sumBeforeVAT, sumVAT, sumWithVAT: round2(sumBeforeVAT + sumVAT) };
}
/** the twin of the database trigger: the sums of a line from its quantity, price and VAT % (the budget / accounting sums need the rate of the plan, which only the database has) */
export function purchaseOrderLineSums(qty: number, price: number, vatRatio: number): { sumForContract: number; vatForContract: number } {
  const sumForContract = round2(num(qty) * num(price));
  return { sumForContract, vatForContract: round2(sumForContract * num(vatRatio) / 100) };
}
export const formatMoney = (n: number | null | undefined): string => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

// ---- the folders of the list: legal entity → vendor ------------------------------------------------------------------------------------------------------------------
export interface VendorFolderNode { id: string; parentId: string | null; title: string; order: number }
/** the tree of the list = what the documents have: the legal entities, and under each the vendors of the orders (the folder id of a document is `legalEntity:vendor`, made by the database) */
export function purchaseOrderFolderNodes(rows: Pick<PurchaseOrderListRow, 'legalEntityGUID' | 'legalEntityTitle' | 'partnerGUID' | 'partnerTitle'>[]): VendorFolderNode[] {
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
export interface OpenPurchaseOrderParams { taskGUID: string; projectGUID?: string | null; lineGUIDs?: string[] | null; documentGUID?: string | null; documents?: string[] | null }
export function purchaseOrderRouteParams(p: OpenPurchaseOrderParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.taskGUID) out.taskGUID = p.taskGUID;
  if (p.projectGUID) out.projectGUID = p.projectGUID;
  if (p.lineGUIDs?.length) out.lineGUIDs = p.lineGUIDs.join(',');
  if (p.documentGUID) out.documentGUID = p.documentGUID;
  if (p.documents?.length) out.documents = p.documents.join(',');
  return out;
}
export { documentsOfRoute } from '../invoice/vendorInvoiceModel';
/** the path of ONE document for a browser tab of its own (web): the same form route with that single document */
export const purchaseOrderDocumentPath = (documentGUID: string): string => `${PURCHASE_ORDER_ROUTE}?documentGUID=${encodeURIComponent(documentGUID)}`;

// ---- Single Project | Multi Project (project setting multiProjectVendorInvoceNeeded, Project settings → Vendor) -------------------------------------------------------------------
export const PURCHASE_ORDER_PROJECT_MODES: { id: 'single' | 'multi'; title: string; subtitle: string; icon: string }[] = [
  { id: 'single', title: 'Single Project', subtitle: 'All the lines belong to the project of the document', icon: 'folder' },
  { id: 'multi', title: 'Multi Project', subtitle: 'Each line can belong to any task or task line of any project of yours', icon: 'folder_copy' },
];
export const purchaseOrderProjectMode = (h: Pick<PurchaseOrderHeaderView, 'multiProject'> | null | undefined): 'single' | 'multi' => (h?.multiProject ? 'multi' : 'single');
/** the chevron next to the Project field is offered when the project setting is on (or the document is already Multi) and the document is a draft */
export const canChooseProjectMode = (h: PurchaseOrderHeaderView): boolean => h.status === 'draft' && (!!h.multiProjectAvailable || !!h.multiProject);
/** the three fields of a line of a Multi Project purchase order: purchaseOrderLineProject (read only: the project of the task), purchaseOrderTaskGUID and purchaseOrderTaskLineGUID (select / clear / paste) */
export const PURCHASE_ORDER_LINE_PLACE_FIELDS = ['purchaseOrderLineProject', 'purchaseOrderTaskGUID', 'purchaseOrderTaskLineGUID'] as const;
