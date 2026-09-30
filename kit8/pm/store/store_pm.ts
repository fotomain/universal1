// Zustand store = the normalized, render-ready view of ONE selected project.
//
//   React Query (queries.ts)  -> server truth, caching, optimistic updates, realtime
//        | hydrate()
//   Zustand (store_pm.ts)       -> normalized tree + schedule + visible row order + UI state
//        | selectors
//   Skia tree + Skia chart    -> both read the SAME visibleRows array, so row i of the
//                                tree and bar i of the chart can never disagree.
//
// Split:  storeTypes.ts (state shape) · storeDerive.ts (pure derive / view settings) · store_pm.ts (the store)

import { create } from 'zustand';
import { PM_DAY_WIDTH_DEFAULT, PM_DAY_WIDTH_MAX, PM_DAY_WIDTH_MIN, PM_TREE_DEFAULT_WIDTH, PM_TREE_MAX_WIDTH, PM_TREE_MIN_WIDTH } from '../model/constants';
import { ROOT_KEY, todayUTC } from '../view/project/scheduling';
import { PM_DEFAULT_COLUMN_FILTER_ICON_COLOR } from '../view/tree/filter/treeColumnFilter';
import { PM_TREE_COLUMNS_DEFAULT_ORDER } from '../view/tree/columns/treeColumns';
import { PMProjectRow, PMTaskRow, PM_DEFAULT_CRITICAL_PATH_TASK_COLOR, PM_DEFAULT_PROGRESS_LINE_COLOR } from '../model/types';
import { derive, EMPTY_TREE, treeRowsOf, viewSettingsOf, withoutWorkspaceMode } from './storeDerive';
import type { PMStoreState } from './storeTypes';

export type { PMCellField, PMCustomColumnPrompt, PMRowMenuState, PMTreeColumnFilterPopupState, PMTreeHeaderMenuState, PMStoreState } from './storeTypes';

/** Visible rows of the selected project for `state` (tree filters / sort applied) - {} before the project is loaded. */
const rowsOf = (state: PMStoreState, expanded?: Record<string, boolean>) => {
  const pg = state.selectedProjectGUID;
  if (!pg || state.loadedProjectGUID !== pg) return {};
  return treeRowsOf(state, expanded ?? state.expandedByProject[pg] ?? {});
};

export const usePMStore = create<PMStoreState>((set, get) => ({
  projectsById: {},
  projectOrder: [],
  selectedProjectGUID: null,
  recentProjectGUIDs: [],

  loadedProjectGUID: null,
  tasks: [],
  tasksById: {},
  deps: [],
  tree: EMPTY_TREE,
  schedule: {},
  projectStartMs: todayUTC(),
  projectFinishMs: todayUTC(),
  projectProgress: 0,
  cycleGUIDs: [],
  visibleRows: [],
  rowIndexById: {},
  expandedByProject: {},

  hoveredGUID: null,
  selectedGUID: null,
  linkSourceGUID: null,
  editingGUID: null,
  dayWidth: PM_DAY_WIDTH_DEFAULT,
  treeWidth: PM_TREE_DEFAULT_WIDTH,
  showCriticalPath: true,
  criticalPathTaskColor: PM_DEFAULT_CRITICAL_PATH_TASK_COLOR,
  lastError: null,
  linkLineForm: 'smoothForm',
  showTaskProgressOnGantt: false,
  taskProgressLinePosition: 'onTop',
  projectProgressLinePosition: 'onBottom',
  taskProgressLineColor: PM_DEFAULT_PROGRESS_LINE_COLOR,
  projectProgressLineColor: PM_DEFAULT_PROGRESS_LINE_COLOR,
  ganttVsNetworkView: 'showGanttChart',
  networkViewMode: 'networkDiagram',
  networkDiagramVariant: 'cpmNodes',
  networkScheduleVariant: 'eventCircles',
  setNetworkViewSettings: (patch) => set(patch),
  userSettingsByProject: {},
  userSettingsTableMissing: false,
  keepWorkspaceMode: false,
  setAllProjectUserSettings: (byProject, tableMissing = false) =>
    set((state) => {
      const g = state.selectedProjectGUID;
      const v = g ? viewSettingsOf(state.projectsById[g], byProject[g]) : null;
      const applied = v ? (state.keepWorkspaceMode ? withoutWorkspaceMode(v) : v) : {};
      return {
        userSettingsByProject: byProject,
        userSettingsTableMissing: tableMissing,
        // the selected project's rows arrive after selectProject: apply them (the Gantt | Network mode
        // only for the first project of the session - later it follows the user, see selectProject)
        ...applied,
        ...(v ? rowsOf({ ...state, ...applied }) : {}),
      };
    }),
  setProjectUserSettings: (projectGUID, settings) =>
    set((state) => {
      const userSettingsByProject = { ...state.userSettingsByProject };
      if (settings) userSettingsByProject[projectGUID] = settings;
      else delete userSettingsByProject[projectGUID];
      const v = projectGUID === state.selectedProjectGUID ? viewSettingsOf(state.projectsById[projectGUID], settings) : null;
      const applied = v ? withoutWorkspaceMode(v) : {};
      return { userSettingsByProject, ...applied, ...(v ? rowsOf({ ...state, ...applied }) : {}) };
    }),
  showTreeHierarchyNumbers: true,
  projectTreeContextCommandsMode: 'onHoverPanelMode',
  projectGanttChartContextCommandsMode: 'onHoverPanelMode',
  rowMenu: null,
  setRowMenu: (menu) => set({ rowMenu: menu }),
  projectSettingsRequest: null,
  openProjectSettings: (projectGUID) =>
    set((s) => ({ projectSettingsRequest: projectGUID ? { guid: projectGUID, nonce: (s.projectSettingsRequest?.nonce ?? 0) + 1 } : null })),
  treeColumnsOrder: [...PM_TREE_COLUMNS_DEFAULT_ORDER],
  treeColumnsWidths: {},
  customColumns: [],
  treeHeadersBackgroundColors: {},
  treeColumnsFilters: {},
  treeColumnSort: null,
  columnFilterIconColor: PM_DEFAULT_COLUMN_FILTER_ICON_COLOR,
  planDay: true,
  planHour: false,
  planMinute: false,
  planSecond: false,
  planDateInputFormat: 'YYYY-MM-DD',
  treeFilterContextGUIDs: {},
  treeFilterMatchCount: null,
  treeColumnFilterPopup: null,
  setTreeColumnFilterPopup: (popup) => set({ treeColumnFilterPopup: popup, treeHeaderMenu: null }),
  setTreeColumnsSettings: (patch) =>
    set((state) =>
      'treeColumnsFilters' in patch || 'treeColumnSort' in patch || 'customColumns' in patch ? { ...patch, ...rowsOf({ ...state, ...patch }) } : patch
    ),
  expandRows: (rowGUIDs) =>
    set((state) => {
      const pg = state.selectedProjectGUID;
      if (!pg || !rowGUIDs.length) return {};
      const cur = state.expandedByProject[pg] || {};
      const next = { ...cur };
      for (const g of rowGUIDs) next[g] = true;
      const expandedByProject = { ...state.expandedByProject, [pg]: next };
      return { expandedByProject, ...rowsOf(state, next) };
    }),
  treeHeaderMenu: null,
  setTreeHeaderMenu: (menu) => set({ treeHeaderMenu: menu }),
  customColumnPrompt: null,
  setCustomColumnPrompt: (prompt) => set({ customColumnPrompt: prompt, treeHeaderMenu: null }),
  treeColumnReveal: null,
  requestTreeColumnReveal: (key) => set((s) => ({ treeColumnReveal: key ? { key, nonce: (s.treeColumnReveal?.nonce ?? 0) + 1 } : null })),
  uxuiSettingsOpen: false,
  setUxuiSettingsOpen: (open) => set({ uxuiSettingsOpen: open }),
  depMenu: null,
  editingDep: null,
  cellEdit: null,
  focusRequest: null,
  undoCount: 0,
  undoLabel: null,

  setProjects: (projects) =>
    set((state) => {
      const projectsById: Record<string, PMProjectRow> = {};
      for (const p of projects) projectsById[p.rowGUID] = p;
      const projectOrder = [...projects].sort((a, b) => a.orderInList - b.orderInList).map((p) => p.rowGUID);
      // no auto-select here: project/recent/recentProjects.ts restores the last selected project per user
      const selectedProjectGUID =
        state.selectedProjectGUID && projectsById[state.selectedProjectGUID] ? state.selectedProjectGUID : null;
      const recentProjectGUIDs = state.recentProjectGUIDs.filter((g) => !!projectsById[g]);
      // ganttVsNetworkView / networkViewMode are NOT re-applied here: they are a workspace mode
      // that follows the user across projects (see selectProject); the setters update the store.
      const view = selectedProjectGUID ? withoutWorkspaceMode(viewSettingsOf(projectsById[selectedProjectGUID], state.userSettingsByProject[selectedProjectGUID])) : {};
      const next = { ...state, projectsById, projectOrder, selectedProjectGUID, ...view };
      // project settings (start date, calendar) feed the scheduler
      const sameProject = selectedProjectGUID === state.loadedProjectGUID;
      return {
        projectsById,
        projectOrder,
        selectedProjectGUID,
        ...(recentProjectGUIDs.length !== state.recentProjectGUIDs.length ? { recentProjectGUIDs } : {}),
        ...view,
        ...(sameProject ? derive(next, selectedProjectGUID) : {}),
      };
    }),

  selectProject: (rowGUID) =>
    set((state) =>
      rowGUID === state.selectedProjectGUID
        ? {}
        : {
            selectedProjectGUID: rowGUID,
            keepWorkspaceMode: !!(rowGUID && state.selectedProjectGUID) || (state.keepWorkspaceMode && !!rowGUID),
            ...viewSettingsOf(rowGUID ? state.projectsById[rowGUID] : undefined, rowGUID ? state.userSettingsByProject[rowGUID] : undefined),
            // Project 1 in PMNetworkView -> switch to Project N: stay in PMNetworkView (same mode).
            // The first project opened in a session uses its own saved setting.
            ...(rowGUID && state.selectedProjectGUID
              ? { ganttVsNetworkView: state.ganttVsNetworkView, networkViewMode: state.networkViewMode }
              : {}),
            loadedProjectGUID: null,
            tasks: [],
            tasksById: {},
            deps: [],
            tree: EMPTY_TREE,
            schedule: {},
            visibleRows: [],
            rowIndexById: {},
            cycleGUIDs: [],
            hoveredGUID: null,
            selectedGUID: null,
            linkSourceGUID: null,
            editingGUID: null,
            depMenu: null,
            rowMenu: null,
            editingDep: null,
            cellEdit: null,
            treeHeaderMenu: null,
            customColumnPrompt: null,
            treeColumnFilterPopup: null,
            treeFilterContextGUIDs: {},
            treeFilterMatchCount: null,
            undoCount: 0,
            undoLabel: null,
            recentProjectGUIDs:
              rowGUID && !state.recentProjectGUIDs.includes(rowGUID) ? [...state.recentProjectGUIDs, rowGUID] : state.recentProjectGUIDs,
          }
    ),

  hydrate: (projectGUID, tasks, deps) =>
    set((state) => {
      if (projectGUID !== state.selectedProjectGUID) return {};
      const tasksById: Record<string, PMTaskRow> = {};
      for (const t of tasks) tasksById[t.rowGUID] = t;
      const next = { ...state, tasks, deps };
      return {
        loadedProjectGUID: projectGUID,
        tasks,
        deps,
        tasksById,
        selectedGUID: state.selectedGUID && tasksById[state.selectedGUID] ? state.selectedGUID : null,
        hoveredGUID: state.hoveredGUID && tasksById[state.hoveredGUID] ? state.hoveredGUID : null,
        ...derive(next, projectGUID),
      };
    }),

  toggleExpanded: (rowGUID) =>
    set((state) => {
      const pg = state.selectedProjectGUID;
      if (!pg) return {};
      const cur = state.expandedByProject[pg] || {};
      const expandedByProject = { ...state.expandedByProject, [pg]: { ...cur, [rowGUID]: cur[rowGUID] === false } };
      return { expandedByProject, ...treeRowsOf(state, expandedByProject[pg]) };
    }),

  setAllExpanded: (expanded) =>
    set((state) => {
      const pg = state.selectedProjectGUID;
      if (!pg) return {};
      const map: Record<string, boolean> = {};
      for (const [guid, kids] of Object.entries(state.tree.childrenById)) {
        if (guid !== ROOT_KEY && kids.length) map[guid] = expanded;
      }
      const expandedByProject = { ...state.expandedByProject, [pg]: map };
      return { expandedByProject, ...treeRowsOf(state, map) };
    }),

  setHovered: (rowGUID) => {
    if (get().hoveredGUID !== rowGUID) set({ hoveredGUID: rowGUID });
  },
  setSelected: (rowGUID) => {
    if (get().selectedGUID !== rowGUID) set({ selectedGUID: rowGUID });
  },
  setLinkSource: (rowGUID) => set({ linkSourceGUID: rowGUID }),
  setEditing: (rowGUID) => set({ editingGUID: rowGUID }),
  setDayWidth: (px) => set({ dayWidth: Math.max(PM_DAY_WIDTH_MIN, Math.min(PM_DAY_WIDTH_MAX, px)) }),
  setTreeWidth: (px) => set({ treeWidth: Math.max(PM_TREE_MIN_WIDTH, Math.min(PM_TREE_MAX_WIDTH, px)) }),
  toggleCriticalPath: () => set((s) => ({ showCriticalPath: !s.showCriticalPath })),
  setError: (message) => set({ lastError: message }),

  setRecentProjects: (guids) => set({ recentProjectGUIDs: Array.from(new Set(guids)) }),
  addRecentProject: (rowGUID) =>
    set((s) => (s.recentProjectGUIDs.includes(rowGUID) ? {} : { recentProjectGUIDs: [...s.recentProjectGUIDs, rowGUID] })),
  removeRecentProject: (rowGUID) => set((s) => ({ recentProjectGUIDs: s.recentProjectGUIDs.filter((g) => g !== rowGUID) })),

  setLinkLineForm: (form) => set({ linkLineForm: form }),
  setDepMenu: (menu) => set({ depMenu: menu }),
  setEditingDep: (ref) => set({ editingDep: ref, depMenu: null }),
  setCellEdit: (edit) => set({ cellEdit: edit }),

  requestFocus: (rowGUID) => set((s) => ({ focusRequest: rowGUID ? { guid: rowGUID, nonce: (s.focusRequest?.nonce ?? 0) + 1 } : null })),

  revealRow: (rowGUID) =>
    set((state) => {
      const pg = state.selectedProjectGUID;
      if (!pg || !state.tasksById[rowGUID]) return {};
      const cur = state.expandedByProject[pg] || {};
      let changed = false;
      const nextExpanded = { ...cur };
      for (let p = state.tree.parentById[rowGUID]; p; p = state.tree.parentById[p]) {
        if (nextExpanded[p] === false) {
          nextExpanded[p] = true;
          changed = true;
        }
      }
      if (!changed) return { selectedGUID: rowGUID };
      const expandedByProject = { ...state.expandedByProject, [pg]: nextExpanded };
      return { expandedByProject, ...treeRowsOf(state, nextExpanded), selectedGUID: rowGUID };
    }),

  setUndoInfo: (count, label) => set({ undoCount: count, undoLabel: label }),
}));

/** Non-hook access for callbacks (gesture handlers, keyboard shortcuts). */
export const pmStore = usePMStore;
