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
import type { LevelingConflict, LevelingMove, LevelingResult, LevelingTaskInput, MoveReason, UnresolvedCode } from './resourceLevelingModel';

export { resourcesOfLines };
export type { InputRow };

export interface PlanLevelingArgs {
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
  projectJSON: Record<string, any> | undefined | null;
  projectStartMs: number;
  externalDates?: Record<string, { startMs: number; finishMs: number }>;
  linesByTask: Record<string, TaskLineRow[]>;
  capacityRows: InputRow[];
  foreignRows: InputRow[];
  /** UTC midnight of today */
  todayMs: number;
  /** tasks with a posted fact input (never moved) */
  factTasks?: ReadonlySet<string>;
  /** only these tasks may move (a run for selected tasks); undefined = all */
  scope?: ReadonlySet<string>;
  /** may a POSTED task be a candidate? false = it is frozen. Default: resourceLevelingPostedTasksMovementEnabled (the user is asked before anything is applied) */
  postedMayMove?: boolean;
}

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
}

const delayOf = (t: PMTaskRow): number => Math.max(0, Math.round(Number((t.rowJSON as PMTaskJSON)?.taskLevelingDelayDays) || 0));
const nameOf = (t: PMTaskRow | undefined): string => String((t?.rowJSON as PMTaskJSON | undefined)?.taskDescription ?? t?.rowGUID ?? '');

export function planLevelingRun(a: PlanLevelingArgs): LevelingPlan {
  const effective = resourceLevelingOf(a.projectJSON);
  const ext = extendedOf(a.projectJSON as any);
  const direction = directionOf(a.projectJSON);
  const options = scheduleOptionsOf(a.projectJSON);
  void options;
  const env = buildLevelingEnv({ tasks: a.tasks, deps: a.deps, projectJSON: a.projectJSON, projectStartMs: a.projectStartMs, externalDates: a.externalDates, capacityRows: a.capacityRows, foreignRows: a.foreignRows });
  const byGuid = new Map(a.tasks.map((t) => [t.rowGUID, t]));

  const currentDelays: Record<string, number> = {};
  for (const t of a.tasks) { const d = delayOf(t); if (d > 0) currentDelays[t.rowGUID] = d; }
  const current = env.schedule(currentDelays);

  const postedMayMove = a.postedMayMove ?? effective.postedTasksMovement;
  const inputs: LevelingTaskInput[] = buildLevelingTasks({
    tasks: a.tasks, linesByTask: a.linesByTask, rows: current.rows, todayMs: a.todayMs,
    manualTasksAllowed: effective.manualTasks, priorityEnabled: ext.ganttTaskPriorityEnabled === true, manualEnabled: ext.ganttManualSchedulingEnabled === true,
    constraintsEnabled: ext.ganttConstraintsEnabled === true, postedMayMove, factTasks: a.factTasks, scope: a.scope,
  });

  const result = levelResources(inputs, env, {
    order: effective.order, method: effective.method, direction, period: effective.grainUnit === 'week' ? 'week' : 'day',
    startDelays: effective.clearBefore ? {} : currentDelays,
  });

  // the conflicts of the plan as the user sees it now
  const ctx = makeCtx(env, effective.grainUnit === 'week' ? 'week' : 'day');
  const conflictsBefore = conflictsOf(ctx, buildUsage(ctx, inputs, current.rows)).length;

  const moveByTask = new Map(result.moves.map((m: LevelingMove) => [m.task, m]));
  const postedByGuid = new Map(inputs.map((t) => [t.guid, t.posted]));
  const changes: PlannedMove[] = [];
  const guids = new Set([...Object.keys(currentDelays), ...Object.keys(result.delays)]);
  for (const g of guids) {
    const before = currentDelays[g] || 0;
    const after = result.delays[g] || 0;
    if (before === after) continue;
    const t = byGuid.get(g);
    const rb: PMScheduledRow | undefined = current.rows[g];
    const ra: PMScheduledRow | undefined = result.schedule.rows[g];
    if (!t || !rb || !ra) continue;
    const m = moveByTask.get(g);
    changes.push({
      task: g, name: nameOf(t), posted: postedByGuid.get(g) === true, delayBefore: before, delayAfter: after,
      startBeforeMs: rb.startMs, startAfterMs: ra.startMs, finishBeforeMs: rb.finishMs, finishAfterMs: ra.finishMs,
      reason: m?.reason ?? null, resource: m?.resource ?? null, bucket: m?.bucket ?? null,
    });
  }
  changes.sort((x, y) => x.startAfterMs - y.startAfterMs || x.name.localeCompare(y.name));
  const unresolved: PlannedUnresolved[] = result.unresolved.map((c) => ({ ...c, code: (c.code ?? 'noCapacityInHorizon') as UnresolvedCode, taskNames: c.tasks.map((g) => nameOf(byGuid.get(g))) }));

  return {
    effective, direction, result,
    current: { projectStartMs: current.projectStartMs, projectFinishMs: current.projectFinishMs },
    after: { projectStartMs: result.schedule.projectStartMs, projectFinishMs: result.schedule.projectFinishMs },
    changes, postedChanges: changes.filter((c) => c.posted), unresolved,
    conflictsBefore, conflictsAfter: result.unresolved.length, stopped: result.unresolved.some((c) => c.code === 'passLimit'),
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
