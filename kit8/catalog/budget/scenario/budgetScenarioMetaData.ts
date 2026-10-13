// Budget scenarios - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...budgetScenarioSystemMetaData()`.
import { BUDGET_SCENARIO_TABLE } from './budgetScenarioModel';

export function budgetScenarioSystemMetaData(): Record<string, any> {
  const t = BUDGET_SCENARIO_TABLE;
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
