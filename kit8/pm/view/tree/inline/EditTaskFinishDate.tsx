// Inline editor of the tree taskFinishDate cell: sets the finish date of a task.
// Formatted and parsed according to project.rowJSON.planDateInputFormat.
// Editing the finish date recalculates taskDuration based on taskStartDate and active planning units.

import React, { useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../../store/store_pm';
import { formatPlanDate, parsePlanDate } from '../../../model/planDateFormats';
import { DAY_MS } from '../../../model/constants';
import { utcMidnight, workDaysBetween } from '../../project/scheduling';
import { PMCrud } from '../../../crud/usePMCrud';
import PMInlineCellInput from './PMInlineCellInput';
import SelectDateApp from '../../../../components/common/SelectDateApp';
import IconApp from '../../../../components/common/IconApp';

export default function EditTaskFinishDate(props: {
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
  const planDay = usePMStore((s) => s.planDay);
  const planHour = usePMStore((s) => s.planHour);
  const planMinute = usePMStore((s) => s.planMinute);
  const planSecond = usePMStore((s) => s.planSecond);
  const isSubDay = planHour || planMinute || planSecond;

  const project = usePMStore((s) =>
    s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID] : undefined
  );
  const scheduled = usePMStore((s) => s.schedule[guid]);

  const finishDisplayMs = scheduled
    ? isSubDay
      ? scheduled.finishMs
      : scheduled.finishMs > scheduled.startMs
      ? scheduled.finishMs - 1
      : scheduled.startMs
    : 0;

  const initial = scheduled ? formatPlanDate(finishDisplayMs, planDateInputFormat) : '';
  const close = () => usePMStore.getState().setCellEdit(null);

  return (
    <PMInlineCellInput
      {...props}
      testID={testID ?? `pm-tree-edit-taskFinishDate-${guid}`}
      initial={initial}
      placeholder={planDateInputFormat}
      keyboardType="numbers-and-punctuation"
      sanitize={(t) => t.slice(0, 20)}
      preventBlur={pickerOpen}
      align="left"
      // web only: close = clear button at the left; the date picker stays at the right
      leftElement={
        Platform.OS === 'web'
          ? (_currentText, clear) => (
          <Pressable
            testID={`pm-tree-clear-date-finish-${guid}`}
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
        const parsed = currentText ? parsePlanDate(currentText, planDateInputFormat, finishDisplayMs) : null;
        return (
          <SelectDateApp
            value={parsed ?? finishDisplayMs}
            trigger="icon"
            testID={`pm-tree-select-date-finish-${guid}`}
            style={{ width: 20, height: 20, borderWidth: 0 }}
            onOpen={() => setPickerOpen(true)}
            onDismiss={() => setPickerOpen(false)}
            onSelect={(selectedDate) => {
              setPickerOpen(false);
              if (!selectedDate || !scheduled) {
                close();
                return;
              }
              const ms = Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
              if (isSubDay) {
                const diffMs = ms - scheduled.startMs;
                if (diffMs > 0) {
                  crud.setDurationDays(guid, diffMs / DAY_MS);
                }
              } else {
                const newFinishInstant = utcMidnight(ms) + DAY_MS;
                if (newFinishInstant > scheduled.startMs) {
                  const calendar = { skipWeekends: !!project?.rowJSON.skipWeekends };
                  const days = workDaysBetween(scheduled.startMs, newFinishInstant, calendar);
                  if (days >= 1) crud.setDurationDays(guid, days);
                }
              }
              close();
            }}
          />
        );
      }}
      onCommit={(text) => {
        if (!text.trim()) {
          close();
          return null;
        }
        if (!scheduled) {
          close();
          return null;
        }
        const ms = parsePlanDate(text, planDateInputFormat, finishDisplayMs);
        if (ms === null) return `Invalid (${planDateInputFormat})`;

        if (isSubDay) {
          const diffMs = ms - scheduled.startMs;
          if (diffMs <= 0) return 'Finish must be after start';
          const newDays = diffMs / DAY_MS;
          crud.setDurationDays(guid, newDays);
        } else {
          const newFinishInstant = utcMidnight(ms) + DAY_MS;
          if (newFinishInstant <= scheduled.startMs) return 'Finish must be after start';
          const calendar = { skipWeekends: !!project?.rowJSON.skipWeekends };
          const days = workDaysBetween(scheduled.startMs, newFinishInstant, calendar);
          if (days < 1) return 'Finish must be after start';
          crud.setDurationDays(guid, days);
        }
        close();
        return null;
      }}
      onCancel={close}
    />
  );
}
