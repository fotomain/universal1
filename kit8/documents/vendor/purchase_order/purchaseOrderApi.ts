// purchaseOrderApi - the calls of the purchase order. Every function takes the Supabase client (useSupabase().supabase), so a test passes a fake one.
// The header is written ONLY by these RPCs; the quantity / price / VAT % of a line of a draft are written by the ReusableTable through the redux entity (purchaseOrderMetaData.ts).
import {
  CreateAnswer, RPC_PO_ADD_LINE, RPC_PO_CANDIDATES, RPC_PO_CREATE, RPC_PO_DELETE, RPC_PO_LINE_PLACES, RPC_PO_LIST, RPC_PO_POST, RPC_PO_SET_HEADER, RPC_PO_SET_LINE_TASK, RPC_PO_UNPOST, VendorCandidatesAnswer,
  PurchaseOrderListAnswer, PurchaseOrderListFilter, PurchaseOrderPostAnswer, VendorSelection, parseCandidates, parseCreateAnswer, parseListAnswer, parsePostAnswer, purchaseOrderFilterToRpc,
} from './purchaseOrderModel';
import { LinePlace, parseLinePlaces } from '../lineplace/linePlaceModel';

type Client = any;
const fail = (error: any): never => { throw new Error(error?.message || String(error)); };

/** the vendors (and their contracts) of the lines of a task */
export async function fetchPurchaseOrderCandidates(client: Client, taskGUID: string, lineGUIDs?: string[] | null): Promise<VendorCandidatesAnswer> {
  const { data, error } = await client.rpc(RPC_PO_CANDIDATES, { p_task: taskGUID, p_lines: lineGUIDs && lineGUIDs.length ? lineGUIDs : null });
  if (error) fail(error);
  return parseCandidates(data);
}

/** one draft document per selected vendor + contract; `legalEntityGUID` is asked when a contract names none */
export async function createPurchaseOrders(client: Client, taskGUID: string, selection: VendorSelection[], legalEntityGUID?: string | null): Promise<CreateAnswer> {
  const { data, error } = await client.rpc(RPC_PO_CREATE, { p_task: taskGUID, p_selection: selection, p_legal_entity: legalEntityGUID || null });
  if (error) fail(error);
  return parseCreateAnswer(data);
}

/** the documents with their totals (filter: PurchaseOrderListFilter; `extra` = keys the screen sets itself, e.g. documentGUIDs) */
export async function fetchPurchaseOrderList(client: Client, filter: PurchaseOrderListFilter | null, extra: Record<string, any> = {}, limit = 1000, offset = 0): Promise<PurchaseOrderListAnswer> {
  const p_filter = filter ? purchaseOrderFilterToRpc(filter, extra) : { ...extra };
  const { data, error } = await client.rpc(RPC_PO_LIST, { p_filter, p_limit: limit, p_offset: offset });
  if (error) fail(error);
  return parseListAnswer(data);
}

/** the number of the purchase order, its date ('YYYY-MM-DD' or an ISO timestamp) and the legal entity of a DRAFT; the vendor (+ contract) only of a draft that has none (made from lines without a vendor) */
export async function setPurchaseOrderHeader(client: Client, headerGUID: string, patch: { purchaseOrderNumber?: string; purchaseOrderDateTime?: string | null; legalEntityGUID?: string; purchaseOrderPartner?: string; purchaseOrderContract?: string | null; purchaseOrderMultiProject?: boolean }): Promise<void> {
  const { error } = await client.rpc(RPC_PO_SET_HEADER, { p_header: headerGUID, p_patch: patch });
  if (error) fail(error);
}

export async function postPurchaseOrder(client: Client, headerGUID: string): Promise<PurchaseOrderPostAnswer> {
  const { data, error } = await client.rpc(RPC_PO_POST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

export async function unpostPurchaseOrder(client: Client, headerGUID: string): Promise<PurchaseOrderPostAnswer> {
  const { data, error } = await client.rpc(RPC_PO_UNPOST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

/** a DRAFT document (and its lines) is deleted; a posted one is not */
export async function deletePurchaseOrder(client: Client, headerGUID: string): Promise<void> {
  const { error } = await client.rpc(RPC_PO_DELETE, { p_header: headerGUID });
  if (error) fail(error);
}

/** ONE independent line (no task line) of a DRAFT; the kind = the tab (timeGenus | materialGenus | expenseGenus); returns the GUID of the line */
export async function addPurchaseOrderLine(client: Client, headerGUID: string, genus: string): Promise<string> {
  const { data, error } = await client.rpc(RPC_PO_ADD_LINE, { p_header: headerGUID, p_genus: genus });
  if (error) fail(error);
  return String(data);
}

/** Multi Project: the task and the task line of ONE line of a DRAFT (both null = clear: back to the task and the project of the document) */
export async function setPurchaseOrderLineTask(client: Client, lineGUID: string, taskGUID: string | null, taskLineGUID: string | null): Promise<void> {
  const { error } = await client.rpc(RPC_PO_SET_LINE_TASK, { p_line: lineGUID, p_task: taskGUID, p_task_line: taskLineGUID });
  if (error) fail(error);
}

/** the project and task names of the lines of a document: { lineGUID: place } */
export async function fetchPurchaseOrderLinePlaces(client: Client, headerGUID: string): Promise<Record<string, LinePlace>> {
  const { data, error } = await client.rpc(RPC_PO_LINE_PLACES, { p_header: headerGUID });
  if (error) fail(error);
  return parseLinePlaces(data);
}
