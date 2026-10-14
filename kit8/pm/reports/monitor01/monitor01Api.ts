// monitor01Api - the drill-down call: monitor01_sum_sources (kit8/sql/start, PART 25) returns the SOURCE transactions of a sum, paged, with the exact count and sum.
import { MONITOR01_SUM_PAGE_SIZE, RPC_MONITOR01_REFRESH_NOW, RPC_MONITOR01_SUM_SOURCES } from './monitor01Constants';

export type Monitor01SourceMeasure = 'planned' | 'contracted' | 'delivered' | 'used' | 'fact';
/** a row of the list: the movements of the plan (planned, contracted) or the lines of a posted fact document (fact) */
export interface Monitor01SourceRow {
  rowGUID: string;
  sourceName: string;
  day: string;
  taskGUID: string;
  taskName?: string | null;
  projectGUID: string;
  lineGUID?: string | null;
  genusGUID: string;
  roleGUID: string;
  roleName?: string | null;
  unit: string;
  qty: number;
  contractGUID?: string | null;
  stale?: boolean;
  documentGUID?: string | null;
  documentNumber?: string | null;
}
export interface Monitor01SourcePage { measure: string; totalCount: number; sum: number; rows: Monitor01SourceRow[] }

export async function fetchMonitor01Sources(client: any, measure: Monitor01SourceMeasure, filter: Record<string, any>, page = 0, pageSize = MONITOR01_SUM_PAGE_SIZE): Promise<Monitor01SourcePage> {
  const { data, error } = await client.rpc(RPC_MONITOR01_SUM_SOURCES, { p_measure: measure, p_filter: filter, p_limit: pageSize, p_offset: page * pageSize });
  if (error) throw new Error(error.message || String(error));
  const d: any = data || {};
  return {
    measure: String(d.measure ?? measure),
    totalCount: Number(d.totalCount) || 0,
    sum: Number(d.sum) || 0,
    rows: Array.isArray(d.rows) ? d.rows.map((r: any) => ({ ...r, qty: Number(r.qty) || 0 })) : [],
  };
}

export interface Monitor01RefreshAnswer { tasks: number; upserted: number; deleted: number }
/**
 * monitor01_refresh_now: the database recomputes the tasks of the user's own projects at once (plan movements AND posted facts), the same way the pg_cron worker does. It is the way to get the numbers
 * when the worker is not running; the error of the database is thrown (the screen shows it), never swallowed.
 */
export async function refreshMonitor01Now(client: any, projectGUID?: string | null): Promise<Monitor01RefreshAnswer> {
  const { data, error } = await client.rpc(RPC_MONITOR01_REFRESH_NOW, { p_project: projectGUID || null });
  if (error) throw new Error(error.message || String(error));
  const d: any = data || {};
  return { tasks: Number(d.tasks) || 0, upserted: Number(d.upserted) || 0, deleted: Number(d.deleted) || 0 };
}
