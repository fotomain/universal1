// The data hooks of the payment fact: the documents of the form (with the commands), the list, the plan payments of "Get from plan", the paid / open of the plan, and the starters of the task menu.
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import {
  addFromPlan, addPaymentFactLine, createPaymentFact, deletePaymentFact, fetchPaymentFactList, fetchPlanCandidates, fetchTaskPaymentPaid, postPaymentFact, refreshCashLedger, setPaymentFactHeader, setPaymentFactLineTask,
  unpostPaymentFact, PaymentFactHeaderPatch,
} from './paymentFactApi';
import {
  AddFromPlanAnswer, OpenPaymentFactParams, PAYMENT_FACT_ROUTE, PaymentFactDirection, PaymentFactHeaderView, PaymentFactListAnswer, PaymentFactListFilter, PaymentFactPostAnswer, PlanCandidate, PlanPaid,
  headerOfListRow, paymentFactFilterToRpc, paymentFactRouteParams,
} from './paymentFactModel';
import { openBlankWindow, paymentFactLink, sendWindowTo, showPaymentFact } from './paymentFactNavigation';

const EMPTY_LIST: PaymentFactListAnswer = { totalCount: 0, totalsByCurrency: [], rows: [] };
export const paymentFactListKey = (filter: PaymentFactListFilter | null, extra: Record<string, any>, limit: number) => ['pm', 'paymentFactList', filter ? paymentFactFilterToRpc(filter, extra) : extra, limit] as const;
export const paymentFactDocumentsKey = (guids: string[]) => ['pm', 'paymentFactDocuments', guids.join(',')] as const;
export const planCandidatesKey = (header: string | null, filter: Record<string, any>) => ['pm', 'paymentFactCandidates', header ?? '', filter] as const;
export const planPaidKey = (taskGUID: string) => ['pm', 'paymentPlanPaid', taskGUID] as const;

/** the list of the documents for the filters (the database applies them; the totals are per currency) */
export function usePaymentFactList(filter: PaymentFactListFilter, limit = 1000, extra: Record<string, any> = {}) {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: paymentFactListKey(filter, extra, limit),
    staleTime: 3_000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    queryFn: () => fetchPaymentFactList(supabase, filter, extra, limit, 0),
  });
  return { answer: q.data ?? EMPTY_LIST, isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

export interface UsePaymentFactDocuments {
  /** the documents of the form, in the order of the route (a tab each) */
  headers: PaymentFactHeaderView[];
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  setHeader: (guid: string, patch: PaymentFactHeaderPatch) => Promise<boolean>;
  post: (guid: string) => Promise<PaymentFactPostAnswer | null>;
  unpost: (guid: string) => Promise<PaymentFactPostAnswer | null>;
  remove: (guid: string) => Promise<boolean>;
  /** an unplanned line of a draft (no plan payment); the table shows it by realtime */
  addLine: (guid: string, taskGUID?: string | null) => Promise<boolean>;
  /** "Get from plan": the lines are made by the database, the table shows them by realtime */
  addFromPlan: (guid: string, planLineGUIDs: string[]) => Promise<AddFromPlanAnswer | null>;
  setLineTask: (lineGUID: string, taskGUID: string) => Promise<boolean>;
  refetch: () => void;
}

/** the documents of the form (by GUID) and their commands; the LINES are the business of the ReusableTable (redux entity) */
export function usePaymentFactDocuments(documentGUIDs: string[]): UsePaymentFactDocuments {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const key = documentGUIDs.join(',');
  const q = useQuery({ queryKey: paymentFactDocumentsKey(documentGUIDs), enabled: documentGUIDs.length > 0, staleTime: 3_000, refetchOnMount: 'always', queryFn: () => fetchPaymentFactList(supabase, null, { documentGUIDs }, 200, 0) });
  const headers = useMemo(() => {
    const byGuid = new Map((q.data?.rows ?? []).map((r) => [r.documentGUID, headerOfListRow(r)]));
    return documentGUIDs.map((g) => byGuid.get(g)).filter(Boolean) as PaymentFactHeaderView[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, key]);
  const refetch = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['pm', 'paymentFactDocuments'] });
    void qc.invalidateQueries({ queryKey: ['pm', 'paymentFactList'] });
    void qc.invalidateQueries({ queryKey: ['pm', 'paymentFactCandidates'] });
    void qc.invalidateQueries({ queryKey: ['pm', 'paymentPlanPaid'] });
  }, [qc]);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setActionError(null);
    try {
      return await fn();
    } catch (e: any) {
      setActionError(e?.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  return {
    headers,
    isLoading: q.isLoading,
    error: actionError ?? ((q.error as Error | null)?.message || null),
    busy,
    setHeader: async (guid, patch) => !!(await run(async () => { await setPaymentFactHeader(supabase, guid, patch); refetch(); return true; })),
    post: (guid) => run(async () => { const a = await postPaymentFact(supabase, guid); refetch(); return a; }),
    unpost: (guid) => run(async () => { const a = await unpostPaymentFact(supabase, guid); refetch(); return a; }),
    remove: async (guid) => !!(await run(async () => { await deletePaymentFact(supabase, guid); refetch(); return true; })),
    addLine: async (guid, taskGUID) => !!(await run(async () => { await addPaymentFactLine(supabase, guid, taskGUID); return true; })),
    addFromPlan: (guid, planLineGUIDs) => run(async () => { const a = await addFromPlan(supabase, guid, planLineGUIDs); refetch(); return a; }),
    setLineTask: async (lineGUID, taskGUID) => !!(await run(async () => { await setPaymentFactLineTask(supabase, lineGUID, taskGUID); return true; })),
    refetch,
  };
}

/** the POSTED plan payments with something open - for "Get from plan" (read when the window opens) */
export function usePlanCandidates(headerGUID: string | null, filter: { direction?: string; partnerGUID?: string; personGUID?: string; taskGUID?: string }, enabled = true) {
  const { supabase } = useSupabase();
  const q = useQuery({ queryKey: planCandidatesKey(headerGUID, filter), enabled, staleTime: 0, refetchOnMount: 'always', queryFn: () => fetchPlanCandidates(supabase, headerGUID, filter) });
  return { rows: (q.data ?? []) as PlanCandidate[], isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

/** what the posted payment facts have paid of each posted plan payment of the task (null while unknown): the columns Paid / Open of the payment plan */
export function useTaskPaymentPaid(taskGUID: string | null | undefined, enabled = true) {
  const { supabase } = useSupabase();
  const q = useQuery({ queryKey: planPaidKey(taskGUID || ''), enabled: enabled && !!taskGUID, staleTime: 5_000, refetchOnMount: 'always', queryFn: () => fetchTaskPaymentPaid(supabase, taskGUID as string) });
  const byPlanLine = useMemo(() => new Map<string, PlanPaid>((q.data ?? []).map((p) => [p.planLineGUID, p])), [q.data]);
  return { byPlanLine, isLoading: q.isLoading, refetch: () => { void q.refetch(); } };
}

/** the button "Refresh rests" */
export function useRefreshCashLedger() {
  const { supabase } = useSupabase();
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    try { return await refreshCashLedger(supabase); } finally { setBusy(false); }
  }, [supabase]);
  return { refresh, busy };
}

/**
 * Open the payment fact from ANYWHERE: openPaymentFact({ documentGUID }) - a NEW browser tab on the web (this window when blocked / on a phone).
 */
export function useOpenPaymentFact(): (params: OpenPaymentFactParams) => void {
  const router = useRouter();
  return useCallback((params: OpenPaymentFactParams) => {
    if (!params?.documentGUID) return;
    showPaymentFact(router as any, params, { newWindow: true });
  }, [router]);
}

/**
 * The context menu "Payment fact" of a task: make a new DRAFT for the task now and open the form (on the web in a NEW browser tab, opened inside the click and pointed at the page when the document exists).
 * The lines come from "Get from plan" in the form; an empty draft is fine.
 */
export function useStartPaymentFact() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = useCallback(async (params: { taskGUID: string; projectGUID?: string | null; direction?: PaymentFactDirection | null; planLineGUIDs?: string[] | null }): Promise<string | null> => {
    if (!params?.taskGUID) return null;
    const target = openBlankWindow();
    setBusy(true);
    setError(null);
    try {
      const guid = await createPaymentFact(supabase, { taskGUID: params.taskGUID, direction: params.direction, planLineGUIDs: params.planLineGUIDs });
      void qc.invalidateQueries({ queryKey: ['pm', 'paymentFactList'] });
      const link = paymentFactLink(PAYMENT_FACT_ROUTE, paymentFactRouteParams({ taskGUID: params.taskGUID, projectGUID: params.projectGUID, documentGUID: guid }));
      if (!(target && sendWindowTo(target, link))) router.push({ pathname: PAYMENT_FACT_ROUTE, params: paymentFactRouteParams({ taskGUID: params.taskGUID, projectGUID: params.projectGUID, documentGUID: guid }) } as any);
      return guid;
    } catch (e: any) {
      setError(e?.message || String(e));
      try { target?.close(); } catch { /* nothing to close */ }
      return null;
    } finally {
      setBusy(false);
    }
  }, [supabase, router, qc]);
  return { start, busy, error, isWeb: Platform.OS === 'web' };
}
