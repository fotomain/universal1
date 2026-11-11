// Organization members - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...organizationMemberSystemMetaData()`.
import { ORGANIZATION_MEMBER_TABLE } from './organizationMemberModel';

export function organizationMemberSystemMetaData(): Record<string, any> {
  const t = ORGANIZATION_MEMBER_TABLE;
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
