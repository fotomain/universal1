// Tree row CRUD panel (web: on hover, touch: on the selected row): add task below · add task above ·
// (stage: add inside) · edit · duplicate · copy info · share · link · details · delete · drag handle (LAST:
// press + drag it to move the row - the gesture comes from the tree, see PMProjectTasksTree).
// It gets the width its icons need (treeRowPanelGeometry.placeTreeRowPanel), not only the width of
// the Task name column: it ends at the name column's right edge and grows over the neighbouring
// columns when the name column is too narrow.

import React from 'react';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import PMFloatingRowPanel from '../../../inner/panels/PMFloatingRowPanel';
import PMRowActionButtons from '../../../inner/buttons/PMRowActionButtons';
import { PMDragHandleButton } from '../../../inner/buttons/PMDragHandleButton';
import type { GestureType } from 'react-native-gesture-handler';

export default function PMTreeRowHoverPanel({
  guid,
  isSummary,
  crud,
  palette,
  width,
  left,
  right,
  animatedStyle,
  dragGesture,
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
  /** row drag & drop gesture for the drag handle (last button) */
  dragGesture?: GestureType | null;
}) {
  return (
    <PMFloatingRowPanel testID="pm-tree-row-panel" width={width} background={palette.surface} border={palette.border} animatedStyle={animatedStyle} style={left !== undefined ? { left } : { right: right ?? 0 }}>
      <PMIconButton compact size={16} testID={`pm-tree-row-add-below-${guid}`} icon="add_row_below" title="Add task below" color={palette.primary} onPress={() => crud.createTaskBelow(guid)} />
      <PMIconButton compact size={16} testID={`pm-tree-row-add-above-${guid}`} icon="add_row_above" title="Add task above" color={palette.primary} onPress={() => crud.createTaskAbove(guid)} />
      {isSummary && (
        <PMIconButton compact size={16} testID={`pm-tree-row-add-${guid}`} icon="add" title="Add task inside this stage" color={palette.primary} onPress={() => crud.createTask(guid)} />
      )}
      <PMRowActionButtons guid={guid} crud={crud} palette={palette} testIDPrefix="pm-tree-row" />
      <PMDragHandleButton testID={`pm-tree-row-drag-${guid}`} gesture={dragGesture} color={palette.textMuted} title="Drag to move the task (reorder / re-parent)" />
    </PMFloatingRowPanel>
  );
}
