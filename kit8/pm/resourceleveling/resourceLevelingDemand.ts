// resourceLevelingDemand - from the tasks and their Time lines to the input of the engine (documentation/RESOURCE_LEVELING_WBS.html sections 7.2, 7.3).
// Pure: no React / Supabase. The hours of a line are spread over the ACTIVE days of the task exactly as Post does (calculateTaskLinePlan: distributionShares over the active
// days between the first and the last day), so the demand that is levelled is the demand that Post would write - posted or not.
import { distributionShares, DISTRIBUTION } from '../../catalog/distribution/distributionModel';
import type { PMTaskRow, PMScheduledRow } from '../model/types';
import { constraintOf } from '../model/taskConstraint';
import { manualStartOf, taskModeOf } from '../model/taskScheduleMode';
import type { TaskLineRow } from '../view/task/finances/taskLineModel';
import { taskPostState } from '../view/task/plan/taskLinePlanModel';
import { DAY_MS } from '../model/constants';
import { FrozenCode, LevelingLine, LevelingTaskInput, priorityOf, resourceKeyOf, NEVER_LEVEL_PRIORITY } from './resourceLevelingModel';

/** the Time genus: rowParentGUID of its lines */
export const TIME_GENUS = 'timeGenus';
const HOUR_UNIT = 'unit_hour';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** the Time lines of a task that book a resource in HOURS (a quantity in days or pieces cannot be compared with the hours of a calendar) */
export function levelingLinesOf(lines: TaskLineRow[] | undefined | null): LevelingLine[] {
  const out: LevelingLine[] = [];
  for (const l of lines || []) {
    if (l.rowParentGUID !== TIME_GENUS) continue;
    const j: any = l.rowJSON || {};
    const guid = j.taskResourceItem;
    if (!guid) continue;
    if ((j.measureUnitTaskLine || HOUR_UNIT) !== HOUR_UNIT) continue;
    const hours = num(j.qtyTaskLine);
    if (!(hours > 0)) continue;
    out.push({ resource: resourceKeyOf(j.taskResourceKind, String(guid)), hours, shape: j.distributionForBudgetTaskLine || DISTRIBUTION.uniform });
  }
  return out;
}

const shapeCache = new Map<string, number[]>();
/** the shares of a distribution over n days (adding up to 1), cached; a manual or unknown shape falls back to uniform (Post refuses it, the load is still real) */
export function sharesOf(shape: string, n: number): number[] {
  const key = shape + '|' + n;
  let s = shapeCache.get(key);
  if (!s) {
    try { s = shape === DISTRIBUTION.manual ? undefined : distributionShares(shape, n); } catch { s = undefined; }
    if (!s) s = Array.from({ length: n }, () => 1 / n);
    const total = s.reduce((a, b) => a + b, 0) || 1;
    s = s.map((v) => v / total);
    if (shapeCache.size > 5000) shapeCache.clear();
    shapeCache.set(key, s);
  }
  return s;
}

/** the hours of the lines on the given active days: [{resource, dayMs, hours}] (days.length >= 1) */
export function entriesOf(lines: LevelingLine[], days: number[]): { resource: string; dayMs: number; hours: number }[] {
  const out: { resource: string; dayMs: number; hours: number }[] = [];
  if (days.length === 0) return out;
  for (const line of lines) {
    const w = sharesOf(line.shape, days.length);
    for (let i = 0; i < days.length; i++) {
      const h = line.hours * w[i];
      if (h > 0) out.push({ resource: line.resource, dayMs: days[i], hours: h });
    }
  }
  return out;
}

export interface BuildLevelingTasksArgs {
  tasks: PMTaskRow[];
  linesByTask: Record<string, TaskLineRow[]>;
  /** the plan of the project (rows by task GUID) - to know which task starts before today */
  rows: Record<string, PMScheduledRow>;
  /** UTC midnight of today */
  todayMs: number;
  /** effective settings */
  manualTasksAllowed: boolean;
  /** Extended A15 on: the priority of a task is its taskPriority; off: every task has 500 */
  priorityEnabled: boolean;
  /** Extended A1 on: manual tasks exist */
  manualEnabled: boolean;
  /** Extended A3 on: the constraint types exist (Must Start / Finish On) */
  constraintsEnabled: boolean;
  /** false = a posted task is frozen (resourceLevelingPostedTasksMovementEnabled off / the user chose "keep") */
  postedMayMove: boolean;
  /** task GUIDs with a posted fact input or a posted payment fact (never moved) */
  factTasks?: ReadonlySet<string>;
  /** only these tasks may move (a run for selected tasks / resources); undefined = all */
  scope?: ReadonlySet<string>;
}

/** the engine input: every LEAF task that has at least one Time line booking a resource in hours */
export function buildLevelingTasks(args: BuildLevelingTasksArgs): LevelingTaskInput[] {
  const out: LevelingTaskInput[] = [];
  const stages = new Set<string>();
  for (const t of args.tasks) {
    const parent = t.treePath.lastIndexOf('.') === -1 ? null : t.treePath.slice(0, t.treePath.lastIndexOf('.'));
    if (parent) stages.add(parent);
  }
  args.tasks.forEach((t, index) => {
    const json: any = t.rowJSON || {};
    if (json.rowKind === 'stage' || json.rowKind === 'milestone' || json.taskInactive === true) return;
    if (stages.has(t.treePath)) return; // a summary row (it has children)
    const lines = levelingLinesOf(args.linesByTask[t.rowGUID]);
    if (lines.length === 0) return;
    const taskLines = args.linesByTask[t.rowGUID] || [];
    const posted = taskPostState(taskLines) === 'posted';
    const row = args.rows[t.rowGUID];
    const priority = args.priorityEnabled ? priorityOf(json.taskPriority) : priorityOf(null);
    const con = constraintOf(json, args.constraintsEnabled && json.taskIsSubproject !== true);
    const manual = args.manualEnabled && taskModeOf(json, true) === 'manual' && manualStartOf(json) !== null;
    let frozen: FrozenCode | null = null;
    if (json.taskIsSubproject === true) frozen = 'constraintHonored';
    else if (priority >= NEVER_LEVEL_PRIORITY) frozen = 'priority1000';
    else if (args.factTasks?.has(t.rowGUID)) frozen = 'frozenFact';
    else if (num(t.rowProgress) > 0 || (row && row.startMs < args.todayMs)) frozen = 'frozenStarted';
    else if (con.type === 'MSO' || con.type === 'MFO') frozen = 'constraintHonored';
    else if (manual && !args.manualTasksAllowed) frozen = 'manualTask';
    else if (posted && !args.postedMayMove) frozen = 'frozenPosted';
    else if (args.scope && !args.scope.has(t.rowGUID)) frozen = 'outOfScope';
    out.push({ guid: t.rowGUID, lines, priority, order: index, frozen, posted });
  });
  return out;
}

/** UTC midnight of the Monday of the week of `dayMs` (the bucket of the week grain) */
export const mondayOf = (dayMs: number): number => {
  const d = Math.floor(dayMs / DAY_MS) * DAY_MS;
  const dow = new Date(d).getUTCDay(); // 0 = Sunday
  return d - ((dow + 6) % 7) * DAY_MS;
};
