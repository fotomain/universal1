// resourceLevelingServerProblem - the plan on the screen as the PROBLEM of the database (Server side computations; documentation/RESOURCE_LEVELING_WBS.html section 19) and the list of the
// reasons why a plan cannot be sent. Pure: no React / Supabase.
//
// The database (SQL PART 42, project_resource_leveling_server_plan) calculates exactly what it can calculate exactly: a forward plan in ONE calendar (Monday-Friday or every day) with the
// links FS / SS / FF / SF and a lag in working days, uniform hours. Anything else (constraints, manual tasks, splits, elapsed durations, task calendars, calendar exceptions, external predecessors,
// subprojects, inactive tasks, other distributions, a plan planned from the finish) is NOT sent: the run is calculated on this device and the application says why. Never a silent guess.
import { DAY_MS } from '../model/constants';
import type { PMTaskDependencyRow, PMTaskJSON, PMTaskRow } from '../model/types';
import { constraintOf } from '../model/taskConstraint';
import { manualStartOf, taskModeOf } from '../model/taskScheduleMode';
import { scheduleOptionsOf } from '../model/scheduleOptions';
import { durationOf, leafGraphOf, splitsOf } from '../view/project/scheduling';
import type { PMCalendar } from '../view/project/scheduling';
import { sharesOf } from './resourceLevelingDemand';
import type { InputRow } from './resourceLevelingEnv';
import type { PlanLevelingArgs, PreparedRun } from './resourceLevelingRun';

export type ServerUnsupported =
  | 'direction'     // planned from the project finish
  | 'calendar'      // the calendar of the project has a work week of its own or exceptions
  | 'taskCalendar'  // a task has a calendar of its own
  | 'constraint'    // a task has a constraint (also As Late As Possible, Start No Earlier Than ...)
  | 'manual'        // a manually scheduled task
  | 'splits'        // a split task
  | 'elapsed'       // a task with an elapsed duration
  | 'external'      // a predecessor in another project
  | 'inactive'      // an inactive task
  | 'subproject'    // a subproject task
  | 'distribution'  // a Time line with a distribution other than uniform
  | 'cycle'         // the links make a loop
  | 'size';         // more tasks or links than the function takes

/** the limits of project_resource_leveling_server_plan */
export const SERVER_LIMITS = { leaves: 3000, cons: 20000 } as const;

export interface ServerLeaf {
  /** task GUID */
  g: string;
  /** row number in the WBS (the last tie-break) */
  o: number;
  /** duration in working days */
  d: number;
  /** why the task cannot move (FrozenCode) or null */
  z: string | null;
  /** priority 0..1000 */
  p: number;
  /** Time lines in hours: [resource "kind:guid", hours] */
  l: [string, number][];
}

export interface ServerProblem {
  v: 1;
  method: 'leveling' | 'smoothing';
  order: 'idOnly' | 'standard' | 'priorityStandard';
  period: 'day' | 'week';
  direction: 'forward';
  skipWeekends: boolean;
  projectStart: string;
  from: string;
  to: string;
  delays: Record<string, number>;
  leaves: ServerLeaf[];
  cons: [string, string, string, number][];
  members: Record<string, string[]>;
}

const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const plainCalendar = (cal: PMCalendar): boolean => !cal.workWeek && !cal.offDays?.size && !cal.extraDays?.size;
/** the hours of a line are spread evenly over the days (the only distribution the database knows) */
const uniformShape = (shape: string): boolean => [2, 3, 5, 7].every((n) => { const s = sharesOf(shape, n); return s.every((v) => Math.abs(v - s[0]) < 1e-9); });

export function dateRangeOf(rows: InputRow[], fallbackMs: number): { from: string; to: string } {
  let first = Infinity;
  let last = -Infinity;
  for (const r of rows) { const d = Date.parse(r.d.slice(0, 10) + 'T00:00:00Z'); if (d < first) first = d; if (d > last) last = d; }
  return first === Infinity ? { from: iso(fallbackMs), to: iso(fallbackMs) } : { from: iso(first), to: iso(last) };
}

export interface ServerProblemResult { problem: ServerProblem | null; reasons: ServerUnsupported[] }

/** the problem of a run, or the reasons why the database cannot calculate it */
export function serverProblemOf(a: PlanLevelingArgs, p: PreparedRun): ServerProblemResult {
  const options = scheduleOptionsOf(a.projectJSON);
  const reasons = new Set<ServerUnsupported>();
  if (p.direction !== 'forward') reasons.add('direction');
  const baseCal: PMCalendar = options.projectCalendar ?? { skipWeekends: !!a.projectJSON?.skipWeekends };
  if (!plainCalendar(baseCal)) reasons.add('calendar');

  const lagOf = (pred: PMTaskRow | undefined, d: PMTaskDependencyRow): number => {
    const pct = (d.rowJSON as any)?.lagPercent;
    if (options.lagPercentEnabled && pred && typeof pct === 'number' && Number.isFinite(pct)) return Math.round((durationOf(pred) * pct) / 100);
    return Number(d.lagDays) || 0;
  };
  const graph = leafGraphOf(a.tasks, a.deps, lagOf);
  if (graph.cyclic.length > 0) reasons.add('cycle');
  if (graph.leaves.length > SERVER_LIMITS.leaves) reasons.add('size');

  // what the plan holds that the database does not calculate
  const byGuid = new Map(a.tasks.map((t) => [t.rowGUID, t]));
  for (const t of a.tasks) {
    const json = (t.rowJSON || {}) as PMTaskJSON;
    const stage = json.rowKind === 'stage';
    const sub = !stage && json.taskIsSubproject === true;
    if (sub) reasons.add('subproject');
    if (options.inactiveEnabled && json.taskInactive === true) reasons.add('inactive');
    if (graph.isSummary(t.rowGUID)) continue; // a summary row takes its dates from its leaves
    const manual = !stage && taskModeOf(json, options.manualEnabled) === 'manual' && manualStartOf(json) !== null;
    if (manual) reasons.add('manual');
    else if (constraintOf(json, options.constraintsEnabled && !stage && !sub).type !== 'ASAP') reasons.add('constraint');
    const calId = json.taskCalendarId as string | null | undefined;
    if (calId && options.calendars[calId]) reasons.add('taskCalendar');
    if (options.elapsedEnabled && !stage && json.durationElapsed === true) reasons.add('elapsed');
    if (options.splitEnabled && !stage && splitsOf(json, durationOf(t)).length > 0) reasons.add('splits');
    if (options.externalEnabled && !stage && Array.isArray(json.externalPredecessors) && json.externalPredecessors.some((e: any) => a.externalDates?.[e?.taskGUID])) reasons.add('external');
  }
  const inputByGuid = new Map(p.inputs.map((t) => [t.guid, t]));
  for (const t of p.inputs) if (t.lines.some((l) => !uniformShape(l.shape))) { reasons.add('distribution'); break; }

  const cons: ServerProblem['cons'] = [];
  const members: Record<string, string[]> = {};
  for (const leaf of graph.leaves) {
    for (const c of graph.constraintsByLeaf.get(leaf) || []) {
      cons.push([leaf, c.pred, c.type, c.lag]);
      if (graph.isSummary(c.pred) && !members[c.pred]) members[c.pred] = graph.leavesUnder(c.pred);
    }
  }
  if (cons.length > SERVER_LIMITS.cons) reasons.add('size');
  if (reasons.size > 0) return { problem: null, reasons: [...reasons] };

  const index = new Map(a.tasks.map((t, i) => [t.rowGUID, i]));
  const leaves: ServerLeaf[] = graph.topo.map((g) => {
    const t = byGuid.get(g)!;
    const input = inputByGuid.get(g);
    return {
      g, o: index.get(g) ?? 0, d: durationOf(t), z: input?.frozen ?? null, p: input?.priority ?? 500,
      l: (input?.lines || []).map((l): [string, number] => [l.resource, l.hours]),
    };
  });
  // a stage never carries a delay (the plan of the screen would ignore it)
  const delays: Record<string, number> = {};
  for (const [g, d] of Object.entries(p.origin)) if ((byGuid.get(g)?.rowJSON as PMTaskJSON | undefined)?.rowKind !== 'stage' && d > 0) delays[g] = d;
  const range = dateRangeOf(a.capacityRows, Math.floor(a.projectStartMs / DAY_MS) * DAY_MS);
  return {
    reasons: [],
    problem: {
      v: 1, method: p.effective.method, order: p.effective.order, period: p.effective.grainUnit === 'week' ? 'week' : 'day', direction: 'forward',
      skipWeekends: baseCal.skipWeekends === true, projectStart: iso(a.projectStartMs), from: range.from, to: range.to, delays, leaves, cons, members,
    },
  };
}
