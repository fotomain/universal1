// PMTreeScheduleIcon - the cell of the "Schedule" (indicators) column of the task tree (between the subproject and the posted column; the column exists only while a row has a mark):
//   a pin = manually scheduled, a lock = a constraint, pending = edited but not calculated (Manual calculation), DARK ORANGE warning / flag = a date and a link disagree / the deadline is missed.
//   The tip says why (hover / tap / long press, like the posted icon). kit8/pm/view/project/scheduleMarks.ts
import React, { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import IconApp from '../../../../ui/components/common/IconApp';
import { hidePMTip, usePMTip } from '../../../inner/tooltip/PMTooltip';
import { SUBPROJECT_CONFLICT_COLOR } from '../../../subproject/subprojectMarks';
import type { PMScheduleMark } from '../../project/scheduleMarks';

/** width of the column (px) */
export const PM_TREE_SCHEDULE_WIDTH = 24;
const TAP_TIP_MS = 2500;

export default function PMTreeScheduleIcon({ mark, testID, height, color }: { mark: PMScheduleMark; testID: string; height: number; color: string }) {
  const tip = usePMTip(mark.tip);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const showTip = () => {
    (tip.onLongPress ?? tip.onHoverIn)?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hidePMTip, TAP_TIP_MS);
  };
  return (
    <Pressable
      ref={tip.ref as any}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={mark.tip}
      accessibilityHint={tip.accessibilityHint}
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPress={showTip}
      onLongPress={tip.onLongPress}
      delayLongPress={tip.delayLongPress}
      style={{ width: PM_TREE_SCHEDULE_WIDTH, height, alignItems: 'center', justifyContent: 'center' }}
    >
      <IconApp name={mark.icon} size={16} color={mark.conflict ? SUBPROJECT_CONFLICT_COLOR : color} />
    </Pressable>
  );
}
