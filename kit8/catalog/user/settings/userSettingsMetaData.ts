// userSettingsTable - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime). Spread into kit8/redux/SystemMetaData.ts: `...userSettingsSystemMetaData()`.
// The list of the entity = the rows of the signed-in user (readData match { rowOwnerGUID }); Realtime keeps it fresh on every device of the user (UserSettingsHost starts it).
import { USER_SETTINGS_ENTITY, USER_SETTINGS_TABLE } from './userSettingsModel';

export function userSettingsSystemMetaData(): Record<string, any> {
  return {
    [USER_SETTINGS_ENTITY]: {
      tableName: USER_SETTINGS_TABLE,
      itemLabel: 'User settings',
      updateValidator: () => {},
      defaultData: { rowParentGUID: 'desktop', rowFolderGUID: 'other', rowJSON: { uxuiState: {} } },
      prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
      prepareReadApi: (_p: any) => {},
    },
  };
}
