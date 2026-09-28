// "+ Project" (same width as "Critical path" on the Gantt bar).

import React from 'react';
import { PM_WIDE_ACTION_WIDTH } from '../constants';
import { usePMTip } from '../PMTooltip';
import ButtonApp from '../../components/common/ButtonApp';

export default function PMAddProjectButton({ onPress, compact }: { onPress: () => void; compact?: boolean }) {
  const tip = usePMTip('New project');
  return (
    <ButtonApp
      ref={tip.ref}
      testID="pm-project-add"
      variant="contained"
      size="small"
      icon="add"
      title={compact ? undefined : 'Project'}
      accessibilityLabel="New project"
      width={compact ? undefined : PM_WIDE_ACTION_WIDTH}
      onPress={onPress}
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPressIn={tip.onPressIn}
      onLongPress={tip.onLongPress}
      delayLongPress={tip.delayLongPress}
      style={{ marginVertical: 0, marginLeft: 4 }}
    />
  );
}
