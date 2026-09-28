// OnRightClickOnDependencyArrow: context menu of a dependency arrow (Edit, Delete) at the
// click point. Web = right-click on an arrow; touch = tap on an arrow. "Delete" asks first
// and removes only the dependency (undoable from the Gantt bar).

import React from 'react';
import { usePMStore } from '../store';
import { PMCrud } from '../usePMCrud';
import PMContextMenu from './PMContextMenu';

export default function PMDependencyMenu({ crud }: { crud: PMCrud }) {
  const menu = usePMStore((s) => s.depMenu);
  const caption = usePMStore((s) =>
    s.depMenu
      ? `${s.tasksById[s.depMenu.dependsOnGUID]?.rowJSON.name ?? '?'} → ${s.tasksById[s.depMenu.rowGUID]?.rowJSON.name ?? '?'}`
      : ''
  );
  if (!menu) return null;
  const ref = { rowGUID: menu.rowGUID, dependsOnGUID: menu.dependsOnGUID };

  return (
    <PMContextMenu
      testID="pm-dep-menu"
      x={menu.x}
      y={menu.y}
      caption={caption}
      onClose={crud.closeDependencyMenu}
      items={[
        { testID: 'pm-dep-menu-edit', label: 'Edit', icon: 'edit', onPress: () => crud.openDependencyEditor(ref) },
        { testID: 'pm-dep-menu-delete', label: 'Delete', icon: 'delete', danger: true, onPress: () => crud.deleteDependency(ref) },
      ]}
    />
  );
}
