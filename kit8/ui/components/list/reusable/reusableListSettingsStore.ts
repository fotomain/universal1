// ReusableList - the LOCAL settings of a list: kept ON THIS DEVICE under the list's `reusableListGUID` (AsyncStorage + memory, no SQL, like the home settings of appPM80).
// One shared store: every list with the same GUID (two mounted copies of a screen) sees a change at once.
import { useSyncExternalStore } from 'react';
import { DEFAULT_LIST_SETTINGS, normalizeListSettings, ReusableListSettings } from './swipeModel';

const KEY_PREFIX = 'reusableListSettings:';
const byGUID = new Map<string, ReusableListSettings>();
const loading = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const storage = (): any => {
  try { return require('@react-native-async-storage/async-storage').default; } catch { return null; }
};

/** read the stored settings of a list once (the defaults show until the answer is there) */
function load(guid: string) {
  if (loading.has(guid)) return;
  loading.add(guid);
  try {
    Promise.resolve(storage()?.getItem(KEY_PREFIX + guid)).then((v: unknown) => {
      // a change made while the read was on its way wins
      if (typeof v !== 'string' || byGUID.has(guid)) return;
      byGUID.set(guid, normalizeListSettings(JSON.parse(v)));
      emit();
    }).catch(() => undefined);
  } catch { /* no storage: memory only */ }
}

/** the settings of a list now (always a stored reference, so a selector never loops) */
export function getReusableListSettings(guid: string): ReusableListSettings {
  return byGUID.get(guid) ?? DEFAULT_LIST_SETTINGS;
}

/** change some keys of a list's settings; they are kept on this device */
export function saveReusableListSettings(guid: string, patch: Partial<ReusableListSettings>): ReusableListSettings {
  const next = normalizeListSettings({ ...getReusableListSettings(guid), ...patch });
  byGUID.set(guid, next);
  emit();
  try { Promise.resolve(storage()?.setItem(KEY_PREFIX + guid, JSON.stringify(next))).catch(() => undefined); } catch { /* memory only */ }
  return next;
}

/** back to the defaults of a list */
export function resetReusableListSettings(guid: string): ReusableListSettings {
  byGUID.set(guid, DEFAULT_LIST_SETTINGS);
  emit();
  try { Promise.resolve(storage()?.removeItem(KEY_PREFIX + guid)).catch(() => undefined); } catch { /* memory only */ }
  return DEFAULT_LIST_SETTINGS;
}

/** test helper: forget everything held in memory */
export function clearReusableListSettingsMemory() { byGUID.clear(); loading.clear(); emit(); }

export function useReusableListSettings(guid: string): ReusableListSettings {
  load(guid);
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => getReusableListSettings(guid),
    () => DEFAULT_LIST_SETTINGS,
  );
}
