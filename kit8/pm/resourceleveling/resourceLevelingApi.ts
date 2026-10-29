// resourceLevelingApi - the calls of Resource optimization to the database (SQL PART 42; documentation/RESOURCE_LEVELING_WBS.html section 8). Thin: the rules are in the functions.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InputRow } from './resourceLevelingEnv';
import type { ServerMove, ServerUnresolved } from './resourceLevelingRun';
import type { ServerProblem } from './resourceLevelingServerProblem';

export interface LevelingInputs { capacity: InputRow[]; foreign: InputRow[] }

export interface LevelingRunRow {
  rowGUID: string;
  rowProjectGUID: string;
  rowOwnerGUID: string;
  runKind: 'level' | 'clear' | 'undo';
  runMode: 'manual' | 'automatic' | 'fast';
  runMethod: 'leveling' | 'smoothing';
  tasksMoved: number;
  tasksUnposted: number;
  conflictsBefore: number;
  conflictsAfter: number;
  unresolvedCount: number;
  startBefore: string | null;
  startAfter: string | null;
  finishBefore: string | null;
  finishAfter: string | null;
  undoneByGUID: string | null;
  created_at: string;
}

const dayIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fail = (what: string, error: { message?: string } | null) => { throw new Error(`${what}: ${error?.message ?? 'failed'}`); };

/** the capacity and the foreign load of the resources between two days (UTC ms) */
export async function fetchLevelingInputs(supabase: SupabaseClient, projectGUID: string, fromMs: number, toMs: number, resources: { k: string; g: string }[]): Promise<LevelingInputs> {
  const { data, error } = await supabase.rpc('project_resource_leveling_inputs', { p_project: projectGUID, p_from: dayIso(fromMs), p_to: dayIso(toMs), p_resources: resources });
  if (error) fail('project_resource_leveling_inputs', error);
  return { capacity: (data?.capacity ?? []) as InputRow[], foreign: (data?.foreign ?? []) as InputRow[] };
}

export async function applyLevelingRun(supabase: SupabaseClient, projectGUID: string, run: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabase.rpc('project_resource_leveling_apply', { p_project: projectGUID, p_run: run });
  if (error) fail('project_resource_leveling_apply', error);
  return (data as string | null) ?? null;
}

export async function clearLeveling(supabase: SupabaseClient, projectGUID: string, tasks: string[] | null, mode: 'manual' | 'automatic' | 'fast', keepHistory: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc('project_resource_leveling_clear', { p_project: projectGUID, p_tasks: tasks, p_mode: mode, p_keep_history: keepHistory });
  if (error) fail('project_resource_leveling_clear', error);
  return (data as string | null) ?? null;
}

export interface UndoAnswer { run: string; restored: number; skipped: number; skippedTasks: string[] }

export async function undoLevelingRun(supabase: SupabaseClient, runGUID: string): Promise<UndoAnswer> {
  const { data, error } = await supabase.rpc('project_resource_leveling_undo', { p_run: runGUID });
  if (error) fail('project_resource_leveling_undo', error);
  return data as UndoAnswer;
}

export async function fetchLevelingRuns(supabase: SupabaseClient, projectGUID: string, limit = 50): Promise<LevelingRunRow[]> {
  const { data, error } = await supabase.from('project_resource_leveling_run').select('*').eq('rowProjectGUID', projectGUID).order('created_at', { ascending: false }).limit(limit);
  if (error) fail('project_resource_leveling_run', error);
  return (data ?? []) as LevelingRunRow[];
}

/** the tasks of the project that have a POSTED fact input (never moved) */
export async function fetchFactTasks(supabase: SupabaseClient, projectGUID: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('task_fact_header').select('rowOwnerGUID,rowJSON').eq('rowProjectGUID', projectGUID);
  if (error) fail('task_fact_header', error);
  const out = new Set<string>();
  for (const r of (data ?? []) as { rowOwnerGUID: string; rowJSON?: any }[]) if (r.rowJSON?.documentHeader?.documentStatus === 'posted') out.add(r.rowOwnerGUID);
  return out;
}

/** the answer of project_resource_leveling_server_plan: the proposal of the database, or the reasons why it does not calculate this plan */
export type ServerPlanAnswer =
  | { supported: true; delays: Record<string, number>; moves: ServerMove[]; unresolved: ServerUnresolved[]; passes: number; conflictsBefore: number; conflictsAfter: number; finish: string }
  | { supported: false; reasons: string[] };

/** an error of the call with the code of the database (PGRST202 / 42883 = the function is not installed) */
export class ServerPlanError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.name = 'ServerPlanError'; this.code = code; }
}

/** the function is not in the database (start2_sql_code.sql PART 42 was not run after the update) */
export const isServerPlanMissing = (e: unknown): boolean => {
  const code = (e as { code?: string } | null)?.code;
  const msg = String((e as { message?: string } | null)?.message ?? '');
  return code === 'PGRST202' || code === '42883' || /could not find the function|does not exist/i.test(msg);
};

export async function fetchServerPlan(supabase: SupabaseClient, projectGUID: string, problem: ServerProblem): Promise<ServerPlanAnswer> {
  const { data, error } = await supabase.rpc('project_resource_leveling_server_plan', { p_project: projectGUID, p_problem: problem });
  if (error) throw new ServerPlanError(`project_resource_leveling_server_plan: ${error.message ?? 'failed'}`, (error as { code?: string }).code);
  return data as ServerPlanAnswer;
}
