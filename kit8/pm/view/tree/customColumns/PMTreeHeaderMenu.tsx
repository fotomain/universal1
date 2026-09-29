// PMTreeHeaderMenu: right-click (touch: long-press) on a tree column header - "Task name" or any
// other one. AddCustomProjectTaskColumn lives here:
//
//   Add custom column ▸ Text · Date · Boolean · Integer · Float   -> PMCustomColumnNameModalWindow
//   Rename custom column / Delete custom column                    (custom columns only; delete asks first)
//   Header color ▸ Default · swatches                              -> project.rowJSON.customColumns.headersBackgroundColors
//   Default width                                                  (when the column was resized)
//
// Mount once per screen (dashboard), like PMDependencyMenu.

import React from 'react';
import { usePMStore } from '../../../store/store_pm';
import { PMCrud } from '../../../crud/usePMCrud';
import PMContextMenu from '../../../inner/menu/PMContextMenu';
import { PMMenuItemProps } from '../../../inner/menu/PMMenuItem';
import { treeColumnTitle } from '../columns/treeColumns';
import {
  isCustomColumnKey,
  PM_CUSTOM_COLUMN_TYPE_ICON,
  PM_CUSTOM_COLUMN_TYPE_LABEL,
  PM_CUSTOM_COLUMN_TYPES,
  PM_HEADER_BACKGROUND_SWATCHES,
} from '../columns/customColumns';

export const PM_TREE_HEADER_MENU_WIDTH = 230;

export default function PMTreeHeaderMenu({ crud }: { crud: PMCrud }) {
  const menu = usePMStore((s) => s.treeHeaderMenu);
  const customColumns = usePMStore((s) => s.customColumns);
  const headerColors = usePMStore((s) => s.treeHeadersBackgroundColors);
  const widths = usePMStore((s) => s.treeColumnsWidths);
  if (!menu) return null;
  const key = menu.columnKey;
  const close = () => crud.closeTreeHeaderMenu();
  const then = (fn: () => void) => () => {
    close();
    fn();
  };
  const custom = key && isCustomColumnKey(key) ? customColumns.find((c) => c.key === key) : undefined;

  const items: PMMenuItemProps[] = [
    {
      testID: 'pm-tree-header-menu-add',
      label: 'Add custom column',
      icon: 'add_column_right',
      onPress: () => undefined,
      submenu: PM_CUSTOM_COLUMN_TYPES.map((type) => ({
        testID: `pm-tree-header-menu-add-${type}`,
        label: PM_CUSTOM_COLUMN_TYPE_LABEL[type],
        icon: PM_CUSTOM_COLUMN_TYPE_ICON[type],
        onPress: then(() => crud.promptAddCustomColumn(type)),
      })),
    },
  ];
  if (custom) {
    items.push(
      { testID: 'pm-tree-header-menu-rename', label: 'Rename custom column', icon: 'edit', onPress: then(() => crud.promptRenameCustomColumn(custom.key)) },
      { testID: 'pm-tree-header-menu-delete', label: 'Delete custom column', icon: 'delete', danger: true, onPress: then(() => crud.deleteCustomColumn(custom.key)) }
    );
  }
  if (key) {
    const current = headerColors[key] ?? null;
    items.push({
      testID: 'pm-tree-header-menu-color',
      label: 'Header color',
      icon: 'format_color_fill',
      iconColor: current ?? undefined,
      onPress: () => undefined,
      submenu: [
        { testID: 'pm-tree-header-menu-color-default', label: 'Default', icon: 'format_color_reset', checked: !current, onPress: then(() => crud.setTreeHeaderBackgroundColor(key, null)) },
        ...PM_HEADER_BACKGROUND_SWATCHES.map((s) => ({
          testID: `pm-tree-header-menu-color-${s.label.toLowerCase()}`,
          label: s.label,
          icon: 'circle',
          iconColor: s.color,
          checked: current?.toLowerCase() === s.color,
          onPress: then(() => crud.setTreeHeaderBackgroundColor(key, s.color)),
        })),
      ],
    });
    if (typeof widths[key] === 'number') {
      items.push({ testID: 'pm-tree-header-menu-width-reset', label: key === 'name' ? 'Default width (fill)' : 'Default width', icon: 'fit_width', onPress: then(() => crud.resetTreeColumnWidth(key)) });
    }
  }

  const caption = key
    ? `Column: ${treeColumnTitle(key, customColumns)}${custom ? ` · ${PM_CUSTOM_COLUMN_TYPE_LABEL[custom.type]}` : ''}`
    : 'Task tree columns';
  return <PMContextMenu testID="pm-tree-header-menu" x={menu.x} y={menu.y} caption={caption} width={PM_TREE_HEADER_MENU_WIDTH} onClose={close} items={items} />;
}
