// Types of the PM Zustand store (store_pm.ts): the state shape + UI request objects.
import type { PMTreeIndex } from '../view/project/scheduling';
import type { PMCustomColumnDef, PMCustomColumnKey, PMCustomColumnType } from '../view/tree/columns/customColumns';
import type { PMTreeColumnsFilters, PMTreeColumnSort } from '../view/tree/filter/treeColumnFilter';
import type { PMDepRef, PMTreeColumnKey, PMGanttVsNetworkView, PMLinkLineForm, PMNetworkDiagramVariant, PMNetworkScheduleVariant, PMNetworkViewMode, PMProgressLinePosition, PMProjectRow, PMContextCommandsMode, PMUxUiSettings, PMScheduledRow, PMTaskDependencyRow, PMTaskRow, PMPlanDateInputFormat } from '../model/types';

/** Tree cells that can be edited inline (click on taskStartDate / taskFinishDate / taskDuration / % / Kanban / Kanban % or on a custom column cell). */
export type PMCellField =
  | 'taskStartDate'
  | 'taskFinishDate'
  | 'taskDuration'
  | 'start'
  | 'days'
  | 'progress'
  | 'kanban'
  | 'kanbanStageProgressPercent'
  | 'startHourStart'
  | 'startHourFinish'
  | 'planMinuteStart'
  | 'planMinuteFinish'
  | 'planSecondStart'
  | 'planSecondFinish'
  | PMCustomColumnKey;


/** PMCustomColumnNameModalWindow request: add a column of `type`, or rename column `key` (current `name`). */
export interface PMCustomColumnPrompt {
  type: PMCustomColumnType;
  key?: PMCustomColumnKey;
  name?: string;
}

/** Row / bar context menu (PMTaskRowMenu) - opened in onRightClickMenuMode. */
export interface PMRowMenuState {
  guid: string;
  x: number;
  y: number;
  source: 'tree' | 'gantt';
}

/** "Filter & sort" popup of a tree column (window point of its top-left corner). */
export interface PMTreeColumnFilterPopupState {
  key: PMTreeColumnKey;
  x: number;
  y: number;
}

/** Right-click / long-press menu of the tree header (columnKey = column under the pointer). */
export interface PMTreeHeaderMenuState {
  x: number;
  y: number;
  columnKey: PMTreeColumnKey | null;
}

export interface PMStoreState {
  // ---- projects -------------------------------------------------------------------
  projectsById: Record<string, PMProjectRow>;
  projectOrder: string[];
  selectedProjectGUID: string | null;
  /** Projects shown in the ribbon (last selected ones), persisted per user - see project/recent/recentProjects.ts. */
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
  /** rowJSON.uxuiSettings.criticalPathTaskColor (user row) - color of the critical path tasks. */
  criticalPathTaskColor: string;
  /** rowJSON.uxuiSettings.criticalPathColorHasPriorityOverTheCustomTaskColor - critical path color takes priority over custom task color. */
  criticalPathColorHasPriorityOverTheCustomTaskColor: boolean;
  lastError: string | null;
  /** Dependency arrow shape (gantt/toolbars/DependencyArrowLineFormSelector) = project rowJSON.ganttArrowsForm. */
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
  /** rowJSON.uxuiSettings.showTreeHierarchyNumbers - "#" column of the tree. */
  showTreeHierarchyNumbers: boolean;
  /** rowJSON.uxuiSettings.treeColumnsOrder - tree column order (tree/columns). */
  treeColumnsOrder: PMTreeColumnKey[];
  /** rowJSON.uxuiSettings.treeColumnsWidths - resized tree columns (no "name" = Task name fills the pane). */
  treeColumnsWidths: Record<string, number>;
  /** rowJSON.customColumns.columns - custom tree columns of the selected project. */
  customColumns: PMCustomColumnDef[];
  /** rowJSON.customColumns.headersBackgroundColors - tree header background per column key. */
  treeHeadersBackgroundColors: Record<string, string>;
  /** rowJSON.uxuiSettings.treeColumnsFilters - column filters of the tree (tree/filter/treeColumnFilter.ts). */
  treeColumnsFilters: PMTreeColumnsFilters;
  /** rowJSON.uxuiSettings.treeColumnSort - sorted tree column (null = tree order). */
  treeColumnSort: PMTreeColumnSort | null;
  /** rowJSON.uxuiSettings.columnFilterIconColor - filter icon of a filtered header. */
  columnFilterIconColor: string;
  /** project.rowJSON.planDay - plan in days */
  planDay: boolean;
  /** project.rowJSON.planHour - plan in hours */
  planHour: boolean;
  /** project.rowJSON.planMinute - plan in minutes */
  planMinute: boolean;
  /** project.rowJSON.planSecond - plan in seconds */
  planSecond: boolean;
  /** project.rowJSON.planDateInputFormat - date format */
  planDateInputFormat: PMPlanDateInputFormat;
  /** Rows shown only because a descendant matches the filters (drawn muted). */
  treeFilterContextGUIDs: Record<string, true>;
  /** Rows matching every filter (null = no filter). */
  treeFilterMatchCount: number | null;
  /** "Filter & sort" popup of a tree column. */
  treeColumnFilterPopup: PMTreeColumnFilterPopupState | null;
  setTreeColumnFilterPopup: (popup: PMTreeColumnFilterPopupState | null) => void;
  /** Local switch of the tree column settings (saved by crud.setTreeColumnsOrder / setShowTreeHierarchyNumbers / setTreeColumnWidth /
   *  setTreeColumnFilter / setTreeColumnSort ...); filters / sort / custom columns re-compute the visible rows. */
  setTreeColumnsSettings: (
    patch: Partial<
      Pick<
        PMStoreState,
        'showTreeHierarchyNumbers' | 'treeColumnsOrder' | 'treeColumnsWidths' | 'customColumns' | 'treeHeadersBackgroundColors' | 'treeColumnsFilters' | 'treeColumnSort'
      >
    >
  ) => void;
  /** Expands these rows (e.g. the ancestors of the rows a new filter matches). */
  expandRows: (rowGUIDs: string[]) => void;
  /** rowJSON.uxuiSettings.projectTreeContextCommandsMode - tree row commands: hover panel or right-click menu. */
  projectTreeContextCommandsMode: PMContextCommandsMode;
  /** rowJSON.uxuiSettings.projectGanttChartContextCommandsMode - Gantt bar commands: hover panel or right-click menu. */
  projectGanttChartContextCommandsMode: PMContextCommandsMode;
  /** project_user_settings_table rows of the signed-in user: projectGUID -> rowJSON.uxuiSettings. */
  userSettingsByProject: Record<string, PMUxUiSettings>;
  /** project_user_settings_table does not exist yet (SQL upgrade not run) -> saves go to project_table.rowJSON. */
  userSettingsTableMissing: boolean;
  /** Set when the user switched from one project to another: the Gantt | Network mode then follows him. */
  keepWorkspaceMode: boolean;
  /** All rows of the user (query result); the selected project re-applies its view settings. */
  setAllProjectUserSettings: (byProject: Record<string, PMUxUiSettings>, tableMissing?: boolean) => void;
  /** One project's settings (optimistic save / realtime); re-applied when it is the selected project. */
  setProjectUserSettings: (projectGUID: string, settings: PMUxUiSettings | null) => void;
  /** "Open the Project settings window of this project" (⇅ button on the Gantt bar); consumed by the projects bar. */
  projectSettingsRequest: { guid: string; nonce: number } | null;
  openProjectSettings: (projectGUID: string | null) => void;
  /** Row / bar context menu (onRightClickMenuMode): task + window point + where it was opened. */
  rowMenu: PMRowMenuState | null;
  setRowMenu: (menu: PMRowMenuState | null) => void;
  /** Tree header context menu (Add / Delete custom column, header color, column width). */
  treeHeaderMenu: PMTreeHeaderMenuState | null;
  setTreeHeaderMenu: (menu: PMTreeHeaderMenuState | null) => void;
  /** "Column name" window (PMCustomColumnNameModalWindow): new column of `type`, or rename column `key`. */
  customColumnPrompt: PMCustomColumnPrompt | null;
  setCustomColumnPrompt: (prompt: PMCustomColumnPrompt | null) => void;
  /** "Scroll the tree horizontally until this column is visible" request (consumed by the tree). */
  treeColumnReveal: { key: PMTreeColumnKey; nonce: number } | null;
  requestTreeColumnReveal: (key: PMTreeColumnKey | null) => void;
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
  /** Timestamp when cellEdit was last closed (used to prevent mobile touch bleed-through). */
  lastCellEditClosedAt?: number;
  /** "Reveal this row" request (e.g. back from the task page): consumed by the Gantt surface. */
  focusRequest: { guid: string; nonce: number } | null;
  /** Undo stack info for the current project (the entries live in expo-sqlite). */
  undoCount: number;
  undoLabel: string | null;
  /** Rows checked with the round check boxes (first tree column, Kanban cards): multi selection of
   *  stages and tasks - moved together by drag & drop (tree <-> Kanban columns), deleted together. */
  checkedGUIDs: Record<string, true>;
  toggleChecked: (rowGUID: string) => void;
  setChecked: (rowGUIDs: string[], checked: boolean) => void;
  clearChecked: () => void;
  /** Custom period of the Gantt chart (period button before "Today"): the time line is widened to it and
   *  the chart zooms / scrolls so that the period fills the pane. Session only (not saved). */
  ganttPeriod: { startMs: number; finishMs: number; nonce: number } | null;
  setGanttPeriod: (period: { startMs: number; finishMs: number } | null) => void;
  /** "Custom period" window of the Gantt bar is open */
  ganttPeriodOpen: boolean;
  setGanttPeriodOpen: (open: boolean) => void;
  /** Re-applies the tree filters / sort (the Kanban column of the tree reads store_kanban, which changed). */
  refreshTreeRows: () => void;

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
