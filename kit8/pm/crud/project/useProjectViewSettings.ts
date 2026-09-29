// Gantt UX/UI settings saved per project in project_table.rowJSON.uxuiSettings:
//   showCriticalPath, ganttArrowsForm, showTaskProgressOnGantt,
//   taskProgressLinePosition, projectProgressLinePosition,
//   showTreeHierarchyNumbers, treeColumnsOrder (tree/columns)
// The update is optimistic (projects cache -> store.setProjects -> the chart repaints at once).
// Legacy top-level keys (rowJSON.showCriticalPath, ...) are moved into uxuiSettings on save.

import { useMemo } from 'react';
import { usePMStore } from '../../store';
import { PMGanttVsNetworkView, PMNetworkDiagramVariant, PMNetworkScheduleVariant, PMNetworkViewMode, PMProgressLinePosition, PMTreeColumnKey, PMUxUiSettings, uxuiSettingsOf } from '../../types';
import { useUpdateProjectMutation } from './projectQueries';

export type PMGanttViewSettings = PMUxUiSettings;

export function useProjectViewSettings(ownerGUID: string, projectGUID: string | null) {
  const updateProject = useUpdateProjectMutation(ownerGUID);
  return useMemo(() => {
    const saveFor = (rowGUID: string | null, patch: PMUxUiSettings) => {
      const project = rowGUID ? usePMStore.getState().projectsById[rowGUID] : undefined;
      if (!project) return;
      const { showCriticalPath: _a, ganttArrowsForm: _b, showTaskProgressOnGantt: _c, ...json } = project.rowJSON;
      const uxuiSettings: PMUxUiSettings = { ...uxuiSettingsOf(project.rowJSON), ...patch };
      updateProject.mutate({ rowGUID: project.rowGUID, patch: { rowJSON: { ...json, uxuiSettings } } });
    };
    const save = (patch: PMUxUiSettings) => saveFor(projectGUID, patch);
    return {
      setGanttViewSettings: save,
      /** For the project settings dialog (any project, not only the selected one). */
      setProjectUxUiSettings: saveFor,
      toggleCriticalPath: () => save({ showCriticalPath: !usePMStore.getState().showCriticalPath }),
      toggleTaskProgressOnGantt: () => save({ showTaskProgressOnGantt: !usePMStore.getState().showTaskProgressOnGantt }),
      setGanttArrowsForm: (form: NonNullable<PMUxUiSettings['ganttArrowsForm']>) => save({ ganttArrowsForm: form }),
      setTaskProgressLinePosition: (p: PMProgressLinePosition) => save({ taskProgressLinePosition: p }),
      setProjectProgressLinePosition: (p: PMProgressLinePosition) => save({ projectProgressLinePosition: p }),
      // ---- network view (GanttToNetworkViewToggleButtons / PMNetworkView): the store switches at
      // once (no flicker while the optimistic project update travels), then it is saved per project
      setGanttVsNetworkView: (v: PMGanttVsNetworkView) => {
        usePMStore.getState().setNetworkViewSettings({ ganttVsNetworkView: v });
        save({ ganttVsNetworkView: v });
      },
      setNetworkViewMode: (v: PMNetworkViewMode) => {
        usePMStore.getState().setNetworkViewSettings({ networkViewMode: v });
        save({ networkViewMode: v });
      },
      setNetworkDiagramVariant: (v: PMNetworkDiagramVariant) => {
        usePMStore.getState().setNetworkViewSettings({ networkDiagramVariant: v });
        save({ networkDiagramVariant: v });
      },
      // ---- tree columns (tree/columns): store first (no flicker), then saved per project
      setTreeColumnsOrder: (order: PMTreeColumnKey[]) => {
        usePMStore.getState().setTreeColumnsSettings({ treeColumnsOrder: order });
        save({ treeColumnsOrder: order });
      },
      setShowTreeHierarchyNumbers: (v: boolean) => {
        usePMStore.getState().setTreeColumnsSettings({ showTreeHierarchyNumbers: v });
        save({ showTreeHierarchyNumbers: v });
      },
      toggleTreeHierarchyNumbers: () => {
        const v = !usePMStore.getState().showTreeHierarchyNumbers;
        usePMStore.getState().setTreeColumnsSettings({ showTreeHierarchyNumbers: v });
        save({ showTreeHierarchyNumbers: v });
      },
      setNetworkScheduleVariant: (v: PMNetworkScheduleVariant) => {
        usePMStore.getState().setNetworkViewSettings({ networkScheduleVariant: v });
        save({ networkScheduleVariant: v });
      },
    };
  }, [updateProject, projectGUID]);
}
