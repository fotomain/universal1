// Tree row CRUD panel (web: on hover, touch: on the selected row): add task below · add task above ·
// (stage: add inside) · edit · duplicate · copy info · share · link · details · delete.
// It gets the width its icons need (treeRowPanelGeometry.placeTreeRowPanel), not only the width of
// the Task name column: it ends at the name column's right edge and grows over the neighbouring
// columns when the name column is too narrow.

import React from 'react';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../usePMCrud';
import { PMIconButton } from '../../buttons/PMIconButton';
import PMFloatingRowPanel from '../../panels/PMFloatingRowPanel';
import PMRowActionButtons from '../../buttons/PMRowActionButtons';

export default function PMTreeRowHoverPanel({
  guid,
  isSummary,
  crud,
  palette,
  width,
  left,
  right,
  animatedStyle,
}: {
  guid: string;
  isSummary: boolean;
  crud: PMCrud;
  palette: PMPalette;
  width: number;
  /** left edge in tree canvas coordinates (placeTreeRowPanel) */
  left?: number;
  /** or: distance from the tree's right edge */
  right?: number;
  animatedStyle: any;
}) {
  return (
    <PMFloatingRowPanel testID="pm-tree-row-panel" width={width} background={palette.surface} border={palette.border} animatedStyle={animatedStyle} style={left !== undefined ? { left } : { right: right ?? 0 }}>
      <PMIconButton compact size={16} testID={`pm-tree-row-add-below-${guid}`} icon="add_row_below" title="Add task below" color={palette.primary} onPress={() => crud.createTaskBelow(guid)} />
      <PMIconButton compact size={16} testID={`pm-tree-row-add-above-${guid}`} icon="add_row_above" title="Add task above" color={palette.primary} onPress={() => crud.createTaskAbove(guid)} />
      {isSummary && (
        <PMIconButton compact size={16} testID={`pm-tree-row-add-${guid}`} icon="add" title="Add task inside this stage" color={palette.primary} onPress={() => crud.createTask(guid)} />
      )}
      <PMRowActionButtons guid={guid} crud={crud} palette={palette} testIDPrefix="pm-tree-row" />
    </PMFloatingRowPanel>
  );
}
