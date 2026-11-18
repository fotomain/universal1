// Low-level helpers shared by the Supabase CRUD factories in kit8/pm/crud/*.

import { PMLinkType, PMProjectRow, PMTaskDependencyRow, PMTaskRow } from '../../model/types';

export function newGUID(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Supabase / PostgREST answers at most 1000 rows to ONE request (the project's max-rows): a project of 1 958 tasks was read as its first 1000 and 732 of them looked like root rows. */
export const PM_PAGE = 1000;

/**
 * Reads ALL rows of a query, page by page. `page(from, to)` must return the SAME query with `.range(from, to)` and a UNIQUE order (add the key as the last .order(),
 * else rows with equal order values may be skipped or doubled between two pages).
 */
export async function readAllPages<T = any>(page: (from: number, to: number) => PromiseLike<{ data: any; error: any }>, size: number = PM_PAGE): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const res = await page(from, from + size - 1);
    if (res.error) throw new Error(res.error.message || String(res.error));
    const rows = (res.data || []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/** Unwraps a Supabase response or throws its error message. */
export function check<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw new Error(res.error.message || String(res.error));
  return res.data as T;
}

export function normalizeTask(row: any): PMTaskRow {
  return { ...row, rowProgress: Number(row.rowProgress) || 0, orderInList: Number(row.orderInList) || 0, rowJSON: row.rowJSON || {} };
}

export function normalizeProject(row: any): PMProjectRow {
  return { ...row, rowProgress: Number(row.rowProgress) || 0, orderInList: Number(row.orderInList) || 0, rowJSON: row.rowJSON || {} };
}

export function normalizeDep(row: any): PMTaskDependencyRow {
  return { ...row, linkType: (row.linkType || 'FS') as PMLinkType, lagDays: Number(row.lagDays) || 0, rowJSON: row.rowJSON || {} };
}

/** "pm_gantt: ..." (raised by the SQL triggers) -> "..." */
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/^pm_gantt:\s*/, '');
}
