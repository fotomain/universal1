// Business unit data - the unit rows and the CFR enumeration from redux (read once + Supabase Realtime).
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../product/dashboard/useProductCatalogData';
import type { DefRow } from '../product/productModel';
import { BUSINESS_UNIT_TABLE } from './businessUnitModel';
import { CFR_TYPE_TABLE } from './cfrTypeModel';

export function useBusinessUnitData(enabled = true): { rows: DefRow<any>[]; cfrRows: DefRow<any>[]; loaded: boolean; error: string; reload: () => void } {
  const dispatch = useDispatch();
  useRealtimeEntity(BUSINESS_UNIT_TABLE.entity, { readParams: PRODUCT_READ_PARAMS, enabled });
  useRealtimeEntity(CFR_TYPE_TABLE.entity, { readParams: PRODUCT_READ_PARAMS, enabled });
  const rows: DefRow<any>[] = useSelector((s: any) => s?.[BUSINESS_UNIT_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const cfrRows: DefRow<any>[] = useSelector((s: any) => s?.[CFR_TYPE_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const flags: any[] = useSelector((s: any) => {
    const st = s?.[BUSINESS_UNIT_TABLE.entity];
    return [st?.readSuccessful, st?.readErrorData, !!st?.lastRealtimeEvent];
  }, shallowEqual);

  const reload = () => {
    for (const entity of [BUSINESS_UNIT_TABLE.entity, CFR_TYPE_TABLE.entity]) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { rows: Array.isArray(rows) ? rows : [], cfrRows: Array.isArray(cfrRows) ? cfrRows : [], loaded: flags[0] === 1 || !!flags[2], error: flags[1] ? String(flags[1]) : '', reload };
}
