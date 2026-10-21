// useDashboardDeepLink - applies the params of /pm/project/dashboard (dashboardDeepLink.ts) ONCE per link:
//   1. the project is selected (the recent-projects restore keeps a project that is selected already),
//   2. when its rows AND the saved view settings are in (the saved view is applied once and would win over ours), the main view becomes Finances (view=budgets: the Budgets view),
//      the Finances view gets the place (genus tab + line; the Budgets view the tab + the line to filter by) and the tree scrolls to the task and selects it (requestFocus).
// The view is NOT saved for the project (the store is set, not crud.setGanttVsNetworkView): a link does not change what the user left.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalSearchParams } from 'expo-router';
import { usePMStore } from '../../store/store_pm';
import { parseDashboardLink, parseDashboardProjectLink } from './dashboardDeepLink';

/** the saved view settings that do not arrive (no table / a failed read): go on after this */
export const DEEP_LINK_SETTINGS_WAIT_MS = 3000;

export function useDashboardDeepLink(ownerGUID: string | null | undefined, projectsLoaded: boolean) {
  const params = useGlobalSearchParams();
  const link = useMemo(() => parseDashboardLink(params as any), [params.projectGUID, params.taskGUID, params.genus, params.lineGUID, params.view, params.tab]); // eslint-disable-line react-hooks/exhaustive-deps
  // a link with a project only (the board of a subproject): the project is selected, nothing else changes
  const onlyProject = useMemo(() => parseDashboardProjectLink(params as any), [params.projectGUID, params.taskGUID]); // eslint-disable-line react-hooks/exhaustive-deps
  const applied = useRef<string | null>(null);
  const loadedProjectGUID = usePMStore((s) => s.loadedProjectGUID);
  const keepWorkspaceMode = usePMStore((s) => s.keepWorkspaceMode);
  const settingsMissing = usePMStore((s) => s.userSettingsTableMissing);
  const [waitedOut, setWaitedOut] = useState<string | null>(null);

  useEffect(() => {
    if (!link || !ownerGUID || !projectsLoaded) return;
    const s = usePMStore.getState();
    if (!s.projectsById[link.projectGUID]) return;
    if (s.selectedProjectGUID !== link.projectGUID) s.selectProject(link.projectGUID);
    s.addRecentProject(link.projectGUID);
  }, [link, ownerGUID, projectsLoaded]);

  useEffect(() => {
    if (!onlyProject || !ownerGUID || !projectsLoaded || applied.current === `project:${onlyProject}`) return;
    const s = usePMStore.getState();
    if (!s.projectsById[onlyProject]) return;
    applied.current = `project:${onlyProject}`;
    if (s.selectedProjectGUID !== onlyProject) s.selectProject(onlyProject);
    s.addRecentProject(onlyProject);
  }, [onlyProject, ownerGUID, projectsLoaded]);

  useEffect(() => {
    if (!link || loadedProjectGUID !== link.projectGUID || waitedOut === link.key) return;
    const timer = setTimeout(() => setWaitedOut(link.key), DEEP_LINK_SETTINGS_WAIT_MS);
    return () => clearTimeout(timer);
  }, [link, loadedProjectGUID, waitedOut]);

  useEffect(() => {
    if (!link || applied.current === link.key || loadedProjectGUID !== link.projectGUID) return;
    if (!keepWorkspaceMode && !settingsMissing && waitedOut !== link.key) return;
    const s = usePMStore.getState();
    if (s.selectedProjectGUID !== link.projectGUID) return;
    applied.current = link.key;
    s.setNetworkViewSettings({ ganttVsNetworkView: link.view === 'budgets' ? 'showPlanView' : 'showFinancesView' });
    s.setPlaceRequest({ taskGUID: link.taskGUID, genus: link.genus, lineGUID: link.lineGUID, ...(link.tab ? { tab: link.tab } : {}) });
    s.requestFocus(link.taskGUID);
  }, [link, loadedProjectGUID, keepWorkspaceMode, settingsMissing, waitedOut]);
}
