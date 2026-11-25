// Mounted once in app/_layout.tsx (inside the redux store, the design system and Supabase). Keeps the redux uxuiState and the row of userSettingsTable of THIS device equal:
//   - signed in: reads the rows of the user (+ Realtime), applies the row of this device, makes it from the local state when it is missing, writes every change back (debounced),
//     touches lastUsedAt once a day, starts the saga deleteNotUsedUserSettings;
//   - not signed in (a guest): nothing is read; the local (redux-persist) state is the settings; Rule 1 gave the first values (platformDefaults);
//   - sign out: the defaults of this device again (another user must not inherit the look).
// The colors the user chose live in uxuiState.themeSettings; ThemeColorsBridge puts them on the Paper theme (userTheme).
import React, { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useSupabase } from '../../../providers/WithSupabase';
import { mediaPostOwnerGUID } from '../../../redux/mediaPostOwner';
import { selectIsLoggedIn } from '../../../redux/activeUserSlice';
import { applyUserSettings, selectThemeSettings } from '../../../redux/uxuiSlice';
import { applyThemeColors, setThemeMode } from '../../../redux/userThemeSlice';
import { startUserSettingsCleanup, stopUserSettingsCleanup } from '../../../redux/deleteNotUsedUserSettings';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { createUserSettingsApi } from './userSettingsApi';
import { getDeviceKey } from './deviceKey';
import { findRowOfDevice, needsTouch, normalizeUxuiSettings, platformDefaults, USER_SETTINGS_ENTITY } from './userSettingsModel';
import { extractUxuiSettings, settingsOfRow, settingsSignature } from './userSettingsSyncCore';

const SAVE_DEBOUNCE_MS = 800;

/** puts uxuiState.themeSettings.colors / fabColor and the dark mode on the Paper theme (userTheme) */
export function ThemeColorsBridge() {
  const dispatch = useDispatch();
  const theme = useSelector(selectThemeSettings);
  const darkMode = useSelector((s: any) => Boolean(s?.uxuiState?.darkMode));
  useEffect(() => {
    dispatch(setThemeMode(darkMode ? 'dark' : 'light'));
    dispatch(applyThemeColors({ colors: theme.colors, fabColor: theme.fabColor }));
  }, [dispatch, theme.colors, theme.fabColor, darkMode]);
  return null;
}

export function useUserSettingsSync() {
  const dispatch = useDispatch();
  const store = useStore();
  const { supabase } = useSupabase();
  const signedIn = useSelector(selectIsLoggedIn);
  const userGUID = useSelector((s: any) => (selectIsLoggedIn(s) ? mediaPostOwnerGUID(s) : ''));
  const key = useMemo(() => getDeviceKey(), []);
  const api = useMemo(() => (supabase ? createUserSettingsApi(supabase) : null), [supabase]);
  const match = useMemo(() => ({ rowOwnerGUID: userGUID }), [userGUID]);
  const active = Boolean(signedIn && userGUID && api);

  useRealtimeEntity(USER_SETTINGS_ENTITY, { filter: `rowOwnerGUID=eq.${userGUID}`, readParams: { match }, enabled: active });

  const rows = useSelector((s: any) => s?.[USER_SETTINGS_ENTITY]?.entityDataFromServer);
  const readScope = useSelector((s: any) => s?.[USER_SETTINGS_ENTITY]?.readScope);
  const loaded = active && readScope === JSON.stringify(match);

  const lastSig = useRef<string>('');
  const ready = useRef(false);
  const wasSignedIn = useRef(false);
  const timer = useRef<any>(null);
  const touched = useRef(false);
  const saving = useRef(false);

  // the first read of the rows (the realtime hook also reads, this one makes sure of it when the channel is not available)
  useEffect(() => {
    if (!active) return;
    SystemMetaData[USER_SETTINGS_ENTITY]?.actions && dispatch(SystemMetaData[USER_SETTINGS_ENTITY].actions.readData({ match }));
  }, [active, dispatch, match]);

  // the row of this device arrived / changed: apply it, or make it from the local state
  const row = loaded ? findRowOfDevice(Array.isArray(rows) ? rows : [], key) : undefined;
  const rowJSONKey = row ? JSON.stringify(row.rowJSON?.uxuiState ?? null) : '';
  useEffect(() => {
    if (!loaded || !api) return;
    wasSignedIn.current = true;
    if (!row) {
      // a new device (or the first login with this app version): the local choices become the row, completed by the defaults of the platform
      const local = normalizeUxuiSettings(extractUxuiSettings((store.getState() as any), key), key);
      lastSig.current = settingsSignature(local);
      ready.current = true;
      api.upsert(key, local).catch((e) => console.warn('user settings: the first row was not saved', e));
      return;
    }
    const incoming = settingsOfRow(row, key);
    const sig = settingsSignature(incoming);
    if (sig !== lastSig.current) {
      dispatch(applyUserSettings(incoming));
      // the signature of the state AFTER the apply: a row of an older app lacks small preferences that the state fills in - that is not a change to write back
      lastSig.current = settingsSignature(extractUxuiSettings(store.getState() as any, key));
    }
    ready.current = true;
    if (!touched.current && needsTouch(row.rowJSON?.lastUsedAt)) {
      touched.current = true;
      api.touch(key).catch((e) => console.warn('user settings: lastUsedAt was not touched', e));
    }
  }, [loaded, rowJSONKey, api, key, dispatch, store, row]);

  // a change of the preferences on this device is written back after a short pause
  const local = useSelector((s: any) => settingsSignature(extractUxuiSettings(s, key)));
  useEffect(() => {
    if (!active || !ready.current || !api) return;
    if (local === lastSig.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const now = extractUxuiSettings(store.getState() as any, key);
      const sig = settingsSignature(now);
      if (sig === lastSig.current || saving.current) return;
      lastSig.current = sig;
      saving.current = true;
      api.upsert(key, now).catch((e) => console.warn('user settings: not saved', e)).finally(() => { saving.current = false; });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [local, active, api, key, store]);

  // the background saga that deletes the rows nobody uses
  useEffect(() => {
    if (!loaded) return;
    dispatch(startUserSettingsCleanup({ userGUID, key }));
    return () => { dispatch(stopUserSettingsCleanup()); };
  }, [loaded, userGUID, key, dispatch]);

  // sign out: the defaults of this device again
  useEffect(() => {
    if (signedIn) return;
    if (wasSignedIn.current) {
      wasSignedIn.current = false;
      ready.current = false;
      lastSig.current = '';
      touched.current = false;
      dispatch(applyUserSettings(platformDefaults(key)));
    }
  }, [signedIn, key, dispatch]);
}

export default function UserSettingsHost() {
  useUserSettingsSync();
  return <ThemeColorsBridge />;
}
