// PM Gantt module types, mirroring kit8/sql/init/create_pm_tables.sql.

export {
  projectTable,
  projectTaskTable,
  projectTaskDependenciesTable,
  projectTaskDependencyClosureTable,
} from './constants';

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

import { PMProgressLinePosition, PM_DEFAULT_PROGRESS_LINE_COLOR } from './task/progress/line/progressLineConstants';
import { normalizeTreeColumnsOrder, normalizeTreeColumnsWidths, PMTreeColumnKey } from './tree/columns/treeColumns';
import { projectCustomColumnsOf, PMProjectCustomColumns, PMTaskCustomColumnValues } from './tree/columns/customColumns';
export type { PMTreeColumnKey } from './tree/columns/treeColumns';
export type { PMCustomColumnDef, PMCustomColumnKey, PMCustomColumnType, PMCustomColumnValue, PMProjectCustomColumns, PMTaskCustomColumnValues } from './tree/columns/customColumns';
// progress line types / constants live in kit8/pm/task/progress/line (re-exported for older imports)
export type { PMProgressLinePosition } from './task/progress/line/progressLineConstants';
export { PM_DEFAULT_PROGRESS_LINE_COLOR, PM_PROGRESS_LINE_POSITIONS } from './task/progress/line/progressLineConstants';

/** project_table.rowJSON.uxuiSettings - how the Gantt of this project looks. */
export interface PMUxUiSettings {
  /** Critical path highlighting on/off (default true). */
  showCriticalPath?: boolean;
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
  /** Gantt bar toggle: Gantt chart or network view (default 'showGanttChart'). */
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
}

/** Gantt bar toggle (GanttToNetworkViewToggleButtons). */
export type PMGanttVsNetworkView = 'showGanttChart' | 'showNetworkView';
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


/** Effective settings of a project (uxuiSettings, then legacy top-level keys, then defaults). */
export function uxuiSettingsOf(json: PMRowJSON | undefined | null): Required<PMUxUiSettings> {
  const u = json?.uxuiSettings || {};
  const pos = (v: unknown, d: PMProgressLinePosition): PMProgressLinePosition =>
    v === 'onTop' || v === 'onBottom' || v === 'atTheMiddle' ? v : d;
  return {
    showCriticalPath: u.showCriticalPath ?? json?.showCriticalPath ?? true,
    ganttArrowsForm: (u.ganttArrowsForm ?? json?.ganttArrowsForm) === 'squareForm' ? 'squareForm' : 'smoothForm',
    showTaskProgressOnGantt: !!(u.showTaskProgressOnGantt ?? json?.showTaskProgressOnGantt),
    taskProgressLinePosition: pos(u.taskProgressLinePosition, 'onTop'),
    projectProgressLinePosition: pos(u.projectProgressLinePosition, 'onBottom'),
    taskProgressLineColor: (typeof u.taskProgressLineColor === 'string' && u.taskProgressLineColor) || PM_DEFAULT_PROGRESS_LINE_COLOR,
    projectProgressLineColor: (typeof u.projectProgressLineColor === 'string' && u.projectProgressLineColor) || PM_DEFAULT_PROGRESS_LINE_COLOR,
    ganttVsNetworkView: u.ganttVsNetworkView === 'showNetworkView' ? 'showNetworkView' : 'showGanttChart',
    networkViewMode: u.networkViewMode === 'networkSchedule' ? 'networkSchedule' : 'networkDiagram',
    networkDiagramVariant: u.networkDiagramVariant === 'compactNodes' ? 'compactNodes' : 'cpmNodes',
    networkScheduleVariant: u.networkScheduleVariant === 'timeScaled' ? 'timeScaled' : 'eventCircles',
    showTreeHierarchyNumbers: u.showTreeHierarchyNumbers !== false,
    treeColumnsOrder: normalizeTreeColumnsOrder(u.treeColumnsOrder, projectCustomColumnsOf(json).columns.map((c) => c.key)),
    treeColumnsWidths: normalizeTreeColumnsWidths(u.treeColumnsWidths),
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
