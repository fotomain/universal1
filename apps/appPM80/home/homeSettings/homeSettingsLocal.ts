// homeSettingsLocal - the home look settings kept ON THIS DEVICE (AsyncStorage + memory), like businessOrderLocal.
import { useSyncExternalStore } from 'react';
import { PM80HomeSettings, PM80_HOME_SETTINGS_DEFAULT, normalizeHomeSettings } from './homeSettingsModel';

const STORAGE_KEY = 'pm80HomeSettings';

let state: PM80HomeSettings = PM80_HOME_SETTINGS_DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const storage = (): any => {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
};

function load() {
  if (loaded) return;
  loaded = true;
  try {
    Promise.resolve(storage()?.getItem(STORAGE_KEY))
      .then((v: unknown) => {
        if (typeof v !== 'string') return;
        state = normalizeHomeSettings(JSON.parse(v));
        emit();
      })
      .catch(() => {});
  } catch {
    // no storage: memory only
  }
}

export function saveHomeSettingsLocal(next: Partial<PM80HomeSettings>): void {
  state = normalizeHomeSettings({ ...state, ...next });
  try {
    Promise.resolve(storage()?.setItem(STORAGE_KEY, JSON.stringify(state))).catch(() => {});
  } catch {
    // memory only
  }
  emit();
}

export const getHomeSettingsLocal = (): PM80HomeSettings => state;

/** test helper */
export function resetHomeSettingsLocal(): void {
  state = PM80_HOME_SETTINGS_DEFAULT;
  loaded = true;
  emit();
}

export function useHomeSettings(): PM80HomeSettings {
  load();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
