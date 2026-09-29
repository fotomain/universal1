// All Gantt commands in one object, shared by the tree toolbar, the hover panels of the
// tree and of the chart, the edit modals, inline cell editors and keyboard shortcuts.
//
// Naming (same at every layer):
//   project: createProject · readProject · updateProject · deleteProject   (api + use…Mutation / useRead…Query)
//   task:    createTask · readTask · updateTask · deleteTask               (api, mutations, commands below)
//   commands also: createStage · createTask(at, kind) · createTaskAbove · createTaskBelow ·
//                  updateTask(guid, patch) · deleteTask(guid) (asks first) · link / updateDependency / deleteDependency
//
// The implementation is split by entity:
//   crud/task/useTaskCommands.ts             stages / tasks / milestones
//   crud/dependency/useDependencyCommands.ts dependencies (arrows)
//   undo/useUndoGanttAction.ts               undoGanttAction (record + undo)
//   crud/project/useProjectViewSettings.ts   view settings in project_table.rowJSON
//   crud/project/useProjectCustomColumns.ts  custom tree columns (project_table.rowJSON.customColumns)

import { useMemo } from 'react';
import { useTaskCommands } from './crud/task/useTaskCommands';
import { useDependencyCommands } from './crud/dependency/useDependencyCommands';
import { useUndoGanttAction } from './undo/useUndoGanttAction';
import { useProjectViewSettings } from './crud/project/useProjectViewSettings';
import { useProjectCustomColumns } from './crud/project/useProjectCustomColumns';
import { usePMStore } from './store';
import { approvePM } from './PMApproveYesNoCancelModalWindow';

export type { PMBarEditMode } from './crud/task/useTaskCommands';

export function usePMCrud(ownerGUID: string, projectGUID: string | null) {
  const undo = useUndoGanttAction(ownerGUID, projectGUID);
  const task = useTaskCommands(ownerGUID, projectGUID, undo);
  const dependency = useDependencyCommands(ownerGUID, projectGUID, undo);
  const view = useProjectViewSettings(ownerGUID, projectGUID);
  const customColumns = useProjectCustomColumns(ownerGUID, projectGUID);
  return useMemo(
    () => ({
      ...task,
      ...dependency,
      ...view,
      ...customColumns,
      /** Asks first (PMApproveYesNoCancelModalWindow), then undoes the last action. */
      undoGanttAction: async () => {
        const { undoCount, undoLabel } = usePMStore.getState();
        if (!undoCount) return;
        const ok = await approvePM({
          title: 'Undo the last action?',
          message: undoLabel ? `Undo: ${undoLabel}` : undefined,
          yesLabel: 'Undo',
          icon: 'undo',
        });
        if (ok) undo.undo();
      },
      isUndoing: undo.isUndoing,
    }),
    [task, dependency, view, customColumns, undo]
  );
}

export type PMCrud = ReturnType<typeof usePMCrud>;
