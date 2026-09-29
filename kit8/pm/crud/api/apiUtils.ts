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
