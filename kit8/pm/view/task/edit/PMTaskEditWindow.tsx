// PMTaskEditWindow - the task in a window of its own: /pm/project/task/edit?taskGUID=…&projectGUID=…&tab=…
// (a double click on a task of the Gantt chart opens it in a NEW browser window, taskEditWindowLink.ts).
//   1st level tabs
//     TabTaskEditMain  the task form of PMTaskEditModal (the same component, embedded: 2nd level tabs Main · UX/UI, Delete · Details · Cancel · Save; Save keeps the window open)
//     TabTaskEditPlan  PMTaskEditView: the lines of the task (Time · Material · Expense · Revenue), the title can be typed over
//     TabTaskEditFact  2nd level tab TabFactInput: the list of the fact input documents of the task (PMFactInputDocumentList with the scope of the task; a click on a row opens
//                      the document); created on the first visit
// Both tabs stay mounted (an unsaved form is not lost when the user looks at the lines). Like the task page it finds the project of the task, loads its data and follows Realtime.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import ActivityIndicatorCircleApp from '../../../../ui/components/activityindicator/ActivityIndicatorCircleApp';
import { PM_ROUTES } from '../../../model/constants';
import { usePMStore } from '../../../store/store_pm';
import { usePMOwnerGUID, useProjectRealtime, useReadProjectDataQuery, useReadProjectsQuery, useReadProjectUserSettingsQuery, useReadTaskQuery } from '../../../crud/queries';
import { usePMCrud } from '../../../crud/usePMCrud';
import { useKanbanCommands } from '../../../crud/kanban/useKanbanCommands';
import { makePMPalette } from '../../theme';
import PMUndoProvider from '../../undo/PMUndoProvider';
import PMApproveYesNoCancelModalWindow from '../../../inner/PMApproveYesNoCancelModalWindow';
import { PMDialogButton } from '../../../inner/buttons';
import { PMTooltipLayer } from '../../../inner/tooltip/PMTooltip';
import { pmT, usePMLanguage } from '../../../i18n/pmT';
import PMTaskEditModal from '../PMTaskEditModal';
import PMTaskEditView from '../finances/PMTaskEditView';
import TabTaskEditFact from './TabTaskEditFact';
import { DEFAULT_TASK_EDIT_WINDOW_TAB, TaskEditWindowTab } from './taskEditWindowLink';
import ScrollableTabBar from '../../../../ui/components/tabs/ScrollableTabBar';

export const TASK_EDIT_WINDOW_TAB_LIST: { id: TaskEditWindowTab; label: string; icon: string }[] = [
  { id: 'TabTaskEditMain', label: 'Main', icon: 'edit' },
  { id: 'TabTaskEditPlan', label: 'Plan', icon: 'payments' },
  { id: 'TabTaskEditFact', label: 'Fact', icon: 'fact_check' },
];

export default function PMTaskEditWindow(props: { taskGUID: string; projectGUID?: string; tab?: TaskEditWindowTab }) {
  const language = usePMLanguage();
  return (
    <PMUndoProvider>
      <PMTaskEditWindowInner key={language} {...props} />
    </PMUndoProvider>
  );
}

function PMTaskEditWindowInner({ taskGUID, projectGUID: projectHint, tab: initialTab }: { taskGUID: string; projectGUID?: string; tab?: TaskEditWindowTab }) {
  const { themeColors, isDark } = useDesignSystem();
  const router = useRouter();
  const ownerGUID = usePMOwnerGUID();
  const [activeTab, setActiveTab] = useState<TaskEditWindowTab>(initialTab ?? DEFAULT_TASK_EDIT_WINDOW_TAB);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // the fact list reads from the database: created when its tab is first opened, then kept
  const [factVisited, setFactVisited] = useState(initialTab === 'TabTaskEditFact');
  useEffect(() => { if (activeTab === 'TabTaskEditFact') setFactVisited(true); }, [activeTab]);

  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const task = usePMStore((s) => s.tasksById[taskGUID]);
  const ready = usePMStore((s) => !!s.tasksById[taskGUID] && !!s.schedule[taskGUID]);
  const criticalColor = usePMStore((s) => s.criticalPathTaskColor);
  const palette = useMemo(() => makePMPalette(themeColors, isDark, criticalColor), [themeColors, isDark, criticalColor]);

  // a deep link: find the project of the task, select it, load its data (like the task page)
  const taskQuery = useReadTaskQuery(!task ? taskGUID : null);
  const projectGUID = task?.projectGUID || taskQuery.data?.projectGUID || projectHint || null;
  useReadProjectsQuery(ownerGUID);
  useReadProjectUserSettingsQuery(ownerGUID);
  useEffect(() => {
    if (projectGUID && projectGUID !== selectedProjectGUID) usePMStore.getState().selectProject(projectGUID);
  }, [projectGUID, selectedProjectGUID]);
  const dataQuery = useReadProjectDataQuery(projectGUID);
  useProjectRealtime(ownerGUID, projectGUID); // edits from other browsers refresh this window too
  const crud = usePMCrud(ownerGUID, projectGUID);
  const kanban = useKanbanCommands(projectGUID);

  // TabTaskEditPlan shows the lines of the selected task: it is THIS task
  useEffect(() => {
    if (task && usePMStore.getState().selectedGUID !== taskGUID) usePMStore.getState().setSelected(taskGUID);
  }, [task, taskGUID]);

  // X / Cancel: a window opened by the Gantt chart closes; otherwise (a link typed in a tab) the dashboard
  const closeWindow = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.close();
        if (window.closed) return;
      } catch {
        // not a window opened by a script: the dashboard below
      }
    }
    router.navigate(PM_ROUTES.dashboard as any);
  }, [router]);

  const loading = !task && (taskQuery.isLoading || dataQuery.isLoading || (!!projectGUID && !dataQuery.isFetched));
  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }} testID="pm-task-edit-window">
      {/* 1st level tabs */}
      <ScrollableTabBar testID="pm-task-edit-window-tabs" style={[styles.tabsBar, { borderBottomColor: themeColors.border }]}>
        {TASK_EDIT_WINDOW_TAB_LIST.map((t) => {
          const active = activeTab === t.id;
          return (
            <Pressable
              key={t.id}
              testID={`pm-task-edit-window-${t.id}`}
              accessibilityRole="tab"
              aria-selected={active}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tab, { borderBottomColor: active ? themeColors.primary : 'transparent', backgroundColor: active ? `${themeColors.primary}18` : 'transparent' }]}
            >
              <IconApp name={t.icon} size={16} color={active ? themeColors.primary : themeColors.text} />
              <Text style={{ fontSize: 13, color: active ? themeColors.primary : themeColors.text, fontWeight: active ? '700' : '500' }}>{pmT(t.label)}</Text>
            </Pressable>
          );
        })}
      </ScrollableTabBar>

      {!taskGUID ? (
        <Notice testID="pm-task-edit-window-nolink" text={pmT('No task in the link.')} />
      ) : !ready ? (
        loading ? (
          <View style={styles.center} testID="pm-task-edit-window-loading"><ActivityIndicatorCircleApp size="large" color={themeColors.primary} /></View>
        ) : (
          <Notice testID="pm-task-edit-window-missing" text={pmT('This task does not exist (deleted?).')} action={<PMDialogButton testID="pm-task-edit-window-close" kind="primary" title={pmT('Close')} onPress={closeWindow} />} />
        )
      ) : (
        <View style={{ flex: 1 }} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <View style={activeTab === 'TabTaskEditMain' ? styles.fill : styles.hidden} testID="pm-task-edit-window-main">
            <PMTaskEditModal embedded guid={taskGUID} crud={crud} kanban={kanban} closeOnSave={false} onClose={closeWindow} />
          </View>
          <View style={activeTab === 'TabTaskEditPlan' ? styles.fill : styles.hidden} testID="pm-task-edit-window-plan">
            {projectGUID && size.w > 0 ? <PMTaskEditView projectGUID={projectGUID} width={size.w} height={size.h} palette={palette} crud={crud} /> : null}
          </View>
          <View style={activeTab === 'TabTaskEditFact' ? styles.fill : styles.hidden} testID="pm-task-edit-window-fact">
            {factVisited ? <TabTaskEditFact projectGUID={projectGUID} taskGUID={taskGUID} /> : null}
          </View>
        </View>
      )}
      <PMApproveYesNoCancelModalWindow />
      <PMTooltipLayer />
    </View>
  );
}

function Notice({ text, action, testID }: { text: string; action?: React.ReactNode; testID: string }) {
  const { themeColors } = useDesignSystem();
  return (
    <View style={styles.center} testID={testID}>
      <Text style={{ color: themeColors.text, fontSize: 15, marginBottom: 12 }}>{text}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderBottomWidth: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
