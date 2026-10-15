// vendorInvoiceApi - the calls of the vendor invoice. Every function takes the Supabase client (useSupabase().supabase), so a test passes a fake one.
// The header is written ONLY by these RPCs; the quantity / price / VAT % of a line of a draft are written by the ReusableTable through the redux entity (vendorInvoiceMetaData.ts).
import {
  CreateAnswer, RPC_VENDOR_ADD_LINE, RPC_VENDOR_CANDIDATES, RPC_VENDOR_CREATE, RPC_VENDOR_DELETE, RPC_VENDOR_LIST, RPC_VENDOR_POST, RPC_VENDOR_SET_HEADER, RPC_VENDOR_UNPOST, VendorCandidatesAnswer,
  VendorInvoiceListAnswer, VendorInvoiceListFilter, VendorInvoicePostAnswer, VendorSelection, parseCandidates, parseCreateAnswer, parseListAnswer, parsePostAnswer, vendorInvoiceFilterToRpc,
} from './vendorInvoiceModel';

type Client = any;
const fail = (error: any): never => { throw new Error(error?.message || String(error)); };

/** the vendors (and their contracts) of the lines of a task */
export async function fetchVendorCandidates(client: Client, taskGUID: string, lineGUIDs?: string[] | null): Promise<VendorCandidatesAnswer> {
  const { data, error } = await client.rpc(RPC_VENDOR_CANDIDATES, { p_task: taskGUID, p_lines: lineGUIDs && lineGUIDs.length ? lineGUIDs : null });
  if (error) fail(error);
  return parseCandidates(data);
}

/** one draft document per selected vendor + contract; `legalEntityGUID` is asked when a contract names none */
export async function createVendorInvoices(client: Client, taskGUID: string, selection: VendorSelection[], legalEntityGUID?: string | null): Promise<CreateAnswer> {
  const { data, error } = await client.rpc(RPC_VENDOR_CREATE, { p_task: taskGUID, p_selection: selection, p_legal_entity: legalEntityGUID || null });
  if (error) fail(error);
  return parseCreateAnswer(data);
}

/** the documents with their totals (filter: VendorInvoiceListFilter; `extra` = keys the screen sets itself, e.g. documentGUIDs) */
export async function fetchVendorInvoiceList(client: Client, filter: VendorInvoiceListFilter | null, extra: Record<string, any> = {}, limit = 1000, offset = 0): Promise<VendorInvoiceListAnswer> {
  const p_filter = filter ? vendorInvoiceFilterToRpc(filter, extra) : { ...extra };
  const { data, error } = await client.rpc(RPC_VENDOR_LIST, { p_filter, p_limit: limit, p_offset: offset });
  if (error) fail(error);
  return parseListAnswer(data);
}

/** the number printed on the invoice, its date ('YYYY-MM-DD' or an ISO timestamp) and the legal entity of a DRAFT; the vendor (+ contract) only of a draft that has none (made from lines without a vendor) */
export async function setVendorInvoiceHeader(client: Client, headerGUID: string, patch: { vendorInvoiceNumber?: string; vendorInvoiceDateTime?: string | null; legalEntityGUID?: string; vendorInvoicePartner?: string; vendorInvoiceContract?: string | null }): Promise<void> {
  const { error } = await client.rpc(RPC_VENDOR_SET_HEADER, { p_header: headerGUID, p_patch: patch });
  if (error) fail(error);
}

export async function postVendorInvoice(client: Client, headerGUID: string): Promise<VendorInvoicePostAnswer> {
  const { data, error } = await client.rpc(RPC_VENDOR_POST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

export async function unpostVendorInvoice(client: Client, headerGUID: string): Promise<VendorInvoicePostAnswer> {
  const { data, error } = await client.rpc(RPC_VENDOR_UNPOST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

/** a DRAFT document (and its lines) is deleted; a posted one is not */
export async function deleteVendorInvoice(client: Client, headerGUID: string): Promise<void> {
  const { error } = await client.rpc(RPC_VENDOR_DELETE, { p_header: headerGUID });
  if (error) fail(error);
}

/** ONE independent line (no task line) of a DRAFT; the kind = the tab (timeGenus | materialGenus | expenseGenus); returns the GUID of the line */
export async function addVendorInvoiceLine(client: Client, headerGUID: string, genus: string): Promise<string> {
  const { data, error } = await client.rpc(RPC_VENDOR_ADD_LINE, { p_header: headerGUID, p_genus: genus });
  if (error) fail(error);
  return String(data);
}
