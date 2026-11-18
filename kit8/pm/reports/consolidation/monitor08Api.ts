// monitor08Api - the calls of Monitor08 Consolidation (SQL PART 52): consolidation_report (SECURITY INVOKER: the policies decide which projects the user sees) and consolidation_gap_list.
import { ConsolidationReportRow, parseConsolidationReportRow } from './monitor08Model';

export interface ConsolidationGapRow { rowGUID: string; rowProjectGUID: string; sourceTable: string; fromCurrency: string | null; toCurrency: string | null; rateType: string | null; periodDay: string | null; reason: string }

export async function fetchConsolidationReport(supabase: any, args: { projects?: string[] | null; from?: string | null; to?: string | null; byMonth?: boolean }): Promise<ConsolidationReportRow[]> {
  const { data, error } = await supabase.rpc('consolidation_report', { p_projects: args.projects ?? null, p_from: args.from ?? null, p_to: args.to ?? null, p_by_month: !!args.byMonth });
  if (error) throw new Error(String(error.message || error));
  return ((data || []) as any[]).map(parseConsolidationReportRow);
}

export async function fetchConsolidationGaps(supabase: any, limit = 200): Promise<ConsolidationGapRow[]> {
  const { data, error } = await supabase.rpc('consolidation_gap_list', { p_limit: limit });
  if (error) throw new Error(String(error.message || error));
  return (data || []) as ConsolidationGapRow[];
}
