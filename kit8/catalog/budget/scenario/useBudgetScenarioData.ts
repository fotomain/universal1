// Budget scenario data - the scenario rows from redux (read once + Supabase Realtime): for the pickers of the project settings.
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import type { DefRow } from '../../product/productModel';
import { BUDGET_SCENARIO_TABLE } from './budgetScenarioModel';

export function useBudgetScenarioData(enabled = true): { rows: DefRow<any>[]; loaded: boolean; error: string } {
  const dispatch = useDispatch();
  useRealtimeEntity(BUDGET_SCENARIO_TABLE.entity, { readParams: PRODUCT_READ_PARAMS, enabled });
  const rows: DefRow<any>[] = useSelector((s: any) => s?.[BUDGET_SCENARIO_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const flags: any[] = useSelector((s: any) => {
    const st = s?.[BUDGET_SCENARIO_TABLE.entity];
    return [st?.readSuccessful, st?.readErrorData, !!st?.lastRealtimeEvent];
  }, shallowEqual);
  useEffect(() => {
    if (!enabled) return;
    const actions = SystemMetaData[BUDGET_SCENARIO_TABLE.entity]?.actions;
    if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return { rows: Array.isArray(rows) ? rows : [], loaded: flags[0] === 1 || !!flags[2], error: flags[1] ? String(flags[1]) : '' };
}
