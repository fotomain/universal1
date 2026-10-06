// Chart bar CRUD panel next to the hovered (web) / selected (touch) bar:
// edit · add task below / inside · link · details · delete.

import React from 'react';
import { PM_BAR_PANEL_WIDTH } from '../../../model/constants';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import PMFloatingRowPanel from '../../../inner/panels/PMFloatingRowPanel';
import PMRowActionButtons from '../../../inner/buttons/PMRowActionButtons';
import { pmT } from '../../../i18n/pmT';

export default function PMGanttBarHoverPanel({
  guid,
  crud,
  palette,
  animatedStyle,
  maxWidth,
}: {
  /** chart width: on phones the panel is narrower than its buttons and scrolls */
  maxWidth?: number;
  guid: string;
  crud: PMCrud;
  palette: PMPalette;
  animatedStyle: any;
}) {
  return (
    <PMFloatingRowPanel testID="pm-gantt-bar-panel" width={maxWidth ? Math.min(PM_BAR_PANEL_WIDTH, Math.max(120, maxWidth - 12)) : PM_BAR_PANEL_WIDTH} scroll={!!maxWidth && maxWidth - 12 < PM_BAR_PANEL_WIDTH} background={palette.surface} border={palette.border} animatedStyle={animatedStyle} style={{ left: 0 }}>
      <PMIconButton compact size={16} testID={`pm-gantt-bar-add-${guid}`} icon="add" title={pmT('Add task below / inside')} color={palette.primary} onPress={() => crud.createTask(guid)} />
      <PMRowActionButtons guid={guid} crud={crud} palette={palette} testIDPrefix="pm-gantt-bar" />
    </PMFloatingRowPanel>
  );
}
