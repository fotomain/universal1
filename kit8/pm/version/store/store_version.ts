// Zustand store of the project versions (kit8/pm/version). Filled from React Query
// (crud/version/versionQueries.ts) like store_pm.ts / store_kanban.ts: server truth -> hydrate -> selectors.
//
//   versions        version_project_table rows of the selected project (newest first)
//   checkedGUIDs    versions the user checked for the visual comparison (saved in uxuiSettings.checkedProjectVersions)
//   dataByVersion   tasks + dependencies of the loaded versions
//   overlays        what the Gantt draws: one colored set of thin bars per checked + loaded version
//   titlePrompt     "Save project version" / "Rename version" window
//   restorePicker   "Restore project from version" list (ModalWindowListToSelect)

import { create } from 'zustand';
import { buildVersionOverlays, PMVersionOverlay } from '../model/versionCompare';
import { PM_VERSION_MAX_CHECKED, PMProjectVersionRow, PMVersionData } from '../model/versionTypes';

export interface PMVersionTitlePrompt {
  mode: 'save' | 'rename';
  /** rename: the version */
  versionGUID?: string;
  title: string;
}

export interface PMVersionStoreState {
  projectGUID: string | null;
  versions: PMProjectVersionRow[];
  /** create_tables.sql (section 5b) not run yet */
  tablesMissing: boolean;
  checkedGUIDs: string[];
  dataByVersion: Record<string, PMVersionData>;
  overlays: PMVersionOverlay[];
  /** colors of the active project the version colors must differ from */
  avoidColors: string[];
  titlePrompt: PMVersionTitlePrompt | null;
  restorePickerOpen: boolean;
  /** a save / restore / sql_for_delete is running */
  busy: boolean;

  hydrateVersions: (projectGUID: string, rows: PMProjectVersionRow[], missing: boolean) => void;
  resetProject: (projectGUID: string | null) => void;
  setChecked: (guids: string[]) => void;
  setVersionData: (data: PMVersionData) => void;
  setAvoidColors: (colors: string[]) => void;
  setTitlePrompt: (prompt: PMVersionTitlePrompt | null) => void;
  setRestorePickerOpen: (open: boolean) => void;
  setBusy: (busy: boolean) => void;
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Checked list limited to existing versions and to PM_VERSION_MAX_CHECKED (the first ones win). */
export function normalizeChecked(guids: unknown, versions: PMProjectVersionRow[]): string[] {
  if (!Array.isArray(guids)) return [];
  const known = new Set(versions.map((v) => v.rowVersionGUID));
  const out: string[] = [];
  for (const g of guids) if (typeof g === 'string' && known.has(g) && !out.includes(g)) out.push(g);
  return out.slice(0, PM_VERSION_MAX_CHECKED);
}

const overlaysOf = (s: Pick<PMVersionStoreState, 'checkedGUIDs' | 'versions' | 'dataByVersion' | 'avoidColors'>) =>
  buildVersionOverlays(s.checkedGUIDs, s.versions, s.dataByVersion, s.avoidColors);

export const usePMVersionStore = create<PMVersionStoreState>((set, get) => ({
  projectGUID: null,
  versions: [],
  tablesMissing: false,
  checkedGUIDs: [],
  dataByVersion: {},
  overlays: [],
  avoidColors: [],
  titlePrompt: null,
  restorePickerOpen: false,
  busy: false,

  hydrateVersions: (projectGUID, rows, missing) =>
    set((st) => {
      const versions = [...rows].sort((a, b) => b.orderInList - a.orderInList);
      const known = new Set(versions.map((v) => v.rowVersionGUID));
      const dataByVersion = Object.fromEntries(Object.entries(st.dataByVersion).filter(([g]) => known.has(g)));
      const checkedGUIDs = st.projectGUID === projectGUID ? st.checkedGUIDs.filter((g) => known.has(g)) : [];
      const next = { projectGUID, versions, tablesMissing: missing, dataByVersion, checkedGUIDs };
      return { ...next, overlays: overlaysOf({ ...next, avoidColors: st.avoidColors }) };
    }),
  resetProject: (projectGUID) =>
    set((st) =>
      st.projectGUID === projectGUID
        ? {}
        : { projectGUID, versions: [], tablesMissing: false, checkedGUIDs: [], dataByVersion: {}, overlays: [], titlePrompt: null, restorePickerOpen: false }
    ),
  setChecked: (guids) =>
    set((st) => {
      const checkedGUIDs = normalizeChecked(guids, st.versions);
      if (sameList(checkedGUIDs, st.checkedGUIDs)) return {};
      return { checkedGUIDs, overlays: overlaysOf({ ...st, checkedGUIDs }) };
    }),
  setVersionData: (data) =>
    set((st) => {
      if (st.dataByVersion[data.versionGUID] === data) return {};
      const dataByVersion = { ...st.dataByVersion, [data.versionGUID]: data };
      return { dataByVersion, overlays: st.checkedGUIDs.includes(data.versionGUID) ? overlaysOf({ ...st, dataByVersion }) : st.overlays };
    }),
  setAvoidColors: (colors) => {
    if (sameList(colors, get().avoidColors)) return;
    set((st) => ({ avoidColors: colors, overlays: overlaysOf({ ...st, avoidColors: colors }) }));
  },
  setTitlePrompt: (prompt) => set({ titlePrompt: prompt }),
  setRestorePickerOpen: (open) => set({ restorePickerOpen: open }),
  setBusy: (busy) => set({ busy }),
}));

/** Non-hook access for callbacks. */
export const pmVersionStore = usePMVersionStore;
