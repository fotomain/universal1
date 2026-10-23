// PMProjectTaskInputCRUD - the finance lines of ONE task, one table per management genus (tabs):
//   Time (a role + a person + his variant + his contract) · Material · Expenses · Revenues (a role + a product + a contract template + a partner)
// Each line is a row of task_line_table (rowOwnerGUID = the task, rowParentGUID = the genus), edited in place in a ReusableTable: add,
// duplicate, move, sql_for_delete (+ Undo), search, sort, filter, export. The money (sum = qty * price, VAT) and the defaults (unit, VAT, price from
// the role / product catalogs) are computed on every change (taskLineCompute.ts) and saved with it. When the project has an accounting / budget
// currency, the sums are also converted into them with the exchange rates, D365 style (taskLineFx.ts): a SNAPSHOT saved with the rate and its date;
// the "Recalculate" commands (row menu, bar) make it again with the rates of today's choice of day.
//
// POST (kit8/pm/view/task/plan): the Post button is the first button of the bar. It posts the WHOLE task (all tabs): the days of every line with a budget item
// go to task_line_plan in one SQL transaction. A line is "posted" until anything in it changes (taskIsPosted, taskLineCompute.ts).
//
// INPUT SWITCHES (project settings -> Finances, kit8/pm/model/taskInputScope.ts): with "Expense budget needed" on, an EMPTY tab whose input is switched off
// (Time / Material / Expenses) is not offered, and a Time line may be a person or an equipment (the menu "Resource: Person | Equipment" is a column of
// the Time table). Off = as before. A tab that has lines is never hidden: a switch never hides data.
//
// Shown by the task page (PMProjectTaskInfo) and the Finances view of the dashboard (PMTaskEditView). It does not know PMCrud:
// `onEditPlace` tells the parent where the user edited (the parent saves rowJSON.lastEditPlace of the task, with its own surface) and
// `initialPlace` is the place to open at (the genus tab + the line, marked). Stages have no lines: only tasks and milestones.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import PMContextMenu from '../../../inner/menu/PMContextMenu';
import { PM_WIDE_ACTION_HEIGHT, PM_WIDE_ACTION_WIDTH } from '../../../model/constants';
import { todayISO } from '../../../../catalog/currency/exchange/currencyExchangeModel';
import { formatDateISO } from '../../project/scheduling';
import ReusableTable from '../../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow, ReusableTableRowEditKind } from '../../../../ui/components/table/reusable/reusableTableTypes';
import { usePMStore } from '../../../store/store_pm';
import { financesPlaceOf, PMLastEditPlace } from '../../../model/lastEditPlace';
import { tabVisible, taskInputScopeOf, timeKindsOffered } from '../../../model/taskInputScope';
import { lineMenuKind } from './taskLineResource';
import { pmT } from '../../../i18n/pmT';
import { DISTRIBUTION } from '../../../../catalog/distribution/distributionModel';
import { emptyTaskLine, TASK_LINE_ENTITY, TASK_LINE_GENUS, taskLineGenusDef, taskLineGenusOf } from './taskLineModel';
import type { TaskLineRow } from './taskLineModel';
import { formatMoney, taskLineTotals } from './taskLineMoney';
import { computeTaskLineRowJSON } from './taskLineCompute';
import { buildTaskLineColumns, taskLineErrors } from './taskLineColumns';
import { productFieldsOfProject } from '../../../../catalog/product/productFieldsModel';
import { useTaskLineCatalogs } from './useTaskLineCatalogs';
import { computeFx, fxEnabled, fxProjectOf, LineFxContext, recalculateLineFx } from './taskLineFx';
import { lineContractCurrency } from './taskLineCatalogs';
import { useLineRateBook } from './useLineRateBook';
import { useTaskPost } from '../plan/useTaskPost';
import { defaultBudgetItemOfGenus } from '../plan/taskLinePlanModel';
import { MANAGEMENT_GENUS } from '../../../../catalog/management/genus/managementGenusModel';
import { copyLineGUID } from './copyLineGuid';
import { pickedLine, usePMPicker } from '../../project/pick/pmPickerContext';
import { useOpenFactInput } from '../../../../documents/fact/input/useOpenFactInput';
import { useTaskRelatedMenu } from '../useTaskRelatedMenu';
import { useStartVendorInvoice } from '../../../../documents/vendor/invoice/useVendorInvoice';
import VendorInvoiceScopeModal from '../../../../documents/vendor/invoice/VendorInvoiceScopeModal';
import { vendorInvoiceLinesOfScope } from '../../../../documents/vendor/invoice/vendorInvoiceModel';
import { useStartPurchaseOrder } from '../../../../documents/vendor/purchase_order/usePurchaseOrder';
import PurchaseOrderScopeModal from '../../../../documents/vendor/purchase_order/PurchaseOrderScopeModal';
import { purchaseOrderLinesOfScope } from '../../../../documents/vendor/purchase_order/purchaseOrderModel';
import ScrollableTabBar from '../../../../ui/components/tabs/ScrollableTabBar';
import PMTaskPaymentPlan from '../payments/PMTaskPaymentPlan';
import { PAYMENT_TAB_ID } from '../payments/paymentPlanModel';
import { usePaymentPlanEnvironment, usePaymentPlanFollowsTask, useTaskPaymentPlanRows } from '../payments/usePaymentPlan';

export interface PMProjectTaskInputCRUDProps {
  projectGUID: string;
  taskGUID: string;
  /** the place to open at (task.rowJSON.lastEditPlace): the genus tab and the line to mark. Read when the component starts: give it key={taskGUID} */
  initialPlace?: PMLastEditPlace | null;
  /** the user created / changed / moved / deleted a line: remember the place (crud.recordEditPlace) */
  onEditPlace?: (place: { genus: string; lineGUID?: string }) => void;
  testID?: string;
}

const NO_LINES: TaskLineRow[] = [];
/** a duplicated line was never posted */
const DUPLICATE_UNPOSTED = { taskIsPosted: false, baseOfDistribution: null };

export default function PMProjectTaskInputCRUD({ projectGUID, taskGUID, initialPlace, onEditPlace, testID = 'task-finances' }: PMProjectTaskInputCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const task = usePMStore((s) => s.tasksById[taskGUID]);
  const isStage = usePMStore((s) => !!s.schedule[taskGUID]?.isSummary || (s.tree.childrenById[taskGUID]?.length ?? 0) > 0 || s.tasksById[taskGUID]?.rowJSON?.rowKind === 'stage');
  const projectCurrency = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON?.currencyForContract ?? null);
  const selectRowCheckBoxForm = usePMStore((s) => s.selectRowCheckBoxForm);
  const data = useTaskLineCatalogs(true);
  const dispatch = useDispatch();
  const openFactInput = useOpenFactInput();
  const relatedMenu = useTaskRelatedMenu();
  // picker mode (view/project/pick): "Select this line" in the row menu (and a click on a read only cell) answers with the line
  const picker = usePMPicker();
  // line mode: the table's check boxes choose the line for the button "Select this line" (the row menu item does the same for one row)
  const [checkedLines, setCheckedLines] = useState<string[]>([]);
  // the toolbar icons "Create based on" / "Go to" (after Recalculate): a menu under the icon with the items of useTaskRelatedMenu - for the ONE checked line when exactly one is checked, else for the task
  const [toolbarMenu, setToolbarMenu] = useState<{ kind: 'create' | 'goto'; x: number; y: number } | null>(null);
  const createAnchor = useRef<View>(null);
  const gotoAnchor = useRef<View>(null);
  const openToolbarMenu = (kind: 'create' | 'goto') => {
    const ref = kind === 'create' ? createAnchor : gotoAnchor;
    if (ref.current && (ref.current as any).measureInWindow) (ref.current as any).measureInWindow((x: number, y: number, _w: number, h: number) => setToolbarMenu({ kind, x, y: y + h + 4 }));
    else setToolbarMenu({ kind, x: 120, y: 120 });
  };
  const pickLine = picker?.mode === 'line' ? (row: ReusableTableRow) => picker.onPick(pickedLine(projectGUID, taskGUID, row.rowGUID, String(row.rowParentGUID ?? ''))) : undefined;
  const { start: startVendorInvoice, busy: vendorInvoiceBusy } = useStartVendorInvoice();
  const { start: startPurchaseOrder, busy: purchaseOrderBusy } = useStartPurchaseOrder();
  // the line the user right-clicked for "Vendor Invoice": the window asks what goes into the invoice (this line / the whole task)
  const [vendorInvoiceLine, setVendorInvoiceLine] = useState<string | null>(null);
  // the same for "Purchase Order" (right after "Vendor Invoice")
  const [purchaseOrderLine, setPurchaseOrderLine] = useState<string | null>(null);
  const projectJSON = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON);
  const startMs = usePMStore((s) => s.schedule[taskGUID]?.startMs);
  const postButtonColor = usePMStore((s) => s.postButtonBackgroundColor);

  const startPlace = useRef(financesPlaceOf(initialPlace)).current;
  const [pickedGenus, setGenus] = useState<string>(() => taskLineGenusOf(startPlace?.genus));
  /** the line marked in the table: the one the place says, then the one the user edited last */
  const [focusLine, setFocusLine] = useState<string | null>(() => (startPlace?.lineGUID ?? null));

  // every line of the task (all genus): the tab counts and sums. The table of the active tab reads the same rows (all-rows mode).
  const lines: TaskLineRow[] = useSelector((s: any) => s?.[TASK_LINE_ENTITY]?.entityDataFromServer, shallowEqual) ?? NO_LINES;
  const taskLines = useMemo(() => (Array.isArray(lines) ? lines.filter((l) => l.rowOwnerGUID === taskGUID) : NO_LINES), [lines, taskGUID]);

  // ---- the input switches of the project: which tabs and which kinds of Time resource are offered (a tab with lines is never hidden) ----
  const scope = useMemo(() => taskInputScopeOf(projectJSON), [projectJSON]);
  // the optional product fields (Item number, Search name) the project switches on: the product window of a Material line
  const productFields = useMemo(() => productFieldsOfProject(projectJSON), [projectJSON]);
  const visibleGenus = useMemo(
    () => TASK_LINE_GENUS.filter((g) => tabVisible(scope, g.genus, taskLines.filter((l) => l.rowParentGUID === g.genus).length)),
    [scope, taskLines],
  );
  // the tab picked by the user (or by the place of the last edit) may have been switched off meanwhile: the first offered tab is shown instead
  const genus = visibleGenus.some((g) => g.genus === pickedGenus) ? pickedGenus : (visibleGenus[0]?.genus ?? pickedGenus);
  const def = taskLineGenusDef(genus) ?? TASK_LINE_GENUS[0];
  // the Time lines book WORK CENTERS (master on, or the task already has such a line); a project made before keeps a person / equipment of the catalog
  const timeWorkCenters = useMemo(
    () => scope.workCenters || taskLines.some((l) => l.rowParentGUID === MANAGEMENT_GENUS.time && l.rowJSON?.taskResourceKind === 'workCenter'),
    [scope, taskLines],
  );
  const timeKinds = useMemo(
    () => timeKindsOffered(scope, taskLines.filter((l) => l.rowParentGUID === MANAGEMENT_GENUS.time).map((l) => lineMenuKind(data, l.rowJSON || {}))),
    [scope, taskLines, data],
  );
  /** a kind besides the person is offered (equipment, work center): the line says its kind itself (a project without it keeps lines without a kind = person) */
  const equipmentOffered = timeKinds.some((k) => k !== 'person');
  const totals = useMemo(() => taskLineTotals(taskLines), [taskLines]);
  // the fifth tab "Payments" (kit8/pm/view/task/payments, documentation/PAYMENTS_PLAN_WBS.html): the planned payments of the task; not offered while the screen is a picker (a line is wanted)
  const payments = useTaskPaymentPlanRows(taskGUID, !picker);
  const paymentEnv = usePaymentPlanEnvironment(projectGUID, taskGUID, payments);
  usePaymentPlanFollowsTask(projectGUID, taskGUID, payments, paymentEnv);
  const paymentsActive = !picker && pickedGenus === PAYMENT_TAB_ID;
  // Post: the whole task; the state of the button (Post · Posted · Post needed) comes from the lines of ALL tabs
  const { state: postState, post } = useTaskPost({ projectGUID, taskGUID, lines: taskLines, distributions: data.distribution });

  // ---- exchange rates: the sums in the accounting / budget currency of the project ----
  const fxProject = useMemo(() => fxProjectOf(projectJSON), [projectJSON]);
  const fxOn = fxEnabled(fxProject);
  const taskStartDay = typeof startMs === 'number' && Number.isFinite(startMs) ? formatDateISO(startMs) : null;
  const today = todayISO();
  const currencyCodes = useMemo(
    () => (fxOn ? [fxProject.accountingCurrency, fxProject.budgetCurrency, fxProject.contractCurrency, ...taskLines.map((l) => lineContractCurrency(data, l.rowJSON || {}, fxProject.contractCurrency))].filter(Boolean) as string[] : []),
    [fxOn, fxProject, taskLines, data],
  );
  const { book } = useLineRateBook(currencyCodes, fxOn);
  /** null while the rates are being read: a line is never converted with half of them (and its saved sums are left alone) */
  const fx = useMemo<LineFxContext | null>(() => (fxOn && book ? { book, project: fxProject, taskStartDay, today } : null), [fxOn, book, fxProject, taskStartDay, today]);

  // the Errors column (the first one) is there only while a line of this tab has an error
  const hasErrors = useMemo(
    () => taskLines.some((l) => l.rowParentGUID === def.genus && taskLineErrors(data, def, l.rowJSON || {}, fx).length > 0),
    [taskLines, def, data, fx],
  );
  const columns = useMemo(
    () => buildTaskLineColumns({ data, genus: def, projectCurrency, textColor: c.text, errorColor: c.error, fxProject: fxOn ? fxProject : null, fx, showErrors: hasErrors, timeKinds, workCenters: timeWorkCenters, productFields }),
    [data, def, projectCurrency, c.text, c.error, fxOn, fxProject, fx, hasErrors, timeKinds, timeWorkCenters, productFields],
  );
  const rowFilter = useCallback((row: ReusableTableRow) => row.rowParentGUID === def.genus, [def.genus]);
  // taskManagementGenusLine = the genus of the tab: the contract templates the line can pick depend on it
  // a new Time line of a project that offers equipment says its kind: a person (the menu's first choice) - or an equipment when that is the only kind offered
  const newTimeKind = def.resource !== 'product' && equipmentOffered ? (timeKinds.includes('person') ? 'person' : timeKinds[0]) : undefined;
  /** the project books work centers: a new Time line is a work center line, the menu starts on the first kind switched on (Person, else Equipment, else Partner) */
  const newOnWorkCenters = def.resource !== 'product' && scope.workCenters;
  const newRowDefaults = useMemo(() => ({ rowOwnerGUID: taskGUID, rowParentGUID: def.genus, rowJSON: { taskManagementGenusLine: def.genus, distributionForBudgetTaskLine: DISTRIBUTION.uniform, budgetItemTaskLine: defaultBudgetItemOfGenus(data.budgetItem, def.genus), taskIsPosted: false, ...(newOnWorkCenters ? { taskResourceKind: 'workCenter', taskWorkCenterKind: timeKinds[0] } : newTimeKind ? { taskResourceKind: newTimeKind } : {}) } as Record<string, any> }), [taskGUID, def.genus, data.budgetItem, newTimeKind, newOnWorkCenters, timeKinds]);
  const computeRowJSON = useCallback((json: Record<string, any>) => computeTaskLineRowJSON(data, def, json, undefined, fx, projectJSON), [data, def, fx, projectJSON]);

  /** "Recalculate": the separate algorithm - the snapshot of the rate is ignored and the rates are taken again; true = the line changed */
  const recalcRow = useCallback((row: { rowGUID: string; rowJSON?: Record<string, any> }): boolean => {
    const actions = SystemMetaData[TASK_LINE_ENTITY]?.actions;
    if (!fx || !actions?.updateOne) return false;
    const fxPatch = recalculateLineFx(fx, data, def, row.rowJSON || {});
    if (!Object.keys(fxPatch).length) return false;
    // the sums changed: the posted days are out of date
    const patch = { ...fxPatch, taskIsPosted: false };
    dispatch(actions.updateOne({ rowGUID: row.rowGUID, rowOwnerGUID: taskGUID, rowJSON: patch }));
    return true;
  }, [fx, data, def, dispatch, taskGUID]);
  // The rates arrive after the lines (or a line was saved while they were being read): a line with a sum but without its snapshot gets it now,
  // so a price changed at that moment never stays without the sums in the accounting / budget currency. A line that cannot be converted stays as it is (the ⚠ says why).
  useEffect(() => {
    if (!fx) return;
    for (const l of taskLines) {
      const j = l.rowJSON || {};
      if (j.sumForContract != null && !j.fxSnapshotTaskLine && taskLineGenusDef(l.rowParentGUID)) {
        const g = taskLineGenusDef(l.rowParentGUID)!;
        const patch = computeFx(fx, data, g, j);
        const actions = SystemMetaData[TASK_LINE_ENTITY]?.actions;
        if (Object.keys(patch).length && actions?.updateOne) dispatch(actions.updateOne({ rowGUID: l.rowGUID, rowOwnerGUID: taskGUID, rowJSON: { ...patch, taskIsPosted: false } }));
      }
    }
  }, [fx, taskLines, data, dispatch, taskGUID]);
  const recalcAll = useCallback(() => {
    if (!fx) { dispatch(showSnackbar({ message: pmT('The exchange rates are not read yet') })); return; }
    const n = taskLines.filter((l) => l.rowParentGUID === def.genus).filter((l) => recalcRow(l)).length;
    dispatch(showSnackbar({ message: n ? pmT('{{count}} line(s) recalculated', { count: n }) : pmT('The sums are up to date') }));
  }, [fx, taskLines, def.genus, recalcRow, dispatch]);

  const onRowEdit = useCallback((rowGUID: string, kind: ReusableTableRowEditKind) => {
    if (kind === 'delete') {
      setFocusLine((cur) => (cur === rowGUID ? null : cur));
      onEditPlace?.({ genus: def.genus });
      return;
    }
    setFocusLine(rowGUID);
    onEditPlace?.({ genus: def.genus, lineGUID: rowGUID });
  }, [def.genus, onEditPlace]);

  if (!task) return null;
  if (isStage) {
    return (
      <View testID={`${testID}-stage`} style={[styles.note, { borderColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="info" size={18} color={c.primary} />
        <Text style={{ color: c.text, flex: 1 }}>{pmT('A stage has no lines: select a task or a milestone to see and edit its lines.')}</Text>
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.root}>
      <ScrollableTabBar testID={`${testID}-tabs`} style={[styles.tabs, { borderBottomColor: c.border }]}>
        {visibleGenus.map((g) => {
          const active = !paymentsActive && g.genus === genus;
          const t = totals.find((x) => x.genus === g.genus);
          return (
            <Pressable
              key={g.genus}
              accessibilityRole="tab"
              aria-selected={active}
              testID={`${testID}-tab-${g.genus}`}
              onPress={() => setGenus(g.genus)}
              style={[styles.tab, { borderBottomColor: active ? c.primary : 'transparent' }]}
            >
              <IconApp name={g.icon} size={16} color={active ? c.primary : c.text} />
              <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{pmT(g.title)}</Text>
              {!!t?.count && (
                <Text testID={`${testID}-tab-${g.genus}-sum`} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
                  {fxProject.accountingCurrency ? `${formatMoney(t.sumForAccounting)} ${fxProject.accountingCurrency}` : formatMoney(t.sumForContract)}
                </Text>
              )}
              {/* the number of lines: a round badge at the top right corner of the tab, like the number on a shopping cart */}
              {!!t?.count && (
                <View testID={`${testID}-tab-${g.genus}-count`} style={[styles.badge, { backgroundColor: c.primary }]}>
                  <Text style={styles.badgeText}>{t.count > 99 ? '99+' : String(t.count)}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
        {!picker ? (
          <Pressable
            accessibilityRole="tab"
            aria-selected={paymentsActive}
            testID={`${testID}-tab-${PAYMENT_TAB_ID}`}
            onPress={() => setGenus(PAYMENT_TAB_ID)}
            style={[styles.tab, { borderBottomColor: paymentsActive ? c.primary : 'transparent' }]}
          >
            <IconApp name="account_balance_wallet" size={16} color={paymentsActive ? c.primary : c.text} />
            <Text style={{ color: paymentsActive ? c.primary : c.text, fontWeight: paymentsActive ? '700' : '500', fontSize: 13 }}>{pmT('Payments')}</Text>
            {payments.length > 0 && (
              <View testID={`${testID}-tab-${PAYMENT_TAB_ID}-count`} style={[styles.badge, { backgroundColor: c.primary }]}>
                <Text style={styles.badgeText}>{payments.length > 99 ? '99+' : String(payments.length)}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </ScrollableTabBar>

      {paymentsActive ? (
        <PMTaskPaymentPlan projectGUID={projectGUID} taskGUID={taskGUID} data={data} taskLines={taskLines} payments={payments} testID={`${testID}-payments`} />
      ) : (
        <ReusableTable
          key={def.genus}
          testID={`${testID}-table`}
          entityName={TASK_LINE_ENTITY}
          crudListTitle={pmT(def.title)}
          itemLabel="Line"
          listOwnerGUID={taskGUID}
          // all-rows mode on the parent: the read is by task only (never by genus), the table of the tab filters its genus - the tab counts above
          // are made of the same rows
          listParentGUID={REUSABLE_TABLE_ALL}
          rowFilter={rowFilter}
          newRowDefaults={newRowDefaults}
          computeRowJSON={computeRowJSON}
          visualColumns={columns}
          defaultRowJSON={emptyTaskLine}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          dragAndDropColumns
          resizeColumnWidth
          focusRowGUID={focusLine}
          postDataNeeded
          postState={postState}
          onPost={post}
          postButtonColor={postButtonColor}
          duplicateOverrides={DUPLICATE_UNPOSTED}
          onRowEdit={onRowEdit}
          emptyText={pmT('No lines yet. Press "+ Add".')}
          // right button on a line: "Facts input" (kit8/documents/fact/input, documentation/FACT_INPUT.html) opens the fact document of the task on the tab of this line
          onRowOpen={pickLine}
          openLabel={pickLine ? pmT('Select this line') : undefined}
          extraMenuItems={(row, close) => [
            ...(pickLine ? [{ testID: `${testID}-pick-${row.rowGUID}`, label: pmT('Select this line'), icon: 'task_alt', onPress: () => { close(); pickLine(row); } }] : []),
            { testID: `${testID}-facts-${row.rowGUID}`, label: pmT('Facts input'), icon: 'fact_check', onPress: () => { close(); openFactInput({ taskGUID, projectGUID, taskLineGUID: row.rowGUID, genus: def.genus }); } },
            // right after "Facts input" (a revenue line has no vendor): asks "this line / all the lines of the task", then creates the vendor invoice (kit8/documents/vendor/invoice)
            ...(def.genus !== 'revenueGenus' ? [{ testID: `${testID}-vendor-invoice-${row.rowGUID}`, label: pmT('Vendor Invoice'), icon: 'receipt_long', onPress: () => { close(); setVendorInvoiceLine(row.rowGUID); } }] : []),
            // right after "Vendor Invoice": the same question, then the PURCHASE ORDER (kit8/documents/vendor/purchase_order)
            ...(def.genus !== 'revenueGenus' ? [{ testID: `${testID}-purchase-order-${row.rowGUID}`, label: pmT('Purchase Order'), icon: 'shopping_cart', onPress: () => { close(); setPurchaseOrderLine(row.rowGUID); } }] : []),
            // the GUID of the line (task_line_table) on the clipboard: to paste into a multi project vendor invoice / purchase order line
            { testID: `${testID}-copy-guid-${row.rowGUID}`, label: pmT('Copy line GUID'), icon: 'fingerprint', onPress: () => { close(); void copyLineGUID(row.rowGUID, dispatch); } },
            // the submenus "Create based on this" and "Go to" for THIS line (the lists open filtered for the task line) - useTaskRelatedMenu
            ...relatedMenu({ taskGUID, projectGUID, taskLineGUID: row.rowGUID, genus: def.genus, idPrefix: `${testID}-line-${row.rowGUID}`, close, noVendor: def.genus === 'revenueGenus', onVendorInvoice: () => setVendorInvoiceLine(row.rowGUID), onPurchaseOrder: () => setPurchaseOrderLine(row.rowGUID) }),
            ...(fxOn ? [{ testID: `${testID}-recalc-${row.rowGUID}`, label: pmT('Recalculate currency sums'), icon: 'currency_exchange', onPress: () => { close(); recalcRow(row); } }] : []),
          ]}
          onSelectionChange={setCheckedLines}
          toolbarExtra={(
            <>
              {/* picker (a line is wanted): the button says what it does; one line must be checked (or marked) - the same size as "Select this task" */}
              {pickLine ? (
                <PMDialogButton
                  testID={`${testID}-pick-checked`}
                  kind="primary"
                  icon="task_alt"
                  title={pmT('Select this line')}
                  width={PM_WIDE_ACTION_WIDTH}
                  height={PM_WIDE_ACTION_HEIGHT}
                  disabled={!(checkedLines.length === 1 || (checkedLines.length === 0 && focusLine))}
                  onPress={() => {
                    const guid = checkedLines.length === 1 ? checkedLines[0] : focusLine;
                    const row = taskLines.find((l) => l.rowGUID === guid);
                    if (row) pickLine(row as any);
                  }}
                />
              ) : null}
              {fxOn ? <PMIconButton tipScope="app" testID={`${testID}-recalc-all`} icon="currency_exchange" title={pmT('Recalculate the sums in the accounting / budget currency of every line of this tab with the rates now')} color={c.text} onPress={recalcAll} /> : null}
              {/* "Create based on" and "Go to": the same items as the Task menu (Fact input, Vendor / Customer invoice, Purchase order, Time sheet, Subproject ... / the document lists), for the checked line or the task */}
              <View ref={createAnchor} collapsable={false}>
                <PMIconButton tipScope="app" testID={`${testID}-create-based-on`} icon="add_circle" title={checkedLines.length === 1 ? pmT('Create based on the checked line') : pmT('Create based on this task')} color={c.text} onPress={() => openToolbarMenu('create')} />
              </View>
              <View ref={gotoAnchor} collapsable={false}>
                <PMIconButton tipScope="app" testID={`${testID}-goto`} icon="arrow_forward" title={checkedLines.length === 1 ? pmT('Go to (documents of the checked line)') : pmT('Go to (documents of this task)')} color={c.text} onPress={() => openToolbarMenu('goto')} />
              </View>
            </>
          )}
          realtime
        />
      )}
      {toolbarMenu && (() => {
        const line = checkedLines.length === 1 ? taskLines.find((l) => l.rowGUID === checkedLines[0]) : undefined;
        const items = relatedMenu({
          taskGUID, projectGUID, ...(line ? { taskLineGUID: line.rowGUID, genus: def.genus, noVendor: def.genus === 'revenueGenus', onVendorInvoice: () => setVendorInvoiceLine(line.rowGUID), onPurchaseOrder: () => setPurchaseOrderLine(line.rowGUID) } : {}),
          idPrefix: `${testID}-toolbar`, close: () => setToolbarMenu(null),
        });
        const shown = items.find((it) => it.testID.endsWith(toolbarMenu.kind === 'create' ? '-create' : '-goto'))?.submenu ?? [];
        return shown.length ? <PMContextMenu testID={`${testID}-toolbar-menu`} x={toolbarMenu.x} y={toolbarMenu.y} caption={line ? pmT('Line') : pmT('Task')} items={shown} onClose={() => setToolbarMenu(null)} /> : null;
      })()}
      <VendorInvoiceScopeModal
        testID={`${testID}-vendor-scope`}
        visible={!!vendorInvoiceLine}
        busy={vendorInvoiceBusy}
        onCancel={() => setVendorInvoiceLine(null)}
        onCreate={(scope) => {
          const line = vendorInvoiceLine;
          setVendorInvoiceLine(null);
          if (line) void startVendorInvoice({ taskGUID, projectGUID, lineGUIDs: vendorInvoiceLinesOfScope(scope, line) });
        }}
      />
      <PurchaseOrderScopeModal
        testID={`${testID}-purchase-order-scope`}
        visible={!!purchaseOrderLine}
        busy={purchaseOrderBusy}
        onCancel={() => setPurchaseOrderLine(null)}
        onCreate={(scope) => {
          const line = purchaseOrderLine;
          setPurchaseOrderLine(null);
          if (line) void startPurchaseOrder({ taskGUID, projectGUID, lineGUIDs: purchaseOrderLinesOfScope(scope, line) });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  // paddingTop / paddingRight leave room for the count badge in the corner
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 8, paddingLeft: 14, paddingRight: 20, borderBottomWidth: 2 },
  badge: { position: 'absolute', top: 2, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
});
