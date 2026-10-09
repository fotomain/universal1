// Template of the resource contract - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...templateResourceContractSystemMetaData()`.
import { TEMPLATE_RESOURCE_CONTRACT_TABLE } from './templateResourceContractModel';

export function templateResourceContractSystemMetaData(): Record<string, any> {
  const t = TEMPLATE_RESOURCE_CONTRACT_TABLE;
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
