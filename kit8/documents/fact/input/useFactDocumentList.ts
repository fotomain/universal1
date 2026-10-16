// useFactDocumentList - the rows of the list of fact documents (task_fact_document_list) for the fast filters, and the projects the project filter offers.
// The filter is applied by the DATABASE (a document is listed when one of its lines satisfies all the line filters); the totals of a row are the totals of ALL its lines.
import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import { fetchFactDocumentList } from './factInputApi';
import { FactListAnswer, FactListFilter, factListFilterToRpc } from './factInputModel';

export const factListKey = (filter: FactListFilter, limit: number) => ['pm', 'factList', factListFilterToRpc(filter), limit] as const;
export const factProjectsKey = ['pm', 'factProjects'] as const;
const EMPTY: FactListAnswer = { totalCount: 0, totals: { sumForBudget: 0, sumForContract: 0, sumForAccounting: 0 }, rows: [] };

export interface UseFactDocumentList {
  answer: FactListAnswer;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFactDocumentList(filter: FactListFilter, limit = 200): UseFactDocumentList {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: factListKey(filter, limit),
    staleTime: 3_000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,        // typing in a filter keeps the old rows on the screen until the new ones arrive
    queryFn: () => fetchFactDocumentList(supabase, filter, {}, limit, 0),
  });
  return { answer: q.data ?? EMPTY, isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

/** the projects of the user (the project filter offers them) */
export function useFactProjects(): { guid: string; name: string }[] {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: factProjectsKey,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('project_table').select('rowGUID,rowJSON').order('orderInList', { ascending: true });
      if (error) throw new Error(error.message || String(error));
      return (data || []).map((p: any) => ({ guid: String(p.rowGUID), name: String(p.rowJSON?.name || p.rowJSON?.title || p.rowGUID) }));
    },
  });
  return useMemo(() => q.data ?? [], [q.data]);
}
