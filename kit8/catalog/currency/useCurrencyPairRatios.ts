// The latest ratios of every currency of the table (currencyPairs.ts): ONE small request per currency (its newest rate rows + the count of its
// rows), so a catalog with years of daily rates is never read whole. Cached by React Query; `reload` after a refresh / upload of the rates.
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase/supabase';
import { currencyExchangeRateTable } from './exchange/currencyExchangeModel';
import { currencyRefreshConfig } from './refresh/currencyRefreshConfig';
import { basePairRatios, EMPTY_PAIR_RATIOS, latestPairRatios, PairRatios } from './currencyPairs';

/** newest rows read per currency: enough to find the latest Default AND Budget rate */
const NEWEST = 12;

export interface CurrencyPairRatios {
  base: string;
  /** by currency code (upper case) */
  ratiosOf: (code: string) => PairRatios;
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useCurrencyPairRatios(currencies: { rowGUID: string; rowJSON?: { currencyCode?: string } }[]): CurrencyPairRatios {
  const base = currencyRefreshConfig().base;
  const list = useMemo(
    () => (currencies || []).map((c) => ({ guid: c.rowGUID, code: String(c.rowJSON?.currencyCode || '').toUpperCase() })).filter((c) => c.guid && c.code).sort((a, b) => a.guid.localeCompare(b.guid)),
    [currencies],
  );
  const key = list.map((c) => c.guid).join(',');
  const query = useQuery({
    queryKey: ['currency', 'pairRatios', base, key],
    enabled: list.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const out: Record<string, PairRatios> = {};
      await Promise.all(list.map(async ({ guid, code }) => {
        if (code === base) { out[code] = basePairRatios(); return; }
        // orderInList = -dayNumber (currencyExchangeModel.ts): ascending = the newest day first
        const { data, error, count } = await supabase
          .from(currencyExchangeRateTable)
          .select('rowParentGUID,rowJSON', { count: 'exact' })
          .eq('rowOwnerGUID', guid)
          .order('orderInList', { ascending: true })
          .limit(NEWEST);
        if (error) throw new Error(error.message || String(error));
        out[code] = latestPairRatios(data || [], base, count ?? undefined);
      }));
      return out;
    },
  });
  const { refetch } = query;
  const data = query.data;
  const ratiosOf = useCallback((code: string): PairRatios => data?.[String(code || '').toUpperCase()] ?? EMPTY_PAIR_RATIOS, [data]);
  const reload = useCallback(() => { refetch(); }, [refetch]);
  return { base, ratiosOf, loading: query.isLoading, error: query.error ? String((query.error as any).message ?? query.error) : '', reload };
}
