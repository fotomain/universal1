// The commands of the task tree in the MAIN FAB (bottom right): for the selected task all its context menu items, else Add task / stage / milestone; Undo / Redo, Project settings.
// Shared by the Project dashboard and every screen that hosts the tree (view/project/tree/PMProjectTreeHost). `id` = the FAB source of the screen; `enabled` false = no commands (a picker window).
import { useMemo } from 'react';
import { FABContextAction, useFABContextActions } from '../../../../providers/FABProvider';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import type { useKanbanCommands } from '../../../crud/kanban/useKanbanCommands';
import type { usePMCrud } from '../../../crud/usePMCrud';
import { pmT } from '../../../i18n/pmT';
import { usePMKanbanStore } from '../../../store/store_kanban';
import { usePMStore } from '../../../store/store_pm';
import { openFillFromTemplate, openSaveToTemplate, openSavedTemplates } from '../../../tasktemplate';

export interface TreeFabOptions {
  ownerGUID: string | null | undefined;
  projectGUID: string | null;
  crud: ReturnType<typeof usePMCrud>;
  kanban: ReturnType<typeof useKanbanCommands>;
  enabled?: boolean;
  /** the Kanban view is on: the item "Kanban: to No state" and "Kanban Stages" */
  isKanbanView?: boolean;
}

export function useTreeFabActions(id: string, { ownerGUID, projectGUID, crud, kanban, enabled = true, isKanbanView = false }: TreeFabOptions) {
  const { themeColors } = useDesignSystem();
  const selectedTaskGUID = usePMStore((s) => s.selectedGUID);
  const currentTaskRow = usePMStore((s) => (s.selectedGUID ? s.tasksById[s.selectedGUID] : undefined));
  const selectedIsLeaf = usePMStore((s) => !!(s.selectedGUID && s.tasksById[s.selectedGUID] && !(s.tree.childrenById[s.selectedGUID]?.length)));
  const isSummary = usePMStore((s) => (s.selectedGUID ? !!s.schedule[s.selectedGUID]?.isSummary : false));
  const checkedCount = usePMStore((s) => Object.keys(s.checkedGUIDs).length);
  const undoCount = usePMStore((s) => s.undoCount);
  const redoCount = usePMStore((s) => s.redoCount);
  const fabActions = useMemo((): FABContextAction[] | null => {
    if (!ownerGUID || !enabled) return null;
    const sel = selectedTaskGUID && currentTaskRow ? selectedTaskGUID : null;
    const a: FABContextAction[] = [];
    if (!projectGUID) {
      a.push({ icon: 'plus', label: 'New project', onPress: () => usePMStore.getState().openProjectSettings('new') });
      return a;
    }
    if (sel) {
      // When a task of Tree is selected, main FAB has all task context menu items with their texts
      a.push({ icon: 'table-row-plus-after', label: 'Add task below', onPress: () => crud.createTaskBelow(sel) });
      a.push({ icon: 'table-row-plus-before', label: 'Add task above', onPress: () => crud.createTaskAbove(sel) });
      if (isSummary) {
        a.push({ icon: 'plus-circle-outline', label: 'Add task inside', onPress: () => crud.createTask(sel) });
      }
      a.push({ icon: 'folder-plus-outline', label: 'Add stage below', onPress: () => crud.createStageBelow(sel) });
      a.push({ icon: 'folder-upload-outline', label: 'Add stage above', onPress: () => crud.createStageAbove(sel) });
      a.push({ icon: 'pencil-outline', label: 'Edit', onPress: () => crud.edit(sel) });
      a.push({ icon: 'content-duplicate', label: 'Duplicate', onPress: () => crud.duplicateTask(sel) });
      a.push({ icon: 'bookmark-plus-outline', label: 'Save to template', onPress: () => openSaveToTemplate(sel) });
      a.push({ icon: 'content-paste', label: 'Fill from template', onPress: () => openFillFromTemplate(sel) });
      a.push({ icon: 'bookmark-multiple-outline', label: 'Templates saved', onPress: () => openSavedTemplates(sel) });
      a.push({ icon: 'content-copy', label: 'Copy task info', onPress: () => crud.copyTaskInfo(sel) });
      a.push({ icon: 'fingerprint', label: 'Copy GUID', onPress: () => crud.copyTaskGUID(sel) });
      a.push({ icon: 'share-variant', label: 'Share task', onPress: () => crud.shareTask(sel) });
      a.push({ icon: 'calendar-plus', label: 'Add to Google Calendar', onPress: () => crud.addToGoogleCalendar(sel) });
      a.push({ icon: 'link-variant', label: 'Link to…', onPress: () => crud.startLink(sel) });
      a.push({ icon: 'open-in-new', label: 'Open task info', onPress: () => crud.openInfo(sel) });
      if (isKanbanView && selectedIsLeaf) {
        a.push({ icon: 'layers-off-outline', label: 'Kanban: to "No state"', onPress: () => kanban.clearTreeRowKanbanState(sel) });
      }
      a.push({ icon: 'delete-outline', label: 'Delete', color: themeColors.error, onPress: () => crud.deleteTask(sel) });
    } else {
      // Default project actions when no task is selected
      a.push({ icon: 'plus', label: 'Add task', onPress: () => crud.createTask(null) });
      a.push({ icon: 'folder-plus-outline', label: 'Add stage', onPress: () => crud.createStage(null) });
      a.push({ icon: 'flag-outline', label: 'Add milestone', onPress: () => crud.createTask(null, 'milestone') });
    }

    if (checkedCount > 0) {
      a.push({ icon: 'sql_for_delete-sweep-outline', label: `Delete the ${checkedCount} selected rows`, color: themeColors.error, onPress: () => crud.deleteTasks(Object.keys(usePMStore.getState().checkedGUIDs)) });
      a.push({ icon: 'checkbox-multiple-blank-circle-outline', label: 'Clear the selection', onPress: () => usePMStore.getState().clearChecked() });
    }
    if (isKanbanView) a.push({ icon: 'view-column-outline', label: 'Kanban Stages', onPress: () => usePMKanbanStore.getState().openStagesEditor(projectGUID) });
    if (undoCount > 0) a.push({ icon: 'undo', label: 'Undo', onPress: () => crud.undoGanttAction() });
    if (redoCount > 0) a.push({ icon: 'redo', label: pmT('Redo'), onPress: () => crud.redoGanttAction() });
    a.push({ icon: 'cog-outline', label: 'Project settings', onPress: () => usePMStore.getState().openProjectSettings(projectGUID) });
    return a;
  }, [ownerGUID, enabled, projectGUID, selectedTaskGUID, currentTaskRow, isSummary, selectedIsLeaf, checkedCount, undoCount, redoCount, isKanbanView, crud, kanban, themeColors.error]);
  useFABContextActions(id, fabActions);
}
