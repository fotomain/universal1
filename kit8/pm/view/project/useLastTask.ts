// useLastTask - the dashboard remembers the task the user clicked last, per user AND project (project_dashboard_user_settings_table.rowJSON.uxuiSettings.lastTaskGUID,
// next to the main view Gantt | Edit | ... = ganttVsNetworkView), and scrolls to it when the project is opened again.
//   save:    every change of store.selectedGUID (a click in the tree / on a bar, the task window, a new task ...) is saved after LAST_TASK_SAVE_DELAY_MS;
//            only a task of the loaded project, and only while it differs from the saved one (a project switch / a reload that clears the selection saves nothing)
//   restore: ONCE per project, when its rows AND its saved view settings are in (the saved main view is applied first): the task is revealed (parents expanded),
//            selected and scrolled into view = store.requestFocus (consumed by PMGanttSurface). Not restored when the user already selected a task,
//            when the saved task no longer exists, or when the route is a deep link (useDashboardDeepLink places the user itself).
import { useEffect, useRef, useState } from 'react';
import { useGlobalSearchParams } from 'expo-router';
import { usePMStore } from '../../store/store_pm';
import { effectiveUxuiSettings } from '../../store/storeDerive';
import { PMUxUiSettings } from '../../model/types';

export const LAST_TASK_SAVE_DELAY_MS = 800;
/** the saved view settings that do not arrive (no table / a failed read): go on after this */
export const LAST_TASK_SETTINGS_WAIT_MS = 3000;

/** The last task saved for the project, or null. */
export function savedLastTaskOf(projectGUID: string | null | undefined): string | null {
  if (!projectGUID) return null;
  return effectiveUxuiSettings(usePMStore.getState(), projectGUID).lastTaskGUID ?? null;
}

/** The task to scroll to when the project opens: the saved one while it is still a task of the loaded project, else null. */
export function lastTaskToRestore(): string | null {
  const s = usePMStore.getState();
  if (!s.selectedProjectGUID || s.loadedProjectGUID !== s.selectedProjectGUID) return null;
  const g = savedLastTaskOf(s.selectedProjectGUID);
  return g && s.tasksById[g] ? g : null;
}

export function useLastTask(
  enabled: boolean,
  saveSettings: (projectGUID: string, patch: PMUxUiSettings) => void
) {
  const params = useGlobalSearchParams();
  const hasLink = !!(params.taskGUID || params.projectGUID);
  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const loadedProjectGUID = usePMStore((s) => s.loadedProjectGUID);
  const keepWorkspaceMode = usePMStore((s) => s.keepWorkspaceMode);
  const settingsMissing = usePMStore((s) => s.userSettingsTableMissing);
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const [waitedOut, setWaitedOut] = useState<string | null>(null);
  /** the project whose last task is handled (restored, or skipped): saving starts only after it */
  const handled = useRef<string | null>(null);
  const saveRef = useRef(saveSettings);
  saveRef.current = saveSettings;

  // the settings of the project are late: do not wait for them for ever
  useEffect(() => {
    if (!enabled || !selectedProjectGUID || loadedProjectGUID !== selectedProjectGUID || waitedOut === selectedProjectGUID) return;
    const timer = setTimeout(() => setWaitedOut(selectedProjectGUID), LAST_TASK_SETTINGS_WAIT_MS);
    return () => clearTimeout(timer);
  }, [enabled, selectedProjectGUID, loadedProjectGUID, waitedOut]);

  // restore (once per project)
  useEffect(() => {
    if (!enabled || !selectedProjectGUID || loadedProjectGUID !== selectedProjectGUID || handled.current === selectedProjectGUID) return;
    if (hasLink) { handled.current = selectedProjectGUID; return; } // a deep link places the user itself
    if (!keepWorkspaceMode && !settingsMissing && waitedOut !== selectedProjectGUID) return; // the saved view is not applied yet
    handled.current = selectedProjectGUID;
    if (selectedGUID) return; // the user has already clicked a task
    const g = lastTaskToRestore();
    if (g) usePMStore.getState().requestFocus(g);
  }, [enabled, selectedProjectGUID, loadedProjectGUID, keepWorkspaceMode, settingsMissing, waitedOut, hasLink, selectedGUID]);

  // save (debounced)
  useEffect(() => {
    if (!enabled || !selectedProjectGUID || !selectedGUID || loadedProjectGUID !== selectedProjectGUID) return;
    const timer = setTimeout(() => {
      const s = usePMStore.getState();
      if (s.selectedProjectGUID !== selectedProjectGUID || s.selectedGUID !== selectedGUID || !s.tasksById[selectedGUID]) return;
      if (savedLastTaskOf(selectedProjectGUID) === selectedGUID) return;
      saveRef.current(selectedProjectGUID, { lastTaskGUID: selectedGUID });
    }, LAST_TASK_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, selectedProjectGUID, loadedProjectGUID, selectedGUID]);
}
