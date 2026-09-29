// Inline editor of the tree "%" cell (0..100). Stages are rolled up, not editable.

import React from 'react';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../../store/store_pm';
import { PMCrud } from '../../../crud/usePMCrud';
import PMInlineCellInput from './PMInlineCellInput';

export default function EditTaskProgress(props: {
  guid: string;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
}) {
  const { guid, crud } = props;
  const progress = usePMStore((s) => Math.round(s.tasksById[guid]?.rowProgress ?? 0));
  const close = () => usePMStore.getState().setCellEdit(null);
  return (
    <PMInlineCellInput
      {...props}
      testID={`pm-tree-edit-progress-${guid}`}
      initial={String(progress)}
      keyboardType="number-pad"
      sanitize={(t) => t.replace(/[^0-9]/g, '').slice(0, 3)}
      onCommit={(text) => {
        const n = text === '' ? 0 : parseInt(text, 10);
        if (!Number.isFinite(n) || n < 0 || n > 100) return '0..100';
        crud.setProgress(guid, n);
        close();
        return null;
      }}
      onCancel={close}
    />
  );
}
