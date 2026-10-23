// useTaskRelatedMenu - the two submenus of the Task context menu (PMTaskRowMenu) and of the line context menu of the Task Edit (Finances) table (PMProjectTaskInputCRUD), placed BEFORE "Delete":
//   "Create based on this"   Fact input · Vendor Invoice · Purchase Order · Payment fact (a NEW draft for the task: the lines come from "Get from plan") · Time sheet (always a NEW draft of the user's work center for the current month, a line for the task) · Customer Invoice (only while the project switch customerInvoiceFunctionalityEnabled is on, made from the Deliverable = Revenue lines) · Subproject (only while the project switch subprojectsFunctionalityEnabled is on: it creates the project "Subproject of <task>", links it
//                            to the task and opens its board in a new browser window - kit8/pm/subproject/useCreateSubproject)
//   "Go to"                  Timeline data (the BUDGETS view of the dashboard - the posted days, on its Timeline tab - in a NEW browser window, filtered for the task line when the menu is a line menu:
//                            /pm/project/dashboard?view=budgets&tab=TabPlanTimeline&lineGUID) · Vendor invoices · Customer invoices (switch on) · Payment facts · Purchase orders · Product receipts · Time sheets · Fact input (the document LISTS, in a NEW browser window on the web, filtered for the task - or for the task line when the menu is a line menu: /pm/vendor-invoice/list?taskGUID&taskLineGUID,
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
import { useStartCustomerInvoice } from '../../../documents/customer/invoice/useCustomerInvoice';
import { useStartPaymentFact } from '../../../documents/payment/fact/usePaymentFact';
import { customerInvoiceEnabledOf } from '../project/settings/PMProjectCustomerTab';
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import { CUSTOMER_INVOICE_LIST_ROUTE, FACT_LIST_ROUTE, PAYMENT_FACT_LIST_ROUTE, PRODUCT_RECEIPT_LIST_ROUTE, PURCHASE_ORDER_LIST_ROUTE, TIMESHEET_LIST_ROUTE, VENDOR_INVOICE_LIST_ROUTE } from '../../../documents/taskScope/taskScopeModel';
import { openTaskScopedList } from '../../../documents/taskScope/openTaskScopedList';
import { useCreateTimesheetFromTask } from '../../../documents/timesheet/useTimesheet';
import { createSubprojectBlock, subprojectGUIDOfTask } from '../../subproject/createSubprojectModel';
import { useCreateSubproject } from '../../subproject/useCreateSubproject';
import { BUDGETS_TIMELINE_TAB, openDashboardLink, openProjectBoard } from '../project/dashboardDeepLink';
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
  /** the rowJSON of the task / of its project when they are NOT in the PM store (a menu of a report row: Monitor01 stand alone reads them from the database); the task is then no stage */
  taskRowJSON?: Record<string, any> | null;
  projectRowJSON?: Record<string, any> | null;
  /** a revenue line has no vendor (and no purchase order) */
  noVendor?: boolean;
  /** the line menu may ask "this line / all the lines" first instead of creating the customer invoice of the line at once */
  onCustomerInvoice?: () => void;
}

export function useTaskRelatedMenu() {
  const router = useRouter();
  const openFactInput = useOpenFactInput();
  const { start: startVendorInvoice } = useStartVendorInvoice();
  const { start: startPurchaseOrder } = useStartPurchaseOrder();
  const { start: startCustomerInvoice } = useStartCustomerInvoice();
  const { start: startPaymentFact } = useStartPaymentFact();
  const { create: createSubproject } = useCreateSubproject();
  const { create: createTimesheet } = useCreateTimesheetFromTask();
  const tasksById = usePMStore((s) => s.tasksById);
  const projectsById = usePMStore((s) => s.projectsById);
  const schedule = usePMStore((s) => s.schedule);

  return useCallback((ctx: TaskRelatedMenuCtx): PMMenuItemProps[] => {
    const { taskGUID, projectGUID, taskLineGUID, genus, idPrefix, close } = ctx;
    const task = ctx.taskRowJSON ? { rowJSON: ctx.taskRowJSON } : tasksById?.[taskGUID];
    if (!task || (!ctx.taskRowJSON && schedule?.[taskGUID]?.isSummary)) return [];
    const project = ctx.projectRowJSON ? { rowJSON: ctx.projectRowJSON } : projectsById?.[projectGUID];
    const run = (fn: () => unknown) => () => { close(); fn(); };
    const scope = { taskGUID, taskLineGUID: taskLineGUID ?? '' };
    const subGUID = subprojectGUIDOfTask(task.rowJSON);
    const subprojectsOn = subprojectsEnabledOf(project?.rowJSON);
    // (Subproject creation reads the PM store: not from a report row that brings its own rowJSON)
    // Customer invoice: only while the project switch is on; from the task menu (all the Deliverable lines) or from the menu of a Deliverable (Revenue) line
    const customerOn = customerInvoiceEnabledOf(project?.rowJSON) && (!taskLineGUID || genus === MANAGEMENT_GENUS.revenue);
    const canCreateSub = !ctx.taskRowJSON && subprojectsOn && createSubprojectBlock(project?.rowJSON, task.rowJSON) !== 'notTask';

    const create: PMMenuItemProps[] = [
      { testID: `${idPrefix}-create-fact`, label: 'Fact input', icon: 'fact_check', onPress: run(() => openFactInput({ taskGUID, projectGUID, ...(taskLineGUID ? { taskLineGUID, genus } : {}) }, { newWindow: true })) },
      ...(ctx.noVendor ? [] : [{ testID: `${idPrefix}-create-vendor-invoice`, label: 'Vendor Invoice', icon: 'receipt_long', onPress: run(() => (ctx.onVendorInvoice ? ctx.onVendorInvoice() : void startVendorInvoice({ taskGUID, projectGUID }))) }]),
      ...(ctx.noVendor ? [] : [{ testID: `${idPrefix}-create-purchase-order`, label: 'Purchase Order', icon: 'shopping_cart', onPress: run(() => (ctx.onPurchaseOrder ? ctx.onPurchaseOrder() : void startPurchaseOrder({ taskGUID, projectGUID }))) }]),
      // Payment fact: a bank transaction that pays this task; the line menu of a Payments plan row is not here (the plan has its own tab)
      ...(!taskLineGUID ? [{ testID: `${idPrefix}-create-payment-fact`, label: 'Payment fact', icon: 'account_balance', onPress: run(() => { void startPaymentFact({ taskGUID, projectGUID }); }) }] : []),
      ...(customerOn ? [{ testID: `${idPrefix}-create-customer-invoice`, label: 'Customer Invoice', icon: 'payments', onPress: run(() => (ctx.onCustomerInvoice ? ctx.onCustomerInvoice() : void startCustomerInvoice({ taskGUID, projectGUID, ...(taskLineGUID ? { lineGUIDs: [taskLineGUID] } : {}) }))) }] : []),
      // Time sheet: a NEW draft of the user's work center for the current month with a line for this task (a normal task only; the line menu of a Time line brings its role / budget item / business unit)
      ...((task.rowJSON as any)?.rowKind !== 'milestone' && (!taskLineGUID || genus === MANAGEMENT_GENUS.time) ? [{ testID: `${idPrefix}-create-timesheet`, label: 'Time sheet', icon: 'schedule', onPress: run(() => { void createTimesheet(taskGUID, taskLineGUID ?? null); }) }] : []),
      ...(canCreateSub ? [{
        testID: `${idPrefix}-create-subproject`, label: 'Subproject', icon: 'account_tree',
        disabled: createSubprojectBlock(project?.rowJSON, task.rowJSON) === 'alreadySubproject',
        onPress: run(() => { void createSubproject(taskGUID, projectGUID); }),
      }] : []),
    ];
    const goTo: PMMenuItemProps[] = [
      // the Budgets view of the dashboard in a new window: the posted days of the task, of THIS line when the menu is a line menu (a chip says so and clears it)
      { testID: `${idPrefix}-goto-timeline`, label: 'Timeline data', icon: 'timeline', onPress: run(() => openDashboardLink({ projectGUID, taskGUID, view: 'budgets', tab: BUDGETS_TIMELINE_TAB, ...(taskLineGUID ? { lineGUID: taskLineGUID } : {}) }, router)) },
      ...(ctx.noVendor ? [] : [{ testID: `${idPrefix}-goto-vendor-invoices`, label: 'Vendor invoices', icon: 'receipt_long', onPress: run(() => openTaskScopedList(VENDOR_INVOICE_LIST_ROUTE, scope, router)) }]),
      ...(customerOn ? [{ testID: `${idPrefix}-goto-customer-invoices`, label: 'Customer invoices', icon: 'payments', onPress: run(() => openTaskScopedList(CUSTOMER_INVOICE_LIST_ROUTE, scope, router)) }] : []),
      { testID: `${idPrefix}-goto-payment-facts`, label: 'Payment facts', icon: 'account_balance', onPress: run(() => openTaskScopedList(PAYMENT_FACT_LIST_ROUTE, { taskGUID, taskLineGUID: '' }, router)) },
      ...(ctx.noVendor ? [] : [{ testID: `${idPrefix}-goto-purchase-orders`, label: 'Purchase orders', icon: 'shopping_cart', onPress: run(() => openTaskScopedList(PURCHASE_ORDER_LIST_ROUTE, scope, router)) }]),
      ...(ctx.noVendor ? [] : [{ testID: `${idPrefix}-goto-product-receipts`, label: 'Product receipts', icon: 'move_to_inbox', onPress: run(() => openTaskScopedList(PRODUCT_RECEIPT_LIST_ROUTE, scope, router)) }]),
      { testID: `${idPrefix}-goto-fact-input`, label: 'Fact input', icon: 'fact_check', onPress: run(() => openTaskScopedList(FACT_LIST_ROUTE, scope, router)) },
      { testID: `${idPrefix}-goto-timesheets`, label: 'Time sheets', icon: 'schedule', onPress: run(() => openTaskScopedList(TIMESHEET_LIST_ROUTE, { taskGUID, taskLineGUID: '' }, router)) },
      ...(subGUID ? [{ testID: `${idPrefix}-goto-subproject`, label: 'Subproject', icon: 'account_tree', onPress: run(() => openProjectBoard(subGUID, router)) }] : []),
    ];
    return [
      { testID: `${idPrefix}-create`, label: 'Create based on this', icon: 'add_circle', onPress: () => {}, submenu: create },
      { testID: `${idPrefix}-goto`, label: 'Go to', icon: 'arrow_forward', onPress: () => {}, submenu: goTo },
    ];
  }, [router, openFactInput, startVendorInvoice, startPurchaseOrder, startCustomerInvoice, startPaymentFact, createSubproject, createTimesheet, tasksById, projectsById, schedule]);
}
