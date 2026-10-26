// Pure helpers of the PM store (no Zustand): derive() turns tasks + dependencies of the selected
// project into tree + CPM schedule + visible row order; viewSettingsOf() mirrors the project's
// rowJSON view settings into the store.
import { costColumnShown, costCurrencyOf, costWithVatColumnShown } from '../cost/costTotalModel';
import { buildTreeIndex, computeProjectProgress, flattenVisible, PMTreeIndex, ROOT_KEY, scheduleProject, todayUTC } from '../view/project/scheduling';
import { NO_PENDING, pendingCountOf, pendingOf, PMCalcSignature, provisionalRowOf, signatureOf } from '../model/calcSignature';
import { calculationManualOf, scheduleOptionsOf } from '../model/scheduleOptions';
import { extendedOf } from '../extended/extendedModel';
import { extendedOptionsOf, PMExtendedOptions } from '../extended/extendedOptions';
import { extColumnDefsOf, PMExtColumnContext } from '../extended/extendedColumns';
import { groupOrderOf } from '../extended/rowRules';
import { projectCustomColumnsOf } from '../view/tree/columns/customColumns';
import { PMLinkLineForm, PMProjectRow, PMScheduledRow, PMUxUiSettings, uxuiSettingsOf } from '../model/types';
import type { PMStoreState } from './storeTypes';
import { filterAndSortTreeRows } from '../view/tree/filter/treeColumnFilter';
import type { PMTaskRow } from '../model/types';
import { usePMKanbanStore } from './store_kanban';

const NO_CONTEXT: Record<string, true> = Object.freeze({}) as Record<string, true>;

/**
 * Visible row order of the tree = expanded rows (flattenVisible) with the column filters and the
 * sort applied (tree/filter). Every place that changes the tree, expansion, filters or sort uses it,
 * so tree rows and Gantt bars always follow the same order.
 */
export function treeRowsOf(
  s: Pick<PMStoreState, 'tree' | 'schedule' | 'customColumns' | 'treeColumnsFilters' | 'treeColumnSort'> & { tasksById?: Record<string, PMTaskRow>; tasks?: PMTaskRow[]; deps?: PMStoreState['deps']; extOptions?: PMExtendedOptions; extFlags?: Record<string, boolean> },
  expanded: Record<string, boolean>
) {
  const filters = s.treeColumnsFilters;
  // Extended F8: the rows are grouped by a field (kept together, a band per group on the chart)
  const groupBy = s.extFlags?.ganttGroupByEnabled ? s.extOptions?.groupBy ?? 'none' : 'none';
  const active = (filters && Object.keys(filters).length > 0) || !!s.treeColumnSort || groupBy !== 'none';
  let visibleRows: string[];
  let treeFilterContextGUIDs = NO_CONTEXT;
  let treeFilterMatchCount: number | null = null;
  if (!active) {
    visibleRows = flattenVisible(s.tree, expanded);
  } else {
    let tasksById = s.tasksById;
    if (!tasksById) {
      tasksById = {};
      for (const t of s.tasks ?? []) tasksById[t.rowGUID] = t;
    }
    // the Kanban / Kanban % columns read the Kanban store (store.refreshTreeRows() re-applies them when it changes)
    const k = usePMKanbanStore.getState();
    const kanbanStages = [...k.stages].sort((a, b) => a.orderInList - b.orderInList);
    const r = filterAndSortTreeRows(
      s.tree,
      expanded,
      { tasksById, schedule: s.schedule, tree: s.tree, customColumns: s.customColumns ?? [], kanbanStages, kanbanStates: k.statesByTask, ext: extContextOf({ deps: s.deps ?? [], tree: s.tree, tasksById, customColumns: s.customColumns ?? [], extOptions: s.extOptions }),
        groupOrder: groupBy !== 'none' ? (g: string) => { const t = tasksById![g]; const r = s.schedule[g]; return t && r ? groupOrderOf(groupBy, t, r) : 0; } : undefined },
      filters,
      s.treeColumnSort
    );
    visibleRows = r.visibleRows;
    if (r.contextGUIDs && Object.keys(r.contextGUIDs).length) treeFilterContextGUIDs = r.contextGUIDs;
    treeFilterMatchCount = r.matchCount;
  }
  const rowIndexById: Record<string, number> = {};
  visibleRows.forEach((g, i) => (rowIndexById[g] = i));
  return { visibleRows, rowIndexById, treeFilterContextGUIDs, treeFilterMatchCount };
}

/** what the cells of the Extended / formula columns need (kit8/pm/extended/extendedColumns.ts) */
export function extContextOf(s: { deps: readonly any[]; tree: { wbsById: Record<string, string> }; tasksById: Record<string, PMTaskRow | undefined>; customColumns: readonly any[]; extOptions?: PMExtendedOptions }): PMExtColumnContext {
  const o = s.extOptions;
  return {
    baselineNo: o?.baselineNo ?? 0,
    deps: s.deps,
    wbsById: s.tree.wbsById,
    tasksById: s.tasksById,
    calendarNames: Object.fromEntries((o?.calendars ?? []).map((c) => [c.id, c.name])),
    customDefs: s.customColumns,
  };
}

export const EMPTY_TREE: PMTreeIndex = { parentById: {}, childrenById: { [ROOT_KEY]: [] }, depthById: {}, wbsById: {} };

/**
 * Gantt / tree view settings = the user's row in project_user_settings_table (rowJSON.uxuiSettings)
 * over the project's legacy rowJSON.uxuiSettings; the store mirrors the selected project's values.
 * Custom columns (definitions + header colors) stay project data (project_table.rowJSON.customColumns).
 */
export function viewSettingsOf(project: PMProjectRow | undefined, userSettings?: PMUxUiSettings | null) {
  const u = uxuiSettingsOf(project?.rowJSON, userSettings);
  return {
    showCriticalPath: u.showCriticalPath,
    criticalPathTaskColor: u.criticalPathTaskColor,
    criticalPathColorHasPriorityOverTheCustomTaskColor: !!u.criticalPathColorHasPriorityOverTheCustomTaskColor,
    linkLineForm: u.ganttArrowsForm as PMLinkLineForm,
    showTaskProgressOnGantt: u.showTaskProgressOnGantt,
    taskProgressLinePosition: u.taskProgressLinePosition,
    projectProgressLinePosition: u.projectProgressLinePosition,
    taskProgressLineColor: u.taskProgressLineColor,
    projectProgressLineColor: u.projectProgressLineColor,
    ganttVsNetworkView: u.ganttVsNetworkView,
    viewButtonsOrder: u.viewButtonsOrder,
    networkViewMode: u.networkViewMode,
    networkDiagramVariant: u.networkDiagramVariant,
    networkScheduleVariant: u.networkScheduleVariant,
    showTreeHierarchyNumbers: u.showTreeHierarchyNumbers,
    dragAndDropTaskInTree: u.dragAndDropTaskInTree,
    projectTreeContextCommandsMode: u.projectTreeContextCommandsMode,
    projectGanttChartContextCommandsMode: u.projectGanttChartContextCommandsMode,
    selectRowCheckBoxForm: u.selectRowCheckBoxForm,
    treeColumnsOrder: u.treeColumnsOrder,
    treeColumnsWidths: u.treeColumnsWidths,
    treeColumnsFilters: u.treeColumnsFilters,
    treeColumnSort: u.treeColumnSort,
    columnFilterIconColor: u.columnFilterIconColor,
    postButtonBackgroundColor: u.postButtonBackgroundColor,
    // the real custom columns of the project + the columns of the Extended functions that are on (virtual: kit8/pm/extended/extendedColumns.ts)
    customColumns: [...projectCustomColumnsOf(project?.rowJSON).columns, ...extColumnDefsOf(extendedOf(project?.rowJSON), extendedOptionsOf(project?.rowJSON))],
    extFlags: extendedOf(project?.rowJSON),
    extOptions: extendedOptionsOf(project?.rowJSON),
    treeHeadersBackgroundColors: projectCustomColumnsOf(project?.rowJSON).headersBackgroundColors,
    planDay: project?.rowJSON?.planDay ?? true,
    planHour: !!project?.rowJSON?.planHour,
    planMinute: !!project?.rowJSON?.planMinute,
    planSecond: !!project?.rowJSON?.planSecond,
    showCostColumn: costColumnShown(project?.rowJSON),
    showCostWithVatColumn: costWithVatColumnShown(project?.rowJSON),
    costCurrency: costCurrencyOf(project?.rowJSON),
    planDateInputFormat: project?.rowJSON?.planDateInputFormat || 'YYYY-MM-DD',
    calculationMode: (calculationManualOf(project?.rowJSON) ? 'manual' : 'automatic') as 'manual' | 'automatic',
  };
}

/** Effective settings of a project for the signed-in user (settings window draft, saves). */
export function effectiveUxuiSettings(
  s: Pick<PMStoreState, 'projectsById' | 'userSettingsByProject'>,
  projectGUID: string | null | undefined
) {
  return uxuiSettingsOf(projectGUID ? s.projectsById[projectGUID]?.rowJSON : undefined, projectGUID ? s.userSettingsByProject[projectGUID] : undefined);
}

/** The main view (Gantt | Kanban | Network | Versions | Finances) + the network sub-mode: applied when a project is selected, never by a refresh. */
export function withoutWorkspaceMode<T extends { ganttVsNetworkView: unknown; networkViewMode: unknown }>(v: T) {
  const { ganttVsNetworkView: _v, networkViewMode: _m, ...rest } = v;
  return rest;
}

/** The last CALCULATED plan of the loaded project (Manual calculation mode keeps showing it - model/calcSignature.ts). */
export interface PMFrozenPlan {
  schedule: Record<string, PMScheduledRow>;
  projectStartMs: number;
  projectFinishMs: number;
  projectProgress: number;
  cycleGUIDs: string[];
  projectStartInPast?: boolean;
  calcSignature: PMCalcSignature;
}

/**
 * tasks + dependencies + project row -> tree, CPM schedule, progress, visible rows.
 * `frozen` (Manual calculation mode, the project already calculated once): the schedule is NOT recalculated - the frozen rows are kept, a task that was edited or created since
 * gets its own provisional row, and the number of pending edits is counted by comparing the input signatures. Without `frozen` the plan is calculated in full (always on a load).
 */
export function derive(
  s: Pick<PMStoreState, 'tasks' | 'deps' | 'projectsById' | 'expandedByProject'> &
    Partial<Pick<PMStoreState, 'customColumns' | 'treeColumnsFilters' | 'treeColumnSort' | 'tasksById' | 'externalDates' | 'extOptions' | 'extFlags'>>,
  projectGUID: string | null,
  frozen?: PMFrozenPlan | null
) {
  const project = projectGUID ? s.projectsById[projectGUID] : undefined;
  const startIso = project?.rowJSON?.projectStartAt;
  const parsed = startIso ? Date.parse(startIso) : NaN;
  const projectStart = Number.isFinite(parsed) ? parsed : project?.created_at ? Date.parse(project.created_at) : todayUTC();
  const options = scheduleOptionsOf(project?.rowJSON);
  const calendar = options.projectCalendar ?? { skipWeekends: !!project?.rowJSON?.skipWeekends };

  const tree = s.tasks.length ? buildTreeIndex(s.tasks) : EMPTY_TREE;
  const signature = signatureOf(s.tasks, s.deps, project);
  let rowsOut: Record<string, PMScheduledRow>;
  let projectStartMs: number;
  let projectFinishMs: number;
  let projectProgress: number;
  let cycleGUIDs: string[];
  let projectStartInPast: boolean | undefined;
  let calcSignature = signature;
  let pending = NO_PENDING;

  if (frozen) {
    pending = pendingOf(frozen.calcSignature, signature);
    calcSignature = frozen.calcSignature;
    rowsOut = {};
    for (const t of s.tasks) {
      const base = frozen.schedule[t.rowGUID];
      const row: PMScheduledRow = !base || pending.guids[t.rowGUID] ? provisionalRowOf(t, frozen.projectStartMs, calendar, base, project) : { ...base };
      // % complete is live (the database trigger rolls the stages up): never frozen
      row.progress = Math.min(100, Math.max(0, Number(t.rowProgress) || 0));
      rowsOut[t.rowGUID] = row;
    }
    // a new stage: its dates from its rows (a stage with nothing under it keeps its one-day placeholder)
    const rollNew = (guid: string): void => {
      const kids = tree.childrenById[guid] || [];
      kids.forEach(rollNew);
      if (!kids.length || frozen.schedule[guid]) return;
      let a = Infinity;
      let b = -Infinity;
      for (const k of kids) { a = Math.min(a, rowsOut[k].startMs); b = Math.max(b, rowsOut[k].finishMs); }
      if (a === Infinity) return;
      Object.assign(rowsOut[guid], { startMs: a, finishMs: b, startAt: new Date(a).toISOString(), finishAt: new Date(b).toISOString(), isSummary: true, isMilestone: false });
    };
    for (const r of tree.childrenById[ROOT_KEY] || []) rollNew(r);
    projectStartMs = frozen.projectStartMs;
    projectFinishMs = frozen.projectFinishMs;
    cycleGUIDs = frozen.cycleGUIDs;
    projectStartInPast = frozen.projectStartInPast;
    // stage and project % = the stored values (the database formula), not a client roll-up of rows that were not recalculated
    projectProgress = Number.isFinite(Number(project?.rowProgress)) && s.tasks.length ? Number(project?.rowProgress) : frozen.projectProgress;
  } else {
    const result = scheduleProject({
      tasks: s.tasks,
      deps: s.deps,
      projectStartMs: projectStart,
      calendar,
      ...options,
      externalDates: s.externalDates,
    });
    rowsOut = result.rows;
    projectStartMs = result.projectStartMs;
    projectFinishMs = result.projectFinishMs;
    projectProgress = computeProjectProgress(result.rows);
    cycleGUIDs = result.cycleGUIDs;
    projectStartInPast = result.projectStartInPast;
  }

  const expanded = (projectGUID && s.expandedByProject[projectGUID]) || {};
  const rows = treeRowsOf(
    { tree, schedule: rowsOut, tasks: s.tasks, customColumns: s.customColumns ?? [], treeColumnsFilters: s.treeColumnsFilters ?? {}, treeColumnSort: s.treeColumnSort ?? null, deps: s.deps, extOptions: s.extOptions, extFlags: s.extFlags },
    expanded
  );
  return {
    tree,
    schedule: rowsOut,
    projectStartMs,
    projectFinishMs,
    projectProgress,
    cycleGUIDs,
    projectStartInPast: !!projectStartInPast,
    calcSignature,
    pendingGUIDs: pending.guids,
    pendingStructureCount: pending.structure,
    ...rows,
  };
}

/** the number shown in the "Not calculated" banner */
export const pendingCountOfState = (s: Pick<PMStoreState, 'pendingGUIDs' | 'pendingStructureCount'>): number => pendingCountOf({ guids: s.pendingGUIDs, structure: s.pendingStructureCount });
