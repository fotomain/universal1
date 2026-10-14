// useMonitor01Rows - the rows of monitor01_view, loaded once (pages of MONITOR01_PAGE_SIZE) and then kept current by Supabase Realtime (postgres_changes).
//   * the screen never refetches on a change: an event carries the whole row (REPLICA IDENTITY FULL) and is PATCHED into the map by its key (applyMonitor01Events)
//   * events within MONITOR01_EVENT_BATCH_MS are applied together (one render)
//   * after a reconnect everything is read again (events sent while the socket was down are lost - the same rule as useProjectRealtime)
//   * project mode listens to one project (filter rowProjectGUID); the full data set listens to the table - Realtime sends only the rows the read policy lets the user see
//   * a SAFETY NET under Realtime: every MONITOR01_POLL_INTERVAL_MS the screen asks monitor01_stamp (my row count + newest updated_at, the age of the queue): another set of rows twice in a row = read
//     again (a missed event, a channel that is silently dead); a task that waits in the queue longer than MONITOR01_QUEUE_STALE_SECONDS = the worker (pg_cron) is late or not running -
//     monitor01_refresh_now computes it at once, then the rows are read again
// The data age: `changedAt` is the time of the last applied event / load; `live` is true while the channel is subscribed; `checkedAt` is the time of the last answer of the stamp.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';
import { MONITOR01_COMPUTE_NOW_COOLDOWN_MS, MONITOR01_EVENT_BATCH_MS, MONITOR01_PAGE_SIZE, MONITOR01_POLL_INTERVAL_MS, MONITOR01_QUEUE_STALE_SECONDS, MONITOR01_VIEW_TABLE } from './monitor01Constants';
import { fetchMonitor01Stamp, refreshMonitor01Now } from './monitor01Api';
import { Monitor01Event, Monitor01Row, applyMonitor01Events, monitor01Key, monitor01LocalStamp, monitor01StampDiffers, parseMonitor01Row } from './monitor01Model';

export interface UseMonitor01Rows {
  rows: Monitor01Row[];
  isLoading: boolean;
  error: string | null;
  /** the channel is open: changes arrive */
  live: boolean;
  /** ms of the last load / applied event */
  changedAt: number | null;
  /** ms of the last answer of the stamp (the safety net under Realtime works while this is recent) */
  checkedAt: number | null;
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

export function useMonitor01Rows(projectGUID?: string | null, options: { poll?: boolean } = {}): UseMonitor01Rows {
  const poll = options.poll !== false;
  const { supabase: typedClient } = useSupabase();
  // the realtime part of the client is used through `any`: its generic overloads do not know a filter string built at run time
  const supabase: any = typedClient;
  const [map, setMap] = useState<ReadonlyMap<string, Monitor01Row>>(NONE);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const mapRef = useRef(map);
  mapRef.current = map;
  const loadingRef = useRef(true);
  loadingRef.current = isLoading;
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

  // the safety net under Realtime (see the top of the file)
  useEffect(() => {
    if (!poll || !supabase?.rpc) return undefined;
    let cancelled = false;
    let mismatches = 0;
    let lastCompute = 0;
    let busy = false;
    const tick = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        const st = await fetchMonitor01Stamp(supabase, projectGUID);
        if (cancelled) return;
        setCheckedAt(Date.now());
        if (!loadingRef.current) {
          // another set of rows than the screen holds, twice in a row (one tick of grace: an event that is just being applied)
          mismatches = monitor01StampDiffers(st, monitor01LocalStamp(mapRef.current.values())) ? mismatches + 1 : 0;
          if (mismatches >= 2) { mismatches = 0; setNonce((n) => n + 1); }
        }
        // the worker is late or not running: compute at once, then read again
        if (st.queued > 0 && st.queuedAgeSeconds > MONITOR01_QUEUE_STALE_SECONDS && Date.now() - lastCompute > MONITOR01_COMPUTE_NOW_COOLDOWN_MS) {
          lastCompute = Date.now();
          await refreshMonitor01Now(supabase, projectGUID);
          if (!cancelled) setNonce((n) => n + 1);
        }
      } catch {
        // the next tick asks again (offline, a refused call): the badge shows it when nothing arrives
      } finally {
        busy = false;
      }
    };
    const id = setInterval(() => { void tick(); }, MONITOR01_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [supabase, projectGUID, poll]);

  const rows = useMemo(() => [...map.values()], [map]);
  return { rows, isLoading, error, live, changedAt, checkedAt, reload: () => setNonce((n) => n + 1) };
}
