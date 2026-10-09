// Task lines - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...taskLineSystemMetaData()`.
import { emptyTaskLine, TASK_LINE_ENTITY, taskLineTable } from './taskLineModel';

export function taskLineSystemMetaData(): Record<string, any> {
  return {
    [TASK_LINE_ENTITY]: {
      tableName: taskLineTable,
      itemLabel: 'Line',
      updateValidator: () => {},
      defaultData: emptyTaskLine(),
      prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
      prepareReadApi: (_p: any) => {},
    },
  };
}
