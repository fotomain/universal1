// ReusableTable - row context menu (web: right-click, touch: long-press, both: the ⋮ button).
// The same popup as the Tasks Tree row menu (kit8/pm/inner/menu/PMContextMenu).
import React from 'react';
import * as Clipboard from 'expo-clipboard';
import PMContextMenu from '../../../../pm/inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../../../pm/inner/menu/PMMenuItem';
import type { ReusableTableRow } from './reusableTableTypes';
import type { ReusableTableCrud } from './useReusableTableCrud';

export interface RowMenuState { guid: string; x: number; y: number }

export interface ReusableTableRowMenuProps {
  menu: RowMenuState | null;
  rows: ReusableTableRow[];
  crud: ReusableTableCrud;
  itemLabel: string;
  reorderEnabled: boolean;
  /** rows are filtered by the search box: positions are not the real ones -> no move commands */
  filtered: boolean;
  onDelete: (guid: string) => void;
  onClose: () => void;
  extraMenuItems?: (row: ReusableTableRow, close: () => void) => PMMenuItemProps[];
  testID: string;
}

export default function ReusableTableRowMenu({ menu, rows, crud, itemLabel, reorderEnabled, filtered, onDelete, onClose, extraMenuItems, testID }: ReusableTableRowMenuProps) {
  if (!menu) return null;
  const index = rows.findIndex((r) => r.rowGUID === menu.guid);
  const row = rows[index];
  if (!row) return null;
  const guid = row.rowGUID;
  const run = (fn: () => unknown) => () => { onClose(); fn(); };
  const id = (s: string) => `${testID}-menu-${s}`;
  const canMove = reorderEnabled && !filtered;
  const lower = itemLabel.toLowerCase();
  const items: PMMenuItemProps[] = [
    { testID: id('add-below'), label: `Add ${lower} below`, icon: 'add_row_below', onPress: run(() => crud.createAfter(guid)) },
    { testID: id('add-above'), label: `Add ${lower} above`, icon: 'add_row_above', onPress: run(() => crud.createBefore(guid)) },
    { testID: id('duplicate'), label: 'Duplicate', icon: 'control_point_duplicate', onPress: run(() => crud.duplicate(guid)) },
    ...(canMove ? [
      { testID: id('move-up'), label: 'Move up', icon: 'arrow_upward', disabled: index === 0, onPress: run(() => crud.moveUp(guid)) },
      { testID: id('move-down'), label: 'Move down', icon: 'arrow_downward', disabled: index === rows.length - 1, onPress: run(() => crud.moveDown(guid)) },
      { testID: id('make-first'), label: 'Make first', icon: 'vertical_align_top', disabled: index === 0, onPress: run(() => crud.makeFirst(guid)) },
      { testID: id('make-last'), label: 'Make last', icon: 'vertical_align_bottom', disabled: index === rows.length - 1, onPress: run(() => crud.makeLast(guid)) },
    ] : []),
    { testID: id('copy-guid'), label: 'Copy GUID', icon: 'fingerprint', onPress: run(() => { Clipboard.setStringAsync(guid).catch(() => {}); }) },
    ...(crud.canArchive ? [{ testID: id('archive'), label: 'Archive', icon: 'archive', onPress: run(() => crud.archive(guid)) }] : []),
    ...(extraMenuItems ? extraMenuItems(row, onClose) : []),
    { testID: id('delete'), label: 'Delete', icon: 'delete', danger: true, onPress: run(() => onDelete(guid)) },
  ];
  return <PMContextMenu testID={`${testID}-menu`} x={menu.x} y={menu.y} caption={`${itemLabel} ${index + 1}`} items={items} onClose={onClose} />;
}
