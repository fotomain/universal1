// PMTaskPaymentPlan - the content of the first level tab TabPayments of the Finances view of a task (PMProjectTaskInputCRUD). documentation/PAYMENTS_PLAN_WBS.html
//   Three sub-tabs (ScrollableTabBar): Outbound · Inbound · Cash flow. Outbound / Inbound = the table of the planned payments of that direction (ReusableTable on task_payment_plan_lines,
//   optimistic CRUD, Post button, fill / refresh buttons); Cash flow is EMPTY - the place of a later report.
//   The rules are plain functions (paymentPlanCompute / Dates / Money / Fill.ts); this file only connects them to the table.
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import IconApp from '../../../../ui/components/common/IconApp';
import { ModalAskComponent } from '../../../../ui/components/common/ModalAskComponent';
import ScrollableTabBar from '../../../../ui/components/tabs/ScrollableTabBar';
import ReusableTable from '../../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL, type ReusableTableRow } from '../../../../ui/components/table/reusable/reusableTableTypes';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { usePMStore } from '../../../store/store_pm';
import { pmT } from '../../../i18n/pmT';
import type { TaskLineCatalogData } from '../finances/taskLineCatalogs';
import type { TaskLineRow } from '../finances/taskLineModel';
import { buildPaymentColumns, paymentErrors } from './paymentPlanColumns';
import { computePaymentPlanRowJSON, type PaymentComputeContext } from './paymentPlanCompute';
import { recalculatePaymentFx } from './paymentPlanMoney';
import { fillDirectionOf, PAYMENT_FILL_GENUS, paymentFillSummary, planPaymentFill, type PaymentFillPlan } from './paymentPlanFill';
import { emptyPaymentPlanLine, PAYMENT_SUB_TABS, TASK_PAYMENT_PLAN_ENTITY, type PaymentDirection, type PaymentSubTab, type TaskPaymentPlanRow, type TaskPaymentPlanRowJSON } from './paymentPlanModel';
import { usePaymentPlanEnvironment, usePaymentPlanPost } from './usePaymentPlan';

export interface PMTaskPaymentPlanProps {
  projectGUID: string;
  taskGUID: string;
  /** the catalogs of the task lines (useTaskLineCatalogs) - the payment rules read the contracts, partners, budget items and business units from them */
  data: TaskLineCatalogData;
  /** every task line of the task (the fill buttons read the lines of one genus) */
  taskLines: TaskLineRow[];
  /** every payment of the task (all directions): the parent keeps them current (useTaskPaymentPlanRows) */
  payments: TaskPaymentPlanRow[];
  testID?: string;
}

const NEW_ID = (): string => (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

export default function PMTaskPaymentPlan({ projectGUID, taskGUID, data, taskLines, payments, testID = 'task-payments' }: PMTaskPaymentPlanProps) {
  const { themeColors: c } = useDesignSystem();
  const dispatch = useDispatch();
  const [sub, setSub] = useState<PaymentSubTab>('outbound');
  const postButtonColor = usePMStore((s) => s.postButtonBackgroundColor);
  const env = usePaymentPlanEnvironment(projectGUID, taskGUID, payments);
  const { state: postState, post } = usePaymentPlanPost(taskGUID, payments, env.days);
  const [pendingFill, setPendingFill] = useState<{ genus: string; plan: PaymentFillPlan } | null>(null);

  const direction: PaymentDirection | null = sub === 'cashFlow' ? null : sub;
  const catalogs = useMemo(() => ({ contract: data.contract, partner: data.partner, budgetItem: data.budgetItem }), [data.contract, data.partner, data.budgetItem]);
  const ctxOf = useCallback((d: PaymentDirection): PaymentComputeContext => ({ data: catalogs, direction: d, days: env.days, fx: env.fx, projectCurrency: env.projectCurrency }), [catalogs, env.days, env.fx, env.projectCurrency]);

  const hasErrors = useMemo(
    () => !!direction && payments.some((p) => p.rowParentGUID === direction && paymentErrors({ ...ctxOf(direction), afterFinishOn: env.afterFinishOn }, p.rowJSON || {}).length > 0),
    [payments, direction, ctxOf, env.afterFinishOn],
  );
  const columns = useMemo(
    () => (direction ? buildPaymentColumns({
      data, direction, days: env.days, afterFinishOn: env.afterFinishOn, fx: env.fx, fxProject: env.fxOn ? env.fxProject : null, projectCurrency: env.projectCurrency,
      textColor: c.text, errorColor: c.error, showErrors: hasErrors,
    }) : []),
    [data, direction, env, c.text, c.error, hasErrors],
  );
  const rowFilter = useCallback((row: ReusableTableRow) => row.rowParentGUID === direction, [direction]);
  const computeRowJSON = useCallback((json: Record<string, any>) => (direction ? computePaymentPlanRowJSON(ctxOf(direction), json) : {}), [direction, ctxOf]);
  const newRowDefaults = useMemo(() => {
    if (!direction) return undefined;
    const base: TaskPaymentPlanRowJSON = { ...emptyPaymentPlanLine(), paymentPlanPaymentDirection: direction, paymentPlanTimelineAnchor: 'taskStart' };
    return { rowOwnerGUID: taskGUID, rowParentGUID: direction, rowJSON: { ...base, ...computePaymentPlanRowJSON(ctxOf(direction), base) } as Record<string, any> };
  }, [direction, taskGUID, ctxOf]);

  const actions = SystemMetaData[TASK_PAYMENT_PLAN_ENTITY]?.actions;
  const say = useCallback((message: string, isError = false) => dispatch(showSnackbar({ message, isError })), [dispatch]);

  /** "Recalculate": the sums of every payment of the direction with the rates now */
  const recalcAll = useCallback(() => {
    if (!direction || !env.fx || !actions?.updateOne) { say(pmT('The exchange rates are not read yet'), true); return; }
    let n = 0;
    for (const p of payments.filter((r) => r.rowParentGUID === direction)) {
      const patch = recalculatePaymentFx(env.fx, p.rowJSON || {});
      if (Object.keys(patch).length === 0) continue;
      dispatch(actions.updateOne({ rowGUID: p.rowGUID, rowOwnerGUID: taskGUID, rowJSON: { ...patch, paymentIsPosted: false } }));
      n += 1;
    }
    say(n ? pmT('{{count}} payment(s) recalculated', { count: n }) : pmT('The sums are up to date'));
  }, [direction, env.fx, actions, payments, dispatch, taskGUID, say]);

  const applyFill = useCallback((plan: PaymentFillPlan) => {
    if (!actions) return;
    for (const r of plan.create) dispatch(actions.createOne({ rowGUID: r.rowGUID, rowOwnerGUID: r.rowOwnerGUID, rowParentGUID: r.rowParentGUID, orderInList: r.orderInList, rowJSON: r.rowJSON }));
    for (const u of plan.update) dispatch(actions.updateOne({ rowGUID: u.rowGUID, rowOwnerGUID: taskGUID, rowJSON: u.patch }));
    for (const id of plan.remove) dispatch(actions.deleteOne({ rowGUID: id, rowOwnerGUID: taskGUID }));
    const s = paymentFillSummary(plan);
    say(pmT('{{create}} payment(s) made, {{update}} changed, {{remove}} removed', { create: s.create, update: s.update, remove: s.remove }));
  }, [actions, dispatch, taskGUID, say]);

  /** a press on "Fill / refresh from <genus> lines": a plan that only makes payments is applied at once; one that changes or removes asks first */
  const onFill = useCallback((genus: string) => {
    const dir = fillDirectionOf(genus);
    if (!dir) return;
    const plan = planPaymentFill({ genus, taskGUID, lines: taskLines, existing: payments, data, ctx: ctxOf(dir), newId: NEW_ID, now: Date.now() });
    const s = paymentFillSummary(plan);
    if (s.nothing) { say(plan.lines === 0 ? pmT('The task has no lines of this kind') : pmT('The payments are up to date'), plan.lines === 0); return; }
    if (s.update + s.remove > 0) setPendingFill({ genus, plan }); else applyFill(plan);
  }, [taskGUID, taskLines, payments, data, ctxOf, applyFill, say]);

  const fills = PAYMENT_FILL_GENUS.filter((g) => g.direction === direction);

  return (
    <View testID={testID} style={styles.root}>
      <ScrollableTabBar testID={`${testID}-subtabs`} style={[styles.tabs, { borderBottomColor: c.border }]}>
        {PAYMENT_SUB_TABS.map((t) => {
          const active = t.id === sub;
          const count = t.id === 'cashFlow' ? 0 : payments.filter((p) => p.rowParentGUID === t.id).length;
          return (
            <Pressable key={t.id} accessibilityRole="tab" aria-selected={active} testID={`${testID}-subtab-${t.id}`} onPress={() => setSub(t.id)} style={[styles.tab, { borderBottomColor: active ? c.primary : 'transparent' }]}>
              <IconApp name={t.icon} size={16} color={active ? c.primary : c.text} />
              <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{pmT(t.title)}</Text>
              {count > 0 ? (
                <View testID={`${testID}-subtab-${t.id}-count`} style={[styles.badge, { backgroundColor: c.primary }]}><Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text></View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollableTabBar>

      {sub === 'cashFlow' ? (
        // EMPTY on purpose: the cash flow report comes in a later round (it will read the POSTED payments, task_payment_plan_movements)
        <View testID={`${testID}-cashflow`} style={[styles.note, { borderColor: c.border, backgroundColor: c.surface }]}>
          <IconApp name="show_chart" size={18} color={c.primary} />
          <Text style={{ color: c.text, flex: 1 }}>{pmT('Cash flow: the report of the posted payments comes later.')}</Text>
        </View>
      ) : (
        <ReusableTable
          key={sub}
          testID={`${testID}-table`}
          entityName={TASK_PAYMENT_PLAN_ENTITY}
          crudListTitle={pmT(sub === 'inbound' ? 'Inbound payments' : 'Outbound payments')}
          itemLabel="Payment"
          listOwnerGUID={taskGUID}
          // all-rows mode on the parent (one read of the task), the table of the sub-tab filters its direction
          listParentGUID={REUSABLE_TABLE_ALL}
          rowFilter={rowFilter}
          newRowDefaults={newRowDefaults}
          computeRowJSON={computeRowJSON}
          visualColumns={columns}
          defaultRowJSON={emptyPaymentPlanLine}
          dragAndDropColumns
          resizeColumnWidth
          postDataNeeded
          postState={postState}
          onPost={post}
          postButtonColor={postButtonColor}
          emptyText={pmT('No payments yet. Press "+ Add" or fill them from the lines of the task.')}
          toolbarExtra={(
            <>
              {fills.map((g) => (
                <PMDialogButton
                  key={g.genus}
                  testID={`${testID}-fill-${g.genus}`}
                  kind="secondary"
                  icon="auto_fix_high"
                  title={pmT('Fill / refresh from {{kind}} lines', { kind: pmT(g.title) })}
                  onPress={() => onFill(g.genus)}
                />
              ))}
              {env.fxOn ? <PMIconButton tipScope="app" testID={`${testID}-recalc-all`} icon="currency_exchange" title={pmT('Recalculate the sums in the accounting / budget currency of every payment of this tab with the rates now')} color={c.text} onPress={recalcAll} /> : null}
            </>
          )}
          realtime={false}
        />
      )}

      <ModalAskComponent
        testID={`${testID}-fill-ask`}
        visible={!!pendingFill}
        modalTopBar={pmT('Refresh the payments?')}
        modalBody={pendingFill ? pmT('{{update}} payment(s) will change and {{remove}} will be removed. What you typed on a payment (dates, budget item, payee ...) is kept.', { update: pendingFill.plan.update.length, remove: pendingFill.plan.remove.length }) : ''}
        cancelLabel={pmT('Cancel')}
        confirmLabel={pmT('Refresh')}
        confirmColor={c.primary}
        onCancel={() => setPendingFill(null)}
        onConfirm={() => { const p = pendingFill; setPendingFill(null); if (p) applyFill(p.plan); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 8, paddingLeft: 14, paddingRight: 20, borderBottomWidth: 2 },
  badge: { position: 'absolute', top: 2, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
});
