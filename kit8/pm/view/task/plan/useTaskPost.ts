// useTaskPost - Post of ONE task (the Post button of the task line table): calculate the plan of its lines (calculateTaskLinePlan), send it to the
// SQL procedure create_task_line_plan (one transaction) and tell the user what happened (runTaskPost does the work). The state of the button comes
// from the lines (taskPostState), which realtime keeps current: the procedure sets taskIsPosted on the lines it posted.
// A task with NO budget item on any line cannot be posted: that is the user's to fix, so it gets a modal window, not a snack bar.
import { useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { useCostRefreshDebounce } from '../../../cost/useCostRefreshDebounce';
import { showErrorModal } from '../../../../ui/components/common/ErrorModalWindow';
import { usePMStore } from '../../../store/store_pm';
import { MANAGEMENT_CALENDAR_TABLE, DEFAULT_CALENDAR_FOR_TASK_PLAN } from '../../../../catalog/management/calendar/managementCalendarModel';
import type { DefRow } from '../../../../catalog/product/productModel';
import type { TaskLineRow } from '../finances/taskLineModel';
import { runTaskPost, taskDaysOf } from './runTaskPost';
import { useBusinessUnitPostCheck } from './useBusinessUnitPostCheck';
import { taskPostState, TaskPostState } from './taskLinePlanModel';
import { pmT } from '../../../i18n/pmT';
import { busyLineGUIDs, busySentence } from './busyControl';
import { showBusyConflicts } from './BusyConflictsWindow';

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
  const requestCostRefresh = useCostRefreshDebounce();
  const projectJSON = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON);
  const calendarForTaskPlan = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON?.calendarForTaskPlan) || DEFAULT_CALENDAR_FOR_TASK_PLAN;
  const startMs = usePMStore((s) => s.schedule[taskGUID]?.startMs);
  const finishMs = usePMStore((s) => s.schedule[taskGUID]?.finishMs);
  const calendars: DefRow<any>[] = useSelector((s: any) => s?.[MANAGEMENT_CALENDAR_TABLE.entity]?.entityDataFromServer) ?? [];
  const state: TaskPostState = useMemo(() => taskPostState(lines), [lines]);
  const lineCheck = useBusinessUnitPostCheck();
  const live = useRef({ lines, distributions, calendars, calendarForTaskPlan, startMs, finishMs, lineCheck });
  live.current = { lines, distributions, calendars, calendarForTaskPlan, startMs, finishMs, lineCheck };

  const post = useCallback(async (): Promise<void> => {
    const say = (message: string, isError = false) => dispatch(showSnackbar({ message, isError }));
    const result = await runTaskPost({ taskGUID, ...live.current });
    if (result.status === 'error') {
      say(`${pmT('The task could not be posted')}: ${result.message}`, true);
    } else if (result.status === 'nothing') {
      if (result.noBudget) showErrorModal(pmT('No line of this task has a budget item. Choose a budget item on at least one line, then press Post.'), pmT('Nothing to post'));
      else say(result.problems.length ? result.problems[0] + (result.problems.length > 1 ? ` (+${result.problems.length - 1})` : '') : pmT('Nothing to post: choose a budget item on the lines'), true);
    } else {
      const note = result.problems.length ? ` · ${pmT('{{count}} line(s) not posted: {{first}}', { count: result.problems.length, first: result.problems[0] })}` : '';
      const failed = result.problems.length > 0 || (result.busy.length > 0 && result.mode === 'capacityModeBlock');
      // the capacity check (capacityModeWarn / capacityModeBlock): the first conflict in the message, the list - with the Share buttons - in a window
      const busyNote = result.busy.length
        ? ` · ${result.mode === 'capacityModeBlock'
            ? pmT('{{count}} line(s) not posted, the resource is busy: {{first}}', { count: busyLineGUIDs(result.busy).length, first: busySentence(result.busy[0]) })
            : pmT('Warning: {{first}}', { first: busySentence(result.busy[0]) })}`
        : '';
      say(`${pmT('Posted {{lines}} line(s) · {{rows}} day row(s)', { lines: result.lines, rows: result.rows })}${note}${busyNote}`, failed);
      if (result.busy.length) showBusyConflicts(result.busy, result.mode);
      // the cost totals (kit8/pm/cost): a signal to the debounced scheduler - ONE call after the last Post, only while a cost budget is on
      requestCostRefresh(projectGUID, projectJSON);
    }
  }, [dispatch, taskGUID, projectGUID, requestCostRefresh, projectJSON]);

  return { state, post };
}
