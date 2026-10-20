// Activity genus data - the activity rows, the key rows and the budget items from redux (read once + Supabase Realtime), all read only here: the screen counts the keys and the budget items
// of every activity / key.
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import type { DefRow } from '../../product/productModel';
import { BUDGET_ITEM_TABLE } from '../../budget/item/budgetItemModel';
import { BUDGET_ITEM_KEY_TABLE } from '../../budget/item/budgetItemKeyModel';
import { MANAGEMENT_ACTIVITY_GENUS_TABLE } from './managementActivityGenusModel';

const ENTITIES = [MANAGEMENT_ACTIVITY_GENUS_TABLE.entity, BUDGET_ITEM_KEY_TABLE.entity, BUDGET_ITEM_TABLE.entity];

export interface ManagementActivityGenusData {
  activityRows: DefRow<any>[];
  keyRows: DefRow<any>[];
  budgetItemRows: DefRow<any>[];
  /** budget items per activity (operatingActivity -> 14) */
  itemsPerActivity: Record<string, number>;
  /** budget items per key ('operatingActivity.timeGenus' -> 3) */
  itemsPerKey: Record<string, number>;
  error: string;
  reload: () => void;
}

export function useManagementActivityGenusData(enabled = true): ManagementActivityGenusData {
  const dispatch = useDispatch();
  useRealtimeEntity(ENTITIES[0], { readParams: PRODUCT_READ_PARAMS, enabled });
  useRealtimeEntity(ENTITIES[1], { readParams: PRODUCT_READ_PARAMS, enabled });
  useRealtimeEntity(ENTITIES[2], { readParams: PRODUCT_READ_PARAMS, enabled });
  const activityRows: DefRow<any>[] = useSelector((s: any) => s?.[ENTITIES[0]]?.entityDataFromServer, shallowEqual) ?? [];
  const keyRows: DefRow<any>[] = useSelector((s: any) => s?.[ENTITIES[1]]?.entityDataFromServer, shallowEqual) ?? [];
  const budgetItemRows: DefRow<any>[] = useSelector((s: any) => s?.[ENTITIES[2]]?.entityDataFromServer, shallowEqual) ?? [];
  const errors: any[] = useSelector((s: any) => ENTITIES.map((e) => s?.[e]?.readErrorData), shallowEqual);

  const reload = () => {
    for (const entity of ENTITIES) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const itemsPerKey: Record<string, number> = {};
  const itemsPerActivity: Record<string, number> = {};
  for (const r of Array.isArray(budgetItemRows) ? budgetItemRows : []) {
    if (!r.rowParentGUID || r.rowParentGUID === 'empty') continue;     // a folder
    const key = String(r.rowJSON?.budgetItemGenericKey ?? '');
    if (!key) continue;
    itemsPerKey[key] = (itemsPerKey[key] ?? 0) + 1;
    const activity = key.split('.')[0];
    itemsPerActivity[activity] = (itemsPerActivity[activity] ?? 0) + 1;
  }
  const error = errors.find((e) => !!e);
  return {
    activityRows: Array.isArray(activityRows) ? activityRows : [],
    keyRows: Array.isArray(keyRows) ? keyRows : [],
    budgetItemRows: Array.isArray(budgetItemRows) ? budgetItemRows : [],
    itemsPerActivity,
    itemsPerKey,
    error: error ? String(error) : '',
    reload,
  };
}
