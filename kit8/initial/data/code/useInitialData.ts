// useInitialData - the state of the initial program data for the screen and the gate: check (one RPC + the rates), decide, run, check again.
//   phase: idle -> checking -> ready (nothing required is missing) | needs (a list is shown) | running -> done | failed ; blocked (this user may not write)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchInitialDataStatus } from './initialDataApi';
import { defaultChecked, evaluateStatus, GateDecision, gateDecision, GroupEvaluation, InitialDataStatus, InitialFile } from './initialDataModel';
import { loadAllInitialFiles } from './loadInitialJson';
import { currencyRefreshConfig } from '../../../catalog/currency/refresh/currencyRefreshConfig';
import { InitialDataRunError, InitialProgress, InitialRunResult, runInitialData } from './runInitialData';
import { readCurrencies, ratesInForceNow } from './rates/ratesApi';

export type InitialPhase = 'idle' | 'checking' | 'ready' | 'needs' | 'blocked' | 'running' | 'done' | 'failed';

export interface InitialDataController {
  phase: InitialPhase;
  status: InitialDataStatus | null;
  evaluation: GroupEvaluation[];
  decision: GateDecision | null;
  progress: InitialProgress | null;
  result: InitialRunResult | null;
  error: string | null;
  /** the group that failed (a failed run) */
  failedGroup: string | null;
  /** the groups a Create would write */
  checkedIds: string[];
  setCheckedIds: (ids: string[]) => void;
  /** reads the database again (the rates too) */
  check: () => Promise<{ evaluation: GroupEvaluation[]; decision: GateDecision } | null>;
  /** writes the groups (default: the checked ones); resolves true when every required group is there afterwards */
  run: (groupIds?: string[]) => Promise<boolean>;
}

export interface UseInitialDataOptions {
  supabase: any;
  /** run `check` once when the hook is mounted */
  autoCheck?: boolean;
  /** replaceable in tests */
  files?: Record<string, InitialFile>;
  today?: string;
}

export function useInitialData({ supabase, autoCheck = true, files: filesIn, today }: UseInitialDataOptions): InitialDataController {
  const [phase, setPhase] = useState<InitialPhase>('idle');
  const [status, setStatus] = useState<InitialDataStatus | null>(null);
  const [evaluation, setEvaluation] = useState<GroupEvaluation[]>([]);
  const [decision, setDecision] = useState<GateDecision | null>(null);
  const [progress, setProgress] = useState<InitialProgress | null>(null);
  const [result, setResult] = useState<InitialRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedGroup, setFailedGroup] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const filesRef = useRef<Record<string, InitialFile> | null>(filesIn ?? null);
  const statusRef = useRef<InitialDataStatus | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const files = useCallback(() => {
    if (!filesRef.current) filesRef.current = loadAllInitialFiles();
    return filesRef.current;
  }, []);

  const check = useCallback(async () => {
    setPhase('checking');
    setError(null);
    try {
      const all = files();
      const st = await fetchInitialDataStatus(supabase, all);
      statusRef.current = st;
      // the rates need the currencies of the database; a database without them has no rates
      let ratesOk = false;
      if ((st.tables.currencyTable?.rows ?? 0) > 0) ratesOk = await ratesInForceNow(supabase, await readCurrencies(supabase), today, currencyRefreshConfig());
      const ev = evaluateStatus(st, all, ratesOk);
      const dec = gateDecision(ev, st);
      if (!mounted.current) return null;
      setStatus(st);
      setEvaluation(ev);
      setDecision(dec);
      setCheckedIds(defaultChecked(ev));
      setPhase(dec.kind === 'ready' ? 'ready' : dec.kind === 'blocked' ? 'blocked' : 'needs');
      return { evaluation: ev, decision: dec };
    } catch (e: any) {
      if (mounted.current) { setError(e?.message || String(e)); setPhase('failed'); setFailedGroup(null); }
      return null;
    }
  }, [files, supabase, today]);

  const run = useCallback(async (groupIds?: string[]) => {
    const st = statusRef.current;
    if (!st) return false;
    setPhase('running');
    setError(null);
    setFailedGroup(null);
    setProgress(null);
    try {
      const res = await runInitialData({ supabase, files: files(), status: st, groupIds: groupIds ?? checkedIds, today, onProgress: (p) => { if (mounted.current) setProgress(p); } });
      if (mounted.current) setResult(res);
      const again = await check();
      const ok = !!again && again.decision.kind === 'ready';
      if (mounted.current) setPhase(ok ? 'done' : 'failed');
      if (!ok && mounted.current && again) setError(error ?? 'Some required data is still missing');
      return ok;
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || String(e));
        setFailedGroup(e instanceof InitialDataRunError ? e.groupId : null);
        setPhase('failed');
      }
      return false;
    }
  }, [check, checkedIds, error, files, supabase, today]);

  useEffect(() => { if (autoCheck && supabase) void check(); }, [autoCheck, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => ({ phase, status, evaluation, decision, progress, result, error, failedGroup, checkedIds, setCheckedIds, check, run }),
    [phase, status, evaluation, decision, progress, result, error, failedGroup, checkedIds, check, run]);
}
