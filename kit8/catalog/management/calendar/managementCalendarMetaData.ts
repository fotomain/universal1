// Management calendars - the SystemMetaData entries (two reusable redux entities + sagas, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...managementCalendarSystemMetaData()`.
import { MANAGEMENT_CALENDAR_DAYS_TABLE, MANAGEMENT_CALENDAR_TABLE } from './managementCalendarModel';

export function managementCalendarSystemMetaData(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const t of [MANAGEMENT_CALENDAR_TABLE, MANAGEMENT_CALENDAR_DAYS_TABLE]) {
    out[t.entity] = {
      tableName: t.table,
      itemLabel: t.itemLabel,
      updateValidator: () => {},
      defaultData: t.emptyRowJSON(),
      prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
      prepareReadApi: (_p: any) => {},
    };
  }
  return out;
}
