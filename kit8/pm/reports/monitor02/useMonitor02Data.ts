// useMonitor02Data - what Monitor02_ROINow reads (documentation/ROI_DOC.html section 7.2):
//   * the projects of the report = mine with roiForTasksFunctionalityEnabled ON (roi_report_projects) - a project with the switch OFF is NOT in Monitor02
//   * the month totals of those projects for the period (project_status_month_totals; the project lines)
//   * roi_task_lines of every such project for the period (the task lines)
// Kept current by Supabase Realtime on the month totals (a change of a project's numbers re-reads, debounced); `live` is true while the channel is subscribed. A reconnect reads everything again.
// With `live` false (Auto refresh OFF) the data is a snapshot until reload() is called.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';
import { ROI_MONTH_TOTALS_TABLE, RoiMonthRow, RoiProjectInfo, RoiTaskRow, fetchRoiMonthTotals, fetchRoiReportProjects, fetchRoiTaskLines } from '../roi/roiApi';

export const MONITOR02_EVENT_DEBOUNCE_MS = 400;

export interface UseMonitor02Data {
  projects: RoiProjectInfo[];
  months: RoiMonthRow[];
  tasks: RoiTaskRow[];
  isLoading: boolean;
  error: string | null;
  live: boolean;
  changedAt: number | null;
  reload: () => void;
}

export function useMonitor02Data(period: { from: string | null; to: string | null }, options: { live?: boolean } = {}): UseMonitor02Data {
  const watch = options.live !== false;
  const { supabase: typedClient } = useSupabase();
  const supabase: any = typedClient;
  const [projects, setProjects] = useState<RoiProjectInfo[]>([]);
  const [months, setMonths] = useState<RoiMonthRow[]>([]);
  const [tasks, setTasks] = useState<RoiTaskRow[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const { from, to } = period;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchRoiReportProjects(supabase);
      const guids = list.map((p) => p.projectGUID);
      const [monthRows, taskLists] = await Promise.all([
        fetchRoiMonthTotals(supabase, guids, from, to),
        Promise.all(list.filter((p) => p.forTasks).map((p) => fetchRoiTaskLines(supabase, p.projectGUID, from, to))),
      ]);
      setProjects(list);
      setMonths(monthRows);
      setTasks(taskLists.flat());
      setChangedAt(Date.now());
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase, from, to]);

  useEffect(() => { void load(); }, [load, nonce]);

  // realtime on the month totals: any change of the numbers of a project of mine
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!watch || !supabase?.channel) { setLive(false); return undefined; }
    let cancelled = false;
    let everSubscribed = false;
    const onChange = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; if (!cancelled) setNonce((n) => n + 1); }, MONITOR02_EVENT_DEBOUNCE_MS);
    };
    const channel = supabase.channel(`monitor02-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: ROI_MONTH_TOTALS_TABLE }, onChange)
      .subscribe((status: string) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setLive(true);
          if (everSubscribed) setNonce((n) => n + 1);       // a reconnect: the events of the gap are lost, read again
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
  }, [supabase, watch]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { projects, months, tasks, isLoading, error, live, changedAt, reload };
}
