// Management calendar data - the calendar rows (folders + calendars) from redux (read once + Supabase Realtime).
// The DAYS of a calendar are read by the days table itself (one calendar and one year = at most 366 rows) or, for a task plan, by fetchCalendarDays.
import { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import type { DefRow } from '../../product/productModel';
import { MANAGEMENT_CALENDAR_TABLE } from './managementCalendarModel';

const ENTITY = MANAGEMENT_CALENDAR_TABLE.entity;

export function useManagementCalendarData(enabled = true): { rows: DefRow<any>[]; loaded: boolean; error: string; reload: () => void } {
  const dispatch = useDispatch();
  useRealtimeEntity(ENTITY, { readParams: PRODUCT_READ_PARAMS, enabled });
  const rows: DefRow<any>[] = useSelector((s: any) => s?.[ENTITY]?.entityDataFromServer, shallowEqual) ?? [];
  const flags: any[] = useSelector((s: any) => {
    const st = s?.[ENTITY];
    return [st?.readSuccessful, st?.readErrorData, !!st?.lastRealtimeEvent];
  }, shallowEqual);

  const reload = () => {
    const actions = SystemMetaData[ENTITY]?.actions;
    if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
  };
  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { rows: Array.isArray(rows) ? rows : [], loaded: flags[0] === 1 || !!flags[2], error: flags[1] ? String(flags[1]) : '', reload };
}
