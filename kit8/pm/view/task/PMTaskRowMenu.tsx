// Row / bar context menu - the commands of the hover panels (PMTreeRowHoverPanel, PMGanttBarHoverPanel)
// when uxuiSettings.projectTreeContextCommandsMode / projectGanttChartContextCommandsMode is
// 'onRightClickMenuMode'. Web = right-click on a tree row / Gantt bar; touch = long-press and release.
// Opened with store.setRowMenu({ guid, x, y, source }); every item closes the menu first.

import React from 'react';
import { usePMStore } from '../../store/store_pm';
import { PMCrud } from '../../crud/usePMCrud';
import PMContextMenu from '../../inner/menu/PMContextMenu';
import { useOpenFactInput } from '../../../documents/fact/input/useOpenFactInput';
import { useStartVendorInvoice } from '../../../documents/vendor/invoice/useVendorInvoice';
import { useStartPurchaseOrder } from '../../../documents/vendor/purchase_order/usePurchaseOrder';
import type { PMMenuItemProps } from '../../inner/menu/PMMenuItem';
import { useTaskRelatedMenu } from './useTaskRelatedMenu';

export default function PMTaskRowMenu({ crud }: { crud: PMCrud }) {
  const menu = usePMStore((s) => s.rowMenu);
  const task = usePMStore((s) => (s.rowMenu ? s.tasksById[s.rowMenu.guid] : undefined));
  const isSummary = usePMStore((s) => (s.rowMenu ? !!s.schedule[s.rowMenu.guid]?.isSummary : false));
  const openFactInput = useOpenFactInput();
  const { start: startVendorInvoice } = useStartVendorInvoice();
  const { start: startPurchaseOrder } = useStartPurchaseOrder();
  const related = useTaskRelatedMenu();
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
    { testID: id('duplicate'), label: 'Duplicate', icon: 'control_point_duplicate', onPress: run(() => crud.duplicateTask(guid)) },
    { testID: id('copy-info'), label: 'Copy task info', icon: 'content_copy', onPress: run(() => crud.copyTaskInfo(guid)) },
    { testID: id('copy-guid'), label: 'Copy GUID', icon: 'fingerprint', onPress: run(() => crud.copyTaskGUID(guid)) },
    { testID: id('share'), label: 'Share task', icon: 'share', onPress: run(() => crud.shareTask(guid)) },
    { testID: id('google-calendar'), label: 'Add to Google Calendar', icon: 'event', onPress: run(() => crud.addToGoogleCalendar(guid)) },
    { testID: id('link'), label: 'Link to…', icon: 'link', onPress: run(() => crud.startLink(guid)) },
    { testID: id('open'), label: 'Open task info', icon: 'open_in_new', onPress: run(() => crud.openInfo(guid)) },
    // a stage has no lines, so no facts: only a task or a milestone (kit8/documents/fact/input, documentation/FACT_INPUT.html)
    ...(isSummary ? [] : [{ testID: id('facts-input'), label: 'Facts input', icon: 'fact_check', onPress: run(() => openFactInput({ taskGUID: guid })) }]),
    // right after "Facts input": CREATES the vendor invoice(s) of ALL the lines of the task (one for each vendor + contract) and opens it (kit8/documents/vendor/invoice)
    ...(isSummary ? [] : [{ testID: id('vendor-invoice'), label: 'Vendor Invoice', icon: 'receipt_long', onPress: run(() => { void startVendorInvoice({ taskGUID: guid }); }) }]),
    // right after "Vendor Invoice": the same for a PURCHASE ORDER (kit8/documents/vendor/purchase_order)
    ...(isSummary ? [] : [{ testID: id('purchase-order'), label: 'Purchase Order', icon: 'shopping_cart', onPress: run(() => { void startPurchaseOrder({ taskGUID: guid }); }) }]),
    // right before "Delete": the submenus "Create based on this" (Fact input · Vendor Invoice · Subproject) and "Go to" (the document lists of the task · the subproject) - useTaskRelatedMenu
    ...related({ taskGUID: guid, projectGUID: task.projectGUID, idPrefix: 'pm-row-menu', close }),
    // right before "Delete": PMTaskEditOptions (the UX/UI of the task)
    { testID: id('options'), label: 'Options', icon: 'tune', onPress: run(() => crud.editOptions(guid)) },
    { testID: id('delete'), label: 'Delete', icon: 'delete', danger: true, onPress: run(() => crud.deleteTask(guid)) },
  ];

  return <PMContextMenu testID="pm-row-menu" x={menu.x} y={menu.y} caption={task.rowJSON.taskDescription} items={items} onClose={close} />;
}
