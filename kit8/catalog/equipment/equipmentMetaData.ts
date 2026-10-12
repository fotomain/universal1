// Equipment catalog - the SystemMetaData entries (one reusable redux entity + saga per table, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...equipmentSystemMetaData()`.
import { EQUIPMENT_ENTITY, equipmentExample, equipmentTable } from './equipmentModel';
import { EQUIPMENT_TYPE_TABLE } from './equipmentTypeModel';

export function equipmentSystemMetaData(): Record<string, any> {
  const common = { updateValidator: () => {}, prepareCreateApi: (p: any) => ({ newItem: p.action.payload }), prepareReadApi: (_p: any) => {} };
  return {
    [EQUIPMENT_ENTITY]: { tableName: equipmentTable, itemLabel: 'Equipment', defaultData: equipmentExample, ...common },
    [EQUIPMENT_TYPE_TABLE.entity]: { tableName: EQUIPMENT_TYPE_TABLE.table, itemLabel: EQUIPMENT_TYPE_TABLE.itemLabel, defaultData: EQUIPMENT_TYPE_TABLE.emptyRowJSON(), ...common },
  };
}
