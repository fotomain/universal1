// Monitor01TaskMenu - the context menu (right click / long press) of a Task name cell of Monitor01: the commands of the Task menu of the tree (PMTaskRowMenu) that work from the task of the row.
//   project mode   the project board is open: its PMTaskRowMenu IS the menu (Monitor01Dashboard opens it through the store: every command of the tree, Edit / Duplicate / Delete ... included)
//   standalone     no project board: this menu has the commands that do not need it - Open task (the dashboard at the task + tab + line, a new browser window) · Copy GUID · Facts input · Vendor Invoice ·
//                  Purchase Order · "Create based on this" · "Go to" (useTaskRelatedMenu, the rowJSON of the task and of its project read from the database)
import React, { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import PMContextMenu from '../../inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../inner/menu/PMMenuItem';
import { useSupabase } from '../../../providers/WithSupabase';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { useOpenFactInput } from '../../../documents/fact/input/useOpenFactInput';
import { useStartVendorInvoice } from '../../../documents/vendor/invoice/useVendorInvoice';
import { useStartPurchaseOrder } from '../../../documents/vendor/purchase_order/usePurchaseOrder';
import { useTaskRelatedMenu } from '../../view/task/useTaskRelatedMenu';
import { openDashboardLink } from '../../view/project/dashboardDeepLink';
import { Monitor01Row, dashboardLinkOfRow } from './monitor01Model';

export interface Monitor01TaskMenuState { row: Monitor01Row; x: number; y: number }

/** the rowJSON of a task and of its project, read once when the menu opens (the subproject items look at them) */
function useTaskAndProject(taskGUID: string, projectGUID: string) {
  const { supabase } = useSupabase();
  const [rows, setRows] = useState<{ task: Record<string, any> | null; project: Record<string, any> | null }>({ task: null, project: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, p] = await Promise.all([
          supabase.from('project_task_table').select('rowJSON').eq('rowGUID', taskGUID).maybeSingle(),
          supabase.from('project_table').select('rowJSON').eq('rowGUID', projectGUID).maybeSingle(),
        ]);
        if (alive) setRows({ task: ((t as any)?.data?.rowJSON as Record<string, any>) ?? {}, project: ((p as any)?.data?.rowJSON as Record<string, any>) ?? {} });
      } catch {
        if (alive) setRows({ task: {}, project: {} });
      }
    })();
    return () => { alive = false; };
  }, [taskGUID, projectGUID]); // eslint-disable-line react-hooks/exhaustive-deps
  return rows;
}

export default function Monitor01TaskMenu({ menu, onClose, testID = 'monitor01-task-menu' }: { menu: Monitor01TaskMenuState; onClose: () => void; testID?: string }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const openFactInput = useOpenFactInput();
  const { start: startVendorInvoice } = useStartVendorInvoice();
  const { start: startPurchaseOrder } = useStartPurchaseOrder();
  const related = useTaskRelatedMenu();
  const { row } = menu;
  const taskGUID = row.rowOwnerGUID;
  const projectGUID = row.rowProjectGUID;
  const { task, project } = useTaskAndProject(taskGUID, projectGUID);

  const run = (fn: () => unknown) => () => { onClose(); fn(); };
  const id = (s: string) => `${testID}-${s}`;
  const items: PMMenuItemProps[] = [
    { testID: id('open'), label: 'Open task', icon: 'open_in_new', onPress: run(() => openDashboardLink(dashboardLinkOfRow(row), router)) },
    { testID: id('copy-guid'), label: 'Copy GUID', icon: 'fingerprint', onPress: run(() => {
      Clipboard.setStringAsync(taskGUID).then(() => dispatch(showSnackbar({ message: `Task GUID copied: ${taskGUID}`, duration: 2500 }))).catch(() => {});
    }) },
    { testID: id('facts-input'), label: 'Facts input', icon: 'fact_check', onPress: run(() => openFactInput({ taskGUID, projectGUID })) },
    { testID: id('vendor-invoice'), label: 'Vendor Invoice', icon: 'receipt_long', onPress: run(() => { void startVendorInvoice({ taskGUID, projectGUID }); }) },
    { testID: id('purchase-order'), label: 'Purchase Order', icon: 'shopping_cart', onPress: run(() => { void startPurchaseOrder({ taskGUID, projectGUID }); }) },
    ...(task ? related({ taskGUID, projectGUID, idPrefix: testID, close: onClose, directDocumentItems: true, taskRowJSON: task, projectRowJSON: project }) : []),
  ];
  return <PMContextMenu testID={testID} x={menu.x} y={menu.y} caption={row.taskName} items={items} onClose={onClose} />;
}
