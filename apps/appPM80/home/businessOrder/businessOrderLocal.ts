// businessOrderLocal - the Business order setup kept ON THIS DEVICE (AsyncStorage + memory).
//   It is the place of a guest / an offline device and the fallback while the database refuses (not the administrator, a read-only
//   project): the setup then still works on this device. The database copy always wins when it exists.
import { useSyncExternalStore } from 'react';
import { BusinessOrderSettings, StoredBusinessOrders, normalizeBusinessOrder } from './businessOrderModel';

const STORAGE_KEY = 'pm80BusinessOrderLocal';

interface LocalState {
  organization: BusinessOrderSettings | null;
  projects: Record<string, BusinessOrderSettings | undefined>;
}

let state: LocalState = { organization: null, projects: {} };
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
        const p = JSON.parse(v);
        const projects: LocalState['projects'] = {};
        Object.keys(p?.projects || {}).forEach((id) => (projects[id] = normalizeBusinessOrder(p.projects[id])));
        state = { organization: p?.organization ? normalizeBusinessOrder(p.organization) : null, projects };
        emit();
      })
      .catch(() => {});
  } catch {
    // no storage: memory only
  }
}

function persist() {
  try {
    Promise.resolve(storage()?.setItem(STORAGE_KEY, JSON.stringify(state))).catch(() => {});
  } catch {
    // memory only
  }
}

export function saveBusinessOrderLocal(targets: { organization: boolean; projectIds: string[] }, settings: BusinessOrderSettings): void {
  const next: LocalState = { organization: state.organization, projects: { ...state.projects } };
  if (targets.organization) next.organization = settings;
  targets.projectIds.forEach((id) => (next.projects[id] = settings));
  state = next;
  persist();
  emit();
}

export const getBusinessOrderLocal = (): StoredBusinessOrders => state;

/** test helper */
export function resetBusinessOrderLocal(): void {
  state = { organization: null, projects: {} };
  loaded = true;
  emit();
}

export function useBusinessOrderLocal(): StoredBusinessOrders {
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
