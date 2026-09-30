// Inline editor of the tree taskStartDate cell: sets the "start no earlier than" constraint.
// Formatted and parsed according to project.rowJSON.planDateInputFormat.
// Empty = as soon as possible (constraint removed). Stages are rolled up.

import React from 'react';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../../store/store_pm';
import { formatPlanDate, parsePlanDate } from '../../../model/planDateFormats';
import { PMCrud } from '../../../crud/usePMCrud';
import PMInlineCellInput from './PMInlineCellInput';
import SelectDateApp from '../../../../components/common/SelectDateApp';

export default function EditTaskStartDate(props: {
  guid: string;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
  testID?: string;
}) {
  const { guid, crud, testID } = props;
  const planDateInputFormat = usePMStore((s) => s.planDateInputFormat);
  const initial = usePMStore((s) => {
    const r = s.schedule[guid];
    return r ? formatPlanDate(r.startMs, planDateInputFormat) : '';
  });
  const startMs = usePMStore((s) => s.schedule[guid]?.startMs);
  const close = () => usePMStore.getState().setCellEdit(null);

  return (
    <PMInlineCellInput
      {...props}
      testID={testID ?? `pm-tree-edit-taskStartDate-${guid}`}
      initial={initial}
      placeholder="ASAP"
      keyboardType="numbers-and-punctuation"
      sanitize={(t) => t.slice(0, 20)}
      rightElement={
        <SelectDateApp
          value={startMs}
          trigger="icon"
          testID={`pm-tree-select-date-start-${guid}`}
          style={{ width: 20, height: 20, marginRight: 2, borderWidth: 0 }}
          onSelect={(selectedDate) => {
            if (!selectedDate) {
              crud.setStartConstraint(guid, null);
            } else {
              const ms = Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
              crud.setStartConstraint(guid, ms);
            }
            close();
          }}
        />
      }
      onCommit={(text) => {
        if (!text.trim()) {
          crud.setStartConstraint(guid, null);
          close();
          return null;
        }
        const ms = parsePlanDate(text, planDateInputFormat, startMs);
        if (ms === null) return `Invalid (${planDateInputFormat})`;
        if (text !== initial) crud.setStartConstraint(guid, ms);
        close();
        return null;
      }}
      onCancel={close}
    />
  );
}

