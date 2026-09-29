// Pure list helpers for the reusable CRUD slice (rows keyed by rowGUID, ordered by orderInList).
// Used by realtime changes (another browser / device edited the table) and by *Success actions.
import type { RealtimeRowChange } from './createSupabaseTableChannel';

export const rowIdOf = (row: any): string | undefined => row?.rowGUID ?? row?.id;
const orderOf = (row: any): number => Number(row?.orderInList ?? row?.rowJSON?.orderInList ?? 0);

/** Insert or replace by rowGUID, keep ascending orderInList (stable for equal orders). */
export function upsertRow<T>(list: T[] | undefined | null, row: T): T[] {
  const id = rowIdOf(row);
  if (!id) return Array.isArray(list) ? list : [];
  const rest = (Array.isArray(list) ? list : []).filter((r) => rowIdOf(r) !== id);
  const out = [...rest, row];
  return out
    .map((r, i) => ({ r, i }))
    .sort((a, b) => orderOf(a.r) - orderOf(b.r) || a.i - b.i)
    .map((x) => x.r);
}

export function removeRow<T>(list: T[] | undefined | null, id: string | undefined): T[] {
  const arr = Array.isArray(list) ? list : [];
  return id ? arr.filter((r) => rowIdOf(r) !== id) : arr;
}

/** INSERT / UPDATE -> upsert the new row, DELETE -> remove old.rowGUID. */
export function applyRealtimeChangeToList<T>(list: T[] | undefined | null, change: RealtimeRowChange<T>): T[] {
  if (!change) return Array.isArray(list) ? list : [];
  if (change.eventType === 'DELETE') return removeRow(list, rowIdOf(change.old));
  if ((change.eventType === 'INSERT' || change.eventType === 'UPDATE') && change.new) return upsertRow(list, change.new);
  return Array.isArray(list) ? list : [];
}

// ───────────── scoped lists (readParams.match, e.g. { rowOwnerGUID: currencyGUID }) ─────────────
// One redux entity can show a slice of its table (the rates of ONE currency). The same `match` object
// filters the server read (readAll -> .match()), the realtime changes (scopeRealtimeChange) and the
// rows a list renders (ListWebCardsComponent), so rows of other owners never leak into the list.

/** true when every key of `match` equals the row's column (compared as strings); no match = everything. */
export function matchRow(row: any, match?: Record<string, any> | null): boolean {
  if (!match || Object.keys(match).length === 0) return true;
  if (!row) return false;
  return Object.entries(match).every(([k, v]) => String(row[k]) === String(v));
}

/**
 * Realtime change -> the change this scoped list must apply (null = ignore).
 * INSERT / UPDATE outside the scope are ignored; an UPDATE that moved a row OUT of the scope removes it;
 * DELETE is applied when the old row matches or carries no scope columns (removing an unknown id is a no-op).
 */
export function scopeRealtimeChange<T = any>(change: RealtimeRowChange<T>, match?: Record<string, any> | null): RealtimeRowChange<T> | null {
  if (!change || !match || Object.keys(match).length === 0) return change;
  if (change.eventType === 'DELETE') {
    const old: any = change.old;
    if (!old) return change;
    const hasScopeColumns = Object.keys(match).every((k) => k in old);
    return !hasScopeColumns || matchRow(old, match) ? change : null;
  }
  if (matchRow(change.new, match)) return change;
  if (change.eventType === 'UPDATE' && change.new) {
    return { ...change, eventType: 'DELETE', new: null, old: { ...((change.old as any) || {}), rowGUID: rowIdOf(change.new) } as any };
  }
  return null;
}
