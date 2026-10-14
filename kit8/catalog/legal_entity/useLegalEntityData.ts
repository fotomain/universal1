// Legal entity data - the legal entity rows and the countries (the folders) from redux, read once + Supabase Realtime.
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../product/dashboard/useProductCatalogData';
import type { DefRow } from '../product/productModel';
import { COUNTRY_ENTITY } from '../country/countryModel';
import { LEGAL_ENTITY_TABLE } from './legalEntityModel';

export function useLegalEntityData(enabled = true): { rows: DefRow<any>[]; countries: DefRow<any>[]; loaded: boolean; error: string; reload: () => void } {
  const dispatch = useDispatch();
  useRealtimeEntity(LEGAL_ENTITY_TABLE.entity, { readParams: PRODUCT_READ_PARAMS, enabled });
  const rows: DefRow<any>[] = useSelector((s: any) => s?.[LEGAL_ENTITY_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const countries: DefRow<any>[] = useSelector((s: any) => s?.[COUNTRY_ENTITY]?.entityDataFromServer, shallowEqual) ?? [];
  const flags: any[] = useSelector((s: any) => {
    const st = s?.[LEGAL_ENTITY_TABLE.entity];
    return [st?.readSuccessful, st?.readErrorData, !!st?.lastRealtimeEvent];
  }, shallowEqual);
  const reload = () => {
    for (const entity of [LEGAL_ENTITY_TABLE.entity, COUNTRY_ENTITY]) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return { rows: Array.isArray(rows) ? rows : [], countries: Array.isArray(countries) ? countries : [], loaded: flags[0] === 1 || !!flags[2], error: flags[1] ? String(flags[1]) : '', reload };
}
