// useTaskPost - Post of ONE task (the Post button of the task line table): calculate the plan of its lines (calculateTaskLinePlan), send it to the
// SQL procedure create_task_line_plan (one transaction) and tell the user what happened. The state of the button comes from the lines (taskPostState),
// which realtime keeps current: the procedure sets taskIsPosted on the lines it posted.
import { useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { usePMStore } from '../../../store/store_pm';
import { formatDateISO } from '../../project/scheduling';
import { MANAGEMENT_CALENDAR_TABLE, DEFAULT_CALENDAR_FOR_TASK_PLAN, yearsBetween } from '../../../../catalog/management/calendar/managementCalendarModel';
import { fetchCalendarDays } from '../../../../catalog/management/calendar/managementCalendarApi';
import type { DefRow } from '../../../../catalog/product/productModel';
import type { TaskLineRow } from '../finances/taskLineModel';
import { calculateTaskLinePlan } from './calculateTaskLinePlan';
import { createTaskLinePlan } from './taskLinePlanApi';
import { taskPostState, TaskPostState } from './taskLinePlanModel';
import { pmT } from '../../../i18n/pmT';

export interface UseTaskPostArgs {
  projectGUID: string;
  taskGUID: string;
  /** the lines of the task (all genus) */
  lines: TaskLineRow[];
  /** distributionGenericTable rows */
  distributions: DefRow<any>[];
}

/** 'YYYY-MM-DD' of the first and the last day of a task from the scheduler (finish is exclusive; a milestone has one day) */
export function taskDaysOf(startMs: number | undefined, finishMs: number | undefined): { fromDay: string | null; toDay: string | null } {
  if (typeof startMs !== 'number' || !Number.isFinite(startMs)) return { fromDay: null, toDay: null };
  const last = typeof finishMs === 'number' && Number.isFinite(finishMs) && finishMs > startMs ? finishMs - 1 : startMs;
  return { fromDay: formatDateISO(startMs), toDay: formatDateISO(last) };
}

export function useTaskPost({ projectGUID, taskGUID, lines, distributions }: UseTaskPostArgs) {
  const dispatch = useDispatch();
  const calendarForTaskPlan = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON?.calendarForTaskPlan) || DEFAULT_CALENDAR_FOR_TASK_PLAN;
  const startMs = usePMStore((s) => s.schedule[taskGUID]?.startMs);
  const finishMs = usePMStore((s) => s.schedule[taskGUID]?.finishMs);
  const calendars: DefRow<any>[] = useSelector((s: any) => s?.[MANAGEMENT_CALENDAR_TABLE.entity]?.entityDataFromServer) ?? [];
  const state: TaskPostState = useMemo(() => taskPostState(lines), [lines]);
  const live = useRef({ lines, distributions, calendars, calendarForTaskPlan, startMs, finishMs });
  live.current = { lines, distributions, calendars, calendarForTaskPlan, startMs, finishMs };

  const post = useCallback(async (): Promise<void> => {
    const L = live.current;
    const say = (message: string) => dispatch(showSnackbar({ message }));
    try {
      const { fromDay, toDay } = taskDaysOf(L.startMs, L.finishMs);
      let calendarDays: { rowJSON?: any }[] = [];
      if (fromDay && toDay) {
        // only the years the task touches are needed
        const years = yearsBetween(fromDay, toDay);
        calendarDays = await fetchCalendarDays(L.calendarForTaskPlan, `${years[0]}-01-01`, `${years[years.length - 1]}-12-31`);
      }
      const calendarTitle = String(L.calendars.find((r) => r.rowGUID === L.calendarForTaskPlan)?.rowJSON?.title || '') || undefined;
      const plan = calculateTaskLinePlan({ taskGUID, fromDay, toDay, lines: L.lines, calendarDays, distributions: L.distributions, calendarTitle });
      const problems = plan.errors.map((e) => pmT(e.message));
      if (!plan.taskLinePlanJSON) {
        say(problems.length ? problems[0] + (problems.length > 1 ? ` (+${problems.length - 1})` : '') : pmT('Nothing to post: choose a budget item on the lines'));
        return;
      }
      const result = await createTaskLinePlan(plan.taskLinePlanJSON);
      const note = problems.length ? ` · ${pmT('{{count}} line(s) not posted: {{first}}', { count: problems.length, first: problems[0] })}` : '';
      say(`${pmT('Posted {{lines}} line(s) · {{rows}} day row(s)', { lines: result.lines, rows: result.rows })}${note}`);
    } catch (e: any) {
      say(`${pmT('The task could not be posted')}: ${e?.message || e}`);
    }
  }, [dispatch, taskGUID]);

  return { state, post };
}
