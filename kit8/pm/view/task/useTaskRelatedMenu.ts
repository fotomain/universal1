// useTaskRelatedMenu - the two submenus of the Task context menu (PMTaskRowMenu) and of the line context menu of the Task Edit (Finances) table (PMProjectTaskFinancesCRUD), placed BEFORE "Delete":
//   "Create based on this"   Fact input · Vendor Invoice · Purchase Order · Subproject (only while the project switch subprojectsFunctionalityEnabled is on: it creates the project "Subproject of <task>", links it
//                            to the task and opens its board in a new browser window - kit8/pm/subproject/useCreateSubproject)
//   "Go to"                  Vendor invoices · Purchase orders · Fact input (the document LISTS, in a NEW browser window on the web, filtered for the task - or for the task line when the menu is a line menu: /pm/vendor-invoice/list?taskGUID&taskLineGUID,
//                            /pm/fact/list?…, kit8/documents/taskScope) · Subproject (only a task that stands for a project: its board in a new browser window)
// `build(ctx)` returns the two items (a stage has no lines / facts / documents: nothing). The store is read through selectors (the menu is built when it opens).
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { usePMStore } from '../../store/store_pm';
import type { PMMenuItemProps } from '../../inner/menu/PMMenuItem';
import { pmT } from '../../i18n/pmT';
import { useOpenFactInput } from '../../../documents/fact/input/useOpenFactInput';
import { useStartVendorInvoice } from '../../../documents/vendor/invoice/useVendorInvoice';
import { useStartPurchaseOrder } from '../../../documents/vendor/purchase_order/usePurchaseOrder';
import { FACT_LIST_ROUTE, PURCHASE_ORDER_LIST_ROUTE, VENDOR_INVOICE_LIST_ROUTE } from '../../../documents/taskScope/taskScopeModel';
import { openTaskScopedList } from '../../../documents/taskScope/openTaskScopedList';
import { createSubprojectBlock, subprojectGUIDOfTask } from '../../subproject/createSubprojectModel';
import { useCreateSubproject } from '../../subproject/useCreateSubproject';
import { openProjectBoard } from '../project/dashboardDeepLink';
import { subprojectsEnabledOf } from '../../subproject/subprojectModel';

export interface TaskRelatedMenuCtx {
  taskGUID: string;
  projectGUID: string;
  /** the line menu: the lists are filtered for this task line too, and Fact input opens on its tab */
  taskLineGUID?: string;
  genus?: string;
  /** testID base of the items */
  idPrefix: string;
  close: () => void;
  /** the line menu asks "this line / all the lines" first (VendorInvoiceScopeModal) instead of creating at once */
  onVendorInvoice?: () => void;
  /** the line menu asks "this line / all the lines" first (PurchaseOrderScopeModal) instead of creating at once */
  onPurchaseOrder?: () => void;
  /** a revenue line has no vendor (and no purchase order) */
  noVendor?: boolean;
}

export function useTaskRelatedMenu() {
  const router = useRouter();
  const openFactInput = useOpenFactInput();
  const { start: startVendorInvoice } = useStartVendorInvoice();
  const { start: startPurchaseOrder } = useStartPurchaseOrder();
  const { create: createSubproject } = useCreateSubproject();
  const tasksById = usePMStore((s) => s.tasksById);
  const projectsById = usePMStore((s) => s.projectsById);
  const schedule = usePMStore((s) => s.schedule);

  return useCallback((ctx: TaskRelatedMenuCtx): PMMenuItemProps[] => {
    const { taskGUID, projectGUID, taskLineGUID, genus, idPrefix, close } = ctx;
    const task = tasksById?.[taskGUID];
    if (!task || schedule?.[taskGUID]?.isSummary) return [];
    const project = projectsById?.[projectGUID];
    const run = (fn: () => unknown) => () => { close(); fn(); };
    const scope = { taskGUID, taskLineGUID: taskLineGUID ?? '' };
    const subGUID = subprojectGUIDOfTask(task.rowJSON);
    const subprojectsOn = subprojectsEnabledOf(project?.rowJSON);
    const canCreateSub = subprojectsOn && createSubprojectBlock(project?.rowJSON, task.rowJSON) !== 'notTask';

    const create: PMMenuItemProps[] = [
      { testID: `${idPrefix}-create-fact`, label: 'Fact input', icon: 'fact_check', onPress: run(() => openFactInput({ taskGUID, projectGUID, ...(taskLineGUID ? { taskLineGUID, genus } : {}) }, { newWindow: true })) },
      ...(ctx.noVendor ? [] : [{ testID: `${idPrefix}-create-vendor-invoice`, label: 'Vendor Invoice', icon: 'receipt_long', onPress: run(() => (ctx.onVendorInvoice ? ctx.onVendorInvoice() : void startVendorInvoice({ taskGUID, projectGUID }))) }]),
      ...(ctx.noVendor ? [] : [{ testID: `${idPrefix}-create-purchase-order`, label: 'Purchase Order', icon: 'shopping_cart', onPress: run(() => (ctx.onPurchaseOrder ? ctx.onPurchaseOrder() : void startPurchaseOrder({ taskGUID, projectGUID }))) }]),
      ...(canCreateSub ? [{
        testID: `${idPrefix}-create-subproject`, label: 'Subproject', icon: 'account_tree',
        disabled: createSubprojectBlock(project?.rowJSON, task.rowJSON) === 'alreadySubproject',
        onPress: run(() => { void createSubproject(taskGUID, projectGUID); }),
      }] : []),
    ];
    const goTo: PMMenuItemProps[] = [
      ...(ctx.noVendor ? [] : [{ testID: `${idPrefix}-goto-vendor-invoices`, label: 'Vendor invoices', icon: 'receipt_long', onPress: run(() => openTaskScopedList(VENDOR_INVOICE_LIST_ROUTE, scope, router)) }]),
      ...(ctx.noVendor ? [] : [{ testID: `${idPrefix}-goto-purchase-orders`, label: 'Purchase orders', icon: 'shopping_cart', onPress: run(() => openTaskScopedList(PURCHASE_ORDER_LIST_ROUTE, scope, router)) }]),
      { testID: `${idPrefix}-goto-fact-input`, label: 'Fact input', icon: 'fact_check', onPress: run(() => openTaskScopedList(FACT_LIST_ROUTE, scope, router)) },
      ...(subGUID ? [{ testID: `${idPrefix}-goto-subproject`, label: 'Subproject', icon: 'account_tree', onPress: run(() => openProjectBoard(subGUID, router)) }] : []),
    ];
    return [
      { testID: `${idPrefix}-create`, label: 'Create based on this', icon: 'add_circle', onPress: () => {}, submenu: create },
      { testID: `${idPrefix}-goto`, label: 'Go to', icon: 'arrow_forward', onPress: () => {}, submenu: goTo },
    ];
  }, [router, openFactInput, startVendorInvoice, startPurchaseOrder, createSubproject, tasksById, projectsById, schedule]);
}
