// Project estimation - the React Query hooks: the summary (the sums of the estimation per budget item + what the project holds), the exchange rate between the two budget currencies,
// and the fill (runs fillProjectFromEstimation with the app's API, then refreshes what shows the project).
import { useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../../providers/WithSupabase';
import { pmKeys, usePMApi } from '../../../crud/shared/queryShared';
import { deleteTaskRoots, readCurrencyRate, readEstimationSummary } from './estimationApi';
import { fillProjectFromEstimation, type EstimationFillArgs, type EstimationFillResult } from './fillProjectFromEstimation';
import type { EstimationSummary } from './estimationModel';

export const estimationKeys = {
  summary: (target: string | null, source: string | null) => ['pm', 'estimationSummary', target, source] as const,
  rate: (from: string, to: string, day: string) => ['pm', 'estimationRate', from, to, day] as const,
};

/** the sums of the estimation (source) + the project that is filled (target; null = not saved yet). error = the estimation cannot be read (missing / no right). Read again every time the tab opens. */
export function useEstimationSummary(targetGUID: string | null, sourceGUID: string | null, enabled = true) {
  const { supabase } = useSupabase();
  const query = useQuery<EstimationSummary>({
    queryKey: estimationKeys.summary(targetGUID, sourceGUID),
    queryFn: () => readEstimationSummary(supabase, targetGUID, sourceGUID as string),
    enabled: enabled && !!sourceGUID,
    retry: false,
    staleTime: 0,
    gcTime: 60_000,
  });
  return query;
}

/** units of `to` for 1 unit of `from` today (null = no rate); not asked while the currencies are the same / empty */
export function useEstimationRate(from: string, to: string, enabled: boolean) {
  const { supabase } = useSupabase();
  const day = new Date().toISOString().slice(0, 10);
  return useQuery<number | null>({
    queryKey: estimationKeys.rate(from, to, day),
    queryFn: () => readCurrencyRate(supabase, from, to, day),
    enabled: enabled && !!from && !!to && from.toUpperCase() !== to.toUpperCase(),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** the fill: run(args) copies the estimation into the project; cancel() stops it between two chunks (the rows written so far are taken back) */
export function useFillProjectFromEstimation() {
  const api = usePMApi();
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const cancelled = useRef(false);
  const fillApi = useMemo(() => ({ ...api, deleteTaskRoots: (projectGUID: string, roots: readonly string[]) => deleteTaskRoots(supabase, projectGUID, roots) }), [api, supabase]);
  const run = useCallback(async (args: Omit<EstimationFillArgs, 'isCancelled'>): Promise<EstimationFillResult> => {
    cancelled.current = false;
    try {
      return await fillProjectFromEstimation(fillApi, { ...args, isCancelled: () => cancelled.current });
    } finally {
      // whatever happened (also a rollback) the dashboard, the project list and the summary read the database again
      void qc.invalidateQueries({ queryKey: pmKeys.projects(args.ownerGUID) });
      void qc.invalidateQueries({ queryKey: pmKeys.project(args.target.rowGUID) });
      void qc.invalidateQueries({ queryKey: pmKeys.projectData(args.target.rowGUID) });
      void qc.invalidateQueries({ queryKey: ['pm', 'closure'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'estimationSummary'] });
    }
  }, [fillApi, qc]);
  const cancel = useCallback(() => { cancelled.current = true; }, []);
  return { run, cancel };
}
