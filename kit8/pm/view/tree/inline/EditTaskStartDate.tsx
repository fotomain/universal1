// Inline editor of the tree taskStartDate cell: sets the "start no earlier than" constraint.
// Formatted and parsed according to project.rowJSON.planDateInputFormat.
// Empty = as soon as possible (constraint removed). Stages are rolled up.

import React, { useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../../store/store_pm';
import { formatPlanDate, parsePlanDate } from '../../../model/planDateFormats';
import { PMCrud } from '../../../crud/usePMCrud';
import PMInlineCellInput from './PMInlineCellInput';
import SelectDateApp from '../../../../ui/components/common/SelectDateApp';
import IconApp from '../../../../ui/components/common/IconApp';
import { pmT } from '../../../i18n/pmT';

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
  const [pickerOpen, setPickerOpen] = useState(false);
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
      placeholder={pmT('ASAP')}
      keyboardType="numbers-and-punctuation"
      sanitize={(t) => t.slice(0, 20)}
      preventBlur={pickerOpen}
      align="left"
      // web only: close = clear button at the left; the date picker stays at the right
      leftElement={
        Platform.OS === 'web'
          ? (_currentText, clear) => (
          <Pressable
            testID={`pm-tree-clear-date-start-${guid}`}
            onPress={clear}
            hitSlop={4}
            style={{ width: 18, height: 20, alignItems: 'center', justifyContent: 'center' }}
            {...({ onMouseDown: (e: any) => e.preventDefault() } as any)}
          >
            <IconApp name="close" size={14} color={props.colors.text} />
          </Pressable>
            )
          : undefined
      }
      rightElement={(currentText) => {
        const parsed = currentText ? parsePlanDate(currentText, planDateInputFormat, startMs) : null;
        return (
          <SelectDateApp
            value={parsed ?? startMs}
            trigger="icon"
            testID={`pm-tree-select-date-start-${guid}`}
            style={{ width: 20, height: 20, borderWidth: 0 }}
            onOpen={() => setPickerOpen(true)}
            onDismiss={() => setPickerOpen(false)}
            onSelect={(selectedDate) => {
              setPickerOpen(false);
              if (!selectedDate) {
                crud.setStartConstraint(guid, null);
              } else {
                const ms = Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                crud.setStartConstraint(guid, ms);
              }
              close();
            }}
          />
        );
      }}
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

