// Equipment dashboard data - every equipment table from redux (one reusable entity per table), read once + kept in sync by Supabase Realtime while
// the dashboard is open. The descriptor tables are shared with the products, the roles and the persons: the rows of the OTHER sides (their owner is a
// type / item of one of them) are left out of `data`; `otherOwned` lists them for the ReusableTables, which read the whole entity.
import { useEffect, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import { sideOf, SideOwnedKey } from '../../product/crud/catalogSides';
import { otherSideEntities, otherSideRows } from '../../product/crud/descriptorSides';
import { emptyEquipmentCatalogData, EquipmentCatalogData } from '../equipmentTypeModel';
import type { EquipmentTableKey } from '../equipmentValidation';
import { EQUIPMENT_TABLE_KEYS, EQUIPMENT_TABLES } from './equipmentDashboardModel';

export interface EquipmentTableStatus { loaded: boolean; error: string; realtime: string }

/** realtime for one table - one hook per table (a fixed list, so the hook order never changes) */
function useTableRealtime(key: EquipmentTableKey, enabled: boolean) {
  return useRealtimeEntity(EQUIPMENT_TABLES[key].entity, { readParams: PRODUCT_READ_PARAMS, enabled });
}

/** the OTHER sides of the shared descriptor tables (descriptorSides.ts; types first, then items) - read only, no realtime */
const OTHER = otherSideEntities('equipment');
const OTHER_ENTITIES = OTHER.all;

export function useEquipmentCatalogData(enabled = true): {
  data: EquipmentCatalogData; status: Record<EquipmentTableKey, EquipmentTableStatus>; reload: () => void;
  otherOwned: Record<SideOwnedKey, Set<string>>;
} {
  const dispatch = useDispatch();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  EQUIPMENT_TABLE_KEYS.forEach((k) => useTableRealtime(k, enabled));
  const lists: any[] = useSelector((s: any) => EQUIPMENT_TABLE_KEYS.map((k) => s?.[EQUIPMENT_TABLES[k].entity]?.entityDataFromServer), shallowEqual);
  const otherLists: any[] = useSelector((s: any) => OTHER_ENTITIES.map((e) => s?.[e]?.entityDataFromServer), shallowEqual);
  const flags: any[] = useSelector((s: any) => EQUIPMENT_TABLE_KEYS.flatMap((k) => {
    const st = s?.[EQUIPMENT_TABLES[k].entity];
    return [st?.readSuccessful, st?.readErrorData, st?.realtimeStatus, !!st?.lastRealtimeEvent];
  }), shallowEqual);

  const reload = () => {
    for (const k of EQUIPMENT_TABLE_KEYS) {
      const actions = SystemMetaData[EQUIPMENT_TABLES[k].entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
    for (const entity of OTHER_ENTITIES) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const { data, otherOwned } = useMemo(() => {
    const all = emptyEquipmentCatalogData();
    EQUIPMENT_TABLE_KEYS.forEach((k, i) => { (all as any)[k] = Array.isArray(lists[i]) ? lists[i] : []; });
    const other = otherSideRows('equipment', otherLists);
    const side = sideOf(all as any, other.types, other.items);
    return { data: side.data as EquipmentCatalogData, otherOwned: side.otherOwned };
  }, [lists, otherLists]);

  const status = useMemo(() => {
    const out = {} as Record<EquipmentTableKey, EquipmentTableStatus>;
    EQUIPMENT_TABLE_KEYS.forEach((k, i) => {
      const [ok, err, rt, ev] = flags.slice(i * 4, i * 4 + 4);
      out[k] = { loaded: ok === 1 || !!ev, error: err ? String(err) : '', realtime: rt || 'idle' };
    });
    return out;
  }, [flags]);

  return { data, status, reload, otherOwned };
}
