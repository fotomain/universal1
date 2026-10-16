// The data hooks of the product receipt: the documents of the form (with the commands), the list, the project / task names of the lines, and the two "Create based on" commands:
//   useCreateProductReceiptFromOrder  purchase order → product receipt (the order's form and list row menu)
//   useCreateVendorInvoiceFromReceipt product receipt → vendor invoice (the receipt's form and list row menu)
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import {
  addProductReceiptLine, createProductReceiptFromOrder, createVendorInvoiceFromReceipt, deleteProductReceipt, fetchProductReceiptLinePlaces, fetchProductReceiptList, postProductReceipt, setProductReceiptHeader, unpostProductReceipt,
} from './productReceiptApi';
import {
  CreateFromAnswer, OpenProductReceiptParams, PRODUCT_RECEIPT_ROUTE, ProductReceiptHeaderView, ProductReceiptListAnswer, ProductReceiptListFilter, ProductReceiptPostAnswer,
  headerOfListRow, productReceiptFilterToRpc, productReceiptRouteParams,
} from './productReceiptModel';
import { openBlankWindow, productReceiptLink, sendWindowTo, showCreatedProductReceipt } from './productReceiptNavigation';
import { showCreatedVendorInvoices } from '../invoice/vendorInvoiceNavigation';

const EMPTY_LIST: ProductReceiptListAnswer = { totalCount: 0, totalsByCurrency: [], rows: [] };
export const productReceiptListKey = (filter: ProductReceiptListFilter | null, extra: Record<string, any>, limit: number) => ['pm', 'productReceiptList', filter ? productReceiptFilterToRpc(filter, extra) : extra, limit] as const;
export const productReceiptLinePlacesKey = (header: string, signature: string) => ['pm', 'productReceiptLinePlaces', header, signature] as const;
export const productReceiptDocumentsKey = (guids: string[]) => ['pm', 'productReceiptDocuments', guids.join(',')] as const;

/** the list of the documents for the filters (the database applies them; the totals are per currency) */
export function useProductReceiptList(filter: ProductReceiptListFilter, limit = 1000, extra: Record<string, any> = {}) {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: productReceiptListKey(filter, extra, limit),
    staleTime: 3_000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    queryFn: () => fetchProductReceiptList(supabase, filter, extra, limit, 0),
  });
  return { answer: q.data ?? EMPTY_LIST, isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

export interface UseProductReceiptDocuments {
  /** the documents of the form, in the order of the route (a tab each) */
  headers: ProductReceiptHeaderView[];
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  setHeader: (guid: string, patch: { productReceiptNumber?: string; productReceiptDateTime?: string | null; legalEntityGUID?: string; productReceiptPartner?: string; productReceiptContract?: string | null }) => Promise<boolean>;
  post: (guid: string) => Promise<ProductReceiptPostAnswer | null>;
  unpost: (guid: string) => Promise<ProductReceiptPostAnswer | null>;
  remove: (guid: string) => Promise<boolean>;
  /** an independent line of a draft (the kind = a genus); the table shows it by realtime */
  addLine: (guid: string, genus: string) => Promise<boolean>;
  refetch: () => void;
}

/** the documents of the form (by GUID) and their commands; the LINES are the business of the ReusableTable (redux entity) */
export function useProductReceiptDocuments(documentGUIDs: string[]): UseProductReceiptDocuments {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const key = documentGUIDs.join(',');
  const q = useQuery({ queryKey: productReceiptDocumentsKey(documentGUIDs), enabled: documentGUIDs.length > 0, staleTime: 3_000, refetchOnMount: 'always', queryFn: () => fetchProductReceiptList(supabase, null, { documentGUIDs }, 200, 0) });
  const headers = useMemo(() => {
    const byGuid = new Map((q.data?.rows ?? []).map((r) => [r.documentGUID, headerOfListRow(r)]));
    return documentGUIDs.map((g) => byGuid.get(g)).filter(Boolean) as ProductReceiptHeaderView[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, key]);
  const refetch = useCallback(() => { void qc.invalidateQueries({ queryKey: ['pm', 'productReceiptDocuments'] }); void qc.invalidateQueries({ queryKey: ['pm', 'productReceiptList'] }); }, [qc]);
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
    setHeader: async (guid, patch) => !!(await run(async () => { await setProductReceiptHeader(supabase, guid, patch); refetch(); return true; })),
    post: (guid) => run(async () => { const a = await postProductReceipt(supabase, guid); refetch(); return a; }),
    unpost: (guid) => run(async () => { const a = await unpostProductReceipt(supabase, guid); refetch(); return a; }),
    remove: async (guid) => !!(await run(async () => { await deleteProductReceipt(supabase, guid); refetch(); return true; })),
    addLine: async (guid, genus) => !!(await run(async () => { await addProductReceiptLine(supabase, guid, genus); return true; })),
    refetch,
  };
}

/**
 * Open a product receipt from ANYWHERE its GUID is known; on the web in a NEW browser tab (this window when blocked / on a phone).
 *   const openProductReceipt = useOpenProductReceipt();   openProductReceipt({ documentGUID });
 */
export function useOpenProductReceipt(): (params: OpenProductReceiptParams) => void {
  const router = useRouter();
  return useCallback((params: OpenProductReceiptParams) => {
    if (!params?.documentGUID && !params?.documents?.length) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { if (window.open(productReceiptLink(PRODUCT_RECEIPT_ROUTE, productReceiptRouteParams(params)), '_blank')) return; } catch { /* this window below */ }
    }
    router.push({ pathname: PRODUCT_RECEIPT_ROUTE, params: productReceiptRouteParams(params) } as any);
  }, [router]);
}

/** the project / task names of the lines of a document (Multi Project mode); `signature` changes when a line moved (placesSignature) */
export function useProductReceiptLinePlaces(headerGUID: string | null | undefined, signature: string, enabled: boolean) {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: productReceiptLinePlacesKey(headerGUID ?? '', signature),
    enabled: enabled && !!headerGUID,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: () => fetchProductReceiptLinePlaces(supabase, headerGUID as string),
  });
  return q.data ?? {};
}

/** the shared shell of the two "Create based on" commands: busy, the error text, the new browser tab opened inside the click */
export interface CreateBasedOnContext { taskGUID?: string | null; projectGUID?: string | null }
function useCreateBasedOn(call: (client: any, guid: string) => Promise<CreateFromAnswer>, show: (router: any, guid: string, target: Window | null, ctx: CreateBasedOnContext) => void, invalidate: string[]) {
  const { supabase } = useSupabase();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCallback(async (sourceGUID: string, ctx: CreateBasedOnContext = {}): Promise<CreateFromAnswer | null> => {
    if (!sourceGUID) return null;
    // web: the new document opens in a NEW browser tab - opened now (inside the click), pointed at the page when it is known
    const target = openBlankWindow();
    setBusy(true);
    setError(null);
    try {
      const answer = await call(supabase, sourceGUID);
      invalidate.forEach((k) => { void qc.invalidateQueries({ queryKey: ['pm', k] }); });
      const guid = answer.documents[0]?.documentGUID;
      if (guid) show(router, guid, target, ctx);
      else if (target) { try { target.close(); } catch { /* nothing to close */ } }
      return answer;
    } catch (e: any) {
      if (target) { try { target.close(); } catch { /* nothing to close */ } }
      setError(e?.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router, qc]);
  return { create, busy, error, clearError: () => setError(null) };
}

/** purchase order → product receipt: makes the draft and opens it (a new browser tab on the web) */
export function useCreateProductReceiptFromOrder() {
  return useCreateBasedOn(
    createProductReceiptFromOrder,
    (router, guid, target) => showCreatedProductReceipt(router, guid, { newWindow: true, target, sendWindowTo }),
    ['productReceiptList', 'productReceiptDocuments'],
  );
}

/** product receipt → vendor invoice: makes the draft and opens it (a new browser tab on the web); create(receiptGUID, { taskGUID, projectGUID }) - the task of the receipt (the invoice form route carries it) */
export function useCreateVendorInvoiceFromReceipt() {
  return useCreateBasedOn(
    createVendorInvoiceFromReceipt,
    (router, guid, target, ctx) => showCreatedVendorInvoices(router, { taskGUID: ctx.taskGUID || '', projectGUID: ctx.projectGUID }, [guid], 'push', { newWindow: true, target }),
    ['vendorInvoiceList', 'vendorInvoiceDocuments'],
  );
}
