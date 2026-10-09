// The exchange rates a task line needs to convert its sums (taskLineFx.ts): the currencies (redux, small) and the rate rows of the currencies the
// project and its lines use (read straight from Supabase, all rate types, paged: a currency has about 450 working days of rates a year and one request
// returns at most 1000 rows). Cached by React Query; null while the rates are being read, so a line is never converted with half of them.
import { useEffect, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { useSupabase } from '../../../../providers/WithSupabase';
import { CURRENCY_ENTITY, CURRENCY_READ_PARAMS } from '../../../../catalog/currency/currencyModel';
import { currencyExchangeRateTable } from '../../../../catalog/currency/exchange/currencyExchangeModel';
import { buildRateBook, RateBook } from '../../../../catalog/currency/exchange/currencyConvert';
import { currencyRefreshConfig } from '../../../../catalog/currency/refresh/currencyRefreshConfig';

const PAGE = 1000;

export function useLineRateBook(codes: string[], enabled: boolean): { book: RateBook | null; loading: boolean; error: string } {
  const dispatch = useDispatch();
  const { supabase } = useSupabase();
  const currencies: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer, shallowEqual) ?? [];
  useEffect(() => {
    if (!enabled) return;
    const actions = SystemMetaData[CURRENCY_ENTITY]?.actions;
    if (actions?.readData) dispatch(actions.readData(CURRENCY_READ_PARAMS));
  }, [enabled, dispatch]);

  const base = currencyRefreshConfig().base;
  const wanted = useMemo(() => [...new Set(codes.map((c) => String(c || '').toUpperCase()).filter(Boolean))].sort(), [codes.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const guids = useMemo(() => (Array.isArray(currencies) ? currencies : []).filter((c) => wanted.includes(String(c?.rowJSON?.currencyCode || '').toUpperCase()) && String(c.rowJSON.currencyCode).toUpperCase() !== base).map((c) => c.rowGUID as string).sort(), [currencies, wanted, base]);

  const query = useQuery({
    queryKey: ['pm', 'fxRates', guids.join(',')],
    enabled: enabled && guids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const out: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from(currencyExchangeRateTable).select('rowOwnerGUID,rowParentGUID,rowJSON').in('rowOwnerGUID', guids).order('rowOwnerGUID').order('rowParentGUID').range(from, from + PAGE - 1);
        if (error) throw new Error(error.message || String(error));
        out.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
  });

  const book = useMemo(() => {
    if (!enabled) return null;
    if (guids.length > 0 && !query.data) return null;
    return buildRateBook(Array.isArray(currencies) ? currencies : [], query.data ?? [], base);
  }, [enabled, guids.length, query.data, currencies, base]);
  return { book, loading: enabled && guids.length > 0 && query.isLoading, error: query.error ? String((query.error as any).message ?? query.error) : '' };
}
