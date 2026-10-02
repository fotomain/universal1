// Commands of the project versions (toolbar buttons, the Versions view, the cards):
//   saveVersion(title)        RPC pm_version_save -> the list refreshes
//   restoreVersion(version)   asks first; RPC pm_version_restore (saves the current plan as a version first),
//                             then the project / tasks / Kanban are re-read and the Gantt undo history is cleared
//   renameVersion · deleteVersion (asks first) · toggleChecked (visual comparison, saved per project and user)
// The windows are opened through the version store: openSaveVersion / openRenameVersion / openRestorePicker.

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../../store/store_pm';
import { errorMessage } from '../../../crud/api/apiUtils';
import { pmKeys } from '../../../crud/shared/queryShared';
import { useSaveProjectUserSettings } from '../../../crud/project/projectUserSettingsQueries';
import { approvePM } from '../../../inner/PMApproveYesNoCancelModalWindow';
import { useUndoGanttAction } from '../../../view/undo/useUndoGanttAction';
import { defaultVersionTitle, formatVersionDateTime, PM_VERSION_MAX_CHECKED } from '../../model/versionTypes';
import { usePMVersionStore } from '../../store/store_version';
import { pmVersionKeys, usePMVersionApi } from './versionQueries';

const projectNameOf = (projectGUID: string | null) => (projectGUID ? usePMStore.getState().projectsById[projectGUID]?.rowJSON?.name : undefined);

export function useVersionCommands(ownerGUID: string, projectGUID: string | null) {
  const api = usePMVersionApi();
  const qc = useQueryClient();
  const { saveUxuiSettings } = useSaveProjectUserSettings(ownerGUID);
  const undo = useUndoGanttAction(ownerGUID, projectGUID);
  const clearUndo = undo.clear;

  return useMemo(() => {
    const fail = (what: string, err: unknown) => usePMStore.getState().setError(`${what}: ${errorMessage(err)}`);
    const refreshVersions = () => qc.invalidateQueries({ queryKey: pmVersionKeys.versions(projectGUID) });

    const setChecked = (guids: string[]) => {
      usePMVersionStore.getState().setChecked(guids);
      saveUxuiSettings(projectGUID, { checkedProjectVersions: usePMVersionStore.getState().checkedGUIDs });
    };

    /** Saves the whole project plan as a new version. Returns its rowVersionGUID (null = failed). */
    const saveVersion = async (title: string): Promise<string | null> => {
      if (!projectGUID) return null;
      const st = usePMVersionStore.getState();
      st.setBusy(true);
      try {
        const guid = await api.saveProjectVersion(projectGUID, title.trim());
        await refreshVersions();
        return guid;
      } catch (err) {
        fail('Could not save the version', err);
        return null;
      } finally {
        usePMVersionStore.getState().setBusy(false);
      }
    };

    /** Asks first, then replaces the project's plan with the version (the current plan is kept as a new version). */
    const restoreVersion = async (versionGUID: string): Promise<boolean> => {
      if (!projectGUID) return false;
      const version = usePMVersionStore.getState().versions.find((v) => v.rowVersionGUID === versionGUID);
      if (!version) return false;
      const ok = await approvePM({
        title: 'Restore the project from this version?',
        message: `"${version.rowJSON.versionTitle}" replaces the current tasks, dependencies and Kanban of the project. The current plan is saved first as a new version, so nothing is lost.`,
        yesLabel: 'Restore',
        icon: 'settings_backup_restore',
        destructive: true,
      });
      if (!ok) return false;
      usePMVersionStore.getState().setBusy(true);
      try {
        await api.restoreProjectVersion(versionGUID, `Before restore ${formatVersionDateTime(Date.now())}`);
        // the undo history describes rows that were just replaced
        await clearUndo().catch(() => undefined);
        await Promise.all([
          qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) }),
          qc.invalidateQueries({ queryKey: ['pm', 'project'] }),
          qc.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) }),
          qc.invalidateQueries({ queryKey: pmKeys.projectKanban(projectGUID) }),
          qc.invalidateQueries({ queryKey: ['pm', 'closure'] }),
          refreshVersions(),
        ]);
        return true;
      } catch (err) {
        fail('Could not restore the version', err);
        return false;
      } finally {
        usePMVersionStore.getState().setBusy(false);
      }
    };

    const renameVersion = async (versionGUID: string, title: string): Promise<boolean> => {
      try {
        await api.renameProjectVersion(versionGUID, title.trim());
        await refreshVersions();
        return true;
      } catch (err) {
        fail('Could not rename the version', err);
        return false;
      }
    };

    /** Asks first. A deleted version is also removed from the comparison. */
    const deleteVersion = async (versionGUID: string): Promise<boolean> => {
      const version = usePMVersionStore.getState().versions.find((v) => v.rowVersionGUID === versionGUID);
      if (!version) return false;
      const ok = await approvePM({
        title: 'Delete this version?',
        message: `"${version.rowJSON.versionTitle}" is deleted for good. The project itself does not change.`,
        yesLabel: 'Delete',
        destructive: true,
      });
      if (!ok) return false;
      try {
        await api.deleteProjectVersion(versionGUID);
        const checked = usePMVersionStore.getState().checkedGUIDs;
        if (checked.includes(versionGUID)) setChecked(checked.filter((g) => g !== versionGUID));
        qc.removeQueries({ queryKey: pmVersionKeys.versionData(versionGUID) });
        await refreshVersions();
        return true;
      } catch (err) {
        fail('Could not delete the version', err);
        return false;
      }
    };

    /** Check box of a version card: draw / hide the version on the Gantt. */
    const toggleChecked = (versionGUID: string) => {
      const checked = usePMVersionStore.getState().checkedGUIDs;
      if (checked.includes(versionGUID)) return setChecked(checked.filter((g) => g !== versionGUID));
      if (checked.length >= PM_VERSION_MAX_CHECKED) {
        usePMStore.getState().setError(`At most ${PM_VERSION_MAX_CHECKED} versions can be compared at once - uncheck one first.`);
        return;
      }
      setChecked([...checked, versionGUID]);
    };

    return {
      saveVersion,
      restoreVersion,
      renameVersion,
      deleteVersion,
      toggleChecked,
      clearChecked: () => setChecked([]),
      /** "Save project version" window (title = project name + date and time). */
      openSaveVersion: () => usePMVersionStore.getState().setTitlePrompt({ mode: 'save', title: defaultVersionTitle(projectNameOf(projectGUID)) }),
      openRenameVersion: (versionGUID: string) => {
        const v = usePMVersionStore.getState().versions.find((x) => x.rowVersionGUID === versionGUID);
        if (v) usePMVersionStore.getState().setTitlePrompt({ mode: 'rename', versionGUID, title: v.rowJSON.versionTitle });
      },
      closeTitlePrompt: () => usePMVersionStore.getState().setTitlePrompt(null),
      /** "Restore project from version" list (ModalWindowListToSelect). */
      openRestorePicker: () => usePMVersionStore.getState().setRestorePickerOpen(true),
      closeRestorePicker: () => usePMVersionStore.getState().setRestorePickerOpen(false),
    };
  }, [api, qc, saveUxuiSettings, clearUndo, ownerGUID, projectGUID]);
}

export type PMVersionCommands = ReturnType<typeof useVersionCommands>;
