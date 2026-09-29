// Pure helpers of the PM store (no Zustand): derive() turns tasks + dependencies of the selected
// project into tree + CPM schedule + visible row order; viewSettingsOf() mirrors the project's
// rowJSON view settings into the store.
import { buildTreeIndex, computeProjectProgress, flattenVisible, PMTreeIndex, ROOT_KEY, scheduleProject, todayUTC } from '../view/project/scheduling';
import { projectCustomColumnsOf } from '../view/tree/columns/customColumns';
import { PMLinkLineForm, PMProjectRow, uxuiSettingsOf } from '../model/types';
import type { PMStoreState } from './storeTypes';

export const EMPTY_TREE: PMTreeIndex = { parentById: {}, childrenById: { [ROOT_KEY]: [] }, depthById: {}, wbsById: {} };

/**
 * Gantt view settings live in project_table.rowJSON (showCriticalPath, ganttArrowsForm,
 * showTaskProgressOnGantt); the store mirrors the selected project's values.
 */
export function viewSettingsOf(project: PMProjectRow | undefined) {
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
    showTreeHierarchyNumbers: u.showTreeHierarchyNumbers,
    projectTreeContextCommandsMode: u.projectTreeContextCommandsMode,
    projectGanttChartContextCommandsMode: u.projectGanttChartContextCommandsMode,
    treeColumnsOrder: u.treeColumnsOrder,
    treeColumnsWidths: u.treeColumnsWidths,
    customColumns: projectCustomColumnsOf(project?.rowJSON).columns,
    treeHeadersBackgroundColors: projectCustomColumnsOf(project?.rowJSON).headersBackgroundColors,
  };
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
