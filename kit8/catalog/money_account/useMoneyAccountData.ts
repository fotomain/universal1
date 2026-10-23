// Money account data - the money account rows and the legal entities (the folders) from redux, read once + Supabase Realtime.
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../product/dashboard/useProductCatalogData';
import type { DefRow } from '../product/productModel';
import { LEGAL_ENTITY_TABLE } from '../legal_entity/legalEntityModel';
import { MONEY_ACCOUNT_TABLE } from './moneyAccountModel';

export function useMoneyAccountData(enabled = true): { rows: DefRow<any>[]; legalEntities: DefRow<any>[]; loaded: boolean; error: string; reload: () => void } {
  const dispatch = useDispatch();
  useRealtimeEntity(MONEY_ACCOUNT_TABLE.entity, { readParams: PRODUCT_READ_PARAMS, enabled });
  const rows: DefRow<any>[] = useSelector((s: any) => s?.[MONEY_ACCOUNT_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const legalEntities: DefRow<any>[] = useSelector((s: any) => s?.[LEGAL_ENTITY_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const flags: any[] = useSelector((s: any) => {
    const st = s?.[MONEY_ACCOUNT_TABLE.entity];
    return [st?.readSuccessful, st?.readErrorData, !!st?.lastRealtimeEvent];
  }, shallowEqual);
  const reload = () => {
    for (const entity of [MONEY_ACCOUNT_TABLE.entity, LEGAL_ENTITY_TABLE.entity]) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return { rows: Array.isArray(rows) ? rows : [], legalEntities: Array.isArray(legalEntities) ? legalEntities : [], loaded: flags[0] === 1 || !!flags[2], error: flags[1] ? String(flags[1]) : '', reload };
}
