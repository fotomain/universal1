// useProjectPostActions - the "Actions" of the project bar that post MANY tasks at once (the Post button of one task is useTaskPost):
//   postUnposted()  Post every task that is not posted now (never posted, or changed after posting)
//   repostAll()     Post EVERY task that has a line with a budget item again (the posted days are replaced)
// Each task goes through runTaskPost, one after the other (one SQL transaction per task, like the button of the task), and the user gets ONE
// message: how many tasks and day rows were posted and which ones were not (a task without dates, a line the calendar cannot place ...).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { PRODUCT_READ_PARAMS } from '../../../../catalog/product/dashboard/useProductCatalogData';
import { DISTRIBUTION_TABLE } from '../../../../catalog/distribution/distributionModel';
import { MANAGEMENT_CALENDAR_TABLE } from '../../../../catalog/management/calendar/managementCalendarModel';
import type { DefRow } from '../../../../catalog/product/productModel';
import { approvePM } from '../../../inner/PMApproveYesNoCancelModalWindow';
import { usePMStore } from '../../../store/store_pm';
import { pmT } from '../../../i18n/pmT';
import { runTaskPost } from './runTaskPost';
import { useBusinessUnitPostCheck } from './useBusinessUnitPostCheck';
import { projectTaskLinesKey, tasksToPost, useProjectTaskLines } from './useProjectTaskLines';

export type ProjectPostWhich = 'unposted' | 'all';

export function useProjectPostActions(projectGUID: string | null | undefined) {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const { byTask } = useProjectTaskLines(projectGUID);
  const distributions: DefRow<any>[] = useSelector((s: any) => s?.[DISTRIBUTION_TABLE.entity]?.entityDataFromServer) ?? [];
  const calendars: DefRow<any>[] = useSelector((s: any) => s?.[MANAGEMENT_CALENDAR_TABLE.entity]?.entityDataFromServer) ?? [];
  const [busy, setBusy] = useState(false);
  const lineCheck = useBusinessUnitPostCheck();
  const live = useRef({ byTask, distributions, calendars, busy, lineCheck });
  live.current = { byTask, distributions, calendars, busy, lineCheck };

  // the shapes of the distributions are what the plan is calculated with: read them once the project is open
  useEffect(() => {
    if (!projectGUID) return;
    const actions = SystemMetaData[DISTRIBUTION_TABLE.entity]?.actions;
    if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
  }, [projectGUID, dispatch]);

  const run = useCallback(async (which: ProjectPostWhich): Promise<void> => {
    const say = (message: string) => dispatch(showSnackbar({ message }));
    const L = live.current;
    if (!projectGUID || L.busy) return;
    const ids = tasksToPost(L.byTask, which);
    if (ids.length === 0) {
      say(which === 'all' ? pmT('Nothing to post: no task has a line with a budget item') : pmT('Every task is posted already'));
      return;
    }
    if (L.distributions.length === 0) {
      say(pmT('The distributions are still being read: try again in a moment'));
      return;
    }
    if (which === 'all') {
      const ok = await approvePM({
        title: pmT('Repost all tasks?'),
        message: pmT('The posted days of {{count}} task(s) will be calculated again and replaced.', { count: ids.length }),
        yesLabel: pmT('Repost'),
        icon: 'cloud_upload',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const state = usePMStore.getState();
      const calendarForTaskPlan = state.projectsById[projectGUID]?.rowJSON?.calendarForTaskPlan;
      let posted = 0, rows = 0;
      const failed: string[] = [];
      for (const taskGUID of ids) {
        const task = state.tasksById[taskGUID];
        const sched = usePMStore.getState().schedule[taskGUID];
        const name = task?.rowJSON?.name || taskGUID;
        const result = await runTaskPost({
          taskGUID, lines: L.byTask[taskGUID] || [], distributions: L.distributions, calendars: L.calendars, calendarForTaskPlan,
          startMs: sched?.startMs, finishMs: sched?.finishMs, lineCheck: L.lineCheck,
        });
        if (result.status === 'posted') {
          posted += 1; rows += result.rows;
          if (result.problems.length) failed.push(`${name}: ${result.problems[0]}`);
        } else if (result.status === 'error') failed.push(`${name}: ${result.message}`);
        else failed.push(`${name}: ${result.problems[0] || pmT('Nothing to post')}`);
      }
      qc.invalidateQueries({ queryKey: projectTaskLinesKey(projectGUID) });
      const note = failed.length ? ` · ${pmT('{{count}} not posted: {{first}}', { count: failed.length, first: failed[0] })}` : '';
      say(`${pmT('Posted {{tasks}} task(s) · {{rows}} day row(s)', { tasks: posted, rows })}${note}`);
    } finally {
      setBusy(false);
    }
  }, [projectGUID, dispatch, qc]);

  const postUnposted = useCallback(() => run('unposted'), [run]);
  const repostAll = useCallback(() => run('all'), [run]);
  return { postUnposted, repostAll, busy };
}
