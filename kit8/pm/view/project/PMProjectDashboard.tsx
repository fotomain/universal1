// /pm/project/dashboard
//   PMRecentProjectsToolbar - pick (recent ribbon + search) / create / edit projects (project_table)
//   PMProjectTasksTree  - Skia task tree + container & hover CRUD panels  ┐ one shared
//   PMProjectGanttChart - Skia Gantt + hover CRUD panel                   ┘ viewport
//   Gantt | Kanban | Network | Versions switch (uxuiSettings.ganttVsNetworkView): Kanban = tree + view/kanban/PMKanbanDashboard,
//   Network = view/network/PMNetworkView, Versions = tree + version/view/version/PMProjectVersionsList
//
// Data flow: Supabase <-> React Query (queries.ts) -> Zustand (store/store_pm.ts) -> Skia.
// Undo: PMUndoProvider (expo-sqlite on native) keeps one undoGanttAction per action.

import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeSelector } from '../../../redux/storeRef';
import { useUxuiCurrentJSON } from '../../../redux/useUxuiCurrentJSON';
import { FABContextAction, useFABContextActions } from '../../../providers/FABProvider';
import { usePMKanbanStore } from '../../store/store_kanban';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import PMRecentProjectsToolbar from './recent/PMRecentProjectsToolbar';
import PMGanttSurfaceLoader from '../gantt/PMGanttSurfaceLoader';
import PMNetworkView from '../network/PMNetworkView';
import PMTaskEditModal from '../task/PMTaskEditModal';
import { useKanbanCommands } from '../../crud/kanban/useKanbanCommands';
import PMEditDependencyScreen from '../task/dependency/PMEditDependencyScreen';
import PMDependencyMenu from '../task/dependency/PMDependencyMenu';
import PMTaskRowMenu from '../task/PMTaskRowMenu';
import PMTreeHeaderMenu from '../tree/customColumns/PMTreeHeaderMenu';
import PMCustomColumnNameModalWindow from '../tree/customColumns/PMCustomColumnNameModalWindow';
import PMTreeColumnFilterPopup from '../tree/filter/PMTreeColumnFilterPopup';
import PMGanttUXUISettinsModalWindow from '../gantt/PMGanttUXUISettinsModalWindow';
import PMApproveYesNoCancelModalWindow, { isPMApproveOpen } from '../../inner/PMApproveYesNoCancelModalWindow';
import PMUndoProvider from '../undo/PMUndoProvider';
import { useRecentProjects } from './recent/recentProjects';
import { PMTooltipLayer } from '../../inner/tooltip/PMTooltip';
import { PMDialogButton, PMTipIcon } from '../../inner/buttons';
import { usePMStore } from '../../store/store_pm';
import { effectiveUxuiSettings } from '../../store/storeDerive';
import { usePMOwnerGUID, useReadProjectDataQuery, useProjectRealtime, useReadProjectsQuery, useReadProjectUserSettingsQuery, useScheduleWriteBack, useSeedDemoMutation } from '../../crud/queries';
import { usePMCrud } from '../../crud/usePMCrud';
import { useReadProjectKanbanQuery } from '../../crud/kanban/kanbanQueries';
import { useKanbanRealtime } from '../../crud/kanban/useKanbanRealtime';
import ActivityIndicatorCircleApp from '../../../components/activityindicator/ActivityIndicatorCircleApp';
import PMVersionWindows from '../../version/view/windows/PMVersionWindows';

export default function PMProjectDashboard() {
  return (
    <PMUndoProvider>
      <PMProjectDashboardInner />
    </PMUndoProvider>
  );
}

function PMProjectDashboardInner() {
  const router = useRouter();
  const { themeColors } = useDesignSystem();
  const ownerGUID = usePMOwnerGUID(); // real Supabase auth uid (uuid) - see queries.ts

  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const loadedProjectGUID = usePMStore((s) => s.loadedProjectGUID);
  const lastError = usePMStore((s) => s.lastError);
  const cycleCount = usePMStore((s) => s.cycleGUIDs.length);
  const rowCount = usePMStore((s) => s.visibleRows.length);
  const projectCount = usePMStore((s) => s.projectOrder.length);
  const ganttVsNetworkView = usePMStore((s) => s.ganttVsNetworkView);

  const projectsQuery = useReadProjectsQuery(ownerGUID);
  useReadProjectUserSettingsQuery(ownerGUID); // this user's Gantt / tree settings per project
  const dataQuery = useReadProjectDataQuery(selectedProjectGUID);
  useProjectRealtime(ownerGUID, selectedProjectGUID);
  // Kanban: stages + task states of the selected project (store_kanban) + their realtime auto refresh
  useReadProjectKanbanQuery(ownerGUID ? selectedProjectGUID : null);
  useKanbanRealtime(ownerGUID, selectedProjectGUID);
  useScheduleWriteBack(selectedProjectGUID);
  const crud = usePMCrud(ownerGUID, selectedProjectGUID);
  const kanban = useKanbanCommands(selectedProjectGUID);
  const seedDemo = useSeedDemoMutation(ownerGUID);
  useRecentProjects(ownerGUID, projectsQuery.isSuccess);

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

  useKeyboardShortcuts(crud);

  // ---- app bar buttons (kit8/ui/AppBar.tsx) -> Redux uxuiState ----
  const hideProjectToolBar = useSafeSelector((s) => !!s?.uxuiState?.hideProjectToolBar);
  const hideGanttToolBar = useSafeSelector((s) => !!s?.uxuiState?.hideGanttToolBar);
  const hideGanttChartNode = useSafeSelector((s) => !!s?.uxuiState?.hideGanttChartNode);
  const hideTreeNode = useSafeSelector((s) => !!s?.uxuiState?.hideTreeNode);
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
  const selectedIsLeaf = usePMStore((s) => !!(s.selectedGUID && s.tasksById[s.selectedGUID] && !(s.tree.childrenById[s.selectedGUID]?.length)));
  const checkedCount = usePMStore((s) => Object.keys(s.checkedGUIDs).length);
  const undoCount = usePMStore((s) => s.undoCount);
  const fabActions = useMemo((): FABContextAction[] | null => {
    if (!ownerGUID) return null;
    const sel = selectedTaskGUID && currentTaskRow ? selectedTaskGUID : null;
    const a: FABContextAction[] = [];
    if (!selectedProjectGUID) {
      a.push({ icon: 'plus', label: 'New project', onPress: () => usePMStore.getState().openProjectSettings('new') });
      return a;
    }
    const isKanbanView = ganttVsNetworkView === 'showKanbanView';
    // nearest to the FAB first (the list grows upwards): the most used commands
    a.push({ icon: 'plus', label: sel ? 'Add task (after / inside the selected row)' : 'Add task', onPress: () => crud.createTask(sel) });
    a.push({ icon: 'folder-plus-outline', label: 'Add stage', onPress: () => (sel ? crud.createStageBelow(sel) : crud.createStage(null)) });
    a.push({ icon: 'flag-outline', label: 'Add milestone', onPress: () => crud.createTask(sel, 'milestone') });
    if (sel) {
      a.push({ icon: 'pencil-outline', label: 'Edit', onPress: () => crud.edit(sel) });
      a.push({ icon: 'content-duplicate', label: 'Duplicate', onPress: () => crud.duplicateTask(sel) });
      a.push({ icon: 'calendar-plus', label: 'Add to Google Calendar', onPress: () => crud.addToGoogleCalendar(sel) });
      a.push({ icon: 'share-variant', label: 'Share task', onPress: () => crud.shareTask(sel) });
      a.push({ icon: 'open-in-new', label: 'Open task info', onPress: () => crud.openInfo(sel) });
      if (isKanbanView && selectedIsLeaf) a.push({ icon: 'layers-off-outline', label: 'Kanban: to "No state"', onPress: () => kanban.clearTreeRowKanbanState(sel) });
      a.push({ icon: 'delete-outline', label: 'Delete', color: themeColors.error, onPress: () => crud.deleteTask(sel) });
    }
    if (checkedCount > 0) {
      a.push({ icon: 'delete-sweep-outline', label: `Delete the ${checkedCount} selected rows`, color: themeColors.error, onPress: () => crud.deleteTasks(Object.keys(usePMStore.getState().checkedGUIDs)) });
      a.push({ icon: 'checkbox-multiple-blank-circle-outline', label: 'Clear the selection', onPress: () => usePMStore.getState().clearChecked() });
    }
    if (isKanbanView) a.push({ icon: 'view-column-outline', label: 'Kanban Stages', onPress: () => usePMKanbanStore.getState().openStagesEditor(selectedProjectGUID) });
    if (undoCount > 0) a.push({ icon: 'undo', label: 'Undo', onPress: () => crud.undoGanttAction() });
    a.push({ icon: 'cog-outline', label: 'Project settings', onPress: () => usePMStore.getState().openProjectSettings(selectedProjectGUID) });
    return a;
  }, [ownerGUID, selectedProjectGUID, selectedTaskGUID, currentTaskRow, selectedIsLeaf, checkedCount, undoCount, ganttVsNetworkView, crud, kanban, themeColors.error]);
  useFABContextActions('pm-project-dashboard', fabActions);

  // The Gantt | Network view follows the user across projects (store.selectProject keeps it);
  // save it to the newly selected project too, so a reload opens that project in the same view.
  useEffect(() => {
    if (!selectedProjectGUID) return;
    const s = usePMStore.getState();
    const project = s.projectsById[selectedProjectGUID];
    if (!project) return;
    const saved = effectiveUxuiSettings(s, selectedProjectGUID);
    if (saved.ganttVsNetworkView !== s.ganttVsNetworkView || saved.networkViewMode !== s.networkViewMode) {
      crud.setGanttViewSettings({ ganttVsNetworkView: s.ganttVsNetworkView, networkViewMode: s.networkViewMode });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectGUID]);

  if (!ownerGUID) {
    return (
      <Centered color={themeColors.background}>
        <PMTipIcon tip="Sign-in required" testID="pm-signin-icon" name="lock" size={32} color={themeColors.primary} />
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Sign in to manage projects</Text>
        <Text style={{ color: themeColors.text, opacity: 0.7 }}>Projects are stored per user in Supabase (row level security).</Text>
        <PMDialogButton
          testID="pm-signin-button"
          title="Go to Sign In"
          kind="primary"
          style={{ marginTop: 16 }}
          onPress={() => router.push('/signin')}
        />
      </Centered>
    );
  }

  const loading =
    projectsQuery.isLoading ||
    (!!selectedProjectGUID && !dataQuery.isError && (loadedProjectGUID !== selectedProjectGUID || awaitingProject === selectedProjectGUID));
  const loadError = (projectsQuery.error || dataQuery.error) as Error | null;
  const projectName = selectedProjectGUID ? usePMStore.getState().projectsById[selectedProjectGUID]?.rowJSON.name : undefined;

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <PMRecentProjectsToolbar ownerGUID={ownerGUID} hidden={hideProjectToolBar} />

      {!!lastError && (
        <Pressable onPress={() => usePMStore.getState().setError(null)} style={[styles.banner, { backgroundColor: `${themeColors.error}18`, borderColor: themeColors.error }]}>
          <PMTipIcon tip="Error" testID="pm-error-icon" name="error" size={16} color={themeColors.error} />
          <Text style={{ color: themeColors.error, marginLeft: 6, flex: 1 }}>{lastError}</Text>
          <PMTipIcon tip="Dismiss" testID="pm-error-close" name="close" size={16} color={themeColors.error} />
        </Pressable>
      )}
      {cycleCount > 0 && (
        <View style={[styles.banner, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' }]}>
          <Text style={{ color: themeColors.text }}>{cycleCount} task(s) are part of a dependency cycle and were scheduled without it.</Text>
        </View>
      )}

      {loadError ? (
        <Centered color={themeColors.background}>
          <Text style={[styles.emptyTitle, { color: themeColors.error }]}>Could not load projects</Text>
          <Text style={{ color: themeColors.text, opacity: 0.7, textAlign: 'center' }}>
            {loadError.message}
            {'\n'}Did you run kit8/sql/init/done/create_tables.sql in Supabase?
          </Text>
        </Centered>
      ) : loading ? (
        <Centered color={themeColors.background}>
          <ActivityIndicatorCircleApp testID="pm-loading" />
          {!!selectedProjectGUID && !projectsQuery.isLoading && (
            <Text style={{ color: themeColors.text, opacity: 0.6, marginTop: 10 }}>Loading {projectName || 'project'}…</Text>
          )}
        </Centered>
      ) : !selectedProjectGUID && projectCount > 0 ? (
        <Centered color={themeColors.background}>
          <PMTipIcon tip="Projects (Gantt)" testID="pm-pick-icon" name="search" size={36} color={themeColors.primary} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Select a project</Text>
          <Text style={{ color: themeColors.text, opacity: 0.7, textAlign: 'center' }}>
            Search it in the project field above, or create a new one with “+ Project”.
          </Text>
        </Centered>
      ) : !selectedProjectGUID ? (
        <Centered color={themeColors.background}>
          <PMTipIcon tip="Projects (Gantt)" testID="pm-empty-icon" name="view_timeline" size={40} color={themeColors.primary} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No projects yet</Text>
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
          {ganttVsNetworkView === 'showNetworkView' ? (
            <PMNetworkView crud={crud} />
          ) : (
            <PMGanttSurfaceLoader
              ownerGUID={ownerGUID}
              projectGUID={selectedProjectGUID}
              rightPane={ganttVsNetworkView === 'showKanbanView' ? 'kanban' : ganttVsNetworkView === 'showVersionsView' ? 'versions' : 'gantt'}
              hideTree={hideTreeNode}
              hideRight={hideGanttChartNode}
              hideToolbars={hideGanttToolBar}
            />
          )}
          {rowCount === 0 && loadedProjectGUID === selectedProjectGUID && (
            <View pointerEvents="box-none" style={styles.emptyOverlay}>
              <PMDialogButton testID="pm-empty-add-stage" kind="primary" icon="create_new_folder" title="Add the first stage" style={styles.cta} onPress={() => crud.createStage()} />
            </View>
          )}
        </View>
      )}

      <PMTaskEditModal crud={crud} kanban={kanban} />
      <PMEditDependencyScreen crud={crud} />
      <PMDependencyMenu crud={crud} />
      <PMTaskRowMenu crud={crud} />
      <PMTreeHeaderMenu crud={crud} />
      <PMCustomColumnNameModalWindow crud={crud} />
      <PMTreeColumnFilterPopup crud={crud} />
      <PMGanttUXUISettinsModalWindow crud={crud} />
      {/* project versions: store sync + "Save project version" / "Restore project from version" windows */}
      <PMVersionWindows ownerGUID={ownerGUID} projectGUID={selectedProjectGUID} />
      <PMApproveYesNoCancelModalWindow />
      <PMTooltipLayer />
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

/** Web: Ctrl/⌘+Z = undo, Del = delete, Enter/F2 = edit, Esc = cancel link / clear, Alt+↑↓ = move, Tab/Shift+Tab = indent. */
function useKeyboardShortcuts(crud: ReturnType<typeof usePMCrud>) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const s = usePMStore.getState();
      if (s.editingGUID || s.editingDep || s.uxuiSettingsOpen || s.customColumnPrompt || isPMApproveOpen()) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (s.undoCount > 0) crud.undoGanttAction();
        return;
      }
      const sel = s.selectedGUID;
      if (e.key === 'Escape') {
        if (s.depMenu) s.setDepMenu(null);
        else if (s.treeHeaderMenu) s.setTreeHeaderMenu(null);
        else if (s.linkSourceGUID) s.setLinkSource(null);
        else s.setSelected(null);
        return;
      }
      if (!sel) return;
      if (e.key === 'Delete') {
        e.preventDefault();
        crud.deleteTask(sel);
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        crud.edit(sel);
      } else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        crud.moveBy(sel, -1);
      } else if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        crud.moveBy(sel, 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const i = s.rowIndexById[sel] ?? 0;
        const next = s.visibleRows[i + (e.key === 'ArrowUp' ? -1 : 1)];
        if (next) s.setSelected(next);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) crud.outdent(sel);
        else crud.indent(sel);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [crud]);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  cta: { marginTop: 14, marginLeft: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, margin: 6, borderRadius: 8 },
  emptyOverlay: { ...StyleSheet.absoluteFillObject, top: 120, alignItems: 'center' },
});
