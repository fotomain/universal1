// Budget item data - the budget item rows from redux (read once + Supabase Realtime) and the management genus rows (read only: the genus an
// item points at).
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import { MANAGEMENT_GENUS_TABLE } from '../../management/genus/managementGenusModel';
import type { DefRow } from '../../product/productModel';
import { BUDGET_ITEM_TABLE } from './budgetItemModel';

const GENUS_ENTITY = MANAGEMENT_GENUS_TABLE.entity;

export function useBudgetItemData(enabled = true): { rows: DefRow<any>[]; genusRows: DefRow<any>[]; loaded: boolean; error: string; reload: () => void } {
  const dispatch = useDispatch();
  useRealtimeEntity(BUDGET_ITEM_TABLE.entity, { readParams: PRODUCT_READ_PARAMS, enabled });
  useRealtimeEntity(GENUS_ENTITY, { readParams: PRODUCT_READ_PARAMS, enabled });
  const rows: DefRow<any>[] = useSelector((s: any) => s?.[BUDGET_ITEM_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const genusRows: DefRow<any>[] = useSelector((s: any) => s?.[GENUS_ENTITY]?.entityDataFromServer, shallowEqual) ?? [];
  const flags: any[] = useSelector((s: any) => {
    const st = s?.[BUDGET_ITEM_TABLE.entity];
    return [st?.readSuccessful, st?.readErrorData, !!st?.lastRealtimeEvent];
  }, shallowEqual);

  const reload = () => {
    for (const entity of [BUDGET_ITEM_TABLE.entity, GENUS_ENTITY]) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { rows: Array.isArray(rows) ? rows : [], genusRows: Array.isArray(genusRows) ? genusRows : [], loaded: flags[0] === 1 || !!flags[2], error: flags[1] ? String(flags[1]) : '', reload };
}
