// useMonitor08Data - the rows of Monitor08 Consolidation for a period. A snapshot: it reads when the period changes and when reload() is called (the report has a Refresh button; it is not
// a realtime report - the consolidation worker changes the register rarely). The supabase client may be null (a screen without the provider never throws).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';
import { fetchConsolidationReport } from './monitor08Api';
import type { ConsolidationReportRow } from './monitor08Model';

export function useMonitor08Data(period: { from: string | null; to: string | null; byMonth: boolean }) {
  const { supabase } = useSupabase() as any;
  const client = useRef<any>(supabase);
  client.current = supabase;
  const [rows, setRows] = useState<ConsolidationReportRow[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const { from, to, byMonth } = period;

  const load = useCallback(async () => {
    if (!client.current?.rpc) { setLoading(false); return; }
    setLoading(true);
    try {
      setRows(await fetchConsolidationReport(client.current, { from, to, byMonth }));
      setChangedAt(Date.now());
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [from, to, byMonth]);

  useEffect(() => { void load(); }, [load]);
  return { rows, isLoading, error, changedAt, reload: load };
}
