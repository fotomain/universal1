// productReceiptModel - the PRODUCT RECEIPT document, the twin of the PURCHASE ORDER (kit8/documents/vendor/purchase_order) and of the VENDOR INVOICE (kit8/documents/vendor/invoice);
//   documentation/PRODUCT_RECEIPT.html; SQL: PART 30 of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql.
//   Its posting writes 'received' movements (column Delivered of Monitor01 = qtyDelivered). A receipt is made from a POSTED purchase order ("Create based on → Product receipt"): its lines are the lines of the
//   order, the quantity of a new line = ordered - what the other receipts of that order line already received. From a posted receipt "Create based on → Vendor invoice" makes the invoice.
//   ONE document = ONE vendor + ONE contract (or none). rowOwnerGUID of the header = the legal entity (not unique).
//   product_receipt_header  rowJSON { documentHeader { activeUser · created_at · documentNumber PR-00001 · documentStatus draft | posted · postedAt · postedBy · unpostedAt },
//                           productReceiptPartner · productReceiptContract · productReceiptDateTime · productReceiptNumber · productReceiptPurchaseOrder (the order it came from) ·
//                           productReceiptMultiProject (copied from the order) · productReceiptFolder (derived) · productReceiptCurrency (derived) }
//   product_receipt_lines   the lines of a document: task line, purchaseOrderLineGUID, genus, qtyReceived · priceReceived · vatRatioReceived, the sums computed by the database
// Pure (no React, no Supabase): the rules and the texts are tested without a screen.
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import { parseDayInput } from '../../fact/input/factInputModel';

export const PRODUCT_RECEIPT_HEADER_TABLE = 'product_receipt_header';
export const PRODUCT_RECEIPT_LINES_TABLE = 'product_receipt_lines';
/** the redux entities (SystemMetaData, productReceiptMetaData.ts) */
export const PRODUCT_RECEIPT_HEADER_ENTITY = 'productReceiptHeader';
export const PRODUCT_RECEIPT_LINES_ENTITY = 'productReceiptLinesReusable';
export const RPC_PR_FROM_ORDER = 'create_product_receipt_from_order';
export const RPC_VI_FROM_RECEIPT = 'create_vendor_invoice_from_receipt';
export const RPC_PR_SET_HEADER = 'product_receipt_set_header';
export const RPC_PR_ADD_LINE = 'product_receipt_add_line';
export const RPC_PR_LINE_PLACES = 'product_receipt_line_places';
export const RPC_PR_POST = 'post_product_receipt';
export const RPC_PR_UNPOST = 'unpost_product_receipt';
export const RPC_PR_DELETE = 'delete_product_receipt';
export const RPC_PR_LIST = 'product_receipt_list';

/** the screens: the form (app/pm/project/task/product-receipt), the list (hamburger menu → Documents → Product receipts) */
export const PRODUCT_RECEIPT_ROUTE = '/pm/project/task/product-receipt';
export const PRODUCT_RECEIPT_LIST_ROUTE = '/pm/product-receipt/list';
/** the registrator type of the movements of a posted product receipt (project_status_movements.rowRegistratorType) */
export const PRODUCT_RECEIPT_REGISTRATOR_TYPE = 'productReceiptHeader';

export type ProductReceiptStatus = 'draft' | 'posted';
export type ProductReceiptProblemCode = 'documentIsPosted' | 'documentIsNotPosted' | 'documentHasNoLines' | 'receiptNumberMissing' | 'receiptDateMissing' | 'quantityIsZero' | 'notYourProject' | 'vendorMissing' | 'legalEntityMissing';

/** the tabs of the document: All (default) · Time · Material · Expenses - exactly as the Finances table of a task */
export const PRODUCT_RECEIPT_ALL_TAB = 'all';
export const PRODUCT_RECEIPT_TABS: { id: string; title: string; icon: string; genus: string | null }[] = [
  { id: PRODUCT_RECEIPT_ALL_TAB, title: 'All', icon: 'select_all', genus: null },
  { id: MANAGEMENT_GENUS.time, title: 'Time', icon: 'schedule', genus: MANAGEMENT_GENUS.time },
  { id: MANAGEMENT_GENUS.material, title: 'Material', icon: 'inventory_2', genus: MANAGEMENT_GENUS.material },
  { id: MANAGEMENT_GENUS.expense, title: 'Expenses', icon: 'receipt_long', genus: MANAGEMENT_GENUS.expense },
];
export const productReceiptTabOf = (id: string | null | undefined): string => (PRODUCT_RECEIPT_TABS.some((t) => t.id === id) ? (id as string) : PRODUCT_RECEIPT_ALL_TAB);

// ---- "Create based on": the answer of create_product_receipt_from_order / create_vendor_invoice_from_receipt ---------------------------------------------------------------------------
export interface CreatedFromDocument { documentGUID: string; lineCount: number }
export interface CreateFromAnswer { documents: CreatedFromDocument[]; skipped: { reason: string }[] }
export function parseCreateFromAnswer(data: any): CreateFromAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return {
    documents: (Array.isArray(d.documents) ? d.documents : []).map((x: any) => ({ documentGUID: String(x.documentGUID), lineCount: Number(x.lineCount) || 0 })),
    skipped: (Array.isArray(d.skipped) ? d.skipped : []).map((x: any) => ({ reason: String(x?.reason ?? '') })),
  };
}
/** why nothing was made (the text for the user) */
export function createFromSkippedText(reason: string): string {
  switch (reason) {
    case 'nothingLeftToReceive': return 'Everything ordered is already on a product receipt.';
    case 'nothingLeftToInvoice': return 'Everything received is already on a vendor invoice.';
    default: return reason;
  }
}
/** "Create based on → Product receipt" is offered for a POSTED purchase order, "→ Vendor invoice" for a POSTED product receipt */
export const canCreateReceiptFromOrder = (orderStatus: string | null | undefined): boolean => orderStatus === 'posted';
export const canCreateInvoiceFromReceipt = (h: Pick<ProductReceiptHeaderView, 'status'>): boolean => h.status === 'posted';

// ---- the list (product_receipt_list) -------------------------------------------------------------------------------------------------------------------------------
export interface ProductReceiptListRow {
  documentGUID: string;
  documentNumber: string;
  documentStatus: ProductReceiptStatus;
  productReceiptNumber: string;
  productReceiptDateTime: string | null;
  productReceiptDay: string | null;
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
  /** the project of the document (header field productReceiptProject) and its name; independentInputAvailable = ITS setting independentInvoiceInputAvailable */
  projectGUID: string;
  projectName: string;
  independentInputAvailable: boolean;
  /** Multi Project mode of the document (copied from the purchase order); the lines show their project / task / task line */
  multiProject: boolean;
  multiProjectAvailable: boolean;
  /** the purchase order the receipt was made from: its GUID, its system number (PO-00001) and the number printed on it */
  purchaseOrderGUID: string;
  purchaseOrderDocument: string;
  purchaseOrderNumber: string;
  authorGUID: string;
  authorName: string;
  lineCount: number;
  sumBeforeVAT: number;
  sumVAT: number;
  sumWithVAT: number;
}
export interface ProductReceiptCurrencyTotal { currency: string; count: number; sumBeforeVAT: number; sumVAT: number; sumWithVAT: number }
export interface ProductReceiptListAnswer { totalCount: number; totalsByCurrency: ProductReceiptCurrencyTotal[]; rows: ProductReceiptListRow[] }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? round2(n) : 0; };
export function parseListAnswer(data: any): ProductReceiptListAnswer {
  const d = data && typeof data === 'object' ? data : {};
  const rows: ProductReceiptListRow[] = (Array.isArray(d.rows) ? d.rows : []).map((r: any) => ({
    documentGUID: String(r.documentGUID),
    documentNumber: String(r.documentNumber ?? ''),
    documentStatus: r.documentStatus === 'posted' ? 'posted' : 'draft',
    productReceiptNumber: String(r.productReceiptNumber ?? ''),
    productReceiptDateTime: r.productReceiptDateTime ?? null,
    productReceiptDay: r.productReceiptDay ?? null,
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
    purchaseOrderGUID: String(r.purchaseOrderGUID ?? ''),
    purchaseOrderDocument: String(r.purchaseOrderDocument ?? ''),
    purchaseOrderNumber: String(r.purchaseOrderNumber ?? ''),
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
export interface ProductReceiptListFilter {
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
export const EMPTY_PRODUCT_RECEIPT_FILTER: ProductReceiptListFilter = { number: '', fromDay: '', toDay: '', legalEntityGUID: '', partnerGUID: '', contractGUID: '', currency: '', status: '', author: '' };
export const productReceiptFilterActive = (f: ProductReceiptListFilter): boolean => Object.values(f).some((v) => String(v || '').trim() !== '');
/** an unreadable date is an error of the field, not a filter */
export const productReceiptDateErrors = (f: ProductReceiptListFilter): { fromDay: boolean; toDay: boolean } => ({
  fromDay: !!f.fromDay.trim() && parseDayInput(f.fromDay) === null,
  toDay: !!f.toDay.trim() && parseDayInput(f.toDay) === null,
});
export function productReceiptFilterToRpc(f: ProductReceiptListFilter, extra: Record<string, any> = {}): Record<string, any> {
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
export interface ProductReceiptHeaderView {
  guid: string;
  number: string;
  status: ProductReceiptStatus;
  productReceiptNumber: string;
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
  /** Multi Project mode (the lines may belong to other tasks / projects) - copied from the purchase order, not chosen here */
  multiProject?: boolean;
  multiProjectAvailable?: boolean;
  /** the purchase order the receipt was made from */
  purchaseOrderGUID?: string;
  purchaseOrderDocument?: string;
  purchaseOrderNumber?: string;
}
export function headerOfListRow(r: ProductReceiptListRow): ProductReceiptHeaderView {
  return {
    guid: r.documentGUID, number: r.documentNumber, status: r.documentStatus, productReceiptNumber: r.productReceiptNumber, day: r.productReceiptDay ?? '',
    legalEntityGUID: r.legalEntityGUID, partnerGUID: r.partnerGUID, contractGUID: r.contractGUID, currency: r.currency, authorName: r.authorName,
    partnerTitle: r.partnerTitle, contractInfo: r.contractInfo, legalEntityTitle: r.legalEntityTitle,
    taskGUID: r.taskGUID, projectGUID: r.projectGUID, projectName: r.projectName, independentInputAvailable: r.independentInputAvailable,
    multiProject: r.multiProject, multiProjectAvailable: r.multiProjectAvailable,
    purchaseOrderGUID: r.purchaseOrderGUID, purchaseOrderDocument: r.purchaseOrderDocument, purchaseOrderNumber: r.purchaseOrderNumber,
  };
}
export const canEditProductReceipt = (h: ProductReceiptHeaderView): boolean => h.status === 'draft';
export const canDeleteProductReceipt = (h: ProductReceiptHeaderView): boolean => h.status === 'draft';
export const canPostProductReceipt = (h: ProductReceiptHeaderView, lineCount: number): boolean => h.status === 'draft' && lineCount > 0;
export const canUnpostProductReceipt = (h: ProductReceiptHeaderView): boolean => h.status === 'posted';

/** what the user still has to fill before Post (the database refuses the same) */
export function productReceiptMissing(h: ProductReceiptHeaderView, lineCount: number): ProductReceiptProblemCode[] {
  const out: ProductReceiptProblemCode[] = [];
  if (lineCount === 0) out.push('documentHasNoLines');
  if (!h.partnerGUID) out.push('vendorMissing');
  if (!h.legalEntityGUID) out.push('legalEntityMissing');
  if (!h.productReceiptNumber.trim()) out.push('receiptNumberMissing');
  if (!h.day) out.push('receiptDateMissing');
  return out;
}

export interface ProductReceiptPostProblem { lineGUID: string | null; problem: ProductReceiptProblemCode | string }
export interface ProductReceiptPostAnswer { status: 'posted' | 'refused' | 'draft'; lines: number; problems: ProductReceiptPostProblem[] }
export function parsePostAnswer(data: any): ProductReceiptPostAnswer {
  const d = data && typeof data === 'object' ? data : {};
  return { status: d.status === 'posted' ? 'posted' : d.status === 'draft' ? 'draft' : 'refused', lines: Number(d.lines) || 0, problems: (Array.isArray(d.problems) ? d.problems : []).map((p: any) => ({ lineGUID: p.lineGUID ?? null, problem: String(p.problem ?? '') })) };
}
export function productReceiptProblemText(code: string): string {
  switch (code) {
    case 'documentIsPosted': return 'The document is already posted.';
    case 'documentIsNotPosted': return 'The document is not posted.';
    case 'documentHasNoLines': return 'The document has no lines.';
    case 'vendorMissing': return 'Choose the vendor of the product receipt.';
    case 'legalEntityMissing': return 'Choose the legal entity of the product receipt.';
    case 'receiptNumberMissing': return 'Enter the number of the product receipt (the delivery note).';
    case 'receiptDateMissing': return 'Enter the date of the product receipt.';
    case 'quantityIsZero': return 'A line has the quantity 0: delete it or enter the quantity.';
    case 'notYourProject': return 'A line belongs to a project that is not yours: only its owner can post this product receipt.';
    default: return code;
  }
}

// ---- the lines -----------------------------------------------------------------------------------------------------------------------------------------------------
/** the rows of ONE document and, on a genus tab, of that genus */
export function productReceiptLinesOf(rows: any[] | null | undefined, headerGUID: string | null | undefined, tab: string = PRODUCT_RECEIPT_ALL_TAB): any[] {
  const genus = PRODUCT_RECEIPT_TABS.find((t) => t.id === tab)?.genus ?? null;
  return (rows || []).filter((r) => !!headerGUID && r.rowHeaderGUID === headerGUID && (genus === null || r.genusGUID === genus));
}
export interface ProductReceiptLineTotals { lineCount: number; sumBeforeVAT: number; sumVAT: number; sumWithVAT: number }
const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
export function productReceiptTotals(rows: any[]): ProductReceiptLineTotals {
  const sumBeforeVAT = round2((rows || []).reduce((a, r) => a + num(r.sumForContract), 0));
  const sumVAT = round2((rows || []).reduce((a, r) => a + num(r.vatForContract), 0));
  return { lineCount: (rows || []).length, sumBeforeVAT, sumVAT, sumWithVAT: round2(sumBeforeVAT + sumVAT) };
}
/** the twin of the database trigger: the sums of a line from its quantity, price and VAT % (the budget / accounting sums need the rate of the plan, which only the database has) */
export function productReceiptLineSums(qty: number, price: number, vatRatio: number): { sumForContract: number; vatForContract: number } {
  const sumForContract = round2(num(qty) * num(price));
  return { sumForContract, vatForContract: round2(sumForContract * num(vatRatio) / 100) };
}
export const formatMoney = (n: number | null | undefined): string => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

// ---- the folders of the list: legal entity → vendor ------------------------------------------------------------------------------------------------------------------
export interface VendorFolderNode { id: string; parentId: string | null; title: string; order: number }
/** the tree of the list = what the documents have: the legal entities, and under each the vendors of the receipts (the folder id of a document is `legalEntity:vendor`, made by the database) */
export function productReceiptFolderNodes(rows: Pick<ProductReceiptListRow, 'legalEntityGUID' | 'legalEntityTitle' | 'partnerGUID' | 'partnerTitle'>[]): VendorFolderNode[] {
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
export interface OpenProductReceiptParams { documentGUID?: string | null; documents?: string[] | null; taskGUID?: string | null; projectGUID?: string | null }
export function productReceiptRouteParams(p: OpenProductReceiptParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.taskGUID) out.taskGUID = p.taskGUID;
  if (p.projectGUID) out.projectGUID = p.projectGUID;
  if (p.documentGUID) out.documentGUID = p.documentGUID;
  if (p.documents?.length) out.documents = p.documents.join(',');
  return out;
}
export { documentsOfRoute } from '../invoice/vendorInvoiceModel';
/** the path of ONE document for a browser tab of its own (web): the same form route with that single document */
export const productReceiptDocumentPath = (documentGUID: string): string => `${PRODUCT_RECEIPT_ROUTE}?documentGUID=${encodeURIComponent(documentGUID)}`;

/** the three fields of a line of a Multi Project receipt (copied from a Multi Project purchase order): read only here */
export const productReceiptShowsPlaces = (h: Pick<ProductReceiptHeaderView, 'multiProject'> | null | undefined): boolean => !!h?.multiProject;
