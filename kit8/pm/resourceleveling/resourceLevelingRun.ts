// resourceLevelingRun - ONE run of Resource optimization as a pure function: from the project (tasks, links, lines, the inputs of the database) to the plan the user previews and applies
// (documentation/RESOURCE_LEVELING_WBS.html sections 7.3, 7.5, 7.7). No React / Supabase: the hook (useResourceLeveling.ts) fetches the data and calls this.
import type { PMScheduledRow, PMTaskDependencyRow, PMTaskJSON, PMTaskRow } from '../model/types';
import { extendedOf } from '../extended/extendedModel';
import { scheduleOptionsOf } from '../model/scheduleOptions';
import type { TaskLineRow } from '../view/task/finances/taskLineModel';
import { conflictsOf, buildUsage, makeCtx } from './resourceLevelingDetect';
import { buildLevelingTasks } from './resourceLevelingDemand';
import { buildLevelingEnv, directionOf, resourcesOfLines, type InputRow } from './resourceLevelingEnv';
import { levelResources } from './resourceLevelingEngine';
import { resourceLevelingOf, type ResourceLevelingEffective } from './resourceLevelingSettings';
import { buildHourLevelingEnv } from '../hourmodel/hourLevelingEnv';
import type { HourCapacityRow, HourForeignRow } from '../hourmodel/hourLevelingEnv';
import type { HourAxis } from '../hourmodel/hourAxis';
import type { LevelingConflict, LevelingEnv, LevelingMove, LevelingResult, LevelingSchedule, LevelingTaskInput, MoveReason, UnresolvedCode } from './resourceLevelingModel';

export { resourcesOfLines };
export type { InputRow };

/** the time-of-day model of a run (kit8/pm/hourmodel): the working-minute axis, the step, and the capacity / foreign rows of project_resource_leveling_inputs_hours */
export interface HourRunArgs {
  axis: HourAxis;
  /** resourceSlotMinutes */
  step: number;
  capacityRows: HourCapacityRow[];
  foreignRows: HourForeignRow[];
}

export interface PlanLevelingArgs {
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
  projectJSON: Record<string, any> | undefined | null;
  projectStartMs: number;
  externalDates?: Record<string, { startMs: number; finishMs: number }>;
  linesByTask: Record<string, TaskLineRow[]>;
  capacityRows: InputRow[];
  foreignRows: InputRow[];
  /** the project plans by the clock: the run works in steps of minutes (capacityRows / foreignRows are then empty, the hour rows are in `hour`) */
  hour?: HourRunArgs;
  /** UTC midnight of today */
  todayMs: number;
  /** tasks with a posted fact input (never moved) */
  factTasks?: ReadonlySet<string>;
  /** only these tasks may move (a run for selected tasks); undefined = all */
  scope?: ReadonlySet<string>;
  /** may a POSTED task be a candidate? false = it is frozen. Default: resourceLevelingPostedTasksMovementEnabled (the user is asked before anything is applied) */
  postedMayMove?: boolean;
  /**
   * Server side computations: the proposal of the database (project_resource_leveling_server_plan). The run CONTINUES from the proposal with the scheduler of the screen: a proposal that
   * is right stays as it is, a conflict the database left (or could not see) is solved here. The moves of the proposal give the reasons.
   */
  seed?: { delays: Record<string, number>; moves?: ServerMove[]; unresolved?: ServerUnresolved[] };
}

/** a conflict the database could not solve, and why */
export interface ServerUnresolved { resource: string; bucket: string; code: UnresolvedCode }

/** a move of the database proposal (the answer of project_resource_leveling_server_plan) */
export interface ServerMove { task: string; delayBefore: number; delayAfter: number; reason: MoveReason; resource: string; bucket: string }

export interface PlannedMove {
  task: string;
  name: string;
  posted: boolean;
  delayBefore: number;
  delayAfter: number;
  startBeforeMs: number;
  startAfterMs: number;
  finishBeforeMs: number;
  finishAfterMs: number;
  reason: MoveReason | null;
  resource: string | null;
  bucket: number | null;
}

export interface PlannedUnresolved extends LevelingConflict {
  code: UnresolvedCode;
  taskNames: string[];
}

export interface LevelingPlan {
  effective: ResourceLevelingEffective;
  direction: 'forward' | 'backward';
  result: LevelingResult;
  /** the plan as it is NOW (with the stored delays) and the plan after the run */
  current: { projectStartMs: number; projectFinishMs: number };
  after: { projectStartMs: number; projectFinishMs: number };
  /** every task whose delay changes (moved by the run, or cleared because the run starts from a clean plan) */
  changes: PlannedMove[];
  /** the posted tasks among `changes`: moving them unposts them, so the user is asked first */
  postedChanges: PlannedMove[];
  unresolved: PlannedUnresolved[];
  conflictsBefore: number;
  conflictsAfter: number;
  /** the engine was stopped by its safety counter */
  stopped: boolean;
  /** unit of delayBefore / delayAfter of the changes: working days (day model) or working minutes (time-of-day model) */
  delayUnit: 'days' | 'minutes';
  /** the step of the time-of-day model (minutes), else 0 */
  stepMinutes: number;
}

const delayOf = (t: PMTaskRow, step = 0): number => (step > 0
  ? Math.max(0, Math.round((Number((t.rowJSON as PMTaskJSON)?.taskLevelingDelayMinutes) || 0) / step))
  : Math.max(0, Math.round(Number((t.rowJSON as PMTaskJSON)?.taskLevelingDelayDays) || 0)));
const nameOf = (t: PMTaskRow | undefined): string => String((t?.rowJSON as PMTaskJSON | undefined)?.taskDescription ?? t?.rowGUID ?? '');

/** everything a run needs before the search: the effective settings, the scheduler of the screen, the plan as it is now and the engine input (shared by the client side run and the server problem) */
export interface PreparedRun {
  effective: ResourceLevelingEffective;
  direction: 'forward' | 'backward';
  env: LevelingEnv;
  byGuid: Map<string, PMTaskRow>;
  /** the leveling delays stored on the tasks now */
  currentDelays: Record<string, number>;
  /** the delays the run starts from: none (clear before) or the stored ones */
  origin: Record<string, number>;
  current: LevelingSchedule;
  inputs: LevelingTaskInput[];
}

export function prepareLevelingRun(a: PlanLevelingArgs): PreparedRun {
  const effective = resourceLevelingOf(a.projectJSON);
  const ext = extendedOf(a.projectJSON as any);
  // the time-of-day model plans from the start only (documentation 4.4)
  const direction = a.hour ? 'forward' : directionOf(a.projectJSON);
  const step = a.hour ? a.hour.step : 0;
  const env = a.hour
    ? buildHourLevelingEnv({
        tasks: a.tasks, deps: a.deps, options: scheduleOptionsOf(a.projectJSON), projectStartMs: a.projectStartMs, axis: a.hour.axis, step: a.hour.step,
        capacityRows: a.hour.capacityRows, foreignRows: a.hour.foreignRows,
      })
    : buildLevelingEnv({ tasks: a.tasks, deps: a.deps, projectJSON: a.projectJSON, projectStartMs: a.projectStartMs, externalDates: a.externalDates, capacityRows: a.capacityRows, foreignRows: a.foreignRows });
  const byGuid = new Map(a.tasks.map((t) => [t.rowGUID, t]));

  const currentDelays: Record<string, number> = {};
  for (const t of a.tasks) { const d = delayOf(t, step); if (d > 0) currentDelays[t.rowGUID] = d; }
  const current = env.schedule(currentDelays);

  const postedMayMove = a.postedMayMove ?? effective.postedTasksMovement;
  const inputs: LevelingTaskInput[] = buildLevelingTasks({
    tasks: a.tasks, linesByTask: a.linesByTask, rows: (env.present ? env.present(current) : current).rows, todayMs: a.todayMs,
    manualTasksAllowed: effective.manualTasks, priorityEnabled: ext.ganttTaskPriorityEnabled === true, manualEnabled: ext.ganttManualSchedulingEnabled === true,
    constraintsEnabled: ext.ganttConstraintsEnabled === true, postedMayMove, factTasks: a.factTasks, scope: a.scope,
  });
  return { effective, direction, env, byGuid, currentDelays, origin: effective.clearBefore ? {} : currentDelays, current, inputs };
}

/** the run on THIS device (Client side computations); with `a.seed` it continues the proposal of the database (Server side computations) */
export function planLevelingRun(a: PlanLevelingArgs, prepared: PreparedRun = prepareLevelingRun(a)): LevelingPlan {
  const { effective, direction, env, byGuid, currentDelays, origin, current, inputs } = prepared;
  const stepMinutes = env.delayUnitMinutes ?? 0;
  const show = (s: LevelingSchedule): LevelingSchedule => (env.present ? env.present(s) : s);
  const bucketMsOf = (b: string): number => (env.serverBucketMs ? env.serverBucketMs(b) : Date.parse(String(b).slice(0, 10) + 'T00:00:00Z'));
  const realBucket = (b: number): number => (env.bucketToReal ? env.bucketToReal(b) : b);
  const toUnit = (n: number): number => (stepMinutes > 0 ? n * stepMinutes : n);
  const result = levelResources(inputs, env, {
    order: effective.order, method: effective.method, direction, period: !a.hour && effective.grainUnit === 'week' ? 'week' : 'day',
    startDelays: a.seed ? { ...a.seed.delays } : origin, baselineDelays: a.seed ? origin : undefined,
    failureHints: a.seed?.unresolved ? Object.fromEntries(a.seed.unresolved.map((u) => [`${u.resource}|${bucketMsOf(u.bucket)}`, u.code])) : undefined,
  });
  // what the user sees: the real instants (the engine works on the virtual axis of the time-of-day model)
  const currentShown = show(current);
  const afterShown = show(result.schedule);

  // the conflicts of the plan as the user sees it now
  const ctx = makeCtx(env, !a.hour && effective.grainUnit === 'week' ? 'week' : 'day');
  const conflictsBefore = conflictsOf(ctx, buildUsage(ctx, inputs, current.rows)).length;

  const moveByTask = new Map<string, LevelingMove>(result.moves.map((m: LevelingMove) => [m.task, m]));
  // a move of the database proposal that the screen kept: the reason of the database
  for (const m of a.seed?.moves || []) {
    if (!moveByTask.has(m.task)) moveByTask.set(m.task, { task: m.task, delayBefore: m.delayBefore, delayAfter: m.delayAfter, reason: m.reason, resource: m.resource, bucket: bucketMsOf(m.bucket) });
  }
  const postedByGuid = new Map(inputs.map((t) => [t.guid, t.posted]));
  const changes: PlannedMove[] = [];
  const guids = new Set([...Object.keys(currentDelays), ...Object.keys(result.delays)]);
  for (const g of guids) {
    const before = currentDelays[g] || 0;
    const after = result.delays[g] || 0;
    if (before === after) continue;
    const t = byGuid.get(g);
    const rb: PMScheduledRow | undefined = currentShown.rows[g];
    const ra: PMScheduledRow | undefined = afterShown.rows[g];
    if (!t || !rb || !ra) continue;
    const m = moveByTask.get(g);
    changes.push({
      task: g, name: nameOf(t), posted: postedByGuid.get(g) === true, delayBefore: toUnit(before), delayAfter: toUnit(after),
      startBeforeMs: rb.startMs, startAfterMs: ra.startMs, finishBeforeMs: rb.finishMs, finishAfterMs: ra.finishMs,
      reason: m?.reason ?? null, resource: m?.resource ?? null, bucket: m ? realBucket(m.bucket) : null,
    });
  }
  changes.sort((x, y) => x.startAfterMs - y.startAfterMs || x.name.localeCompare(y.name));
  const unresolved: PlannedUnresolved[] = result.unresolved.map((c) => ({
    ...c, bucket: realBucket(c.bucket), code: (c.code ?? 'noCapacityInHorizon') as UnresolvedCode, taskNames: c.tasks.map((g) => nameOf(byGuid.get(g))),
  }));

  return {
    effective, direction, result,
    current: { projectStartMs: currentShown.projectStartMs, projectFinishMs: currentShown.projectFinishMs },
    after: { projectStartMs: afterShown.projectStartMs, projectFinishMs: afterShown.projectFinishMs },
    changes, postedChanges: changes.filter((c) => c.posted), unresolved,
    conflictsBefore, conflictsAfter: result.unresolved.length, stopped: result.unresolved.some((c) => c.code === 'passLimit'),
    delayUnit: stepMinutes > 0 ? 'minutes' : 'days', stepMinutes,
  };
}

/** the same run with the posted tasks frozen: the answer "Keep their dates" of the dialog (documentation 7.7) */
export const planWithoutPosted = (a: PlanLevelingArgs): LevelingPlan => planLevelingRun({ ...a, postedMayMove: false });

export type PostedChoice = 'unpostAndMove' | 'moveAndPostAgain' | 'keep';

/** the jsonb of project_resource_leveling_apply for a plan */
export function applyPayloadOf(plan: LevelingPlan, meta: { mode: 'manual' | 'automatic' | 'fast'; scope?: Record<string, unknown>; updatedAt?: Record<string, string>; postedChoice?: PostedChoice }): Record<string, unknown> {
  const iso = (ms: number) => new Date(ms).toISOString();
  const unposted = meta.postedChoice === 'unpostAndMove' ? plan.postedChanges.length : 0;
  return {
    kind: 'level', mode: meta.mode, method: plan.effective.method, keepHistory: plan.effective.keepHistory,
    scope: meta.scope ?? { scope: 'project' },
    options: {
      order: plan.effective.order, grainUnit: plan.effective.grainUnit, clearBefore: plan.effective.clearBefore, includeOtherProjects: plan.effective.includeOtherProjects,
      postedTasksAction: meta.postedChoice ?? plan.effective.postedTasksAction, direction: plan.direction,
      // the time-of-day model: the delays of the tasks are working MINUTES (a whole multiple of the step), written to taskLevelingDelayMinutes
      ...(plan.delayUnit === 'minutes' ? { delayUnit: 'minutes', stepMinutes: plan.stepMinutes } : {}),
    },
    conflictsBefore: plan.conflictsBefore, conflictsAfter: plan.conflictsAfter, unresolved: plan.unresolved.length, tasksUnposted: unposted,
    startBefore: iso(plan.current.projectStartMs), startAfter: iso(plan.after.projectStartMs), finishBefore: iso(plan.current.projectFinishMs), finishAfter: iso(plan.after.projectFinishMs),
    tasks: plan.changes.map((c) => ({
      task: c.task, delayBefore: c.delayBefore, delayAfter: c.delayAfter,
      startBefore: iso(c.startBeforeMs), startAfter: iso(c.startAfterMs), finishBefore: iso(c.finishBeforeMs), finishAfter: iso(c.finishAfterMs),
      wasPosted: c.posted, reason: c.reason, resourceKind: c.resource ? c.resource.slice(0, c.resource.indexOf(':')) : null,
      resourceGUID: c.resource ? c.resource.slice(c.resource.indexOf(':') + 1) : null, conflictDay: c.bucket !== null ? new Date(c.bucket).toISOString().slice(0, 10) : null,
      ...(meta.updatedAt?.[c.task] ? { updatedAt: meta.updatedAt[c.task] } : {}),
    })),
  };
}

/** what a run does to the user's posted tasks, in the words of the dialog (7.7) */
export const needsPostedDecision = (plan: LevelingPlan): boolean => plan.postedChanges.length > 0 && plan.effective.postedTasksAction === 'ask';
