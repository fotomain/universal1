// The data hooks of the purchase order: the vendors of a task (the choice window), the documents of the form (with the commands), the list.
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import {
  addPurchaseOrderLine, createPurchaseOrders, deletePurchaseOrder, fetchPurchaseOrderCandidates, fetchPurchaseOrderLinePlaces, fetchPurchaseOrderList, postPurchaseOrder, setPurchaseOrderHeader, setPurchaseOrderLineTask, unpostPurchaseOrder,
} from './purchaseOrderApi';
import {
  CreateAnswer, OpenPurchaseOrderParams, PURCHASE_ORDER_NEW_ROUTE, PURCHASE_ORDER_ROUTE, PurchaseOrderHeaderView, PurchaseOrderListAnswer, PurchaseOrderListFilter, PurchaseOrderPostAnswer, VendorSelection,
  headerOfListRow, quickPurchaseOrderPlan, purchaseOrderFilterToRpc, purchaseOrderRouteParams,
} from './purchaseOrderModel';
import { openBlankWindow, sendWindowTo, showCreatedPurchaseOrders, purchaseOrderLink } from './purchaseOrderNavigation';

const EMPTY_LIST: PurchaseOrderListAnswer = { totalCount: 0, totalsByCurrency: [], rows: [] };
export const purchaseOrderCandidatesKey = (taskGUID: string, lines: string[] | null | undefined) => ['pm', 'purchaseOrderCandidates', taskGUID, (lines || []).join(',')] as const;
export const purchaseOrderListKey = (filter: PurchaseOrderListFilter | null, extra: Record<string, any>, limit: number) => ['pm', 'purchaseOrderList', filter ? purchaseOrderFilterToRpc(filter, extra) : extra, limit] as const;
export const purchaseOrderLinePlacesKey = (header: string, signature: string) => ['pm', 'purchaseOrderLinePlaces', header, signature] as const;
export const purchaseOrderDocumentsKey = (guids: string[]) => ['pm', 'purchaseOrderDocuments', guids.join(',')] as const;

/** the vendors (and contracts) of the lines of a task */
export function usePurchaseOrderCandidates(taskGUID: string, lineGUIDs?: string[] | null) {
  const { supabase } = useSupabase();
  const q = useQuery({ queryKey: purchaseOrderCandidatesKey(taskGUID, lineGUIDs), enabled: !!taskGUID, staleTime: 0, refetchOnMount: 'always', queryFn: () => fetchPurchaseOrderCandidates(supabase, taskGUID, lineGUIDs) });
  return { rows: q.data?.rows ?? [], skipped: q.data?.skipped ?? 0, skippedLineGUIDs: q.data?.skippedLineGUIDs ?? [], isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

/** the list of the documents for the filters (the database applies them; the totals are per currency) */
export function usePurchaseOrderList(filter: PurchaseOrderListFilter, limit = 1000, extra: Record<string, any> = {}) {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: purchaseOrderListKey(filter, extra, limit),
    staleTime: 3_000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    queryFn: () => fetchPurchaseOrderList(supabase, filter, extra, limit, 0),
  });
  return { answer: q.data ?? EMPTY_LIST, isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

export interface UsePurchaseOrderDocuments {
  /** the documents of the form, in the order of the route (a tab each) */
  headers: PurchaseOrderHeaderView[];
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  setHeader: (guid: string, patch: { purchaseOrderNumber?: string; purchaseOrderDateTime?: string | null; legalEntityGUID?: string; purchaseOrderPartner?: string; purchaseOrderContract?: string | null; purchaseOrderMultiProject?: boolean }) => Promise<boolean>;
  post: (guid: string) => Promise<PurchaseOrderPostAnswer | null>;
  unpost: (guid: string) => Promise<PurchaseOrderPostAnswer | null>;
  remove: (guid: string) => Promise<boolean>;
  /** an independent line of a draft (the kind = a genus); the table shows it by realtime */
  addLine: (guid: string, genus: string) => Promise<boolean>;
  /** Multi Project: the task / task line of a line (both null = clear); the table shows it by realtime */
  setLineTask: (lineGUID: string, taskGUID: string | null, taskLineGUID: string | null) => Promise<boolean>;
  refetch: () => void;
}

/** the documents of the form (by GUID) and their commands; the LINES are the business of the ReusableTable (redux entity) */
export function usePurchaseOrderDocuments(documentGUIDs: string[]): UsePurchaseOrderDocuments {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const key = documentGUIDs.join(',');
  const q = useQuery({ queryKey: purchaseOrderDocumentsKey(documentGUIDs), enabled: documentGUIDs.length > 0, staleTime: 3_000, refetchOnMount: 'always', queryFn: () => fetchPurchaseOrderList(supabase, null, { documentGUIDs }, 200, 0) });
  const headers = useMemo(() => {
    const byGuid = new Map((q.data?.rows ?? []).map((r) => [r.documentGUID, headerOfListRow(r)]));
    return documentGUIDs.map((g) => byGuid.get(g)).filter(Boolean) as PurchaseOrderHeaderView[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, key]);
  const refetch = useCallback(() => { void qc.invalidateQueries({ queryKey: ['pm', 'purchaseOrderDocuments'] }); void qc.invalidateQueries({ queryKey: ['pm', 'purchaseOrderList'] }); }, [qc]);
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
    setHeader: async (guid, patch) => !!(await run(async () => { await setPurchaseOrderHeader(supabase, guid, patch); refetch(); return true; })),
    post: (guid) => run(async () => { const a = await postPurchaseOrder(supabase, guid); refetch(); return a; }),
    unpost: (guid) => run(async () => { const a = await unpostPurchaseOrder(supabase, guid); refetch(); return a; }),
    remove: async (guid) => !!(await run(async () => { await deletePurchaseOrder(supabase, guid); refetch(); return true; })),
    addLine: async (guid, genus) => !!(await run(async () => { await addPurchaseOrderLine(supabase, guid, genus); return true; })),
    setLineTask: async (lineGUID, taskGUID, taskLineGUID) => !!(await run(async () => { await setPurchaseOrderLineTask(supabase, lineGUID, taskGUID, taskLineGUID); void qc.invalidateQueries({ queryKey: ['pm', 'purchaseOrderLinePlaces'] }); return true; })),
    refetch,
  };
}

/** the "New purchase order" command of the choice window */
export function useCreatePurchaseOrders() {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCallback(async (taskGUID: string, selection: VendorSelection[], legalEntityGUID?: string | null): Promise<CreateAnswer | null> => {
    setBusy(true);
    setError(null);
    try {
      const a = await createPurchaseOrders(supabase, taskGUID, selection, legalEntityGUID);
      void qc.invalidateQueries({ queryKey: ['pm', 'purchaseOrderList'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'purchaseOrderCandidates'] });
      return a;
    } catch (e: any) {
      setError(e?.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [supabase, qc]);
  return { create, busy, error };
}

/**
 * Open the purchase order from ANYWHERE a task (and lines) is known - the context menu item "Purchase Order" after "Fact input":
 *   const openPurchaseOrder = useOpenPurchaseOrder();   openPurchaseOrder({ taskGUID, lineGUIDs });   // the window with the vendors of the lines
 *   openPurchaseOrder({ taskGUID, documentGUID });                                                      // a document
 */
export function useOpenPurchaseOrder(): (params: OpenPurchaseOrderParams) => void {
  const router = useRouter();
  return useCallback((params: OpenPurchaseOrderParams) => {
    if (!params?.taskGUID && !params?.documentGUID) return;
    const route = params.documentGUID ? PURCHASE_ORDER_ROUTE : PURCHASE_ORDER_NEW_ROUTE;
    // a document opens in a NEW browser tab on the web (this window when blocked / on a phone)
    if (params.documentGUID && Platform.OS === 'web' && typeof window !== 'undefined') {
      try { if (window.open(purchaseOrderLink(route, purchaseOrderRouteParams(params)), '_blank')) return; } catch { /* this window below */ }
    }
    router.push({ pathname: route, params: purchaseOrderRouteParams(params) } as any);
  }, [router]);
}

/**
 * The context menu "Purchase Order": CREATE the purchase order(s) of the task now and open the form - no choice window.
 *   task tree  →  start({ taskGUID })                      every line of the task
 *   a line of the Finances table  →  start({ taskGUID, projectGUID, lineGUIDs: [line] })   (the table asks first: this line / the whole task, see PurchaseOrderScopeModal)
 * On the web the purchase order opens in a NEW browser tab (a tab is opened inside the click and pointed at the page when it is known).
 * One document per vendor + contract, and ONE draft without a vendor of the lines that have none (the vendor is chosen in the form before Post). When a person is needed (a contract without a legal entity,
 * nothing to order) or the call fails, the choice window opens with the same lines: it says why.
 */
export function useStartPurchaseOrder() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const start = useCallback(async (params: OpenPurchaseOrderParams): Promise<void> => {
    if (!params?.taskGUID) return;
    // web: the purchase order opens in a NEW browser tab - opened now (inside the click), pointed at the page when it is known; blocked / a phone: this window
    const target = openBlankWindow();
    const choose = () => {
      const link = purchaseOrderLink(PURCHASE_ORDER_NEW_ROUTE, purchaseOrderRouteParams(params));
      if (target && sendWindowTo(target, link)) return;
      router.push({ pathname: PURCHASE_ORDER_NEW_ROUTE, params: purchaseOrderRouteParams(params) } as any);
    };
    setBusy(true);
    try {
      const found = await fetchPurchaseOrderCandidates(supabase, params.taskGUID, params.lineGUIDs);
      const plan = quickPurchaseOrderPlan(found.rows, found.skippedLineGUIDs);
      if (plan.kind === 'choose') { choose(); return; }
      const answer = await createPurchaseOrders(supabase, params.taskGUID, plan.selection);
      void qc.invalidateQueries({ queryKey: ['pm', 'purchaseOrderList'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'purchaseOrderCandidates'] });
      const guids = answer.documents.map((d) => d.documentGUID);
      if (!guids.length) { choose(); return; }
      showCreatedPurchaseOrders(router as any, params, guids, 'push', { newWindow: true, target });
    } catch {
      choose();
    } finally {
      setBusy(false);
    }
  }, [supabase, router, qc]);
  return { start, busy };
}

/** the project / task names of the lines of a document (Multi Project mode); `signature` changes when a line moved (placesSignature) */
export function usePurchaseOrderLinePlaces(headerGUID: string | null | undefined, signature: string, enabled: boolean) {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: purchaseOrderLinePlacesKey(headerGUID ?? '', signature),
    enabled: enabled && !!headerGUID,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: () => fetchPurchaseOrderLinePlaces(supabase, headerGUID as string),
  });
  return q.data ?? {};
}
