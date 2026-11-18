// useConsolidationStatus - the status of the consolidation of the user's organization (SQL consolidation_status) and the "Refresh now" command (consolidation_refresh_now).
// The client may be null (a screen or a test without Supabase never throws). The status is read once when enabled, after a refresh and every `pollMs` while it is recalculating.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';
import { parseConsolidationStatus, type ConsolidationStatus } from './consolidationModel';

export function useConsolidationStatus(enabled: boolean, pollMs = 4000) {
  const { supabase } = useSupabase() as any;
  const client = useRef<any>(supabase);
  client.current = supabase;
  const [status, setStatus] = useState<ConsolidationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const read = useCallback(async () => {
    const sb = client.current;
    if (!sb?.rpc) return null;
    const { data, error: e } = await sb.rpc('consolidation_status');
    if (e) { setError(String(e.message || e)); return null; }
    const parsed = parseConsolidationStatus(data);
    setStatus(parsed);
    setError(null);
    return parsed;
  }, []);

  useEffect(() => { if (enabled) void read(); }, [enabled, read]);

  const recalculating = status?.state === 'recalculating';
  useEffect(() => {
    if (!enabled || !recalculating) return undefined;
    const t = setInterval(() => { void read(); }, pollMs);
    return () => clearInterval(t);
  }, [enabled, recalculating, pollMs, read]);

  /** "Refresh now": the worker for my organization (works without pg_cron) */
  const refreshNow = useCallback(async () => {
    const sb = client.current;
    if (!sb?.rpc) return;
    setBusy(true);
    try {
      const { data, error: e } = await sb.rpc('consolidation_refresh_now');
      if (e) setError(String(e.message || e));
      else { setStatus(parseConsolidationStatus(data)); setError(null); }
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, error, busy, reload: read, refreshNow };
}
