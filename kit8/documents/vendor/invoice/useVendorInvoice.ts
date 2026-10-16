// The data hooks of the vendor invoice: the vendors of a task (the choice window), the documents of the form (with the commands), the list.
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import {
  addVendorInvoiceLine, createVendorInvoices, deleteVendorInvoice, fetchVendorCandidates, fetchVendorInvoiceLinePlaces, fetchVendorInvoiceList, postVendorInvoice, setVendorInvoiceHeader, setVendorInvoiceLineTask, unpostVendorInvoice,
} from './vendorInvoiceApi';
import {
  CreateAnswer, OpenVendorInvoiceParams, VENDOR_INVOICE_NEW_ROUTE, VENDOR_INVOICE_ROUTE, VendorInvoiceHeaderView, VendorInvoiceListAnswer, VendorInvoiceListFilter, VendorInvoicePostAnswer, VendorSelection,
  headerOfListRow, quickVendorInvoicePlan, vendorInvoiceFilterToRpc, vendorInvoiceRouteParams,
} from './vendorInvoiceModel';
import { openBlankWindow, sendWindowTo, showCreatedVendorInvoices, vendorInvoiceLink } from './vendorInvoiceNavigation';

const EMPTY_LIST: VendorInvoiceListAnswer = { totalCount: 0, totalsByCurrency: [], rows: [] };
export const vendorCandidatesKey = (taskGUID: string, lines: string[] | null | undefined) => ['pm', 'vendorCandidates', taskGUID, (lines || []).join(',')] as const;
export const vendorListKey = (filter: VendorInvoiceListFilter | null, extra: Record<string, any>, limit: number) => ['pm', 'vendorInvoiceList', filter ? vendorInvoiceFilterToRpc(filter, extra) : extra, limit] as const;
export const vendorLinePlacesKey = (header: string, signature: string) => ['pm', 'vendorInvoiceLinePlaces', header, signature] as const;
export const vendorDocumentsKey = (guids: string[]) => ['pm', 'vendorInvoiceDocuments', guids.join(',')] as const;

/** the vendors (and contracts) of the lines of a task */
export function useVendorCandidates(taskGUID: string, lineGUIDs?: string[] | null) {
  const { supabase } = useSupabase();
  const q = useQuery({ queryKey: vendorCandidatesKey(taskGUID, lineGUIDs), enabled: !!taskGUID, staleTime: 0, refetchOnMount: 'always', queryFn: () => fetchVendorCandidates(supabase, taskGUID, lineGUIDs) });
  return { rows: q.data?.rows ?? [], skipped: q.data?.skipped ?? 0, skippedLineGUIDs: q.data?.skippedLineGUIDs ?? [], isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

/** the list of the documents for the filters (the database applies them; the totals are per currency) */
export function useVendorInvoiceList(filter: VendorInvoiceListFilter, limit = 1000, extra: Record<string, any> = {}) {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: vendorListKey(filter, extra, limit),
    staleTime: 3_000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    queryFn: () => fetchVendorInvoiceList(supabase, filter, extra, limit, 0),
  });
  return { answer: q.data ?? EMPTY_LIST, isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

export interface UseVendorInvoiceDocuments {
  /** the documents of the form, in the order of the route (a tab each) */
  headers: VendorInvoiceHeaderView[];
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  setHeader: (guid: string, patch: { vendorInvoiceNumber?: string; vendorInvoiceDateTime?: string | null; legalEntityGUID?: string; vendorInvoicePartner?: string; vendorInvoiceContract?: string | null; vendorInvoiceMultiProject?: boolean }) => Promise<boolean>;
  post: (guid: string) => Promise<VendorInvoicePostAnswer | null>;
  unpost: (guid: string) => Promise<VendorInvoicePostAnswer | null>;
  remove: (guid: string) => Promise<boolean>;
  /** an independent line of a draft (the kind = a genus); the table shows it by realtime */
  addLine: (guid: string, genus: string) => Promise<boolean>;
  /** Multi Project: the task / task line of a line (both null = clear); the table shows it by realtime */
  setLineTask: (lineGUID: string, taskGUID: string | null, taskLineGUID: string | null) => Promise<boolean>;
  refetch: () => void;
}

/** the documents of the form (by GUID) and their commands; the LINES are the business of the ReusableTable (redux entity) */
export function useVendorInvoiceDocuments(documentGUIDs: string[]): UseVendorInvoiceDocuments {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const key = documentGUIDs.join(',');
  const q = useQuery({ queryKey: vendorDocumentsKey(documentGUIDs), enabled: documentGUIDs.length > 0, staleTime: 3_000, refetchOnMount: 'always', queryFn: () => fetchVendorInvoiceList(supabase, null, { documentGUIDs }, 200, 0) });
  const headers = useMemo(() => {
    const byGuid = new Map((q.data?.rows ?? []).map((r) => [r.documentGUID, headerOfListRow(r)]));
    return documentGUIDs.map((g) => byGuid.get(g)).filter(Boolean) as VendorInvoiceHeaderView[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, key]);
  const refetch = useCallback(() => { void qc.invalidateQueries({ queryKey: ['pm', 'vendorInvoiceDocuments'] }); void qc.invalidateQueries({ queryKey: ['pm', 'vendorInvoiceList'] }); }, [qc]);
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
    setHeader: async (guid, patch) => !!(await run(async () => { await setVendorInvoiceHeader(supabase, guid, patch); refetch(); return true; })),
    post: (guid) => run(async () => { const a = await postVendorInvoice(supabase, guid); refetch(); return a; }),
    unpost: (guid) => run(async () => { const a = await unpostVendorInvoice(supabase, guid); refetch(); return a; }),
    remove: async (guid) => !!(await run(async () => { await deleteVendorInvoice(supabase, guid); refetch(); return true; })),
    addLine: async (guid, genus) => !!(await run(async () => { await addVendorInvoiceLine(supabase, guid, genus); return true; })),
    setLineTask: async (lineGUID, taskGUID, taskLineGUID) => !!(await run(async () => { await setVendorInvoiceLineTask(supabase, lineGUID, taskGUID, taskLineGUID); void qc.invalidateQueries({ queryKey: ['pm', 'vendorInvoiceLinePlaces'] }); return true; })),
    refetch,
  };
}

/** the "New vendor invoice" command of the choice window */
export function useCreateVendorInvoices() {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCallback(async (taskGUID: string, selection: VendorSelection[], legalEntityGUID?: string | null): Promise<CreateAnswer | null> => {
    setBusy(true);
    setError(null);
    try {
      const a = await createVendorInvoices(supabase, taskGUID, selection, legalEntityGUID);
      void qc.invalidateQueries({ queryKey: ['pm', 'vendorInvoiceList'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'vendorCandidates'] });
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
 * Open the vendor invoice from ANYWHERE a task (and lines) is known - the context menu item "Vendor Invoice" after "Fact input":
 *   const openVendorInvoice = useOpenVendorInvoice();   openVendorInvoice({ taskGUID, lineGUIDs });   // the window with the vendors of the lines
 *   openVendorInvoice({ taskGUID, documentGUID });                                                      // a document
 */
export function useOpenVendorInvoice(): (params: OpenVendorInvoiceParams) => void {
  const router = useRouter();
  return useCallback((params: OpenVendorInvoiceParams) => {
    if (!params?.taskGUID && !params?.documentGUID) return;
    const route = params.documentGUID ? VENDOR_INVOICE_ROUTE : VENDOR_INVOICE_NEW_ROUTE;
    // a document opens in a NEW browser tab on the web (this window when blocked / on a phone)
    if (params.documentGUID && Platform.OS === 'web' && typeof window !== 'undefined') {
      try { if (window.open(vendorInvoiceLink(route, vendorInvoiceRouteParams(params)), '_blank')) return; } catch { /* this window below */ }
    }
    router.push({ pathname: route, params: vendorInvoiceRouteParams(params) } as any);
  }, [router]);
}

/**
 * The context menu "Vendor Invoice": CREATE the vendor invoice(s) of the task now and open the form - no choice window.
 *   task tree  →  start({ taskGUID })                      every line of the task
 *   a line of the Finances table  →  start({ taskGUID, projectGUID, lineGUIDs: [line] })   (the table asks first: this line / the whole task, see VendorInvoiceScopeModal)
 * On the web the vendor invoice opens in a NEW browser tab (a tab is opened inside the click and pointed at the page when it is known).
 * One document per vendor + contract, and ONE draft without a vendor of the lines that have none (the vendor is chosen in the form before Post). When a person is needed (a contract without a legal entity,
 * nothing to invoice) or the call fails, the choice window opens with the same lines: it says why.
 */
export function useStartVendorInvoice() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const start = useCallback(async (params: OpenVendorInvoiceParams): Promise<void> => {
    if (!params?.taskGUID) return;
    // web: the vendor invoice opens in a NEW browser tab - opened now (inside the click), pointed at the page when it is known; blocked / a phone: this window
    const target = openBlankWindow();
    const choose = () => {
      const link = vendorInvoiceLink(VENDOR_INVOICE_NEW_ROUTE, vendorInvoiceRouteParams(params));
      if (target && sendWindowTo(target, link)) return;
      router.push({ pathname: VENDOR_INVOICE_NEW_ROUTE, params: vendorInvoiceRouteParams(params) } as any);
    };
    setBusy(true);
    try {
      const found = await fetchVendorCandidates(supabase, params.taskGUID, params.lineGUIDs);
      const plan = quickVendorInvoicePlan(found.rows, found.skippedLineGUIDs);
      if (plan.kind === 'choose') { choose(); return; }
      const answer = await createVendorInvoices(supabase, params.taskGUID, plan.selection);
      void qc.invalidateQueries({ queryKey: ['pm', 'vendorInvoiceList'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'vendorCandidates'] });
      const guids = answer.documents.map((d) => d.documentGUID);
      if (!guids.length) { choose(); return; }
      showCreatedVendorInvoices(router as any, params, guids, 'push', { newWindow: true, target });
    } catch {
      choose();
    } finally {
      setBusy(false);
    }
  }, [supabase, router, qc]);
  return { start, busy };
}

/** the project / task names of the lines of a document (Multi Project mode); `signature` changes when a line moved (placesSignature) */
export function useVendorInvoiceLinePlaces(headerGUID: string | null | undefined, signature: string, enabled: boolean) {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: vendorLinePlacesKey(headerGUID ?? '', signature),
    enabled: enabled && !!headerGUID,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: () => fetchVendorInvoiceLinePlaces(supabase, headerGUID as string),
  });
  return q.data ?? {};
}
