// PMTreeSubprojectIcon - the cell of the subproject column of the task tree (left of the posted column; the column exists only in a project that has a task standing for a subproject):
//   the subproject icon (account_tree) in the primary color; DARK ORANGE while the dates of the origin task differ from the subproject. The tip names the subproject (hover / tap / long press, like the posted icon).
import React, { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import IconApp from '../../../../ui/components/common/IconApp';
import { hidePMTip, usePMTip } from '../../../inner/tooltip/PMTooltip';
import { PMSubprojectMark, SUBPROJECT_CONFLICT_COLOR } from '../../../subproject/subprojectMarks';

/** width of the column (px) */
export const PM_TREE_SUBPROJECT_WIDTH = 24;
const TAP_TIP_MS = 2500;

export default function PMTreeSubprojectIcon({ mark, testID, height, color }: { mark: PMSubprojectMark; testID: string; height: number; color: string }) {
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
      style={{ width: PM_TREE_SUBPROJECT_WIDTH, height, alignItems: 'center', justifyContent: 'center' }}
    >
      <IconApp name={mark.conflict ? 'warning' : 'account_tree'} size={16} color={mark.conflict ? SUBPROJECT_CONFLICT_COLOR : color} />
    </Pressable>
  );
}
