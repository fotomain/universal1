// Business units - the SystemMetaData entries (one reusable redux entity + saga each, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...businessUnitSystemMetaData()`.
import { BUSINESS_UNIT_SELECT_FROM_TREE, BUSINESS_UNIT_TABLE } from './businessUnitModel';
import { CFR_TYPE_TABLE } from './cfrTypeModel';

export function businessUnitSystemMetaData(): Record<string, any> {
  const entry = (t: typeof BUSINESS_UNIT_TABLE, extra: Record<string, any> = {}) => ({
    tableName: t.table,
    itemLabel: t.itemLabel,
    updateValidator: () => {},
    defaultData: t.emptyRowJSON(),
    prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
    prepareReadApi: (_p: any) => {},
    ...extra,
  });
  return {
    // selectFromTree: a unit of ANY level can be picked, the first level too (absent / false = only the units without sub-units)
    [BUSINESS_UNIT_TABLE.entity]: entry(BUSINESS_UNIT_TABLE, { selectFromTree: BUSINESS_UNIT_SELECT_FROM_TREE }),
    // the enumeration: read only (the app never writes it)
    [CFR_TYPE_TABLE.entity]: entry(CFR_TYPE_TABLE),
  };
}
