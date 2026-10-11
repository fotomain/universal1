// Task line plan - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime). Read-only: nothing creates / updates through it.
// Spread into kit8/redux/SystemMetaData.ts: `...taskLinePlanSystemMetaData()`.
import { TASK_LINE_PLAN_ENTITY, taskLinePlanTable } from './taskLinePlanModel';

export function taskLinePlanSystemMetaData(): Record<string, any> {
  return {
    [TASK_LINE_PLAN_ENTITY]: {
      tableName: taskLinePlanTable,
      itemLabel: 'Day',
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
      prepareReadApi: (_p: any) => {},
    },
  };
}
