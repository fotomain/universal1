// Management activity genus - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...managementActivityGenusSystemMetaData()`.
import { MANAGEMENT_ACTIVITY_GENUS_TABLE } from './managementActivityGenusModel';

export function managementActivityGenusSystemMetaData(): Record<string, any> {
  const t = MANAGEMENT_ACTIVITY_GENUS_TABLE;
  return {
    [t.entity]: {
      tableName: t.table,
      itemLabel: t.itemLabel,
      updateValidator: () => {},
      defaultData: t.emptyRowJSON(),
      prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
      prepareReadApi: (_p: any) => {},
    },
  };
}
