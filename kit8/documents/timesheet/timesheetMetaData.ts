// Time sheet - the SystemMetaData entry (reusable redux entity + saga, Supabase Realtime), spread into kit8/redux/SystemMetaData.ts: `...timesheetSystemMetaData()`.
//   projectTimesheetHeader   the DOCUMENTS (the list reads them, realtime); never made / changed by the table: the RPCs make, set, post and delete them
// The lines and the entered hours are NOT redux entities: their writes are RPCs (timesheet_set_line, timesheet_set_hours), the form reads them with React Query.
import { TIMESHEET_HEADER_ENTITY, TIMESHEET_HEADER_TABLE } from './timesheetModel';

export function timesheetSystemMetaData(): Record<string, any> {
  return {
    [TIMESHEET_HEADER_ENTITY]: {
      tableName: TIMESHEET_HEADER_TABLE,
      itemLabel: 'Time sheet',
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('a time sheet is made by the RPC timesheet_create'); },
      prepareReadApi: (_p: any) => {},
    },
  };
}
