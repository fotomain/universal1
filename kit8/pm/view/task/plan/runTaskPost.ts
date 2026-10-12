// runTaskPost - Post of ONE task as a plain async function (no React): calculate the plan of its lines (calculateTaskLinePlan), send it to the
// SQL procedure create_task_line_plan (one transaction) and RETURN what happened. useTaskPost (the Post button of one task) and the project
// actions (Post unposted tasks · Repost all tasks, view/project/actions) both use it, so a task is posted the same way from everywhere.
import { MANAGEMENT_CALENDAR_TABLE, DEFAULT_CALENDAR_FOR_TASK_PLAN, yearsBetween } from '../../../../catalog/management/calendar/managementCalendarModel';
import { fetchCalendarDays } from '../../../../catalog/management/calendar/managementCalendarApi';
import type { DefRow } from '../../../../catalog/product/productModel';
import { formatDateISO } from '../../project/scheduling';
import { pmT } from '../../../i18n/pmT';
import type { TaskLineRow } from '../finances/taskLineModel';
import { calculateTaskLinePlan } from './calculateTaskLinePlan';
import { createTaskLinePlan } from './taskLinePlanApi';
import { postableLines } from './taskLinePlanModel';

/** 'YYYY-MM-DD' of the first and the last day of a task from the scheduler (finish is exclusive; a milestone has one day) */
export function taskDaysOf(startMs: number | undefined, finishMs: number | undefined): { fromDay: string | null; toDay: string | null } {
  if (typeof startMs !== 'number' || !Number.isFinite(startMs)) return { fromDay: null, toDay: null };
  const last = typeof finishMs === 'number' && Number.isFinite(finishMs) && finishMs > startMs ? finishMs - 1 : startMs;
  return { fromDay: formatDateISO(startMs), toDay: formatDateISO(last) };
}

export interface RunTaskPostArgs {
  taskGUID: string;
  /** the lines of the task (all genus) */
  lines: TaskLineRow[];
  /** distributionGenericTable rows */
  distributions: DefRow<any>[];
  /** managementCalendarTable rows (only their titles are used, for the messages) */
  calendars: DefRow<any>[];
  calendarForTaskPlan?: string | null;
  startMs: number | undefined;
  finishMs: number | undefined;
}

export type RunTaskPostResult =
  /** the plan was written: `problems` = the lines left out (the others were posted) */
  | { status: 'posted'; lines: number; rows: number; problems: string[] }
  /** nothing was written: `noBudget` = no line of the task has a budget item at all (the user must choose one first) */
  | { status: 'nothing'; noBudget: boolean; problems: string[] }
  /** the database refused or a read failed */
  | { status: 'error'; message: string };

export async function runTaskPost(args: RunTaskPostArgs): Promise<RunTaskPostResult> {
  const { taskGUID, lines, distributions, calendars, startMs, finishMs } = args;
  const calendarForTaskPlan = args.calendarForTaskPlan || DEFAULT_CALENDAR_FOR_TASK_PLAN;
  try {
    if (postableLines(lines).length === 0) return { status: 'nothing', noBudget: true, problems: [] };
    const { fromDay, toDay } = taskDaysOf(startMs, finishMs);
    let calendarDays: { rowJSON?: any }[] = [];
    if (fromDay && toDay) {
      // only the years the task touches are needed
      const years = yearsBetween(fromDay, toDay);
      calendarDays = await fetchCalendarDays(calendarForTaskPlan, `${years[0]}-01-01`, `${years[years.length - 1]}-12-31`);
    }
    const calendarTitle = String(calendars.find((r) => r.rowGUID === calendarForTaskPlan)?.rowJSON?.title || '') || undefined;
    const plan = calculateTaskLinePlan({ taskGUID, fromDay, toDay, lines, calendarDays, distributions, calendarTitle });
    const problems = plan.errors.map((e) => pmT(e.message));
    if (!plan.taskLinePlanJSON) return { status: 'nothing', noBudget: false, problems };
    const result = await createTaskLinePlan(plan.taskLinePlanJSON);
    return { status: 'posted', lines: result.lines, rows: result.rows, problems };
  } catch (e: any) {
    return { status: 'error', message: String(e?.message || e) };
  }
}

/** the table of the calendars (re-exported so the callers need one import to read them from redux) */
export const CALENDAR_ENTITY = MANAGEMENT_CALENDAR_TABLE.entity;
