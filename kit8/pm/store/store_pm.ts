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
import { flattenVisible, ROOT_KEY, todayUTC } from '../view/project/scheduling';
import { PM_TREE_COLUMNS_DEFAULT_ORDER } from '../view/tree/columns/treeColumns';
import { PMProjectRow, PMTaskRow, PM_DEFAULT_PROGRESS_LINE_COLOR } from '../model/types';
import { derive, EMPTY_TREE, viewSettingsOf, withoutWorkspaceMode } from './storeDerive';
import type { PMStoreState } from './storeTypes';

export type { PMCellField, PMCustomColumnPrompt, PMRowMenuState, PMTreeHeaderMenuState, PMStoreState } from './storeTypes';

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
  showTreeHierarchyNumbers: true,
  projectTreeContextCommandsMode: 'onHoverPanelMode',
  projectGanttChartContextCommandsMode: 'onHoverPanelMode',
  rowMenu: null,
  setRowMenu: (menu) => set({ rowMenu: menu }),
  treeColumnsOrder: [...PM_TREE_COLUMNS_DEFAULT_ORDER],
  treeColumnsWidths: {},
  customColumns: [],
  treeHeadersBackgroundColors: {},
  setTreeColumnsSettings: (patch) => set(patch),
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
      const next = { ...state, projectsById, projectOrder, selectedProjectGUID };
      // project settings (start date, calendar) feed the scheduler
      const sameProject = selectedProjectGUID === state.loadedProjectGUID;
      return {
        projectsById,
        projectOrder,
        selectedProjectGUID,
        ...(recentProjectGUIDs.length !== state.recentProjectGUIDs.length ? { recentProjectGUIDs } : {}),
        // ganttVsNetworkView / networkViewMode are NOT re-applied here: they are a workspace mode
        // that follows the user across projects (see selectProject); the setters update the store.
        ...(selectedProjectGUID ? withoutWorkspaceMode(viewSettingsOf(projectsById[selectedProjectGUID])) : {}),
        ...(sameProject ? derive(next, selectedProjectGUID) : {}),
      };
    }),

  selectProject: (rowGUID) =>
    set((state) =>
      rowGUID === state.selectedProjectGUID
        ? {}
        : {
            selectedProjectGUID: rowGUID,
            ...viewSettingsOf(rowGUID ? state.projectsById[rowGUID] : undefined),
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
      const visibleRows = flattenVisible(state.tree, expandedByProject[pg]);
      const rowIndexById: Record<string, number> = {};
      visibleRows.forEach((g, i) => (rowIndexById[g] = i));
      return { expandedByProject, visibleRows, rowIndexById };
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
      const visibleRows = flattenVisible(state.tree, map);
      const rowIndexById: Record<string, number> = {};
      visibleRows.forEach((g, i) => (rowIndexById[g] = i));
      return { expandedByProject, visibleRows, rowIndexById };
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
      const visibleRows = flattenVisible(state.tree, nextExpanded);
      const rowIndexById: Record<string, number> = {};
      visibleRows.forEach((g, i) => (rowIndexById[g] = i));
      return { expandedByProject, visibleRows, rowIndexById, selectedGUID: rowGUID };
    }),

  setUndoInfo: (count, label) => set({ undoCount: count, undoLabel: label }),
}));

/** Non-hook access for callbacks (gesture handlers, keyboard shortcuts). */
export const pmStore = usePMStore;
