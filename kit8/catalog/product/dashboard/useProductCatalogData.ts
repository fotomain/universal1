// Product dashboard - every product table from redux (one reusable entity per table), read once + kept in sync by
// Supabase Realtime while the dashboard is open. The read parameters are the SAME as those of ReusableTable
// (all-rows mode) and SelectElementFromCatalog, so all of them share one realtime channel per table.
import { useEffect, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_TABLE_KEYS, PRODUCT_TABLES, ProductTableKey } from '../productModel';
import type { ProductCatalogData } from '../crud/productCatalogTools';

/** readData payload of every product table (one PostgREST page = the whole table) */
export const PRODUCT_READ_PARAMS = { paginationSize: 1000, originationCurrentPage: 0 };

export interface ProductTableStatus {
  loaded: boolean;
  error: string;
  realtime: string;
}

/** realtime for one table - one hook per table (a fixed list, so the hook order never changes) */
function useTableRealtime(key: ProductTableKey, enabled: boolean) {
  return useRealtimeEntity(PRODUCT_TABLES[key].entity, { readParams: PRODUCT_READ_PARAMS, enabled });
}

export function useProductCatalogData(enabled = true): { data: ProductCatalogData; status: Record<ProductTableKey, ProductTableStatus>; reload: () => void } {
  const dispatch = useDispatch();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  PRODUCT_TABLE_KEYS.forEach((k) => useTableRealtime(k, enabled));

  const lists: any[] = useSelector((s: any) => PRODUCT_TABLE_KEYS.map((k) => s?.[PRODUCT_TABLES[k].entity]?.entityDataFromServer), shallowEqual);
  const flags: any[] = useSelector((s: any) => PRODUCT_TABLE_KEYS.flatMap((k) => {
    const st = s?.[PRODUCT_TABLES[k].entity];
    return [st?.readSuccessful, st?.readErrorData, st?.realtimeStatus, !!st?.lastRealtimeEvent];
  }), shallowEqual);

  const reload = () => {
    for (const k of PRODUCT_TABLE_KEYS) {
      const actions = SystemMetaData[PRODUCT_TABLES[k].entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const data = useMemo(() => {
    const out = {} as ProductCatalogData;
    PRODUCT_TABLE_KEYS.forEach((k, i) => { out[k] = Array.isArray(lists[i]) ? lists[i] : []; });
    return out;
  }, [lists]);

  const status = useMemo(() => {
    const out = {} as Record<ProductTableKey, ProductTableStatus>;
    PRODUCT_TABLE_KEYS.forEach((k, i) => {
      const [ok, err, rt, ev] = flags.slice(i * 4, i * 4 + 4);
      out[k] = { loaded: ok === 1 || !!ev, error: err ? String(err) : '', realtime: rt || 'idle' };
    });
    return out;
  }, [flags]);

  return { data, status, reload };
}
