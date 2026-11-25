// The app side of userSettingsTable: the rows of the signed-in user (a redux entity with Realtime), the row of THIS device, and the actions of the settings screen.
import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSupabase } from '../../../providers/WithSupabase';
import { mediaPostOwnerGUID } from '../../../redux/mediaPostOwner';
import { selectIsLoggedIn } from '../../../redux/activeUserSlice';
import { applyUserSettings } from '../../../redux/uxuiSlice';
import { createUserSettingsApi } from './userSettingsApi';
import { getDeviceKey } from './deviceKey';
import { findRowOfDevice, otherDeviceRows, platformDefaults, USER_SETTINGS_ENTITY, DeviceKey } from './userSettingsModel';
import { extractUxuiSettings } from './userSettingsSyncCore';

/** the rows of the user in the redux entity (empty until the read has finished) */
export function useUserSettingsRows(): any[] {
  const rows = useSelector((s: any) => s?.[USER_SETTINGS_ENTITY]?.entityDataFromServer);
  return Array.isArray(rows) ? rows : EMPTY;
}
const EMPTY: any[] = [];

export function useUserSettingsActions() {
  const { supabase } = useSupabase();
  const dispatch = useDispatch();
  const signedIn = useSelector(selectIsLoggedIn);
  const userGUID = useSelector((s: any) => mediaPostOwnerGUID(s));
  const rows = useUserSettingsRows();
  const key: DeviceKey = useMemo(() => getDeviceKey(), []);
  const api = useMemo(() => createUserSettingsApi(supabase), [supabase]);
  const store = useSelector((s: any) => s);

  const mine = findRowOfDevice(rows, key);
  const others = useMemo(() => otherDeviceRows(rows, key), [rows, key]);

  /** "Copy from my other device": the other row's settings become the settings of this device (the RPC makes / updates the row, Realtime brings it back) */
  const copyFromDevice = useCallback(async (from: DeviceKey) => {
    const row = await api.copyFrom(from, key);
    if (row?.rowJSON?.uxuiState) dispatch(applyUserSettings(row.rowJSON.uxuiState));
    return row;
  }, [api, key, dispatch]);

  /** "Reset to the defaults of this device" */
  const resetToDefaults = useCallback(async () => {
    const defaults = platformDefaults(key);
    dispatch(applyUserSettings(defaults));
    if (signedIn) await api.upsert(key, { ...extractUxuiSettings({ uxuiState: defaults }, key), ...defaults });
  }, [api, key, dispatch, signedIn]);

  return { key, rows, mine, others, signedIn, userGUID, copyFromDevice, resetToDefaults, store };
}
