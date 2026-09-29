// Inline editor of the tree "Start" cell: sets the "start no earlier than" constraint
// (YYYY-MM-DD). Empty = as soon as possible (constraint removed). Stages are rolled up.

import React from 'react';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../../store/store_pm';
import { formatDateISO, parseDateISO } from '../../project/scheduling';
import { PMCrud } from '../../../crud/usePMCrud';
import PMInlineCellInput from './PMInlineCellInput';

export default function EditTaskStart(props: {
  guid: string;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
}) {
  const { guid, crud } = props;
  const initial = usePMStore((s) => {
    const r = s.schedule[guid];
    return r ? formatDateISO(r.startMs) : '';
  });
  const close = () => usePMStore.getState().setCellEdit(null);
  return (
    <PMInlineCellInput
      {...props}
      testID={`pm-tree-edit-start-${guid}`}
      initial={initial}
      placeholder="ASAP"
      keyboardType="numbers-and-punctuation"
      sanitize={(t) => t.replace(/[^0-9-]/g, '').slice(0, 10)}
      onCommit={(text) => {
        if (!text) {
          crud.setStartConstraint(guid, null);
          close();
          return null;
        }
        const ms = parseDateISO(text);
        if (ms === null) return 'YYYY-MM-DD';
        if (text !== initial) crud.setStartConstraint(guid, ms);
        close();
        return null;
      }}
      onCancel={close}
    />
  );
}
