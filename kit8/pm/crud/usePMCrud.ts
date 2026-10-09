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
//   crud/project/useProjectTreeFilters.ts    filter & sort of the tree columns (uxuiSettings.treeColumnsFilters / treeColumnSort)
//   crud/task/useTaskLastEditPlace.ts        recordEditPlace: rowJSON.lastEditPlace of a task (where the user edited last)

import { useMemo } from 'react';
import { useTaskCommands } from './task/useTaskCommands';
import { useDependencyCommands } from './dependency/useDependencyCommands';
import { useUndoGanttAction } from '../view/undo/useUndoGanttAction';
import { pmT } from '../i18n/pmT';
import { useProjectViewSettings } from './project/useProjectViewSettings';
import { useProjectCustomColumns } from './project/useProjectCustomColumns';
import { useProjectTreeFilters } from './project/useProjectTreeFilters';
import { useTaskLastEditPlace } from './task/useTaskLastEditPlace';
import { usePMStore } from '../store/store_pm';
import { approvePM } from '../inner/PMApproveYesNoCancelModalWindow';

export type { PMBarEditMode } from './task/useTaskCommands';

export function usePMCrud(ownerGUID: string, projectGUID: string | null) {
  const undo = useUndoGanttAction(ownerGUID, projectGUID);
  const task = useTaskCommands(ownerGUID, projectGUID, undo);
  const dependency = useDependencyCommands(ownerGUID, projectGUID, undo);
  const view = useProjectViewSettings(ownerGUID, projectGUID);
  const customColumns = useProjectCustomColumns(ownerGUID, projectGUID);
  const treeFilters = useProjectTreeFilters(ownerGUID, projectGUID);
  const editPlace = useTaskLastEditPlace(ownerGUID, projectGUID);
  return useMemo(
    () => ({
      ...task,
      ...dependency,
      ...view,
      ...customColumns,
      ...treeFilters,
      /** rowJSON.lastEditPlace: remember where in the task the user edited (quiet, only when the place changes) */
      ...editPlace,
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
      /** Applies the last undone action again (no question: it is the user's own action, and Undo takes it back). */
      redoGanttAction: () => {
        if (usePMStore.getState().redoCount) undo.redo();
      },
      /** clearUndo: asks first, then forgets every undo step of this project (the data is not changed). */
      clearUndo: async () => {
        const n = usePMStore.getState().undoCount;
        if (!n) return;
        const ok = await approvePM({ title: pmT('Clear the undo history?'), message: pmT('{{count}} undo step(s) will be forgotten. The project itself does not change.', { count: n }), yesLabel: pmT('Clear'), icon: 'delete_sweep', destructive: true });
        if (ok) await undo.clearUndo();
      },
      /** clearRedo: asks first, then forgets every redo step of this project. */
      clearRedo: async () => {
        const n = usePMStore.getState().redoCount;
        if (!n) return;
        const ok = await approvePM({ title: pmT('Clear the redo history?'), message: pmT('{{count}} redo step(s) will be forgotten. The project itself does not change.', { count: n }), yesLabel: pmT('Clear'), icon: 'delete_sweep', destructive: true });
        if (ok) await undo.clearRedo();
      },
      /** an undo or a redo is being written */
      isUndoing: undo.isUndoing,
    }),
    [task, dependency, view, customColumns, treeFilters, editPlace, undo]
  );
}

export type PMCrud = ReturnType<typeof usePMCrud>;
