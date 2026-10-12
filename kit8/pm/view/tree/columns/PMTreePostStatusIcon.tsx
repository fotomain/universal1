// PMTreePostStatusIcon - the cell of the "posted" column of the task tree (the small column right before the grid, after the select column):
//   not posted        -> nothing (an empty space; the tree does not render a cell)
//   posted            -> a check sign, GREEN
//   posted and changed-> a check sign, DARK ORANGE (a line changed after posting: the days in the plan are out of date)
// Every icon has a tip: hover on the web, and a TAP (a finger has no hover) or long press on touch devices - the tip hides itself after a moment.
import React, { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import IconApp from '../../../../ui/components/common/IconApp';
import { hidePMTip, usePMTip } from '../../../inner/tooltip/PMTooltip';
import { pmT } from '../../../i18n/pmT';
import type { TaskPostIndicator } from '../../task/plan/useProjectTaskLines';

/** width of the column (px) */
export const PM_TREE_POST_STATUS_WIDTH = 26;
export const PM_POST_STATUS_COLOR: Record<TaskPostIndicator, string> = { posted: '#16a34a', changed: '#c2410c' };
export const PM_POST_STATUS_TIP: Record<TaskPostIndicator, string> = {
  posted: 'Posted: the plan of this task is up to date',
  changed: 'Posted and changed: a line changed after posting - post the task again',
};
/** how long a tip opened by a tap stays */
const TAP_TIP_MS = 2500;

export default function PMTreePostStatusIcon({ indicator, testID, height }: { indicator: TaskPostIndicator; testID: string; height: number }) {
  const tip = usePMTip(PM_POST_STATUS_TIP[indicator]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // web: onHoverIn · native: onLongPress - a plain tap does the same, so the tip also appears on touch screens (mobile browsers have no hover)
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
      accessibilityLabel={pmT(PM_POST_STATUS_TIP[indicator])}
      accessibilityHint={tip.accessibilityHint}
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPress={showTip}
      onLongPress={tip.onLongPress}
      delayLongPress={tip.delayLongPress}
      style={{ width: PM_TREE_POST_STATUS_WIDTH, height, alignItems: 'center', justifyContent: 'center' }}
    >
      <IconApp name="check" size={18} color={PM_POST_STATUS_COLOR[indicator]} />
    </Pressable>
  );
}
