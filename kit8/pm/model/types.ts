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
import type { PMLastEditPlace } from './lastEditPlace';
export type { PMLastEditPlace } from './lastEditPlace';

/** project = row of project_table; stage = summary row; task = leaf; milestone = 0-day leaf. */
export type PMRowKind = 'project' | 'stage' | 'task' | 'milestone';

/**
 * Dependency (link) types, same semantics as MS Project / DHTMLX:
 *  FS finish-to-start (default), SS start-to-start, FF finish-to-finish, SF start-to-finish.
 */
export type PMLinkType = 'FS' | 'SS' | 'FF' | 'SF';

/** rowJSON.intent: what another app shared when the row was created ({ intentURL, intentMIME, ... }). */
export interface PMIntentLink {
  intentURL?: string | null;
  intentMIME?: string | null;
  intentText?: string | null;
  intentTitle?: string | null;
  intentFiles?: { path: string; mimeType?: string | null; fileName?: string | null; size?: number | null }[];
  intentReceivedAt?: string;
}

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
   * project_task_table only: where in the task the user edited last; activated when the task is opened again
   * (model/lastEditPlace.ts). Written by the RPC pm_set_task_last_edit_place, never part of an undo step.
   */
  lastEditPlace?: PMLastEditPlace | null;
  /** The row was added from content shared into the app (kit8/providers/WithIntent.tsx): the link to it. */
  intent?: PMIntentLink | null;
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
  /**
   * The project manager = a person of the persons catalog (personTable.rowGUID; his personEmail is the address). Project settings -> Main.
   * When Post finds a resource busy, the Share button prepares a message for the manager of every project that holds the booking (Cc: the manager of the project being posted).
   */
  projectManagerPerson?: string | null;
  // ---- project_table only: Finances (Project settings -> TabBudgets: PMProjectBudgetsTab) ----
  /** ISO 4217 code (currency catalog) of the project budgets */
  currencyForBudget?: string | null;
  /** ISO 4217 code (currency catalog) of the project accounting */
  currencyForAccounting?: string | null;
  /** ISO 4217 code (currency catalog): default currency for contracts */
  currencyForContract?: string | null;
  /** D365-style exchange rate types (currencyExchangeRateTable.rowJSON.rateType) used to convert the sums of the task lines: accounting (default 'Default') and budget (default 'Budget') */
  exchangeRateTypeForAccounting?: string | null;
  exchangeRateTypeForBudget?: string | null;
  /** Budgets: the project needs a revenue budget */
  projectRevenueBudgetNeeded?: boolean;
  /** Budgets: the project needs an expense budget = the master switch of the cost inputs below (off = every input as before the switches existed) */
  projectExpenseBudgetNeeded?: boolean;
  /** Project cost total (kit8/pm/cost): show the tree column "Cost" (costTotalForBudget = Time + Material + Expense of the plan). Usable only while a cost budget is on (projectCostBudgetOn); display only - the server keeps the totals while a cost budget is on */
  showTotalCostOnTheGanttChart?: boolean;
  /** Cost inputs (only while projectExpenseBudgetNeeded; kit8/pm/model/taskInputScope.ts): the Time tab of the task lines ("Time input needed"); default true */
  projectTimeCostsNeeded?: boolean;
  /** ... Time lines of a person; default true */
  projectTimeOfPersonNeeded?: boolean;
  /** ... Time lines of an equipment (with Person: the menu "Resource: Person | Equipment"); default false */
  projectTimeOfEquipmentNeeded?: boolean;
  /** ... the Material tab; default true */
  projectMaterialCostsNeeded?: boolean;
  /** ... the Expenses tab; default true */
  projectExpenseCostsNeeded?: boolean;
  /**
   * Fact input (kit8/pm/fact, documentation/FACT_INPUT.html; Project settings -> Budgets -> Main): true = a new fact document keeps the GUIDs of the task lines, users cannot add lines (delete and update only);
   * false (default) = the fact data is disconnected from the task line GUIDs and users add lines freely. Copied into every document when it is created.
   */
  factStrongInputByTaskLine?: boolean;
  /** Vendor invoices (kit8/pm/vendor_invoice; Project settings -> Vendor): true (default) = "Vendor Invoice" of a task also makes ONE draft WITHOUT a vendor of the lines that have none; false = such lines are left out */
  userCanCreateVendorInvoicesFromTasksWithEmptyVendors?: boolean;
  /** ... true (default) = lines can be ADDED by hand to a draft vendor invoice (a CRUD panel, lines not tied to a task line); false = only the lines made from the task lines */
  independentInvoiceInputAvailable?: boolean;
  /** managementCalendarTable.rowGUID of the calendar whose excluded days divide the timeline of a task plan (Post); empty = workingDaysCalendar */
  calendarForTaskPlan?: string | null;
  /**
   * Business units (kit8/catalog/business_unit; Project settings -> Budgets): the four centers of the project = businessUnitTable.rowGUID.
   * A cost line defaults to projectCostCenter, a revenue line to projectRevenueCenter (then the profit / investment center); the last source of the unit of a line.
   * Obligatory on every NEW project (`projectBusinessUnitsRequired` = true, set when the project is made): it cannot be saved without them. A project made before has none.
   */
  projectCostCenter?: string | null;
  projectRevenueCenter?: string | null;
  projectProfitCenter?: string | null;
  projectInvestmentCenter?: string | null;
  projectBusinessUnitsRequired?: boolean;
  /**
   * Budget scenarios (kit8/catalog/budget/scenario; Project settings -> Budgets -> Main): budgetScenarioTable.rowGUID of the scenario the project plans in
   * (kind 'plan') and of the one it compares the facts with (kind 'fact'). Empty = no scenario (an old project stays as it is).
   */
  budgetScenarioForPlan?: string | null;
  budgetScenarioForFact?: string | null;
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
  /**
   * The organization of the project = the organization of its owner (organizationTable.rowGUID). Set by the database on insert (the client never sends it)
   * and never changed afterwards; all projects of one organization share their resources.
   */
  readonly rowParentGUID?: string;
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
import { postButtonColorOf } from './postButtonColors';
export { PM_DEFAULT_POST_BUTTON_COLOR, PM_POST_BUTTON_COLORS, postButtonColorOf, textColorOnBackground } from './postButtonColors';
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
  /** Main view switch: Gantt chart, Kanban board, network view, versions or finances. Saved per user AND project (default 'showGanttChart'). */
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
  /** Tree: drag & drop of tasks (reorder / re-parent): a drag column (grip) after the row-select column + the # / Task name columns + the hover panel handle. false = no task dragging at all (default true). */
  dragAndDropTaskInTree?: boolean;
  /** Tree: row commands in a hover panel (default) or in a right-click / long-press menu. */
  projectTreeContextCommandsMode?: PMContextCommandsMode;
  /** Gantt chart: bar commands in a hover panel (default) or in a right-click / long-press menu. */
  projectGanttChartContextCommandsMode?: PMContextCommandsMode;
  /** Row selection check boxes (task tree, ReusableTable): round (default) or square. */
  selectRowCheckBoxForm?: PMSelectRowCheckBoxForm;
  /** Tree: column filters { [columnKey]: { filterVariantForColumn, value, value2 } } - all AND-ed (tree/filter). */
  treeColumnsFilters?: PMTreeColumnsFilters;
  /** Tree: sorted column (siblings sorted inside every parent), null = tree order. */
  treeColumnSort?: PMTreeColumnSort | null;
  /** Tree: color of the filter icon on a filtered column header (default light vibrant red #FF4D6D). */
  columnFilterIconColor?: string;
  /** Background of the Post button of the task line table (default light fuchsia #F0ABFC): kit8/pm/view/task/plan. */
  postButtonBackgroundColor?: string;
  /** Versions checked for the visual comparison on the Gantt (version_project_table.rowVersionGUID, see kit8/pm/version). */
  checkedProjectVersions?: string[];
  /** Order of the main view buttons (GanttToggleButtons), changed by dragging the buttons (default: Gantt, Kanban, Network, Versions, Finances, Plan, Reports). */
  viewButtonsOrder?: PMGanttVsNetworkView[];
}

/**
 * Where the row / bar commands (add, edit, duplicate, copy, share, link, details, sql_for_delete) live:
 *  onHoverPanelMode     = floating panel on the hovered row (web) / selected row (touch)
 *  onRightClickMenuMode = context menu: right-click (web) / long-press and release (touch); no panel
 */
export type PMContextCommandsMode = 'onHoverPanelMode' | 'onRightClickMenuMode';
export const PM_CONTEXT_COMMANDS_MODES: PMContextCommandsMode[] = ['onHoverPanelMode', 'onRightClickMenuMode'];
/** the default of a new project and of the demo projects (nothing stored): the right-click / long-press menu */
export const PM_DEFAULT_CONTEXT_COMMANDS_MODE: PMContextCommandsMode = 'onRightClickMenuMode';
export const contextCommandsModeOf = (v: unknown): PMContextCommandsMode =>
  v === 'onHoverPanelMode' ? 'onHoverPanelMode' : PM_DEFAULT_CONTEXT_COMMANDS_MODE;

/** Form of the "select row" check boxes: formRound (default) | formSquare. */
export type PMSelectRowCheckBoxForm = 'formRound' | 'formSquare';
export const PM_SELECT_ROW_CHECK_BOX_FORMS: PMSelectRowCheckBoxForm[] = ['formRound', 'formSquare'];
export const selectRowCheckBoxFormOf = (v: unknown): PMSelectRowCheckBoxForm => (v === 'formSquare' ? 'formSquare' : 'formRound');

/** Main view switch Gantt | Kanban | Network | Versions | Finances | Plan | Reports (GanttToggleButtons). */
export type PMGanttVsNetworkView = 'showGanttChart' | 'showKanbanView' | 'showNetworkView' | 'showVersionsView' | 'showFinancesView' | 'showPlanView' | 'showReportsView';
export const PM_DEFAULT_VIEW_BUTTONS_ORDER: PMGanttVsNetworkView[] = ['showGanttChart', 'showFinancesView', 'showKanbanView', 'showNetworkView', 'showVersionsView', 'showReportsView', 'showPlanView'];
/** the button that is ALWAYS the last one of the switch (Budgets), whatever order the user saved */
export const PM_LAST_VIEW_BUTTON: PMGanttVsNetworkView = 'showPlanView';
/** the main view that has no button of its own: it is a part of Reports (the Network button sits in the Reports section row: Costs | Revenues | Network) */
export const PM_REPORTS_PART_VIEW: PMGanttVsNetworkView = 'showNetworkView';
/** Sections of Reports (PMReportsSectionButtons): Costs, Revenues and Monitor01 (kit8/pm/reports/monitor01) are pages of the Reports view, Network is the network view */
export type PMReportsSection = 'costs' | 'revenues' | 'monitor01' | 'network';
export const pmMainViewOf = (v: unknown): PMGanttVsNetworkView =>
  v === 'showNetworkView' || v === 'showKanbanView' || v === 'showVersionsView' || v === 'showFinancesView' || v === 'showPlanView' || v === 'showReportsView' ? v : 'showGanttChart';
/** Saved order (unknown / duplicate values dropped, missing buttons appended in the default order); Budgets (PM_LAST_VIEW_BUTTON) is always the last. */
export const viewButtonsOrderOf = (v: unknown): PMGanttVsNetworkView[] => {
  const seen = new Set<PMGanttVsNetworkView>();
  const out: PMGanttVsNetworkView[] = [];
  if (Array.isArray(v)) for (const x of v) if (PM_DEFAULT_VIEW_BUTTONS_ORDER.includes(x) && !seen.has(x)) (seen.add(x), out.push(x));
  for (const x of PM_DEFAULT_VIEW_BUTTONS_ORDER) if (!seen.has(x)) out.push(x);
  return [...out.filter((x) => x !== PM_LAST_VIEW_BUTTON), PM_LAST_VIEW_BUTTON];
};
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
    dragAndDropTaskInTree: u.dragAndDropTaskInTree !== false,
    treeColumnsOrder: normalizeTreeColumnsOrder(u.treeColumnsOrder, projectCustomColumnsOf(json).columns.map((c) => c.key)),
    treeColumnsWidths: normalizeTreeColumnsWidths(u.treeColumnsWidths),
    projectTreeContextCommandsMode: contextCommandsModeOf(u.projectTreeContextCommandsMode),
    projectGanttChartContextCommandsMode: contextCommandsModeOf(u.projectGanttChartContextCommandsMode),
    selectRowCheckBoxForm: selectRowCheckBoxFormOf(u.selectRowCheckBoxForm),
    treeColumnsFilters: normalizeTreeColumnsFilters(u.treeColumnsFilters),
    treeColumnSort: normalizeTreeColumnSort(u.treeColumnSort),
    columnFilterIconColor: columnFilterIconColorOf(u.columnFilterIconColor),
    postButtonBackgroundColor: postButtonColorOf(u.postButtonBackgroundColor),
    checkedProjectVersions: Array.isArray(u.checkedProjectVersions) ? u.checkedProjectVersions.filter((g): g is string => typeof g === 'string') : [],
    viewButtonsOrder: viewButtonsOrderOf(u.viewButtonsOrder),
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
