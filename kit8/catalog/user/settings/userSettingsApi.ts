// Supabase calls of userSettingsTable. The writes are RPCs (start2 PART 59); the rows are read with the user's RLS (only his own come back).
import type { SupabaseClient } from '@supabase/supabase-js';
import { DeviceKey, USER_SETTINGS_RPC, USER_SETTINGS_TABLE, UxuiSettingsJSON } from './userSettingsModel';

function check<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export function createUserSettingsApi(sb: SupabaseClient) {
  return {
    /** insert or update the row of (user, device type, OS) */
    async upsert(key: DeviceKey, uxuiState: UxuiSettingsJSON) {
      return check<any>(await sb.rpc(USER_SETTINGS_RPC.upsert, { p_device: key.deviceType, p_os: key.os, p_uxui: uxuiState }));
    },
    /** only lastUsedAt */
    async touch(key: DeviceKey) {
      check<any>(await sb.rpc(USER_SETTINGS_RPC.touch, { p_device: key.deviceType, p_os: key.os }));
    },
    /** "Copy from my other device" */
    async copyFrom(from: DeviceKey, to: DeviceKey) {
      return check<any>(await sb.rpc(USER_SETTINGS_RPC.copyFrom, { p_from_device: from.deviceType, p_from_os: from.os, p_device: to.deviceType, p_os: to.os }));
    },
    /** every row of the user (small: one per device kind) */
    async readOwnRows(userGUID: string) {
      return (check<any[]>(await sb.from(USER_SETTINGS_TABLE).select('*').eq('rowOwnerGUID', userGUID)) || []) as any[];
    },
    async deleteRows(rowGUIDs: string[]) {
      if (rowGUIDs.length === 0) return 0;
      check<any>(await sb.from(USER_SETTINGS_TABLE).delete().in('rowGUID', rowGUIDs));
      return rowGUIDs.length;
    },
  };
}
export type UserSettingsApi = ReturnType<typeof createUserSettingsApi>;
