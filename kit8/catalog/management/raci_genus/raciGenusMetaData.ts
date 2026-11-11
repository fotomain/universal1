// RACI genus - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime). Read only: the screens only read it (SQL PART 44 grants SELECT).
// Spread into kit8/redux/SystemMetaData.ts: `...managementRACIGenusSystemMetaData()`.
import { MANAGEMENT_RACI_GENUS_TABLE } from './raciGenusModel';

export function managementRACIGenusSystemMetaData(): Record<string, any> {
  const t = MANAGEMENT_RACI_GENUS_TABLE;
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
