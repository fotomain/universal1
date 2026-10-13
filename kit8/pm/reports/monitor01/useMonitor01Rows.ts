// useMonitor01Rows - the rows of monitor01_view, loaded once (pages of MONITOR01_PAGE_SIZE) and then kept current by Supabase Realtime (postgres_changes).
//   * the screen never refetches on a change: an event carries the whole row (REPLICA IDENTITY FULL) and is PATCHED into the map by its key (applyMonitor01Events)
//   * events within MONITOR01_EVENT_BATCH_MS are applied together (one render)
//   * after a reconnect everything is read again (events sent while the socket was down are lost - the same rule as useProjectRealtime)
//   * project mode listens to one project (filter rowProjectGUID); the full data set listens to the table - Realtime sends only the rows the read policy lets the user see
// The data age: `changedAt` is the time of the last applied event / load; `live` is true while the channel is subscribed.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';
import { MONITOR01_EVENT_BATCH_MS, MONITOR01_PAGE_SIZE, MONITOR01_VIEW_TABLE } from './monitor01Constants';
import { Monitor01Event, Monitor01Row, applyMonitor01Events, monitor01Key, parseMonitor01Row } from './monitor01Model';

export interface UseMonitor01Rows {
  rows: Monitor01Row[];
  isLoading: boolean;
  error: string | null;
  /** the channel is open: changes arrive */
  live: boolean;
  /** ms of the last load / applied event */
  changedAt: number | null;
  reload: () => void;
}

const NONE: ReadonlyMap<string, Monitor01Row> = new Map();

/** every row of the scope (all pages) */
export async function readAllMonitor01Rows(client: any, projectGUID?: string | null): Promise<Monitor01Row[]> {
  const out: Monitor01Row[] = [];
  for (let from = 0; ; from += MONITOR01_PAGE_SIZE) {
    let q = client.from(MONITOR01_VIEW_TABLE).select('*').order('rowOwnerGUID').order('genusGUID').order('resourceRoleGUID').order('measureUnit').order('periodMonth').range(from, from + MONITOR01_PAGE_SIZE - 1);
    if (projectGUID) q = q.eq('rowProjectGUID', projectGUID);
    const { data, error } = await q;
    if (error) throw new Error(error.message || String(error));
    const page = (data || []) as any[];
    for (const raw of page) out.push(parseMonitor01Row(raw));
    if (page.length < MONITOR01_PAGE_SIZE) break;
  }
  return out;
}

export function useMonitor01Rows(projectGUID?: string | null): UseMonitor01Rows {
  const { supabase: typedClient } = useSupabase();
  // the realtime part of the client is used through `any`: its generic overloads do not know a filter string built at run time
  const supabase: any = typedClient;
  const [map, setMap] = useState<ReadonlyMap<string, Monitor01Row>>(NONE);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const mapRef = useRef(map);
  mapRef.current = map;
  const pending = useRef<Monitor01Event[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await readAllMonitor01Rows(supabase, projectGUID);
      pending.current = [];
      const next = new Map<string, Monitor01Row>();
      for (const r of rows) next.set(monitor01Key(r), r);
      setMap(next);
      setChangedAt(Date.now());
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase, projectGUID]);

  // first load (and a reload on demand)
  useEffect(() => { void load(); }, [load, nonce]);

  // realtime
  useEffect(() => {
    if (!supabase?.channel) return undefined;
    let cancelled = false;
    let everSubscribed = false;
    const flush = () => {
      timer.current = null;
      const events = pending.current;
      pending.current = [];
      if (!events.length || cancelled) return;
      const next = applyMonitor01Events(mapRef.current, events);
      if (next !== mapRef.current) { setMap(next); setChangedAt(Date.now()); }
    };
    const onChange = (payload: any) => {
      pending.current.push({ eventType: payload.eventType, new: payload.new, old: payload.old });
      if (!timer.current) timer.current = setTimeout(flush, MONITOR01_EVENT_BATCH_MS);
    };
    const config: Record<string, any> = { event: '*', schema: 'public', table: MONITOR01_VIEW_TABLE };
    if (projectGUID) config.filter = `rowProjectGUID=eq.${projectGUID}`;
    const channel = supabase.channel(`monitor01-${projectGUID || 'all'}-${Date.now()}`)
      .on('postgres_changes', config, onChange)
      .subscribe((status: string) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setLive(true);
          if (everSubscribed) setNonce((n) => n + 1);          // a reconnect: the events of the gap are lost, read again
          everSubscribed = true;
        } else {
          setLive(false);
        }
      });
    return () => {
      cancelled = true;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      pending.current = [];
      try { supabase.removeChannel(channel); } catch { /* the client is gone */ }
    };
  }, [supabase, projectGUID]);

  const rows = useMemo(() => [...map.values()], [map]);
  return { rows, isLoading, error, live, changedAt, reload: () => setNonce((n) => n + 1) };
}
