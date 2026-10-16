// factInputApi - the calls of the fact input document. Every function takes the Supabase client (useSupabase().supabase), so a test passes a fake one.
// The header is written ONLY by the RPCs; the LINES of a draft are written by the ReusableTable through the redux entity FACT_USAGE_TIMELINE_ENTITY (factMetaData.ts), not here.
import {
  FACT_HEADER_TABLE, FactListAnswer, FactListFilter, FactPostAnswer, RPC_FACT_CREATE, RPC_FACT_LIST, RPC_FACT_POST, RPC_FACT_UNPOST, factListFilterToRpc, parseFactAnswer, parseFactListAnswer,
} from './factInputModel';

type Client = any;
const fail = (error: any): never => { throw new Error(error?.message || String(error)); };

/** the documents with their totals (task_fact_document_list); `extra` = keys the screen sets itself (taskGUID, status ...) */
export async function fetchFactDocumentList(client: Client, filter: FactListFilter | null, extra: Record<string, any> = {}, limit = 200, offset = 0): Promise<FactListAnswer> {
  const p_filter = filter ? factListFilterToRpc(filter, extra) : { ...extra };
  const { data, error } = await client.rpc(RPC_FACT_LIST, { p_filter, p_limit: limit, p_offset: offset });
  if (error) fail(error);
  return parseFactListAnswer(data);
}

/** a new document with ALL the lines of the task (task_fact_document_create); returns its GUID */
export async function createFactDocument(client: Client, taskGUID: string): Promise<string> {
  const { data, error } = await client.rpc(RPC_FACT_CREATE, { p_task: taskGUID });
  if (error) fail(error);
  return String(data);
}

export async function postFactDocument(client: Client, headerGUID: string): Promise<FactPostAnswer> {
  const { data, error } = await client.rpc(RPC_FACT_POST, { p_header: headerGUID });
  if (error) fail(error);
  return parseFactAnswer(data);
}

export async function unpostFactDocument(client: Client, headerGUID: string): Promise<FactPostAnswer> {
  const { data, error } = await client.rpc(RPC_FACT_UNPOST, { p_header: headerGUID });
  if (error) fail(error);
  return parseFactAnswer(data);
}

/** a draft document (and its lines) is deleted; a posted one cannot be */
export async function deleteFactDocument(client: Client, headerGUID: string): Promise<void> {
  const { error } = await client.from(FACT_HEADER_TABLE).delete().eq('rowGUID', headerGUID);
  if (error) fail(error);
}

/** the title and the project of a task (the screen can be opened by the task GUID alone) */
export async function fetchTaskInfo(client: Client, taskGUID: string): Promise<{ projectGUID: string; name: string } | null> {
  const { data, error } = await client.from('project_task_table').select('projectGUID,rowJSON').eq('rowGUID', taskGUID).maybeSingle();
  if (error) fail(error);
  return data ? { projectGUID: String(data.projectGUID), name: String(data.rowJSON?.name || '') } : null;
}
