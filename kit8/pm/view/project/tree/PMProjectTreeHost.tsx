// PMProjectTreeHost - the TASK TREE of the Project dashboard as a reusable block: any screen puts it where it needs a project's tasks (Estimation dashboard: the Estimate tab).
// It does what the dashboard does around the tree and nothing else: selects the project in the PM store, reads its tasks (+ Realtime, the lines of the tasks, Kanban, schedule write-back,
// subproject marks), shows the Skia tree (PMGanttSurface) with a pane of the caller on the RIGHT, keeps the keyboard (Ctrl+Z, Del, Enter, Alt+arrows, Tab ...) and the main FAB commands,
// and mounts the windows the tree opens (edit task, row menu, column menus, templates ...). A click on a row selects it in the PM store (`selectedGUID`): the pane reads it from there.
// The right pane: `renderRight` (rightPane 'custom') or any other pane PMGanttSurface knows (`rightPane`).
// Only ONE host (or the Project dashboard) may be mounted at a time: the PM store holds ONE selected project.
import { DEFAULT_PM_TREE_LABELS, PMTreeLabelsContext, type PMTreeLabels } from '../../tree/toolbars/treeToolbarLabels';
import React from 'react';
import { Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import ActivityIndicatorCircleApp from '../../../../ui/components/activityindicator/ActivityIndicatorCircleApp';
import { useKanbanCommands } from '../../../crud/kanban/useKanbanCommands';
import { useReadProjectKanbanQuery } from '../../../crud/kanban/kanbanQueries';
import { useKanbanRealtime } from '../../../crud/kanban/useKanbanRealtime';
import { usePMOwnerGUID, useProjectRealtime, useReadProjectDataQuery, useReadProjectsQuery, useReadProjectUserSettingsQuery, useScheduleWriteBack } from '../../../crud/queries';
import { usePMCrud } from '../../../crud/usePMCrud';
import { pmT } from '../../../i18n/pmT';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { useProjectSubprojectMarks } from '../../../subproject/useProjectSubprojectMarks';
import { usePMStore } from '../../../store/store_pm';
import PMGanttSurfaceLoader from '../../gantt/PMGanttSurfaceLoader';
import type { PMGanttSurfaceProps } from '../../gantt/PMGanttSurface';
import { useProjectTaskLinesRealtime } from '../../task/plan/useProjectTaskLines';
import PMUndoProvider from '../../undo/PMUndoProvider';
import PMTreeWindows from './PMTreeWindows';
import { useTreeFabActions } from './useTreeFabActions';
import { useTreeScopeSelection } from './useTreeScopeSelection';
import { useTreeKeyboardShortcuts } from './useTreeKeyboardShortcuts';

export interface PMProjectTreeHostProps {
  projectGUID: string;
  readOnly?: boolean;
  /** the pane right of the tree (rightPane 'custom') */
  renderRight?: PMGanttSurfaceProps['renderRight'];
  /** another pane of PMGanttSurface instead (default 'custom' when renderRight is given, else 'gantt') */
  rightPane?: PMGanttSurfaceProps['rightPane'];
  /** id of the main FAB source of the screen */
  fabId?: string;
  /** the name under which this screen remembers its last project / task (default: fabId) */
  scope?: string;
  /** text of an empty project (the button "Add the first stage" stays) */
  emptyText?: string;
  hideRight?: boolean;
  hideToolbars?: boolean;
  /** the words of the "+ Stage" / "+ Task" buttons (default Stage / Task; the Estimation dashboard: Section / Line) */
  labels?: PMTreeLabels;
}

export default function PMProjectTreeHost(props: PMProjectTreeHostProps) {
  return (
    <PMUndoProvider>
      <PMProjectTreeHostInner {...props} />
    </PMUndoProvider>
  );
}

function PMProjectTreeHostInner({ projectGUID, readOnly = false, renderRight, rightPane, fabId = 'pm-project-tree', scope, emptyText, hideRight, hideToolbars, labels = DEFAULT_PM_TREE_LABELS }: PMProjectTreeHostProps) {
  const { themeColors } = useDesignSystem();
  const ownerGUID = usePMOwnerGUID();
  const loadedProjectGUID = usePMStore((s) => s.loadedProjectGUID);
  // the tasks of the project, NOT the rows the tree shows now: a filter that matches nothing must not turn the screen into the "empty project" view (the panes would unmount and lose the filter)
  const rowCount = usePMStore((s) => s.tasks.length);

  useReadProjectsQuery(ownerGUID);
  useReadProjectUserSettingsQuery(ownerGUID);
  // this screen selects ITS project while it is focused (the Project dashboard keeps its own); its last task is remembered separately
  useTreeScopeSelection(scope ?? fabId, { forcedProjectGUID: projectGUID });
  const dataQuery = useReadProjectDataQuery(projectGUID);
  useProjectRealtime(ownerGUID, projectGUID);
  useProjectTaskLinesRealtime(ownerGUID ? projectGUID : null); // the lines of every task (the posted column of the tree)
  useReadProjectKanbanQuery(ownerGUID ? projectGUID : null);
  useKanbanRealtime(ownerGUID, projectGUID);
  useScheduleWriteBack(projectGUID);
  useProjectSubprojectMarks(projectGUID);
  const crud = usePMCrud(ownerGUID, projectGUID);
  const kanban = useKanbanCommands(projectGUID);
  useTreeKeyboardShortcuts(crud, !readOnly);
  useTreeFabActions(fabId, { ownerGUID, projectGUID, crud, kanban, enabled: !readOnly });

  const ready = !!ownerGUID && loadedProjectGUID === projectGUID && !dataQuery.isFetching;
  const error = dataQuery.error as Error | null;

  return (
    <PMTreeLabelsContext.Provider value={labels}>
    <View testID="pm-project-tree-host" style={{ flex: 1, backgroundColor: themeColors.background }}>
      {!ownerGUID ? (
        <Centered><Text style={{ color: themeColors.text }}>{pmT('Sign in to manage projects')}</Text></Centered>
      ) : error ? (
        <Centered><Text style={{ color: themeColors.error }}>{pmT('Could not load projects')}: {error.message}</Text></Centered>
      ) : !ready && loadedProjectGUID !== projectGUID ? (
        <Centered><ActivityIndicatorCircleApp testID="pm-project-tree-loading" /></Centered>
      ) : rowCount === 0 ? (
        <Centered>
          <Text testID="pm-project-tree-empty" style={{ color: themeColors.text, marginBottom: 10, textAlign: 'center' }}>{emptyText ?? pmT('This project has no tasks yet.')}</Text>
          <PMDialogButton testID="pm-project-tree-add-stage" kind="primary" icon="create_new_folder" title={labels === DEFAULT_PM_TREE_LABELS ? pmT('Add the first stage') : `Add the first ${labels.stage.toLowerCase()}`} disabled={readOnly} onPress={() => crud.createStage()} />
        </Centered>
      ) : (
        <PMGanttSurfaceLoader
          ownerGUID={ownerGUID}
          projectGUID={projectGUID}
          rightPane={rightPane ?? (renderRight ? 'custom' : 'gantt')}
          renderRight={renderRight}
          readOnly={readOnly}
          hideRight={hideRight}
          hideToolbars={hideToolbars}
        />
      )}
      <PMTreeWindows ownerGUID={ownerGUID ?? ''} projectGUID={projectGUID} crud={crud} kanban={kanban} />
    </View>
    </PMTreeLabelsContext.Provider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</View>;
}
