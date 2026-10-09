// Person types - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...personTypeSystemMetaData()`.
import { PERSON_TYPE_TABLE } from './personTypeModel';

export function personTypeSystemMetaData(): Record<string, any> {
  const t = PERSON_TYPE_TABLE;
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
