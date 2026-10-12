// useTaskPost - Post of ONE task (the Post button of the task line table): calculate the plan of its lines (calculateTaskLinePlan), send it to the
// SQL procedure create_task_line_plan (one transaction) and tell the user what happened (runTaskPost does the work). The state of the button comes
// from the lines (taskPostState), which realtime keeps current: the procedure sets taskIsPosted on the lines it posted.
// A task with NO budget item on any line cannot be posted: that is the user's to fix, so it gets a modal window, not a snack bar.
import { useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { showErrorModal } from '../../../../ui/components/common/ErrorModalWindow';
import { usePMStore } from '../../../store/store_pm';
import { MANAGEMENT_CALENDAR_TABLE, DEFAULT_CALENDAR_FOR_TASK_PLAN } from '../../../../catalog/management/calendar/managementCalendarModel';
import type { DefRow } from '../../../../catalog/product/productModel';
import type { TaskLineRow } from '../finances/taskLineModel';
import { runTaskPost, taskDaysOf } from './runTaskPost';
import { taskPostState, TaskPostState } from './taskLinePlanModel';
import { pmT } from '../../../i18n/pmT';

export { taskDaysOf };

export interface UseTaskPostArgs {
  projectGUID: string;
  taskGUID: string;
  /** the lines of the task (all genus) */
  lines: TaskLineRow[];
  /** distributionGenericTable rows */
  distributions: DefRow<any>[];
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
    const say = (message: string) => dispatch(showSnackbar({ message }));
    const result = await runTaskPost({ taskGUID, ...live.current });
    if (result.status === 'error') {
      say(`${pmT('The task could not be posted')}: ${result.message}`);
    } else if (result.status === 'nothing') {
      if (result.noBudget) showErrorModal(pmT('No line of this task has a budget item. Choose a budget item on at least one line, then press Post.'), pmT('Nothing to post'));
      else say(result.problems.length ? result.problems[0] + (result.problems.length > 1 ? ` (+${result.problems.length - 1})` : '') : pmT('Nothing to post: choose a budget item on the lines'));
    } else {
      const note = result.problems.length ? ` · ${pmT('{{count}} line(s) not posted: {{first}}', { count: result.problems.length, first: result.problems[0] })}` : '';
      say(`${pmT('Posted {{lines}} line(s) · {{rows}} day row(s)', { lines: result.lines, rows: result.rows })}${note}`);
    }
  }, [dispatch, taskGUID]);

  return { state, post };
}
