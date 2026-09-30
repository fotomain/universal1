// Inline editor for sub-day planning units (startHourStart, startHourFinish,
// planMinuteStart, planMinuteFinish, planSecondStart, planSecondFinish).
// Saves directly to task.rowJSON.[field], undoable via crud.updateTask.

import React from 'react';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../../store/store_pm';
import { PMCrud } from '../../../crud/usePMCrud';
import PMInlineCellInput from './PMInlineCellInput';

export type PMPlanningUnitField =
  | 'startHourStart'
  | 'startHourFinish'
  | 'planMinuteStart'
  | 'planMinuteFinish'
  | 'planSecondStart'
  | 'planSecondFinish';

export default function EditTaskPlanningUnitField(props: {
  guid: string;
  field: PMPlanningUnitField;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
  testID?: string;
}) {
  const { guid, field, crud, testID } = props;
  const isHour = field.includes('Hour');
  const max = isHour ? 23 : 59;
  const placeholder = isHour ? '0-23' : '0-59';

  const planHour = usePMStore((s) => s.planHour);
  const planMinute = usePMStore((s) => s.planMinute);
  const planSecond = usePMStore((s) => s.planSecond);
  const isSubDay = planHour || planMinute || planSecond;

  const initial = usePMStore((s) => {
    const t = s.tasksById[guid];
    const val = t?.rowJSON?.[field];
    if (typeof val === 'number') return String(val);
    const r = s.schedule[guid];
    if (!r) return '';
    const isStart = field.endsWith('Start');
    const ms = isStart
      ? r.startMs
      : isSubDay
      ? r.finishMs
      : r.finishMs > r.startMs
      ? r.finishMs - 1
      : r.startMs;
    const d = new Date(ms);
    if (isHour) return String(d.getUTCHours());
    if (field.includes('Minute')) return String(d.getUTCMinutes());
    return String(d.getUTCSeconds());
  });

  const close = () => usePMStore.getState().setCellEdit(null);

  return (
    <PMInlineCellInput
      {...props}
      testID={testID ?? `pm-tree-edit-${field}-${guid}`}
      initial={initial}
      placeholder={placeholder}
      keyboardType="number-pad"
      align="right"
      sanitize={(t) => t.replace(/[^0-9]/g, '').slice(0, 2)}
      onCommit={(text) => {
        const trimmed = text.trim();
        const t = usePMStore.getState().tasksById[guid];
        if (!t) {
          close();
          return null;
        }
        if (!trimmed) {
          const next = { ...t.rowJSON };
          delete (next as any)[field];
          crud.updateTask(guid, { rowJSON: next }, `Clear ${field}`);
          close();
          return null;
        }
        const num = parseInt(trimmed, 10);
        if (isNaN(num) || num < 0 || num > max) {
          return `0 - ${max}`;
        }
        const next = { ...t.rowJSON, [field]: num };
        crud.updateTask(guid, { rowJSON: next }, `Set ${field}`);
        close();
        return null;
      }}
      onCancel={close}
    />
  );
}
