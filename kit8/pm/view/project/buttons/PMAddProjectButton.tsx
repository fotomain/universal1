// "+ Project" (same width and height as "Critical path" on the Gantt bar).

import React from 'react';
import { PM_WIDE_ACTION_HEIGHT, PM_WIDE_ACTION_WIDTH } from '../../../model/constants';
import { usePMTip } from '../../../inner/tooltip/PMTooltip';
import ButtonApp from '../../../../components/common/ButtonApp';
import { pmT } from '../../../i18n/pmT';

export default function PMAddProjectButton({ onPress, compact }: { onPress: (e?: any) => void; compact?: boolean }) {
  const tip = usePMTip('New project');
  return (
    <ButtonApp
      ref={tip.ref}
      testID="pm-project-add"
      variant="contained"
      size="small"
      icon="add"
      title={compact ? undefined : 'Project'}
      accessibilityLabel={pmT('New project')}
      width={compact ? undefined : PM_WIDE_ACTION_WIDTH}
      onPress={onPress}
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPressIn={tip.onPressIn}
      onLongPress={tip.onLongPress}
      delayLongPress={tip.delayLongPress}
      style={[
        { marginVertical: 0, marginLeft: 0, marginRight: 2 },
        compact ? null : { height: PM_WIDE_ACTION_HEIGHT, paddingVertical: 0, paddingHorizontal: 8 },
      ]}
    />
  );
}
