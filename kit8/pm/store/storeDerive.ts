// Pure helpers of the PM store (no Zustand): derive() turns tasks + dependencies of the selected
// project into tree + CPM schedule + visible row order; viewSettingsOf() mirrors the project's
// rowJSON view settings into the store.
import { buildTreeIndex, computeProjectProgress, flattenVisible, PMTreeIndex, ROOT_KEY, scheduleProject, todayUTC } from '../view/project/scheduling';
import { projectCustomColumnsOf } from '../view/tree/columns/customColumns';
import { PMLinkLineForm, PMProjectRow, PMUxUiSettings, uxuiSettingsOf } from '../model/types';
import type { PMStoreState } from './storeTypes';

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
    showTreeHierarchyNumbers: u.showTreeHierarchyNumbers,
    projectTreeContextCommandsMode: u.projectTreeContextCommandsMode,
    projectGanttChartContextCommandsMode: u.projectGanttChartContextCommandsMode,
    treeColumnsOrder: u.treeColumnsOrder,
    treeColumnsWidths: u.treeColumnsWidths,
    customColumns: projectCustomColumnsOf(project?.rowJSON).columns,
    treeHeadersBackgroundColors: projectCustomColumnsOf(project?.rowJSON).headersBackgroundColors,
  };
}

/** Effective settings of a project for the signed-in user (settings window draft, saves). */
export function effectiveUxuiSettings(
  s: Pick<PMStoreState, 'projectsById' | 'userSettingsByProject'>,
  projectGUID: string | null | undefined
) {
  return uxuiSettingsOf(projectGUID ? s.projectsById[projectGUID]?.rowJSON : undefined, projectGUID ? s.userSettingsByProject[projectGUID] : undefined);
}

/** Gantt | Network view + network sub-mode: kept when switching projects. */
export function withoutWorkspaceMode<T extends { ganttVsNetworkView: unknown; networkViewMode: unknown }>(v: T) {
  const { ganttVsNetworkView: _v, networkViewMode: _m, ...rest } = v;
  return rest;
}

export function derive(
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
