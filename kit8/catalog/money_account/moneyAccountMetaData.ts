// Money accounts - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...moneyAccountSystemMetaData()`.
import { MONEY_ACCOUNT_TABLE } from './moneyAccountModel';

export function moneyAccountSystemMetaData(): Record<string, any> {
  const t = MONEY_ACCOUNT_TABLE;
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
