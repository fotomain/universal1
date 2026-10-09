// Resource role catalog - the SystemMetaData entries of the four role tables (one reusable redux entity + saga per table,
// Supabase Realtime). The shared descriptor tables are registered by the product catalog (productMetaData).
// Spread into kit8/redux/SystemMetaData.ts: `...resourceRoleSystemMetaData()`.
import { RESOURCE_ROLE_OWN_KEYS, RESOURCE_ROLE_OWN_TABLES } from './resourceRoleModel';

export function resourceRoleSystemMetaData(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of RESOURCE_ROLE_OWN_KEYS) {
    const t = RESOURCE_ROLE_OWN_TABLES[key];
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
