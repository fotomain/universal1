// hourServerProblem - the plan of the time-of-day model as the PROBLEM of the database (Server side computations; documentation/RESOURCE_LEVELING_HOURS_WBS.html section 4.6; SQL PART 53 +
// project_resource_leveling_server_plan, problem v = 2). Pure: no React / Supabase.
//
// The database works on the VIRTUAL AXIS of the steps: a "day" of the problem is one step (resourceSlotMinutes) of working time, every day is worked, dates are 2000-01-01 + the step number.
// The calendar (windows, days off) is already inside the axis, so ANY calendar is fine for the database; what it cannot take is what the device solves with the scheduler of the screen:
// manual tasks, start times and Start No Earlier Than dates, elapsed / split / external / inactive / subproject tasks, task calendars, other distributions, cycles, a very long horizon.
// Never a silent guess: the reasons are listed, the run is calculated on this device and says why. The device then CHECKS the proposal with its own scheduler.
import { DAY_MS } from '../model/constants';
import type { PMTaskDependencyRow, PMTaskJSON, PMTaskRow } from '../model/types';
import { scheduleOptionsOf } from '../model/scheduleOptions';
import { leafGraphOf } from '../view/project/scheduling';
import { sharesOf } from '../resourceleveling/resourceLevelingDemand';
import type { PlanLevelingArgs, PreparedRun } from '../resourceleveling/resourceLevelingRun';
import type { ServerUnsupported } from '../resourceleveling/resourceLevelingServerProblem';
import { SERVER_LIMITS } from '../resourceleveling/resourceLevelingServerProblem';
import { slotOfVirtual } from './hourLevelingEnv';
import { durationMinutesOf } from './scheduleHours';
import { wholeMinutesOf } from './minutes';

/** the limits of the database (the same numbers as the SQL) */
export const HOUR_SERVER_LIMITS = { slots: 30000, cells: 400000 } as const;

export interface HourServerLeaf {
  g: string;
  o: number;
  /** duration in steps */
  d: number;
  z: string | null;
  p: number;
  l: [string, number][];
}

export interface HourServerProblem {
  v: 2;
  method: 'leveling' | 'smoothing';
  order: 'idOnly' | 'standard' | 'priorityStandard';
  period: 'day';
  direction: 'forward';
  skipWeekends: false;
  /** the date of step 0 of this plan ('2000-01-01' + the first step) */
  projectStart: string;
  /** the delays the run starts from, in steps */
  delays: Record<string, number>;
  /** the last step the capacity is known for, and the longest search (steps) */
  lastSlot: number;
  maxSearch: number;
  /** runs of steps with the same capacity / foreign hours: [resource, firstStep, lastStep, hours] */
  cap: [string, number, number, number][];
  for: [string, number, number, number][];
  leaves: HourServerLeaf[];
  cons: [string, string, string, number][];
  members: Record<string, string[]>;
}

export interface HourServerProblemResult { problem: HourServerProblem | null; reasons: ServerUnsupported[] }

/** consecutive steps with the same value become one run; a step without a value (unknown capacity) ends a run and is not sent */
function runsOf(resource: string, lastSlot: number, valueAt: (slot: number) => number | null): [string, number, number, number][] {
  const out: [string, number, number, number][] = [];
  let from = -1;
  let cur: number | null = null;
  const close = (end: number) => { if (from >= 0 && cur !== null) out.push([resource, from, end, cur]); };
  for (let s = 0; s <= lastSlot; s++) {
    const v = valueAt(s);
    if (v === cur && from >= 0) continue;
    close(s - 1);
    from = v === null ? -1 : s;
    cur = v;
  }
  close(lastSlot);
  return out;
}

export function serverProblemHoursOf(a: PlanLevelingArgs, p: PreparedRun): HourServerProblemResult {
  const hour = a.hour!;
  const step = hour.step;
  const options = scheduleOptionsOf(a.projectJSON);
  const reasons = new Set<ServerUnsupported>();
  const W = hour.axis.dayMinutes;
  const toSteps = (minutes: number): number => Math.ceil((minutes - 1e-9) / step);

  const durOf = (t: PMTaskRow): number => durationMinutesOf(t, hour.axis);
  const lagOf = (pred: PMTaskRow | undefined, d: PMTaskDependencyRow): number => {
    const pct = (d.rowJSON as any)?.lagPercent;
    if (options.lagPercentEnabled && pred && typeof pct === 'number' && Number.isFinite(pct)) return Math.round((toSteps(durOf(pred)) * pct) / 100);
    const days = Number(d.lagDays) || 0;
    return days === 0 ? 0 : Math.sign(days) * toSteps(Math.abs(days) * W);
  };
  const graph = leafGraphOf(a.tasks, a.deps, lagOf);
  if (graph.cyclic.length > 0) reasons.add('cycle');
  if (graph.leaves.length > SERVER_LIMITS.leaves) reasons.add('size');

  const byGuid = new Map(a.tasks.map((t) => [t.rowGUID, t]));
  for (const t of a.tasks) {
    const json = (t.rowJSON || {}) as PMTaskJSON;
    const stage = json.rowKind === 'stage';
    if (!stage && json.taskIsSubproject === true) reasons.add('subproject');
    if (options.inactiveEnabled && json.taskInactive === true) reasons.add('inactive');
    if (graph.isSummary(t.rowGUID)) continue;
    // a start time or a Start No Earlier Than date pins a task: the database does not know pins
    if (wholeMinutesOf(json.taskStartMinute) !== null || (typeof json.manualStartAt === 'string' && json.manualStartAt) || (options.manualEnabled && json.taskScheduleMode === 'manual')) reasons.add('constraint');
  }
  const inputByGuid = new Map(p.inputs.map((t) => [t.guid, t]));
  for (const t of p.inputs) if (t.lines.some((l) => ![2, 3, 5, 7].every((n) => { const s = sharesOf(l.shape, n); return s.every((v) => Math.abs(v - s[0]) < 1e-9); }))) { reasons.add('distribution'); break; }

  const cons: HourServerProblem['cons'] = [];
  const members: Record<string, string[]> = {};
  for (const leaf of graph.leaves) {
    for (const c of graph.constraintsByLeaf.get(leaf) || []) {
      cons.push([leaf, c.pred, c.type, c.lag]);
      if (graph.isSummary(c.pred) && !members[c.pred]) members[c.pred] = graph.leavesUnder(c.pred);
    }
  }
  if (cons.length > SERVER_LIMITS.cons) reasons.add('size');

  const env = p.env;
  const lastSlot = slotOfVirtual(env.horizon.lastDayMs);
  const resources = [...new Set(p.inputs.flatMap((t) => t.lines.map((l) => l.resource)))];
  if (lastSlot + 1 > HOUR_SERVER_LIMITS.slots || (lastSlot + 1) * Math.max(1, resources.length) > HOUR_SERVER_LIMITS.cells) reasons.add('size');
  if (reasons.size > 0) return { problem: null, reasons: [...reasons] };

  const cap: HourServerProblem['cap'] = [];
  const foreign: HourServerProblem['for'] = [];
  for (const res of resources) {
    cap.push(...runsOf(res, lastSlot, (s) => { const c = env.capacity(res, s * DAY_MS); return c === null || c === undefined ? null : Math.round(c * 1e9) / 1e9; }));
    foreign.push(...runsOf(res, lastSlot, (s) => { const f = env.foreign(res, s * DAY_MS); return f > 1e-12 ? Math.round(f * 1e9) / 1e9 : null; }));
  }

  const index = new Map(a.tasks.map((t, i) => [t.rowGUID, i]));
  const leaves: HourServerLeaf[] = graph.topo.map((g) => {
    const t = byGuid.get(g)!;
    const input = inputByGuid.get(g);
    return { g, o: index.get(g) ?? 0, d: toSteps(durOf(t)), z: input?.frozen ?? null, p: input?.priority ?? 500, l: (input?.lines || []).map((l): [string, number] => [l.resource, l.hours]) };
  });
  const delays: Record<string, number> = {};
  for (const [g, d] of Object.entries(p.origin)) if ((byGuid.get(g)?.rowJSON as PMTaskJSON | undefined)?.rowKind !== 'stage' && d > 0) delays[g] = d;
  return {
    reasons: [],
    problem: {
      v: 2, method: p.effective.method, order: p.effective.order, period: 'day', direction: 'forward', skipWeekends: false,
      projectStart: '2000-01-01', delays, lastSlot, maxSearch: env.maxSearch ?? 800, cap, for: foreign, leaves, cons, members,
    },
  };
}
