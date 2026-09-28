// Chart bar CRUD panel next to the hovered (web) / selected (touch) bar:
// edit · add task below / inside · link · details · delete.

import React from 'react';
import { PM_BAR_PANEL_WIDTH } from '../../constants';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../usePMCrud';
import { PMIconButton } from '../../buttons/PMIconButton';
import PMFloatingRowPanel from '../PMFloatingRowPanel';
import PMRowActionButtons from '../../buttons/PMRowActionButtons';

export default function PMGanttBarHoverPanel({
  guid,
  crud,
  palette,
  animatedStyle,
}: {
  guid: string;
  crud: PMCrud;
  palette: PMPalette;
  animatedStyle: any;
}) {
  return (
    <PMFloatingRowPanel testID="pm-gantt-bar-panel" width={PM_BAR_PANEL_WIDTH} background={palette.surface} border={palette.border} animatedStyle={animatedStyle} style={{ left: 0 }}>
      <PMIconButton compact size={16} testID={`pm-gantt-bar-add-${guid}`} icon="add" title="Add task below / inside" color={palette.primary} onPress={() => crud.createTask(guid)} />
      <PMRowActionButtons guid={guid} crud={crud} palette={palette} testIDPrefix="pm-gantt-bar" />
    </PMFloatingRowPanel>
  );
}
