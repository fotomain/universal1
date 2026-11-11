// Organization members - the rows the signed-in user can read (RLS: the administrator reads the members of his organizations, a member his own row) from redux, read once + Supabase Realtime.
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import type { DefRow } from '../../product/productModel';
import { ORGANIZATION_MEMBER_ENTITY } from './organizationMemberModel';

export function useOrganizationMembers(enabled = true): { rows: DefRow<any>[]; loaded: boolean; error: string; reload: () => void } {
  const dispatch = useDispatch();
  useRealtimeEntity(ORGANIZATION_MEMBER_ENTITY, { readParams: PRODUCT_READ_PARAMS, enabled });
  const rows: DefRow<any>[] = useSelector((s: any) => s?.[ORGANIZATION_MEMBER_ENTITY]?.entityDataFromServer, shallowEqual) ?? [];
  const flags: any[] = useSelector((s: any) => {
    const st = s?.[ORGANIZATION_MEMBER_ENTITY];
    return [st?.readSuccessful, st?.readErrorData, !!st?.lastRealtimeEvent];
  }, shallowEqual);
  const reload = () => {
    const actions = SystemMetaData[ORGANIZATION_MEMBER_ENTITY]?.actions;
    if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return { rows: Array.isArray(rows) ? rows : [], loaded: flags[0] === 1 || !!flags[2], error: flags[1] ? String(flags[1]) : '', reload };
}
