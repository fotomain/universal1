// factInputApi - the calls of the fact input document. Every function takes the Supabase client (useSupabase().supabase), so a test passes a fake one.
// The header is written ONLY by the RPCs; the lines of a DRAFT are plain table writes (the database fills project / task / day grain / sums and refuses what the mode forbids).
import {
  FACT_HEADER_TABLE, FACT_TIMELINE_TABLE, FactHeaderRow, FactLineRow, FactPostAnswer, RPC_FACT_CREATE, RPC_FACT_POST, RPC_FACT_UNPOST, parseFactAnswer,
} from './factInputModel';

type Client = any;
const fail = (error: any): never => { throw new Error(error?.message || String(error)); };

/** the documents of a task, newest first */
export async function fetchFactDocuments(client: Client, taskGUID: string): Promise<FactHeaderRow[]> {
  const { data, error } = await client.from(FACT_HEADER_TABLE).select('rowGUID,rowProjectGUID,rowOwnerGUID,rowJSON,created_at,updated_at').eq('rowOwnerGUID', taskGUID).order('created_at', { ascending: false });
  if (error) fail(error);
  return (data || []) as FactHeaderRow[];
}

/** the lines of one document, in the order of the document */
export async function fetchFactLines(client: Client, headerGUID: string): Promise<FactLineRow[]> {
  const { data, error } = await client.from(FACT_TIMELINE_TABLE).select('*').eq('rowHeaderGUID', headerGUID).order('orderInList', { ascending: true }).order('created_at', { ascending: true });
  if (error) fail(error);
  return (data || []) as FactLineRow[];
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

/** the user changes the date and / or the quantity (anything else is refused by the database in the strong mode; a free line may change its description) */
export async function updateFactLine(client: Client, lineGUID: string, patch: Partial<Pick<FactLineRow, 'rowPeriodDatetime' | 'qtyForContract' | 'rowJSON' | 'orderInList'>>): Promise<FactLineRow> {
  const { data, error } = await client.from(FACT_TIMELINE_TABLE).update(patch).eq('rowGUID', lineGUID).select('*').single();
  if (error) fail(error);
  return data as FactLineRow;
}

/** FREE mode only: the database refuses it (row-level security) in the strong mode and in a posted document */
export async function insertFactLine(client: Client, line: Omit<FactLineRow, 'rowGUID' | 'rowProjectGUID' | 'rowOwnerGUID'>): Promise<FactLineRow> {
  const { data, error } = await client.from(FACT_TIMELINE_TABLE).insert(line).select('*').single();
  if (error) fail(error);
  return data as FactLineRow;
}

export async function deleteFactLine(client: Client, lineGUID: string): Promise<void> {
  const { error } = await client.from(FACT_TIMELINE_TABLE).delete().eq('rowGUID', lineGUID);
  if (error) fail(error);
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
