// ReusableList - small external stores. State of a ROW must not live in a recycled item (FlashList reuses the cell for another row):
// the selection and the dragged row are kept here and each item reads only its own flag (useSyncExternalStore), so one tap re-renders one item.
import { useSyncExternalStore } from 'react';

type Listener = () => void;

/**
 * Selection of rows: a Set of rowGUIDs, or "all rows of the view except these" (select all of 100 000 rows costs nothing).
 */
export interface SelectionStore {
  subscribe: (l: Listener) => () => void;
  /** a number that changes with every change (snapshot of "anything selected?") */
  version: () => number;
  isSelected: (guid: string) => boolean;
  toggle: (guid: string) => void;
  /** every row of the view (the loaded rows in server mode) */
  selectAll: () => void;
  /** these rows only */
  set: (guids: string[]) => void;
  clear: () => void;
  isAll: () => boolean;
  /** how many of `total` rows of the view are selected */
  count: (total: number) => number;
  /** the guids of the selected rows of `view` (in view order) */
  idsOf: (view: { rowGUID: string }[]) => string[];
}

export function createSelectionStore(): SelectionStore {
  let all = false;
  let ids = new Set<string>(); // all = false: the selected ones; all = true: the rows NOT selected
  let version = 0;
  const listeners = new Set<Listener>();
  const emit = () => { version++; listeners.forEach((l) => l()); };
  const isSelected = (guid: string) => (all ? !ids.has(guid) : ids.has(guid));
  return {
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    version: () => version,
    isSelected,
    toggle: (guid) => { if (ids.has(guid)) ids.delete(guid); else ids.add(guid); emit(); },
    selectAll: () => { all = true; ids = new Set(); emit(); },
    set: (guids) => { all = false; ids = new Set(guids); emit(); },
    clear: () => { if (!all && ids.size === 0) return; all = false; ids = new Set(); emit(); },
    isAll: () => all,
    count: (total) => (all ? Math.max(0, total - ids.size) : ids.size),
    idsOf: (view) => (all ? view.filter((r) => !ids.has(r.rowGUID)).map((r) => r.rowGUID) : view.filter((r) => ids.has(r.rowGUID)).map((r) => r.rowGUID)),
  };
}

/** the row that is dragged now (null = none) */
export interface DragStore {
  subscribe: (l: Listener) => () => void;
  get: () => string | null;
  set: (guid: string | null) => void;
}
export function createDragStore(): DragStore {
  let current: string | null = null;
  const listeners = new Set<Listener>();
  return {
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    get: () => current,
    set: (guid) => { if (guid === current) return; current = guid; listeners.forEach((l) => l()); },
  };
}

/** is THIS row selected - only this item re-renders when it changes */
export function useIsSelected(store: SelectionStore, guid: string): boolean {
  return useSyncExternalStore(store.subscribe, () => store.isSelected(guid), () => false);
}
/** is THIS row the dragged one */
export function useIsDragged(store: DragStore, guid: string): boolean {
  return useSyncExternalStore(store.subscribe, () => store.get() === guid, () => false);
}
/** number of selected rows (the bar) */
export function useSelectionVersion(store: SelectionStore): number {
  return useSyncExternalStore(store.subscribe, store.version, () => 0);
}
