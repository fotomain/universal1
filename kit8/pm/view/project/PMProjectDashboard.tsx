// /pm/project/dashboard
//   PMRecentProjectsToolbar - pick (recent ribbon + search) / create / edit projects (project_table)
//   PMProjectTasksTree  - Skia task tree + container & hover CRUD panels  ┐ one shared
//   PMProjectGanttChart - Skia Gantt + hover CRUD panel                   ┘ viewport
//   last task (useLastTask): the task clicked last is saved per user + project and scrolled to when the project opens again
//   deep link (useDashboardDeepLink): ?projectGUID&taskGUID&genus&lineGUID opens the Finances view at that task line
//   Gantt | Kanban | Network | Versions | Finances | Plan switch (uxuiSettings.ganttVsNetworkView, remembered per user AND project): Kanban = tree + view/kanban/PMKanbanDashboard,
//   Network = view/network/PMNetworkView, Versions = tree + version/view/version/PMProjectVersionsList
//
// Data flow: Supabase <-> React Query (queries.ts) -> Zustand (store/store_pm.ts) -> Skia.
// Undo: PMUndoProvider (expo-sqlite on native) keeps one undoGanttAction per action.

import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeSelector } from '../../../redux/storeRef';
import { useUxuiCurrentJSON } from '../../../redux/useUxuiCurrentJSON';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import PMRecentProjectsToolbar from './recent/PMRecentProjectsToolbar';
import PMGanttSurfaceLoader from '../gantt/PMGanttSurfaceLoader';
import PMNetworkView from '../network/PMNetworkView';
import { useKanbanCommands } from '../../crud/kanban/useKanbanCommands';
import PMGanttUXUISettinsModalWindow from '../gantt/PMGanttUXUISettinsModalWindow';
import PMExtendedWindow from '../../extended/PMExtendedWindow';
import PMExtendedDialogs from '../../extended/PMExtendedDialogs';
import PMTimelineStrip from '../../extended/PMTimelineStrip';
import PMDetailsPane from '../../extended/PMDetailsPane';
import PMUndoProvider from '../undo/PMUndoProvider';
import { useRecentProjects } from './recent/recentProjects';
import { PMTooltipLayer } from '../../inner/tooltip/PMTooltip';
import { PMDialogButton, PMTipIcon } from '../../inner/buttons';
import { usePMStore } from '../../store/store_pm';
import { PM_SPLITTER_WIDTH } from '../../model/constants';
import { useProjectSubprojectMarks } from '../../subproject/useProjectSubprojectMarks';
import { usePMOwnerGUID, useReadProjectDataQuery, useProjectRealtime, useReadProjectsQuery, useReadProjectUserSettingsQuery, useScheduleWriteBack, useSeedDemoMutation } from '../../crud/queries';
import { usePMCrud } from '../../crud/usePMCrud';
import { useReadProjectKanbanQuery } from '../../crud/kanban/kanbanQueries';
import { useKanbanRealtime } from '../../crud/kanban/useKanbanRealtime';
import ActivityIndicatorCircleApp from '../../../ui/components/activityindicator/ActivityIndicatorCircleApp';
import PMVersionWindows from '../../version/view/windows/PMVersionWindows';
import PMTreeWindows from './tree/PMTreeWindows';
import { useTreeFabActions } from './tree/useTreeFabActions';
import { useTreeKeyboardShortcuts } from './tree/useTreeKeyboardShortcuts';
import { PROJECT_DASHBOARD_SCOPE, useTreeScopeSelection } from './tree/useTreeScopeSelection';
import { pmT, usePMLanguage } from '../../i18n/pmT';
import { useProjectTaskLinesRealtime } from '../task/plan/useProjectTaskLines';
import { useDashboardDeepLink } from './useDashboardDeepLink';
import { useLastTask } from './useLastTask';
import { PMPicker, PMPickerScope } from './pick/pmPickerContext';
import PMProjectSummaryRow from '../../extended/PMProjectSummaryRow';
import { useExtendedKeys } from '../../extended/useExtendedKeys';
import { useExternalDates } from '../../crud/extended/useExternalDates';
import { projectIsBimBased } from '../../bim/model/bimModel';

export interface PMProjectDashboardProps {
  /**
   * PICKER mode (kit8/pm/view/project/pick): the same dashboard - recent projects, the task tree, the Finances view - inside a window that returns a task or a task line.
   * The right pane is always Finances, the deep link and the FAB commands of the screen are off, and Delete / Enter / Tab on the keyboard do nothing.
   */
  picker?: PMPicker | null;
}

export default function PMProjectDashboard({ picker = null }: PMProjectDashboardProps = {}) {
  // the texts follow the app language (kit8/pm/i18n): a language change re-creates the screen
  const language = usePMLanguage();
  return (
    <PMUndoProvider>
      <PMPickerScope picker={picker}>
        <PMProjectDashboardInner key={language} picker={picker} />
      </PMPickerScope>
    </PMUndoProvider>
  );
}

function PMProjectDashboardInner({ picker }: { picker: PMPicker | null }) {
  const router = useRouter();
  const { themeColors } = useDesignSystem();
  const ownerGUID = usePMOwnerGUID(); // real Supabase auth uid (uuid) - see queries.ts

  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const loadedProjectGUID = usePMStore((s) => s.loadedProjectGUID);
  const lastError = usePMStore((s) => s.lastError);
  const cycleCount = usePMStore((s) => s.cycleGUIDs.length);
  const rowCount = usePMStore((s) => s.visibleRows.length);
  const projectCount = usePMStore((s) => s.projectOrder.length);
  const storedView = usePMStore((s) => s.ganttVsNetworkView);
  // the BIM view of a project that is not (or no longer) BIM based falls back to the Gantt chart
  const bimBased = usePMStore((s) => projectIsBimBased(s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON : null));
  const ganttVsNetworkView = storedView === 'showBimView' && !bimBased ? 'showGanttChart' : storedView;

  const projectsQuery = useReadProjectsQuery(ownerGUID);
  useReadProjectUserSettingsQuery(ownerGUID); // this user's Gantt / tree settings per project
  const dataQuery = useReadProjectDataQuery(selectedProjectGUID);
  useProjectRealtime(ownerGUID, selectedProjectGUID);
  // the lines of every task (posted column of the tree, project Actions): kept current by realtime
  useProjectTaskLinesRealtime(ownerGUID ? selectedProjectGUID : null);
  // Kanban: stages + task states of the selected project (store_kanban) + their realtime auto refresh
  useReadProjectKanbanQuery(ownerGUID ? selectedProjectGUID : null);
  useKanbanRealtime(ownerGUID, selectedProjectGUID);
  useScheduleWriteBack(selectedProjectGUID);
  // Subprojects: the icon / name / date warning of the origin tasks (tree + Gantt read store_subproject); reads nothing while no task of the project is a subproject
  useProjectSubprojectMarks(selectedProjectGUID);
  const crud = usePMCrud(ownerGUID, selectedProjectGUID);
  const kanban = useKanbanCommands(selectedProjectGUID);
  const seedDemo = useSeedDemoMutation(ownerGUID);
  useRecentProjects(ownerGUID, projectsQuery.isSuccess);
  // /pm/project/dashboard?projectGUID=…&taskGUID=…&genus=…&lineGUID=… (a click on a transaction of a source window): project, Finances view, task, tab, line
  // (a picker is opened from a page whose own route params may look like a link: no deep link there)
  useDashboardDeepLink(ownerGUID, projectsQuery.isSuccess && !picker);
  // the last clicked task is remembered per user AND project (next to the main view) and scrolled to when the project opens again (not in a picker)
  useLastTask(!picker && !!ownerGUID && projectsQuery.isSuccess, crud.setProjectUxUiSettings);
  useExternalDates();
  useExtendedKeys(crud);

  // Switching projects (e.g. pressing "Project 2") shows the same loader as the first
  // load until the project's data has been (re)read from the database - not the stale
  // cached copy, and never the "empty project" state for a split second.
  const [awaitingProject, setAwaitingProject] = useState<string | null>(null);
  useEffect(() => {
    setAwaitingProject(selectedProjectGUID);
  }, [selectedProjectGUID]);
  useEffect(() => {
    if (awaitingProject && awaitingProject === selectedProjectGUID && loadedProjectGUID === selectedProjectGUID && !dataQuery.isFetching) {
      setAwaitingProject(null);
    }
  }, [awaitingProject, selectedProjectGUID, loadedProjectGUID, dataQuery.isFetching]);
  useEffect(() => {
    if (dataQuery.isError) setAwaitingProject(null);
  }, [dataQuery.isError]);

  useTreeKeyboardShortcuts(crud, !picker);
  // the dashboard remembers its own last project + task: another screen with the tree (Estimation dashboard) selects its project in the same store
  useTreeScopeSelection(PROJECT_DASHBOARD_SCOPE, { enabled: !picker });

  // ---- app bar buttons (kit8/ui/components/common/ApplicationBarApp.tsx) -> Redux uxuiState ----
  const hideProjectToolBar = useSafeSelector((s) => !!s?.uxuiState?.hideProjectToolBar);
  const hideGanttToolBar = useSafeSelector((s) => !!s?.uxuiState?.hideGanttToolBar);
  const hideGanttChartNode = useSafeSelector((s) => !!s?.uxuiState?.hideGanttChartNode);
  const hideTreeNode = useSafeSelector((s) => !!s?.uxuiState?.hideTreeNode);
  // where the Gantt chart starts (the same width rule as PMGanttSurface: the tree takes at most 45%, at least 160 px) - the empty-project button is centered there
  const storeTreeWidth = usePMStore((s) => s.treeWidth);
  const [overlayWidth, setOverlayWidth] = React.useState(0);
  const emptyChartLeft = hideGanttChartNode || hideTreeNode || !overlayWidth ? 0 : Math.round(Math.min(storeTreeWidth, Math.max(160, overlayWidth * 0.45)) + PM_SPLITTER_WIDTH);
  /** uxui.refreshProjectData: a counter - every change re-reads projects, the project, Kanban, settings, versions */
  const refreshNonce = useSafeSelector((s) => Number(s?.uxuiState?.refreshProjectData) || 0);
  const queryClient = useQueryClient();
  const [seenRefresh, setSeenRefresh] = useState(refreshNonce);
  useEffect(() => {
    if (refreshNonce === seenRefresh) return;
    setSeenRefresh(refreshNonce);
    // every PM query key starts with 'pm' (crud/shared/queryShared.ts pmKeys)
    queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && String(q.queryKey[0]).startsWith('pm') });
    if (selectedProjectGUID) setAwaitingProject(selectedProjectGUID);
  }, [refreshNonce, seenRefresh, queryClient, selectedProjectGUID]);

  // ---- uxui.currentJSON ("Share screenshot + JSON"): the selected project + the selected task ----
  const selectedTaskGUID = usePMStore((s) => s.selectedGUID);
  const currentProjectRow = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID] : undefined));
  const currentTaskRow = usePMStore((s) => (s.selectedGUID ? s.tasksById[s.selectedGUID] : undefined));
  useUxuiCurrentJSON(
    currentProjectRow
      ? { kind: 'project', title: currentProjectRow.rowJSON?.name || 'project', json: { project: currentProjectRow, selectedTask: currentTaskRow ?? null } }
      : null
  );

  // ---- main FAB (FABProvider): the CRUD commands of this screen, for the current view + selection ----
  useTreeFabActions('pm-project-dashboard', {
    ownerGUID, projectGUID: selectedProjectGUID, crud, kanban, enabled: !picker, isKanbanView: ganttVsNetworkView === 'showKanbanView',
  });

  if (!ownerGUID) {
    return (
      <Centered color={themeColors.background}>
        <PMTipIcon tip={pmT('Sign-in required')} testID="pm-signin-icon" name="lock" size={32} color={themeColors.primary} />
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>{pmT('Sign in to manage projects')}</Text>
        <Text style={{ color: themeColors.text, opacity: 0.7 }}>{pmT('Projects are stored per user in Supabase (row level security).')}</Text>
        <PMDialogButton
          testID="pm-signin-button"
          title={pmT('Go to Sign In')}
          kind="primary"
          style={{ marginTop: 16 }}
          onPress={() => router.push('/user/signin')}
        />
      </Centered>
    );
  }

  const loading =
    projectsQuery.isLoading ||
    (!!selectedProjectGUID && !dataQuery.isError && (loadedProjectGUID !== selectedProjectGUID || awaitingProject === selectedProjectGUID));
  const loadError = (projectsQuery.error || dataQuery.error) as Error | null;

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <PMRecentProjectsToolbar ownerGUID={ownerGUID} hidden={hideProjectToolBar} />

      {!!lastError && (
        <Pressable onPress={() => usePMStore.getState().setError(null)} style={[styles.banner, { backgroundColor: `${themeColors.error}18`, borderColor: themeColors.error }]}>
          <PMTipIcon tip={pmT('Error')} testID="pm-error-icon" name="error" size={16} color={themeColors.error} onPress={() => usePMStore.getState().setError(null)} />
          <Text style={{ color: themeColors.error, marginLeft: 6, flex: 1 }}>{pmT(lastError)}</Text>
          <PMTipIcon tip={pmT('Dismiss')} testID="pm-error-close" name="close" size={16} color={themeColors.error} onPress={() => usePMStore.getState().setError(null)} />
        </Pressable>
      )}
      {cycleCount > 0 && (
        <View style={[styles.banner, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' }]}>
          <Text style={{ color: themeColors.text }}>{cycleCount} task(s) are part of a dependency cycle and were scheduled without it.</Text>
        </View>
      )}

      {loadError ? (
        <Centered color={themeColors.background}>
          <Text style={[styles.emptyTitle, { color: themeColors.error }]}>{pmT('Could not load projects')}</Text>
          <Text style={{ color: themeColors.text, opacity: 0.7, textAlign: 'center' }}>
            {loadError.message}
            {'\n'}Did you run kit8/sql/init/done/create_tables.sql in Supabase?
          </Text>
        </Centered>
      ) : loading ? (
        <Centered color={themeColors.background}>
          <ActivityIndicatorCircleApp testID="pm-loading" />
        </Centered>
      ) : !selectedProjectGUID && projectCount > 0 ? (
        <Centered color={themeColors.background}>
          <PMTipIcon tip={pmT('Projects (Gantt)')} testID="pm-pick-icon" name="search" size={36} color={themeColors.primary} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>{pmT('Select a project')}</Text>
          <Text style={{ color: themeColors.text, opacity: 0.7, textAlign: 'center' }}>
            {pmT('Search it in the project field above, or create a new one with “+ Project”.')}
          </Text>
        </Centered>
      ) : !selectedProjectGUID ? (
        <Centered color={themeColors.background}>
          <PMTipIcon tip={pmT('Projects (Gantt)')} testID="pm-empty-icon" name="view_timeline" size={40} color={themeColors.primary} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>{pmT('No projects yet')}</Text>
          <PMDialogButton
            testID="pm-empty-demo"
            kind="primary"
            icon="science"
            title={seedDemo.isPending ? 'Creating…' : 'Load demo: Project 1 + Project 2'}
            loading={seedDemo.isPending}
            style={styles.cta}
            onPress={() => seedDemo.mutate()}
          />
        </Centered>
      ) : (
        <View style={{ flex: 1 }}>
          {!picker && ganttVsNetworkView === 'showGanttChart' && <PMTimelineStrip crud={crud} />}
          {!picker && ganttVsNetworkView === 'showGanttChart' && <PMProjectSummaryRow />}
          <View style={{ flex: 1 }}>
          {!picker && ganttVsNetworkView === 'showNetworkView' ? (
            <PMNetworkView crud={crud} />
          ) : (
            <PMGanttSurfaceLoader
              ownerGUID={ownerGUID}
              projectGUID={selectedProjectGUID}
              rightPane={picker ? 'finances' : ganttVsNetworkView === 'showKanbanView' ? 'kanban' : ganttVsNetworkView === 'showVersionsView' ? 'versions' : ganttVsNetworkView === 'showFinancesView' ? 'finances' : ganttVsNetworkView === 'showPlanView' ? 'plan' : ganttVsNetworkView === 'showReportsView' ? 'reports' : ganttVsNetworkView === 'showEstimationView' ? 'estimation' : ganttVsNetworkView === 'showBimView' ? 'bim' : 'gantt'}
              hideTree={hideTreeNode}
              hideRight={hideGanttChartNode}
              hideToolbars={hideGanttToolBar}
            />
          )}
          </View>
          {!picker && ganttVsNetworkView === 'showGanttChart' && <PMDetailsPane crud={crud} />}
          {!picker && ganttVsNetworkView === 'showGanttChart' && rowCount === 0 && loadedProjectGUID === selectedProjectGUID && (
            // the button stands in the CENTER OF THE GANTT CHART (the pane right of the tree), not of the whole window
            <View pointerEvents="box-none" style={[styles.emptyOverlay, { paddingLeft: emptyChartLeft }]} onLayout={(e) => setOverlayWidth(Math.round(e.nativeEvent.layout.width))}>
              <PMDialogButton testID="pm-empty-add-stage" kind="primary" icon="create_new_folder" title={pmT('Add the first stage')} style={styles.cta} onPress={() => crud.createStage()} />
            </View>
          )}
        </View>
      )}

      <PMTreeWindows ownerGUID={ownerGUID} projectGUID={selectedProjectGUID} crud={crud} kanban={kanban}>
        <PMGanttUXUISettinsModalWindow crud={crud} />
        <PMExtendedWindow crud={crud} />
        <PMExtendedDialogs crud={crud} />
        {/* project versions: store sync + "Save project version" / "Restore project from version" windows */}
        <PMVersionWindows ownerGUID={ownerGUID} projectGUID={selectedProjectGUID} />
      </PMTreeWindows>
    </View>
  );
}

function Centered({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <View style={[styles.centered, { backgroundColor: color }]}>
      {children}
      <PMTooltipLayer />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  cta: { marginTop: 14, marginLeft: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, margin: 6, borderRadius: 8 },
  emptyOverlay: { ...StyleSheet.absoluteFill, top: 60, alignItems: 'center', justifyContent: 'center' },
});
