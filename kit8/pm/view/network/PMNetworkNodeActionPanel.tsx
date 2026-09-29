// CRUD panel above the selected activity (NOT rendered in read-only mode):
// add task below · edit · link · open task info · delete - the same commands as the Gantt
// bar panel (PMGanttBarHoverPanel), so undo / approvals work identically.

import React from 'react';
import { PM_BAR_PANEL_WIDTH } from '../../model/constants';
import { PMIconButton } from '../../inner/buttons/PMIconButton';
import PMRowActionButtons from '../../inner/buttons/PMRowActionButtons';
import PMFloatingRowPanel from '../../inner/panels/PMFloatingRowPanel';
import { PMPalette } from '../theme';
import { PMCrud } from '../../crud/usePMCrud';

export const PM_NET_PANEL_HEIGHT = 26;

export default function PMNetworkNodeActionPanel({
  guid,
  crud,
  palette,
  left,
  top,
}: {
  guid: string;
  crud: PMCrud;
  palette: PMPalette;
  /** position inside the zoomed canvas content */
  left: number;
  top: number;
}) {
  return (
    <PMFloatingRowPanel
      testID="pm-net-node-panel"
      width={PM_BAR_PANEL_WIDTH}
      background={palette.surface}
      border={palette.border}
      animatedStyle={undefined}
      style={{ left: Math.max(2, left), top: Math.max(2, top), zIndex: 20 }}
    >
      <PMIconButton
        compact
        size={16}
        testID={`pm-net-node-add-${guid}`}
        icon="add"
        title="Add task below"
        color={palette.primary}
        onPress={() => crud.createTask(guid)}
      />
      <PMRowActionButtons guid={guid} crud={crud} palette={palette} testIDPrefix="pm-net-node" />
    </PMFloatingRowPanel>
  );
}
