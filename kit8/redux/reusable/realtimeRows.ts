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
