// Supabase Realtime (postgres_changes INSERT / UPDATE / DELETE) -> redux-saga eventChannel.
// Emits { kind: 'change', payload } for every row change and { kind: 'status', status, error } for the
// socket state (SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED), so the saga can refetch after a reconnect.
// The table must be in the supabase_realtime publication (see kit8/sql/init/create_currency_table.sql).
import { eventChannel, EventChannel, buffers } from 'redux-saga';

export interface SupabaseChannelOptions {
  table: string;
  schema?: string;
  /** PostgREST-style filter, e.g. 'rowOwnerGUID=eq.123' */
  filter?: string;
  channelName?: string;
}

/** The serializable part of a postgres_changes payload that the reducers need. */
export interface RealtimeRowChange<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  new: T | null;
  old: Partial<T> | null;
  commitTimestamp?: string;
}

export type SupabaseChannelMessage<T = any> =
  | { kind: 'change'; payload: RealtimeRowChange<T> }
  | { kind: 'status'; status: string; error?: string };

export function toRealtimeRowChange<T = any>(p: any): RealtimeRowChange<T> {
  const has = (o: any) => o && typeof o === 'object' && Object.keys(o).length > 0;
  return {
    eventType: p?.eventType,
    table: p?.table,
    new: has(p?.new) ? p.new : null,
    old: has(p?.old) ? p.old : null,
    commitTimestamp: p?.commit_timestamp,
  };
}

export function createSupabaseTableChannel<T = any>(supabase: any, options: SupabaseChannelOptions): EventChannel<SupabaseChannelMessage<T>> {
  const { table, schema = 'public', filter, channelName = `realtime:${schema}:${table}:${filter || 'all'}` } = options;
  return eventChannel<SupabaseChannelMessage<T>>((emit) => {
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema, table, ...(filter ? { filter } : {}) }, (payload: any) => {
        emit({ kind: 'change', payload: toRealtimeRowChange<T>(payload) });
      })
      .subscribe((status: string, err?: any) => {
        emit({ kind: 'status', status, ...(err ? { error: String(err?.message || err) } : {}) });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, buffers.expanding(64));
}
