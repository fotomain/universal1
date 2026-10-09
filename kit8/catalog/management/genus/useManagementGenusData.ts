// Management genus dashboard data - the genus rows from redux (read once + Supabase Realtime), and the role types (read only: how many
// role types use each genus).
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import { RESOURCE_ROLE_OWN_TABLES } from '../../resourcerole/resourceRoleModel';
import type { DefRow } from '../../product/productModel';
import { MANAGEMENT_GENUS_TABLE } from './managementGenusModel';

const TYPE_ENTITY = RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity;

export function useManagementGenusData(enabled = true): { rows: DefRow<any>[]; roleTypes: DefRow<any>[]; loaded: boolean; error: string; reload: () => void } {
  const dispatch = useDispatch();
  useRealtimeEntity(MANAGEMENT_GENUS_TABLE.entity, { readParams: PRODUCT_READ_PARAMS, enabled });
  const rows: DefRow<any>[] = useSelector((s: any) => s?.[MANAGEMENT_GENUS_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const roleTypes: DefRow<any>[] = useSelector((s: any) => s?.[TYPE_ENTITY]?.entityDataFromServer, shallowEqual) ?? [];
  const flags: any[] = useSelector((s: any) => {
    const st = s?.[MANAGEMENT_GENUS_TABLE.entity];
    return [st?.readSuccessful, st?.readErrorData, !!st?.lastRealtimeEvent];
  }, shallowEqual);

  const reload = () => {
    for (const entity of [MANAGEMENT_GENUS_TABLE.entity, TYPE_ENTITY]) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { rows: Array.isArray(rows) ? rows : [], roleTypes: Array.isArray(roleTypes) ? roleTypes : [], loaded: flags[0] === 1 || !!flags[2], error: flags[1] ? String(flags[1]) : '', reload };
}
