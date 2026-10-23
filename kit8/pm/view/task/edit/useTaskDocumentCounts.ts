// useTaskDocumentCounts - how many documents of each kind the task has (the tips of the 2nd level tabs of the task window's Fact tab):
// one cheap call per kind (the list RPC with p_limit 1 - its totalCount is the number of documents of the task). Read when the tab opens and again when `refreshKey` changes
// (the user left a tab: a document may have been made or deleted there). A kind that cannot be read stays `null` (the tip then says nothing about a number).
import { useEffect, useState } from 'react';
import { useSupabase } from '../../../../providers/WithSupabase';
import { RPC_FACT_LIST } from '../../../../documents/fact/input/factInputModel';
import { RPC_VENDOR_LIST } from '../../../../documents/vendor/invoice/vendorInvoiceModel';
import { RPC_PR_LIST } from '../../../../documents/vendor/product_receipt/productReceiptModel';
import { RPC_CUSTOMER_LIST } from '../../../../documents/customer/invoice/customerInvoiceModel';
import { RPC_PAYMENT_FACT_LIST } from '../../../../documents/payment/fact/paymentFactModel';

export type TaskDocumentKind = 'TabFactInput' | 'TabProductReceipt' | 'TabVendorInvoice' | 'TabCustomerInvoice' | 'TabPaymentFact';
export const TASK_DOCUMENT_RPC: Record<TaskDocumentKind, string> = {
  TabFactInput: RPC_FACT_LIST,
  TabProductReceipt: RPC_PR_LIST,
  TabVendorInvoice: RPC_VENDOR_LIST,
  TabCustomerInvoice: RPC_CUSTOMER_LIST,
  TabPaymentFact: RPC_PAYMENT_FACT_LIST,
};
export type TaskDocumentCounts = Partial<Record<TaskDocumentKind, number | null>>;

/** "3 documents" · "1 document" · "No documents" · '' (unknown) */
export function documentCountText(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n === 0 ? 'No documents' : n === 1 ? '1 document' : `${n} documents`;
}

export function useTaskDocumentCounts(taskGUID: string | null | undefined, kinds: readonly TaskDocumentKind[], refreshKey: unknown = 0): TaskDocumentCounts {
  const { supabase } = useSupabase();
  const [counts, setCounts] = useState<TaskDocumentCounts>({});
  const wanted = kinds.join('|');
  useEffect(() => {
    if (!taskGUID) { setCounts({}); return undefined; }
    let alive = true;
    (async () => {
      const entries = await Promise.all(kinds.map(async (k) => {
        try {
          const { data, error } = await (supabase as any).rpc(TASK_DOCUMENT_RPC[k], { p_filter: { taskGUID }, p_limit: 1, p_offset: 0 });
          const n = error ? null : Number((data as any)?.totalCount);
          return [k, Number.isFinite(n as number) ? (n as number) : null] as const;
        } catch {
          return [k, null] as const;
        }
      }));
      if (alive) setCounts(Object.fromEntries(entries));
    })();
    return () => { alive = false; };
  }, [taskGUID, wanted, refreshKey, supabase]); // eslint-disable-line react-hooks/exhaustive-deps
  return counts;
}
