// productReceiptApi - the calls of the product receipt. Every function takes the Supabase client (useSupabase().supabase), so a test passes a fake one.
// The header is written ONLY by these RPCs; the quantity / price / VAT % of a line of a draft are written by the ReusableTable through the redux entity (productReceiptMetaData.ts).
import {
  CreateFromAnswer, ProductReceiptListAnswer, ProductReceiptListFilter, ProductReceiptPostAnswer, RPC_PR_ADD_LINE, RPC_PR_DELETE, RPC_PR_FROM_ORDER, RPC_PR_LINE_PLACES, RPC_PR_LIST, RPC_PR_POST, RPC_PR_SET_HEADER, RPC_PR_UNPOST,
  RPC_VI_FROM_RECEIPT, parseCreateFromAnswer, parseListAnswer, parsePostAnswer, productReceiptFilterToRpc,
} from './productReceiptModel';
import { LinePlace, parseLinePlaces } from '../lineplace/linePlaceModel';

type Client = any;
const fail = (error: any): never => { throw new Error(error?.message || String(error)); };

/** "Create based on → Product receipt": ONE draft receipt of a POSTED purchase order (the lines still to receive) */
export async function createProductReceiptFromOrder(client: Client, orderGUID: string): Promise<CreateFromAnswer> {
  const { data, error } = await client.rpc(RPC_PR_FROM_ORDER, { p_order: orderGUID });
  if (error) fail(error);
  return parseCreateFromAnswer(data);
}

/** "Create based on → Vendor invoice": ONE draft vendor invoice of a POSTED product receipt (the lines still to invoice) */
export async function createVendorInvoiceFromReceipt(client: Client, receiptGUID: string): Promise<CreateFromAnswer> {
  const { data, error } = await client.rpc(RPC_VI_FROM_RECEIPT, { p_receipt: receiptGUID });
  if (error) fail(error);
  return parseCreateFromAnswer(data);
}

/** the documents with their totals (filter: ProductReceiptListFilter; `extra` = keys the screen sets itself, e.g. documentGUIDs, purchaseOrderGUID) */
export async function fetchProductReceiptList(client: Client, filter: ProductReceiptListFilter | null, extra: Record<string, any> = {}, limit = 1000, offset = 0): Promise<ProductReceiptListAnswer> {
  const p_filter = filter ? productReceiptFilterToRpc(filter, extra) : { ...extra };
  const { data, error } = await client.rpc(RPC_PR_LIST, { p_filter, p_limit: limit, p_offset: offset });
  if (error) fail(error);
  return parseListAnswer(data);
}

/** the number of the receipt, its date ('YYYY-MM-DD' or an ISO timestamp) and the legal entity of a DRAFT; the vendor (+ contract) of a draft that has none */
export async function setProductReceiptHeader(client: Client, headerGUID: string, patch: { productReceiptNumber?: string; productReceiptDateTime?: string | null; legalEntityGUID?: string; productReceiptPartner?: string; productReceiptContract?: string | null }): Promise<void> {
  const { error } = await client.rpc(RPC_PR_SET_HEADER, { p_header: headerGUID, p_patch: patch });
  if (error) fail(error);
}

export async function postProductReceipt(client: Client, headerGUID: string): Promise<ProductReceiptPostAnswer> {
  const { data, error } = await client.rpc(RPC_PR_POST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

export async function unpostProductReceipt(client: Client, headerGUID: string): Promise<ProductReceiptPostAnswer> {
  const { data, error } = await client.rpc(RPC_PR_UNPOST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

/** a DRAFT document (and its lines) is deleted; a posted one is not */
export async function deleteProductReceipt(client: Client, headerGUID: string): Promise<void> {
  const { error } = await client.rpc(RPC_PR_DELETE, { p_header: headerGUID });
  if (error) fail(error);
}

/** ONE independent line (no purchase order line) of a DRAFT; the kind = the tab (timeGenus | materialGenus | expenseGenus); returns the GUID of the line */
export async function addProductReceiptLine(client: Client, headerGUID: string, genus: string): Promise<string> {
  const { data, error } = await client.rpc(RPC_PR_ADD_LINE, { p_header: headerGUID, p_genus: genus });
  if (error) fail(error);
  return String(data);
}

/** the project and task names of the lines of a document: { lineGUID: place } */
export async function fetchProductReceiptLinePlaces(client: Client, headerGUID: string): Promise<Record<string, LinePlace>> {
  const { data, error } = await client.rpc(RPC_PR_LINE_PLACES, { p_header: headerGUID });
  if (error) fail(error);
  return parseLinePlaces(data);
}
