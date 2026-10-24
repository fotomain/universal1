// useReportData - the data loop every live report needs, in one hook: load(client) on every change of `deps`, and, while `live`, a Supabase Realtime channel on one table that
// re-reads (debounced) when anything in it changes; a reconnect reads again (the events of the gap are lost). `live` of the result says the channel is subscribed; with `watch` false (Auto refresh
// OFF) the data is a snapshot until reload() is called. Written for Monitor07 (partner balance); Monitor02 / Monitor03 have the same loop inline and can move to this hook.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';

export const REPORT_EVENT_DEBOUNCE_MS = 400;

export interface UseReportDataOptions<T> {
  /** reads the report; `supabase` is the client of the provider */
  load: (supabase: any) => Promise<T>;
  /** what `load` depends on: a change reads again */
  deps: readonly unknown[];
  /** the table whose changes re-read the report (Realtime); none = no channel */
  realtimeTable?: string;
  /** false = no channel (Auto refresh is off) */
  watch?: boolean;
  initial: T;
  /** skip the load while false (an incomplete filter) */
  enabled?: boolean;
}

export interface UseReportData<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  live: boolean;
  changedAt: number | null;
  reload: () => void;
}

export function useReportData<T>({ load, deps, realtimeTable, watch = true, initial, enabled = true }: UseReportDataOptions<T>): UseReportData<T> {
  const { supabase: typedClient } = useSupabase();
  const supabase: any = typedClient;
  const [data, setData] = useState<T>(initial);
  const [isLoading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled) { setLoading(false); return undefined; }
    const mine = ++seq.current;
    setLoading(true);
    loadRef.current(supabase)
      .then((d) => { if (mine === seq.current) { setData(d); setChangedAt(Date.now()); setError(null); } })
      .catch((e: any) => { if (mine === seq.current) setError(e?.message || String(e)); })
      .finally(() => { if (mine === seq.current) setLoading(false); });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, enabled, nonce, ...deps]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!watch || !realtimeTable || !supabase?.channel) { setLive(false); return undefined; }
    let cancelled = false;
    let everSubscribed = false;
    const onChange = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; if (!cancelled) setNonce((n) => n + 1); }, REPORT_EVENT_DEBOUNCE_MS);
    };
    const channel = supabase.channel(`report-${realtimeTable}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: realtimeTable }, onChange)
      .subscribe((status: string) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setLive(true);
          if (everSubscribed) setNonce((n) => n + 1);
          everSubscribed = true;
        } else {
          setLive(false);
        }
      });
    return () => {
      cancelled = true;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      try { supabase.removeChannel(channel); } catch { /* the client is gone */ }
    };
  }, [supabase, watch, realtimeTable]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, isLoading, error, live, changedAt, reload };
}
