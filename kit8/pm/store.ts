// Zustand store = the normalized, render-ready view of ONE selected project.
//
//   React Query (queries.ts)  -> server truth, caching, optimistic updates, realtime
//        | hydrate()
//   Zustand (this file)       -> normalized tree + schedule + visible row order + UI state
//        | selectors
//   Skia tree + Skia chart    -> both read the SAME visibleRows array, so row i of the
//                                tree and bar i of the chart can never disagree.

import { create } from 'zustand';
import { PM_DAY_WIDTH_DEFAULT, PM_DAY_WIDTH_MAX, PM_DAY_WIDTH_MIN, PM_TREE_DEFAULT_WIDTH, PM_TREE_MAX_WIDTH, PM_TREE_MIN_WIDTH } from './constants';
import { buildTreeIndex, computeProjectProgress, flattenVisible, PMTreeIndex, ROOT_KEY, scheduleProject, todayUTC } from './scheduling';
import { PMDepRef, PMGanttVsNetworkView, PMLinkLineForm, PMNetworkDiagramVariant, PMNetworkScheduleVariant, PMNetworkViewMode, PMProgressLinePosition, PMProjectRow, uxuiSettingsOf, PM_DEFAULT_PROGRESS_LINE_COLOR, PMScheduledRow, PMTaskDependencyRow, PMTaskRow } from './types';

/** Tree cells that can be edited inline (click on Start / Days / %). */
export type PMCellField = 'start' | 'days' | 'progress';

const EMPTY_TREE: PMTreeIndex = { parentById: {}, childrenById: { [ROOT_KEY]: [] }, depthById: {} };

export interface PMStoreState {
  // ---- projects -------------------------------------------------------------------
  projectsById: Record<string, PMProjectRow>;
  projectOrder: string[];
  selectedProjectGUID: string | null;
  /** Projects shown in the ribbon (last selected ones), persisted per user - see recentProjects.ts. */
  recentProjectGUIDs: string[];

  // ---- selected project (normalized) ---------------------------------------------
  loadedProjectGUID: string | null;
  tasks: PMTaskRow[];
  tasksById: Record<string, PMTaskRow>;
  deps: PMTaskDependencyRow[];
  tree: PMTreeIndex;
  schedule: Record<string, PMScheduledRow>;
  projectStartMs: number;
  projectFinishMs: number;
  /** Live project progress (computeProjectProgress = SQL pm_recalc_project_progress formula). */
  projectProgress: number;
  cycleGUIDs: string[];
  visibleRows: string[];
  rowIndexById: Record<string, number>;
  expandedByProject: Record<string, Record<string, boolean>>;

  // ---- UI ---------------------------------------------------------------------------
  hoveredGUID: string | null;
  selectedGUID: string | null;
  linkSourceGUID: string | null; // tap-to-link mode (touch devices / hover panel)
  editingGUID: string | null; // row shown in PMTaskEditModal
  dayWidth: number;
  treeWidth: number;
  showCriticalPath: boolean;
  lastError: string | null;
  /** Dependency arrow shape (toolbars/gantt/DependencyArrowLineFormSelector) = project rowJSON.ganttArrowsForm. */
  linkLineForm: PMLinkLineForm;
  /** Progress line + "XX%" on task bars = project rowJSON.uxuiSettings.showTaskProgressOnGantt. */
  showTaskProgressOnGantt: boolean;
  /** rowJSON.uxuiSettings.taskProgressLinePosition / projectProgressLinePosition */
  taskProgressLinePosition: PMProgressLinePosition;
  projectProgressLinePosition: PMProgressLinePosition;
  /** rowJSON.uxuiSettings.taskProgressLineColor / projectProgressLineColor */
  taskProgressLineColor: string;
  projectProgressLineColor: string;
  /** rowJSON.uxuiSettings.ganttVsNetworkView - Gantt chart or PMNetworkView. */
  ganttVsNetworkView: PMGanttVsNetworkView;
  /** rowJSON.uxuiSettings.networkViewMode / networkDiagramVariant / networkScheduleVariant */
  networkViewMode: PMNetworkViewMode;
  networkDiagramVariant: PMNetworkDiagramVariant;
  networkScheduleVariant: PMNetworkScheduleVariant;
  /** Local (not saved) switch of the network view settings - used by read-only views. */
  setNetworkViewSettings: (patch: Partial<Pick<PMStoreState, 'ganttVsNetworkView' | 'networkViewMode' | 'networkDiagramVariant' | 'networkScheduleVariant'>>) => void;
  /** PMGanttUXUISettinsModalWindow visible */
  uxuiSettingsOpen: boolean;
  setUxuiSettingsOpen: (open: boolean) => void;
  /** Right-click / tap menu on a dependency arrow (window coordinates). */
  depMenu: (PMDepRef & { x: number; y: number }) | null;
  /** Dependency shown in PMEditDependencyScreen. */
  editingDep: PMDepRef | null;
  /** Inline tree cell editor (Start / Days / %). */
  cellEdit: { guid: string; field: PMCellField } | null;
  /** "Reveal this row" request (e.g. back from the task page): consumed by the Gantt surface. */
  focusRequest: { guid: string; nonce: number } | null;
  /** Undo stack info for the current project (the entries live in expo-sqlite). */
  undoCount: number;
  undoLabel: string | null;

  // ---- actions ----------------------------------------------------------------------
  setProjects: (projects: PMProjectRow[]) => void;
  selectProject: (rowGUID: string | null) => void;
  hydrate: (projectGUID: string, tasks: PMTaskRow[], deps: PMTaskDependencyRow[]) => void;
  toggleExpanded: (rowGUID: string) => void;
  setAllExpanded: (expanded: boolean) => void;
  setHovered: (rowGUID: string | null) => void;
  setSelected: (rowGUID: string | null) => void;
  setLinkSource: (rowGUID: string | null) => void;
  setEditing: (rowGUID: string | null) => void;
  setDayWidth: (px: number) => void;
  setTreeWidth: (px: number) => void;
  toggleCriticalPath: () => void;
  setError: (message: string | null) => void;
  setRecentProjects: (guids: string[]) => void;
  addRecentProject: (rowGUID: string) => void;
  removeRecentProject: (rowGUID: string) => void;
  setLinkLineForm: (form: PMLinkLineForm) => void;
  setDepMenu: (menu: (PMDepRef & { x: number; y: number }) | null) => void;
  setEditingDep: (ref: PMDepRef | null) => void;
  setCellEdit: (edit: { guid: string; field: PMCellField } | null) => void;
  /** Ask the Gantt to expand the row's parents, select it and scroll it into view. */
  requestFocus: (rowGUID: string | null) => void;
  /** Expands all ancestors of the row and selects it (no scrolling). */
  revealRow: (rowGUID: string) => void;
  setUndoInfo: (count: number, label: string | null) => void;
}

/**
 * Gantt view settings live in project_table.rowJSON (showCriticalPath, ganttArrowsForm,
 * showTaskProgressOnGantt); the store mirrors the selected project's values.
 */
function viewSettingsOf(project: PMProjectRow | undefined) {
  const u = uxuiSettingsOf(project?.rowJSON);
  return {
    showCriticalPath: u.showCriticalPath,
    linkLineForm: u.ganttArrowsForm as PMLinkLineForm,
    showTaskProgressOnGantt: u.showTaskProgressOnGantt,
    taskProgressLinePosition: u.taskProgressLinePosition,
    projectProgressLinePosition: u.projectProgressLinePosition,
    taskProgressLineColor: u.taskProgressLineColor,
    projectProgressLineColor: u.projectProgressLineColor,
    ganttVsNetworkView: u.ganttVsNetworkView,
    networkViewMode: u.networkViewMode,
    networkDiagramVariant: u.networkDiagramVariant,
    networkScheduleVariant: u.networkScheduleVariant,
  };
}

function derive(
  s: Pick<PMStoreState, 'tasks' | 'deps' | 'projectsById' | 'expandedByProject'>,
  projectGUID: string | null
) {
  const project = projectGUID ? s.projectsById[projectGUID] : undefined;
  const startIso = project?.rowJSON?.projectStartAt;
  const parsed = startIso ? Date.parse(startIso) : NaN;
  const projectStart = Number.isFinite(parsed) ? parsed : project?.created_at ? Date.parse(project.created_at) : todayUTC();

  const tree = s.tasks.length ? buildTreeIndex(s.tasks) : EMPTY_TREE;
  const result = scheduleProject({
    tasks: s.tasks,
    deps: s.deps,
    projectStartMs: projectStart,
    calendar: { skipWeekends: !!project?.rowJSON?.skipWeekends },
  });
  const expanded = (projectGUID && s.expandedByProject[projectGUID]) || {};
  const visibleRows = flattenVisible(tree, expanded);
  const rowIndexById: Record<string, number> = {};
  visibleRows.forEach((g, i) => (rowIndexById[g] = i));
  return {
    tree,
    schedule: result.rows,
    projectStartMs: result.projectStartMs,
    projectFinishMs: result.projectFinishMs,
    projectProgress: computeProjectProgress(result.rows),
    cycleGUIDs: result.cycleGUIDs,
    visibleRows,
    rowIndexById,
  };
}

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
      // no auto-select here: recentProjects.ts restores the last selected project per user
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
        ...(selectedProjectGUID ? viewSettingsOf(projectsById[selectedProjectGUID]) : {}),
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
            editingDep: null,
            cellEdit: null,
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
