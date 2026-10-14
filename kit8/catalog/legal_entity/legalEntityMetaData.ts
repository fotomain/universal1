// Legal entities - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...legalEntitySystemMetaData()`.
import { LEGAL_ENTITY_TABLE } from './legalEntityModel';

export function legalEntitySystemMetaData(): Record<string, any> {
  const t = LEGAL_ENTITY_TABLE;
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
