// Each screen with the task tree (Project dashboard, Estimation dashboard ...) remembers its OWN last edit point - the project and the task - separately.
// The PM store holds ONE selected project, and Drawer screens stay mounted: so the screen that is FOCUSED applies its own selection when it gets the focus and records every change
// of the store while it has it. A screen with a fixed project (`forcedProjectGUID`, the Estimation dashboard) always selects that one and remembers only its task.
//   focus gained: select the remembered project (or the forced one); the remembered task of that project is asked back with `requestFocus` (the tree reveals + scrolls to it once loaded)
//   while focused: store changes of project / task are written to the memory of the screen (a task is not recorded while its project is still loading)
// A forced screen that is opened FIRST stores the selection it finds in the store as the memory of the Project dashboard, so the dashboard does not open on the estimation project.
import { useEffect } from 'react';
import * as ExpoRouter from 'expo-router';
import { usePMStore } from '../../../store/store_pm';

export const PROJECT_DASHBOARD_SCOPE = 'project-dashboard';

export interface TreeSelectionMemory { projectGUID: string | null; taskGUID: string | null }
const memory: Record<string, TreeSelectionMemory> = {};

export const treeSelectionMemory = {
  get: (scope: string): TreeSelectionMemory | undefined => memory[scope],
  set: (scope: string, m: TreeSelectionMemory) => { memory[scope] = m; },
  clear: () => { Object.keys(memory).forEach((k) => delete memory[k]); },
};

/** useIsFocused of expo-router; true where there is no navigator (a window, a test) */
function useSafeIsFocused(): boolean {
  try {
    const fn = (ExpoRouter as any).useIsFocused;
    return typeof fn === 'function' ? !!fn() : true;
  } catch {
    return true;
  }
}

export function useTreeScopeSelection(scope: string, opts: { enabled?: boolean; forcedProjectGUID?: string | null } = {}) {
  const { enabled = true, forcedProjectGUID = null } = opts;
  const focused = useSafeIsFocused();
  const active = enabled && focused;
  useEffect(() => {
    if (!active) return;
    const store = usePMStore.getState();
    const mine = memory[scope];
    // a screen with a fixed project opened first: the selection of the store belongs to the Project dashboard
    if (forcedProjectGUID && !memory[PROJECT_DASHBOARD_SCOPE] && store.selectedProjectGUID !== forcedProjectGUID) {
      memory[PROJECT_DASHBOARD_SCOPE] = { projectGUID: store.selectedProjectGUID, taskGUID: store.selectedGUID };
    }
    const wantProject = forcedProjectGUID ?? (mine ? mine.projectGUID : store.selectedProjectGUID);
    const wantTask = mine && mine.projectGUID === wantProject ? mine.taskGUID : null;
    if (wantProject !== store.selectedProjectGUID) usePMStore.getState().selectProject(wantProject);
    if (wantTask) usePMStore.getState().requestFocus(wantTask);
    memory[scope] = { projectGUID: wantProject, taskGUID: wantTask };
    const unsubscribe = usePMStore.subscribe((s, prev) => {
      if (s.selectedProjectGUID === prev.selectedProjectGUID && s.selectedGUID === prev.selectedGUID && s.loadedProjectGUID === prev.loadedProjectGUID) return;
      const last = memory[scope];
      if (forcedProjectGUID && s.selectedProjectGUID !== forcedProjectGUID) return; // the store is being switched to another screen's project
      if (s.loadedProjectGUID !== s.selectedProjectGUID) {
        // loading: keep the remembered task of the same project
        memory[scope] = { projectGUID: s.selectedProjectGUID, taskGUID: last && last.projectGUID === s.selectedProjectGUID ? last.taskGUID : null };
        return;
      }
      memory[scope] = { projectGUID: s.selectedProjectGUID, taskGUID: s.selectedGUID ?? (last && last.projectGUID === s.selectedProjectGUID && s.focusRequest ? last.taskGUID : null) };
    });
    return unsubscribe;
  }, [active, scope, forcedProjectGUID]);
}
