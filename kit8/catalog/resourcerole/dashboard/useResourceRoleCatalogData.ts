// Resource role dashboard - every role table from redux (one reusable entity per table), read once + kept in sync by Supabase
// Realtime while the dashboard is open. The 11 shared tables are the product catalog's (same entities, same read parameters as the
// product dashboard, so both share one realtime channel per table); of the descriptor sets, plan lines, property values, variants
// and variant values the rows owned by a product type / product are left out of `data` (they are the product side's; `productOwned`
// lists them for the tables). The product types and products are read for that (no realtime).
import { useEffect, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import { sideOf, SideOwnedKey } from '../../product/crud/catalogSides';
import { PRODUCT_TABLES } from '../../product/productModel';
import { RESOURCE_ROLE_TABLE_KEYS, RESOURCE_ROLE_TABLES, ResourceRoleTableKey } from '../resourceRoleModel';
import type { ResourceRoleCatalogData } from '../crud/resourceRoleCatalogTools';

export { PRODUCT_READ_PARAMS as RESOURCE_ROLE_READ_PARAMS };

export interface ResourceRoleTableStatus {
  loaded: boolean;
  error: string;
  realtime: string;
}

/** realtime for one table - one hook per table (a fixed list, so the hook order never changes) */
function useTableRealtime(key: ResourceRoleTableKey, enabled: boolean) {
  return useRealtimeEntity(RESOURCE_ROLE_TABLES[key].entity, { readParams: PRODUCT_READ_PARAMS, enabled });
}

const PRODUCT_OWNER_ENTITIES = [PRODUCT_TABLES.productType.entity, PRODUCT_TABLES.product.entity];

export function useResourceRoleCatalogData(enabled = true): {
  data: ResourceRoleCatalogData; status: Record<ResourceRoleTableKey, ResourceRoleTableStatus>; reload: () => void;
  /** rowGUIDs of the shared rows that belong to the product side (not in `data`; hide them in the shared tables) */
  productOwned: Record<SideOwnedKey, Set<string>>;
} {
  const dispatch = useDispatch();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  RESOURCE_ROLE_TABLE_KEYS.forEach((k) => useTableRealtime(k, enabled));

  const productOwnerLists: any[] = useSelector((s: any) => PRODUCT_OWNER_ENTITIES.map((e) => s?.[e]?.entityDataFromServer), shallowEqual);
  const lists: any[] = useSelector((s: any) => RESOURCE_ROLE_TABLE_KEYS.map((k) => s?.[RESOURCE_ROLE_TABLES[k].entity]?.entityDataFromServer), shallowEqual);
  const flags: any[] = useSelector((s: any) => RESOURCE_ROLE_TABLE_KEYS.flatMap((k) => {
    const st = s?.[RESOURCE_ROLE_TABLES[k].entity];
    return [st?.readSuccessful, st?.readErrorData, st?.realtimeStatus, !!st?.lastRealtimeEvent];
  }), shallowEqual);

  const reload = () => {
    for (const k of RESOURCE_ROLE_TABLE_KEYS) {
      const actions = SystemMetaData[RESOURCE_ROLE_TABLES[k].entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
    for (const entity of PRODUCT_OWNER_ENTITIES) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const [productTypes, products] = productOwnerLists;
  const { data, productOwned } = useMemo(() => {
    const all = {} as ResourceRoleCatalogData;
    RESOURCE_ROLE_TABLE_KEYS.forEach((k, i) => { all[k] = Array.isArray(lists[i]) ? lists[i] : []; });
    const side = sideOf(all, productTypes || [], products || []);
    return { data: side.data, productOwned: side.otherOwned };
  }, [lists, productTypes, products]);

  const status = useMemo(() => {
    const out = {} as Record<ResourceRoleTableKey, ResourceRoleTableStatus>;
    RESOURCE_ROLE_TABLE_KEYS.forEach((k, i) => {
      const [ok, err, rt, ev] = flags.slice(i * 4, i * 4 + 4);
      out[k] = { loaded: ok === 1 || !!ev, error: err ? String(err) : '', realtime: rt || 'idle' };
    });
    return out;
  }, [flags]);

  return { data, status, reload, productOwned };
}
