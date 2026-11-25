// Project estimation - the Supabase calls (SQL PART 57). A thin layer: the rules are in estimationModel.ts, the sequence of the fill in fillProjectFromEstimation.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseEstimationSummary, type EstimationSummary } from './estimationModel';

const failure = (e: any): string => String(e?.message || e);

/** the sums of the estimation (source) per budget item + what the project that is filled (target; null = not saved yet) holds now. Refused (No permission: ...) when the user cannot read the source. */
export async function readEstimationSummary(sb: SupabaseClient, targetGUID: string | null, sourceGUID: string): Promise<EstimationSummary> {
  const { data, error } = await sb.rpc('project_estimation_summary', { p_target: targetGUID, p_source: sourceGUID });
  if (error) throw new Error(failure(error));
  return parseEstimationSummary(data);
}

/** deletes top-level rows of a project with everything below them (SQL project_delete_task_roots): the rollback of a failed fill, the old rows of a Replace */
export async function deleteTaskRoots(sb: SupabaseClient, projectGUID: string, roots: readonly string[]): Promise<number> {
  if (!roots.length) return 0;
  const { data, error } = await sb.rpc('project_delete_task_roots', { p_project: projectGUID, p_roots: [...roots] });
  if (error) throw new Error(failure(error));
  return Number(data) || 0;
}

/** units of `to` for 1 unit of `from` on `day` (rate type Default), or null (no rate / the same currency is handled by the caller). One rpc: 1 000 000 units are converted so the rounding of the database costs nothing. */
export async function readCurrencyRate(sb: SupabaseClient, from: string, to: string, day: string, rateType = 'Default'): Promise<number | null> {
  if (!from || !to) return null;
  const { data, error } = await sb.rpc('fx_convert', { p_amount: 1000000, p_from: from, p_to: to, p_type: rateType, p_day: day });
  if (error || data == null) return null;
  const n = Number(data) / 1000000;
  return Number.isFinite(n) && n > 0 ? n : null;
}
