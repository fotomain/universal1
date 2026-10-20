// useMonitor03Data - what Monitor03_ROIHistory reads (documentation/ROI_DOC.html section 7.3):
//   * the projects that have ROI numbers (the distinct projects of project_status_month_totals, with their names and switches)
//   * of the selected project: the cumulative business-month curve (project_status_month_roi) and the history log (project_status_roi_history)
// Kept current by Realtime on the two tables for the selected project (debounced); a reconnect reads everything again. reload() reads on demand.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';
import { ROI_HISTORY_TABLE, ROI_MONTH_TOTALS_TABLE, RoiHistoryRow, RoiMonthRow, RoiProjectInfo, fetchRoiHistory, fetchRoiMonthTotals, fetchRoiProjects } from '../roi/roiApi';

export const MONITOR03_EVENT_DEBOUNCE_MS = 400;

export interface UseMonitor03Data {
  projects: RoiProjectInfo[];
  selected: RoiProjectInfo | null;
  /** the month totals of the selected project (one row per month, NOT cumulative: the dashboard sums them from the first month of the period) */
  months: RoiMonthRow[];
  history: RoiHistoryRow[];
  isLoading: boolean;
  error: string | null;
  live: boolean;
  changedAt: number | null;
  reload: () => void;
}

export function useMonitor03Data(projectGUID: string | null, options: { live?: boolean } = {}): UseMonitor03Data {
  const watch = options.live !== false;
  const { supabase: typedClient } = useSupabase();
  const supabase: any = typedClient;
  const [projects, setProjects] = useState<RoiProjectInfo[]>([]);
  const [months, setMonths] = useState<RoiMonthRow[]>([]);
  const [history, setHistory] = useState<RoiHistoryRow[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // the projects that have numbers: from the month totals (a few rows per project), then their names / switches
      const totals = await fetchRoiMonthTotals(supabase, null);
      const guids = [...new Set(totals.map((t) => t.projectGUID))];
      const list = await fetchRoiProjects(supabase, guids);
      setProjects(list);
      if (projectGUID) {
        const [mo, h] = await Promise.all([fetchRoiMonthTotals(supabase, [projectGUID]), fetchRoiHistory(supabase, projectGUID)]);
        setMonths(mo);
        setHistory(h);
      } else {
        setMonths([]);
        setHistory([]);
      }
      setChangedAt(Date.now());
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase, projectGUID]);

  useEffect(() => { void load(); }, [load, nonce]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!watch || !supabase?.channel) { setLive(false); return undefined; }
    let cancelled = false;
    let everSubscribed = false;
    const onChange = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; if (!cancelled) setNonce((n) => n + 1); }, MONITOR03_EVENT_DEBOUNCE_MS);
    };
    const filter = projectGUID ? { filter: `rowProjectGUID=eq.${projectGUID}` } : {};
    const channel = supabase.channel(`monitor03-${projectGUID || 'none'}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: ROI_MONTH_TOTALS_TABLE, ...filter }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: ROI_HISTORY_TABLE, ...filter }, onChange)
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
  }, [supabase, watch, projectGUID]);

  const selected = useMemo(() => projects.find((p) => p.projectGUID === projectGUID) ?? null, [projects, projectGUID]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { projects, selected, months, history, isLoading, error, live, changedAt, reload };
}
