// The redux background saga deleteNotUsedUserSettings: a row of userSettingsTable that was not used for a month is deleted (the database does not do it).
//   startUserSettingsCleanup({ userGUID, key }) starts it (UserSettingsHost, once the row of this device exists); stopUserSettingsCleanup stops it (sign out).
//   It runs at once and then every 24 hours while the app is open; it never deletes the row of this device and only reads / deletes the rows of the signed-in user (RLS).
import { createAction } from '@reduxjs/toolkit';
import { call, cancel, delay, fork, getContext, take } from 'redux-saga/effects';
import { createUserSettingsApi } from '../catalog/user/settings/userSettingsApi';
import { DeviceKey, expiredRowGUIDs, USER_SETTINGS_TOUCH_EVERY_MS } from '../catalog/user/settings/userSettingsModel';

export const startUserSettingsCleanup = createAction<{ userGUID: string; key: DeviceKey }>('userSettings/startCleanup');
export const stopUserSettingsCleanup = createAction('userSettings/stopCleanup');

/** one pass: read the rows of the user, delete the expired ones; returns the deleted row GUIDs */
export async function deleteExpiredUserSettings(api: { readOwnRows: (u: string) => Promise<any[]>; deleteRows: (g: string[]) => Promise<number> }, userGUID: string, key: DeviceKey, now: number = Date.now()): Promise<string[]> {
  const rows = await api.readOwnRows(userGUID);
  const gone = expiredRowGUIDs(rows, key, now);
  if (gone.length) await api.deleteRows(gone);
  return gone;
}

function* cleanupLoop(payload: { userGUID: string; key: DeviceKey }): Generator<any, void, any> {
  const dbAdapters: any = yield getContext('dbAdapters');
  const supabase = dbAdapters?.supabaseAdapter?.supabase;
  if (!supabase) return;
  const api = createUserSettingsApi(supabase);
  while (true) {
    try {
      const gone: string[] = yield call(deleteExpiredUserSettings, api, payload.userGUID, payload.key);
      if (gone.length) console.log('deleteNotUsedUserSettings: deleted', gone.length, 'unused row(s)');
    } catch (e) {
      console.warn('deleteNotUsedUserSettings failed (it will run again in 24 hours)', e);
    }
    yield delay(USER_SETTINGS_TOUCH_EVERY_MS);
  }
}

export function* deleteNotUsedUserSettingsSaga(): Generator<any, void, any> {
  let task: any = null;
  while (true) {
    const action: any = yield take([startUserSettingsCleanup.type, stopUserSettingsCleanup.type]);
    if (task) { yield cancel(task); task = null; }
    if (action.type === startUserSettingsCleanup.type) task = yield fork(cleanupLoop, action.payload);
  }
}
