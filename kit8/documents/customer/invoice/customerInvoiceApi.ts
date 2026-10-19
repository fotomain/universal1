// customerInvoiceApi - the calls of the customer invoice. Every function takes the Supabase client (useSupabase().supabase), so a test passes a fake one.
// The header is written ONLY by these RPCs; the quantity / price / VAT % of a line of a draft are written by the ReusableTable through the redux entity (customerInvoiceMetaData.ts).
import {
  CreateAnswer, RPC_CUSTOMER_ADD_LINE, RPC_CUSTOMER_CANDIDATES, RPC_CUSTOMER_CREATE, RPC_CUSTOMER_DELETE, RPC_CUSTOMER_LIST, RPC_CUSTOMER_POST, RPC_CUSTOMER_SET_HEADER, RPC_CUSTOMER_UNPOST, CustomerCandidatesAnswer,
  CustomerInvoiceListAnswer, CustomerInvoiceListFilter, CustomerInvoicePostAnswer, CustomerSelection, parseCandidates, parseCreateAnswer, parseListAnswer, parsePostAnswer, customerInvoiceFilterToRpc,
} from './customerInvoiceModel';

type Client = any;
const fail = (error: any): never => { throw new Error(error?.message || String(error)); };

/** the customers (and their contracts) of the lines of a task */
export async function fetchCustomerCandidates(client: Client, taskGUID: string, lineGUIDs?: string[] | null): Promise<CustomerCandidatesAnswer> {
  const { data, error } = await client.rpc(RPC_CUSTOMER_CANDIDATES, { p_task: taskGUID, p_lines: lineGUIDs && lineGUIDs.length ? lineGUIDs : null });
  if (error) fail(error);
  return parseCandidates(data);
}

/** one draft document per selected customer + contract; `legalEntityGUID` is asked when a contract names none */
export async function createCustomerInvoices(client: Client, taskGUID: string, selection: CustomerSelection[], legalEntityGUID?: string | null): Promise<CreateAnswer> {
  const { data, error } = await client.rpc(RPC_CUSTOMER_CREATE, { p_task: taskGUID, p_selection: selection, p_legal_entity: legalEntityGUID || null });
  if (error) fail(error);
  return parseCreateAnswer(data);
}

/** the documents with their totals (filter: CustomerInvoiceListFilter; `extra` = keys the screen sets itself, e.g. documentGUIDs) */
export async function fetchCustomerInvoiceList(client: Client, filter: CustomerInvoiceListFilter | null, extra: Record<string, any> = {}, limit = 1000, offset = 0): Promise<CustomerInvoiceListAnswer> {
  const p_filter = filter ? customerInvoiceFilterToRpc(filter, extra) : { ...extra };
  const { data, error } = await client.rpc(RPC_CUSTOMER_LIST, { p_filter, p_limit: limit, p_offset: offset });
  if (error) fail(error);
  return parseListAnswer(data);
}

/** the number printed on the invoice, its date ('YYYY-MM-DD' or an ISO timestamp) and the legal entity of a DRAFT; the customer (+ contract) only of a draft that has none (made from lines without a customer) */
export async function setCustomerInvoiceHeader(client: Client, headerGUID: string, patch: { customerInvoiceNumber?: string; customerInvoiceDateTime?: string | null; legalEntityGUID?: string; customerInvoicePartner?: string; customerInvoiceContract?: string | null }): Promise<void> {
  const { error } = await client.rpc(RPC_CUSTOMER_SET_HEADER, { p_header: headerGUID, p_patch: patch });
  if (error) fail(error);
}

export async function postCustomerInvoice(client: Client, headerGUID: string): Promise<CustomerInvoicePostAnswer> {
  const { data, error } = await client.rpc(RPC_CUSTOMER_POST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

export async function unpostCustomerInvoice(client: Client, headerGUID: string): Promise<CustomerInvoicePostAnswer> {
  const { data, error } = await client.rpc(RPC_CUSTOMER_UNPOST, { p_header: headerGUID });
  if (error) fail(error);
  return parsePostAnswer(data);
}

/** a DRAFT document (and its lines) is deleted; a posted one is not */
export async function deleteCustomerInvoice(client: Client, headerGUID: string): Promise<void> {
  const { error } = await client.rpc(RPC_CUSTOMER_DELETE, { p_header: headerGUID });
  if (error) fail(error);
}

/** ONE independent line (no task line) of a DRAFT; the kind = revenueGenus; returns the GUID of the line */
export async function addCustomerInvoiceLine(client: Client, headerGUID: string, genus: string): Promise<string> {
  const { data, error } = await client.rpc(RPC_CUSTOMER_ADD_LINE, { p_header: headerGUID, p_genus: genus });
  if (error) fail(error);
  return String(data);
}
