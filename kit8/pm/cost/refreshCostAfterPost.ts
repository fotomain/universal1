// After a successful Post / Repost the app asks the database for the cost totals once (update_project_cost_total): the number appears about 0.1 s after Post instead of at the next 2 s tick
// of the Monitor01 worker, and it also works when pg_cron is not enabled. A SAFETY NET, never a blocker: only while a cost budget is on, it does not wait for the caller (fire and forget),
// and an error is only logged - the worker, the Actions command "Update project cost" and Realtime still deliver the numbers.
import { updateProjectCostTotal } from './costTotalApi';
import { emitCostTotalsStale } from './costTotalModel';
import { projectCostBudgetOn } from '../model/taskInputScope';

/** returns a promise for the tests; the callers do not await it */
export async function refreshProjectCostAfterPost(client: any, projectGUID: string | null | undefined, projectJSON: Parameters<typeof projectCostBudgetOn>[0]): Promise<boolean> {
  if (!projectGUID || !client?.rpc || !projectCostBudgetOn(projectJSON)) return false;
  try {
    await updateProjectCostTotal(client, projectGUID);
    emitCostTotalsStale(projectGUID);
    return true;
  } catch (e: any) {
    console.warn(`update_project_cost_total after Post failed: ${e?.message || String(e)}`);
    return false;
  }
}
