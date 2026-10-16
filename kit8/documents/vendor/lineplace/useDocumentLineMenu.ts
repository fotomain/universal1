// useDocumentLineMenu - the context menu (right-click / long-press / ⋮) of a LINE of a vendor invoice / purchase order: the commands of the Task context menu that work from the
// task of the line without the project tree (kit8/pm/view/task/PMTaskRowMenu): Open task · Open task line · Facts input · Vendor Invoice · Purchase Order · Copy task GUID · Copy line GUID.
// Passed to ReusableTable as `extraMenuItems`; the standard items (Copy GUID of the line, Delete of a draft line) stay. A line row carries rowProjectGUID, rowOwnerGUID (= the task),
// taskLineGUID (null on an independent line) and genusGUID.
import { useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import type { PMMenuItemProps } from '../../../pm/inner/menu/PMMenuItem';
import type { ReusableTableRow } from '../../../ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../../../pm/i18n/pmT';
import { openDashboardLink } from '../../../pm/view/project/dashboardDeepLink';
import { copyLineGUID } from '../../../pm/view/task/finances/copyLineGuid';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { useOpenFactInput } from '../../fact/input/useOpenFactInput';
import { useStartVendorInvoice } from '../invoice/useVendorInvoice';
import { useStartPurchaseOrder } from '../purchase_order/usePurchaseOrder';

/** the task / project / task line / kind of a line row */
export const lineTaskOf = (row: ReusableTableRow) => ({
  taskGUID: String(row.rowOwnerGUID ?? ''),
  projectGUID: String(row.rowProjectGUID ?? ''),
  taskLineGUID: row.taskLineGUID ? String(row.taskLineGUID) : '',
  genus: String(row.genusGUID ?? ''),
});

/**
 * `resolve` tells the task of a row when it is not a line row: the DOCUMENT lists pass (row) => { taskGUID, projectGUID } of the document header (the task it was made from).
 * Default: lineTaskOf (a line row).
 */
export function useDocumentLineMenu(testID: string, resolve: (row: ReusableTableRow) => Partial<ReturnType<typeof lineTaskOf>> = lineTaskOf) {
  const router = useRouter();
  const dispatch = useDispatch();
  const openFactInput = useOpenFactInput();
  const { start: startVendorInvoice } = useStartVendorInvoice();
  const { start: startPurchaseOrder } = useStartPurchaseOrder();

  return useCallback((row: ReusableTableRow, close: () => void): PMMenuItemProps[] => {
    const { taskGUID = '', projectGUID = '', taskLineGUID = '', genus = '' } = resolve(row);
    if (!taskGUID) return [];
    const id = (s: string) => `${testID}-menu-${s}-${row.rowGUID}`;
    const run = (fn: () => unknown) => () => { close(); fn(); };
    return [
      ...(projectGUID ? [{ testID: id('open-task'), label: pmT('Open task'), icon: 'open_in_new', onPress: run(() => openDashboardLink({ projectGUID, taskGUID }, router)) }] : []),
      ...(projectGUID && taskLineGUID ? [{ testID: id('open-line'), label: pmT('Open task line'), icon: 'receipt_long', onPress: run(() => openDashboardLink({ projectGUID, taskGUID, genus, lineGUID: taskLineGUID }, router)) }] : []),
      { testID: id('facts-input'), label: pmT('Facts input'), icon: 'fact_check', onPress: run(() => openFactInput({ taskGUID, projectGUID, ...(taskLineGUID ? { taskLineGUID, genus } : {}) })) },
      { testID: id('vendor-invoice'), label: pmT('Vendor Invoice'), icon: 'receipt_long', onPress: run(() => { void startVendorInvoice({ taskGUID, projectGUID }); }) },
      { testID: id('purchase-order'), label: pmT('Purchase Order'), icon: 'shopping_cart', onPress: run(() => { void startPurchaseOrder({ taskGUID, projectGUID }); }) },
      { testID: id('copy-task-guid'), label: pmT('Copy task GUID'), icon: 'fingerprint', onPress: run(() => {
        Clipboard.setStringAsync(taskGUID).then(() => dispatch(showSnackbar({ message: `Task GUID copied: ${taskGUID}`, duration: 2500 }))).catch(() => {});
      }) },
      ...(taskLineGUID ? [{ testID: id('copy-line-guid'), label: pmT('Copy line GUID'), icon: 'fingerprint', onPress: run(() => { void copyLineGUID(taskLineGUID, dispatch); }) }] : []),
    ];
  }, [testID, resolve, router, dispatch, openFactInput, startVendorInvoice, startPurchaseOrder]);
}
