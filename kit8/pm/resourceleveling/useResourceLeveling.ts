// useResourceLeveling - the commands of Resource optimization for the open project (documentation/RESOURCE_LEVELING_WBS.html 7.5 Manual, 7.7 posted tasks):
//   levelNow()    read the plan, the Time lines, the capacity and the foreign load, run the engine, open the preview
//   apply(choice) write the delays (project_resource_leveling_apply); a posted task that must move is asked about first; the schedule write-back then writes the dates
//   clear()       remove the delays (asks when posted tasks would lose their posting)
//   undoLast()    give back the delays of the last run
// The engine and the plan are pure (resourceLevelingRun.ts); this file only gathers the data and talks to the database.
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useSupabase } from '../../providers/WithSupabase';
import { refreshProjectData, showSnackbar } from '../../redux/uxuiSlice';
import { showErrorModal } from '../../ui/components/common/ErrorModalWindow';
import { DAY_MS } from '../model/constants';
import { approvePM } from '../inner/PMApproveYesNoCancelModalWindow';
import { pmT } from '../i18n/pmT';
import { ensureCalculated } from '../crud/project/ensureCalculated';
import { usePMStore } from '../store/store_pm';
import { useProjectTaskLines } from '../view/task/plan/useProjectTaskLines';
import { useProjectPostActions } from '../view/task/plan/useProjectPostActions';
import { taskPostState } from '../view/task/plan/taskLinePlanModel';
import { applyLevelingRun, clearLeveling, fetchFactTasks, fetchLevelingInputs, fetchLevelingRuns, fetchServerPlan, undoLevelingRun } from './resourceLevelingApi';
import { calculateLevelingPlan } from './resourceLevelingBackend';
import { applyPayloadOf, needsPostedDecision, resourcesOfLines, type PlanLevelingArgs, type PlannedMove, type PostedChoice } from './resourceLevelingRun';
import { resourceLevelingOf } from './resourceLevelingSettings';
import { useResourceLevelingUiStore } from './resourceLevelingUiStore';

const MAX_RANGE_DAYS = 1400;
/** "Move and post again" waits for the plan on the screen to have the new dates: this many looks, this many ms apart (the tests shorten it) */
export const POST_AGAIN_WAIT = { tries: 40, ms: 250 };
const todayUTC = () => Math.floor(Date.now() / DAY_MS) * DAY_MS;

export function useResourceLeveling(projectGUID: string | null | undefined) {
  const { supabase } = useSupabase();
  const dispatch = useDispatch();
  const { byTask } = useProjectTaskLines(projectGUID);
  const { postTask } = useProjectPostActions(projectGUID);
  const ui = useResourceLevelingUiStore;

  const say = useCallback((message: string, isError = false) => dispatch(showSnackbar({ message, isError })), [dispatch]);

  /** everything a run needs, read now (the plan is calculated first when Calculation is Manual and edits are pending) */
  const gather = useCallback(async (scope?: ReadonlySet<string>): Promise<{ args: PlanLevelingArgs; stamps: Record<string, string> } | null> => {
    if (!projectGUID) return null;
    ensureCalculated();
    const s = usePMStore.getState();
    const project = s.projectsById[projectGUID];
    if (!project) return null;
    const resources = resourcesOfLines(byTask);
    if (resources.length === 0) { say(pmT('No task has a Time line with a resource in hours: nothing to optimize')); return null; }
    const startIso = project.rowJSON?.projectStartAt;
    const parsed = startIso ? Date.parse(startIso) : NaN;
    const projectStartMs = Number.isFinite(parsed) ? parsed : project.created_at ? Date.parse(project.created_at) : todayUTC();
    // the range of the capacity: from the first task to a year after the last one (never longer than the function allows)
    let first = Infinity;
    let last = -Infinity;
    for (const r of Object.values(s.schedule)) { first = Math.min(first, r.startMs); last = Math.max(last, r.finishMs); }
    if (first === Infinity) { first = projectStartMs; last = projectStartMs; }
    const fromMs = Math.floor(Math.min(first, projectStartMs) / DAY_MS) * DAY_MS - 7 * DAY_MS;
    const toMs = Math.min(fromMs + MAX_RANGE_DAYS * DAY_MS, Math.floor(last / DAY_MS) * DAY_MS + 366 * DAY_MS);
    const [inputs, factTasks] = await Promise.all([
      fetchLevelingInputs(supabase, projectGUID, fromMs, toMs, resources),
      fetchFactTasks(supabase, projectGUID).catch(() => new Set<string>()),
    ]);
    const effective = resourceLevelingOf(project.rowJSON);
    const stamps: Record<string, string> = {};
    for (const t of s.tasks) if (t.updated_at) stamps[t.rowGUID] = t.updated_at;
    return {
      stamps,
      args: {
        tasks: s.tasks, deps: s.deps, projectJSON: project.rowJSON, projectStartMs, externalDates: s.externalDates, linesByTask: byTask as any,
        capacityRows: inputs.capacity, foreignRows: inputs.foreign, todayMs: todayUTC(), factTasks, scope,
        postedMayMove: effective.postedTasksMovement && effective.postedTasksAction !== 'keep',
      },
    };
  }, [projectGUID, byTask, supabase, say]);

  const levelNow = useCallback(async (scope?: ReadonlySet<string>): Promise<void> => {
    if (!projectGUID || ui.getState().busy) return;
    ui.getState().setBusy(true);
    try {
      const g = await gather(scope);
      if (!g) return;
      const { plan, outcome } = await calculateLevelingPlan(g.args, (problem) => fetchServerPlan(supabase, projectGUID, problem));
      if (plan.changes.length === 0 && plan.unresolved.length === 0 && plan.conflictsBefore === 0) {
        say(pmT('No resource is over-allocated'));
        return;
      }
      ui.getState().setPreview({ plan, args: g.args, mode: 'manual', stamps: g.stamps, outcome });
    } catch (e: any) {
      showErrorModal(e?.message || String(e), pmT('Resource optimization'));
    } finally {
      ui.getState().setBusy(false);
    }
  }, [projectGUID, gather, say, ui, supabase]);

  /** "Move and post again": wait until the plan on the screen has the new dates (the tasks are read again, then scheduled), then post each task with the normal Post */
  const postAgain = useCallback(async (moved: PlannedMove[]): Promise<void> => {
    for (let i = 0; i < POST_AGAIN_WAIT.tries; i++) {
      const sched = usePMStore.getState().schedule;
      if (moved.every((c) => sched[c.task]?.startMs === c.startAfterMs)) break;
      await new Promise((r) => setTimeout(r, POST_AGAIN_WAIT.ms));
    }
    for (const c of moved) await postTask(c.task);
  }, [postTask]);

  /** the answer to the question about the posted tasks, or the plain apply when no posted task has to move */
  const apply = useCallback(async (choice?: PostedChoice): Promise<void> => {
    const pv = ui.getState().preview;
    if (!projectGUID || !pv || ui.getState().busy) return;
    const plan = pv.plan;
    const action = plan.effective.postedTasksAction;
    // the remembered answer of the project settings
    const answer: PostedChoice | undefined = choice ?? (plan.postedChanges.length > 0 && action !== 'ask' && action !== 'keep' ? action : undefined);
    if (plan.postedChanges.length > 0 && !answer) {
      if (needsPostedDecision(plan)) ui.getState().setPostedDialog(true);
      return;
    }
    if (answer === 'keep') {
      // "Keep their dates": the same run with the posted tasks frozen; the user sees it and presses Apply again
      ui.getState().setBusy(true);
      try {
        const kept = await calculateLevelingPlan({ ...pv.args, postedMayMove: false }, (problem) => fetchServerPlan(supabase, projectGUID, problem));
        ui.getState().setPreview({ ...pv, plan: kept.plan, outcome: kept.outcome, postedChoice: 'keep' });
        say(pmT('The posted tasks keep their dates: this is the plan without them'));
      } catch (e: any) {
        showErrorModal(e?.message || String(e), pmT('Resource optimization'));
      } finally {
        ui.getState().setBusy(false);
      }
      return;
    }
    ui.getState().setBusy(true);
    try {
      const payload = applyPayloadOf(plan, { mode: pv.mode, postedChoice: answer, updatedAt: pv.stamps });
      await applyLevelingRun(supabase, projectGUID, payload);
      ui.getState().setPreview(null);
      dispatch(refreshProjectData());           // the tasks are read again; the scheduler then writes the new dates
      const posted = plan.postedChanges;
      const n = plan.changes.length;
      if (answer === 'moveAndPostAgain' && posted.length) {
        say(pmT('Optimized: {{n}} task(s) moved. Posting {{posted}} task(s) again ...', { n, posted: posted.length }));
        await postAgain(posted);
      } else if (posted.length && answer === 'unpostAndMove') {
        say(pmT('Optimized: {{n}} task(s) moved, {{posted}} task(s) are unposted: use Post unposted tasks', { n, posted: posted.length }));
      } else {
        say(pmT('Optimized: {{n}} task(s) moved', { n }));
      }
    } catch (e: any) {
      const stale = String(e?.message || '').includes('changed after the plan was read');
      showErrorModal(stale ? pmT('A task was changed after the plan was read. Level again.') : (e?.message || String(e)), pmT('Resource optimization'));
      ui.getState().setPreview(null);
    } finally {
      ui.getState().setBusy(false);
    }
  }, [projectGUID, supabase, dispatch, say, ui, postAgain]);

  const postedAmong = useCallback((guids: string[]): number => guids.filter((g) => taskPostState(byTask[g] || []) === 'posted').length, [byTask]);

  const clear = useCallback(async (): Promise<void> => {
    if (!projectGUID || ui.getState().busy) return;
    const s = usePMStore.getState();
    const project = s.projectsById[projectGUID];
    const withDelay = s.tasks.filter((t) => Number((t.rowJSON as any)?.taskLevelingDelayDays) > 0).map((t) => t.rowGUID);
    if (withDelay.length === 0) { say(pmT('No task has a leveling delay')); return; }
    const posted = postedAmong(withDelay);
    const ok = await approvePM({
      title: pmT('Clear leveling?'),
      message: posted > 0
        ? pmT('The leveling delay of {{n}} task(s) is removed; {{posted}} of them are posted and lose their posting because their dates move.', { n: withDelay.length, posted })
        : pmT('The leveling delay of {{n}} task(s) is removed.', { n: withDelay.length }),
      yesLabel: pmT('Clear leveling'),
      icon: 'layers_clear',
    });
    if (!ok) return;
    ui.getState().setBusy(true);
    try {
      await clearLeveling(supabase, projectGUID, null, 'manual', resourceLevelingOf(project?.rowJSON).keepHistory);
      dispatch(refreshProjectData());
      say(pmT('Leveling cleared'));
    } catch (e: any) {
      showErrorModal(e?.message || String(e), pmT('Resource optimization'));
    } finally {
      ui.getState().setBusy(false);
    }
  }, [projectGUID, supabase, dispatch, say, postedAmong, ui]);

  const undoRun = useCallback(async (runGUID: string): Promise<void> => {
    if (!projectGUID || ui.getState().busy) return;
    const ok = await approvePM({ title: pmT('Undo this run?'), message: pmT('The leveling delays go back to what they were before the run. Posted tasks whose dates move lose their posting.'), yesLabel: pmT('Undo run'), icon: 'undo' });
    if (!ok) return;
    ui.getState().setBusy(true);
    try {
      const a = await undoLevelingRun(supabase, runGUID);
      dispatch(refreshProjectData());
      say(a.skipped > 0 ? pmT('Undone: {{n}} task(s) restored, {{skipped}} changed since and left as they are', { n: a.restored, skipped: a.skipped }) : pmT('Undone: {{n}} task(s) restored', { n: a.restored }));
    } catch (e: any) {
      showErrorModal(e?.message || String(e), pmT('Resource optimization'));
    } finally {
      ui.getState().setBusy(false);
    }
  }, [projectGUID, supabase, dispatch, say, ui]);

  const undoLast = useCallback(async (): Promise<void> => {
    if (!projectGUID) return;
    try {
      const runs = await fetchLevelingRuns(supabase, projectGUID, 20);
      const last = runs.find((r) => r.runKind !== 'undo' && !r.undoneByGUID);
      if (!last) { say(pmT('There is no run to undo')); return; }
      await undoRun(last.rowGUID);
    } catch (e: any) {
      showErrorModal(e?.message || String(e), pmT('Resource optimization'));
    }
  }, [projectGUID, supabase, say, undoRun]);

  return { levelNow, apply, clear, undoLast, undoRun };
}
