// useProjectCostTotals - costTotalForBudget of every task and stage of the open project: read once, then kept current by Supabase Realtime.
//   * an event carries the whole row (REPLICA IDENTITY FULL) and is PATCHED into the map by the task key (applyCostEvents): the project data is never refetched for a cost change
//   * events within COST_EVENT_BATCH_MS are applied together (one render)
//   * after a reconnect everything is read again (events sent while the socket was down are lost - the rule of useProjectRealtime / useMonitor01Rows)
//   * the toolbar command (and a Post) say emitCostTotalsStale: the totals are read again
//   * `enabled` = false (no cost budget / the switch is off): no query, no channel, an empty map
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '../../providers/WithSupabase';
import { readProjectCostRows } from './costTotalApi';
import { COST_EVENT_BATCH_MS, COST_TOTAL_TABLE, CostEvent, CostTotals, NO_COST_TOTALS, applyCostEvents, costTotalsOf, onCostTotalsStale } from './costTotalModel';

export interface UseProjectCostTotals {
  totals: CostTotals;
  isLoading: boolean;
  error: string | null;
  /** the channel is open: changes arrive */
  live: boolean;
  reload: () => void;
}

export function useProjectCostTotals(projectGUID: string | null | undefined, enabled: boolean): UseProjectCostTotals {
  const { supabase: typedClient } = useSupabase();
  // the realtime part of the client is used through `any`: its generic overloads do not know a filter string built at run time
  const supabase: any = typedClient;
  const active = enabled && !!projectGUID;
  const [totals, setTotals] = useState<CostTotals>(NO_COST_TOTALS);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [nonce, setNonce] = useState(0);
  const ref = useRef(totals);
  ref.current = totals;
  const pending = useRef<CostEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // first load, a reload on demand, and the end of a project / of the switch
  useEffect(() => {
    if (!active) { setTotals(NO_COST_TOTALS); setLoading(false); setError(null); return undefined; }
    let cancelled = false;
    setLoading(true);
    readProjectCostRows(supabase, projectGUID as string)
      .then((rows) => { if (cancelled) return; pending.current = []; setTotals(costTotalsOf(rows)); setError(null); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, supabase, projectGUID, nonce]);

  // "read again" from the toolbar command
  useEffect(() => {
    if (!active) return undefined;
    return onCostTotalsStale((g) => { if (!g || g === projectGUID) reload(); });
  }, [active, projectGUID, reload]);

  // realtime
  useEffect(() => {
    if (!active || !supabase?.channel) return undefined;
    let cancelled = false;
    let everSubscribed = false;
    const flush = () => {
      timer.current = null;
      const events = pending.current;
      pending.current = [];
      if (!events.length || cancelled) return;
      const next = applyCostEvents(ref.current, events);
      if (next !== ref.current) setTotals(next);
    };
    const onChange = (payload: any) => {
      pending.current.push({ eventType: payload.eventType, new: payload.new, old: payload.old });
      if (!timer.current) timer.current = setTimeout(flush, COST_EVENT_BATCH_MS);
    };
    const channel = supabase.channel(`cost-total-${projectGUID}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: COST_TOTAL_TABLE, filter: `rowProjectGUID=eq.${projectGUID}` }, onChange)
      .subscribe((status: string) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setLive(true);
          if (everSubscribed) reload();          // a reconnect: the events of the gap are lost, read again
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
  }, [active, supabase, projectGUID, reload]);

  return { totals, isLoading, error, live, reload };
}
