// Inline editor of the tree "Days" cell (working days, >= 1). Milestones / stages are not editable.

import React from 'react';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../store';
import { PMCrud } from '../usePMCrud';
import PMInlineCellInput from './PMInlineCellInput';

export default function EditTaskDays(props: {
  guid: string;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
}) {
  const { guid, crud } = props;
  const days = usePMStore((s) => s.schedule[guid]?.durationDays ?? s.tasksById[guid]?.rowJSON.durationDays ?? 1);
  const close = () => usePMStore.getState().setCellEdit(null);
  return (
    <PMInlineCellInput
      {...props}
      testID={`pm-tree-edit-days-${guid}`}
      initial={String(days)}
      keyboardType="number-pad"
      sanitize={(t) => t.replace(/[^0-9]/g, '').slice(0, 5)}
      onCommit={(text) => {
        const n = parseInt(text, 10);
        if (!Number.isFinite(n) || n < 1) return 'at least 1 day';
        crud.setDurationDays(guid, n);
        close();
        return null;
      }}
      onCancel={close}
    />
  );
}
