// useCostRefreshDebounce - the function the Post hooks call after a successful Post: it hands the signal to the debounced scheduler (costRefreshScheduler.ts) with the Supabase client of the screen
// (null without a SupabaseProvider: then nothing is scheduled). The identity of the function changes only with the client.
import { useCallback } from 'react';
import { scheduleProjectCostRefresh } from './costRefreshScheduler';
import { useCostClient } from './useCostClient';

export function useCostRefreshDebounce(): (projectGUID: string | null | undefined, projectJSON: Parameters<typeof scheduleProjectCostRefresh>[2]) => void {
  const client = useCostClient();
  return useCallback((projectGUID, projectJSON) => scheduleProjectCostRefresh(client, projectGUID, projectJSON), [client]);
}
