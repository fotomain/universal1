// PM Gantt module types, mirroring kit8/sql/init/create_pm_tables.sql.

export {
  projectTable,
  projectTaskTable,
  projectTaskDependenciesTable,
  projectTaskDependencyClosureTable,
  projectUserSettingsTable,
  templatesProjectTable,
  templatesProjectTaskTable,
  templatesProjectTaskDependenciesTable,
  templatesProjectTaskDependencyClosureTable,
  templatesProjectKanbanStageTable,
  templatesProjectUserSettingsTable,
} from './constants';

export type { PMPlanDateInputFormat, PMPlanUnits } from './planDateFormats';
export {
  PM_PLAN_DATE_INPUT_FORMATS,
  PM_DEFAULT_PLAN_DATE_INPUT_FORMAT,
  formatPlanDate,
  parsePlanDate,
  formatPlanDuration,
  parsePlanDuration,
} from './planDateFormats';
import type { PMPlanDateInputFormat } from './planDateFormats';

/** project = row of project_table; stage = summary row; task = leaf; milestone = 0-day leaf. */
export type PMRowKind = 'project' | 'stage' | 'task' | 'milestone';

/**
 * Dependency (link) types, same semantics as MS Project / DHTMLX:
 *  FS finish-to-start (default), SS start-to-start, FF finish-to-finish, SF start-to-finish.
 */
export type PMLinkType = 'FS' | 'SS' | 'FF' | 'SF';

/** Free-form per-row payload kept in rowJSON. */
export interface PMRowJSON {
  rowKind: PMRowKind;
  name: string;
  /** Bar color chosen in the task editor (null/undefined = automatic). */
  taskColor?: string | null;
  /** @deprecated legacy key, read as a fallback for taskColor (see taskColorOf). */
  color?: string | null;
  /** Editable input: working days (0 = milestone). Ignored for summary rows (rolled up). */
  durationDays: number;
  /** "Start no earlier than" constraint (ISO timestamptz, UTC midnight). null = ASAP. */
  manualStartAt?: string | null;
  /** Computed by the scheduler and written back (ISO timestamptz). Finish lives in rowDuration. */
  startAt?: string | null;
  notes?: string;
  // ---- task planning units fields ----
  /** Start hour when planHour is enabled. */
  startHourStart?: number | string | null;
  /** Finish hour when planHour is enabled. */
  startHourFinish?: number | string | null;
  /** Start minute when planMinute is enabled. */
  planMinuteStart?: number | string | null;
  /** Finish minute when planMinute is enabled. */
  planMinuteFinish?: number | string | null;
  /** Start second when planSecond is enabled. */
  planSecondStart?: number | string | null;
  /** Finish second when planSecond is enabled. */
  planSecondFinish?: number | string | null;
  /**
   * Custom tree columns (tree/columns/customColumns.ts):
   *  project_table:      definitions + header colors  { columns: [{ key, name, type }], headersBackgroundColors: { [key]: color } }
   *  project_task_table: values of this task          { [columnKey]: string | number | boolean | null }
   * Read with projectCustomColumnsOf() / taskCustomValuesOf().
   */
  customColumns?: PMProjectCustomColumns | PMTaskCustomColumnValues;
  // ---- project_table only ----
  /** Project start (ISO timestamptz, UTC midnight). */
  projectStartAt?: string;
  /** true = durations count Mon-Fri only. */
  skipWeekends?: boolean;
  /** Planning units: plan in days (default true). */
  planDay?: boolean;
  /** Planning units: plan in hours. */
  planHour?: boolean;
  /** Planning units: plan in minutes. */
  planMinute?: boolean;
  /** Planning units: plan in seconds. */
  planSecond?: boolean;
  /** Date input format for start/finish date columns in TaskTree (e.g. DD MMM, DD.MM.YYYY, YYYY-MM-DD). */
  planDateInputFormat?: PMPlanDateInputFormat;
  // ---- project_table only: Partners & Contracts ----
  /** Selected main supplier partner rowGUID (partnerTable) */
  mainSupplierGUID?: string | null;
  /** Selected main supplier contract rowGUID (contractTable) */
  mainSupplierContractGUID?: string | null;
  /** Selected main customer partner rowGUID (partnerTable) */
  mainCustomerGUID?: string | null;
  /** Selected main customer contract rowGUID (contractTable) */
  mainCustomerContractGUID?: string | null;
  // ---- project_table only: Gantt UX/UI settings (saved per project) ----
  uxuiSettings?: PMUxUiSettings;
  /** @deprecated moved to uxuiSettings (still read as a fallback) */
  showCriticalPath?: boolean;
  /** @deprecated moved to uxuiSettings (still read as a fallback) */
  ganttArrowsForm?: PMLinkLineForm;
  /** @deprecated moved to uxuiSettings (still read as a fallback) */
  showTaskProgressOnGantt?: boolean;
}

/**
 * rowDuration (timestamptz) = the END of the row's duration, i.e. the exclusive finish
 * instant. duration = rowDuration - rowJSON.startAt. Both are written back by the
 * scheduler so SQL (reports, the project_task_schedule_view) can query real dates.
 */
/**
 * Row of project_user_settings_table (kit8/sql/defTable.md pattern): the settings ONE user chose for ONE project.
 *   rowOwnerGUID = project_table.rowGUID · rowParentGUID = the user (Supabase auth uid)
 */
export interface PMProjectUserSettingsRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: PMProjectUserSettingsJSON;
  created_at?: string;
  updated_at?: string;
}

/** project_user_settings_table.rowJSON - user specified data for visualisations. */
export interface PMProjectUserSettingsJSON {
  uxuiSettings?: PMUxUiSettings;
}

export interface PMProjectRow {
  rowGUID: string;
  treePath: string;
  rowOwnerGUID: string;
  rowDuration: string | null;
  rowProgress: number;
  orderInList: number;
  rowJSON: PMRowJSON;
  created_at?: string;
  updated_at?: string;
}

export interface PMTaskRow {
  rowGUID: string;
  /** ltree: <projectLabel>.<stageLabel>.<taskLabel> - labels are GUIDs with '-' -> '_'. */
  treePath: string;
  projectGUID: string;
  rowOwnerGUID: string;
  rowDuration: string | null;
  rowProgress: number;
  orderInList: number;
  rowJSON: PMRowJSON;
  created_at?: string;
  updated_at?: string;
}

export interface PMTaskDependencyRow {
  rowGUID: string; // the blocked (downstream / successor) task
  rowDependsOnGUID: string; // the blocker (upstream / predecessor) task
  projectGUID: string;
  rowOwnerGUID: string;
  linkType: PMLinkType;
  /** Lag (positive) or lead (negative) in working days. */
  lagDays: number;
  /** Free-form payload (dependencyColor, notes, ...). */
  rowJSON?: PMDependencyJSON;
  created_at?: string;
}

/** rowJSON of project_task_dependencies_table. */
export interface PMDependencyJSON {
  /** Arrow color (null/undefined = automatic: normal / critical / highlighted). */
  dependencyColor?: string | null;
  notes?: string;
  [key: string]: unknown;
}

export interface PMTaskDependencyClosureRow {
  ancestorGUID: string;
  descendantGUID: string;
  projectGUID: string;
  depthLevel: number;
  /** Written by the DB triggers (currently always {}). */
  rowJSON?: Record<string, unknown>;
}

/** Identifies one dependency (edge) = composite primary key of the edge table. */
export interface PMDepRef {
  /** successor (the task that waits) */
  rowGUID: string;
  /** predecessor (the blocker) */
  dependsOnGUID: string;
}

import { PMProgressLinePosition, progressLineColorOf } from '../view/task/progress/line/progressLineConstants';
import { criticalPathTaskColorOf } from './criticalPathColors';
export { PM_CRITICAL_PATH_TASK_COLORS, PM_DEFAULT_CRITICAL_PATH_TASK_COLOR, criticalPathTaskColorOf } from './criticalPathColors';
import { normalizeTreeColumnsOrder, normalizeTreeColumnsWidths, PMTreeColumnKey } from '../view/tree/columns/treeColumns';
import { projectCustomColumnsOf, PMProjectCustomColumns, PMTaskCustomColumnValues } from '../view/tree/columns/customColumns';
import {
  columnFilterIconColorOf,
  normalizeTreeColumnsFilters,
  normalizeTreeColumnSort,
  PMTreeColumnsFilters,
  PMTreeColumnSort,
} from '../view/tree/filter/treeColumnFilter';
export type { PMFilterVariantForColumn, PMTreeColumnFilter, PMTreeColumnsFilters, PMTreeColumnSort } from '../view/tree/filter/treeColumnFilter';
export type { PMTreeColumnKey } from '../view/tree/columns/treeColumns';
export type { PMCustomColumnDef, PMCustomColumnKey, PMCustomColumnType, PMCustomColumnValue, PMProjectCustomColumns, PMTaskCustomColumnValues } from '../view/tree/columns/customColumns';
// progress line types / constants live in kit8/pm/view/task/progress/line (re-exported for older imports)
export type { PMProgressLinePosition } from '../view/task/progress/line/progressLineConstants';
export { PM_DEFAULT_PROGRESS_LINE_COLOR, PM_PROGRESS_LINE_POSITIONS } from '../view/task/progress/line/progressLineConstants';

/** project_table.rowJSON.uxuiSettings - how the Gantt of this project looks. */
export interface PMUxUiSettings {
  /** Critical path highlighting on/off (default true). */
  showCriticalPath?: boolean;
  /** Color of the critical path tasks (bars, arrows, network nodes): one of PM_CRITICAL_PATH_TASK_COLORS (default #FF0033). */
  criticalPathTaskColor?: string;
  /** Critical path color overrides custom task color on critical tasks (default false). */
  criticalPathColorHasPriorityOverTheCustomTaskColor?: boolean;
  /** Dependency arrow shape (default 'smoothForm'). */
  ganttArrowsForm?: PMLinkLineForm;
  /** Progress line + "XX%" on task bars and the project progress line (default false). */
  showTaskProgressOnGantt?: boolean;
  /** Task bar progress line: top edge / bottom edge / middle under the task text (default 'onTop'). */
  taskProgressLinePosition?: PMProgressLinePosition;
  /** Project progress line in the time-scale header: top / bottom / middle under the labels (default 'onBottom'). */
  projectProgressLinePosition?: PMProgressLinePosition;
  /** Color of the task bar progress lines (default PM_DEFAULT_PROGRESS_LINE_COLOR). */
  taskProgressLineColor?: string;
  /** Color of the project progress line (default PM_DEFAULT_PROGRESS_LINE_COLOR). */
  projectProgressLineColor?: string;
  /** Main view switch: Gantt chart, Kanban board or network view (default 'showGanttChart'). */
  ganttVsNetworkView?: PMGanttVsNetworkView;
  /** PMNetworkView radio: network diagram (AON) or network schedule (AOA) (default 'networkDiagram'). */
  networkViewMode?: PMNetworkViewMode;
  /** PMNetworkDiagram variant (default 'cpmNodes'). */
  networkDiagramVariant?: PMNetworkDiagramVariant;
  /** PMNetworkSchedule variant (default 'eventCircles'). */
  networkScheduleVariant?: PMNetworkScheduleVariant;
  /** Tree: "#" column = hierarchy / outline number 1.2.3 (default true). */
  showTreeHierarchyNumbers?: boolean;
  /** Tree: column order, changed by dragging the column headers (default "#" first - see tree/columns). */
  treeColumnsOrder?: PMTreeColumnKey[];
  /** Tree: widths of resized columns (drag a header separator), e.g. { name: 260 }. No Task name width = it fills the pane. */
  treeColumnsWidths?: Record<string, number>;
  /** Tree: row commands in a hover panel (default) or in a right-click / long-press menu. */
  projectTreeContextCommandsMode?: PMContextCommandsMode;
  /** Gantt chart: bar commands in a hover panel (default) or in a right-click / long-press menu. */
  projectGanttChartContextCommandsMode?: PMContextCommandsMode;
  /** Tree: column filters { [columnKey]: { filterVariantForColumn, value, value2 } } - all AND-ed (tree/filter). */
  treeColumnsFilters?: PMTreeColumnsFilters;
  /** Tree: sorted column (siblings sorted inside every parent), null = tree order. */
  treeColumnSort?: PMTreeColumnSort | null;
  /** Tree: color of the filter icon on a filtered column header (default light vibrant red #FF4D6D). */
  columnFilterIconColor?: string;
  /** Versions checked for the visual comparison on the Gantt (version_project_table.rowVersionGUID, see kit8/pm/version). */
  checkedProjectVersions?: string[];
}

/**
 * Where the row / bar commands (add, edit, duplicate, copy, share, link, details, delete) live:
 *  onHoverPanelMode     = floating panel on the hovered row (web) / selected row (touch)
 *  onRightClickMenuMode = context menu: right-click (web) / long-press and release (touch); no panel
 */
export type PMContextCommandsMode = 'onHoverPanelMode' | 'onRightClickMenuMode';
export const PM_CONTEXT_COMMANDS_MODES: PMContextCommandsMode[] = ['onHoverPanelMode', 'onRightClickMenuMode'];
export const contextCommandsModeOf = (v: unknown): PMContextCommandsMode =>
  v === 'onRightClickMenuMode' ? 'onRightClickMenuMode' : 'onHoverPanelMode';

/** Main view switch Gantt | Kanban | Network | Versions (GanttToNetworkViewToggleButtons). */
export type PMGanttVsNetworkView = 'showGanttChart' | 'showKanbanView' | 'showNetworkView' | 'showVersionsView';
export const pmMainViewOf = (v: unknown): PMGanttVsNetworkView =>
  v === 'showNetworkView' || v === 'showKanbanView' || v === 'showVersionsView' ? v : 'showGanttChart';
/** PMNetworkView radio buttons. */
export type PMNetworkViewMode = 'networkDiagram' | 'networkSchedule';
/**
 * PMNetworkDiagram (activity-on-node) variants:
 *  cpmNodes     = PMI / PDM box: ES · D · EF / name / LS · TF · LF
 *  compactNodes = name + duration + dates (flow-chart style)
 */
export type PMNetworkDiagramVariant = 'cpmNodes' | 'compactNodes';
/**
 * PMNetworkSchedule (activity-on-arrow, events = circles) variants:
 *  eventCircles = classic 4-sector events (number / early / late / predecessor), layered
 *  timeScaled   = the same network drawn on a time axis (free float = dotted tails)
 */
export type PMNetworkScheduleVariant = 'eventCircles' | 'timeScaled';


/**
 * Effective settings = the user's own row (project_user_settings_table.rowJSON.uxuiSettings)
 * over the project's legacy rowJSON.uxuiSettings, then legacy top-level keys, then defaults.
 */
export function uxuiSettingsOf(json: PMRowJSON | undefined | null, userSettings?: PMUxUiSettings | null): Required<PMUxUiSettings> {
  const u: PMUxUiSettings = { ...(json?.uxuiSettings || {}), ...(userSettings || {}) };
  const pos = (v: unknown, d: PMProgressLinePosition): PMProgressLinePosition =>
    v === 'onTop' || v === 'onBottom' || v === 'atTheMiddle' ? v : d;
  return {
    showCriticalPath: u.showCriticalPath ?? json?.showCriticalPath ?? true,
    ganttArrowsForm: (u.ganttArrowsForm ?? json?.ganttArrowsForm) === 'squareForm' ? 'squareForm' : 'smoothForm',
    showTaskProgressOnGantt: !!(u.showTaskProgressOnGantt ?? json?.showTaskProgressOnGantt),
    taskProgressLinePosition: pos(u.taskProgressLinePosition, 'onTop'),
    projectProgressLinePosition: pos(u.projectProgressLinePosition, 'onBottom'),
    // only the colors of PM_PROGRESS_LINE_SWATCHES (anything else, e.g. the old 'yellow' -> default)
    taskProgressLineColor: progressLineColorOf(u.taskProgressLineColor),
    projectProgressLineColor: progressLineColorOf(u.projectProgressLineColor),
    criticalPathTaskColor: criticalPathTaskColorOf(u.criticalPathTaskColor),
    criticalPathColorHasPriorityOverTheCustomTaskColor: !!u.criticalPathColorHasPriorityOverTheCustomTaskColor,
    ganttVsNetworkView: pmMainViewOf(u.ganttVsNetworkView),
    networkViewMode: u.networkViewMode === 'networkSchedule' ? 'networkSchedule' : 'networkDiagram',
    networkDiagramVariant: u.networkDiagramVariant === 'compactNodes' ? 'compactNodes' : 'cpmNodes',
    networkScheduleVariant: u.networkScheduleVariant === 'timeScaled' ? 'timeScaled' : 'eventCircles',
    showTreeHierarchyNumbers: u.showTreeHierarchyNumbers !== false,
    treeColumnsOrder: normalizeTreeColumnsOrder(u.treeColumnsOrder, projectCustomColumnsOf(json).columns.map((c) => c.key)),
    treeColumnsWidths: normalizeTreeColumnsWidths(u.treeColumnsWidths),
    projectTreeContextCommandsMode: contextCommandsModeOf(u.projectTreeContextCommandsMode),
    projectGanttChartContextCommandsMode: contextCommandsModeOf(u.projectGanttChartContextCommandsMode),
    treeColumnsFilters: normalizeTreeColumnsFilters(u.treeColumnsFilters),
    treeColumnSort: normalizeTreeColumnSort(u.treeColumnSort),
    columnFilterIconColor: columnFilterIconColorOf(u.columnFilterIconColor),
    checkedProjectVersions: Array.isArray(u.checkedProjectVersions) ? u.checkedProjectVersions.filter((g): g is string => typeof g === 'string') : [],
  };
}

/** Shape of the dependency arrow lines in the chart. */
export type PMLinkLineForm = 'smoothForm' | 'squareForm';

/** Task bar color from rowJSON (taskColor, legacy color fallback). */
export function taskColorOf(json: PMRowJSON | undefined | null): string | null {
  if (!json) return null;
  if (json.taskColor !== undefined) return json.taskColor || null; // explicit (null = automatic)
  return json.color || null;
}

export interface PMProjectData {
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
}

/** Output of the scheduler for one row. */
export interface PMScheduledRow {
  startAt: string; // ISO, inclusive
  finishAt: string; // ISO, exclusive
  startMs: number;
  finishMs: number;
  durationDays: number; // working days
  isSummary: boolean;
  isMilestone: boolean;
  progress: number; // 0..100 (rolled up for summaries)
  totalFloatDays: number;
  isCritical: boolean;
  inCycle: boolean;
}

export function depKey(d: { rowDependsOnGUID: string; rowGUID: string }): string {
  return `${d.rowDependsOnGUID}>${d.rowGUID}`;
}
