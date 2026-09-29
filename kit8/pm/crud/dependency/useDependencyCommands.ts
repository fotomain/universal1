// Dependency (arrow) commands: link / unlink from the chart, the tree and the task page;
// edit + recolor + delete from the arrow's context menu and PMEditDependencyScreen.
// Deleting a dependency never deletes a task, and is undoable (undoGanttAction).

import { useMemo } from 'react';
import { approvePM } from '../../inner/PMApproveYesNoCancelModalWindow';
import { usePMStore } from '../../store/store_pm';
import { describeDependencyProblem, validateNewDependency } from '../../view/project/scheduling';
import { PMDepRef, PMLinkType } from '../../model/types';
import { PMDependencyPatch } from '../api/dependencyApi';
import { useCreateDependencyMutation, useDeleteDependencyMutation, useUpdateDependencyMutation } from './dependencyQueries';
import type { PMUndo } from '../../view/undo/useUndoGanttAction';

export function useDependencyCommands(ownerGUID: string, projectGUID: string | null, undo: PMUndo) {
  const createDependencyMutation = useCreateDependencyMutation(ownerGUID, projectGUID);
  const deleteDependencyMutation = useDeleteDependencyMutation(projectGUID);
  const updateDependencyMutation = useUpdateDependencyMutation(projectGUID);
  const { record } = undo;

  return useMemo(() => {
    const st = () => usePMStore.getState();
    const find = (ref: PMDepRef) => st().deps.find((d) => d.rowGUID === ref.rowGUID && d.rowDependsOnGUID === ref.dependsOnGUID);
    const nameOf = (guid: string) => st().tasksById[guid]?.rowJSON.name || '?';

    /** Asks first (PMApproveYesNoCancelModalWindow); deletes only the dependency, never a task. */
    const deleteDependency = async (ref: PMDepRef) => {
      const s = st();
      s.setDepMenu(null);
      const fromEditor = !!s.editingDep && s.editingDep.rowGUID === ref.rowGUID && s.editingDep.dependsOnGUID === ref.dependsOnGUID;
      if (fromEditor) s.setEditingDep(null); // one window at a time
      if (!find(ref)) return;
      const ok = await approvePM({
        title: 'Delete this dependency?',
        message: `"${nameOf(ref.rowGUID)}" will no longer wait for "${nameOf(ref.dependsOnGUID)}". The tasks are not deleted. You can undo it with the Undo button.`,
        yesLabel: 'Delete',
        destructive: true,
        icon: 'link_off',
      });
      if (!ok) {
        if (fromEditor && find(ref)) st().setEditingDep(ref); // back to the editor
        return;
      }
      if (!find(ref)) return;
      record('dependency-delete', `Delete dependency ${nameOf(ref.dependsOnGUID)} → ${nameOf(ref.rowGUID)}`);
      deleteDependencyMutation.mutate({ rowGUID: ref.rowGUID, dependsOnGUID: ref.dependsOnGUID });
    };

    const updateDependency = (ref: PMDepRef, patch: PMDependencyPatch, label = 'Edit dependency') => {
      const d = find(ref);
      if (!d) return;
      record('dependency-update', label);
      updateDependencyMutation.mutate({ rowGUID: ref.rowGUID, dependsOnGUID: ref.dependsOnGUID, patch });
    };

    return {
      /** Creates pred -> succ, validated client-side (the DB re-validates). */
      link: (predGUID: string, succGUID: string, linkType: PMLinkType = 'FS', lagDays = 0) => {
        const s = st();
        s.setLinkSource(null);
        const problem = validateNewDependency(s.tasks, s.deps, predGUID, succGUID);
        if (problem === 'duplicate') {
          // the link already exists: dropping on other bar ends changes its type (FS/SS/FF/SF)
          const cur = find({ rowGUID: succGUID, dependsOnGUID: predGUID })!;
          s.setSelected(succGUID); // highlights the existing arrow
          if ((cur.linkType || 'FS') !== linkType) {
            updateDependency({ rowGUID: succGUID, dependsOnGUID: predGUID }, { linkType }, `Link type ${cur.linkType || 'FS'} → ${linkType}`);
            return true;
          }
          s.setError(
            `"${nameOf(succGUID)}" already waits for "${nameOf(predGUID)}" (${linkType}) - it is the highlighted arrow. ` +
              'Drop on other bar ends to change the link type, or double-click the arrow to edit it.'
          );
          return false;
        }
        if (problem === 'cycle') {
          s.setSelected(predGUID);
          s.setError(
            `"${nameOf(predGUID)}" already (directly or through other tasks) waits for "${nameOf(succGUID)}", ` +
              `so "${nameOf(succGUID)}" cannot also wait for it - that would be a cycle. Delete the existing arrow first.`
          );
          return false;
        }
        if (problem) {
          s.setError(describeDependencyProblem(problem));
          return false;
        }
        record('dependency-create', `Link ${nameOf(predGUID)} → ${nameOf(succGUID)}`);
        createDependencyMutation.mutate({ rowGUID: succGUID, dependsOnGUID: predGUID, linkType, lagDays });
        return true;
      },

      /** Removes the dependency pred -> succ (only the dependency, never a task). */
      unlink: (predGUID: string, succGUID: string) => deleteDependency({ rowGUID: succGUID, dependsOnGUID: predGUID }),

      deleteDependency,
      updateDependency,

      /** updateDependencyColor: stored in the dependency's rowJSON.dependencyColor (null = default). */
      updateDependencyColor: (ref: PMDepRef, color: string | null) => {
        const d = find(ref);
        if (!d || (d.rowJSON?.dependencyColor ?? null) === color) return;
        updateDependency(ref, { rowJSON: { ...(d.rowJSON || {}), dependencyColor: color } }, color ? 'Dependency color' : 'Default dependency color');
      },

      openDependencyEditor: (ref: PMDepRef) => st().setEditingDep(ref),
      openDependencyMenu: (ref: PMDepRef, x: number, y: number) => st().setDepMenu({ ...ref, x, y }),
      closeDependencyMenu: () => st().setDepMenu(null),
    };
  }, [createDependencyMutation, deleteDependencyMutation, updateDependencyMutation, record]);
}
