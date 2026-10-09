// Person dashboard data - every person table from redux (one reusable entity per table), read once + kept in sync by Supabase Realtime while
// the dashboard is open. The descriptor tables are shared with the products and the roles: the rows of the OTHER sides (their owner is a product
// type / product / role type / role) are left out of `data`; `otherOwned` lists them for the ReusableTables, which read the whole entity.
import { useEffect, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import { PRODUCT_TABLES } from '../../product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../resourcerole/resourceRoleModel';
import { sideOf, SideOwnedKey } from '../../product/crud/catalogSides';
import { CONTRACT_ENTITY } from '../../contract/contractModel';
import { emptyPersonCatalogData, PersonCatalogData } from '../personTypeModel';
import type { PersonTableKey } from '../personValidation';
import { PERSON_TABLE_KEYS, PERSON_TABLES } from './personDashboardModel';

export interface PersonTableStatus { loaded: boolean; error: string; realtime: string }

/** realtime for one table - one hook per table (a fixed list, so the hook order never changes) */
function useTableRealtime(key: PersonTableKey, enabled: boolean) {
  return useRealtimeEntity(PERSON_TABLES[key].entity, { readParams: PRODUCT_READ_PARAMS, enabled });
}

/** the OTHER sides: products and roles (types first, then items) - read only, no realtime */
const OTHER_TYPE_ENTITIES = [PRODUCT_TABLES.productType.entity, RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity];
const OTHER_ITEM_ENTITIES = [PRODUCT_TABLES.product.entity, RESOURCE_ROLE_OWN_TABLES.resourceRole.entity];

export function usePersonCatalogData(enabled = true): {
  data: PersonCatalogData; status: Record<PersonTableKey, PersonTableStatus>; reload: () => void;
  otherOwned: Record<SideOwnedKey, Set<string>>;
} {
  const dispatch = useDispatch();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  PERSON_TABLE_KEYS.forEach((k) => useTableRealtime(k, enabled));
  const lists: any[] = useSelector((s: any) => PERSON_TABLE_KEYS.map((k) => s?.[PERSON_TABLES[k].entity]?.entityDataFromServer), shallowEqual);
  const contracts: any = useSelector((s: any) => s?.[CONTRACT_ENTITY]?.entityDataFromServer, shallowEqual);
  const otherTypes: any[] = useSelector((s: any) => OTHER_TYPE_ENTITIES.map((e) => s?.[e]?.entityDataFromServer), shallowEqual);
  const otherItems: any[] = useSelector((s: any) => OTHER_ITEM_ENTITIES.map((e) => s?.[e]?.entityDataFromServer), shallowEqual);
  const flags: any[] = useSelector((s: any) => PERSON_TABLE_KEYS.flatMap((k) => {
    const st = s?.[PERSON_TABLES[k].entity];
    return [st?.readSuccessful, st?.readErrorData, st?.realtimeStatus, !!st?.lastRealtimeEvent];
  }), shallowEqual);

  const reload = () => {
    for (const k of PERSON_TABLE_KEYS) {
      const actions = SystemMetaData[PERSON_TABLES[k].entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
    for (const entity of [...OTHER_TYPE_ENTITIES, ...OTHER_ITEM_ENTITIES, CONTRACT_ENTITY]) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const { data, otherOwned } = useMemo(() => {
    const all = emptyPersonCatalogData();
    PERSON_TABLE_KEYS.forEach((k, i) => { (all as any)[k] = Array.isArray(lists[i]) ? lists[i] : []; });
    all.contract = Array.isArray(contracts) ? contracts : [];
    const flat = (ls: any[]) => ls.flatMap((l) => (Array.isArray(l) ? l : []));
    const side = sideOf(all as any, flat(otherTypes), flat(otherItems));
    return { data: side.data as PersonCatalogData, otherOwned: side.otherOwned };
  }, [lists, contracts, otherTypes, otherItems]);

  const status = useMemo(() => {
    const out = {} as Record<PersonTableKey, PersonTableStatus>;
    PERSON_TABLE_KEYS.forEach((k, i) => {
      const [ok, err, rt, ev] = flags.slice(i * 4, i * 4 + 4);
      out[k] = { loaded: ok === 1 || !!ev, error: err ? String(err) : '', realtime: rt || 'idle' };
    });
    return out;
  }, [flags]);

  return { data, status, reload, otherOwned };
}
