// Management genus - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...managementGenusSystemMetaData()`.
import { MANAGEMENT_GENUS_TABLE } from './managementGenusModel';

export function managementGenusSystemMetaData(): Record<string, any> {
  const t = MANAGEMENT_GENUS_TABLE;
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
