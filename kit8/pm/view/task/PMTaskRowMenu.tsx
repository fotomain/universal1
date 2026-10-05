// Row / bar context menu - the commands of the hover panels (PMTreeRowHoverPanel, PMGanttBarHoverPanel)
// when uxuiSettings.projectTreeContextCommandsMode / projectGanttChartContextCommandsMode is
// 'onRightClickMenuMode'. Web = right-click on a tree row / Gantt bar; touch = long-press and release.
// Opened with store.setRowMenu({ guid, x, y, source }); every item closes the menu first.

import React from 'react';
import { usePMStore } from '../../store/store_pm';
import { PMCrud } from '../../crud/usePMCrud';
import PMContextMenu from '../../inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../inner/menu/PMMenuItem';

export default function PMTaskRowMenu({ crud }: { crud: PMCrud }) {
  const menu = usePMStore((s) => s.rowMenu);
  const task = usePMStore((s) => (s.rowMenu ? s.tasksById[s.rowMenu.guid] : undefined));
  const isSummary = usePMStore((s) => (s.rowMenu ? !!s.schedule[s.rowMenu.guid]?.isSummary : false));
  if (!menu || !task) return null;

  const guid = menu.guid;
  const close = () => usePMStore.getState().setRowMenu(null);
  const run = (fn: () => unknown) => () => {
    close();
    fn();
  };
  const id = (s: string) => `pm-row-menu-${s}`;
  const items: PMMenuItemProps[] = [
    { testID: id('add-below'), label: 'Add task below', icon: 'add_row_below', onPress: run(() => crud.createTaskBelow(guid)) },
    { testID: id('add-above'), label: 'Add task above', icon: 'add_row_above', onPress: run(() => crud.createTaskAbove(guid)) },
    ...(isSummary ? [{ testID: id('add-inside'), label: 'Add task inside', icon: 'add', onPress: run(() => crud.createTask(guid)) }] : []),
    { testID: id('add-stage-below'), label: 'Add stage below', icon: 'create_new_folder', onPress: run(() => crud.createStageBelow(guid)) },
    { testID: id('add-stage-above'), label: 'Add stage above', icon: 'drive_folder_upload', onPress: run(() => crud.createStageAbove(guid)) },
    { testID: id('edit'), label: 'Edit', icon: 'edit', onPress: run(() => crud.edit(guid)) },
    { testID: id('duplicate'), label: 'Duplicate', icon: 'control_point_duplicate', onPress: run(() => crud.duplicateTask(guid)) },
    { testID: id('copy-info'), label: 'Copy task info', icon: 'content_copy', onPress: run(() => crud.copyTaskInfo(guid)) },
    { testID: id('copy-guid'), label: 'Copy GUID', icon: 'fingerprint', onPress: run(() => crud.copyTaskGUID(guid)) },
    { testID: id('share'), label: 'Share task', icon: 'share', onPress: run(() => crud.shareTask(guid)) },
    { testID: id('google-calendar'), label: 'Add to Google Calendar', icon: 'event', onPress: run(() => crud.addToGoogleCalendar(guid)) },
    { testID: id('link'), label: 'Link to…', icon: 'link', onPress: run(() => crud.startLink(guid)) },
    { testID: id('open'), label: 'Open task info', icon: 'open_in_new', onPress: run(() => crud.openInfo(guid)) },
    { testID: id('delete'), label: 'Delete', icon: 'delete', danger: true, onPress: run(() => crud.deleteTask(guid)) },
  ];

  return <PMContextMenu testID="pm-row-menu" x={menu.x} y={menu.y} caption={task.rowJSON.name} items={items} onClose={close} />;
}
