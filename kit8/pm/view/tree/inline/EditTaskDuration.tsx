// Inline editor of the tree taskDuration cell: working duration.
// Formatted and parsed according to active planning units (planDay, planHour, planMinute, planSecond).
// Milestones (0 days) / stages are not editable.

import React from 'react';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../../store/store_pm';
import { formatPlanDuration, parsePlanDuration } from '../../../model/planDateFormats';
import { PMCrud } from '../../../crud/usePMCrud';
import PMInlineCellInput from './PMInlineCellInput';

export default function EditTaskDuration(props: {
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
  const planDay = usePMStore((s) => s.planDay);
  const planHour = usePMStore((s) => s.planHour);
  const planMinute = usePMStore((s) => s.planMinute);
  const planSecond = usePMStore((s) => s.planSecond);
  const units = { planDay, planHour, planMinute, planSecond };

  const durationDays = usePMStore(
    (s) => s.schedule[guid]?.durationDays ?? s.tasksById[guid]?.rowJSON.durationDays ?? 1
  );
  const initial = formatPlanDuration(durationDays, units);
  const close = () => usePMStore.getState().setCellEdit(null);

  return (
    <PMInlineCellInput
      {...props}
      testID={testID ?? `pm-tree-edit-taskDuration-${guid}`}
      initial={initial}
      sanitize={(t) =>
        planHour || planMinute || planSecond
          ? t.replace(/[^0-9a-zA-Z.: ]/g, '').slice(0, 10)
          : t.replace(/[^0-9]/g, '').slice(0, 6)
      }
      onCommit={(text) => {
        const days = parsePlanDuration(text, units);
        if (days === null || !Number.isFinite(days) || days <= 0) return 'Must be > 0';
        crud.setDurationDays(guid, days);
        close();
        return null;
      }}
      onCancel={close}
    />
  );
}
