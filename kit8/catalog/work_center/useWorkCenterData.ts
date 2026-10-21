// Work center data - the work centers and the catalogs the screen needs (business units, persons, equipment, partners, variants) from redux, read once + Supabase Realtime for the work centers.
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../product/dashboard/useProductCatalogData';
import { PRODUCT_TABLES } from '../product/productModel';
import { BUSINESS_UNIT_TABLE } from '../business_unit/businessUnitModel';
import { PERSON_ENTITY } from '../person/personModel';
import { EQUIPMENT_ENTITY } from '../equipment/equipmentModel';
import { PARTNER_ENTITY } from '../partner/partnerModel';
import { emptyWorkCenterData, WORK_CENTER_ENTITY, WorkCenterCatalogData } from './workCenterModel';

/** list -> its redux entity */
const ENTITIES: Record<keyof WorkCenterCatalogData, string> = {
  workCenter: WORK_CENTER_ENTITY,
  businessUnit: BUSINESS_UNIT_TABLE.entity,
  person: PERSON_ENTITY,
  equipment: EQUIPMENT_ENTITY,
  partner: PARTNER_ENTITY,
  variant: PRODUCT_TABLES.variant.entity,
};
const KEYS = Object.keys(ENTITIES) as (keyof WorkCenterCatalogData)[];

export function useWorkCenterData(enabled = true): { data: WorkCenterCatalogData; loaded: boolean; error: string; reload: () => void } {
  const dispatch = useDispatch();
  useRealtimeEntity(WORK_CENTER_ENTITY, { readParams: PRODUCT_READ_PARAMS, enabled });
  // the variants change when "Copy Variant settings" runs on the server: realtime keeps the cell of the work center variant right
  useRealtimeEntity(PRODUCT_TABLES.variant.entity, { readParams: PRODUCT_READ_PARAMS, enabled });
  const lists: any[] = useSelector((s: any) => KEYS.map((k) => s?.[ENTITIES[k]]?.entityDataFromServer), shallowEqual);
  const flags: any[] = useSelector((s: any) => {
    const st = s?.[WORK_CENTER_ENTITY];
    return [st?.readSuccessful, st?.readErrorData, !!st?.lastRealtimeEvent];
  }, shallowEqual);

  const reload = () => {
    for (const k of KEYS) {
      const actions = SystemMetaData[ENTITIES[k]]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const data = emptyWorkCenterData();
  KEYS.forEach((k, i) => { data[k] = Array.isArray(lists[i]) ? lists[i] : []; });
  return { data, loaded: flags[0] === 1 || !!flags[2], error: flags[1] ? String(flags[1]) : '', reload };
}
