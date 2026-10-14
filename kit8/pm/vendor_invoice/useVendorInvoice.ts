// The data hooks of the vendor invoice: the vendors of a task (the choice window), the documents of the form (with the commands), the list.
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../providers/WithSupabase';
import {
  createVendorInvoices, deleteVendorInvoice, fetchVendorCandidates, fetchVendorInvoiceList, postVendorInvoice, setVendorInvoiceHeader, unpostVendorInvoice,
} from './vendorInvoiceApi';
import {
  CreateAnswer, OpenVendorInvoiceParams, VENDOR_INVOICE_NEW_ROUTE, VENDOR_INVOICE_ROUTE, VendorInvoiceHeaderView, VendorInvoiceListAnswer, VendorInvoiceListFilter, VendorInvoicePostAnswer,
  headerOfListRow, vendorInvoiceFilterToRpc, vendorInvoiceRouteParams,
} from './vendorInvoiceModel';

const EMPTY_LIST: VendorInvoiceListAnswer = { totalCount: 0, totalsByCurrency: [], rows: [] };
export const vendorCandidatesKey = (taskGUID: string, lines: string[] | null | undefined) => ['pm', 'vendorCandidates', taskGUID, (lines || []).join(',')] as const;
export const vendorListKey = (filter: VendorInvoiceListFilter | null, extra: Record<string, any>, limit: number) => ['pm', 'vendorInvoiceList', filter ? vendorInvoiceFilterToRpc(filter, extra) : extra, limit] as const;
export const vendorDocumentsKey = (guids: string[]) => ['pm', 'vendorInvoiceDocuments', guids.join(',')] as const;

/** the vendors (and contracts) of the lines of a task */
export function useVendorCandidates(taskGUID: string, lineGUIDs?: string[] | null) {
  const { supabase } = useSupabase();
  const q = useQuery({ queryKey: vendorCandidatesKey(taskGUID, lineGUIDs), enabled: !!taskGUID, staleTime: 0, refetchOnMount: 'always', queryFn: () => fetchVendorCandidates(supabase, taskGUID, lineGUIDs) });
  return { rows: q.data?.rows ?? [], skipped: q.data?.skipped ?? 0, isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
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
  setHeader: (guid: string, patch: { vendorInvoiceNumber?: string; vendorInvoiceDateTime?: string | null; legalEntityGUID?: string }) => Promise<boolean>;
  post: (guid: string) => Promise<VendorInvoicePostAnswer | null>;
  unpost: (guid: string) => Promise<VendorInvoicePostAnswer | null>;
  remove: (guid: string) => Promise<boolean>;
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
    refetch,
  };
}

/** the "New vendor invoice" command of the choice window */
export function useCreateVendorInvoices() {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCallback(async (taskGUID: string, selection: { partnerGUID: string; contractGUID: string | null; lineGUIDs: string[] }[], legalEntityGUID?: string | null): Promise<CreateAnswer | null> => {
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
    router.push({ pathname: route, params: vendorInvoiceRouteParams(params) } as any);
  }, [router]);
}
