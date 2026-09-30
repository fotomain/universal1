// Inline editor of the tree "Kanban %" (kanbanStageProgressPercent) cell (0..100).
// Independent of the task progress % (rowProgress).

import React, { useMemo } from 'react';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../../store/store_pm';
import { usePMKanbanStore } from '../../../store/store_kanban';
import { useKanbanCommands } from '../../../crud/kanban/useKanbanCommands';
import { PMCrud } from '../../../crud/usePMCrud';
import { derivedKanbanProgress, kanbanLeavesOf } from '../../kanban/kanbanModel';
import { kanbanStageProgressOf } from '../../../model/kanbanTypes';
import PMInlineCellInput from './PMInlineCellInput';

export interface EditTaskKanbanProgressProps {
  guid: string;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
}

export default function EditTaskKanbanProgress(props: EditTaskKanbanProgressProps) {
  const { guid } = props;
  const projectGUID = usePMStore((s) => s.selectedProjectGUID);
  const tasksById = usePMStore((s) => s.tasksById);
  const tree = usePMStore((s) => s.tree);
  const schedule = usePMStore((s) => s.schedule);

  const statesByTask = usePMKanbanStore((s) => s.statesByTask);
  const kanban = useKanbanCommands(projectGUID);

  const isSummary = useMemo(
    () => !!schedule[guid]?.isSummary || (tree.childrenById[guid]?.length ?? 0) > 0,
    [schedule, tree, guid]
  );

  const progress = useMemo(() => {
    if (isSummary) {
      return derivedKanbanProgress(guid, tasksById, tree, statesByTask);
    }
    return kanbanStageProgressOf(statesByTask[guid], 0);
  }, [guid, isSummary, tasksById, tree, statesByTask]);

  const close = () => usePMStore.getState().setCellEdit(null);

  return (
    <PMInlineCellInput
      {...props}
      testID={`pm-tree-edit-kanban-progress-${guid}`}
      initial={String(progress)}
      keyboardType="number-pad"
      sanitize={(t) => t.replace(/[^0-9]/g, '').slice(0, 3)}
      onCommit={(text) => {
        const n = text === '' ? 0 : parseInt(text, 10);
        if (!Number.isFinite(n) || n < 0 || n > 100) return '0..100';
        if (isSummary) {
          const leaves = kanbanLeavesOf(guid, tasksById, tree);
          if (leaves.length) kanban.setTasksKanbanProgress(leaves, n);
        } else {
          kanban.setTaskKanbanProgress(guid, n);
        }
        close();
        return null;
      }}
      onCancel={close}
    />
  );
}
