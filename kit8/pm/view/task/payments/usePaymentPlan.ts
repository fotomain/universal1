// Payment plan - the hooks of the Payments tab of a task (documentation/PAYMENTS_PLAN_WBS.html):
//   useTaskPaymentPlanRows        the payments of ONE task from redux (read + Realtime; the tab bar needs the count while another tab is open)
//   usePaymentPlanEnvironment     what the rules need: the first / last day of the task, the project switch, the exchange rates, the currencies
//   usePaymentPlanFollowsTask     the task moved: a payment dated by its shift moves with it, a payment with a typed date keeps the date and gets a new shift (paymentPlanDates.ts)
//   usePaymentPlanPost            the Post button: the RPC post_task_payment_plan, ALL or NOTHING, a refusal opens a window with the list
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../../redux/reusable/useRealtimeEntity';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { showErrorModal } from '../../../../ui/components/common/ErrorModalWindow';
import { usePMStore } from '../../../store/store_pm';
import { pmT } from '../../../i18n/pmT';
import { taskDaysOf } from '../plan/runTaskPost';
import { fxEnabled, fxProjectOf, type LineFxProject } from '../finances/taskLineFx';
import { useLineRateBook } from '../finances/useLineRateBook';
import type { TaskLineCatalogData } from '../finances/taskLineCatalogs';
import { PAYMENT_POST_PROBLEM_TEXT, postTaskPaymentPlan, type PaymentPostProblemKey } from './paymentPlanApi';
import { computePaymentFx, type PaymentFxContext } from './paymentPlanMoney';
import { recomputePaymentDates, type PaymentTaskDays } from './paymentPlanDates';
import { paymentPostState, TASK_PAYMENT_PLAN_ENTITY, type TaskPaymentPlanRow } from './paymentPlanModel';

const NO_ROWS: TaskPaymentPlanRow[] = [];

/** the payments of a task (every direction), kept current by the read and Realtime */
export function useTaskPaymentPlanRows(taskGUID: string, enabled = true): TaskPaymentPlanRow[] {
  const dispatch = useDispatch();
  const actions = SystemMetaData[TASK_PAYMENT_PLAN_ENTITY]?.actions;
  const params = useMemo(() => ({ paginationSize: 1000, originationCurrentPage: 0, match: { rowOwnerGUID: taskGUID } }), [taskGUID]);
  useRealtimeEntity(TASK_PAYMENT_PLAN_ENTITY, { enabled: enabled && !!taskGUID, readParams: params });
  useEffect(() => {
    if (enabled && taskGUID && actions?.readData) dispatch(actions.readData(params));
  }, [enabled, taskGUID, actions, dispatch, params]);
  const all: any[] | undefined = useSelector((s: any) => s?.[TASK_PAYMENT_PLAN_ENTITY]?.entityDataFromServer, shallowEqual);
  return useMemo(() => (Array.isArray(all) ? (all.filter((r) => r.rowOwnerGUID === taskGUID) as TaskPaymentPlanRow[]) : NO_ROWS), [all, taskGUID]);
}

export interface PaymentPlanEnvironment {
  days: PaymentTaskDays;
  /** the project switch paymentPlanAfterTaskFinishEnabled (true unless stored false) */
  afterFinishOn: boolean;
  fxProject: LineFxProject;
  /** the accounting / budget currencies are set: the sums are converted */
  fxOn: boolean;
  /** null while the rates are being read, or when the project converts into no currency */
  fx: PaymentFxContext | null;
  /** the currency of a payment that has no contract */
  projectCurrency: string | null;
}

export function usePaymentPlanEnvironment(projectGUID: string, taskGUID: string, rows: TaskPaymentPlanRow[]): PaymentPlanEnvironment {
  const projectJSON = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON);
  const startMs = usePMStore((s) => s.schedule[taskGUID]?.startMs);
  const finishMs = usePMStore((s) => s.schedule[taskGUID]?.finishMs);
  const days = useMemo<PaymentTaskDays>(() => {
    const d = taskDaysOf(startMs, finishMs);
    return { start: d.fromDay, end: d.toDay };
  }, [startMs, finishMs]);
  const fxProject = useMemo(() => fxProjectOf(projectJSON), [projectJSON]);
  const fxOn = fxEnabled(fxProject);
  const codes = useMemo(() => (fxOn ? [fxProject.accountingCurrency, fxProject.budgetCurrency, fxProject.contractCurrency, ...rows.map((r) => r.rowJSON?.paymentPlanCurrency)].filter(Boolean) as string[] : []), [fxOn, fxProject, rows]);
  const { book } = useLineRateBook(codes, fxOn);
  const fx = useMemo<PaymentFxContext | null>(() => (fxOn && book ? { book, project: fxProject } : null), [fxOn, book, fxProject]);
  return { days, afterFinishOn: (projectJSON as any)?.paymentPlanAfterTaskFinishEnabled !== false, fxProject, fxOn, fx, projectCurrency: fxProject.contractCurrency };
}

/**
 * The task moved (or the payments were read): every payment is brought in line with the new days. A payment that is already right is not written, so this is quiet.
 * Waits for the exchange rates while the project converts sums (a moved date changes the day of the rate).
 */
export function usePaymentPlanFollowsTask(projectGUID: string, taskGUID: string, rows: TaskPaymentPlanRow[], env: PaymentPlanEnvironment): void {
  const dispatch = useDispatch();
  const actions = SystemMetaData[TASK_PAYMENT_PLAN_ENTITY]?.actions;
  const live = useRef({ rows, env });
  live.current = { rows, env };
  const key = `${taskGUID}|${env.days.start}|${env.days.end}|${rows.length}|${env.fxOn ? (env.fx ? 'fx' : 'wait') : 'nofx'}`;
  useEffect(() => {
    const { rows: list, env: e } = live.current;
    if (!actions?.updateOne || !e.days.start || (e.fxOn && !e.fx)) return;
    for (const r of list) {
      const dates = recomputePaymentDates(r.rowJSON || {}, e.days);
      if (Object.keys(dates).length === 0) continue;
      // only the dates that MOVED: a payment that was never given a date is left to the user (the first edit gives it one)
      if (!r.rowJSON?.paymentPlannedTransactionDate && !dates.paymentPlannedTransactionDate) continue;
      const merged = { ...(r.rowJSON || {}), ...dates };
      const fx = e.fx ? computePaymentFx(e.fx, merged) : {};
      dispatch(actions.updateOne({ rowGUID: r.rowGUID, rowOwnerGUID: taskGUID, rowJSON: { ...dates, ...fx, paymentIsPosted: false } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** one line per payment: "#2 Outbound: no budget item, no contract" */
export function paymentPostRefusalText(rows: TaskPaymentPlanRow[], problems: { lineGUID: string; problem: string }[]): string {
  const lines: string[] = [];
  const order = [...rows].sort((a, b) => Number(a.orderInList ?? 0) - Number(b.orderInList ?? 0));
  for (const r of order) {
    const mine = problems.filter((p) => p.lineGUID === r.rowGUID);
    if (!mine.length) continue;
    const reasons = mine.map((p) => pmT(PAYMENT_POST_PROBLEM_TEXT[p.problem as PaymentPostProblemKey] ?? p.problem));
    lines.push(`#${order.indexOf(r) + 1} ${r.rowParentGUID === 'inbound' ? pmT('Inbound') : pmT('Outbound')}: ${reasons.join(', ')}`);
  }
  return lines.join('\n');
}

export function usePaymentPlanPost(taskGUID: string, rows: TaskPaymentPlanRow[], days: PaymentTaskDays) {
  const dispatch = useDispatch();
  const state = useMemo(() => paymentPostState(rows), [rows]);
  const live = useRef({ rows, days });
  live.current = { rows, days };
  const post = useCallback(async (): Promise<void> => {
    const say = (message: string, isError = false) => dispatch(showSnackbar({ message, isError }));
    try {
      const r = await postTaskPaymentPlan(taskGUID, live.current.days.start, live.current.days.end);
      if (r.status === 'refused') showErrorModal(paymentPostRefusalText(live.current.rows, r.problems) || pmT('The payments cannot be posted'), pmT('Payments not posted'));
      else if (r.status === 'nothing') say(pmT('Nothing to post: add payments'), true);
      else say(pmT('Posted {{count}} payment(s)', { count: r.lines }));
    } catch (e: any) {
      say(`${pmT('The payments could not be posted')}: ${String(e?.message || e)}`, true);
    }
  }, [dispatch, taskGUID]);
  return { state, post };
}

export type { TaskLineCatalogData };
