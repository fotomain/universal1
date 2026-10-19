// The data hooks of the customer invoice: the customers of a task (the choice window), the documents of the form (with the commands), the list.
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import {
  addCustomerInvoiceLine, createCustomerInvoices, deleteCustomerInvoice, fetchCustomerCandidates, fetchCustomerInvoiceList, postCustomerInvoice, setCustomerInvoiceHeader, unpostCustomerInvoice,
} from './customerInvoiceApi';
import {
  CreateAnswer, OpenCustomerInvoiceParams, CUSTOMER_INVOICE_NEW_ROUTE, CUSTOMER_INVOICE_ROUTE, CustomerInvoiceHeaderView, CustomerInvoiceListAnswer, CustomerInvoiceListFilter, CustomerInvoicePostAnswer, CustomerSelection,
  headerOfListRow, quickCustomerInvoicePlan, customerInvoiceFilterToRpc, customerInvoiceRouteParams,
} from './customerInvoiceModel';
import { openBlankWindow, sendWindowTo, showCreatedCustomerInvoices, customerInvoiceLink } from './customerInvoiceNavigation';

const EMPTY_LIST: CustomerInvoiceListAnswer = { totalCount: 0, totalsByCurrency: [], rows: [] };
export const customerCandidatesKey = (taskGUID: string, lines: string[] | null | undefined) => ['pm', 'customerCandidates', taskGUID, (lines || []).join(',')] as const;
export const customerListKey = (filter: CustomerInvoiceListFilter | null, extra: Record<string, any>, limit: number) => ['pm', 'customerInvoiceList', filter ? customerInvoiceFilterToRpc(filter, extra) : extra, limit] as const;
export const customerDocumentsKey = (guids: string[]) => ['pm', 'customerInvoiceDocuments', guids.join(',')] as const;

/** the customers (and contracts) of the lines of a task */
export function useCustomerCandidates(taskGUID: string, lineGUIDs?: string[] | null) {
  const { supabase } = useSupabase();
  const q = useQuery({ queryKey: customerCandidatesKey(taskGUID, lineGUIDs), enabled: !!taskGUID, staleTime: 0, refetchOnMount: 'always', queryFn: () => fetchCustomerCandidates(supabase, taskGUID, lineGUIDs) });
  return { rows: q.data?.rows ?? [], skipped: q.data?.skipped ?? 0, skippedLineGUIDs: q.data?.skippedLineGUIDs ?? [], isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

/** the list of the documents for the filters (the database applies them; the totals are per currency) */
export function useCustomerInvoiceList(filter: CustomerInvoiceListFilter, limit = 1000, extra: Record<string, any> = {}) {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: customerListKey(filter, extra, limit),
    staleTime: 3_000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    queryFn: () => fetchCustomerInvoiceList(supabase, filter, extra, limit, 0),
  });
  return { answer: q.data ?? EMPTY_LIST, isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

export interface UseCustomerInvoiceDocuments {
  /** the documents of the form, in the order of the route (a tab each) */
  headers: CustomerInvoiceHeaderView[];
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  setHeader: (guid: string, patch: { customerInvoiceNumber?: string; customerInvoiceDateTime?: string | null; legalEntityGUID?: string; customerInvoicePartner?: string; customerInvoiceContract?: string | null }) => Promise<boolean>;
  post: (guid: string) => Promise<CustomerInvoicePostAnswer | null>;
  unpost: (guid: string) => Promise<CustomerInvoicePostAnswer | null>;
  remove: (guid: string) => Promise<boolean>;
  /** an independent line of a draft (the kind = a genus); the table shows it by realtime */
  addLine: (guid: string, genus: string) => Promise<boolean>;
  refetch: () => void;
}

/** the documents of the form (by GUID) and their commands; the LINES are the business of the ReusableTable (redux entity) */
export function useCustomerInvoiceDocuments(documentGUIDs: string[]): UseCustomerInvoiceDocuments {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const key = documentGUIDs.join(',');
  const q = useQuery({ queryKey: customerDocumentsKey(documentGUIDs), enabled: documentGUIDs.length > 0, staleTime: 3_000, refetchOnMount: 'always', queryFn: () => fetchCustomerInvoiceList(supabase, null, { documentGUIDs }, 200, 0) });
  const headers = useMemo(() => {
    const byGuid = new Map((q.data?.rows ?? []).map((r) => [r.documentGUID, headerOfListRow(r)]));
    return documentGUIDs.map((g) => byGuid.get(g)).filter(Boolean) as CustomerInvoiceHeaderView[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, key]);
  const refetch = useCallback(() => { void qc.invalidateQueries({ queryKey: ['pm', 'customerInvoiceDocuments'] }); void qc.invalidateQueries({ queryKey: ['pm', 'customerInvoiceList'] }); }, [qc]);
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
    setHeader: async (guid, patch) => !!(await run(async () => { await setCustomerInvoiceHeader(supabase, guid, patch); refetch(); return true; })),
    post: (guid) => run(async () => { const a = await postCustomerInvoice(supabase, guid); refetch(); return a; }),
    unpost: (guid) => run(async () => { const a = await unpostCustomerInvoice(supabase, guid); refetch(); return a; }),
    remove: async (guid) => !!(await run(async () => { await deleteCustomerInvoice(supabase, guid); refetch(); return true; })),
    addLine: async (guid, genus) => !!(await run(async () => { await addCustomerInvoiceLine(supabase, guid, genus); return true; })),
    refetch,
  };
}

/** the "New customer invoice" command of the choice window */
export function useCreateCustomerInvoices() {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCallback(async (taskGUID: string, selection: CustomerSelection[], legalEntityGUID?: string | null): Promise<CreateAnswer | null> => {
    setBusy(true);
    setError(null);
    try {
      const a = await createCustomerInvoices(supabase, taskGUID, selection, legalEntityGUID);
      void qc.invalidateQueries({ queryKey: ['pm', 'customerInvoiceList'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'customerCandidates'] });
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
 * Open the customer invoice from ANYWHERE a task (and lines) is known - the context menu item "Customer Invoice" after "Fact input":
 *   const openCustomerInvoice = useOpenCustomerInvoice();   openCustomerInvoice({ taskGUID, lineGUIDs });   // the window with the customers of the lines
 *   openCustomerInvoice({ taskGUID, documentGUID });                                                      // a document
 */
export function useOpenCustomerInvoice(): (params: OpenCustomerInvoiceParams) => void {
  const router = useRouter();
  return useCallback((params: OpenCustomerInvoiceParams) => {
    if (!params?.taskGUID && !params?.documentGUID) return;
    const route = params.documentGUID ? CUSTOMER_INVOICE_ROUTE : CUSTOMER_INVOICE_NEW_ROUTE;
    // a document opens in a NEW browser tab on the web (this window when blocked / on a phone)
    if (params.documentGUID && Platform.OS === 'web' && typeof window !== 'undefined') {
      try { if (window.open(customerInvoiceLink(route, customerInvoiceRouteParams(params)), '_blank')) return; } catch { /* this window below */ }
    }
    router.push({ pathname: route, params: customerInvoiceRouteParams(params) } as any);
  }, [router]);
}

/**
 * The context menu "Customer Invoice": CREATE the customer invoice(s) of the task now and open the form - no choice window.
 *   task tree  →  start({ taskGUID })                      every line of the task
 *   a line of the Finances table  →  start({ taskGUID, projectGUID, lineGUIDs: [line] })   (the table asks first: this line / the whole task, see CustomerInvoiceScopeModal)
 * On the web the customer invoice opens in a NEW browser tab (a tab is opened inside the click and pointed at the page when it is known).
 * One document per customer + contract, and ONE draft without a customer of the lines that have none (the customer is chosen in the form before Post). When a person is needed (a contract without a legal entity,
 * nothing to invoice) or the call fails, the choice window opens with the same lines: it says why.
 */
export function useStartCustomerInvoice() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const start = useCallback(async (params: OpenCustomerInvoiceParams): Promise<void> => {
    if (!params?.taskGUID) return;
    // web: the customer invoice opens in a NEW browser tab - opened now (inside the click), pointed at the page when it is known; blocked / a phone: this window
    const target = openBlankWindow();
    const choose = () => {
      const link = customerInvoiceLink(CUSTOMER_INVOICE_NEW_ROUTE, customerInvoiceRouteParams(params));
      if (target && sendWindowTo(target, link)) return;
      router.push({ pathname: CUSTOMER_INVOICE_NEW_ROUTE, params: customerInvoiceRouteParams(params) } as any);
    };
    setBusy(true);
    try {
      const found = await fetchCustomerCandidates(supabase, params.taskGUID, params.lineGUIDs);
      const plan = quickCustomerInvoicePlan(found.rows, found.skippedLineGUIDs);
      if (plan.kind === 'choose') { choose(); return; }
      const answer = await createCustomerInvoices(supabase, params.taskGUID, plan.selection);
      void qc.invalidateQueries({ queryKey: ['pm', 'customerInvoiceList'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'customerCandidates'] });
      const guids = answer.documents.map((d) => d.documentGUID);
      if (!guids.length) { choose(); return; }
      showCreatedCustomerInvoices(router as any, params, guids, 'push', { newWindow: true, target });
    } catch {
      choose();
    } finally {
      setBusy(false);
    }
  }, [supabase, router, qc]);
  return { start, busy };
}
