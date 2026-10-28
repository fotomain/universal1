// resourceLevelingEngine - Resource optimization: leveling and smoothing (documentation/RESOURCE_LEVELING_WBS.html section 7.3). Pure TypeScript: no React / Supabase.
//
// What it does: given the plan (scheduleProject, delays cleared) it scans the periods in the direction of the plan, and where a resource has more load than its capacity it DELAYS the task
// that yields first (by the leveling order) until the task fits; the scheduler then moves the successors; repeat until no move is left. Smoothing (resourceLevelingWithinSlackOnly)
// does the same but a move may never move the project finish (forward) / start (backward).
// What it never does: change hours, units, resources, durations. It only writes delays (working days away from the anchor).
// Deterministic: the same plan gives the same result. Terminates: every move increases a delay, the horizon is finite, and a pass counter stops a run.
import { DAY_MS } from '../model/constants';
import type { PMScheduledRow } from '../model/types';
import { conflictsOf, EPS, buildUsage, capacityOf, foreignOf, bucketOf, makeCtx, LevelingCtx, Usage } from './resourceLevelingDetect';
import { entriesOf } from './resourceLevelingDemand';
import type {
  LevelingConflict, LevelingEnv, LevelingMove, LevelingOptions, LevelingResult, LevelingSchedule, LevelingTaskInput, MoveReason, UnresolvedCode,
} from './resourceLevelingModel';

const DEFAULT_MAX_PASSES = 400;
const MAX_SEARCH_DAYS = 800;

const keyOf = (resource: string, bucket: number) => resource + '|' + bucket;

interface Applied { task: string; extra: number; move: LevelingMove }

/** negative = `a` keeps its place before `b` (a is the stronger contender) */
function keepOrder(a: LevelingTaskInput, b: LevelingTaskInput, rows: Record<string, PMScheduledRow>, opt: LevelingOptions): number {
  const fa = a.frozen ? 0 : 1;
  const fb = b.frozen ? 0 : 1;
  if (fa !== fb) return fa - fb; // fixed tasks keep first
  if (opt.order === 'idOnly') return a.order - b.order;
  if (opt.order === 'priorityStandard' && a.priority !== b.priority) return b.priority - a.priority;
  const ra = rows[a.guid];
  const rb = rows[b.guid];
  const sa = ra ? ra.totalFloatDays : 0;
  const sb = rb ? rb.totalFloatDays : 0;
  if (sa !== sb) return sa - sb; // less slack keeps
  if (ra && rb) {
    if (opt.direction === 'forward' && ra.startMs !== rb.startMs) return ra.startMs - rb.startMs; // the earlier start keeps
    if (opt.direction === 'backward' && ra.finishMs !== rb.finishMs) return rb.finishMs - ra.finishMs; // the later finish keeps (nearer the anchor)
  }
  return a.order - b.order;
}

/** which rule made `loser` yield to `winner` */
function reasonOf(winner: LevelingTaskInput, loser: LevelingTaskInput, rows: Record<string, PMScheduledRow>, opt: LevelingOptions): MoveReason {
  if (opt.order === 'idOnly') return 'idYield';
  if (opt.order === 'priorityStandard' && winner.priority !== loser.priority) return 'priorityYield';
  const rw = rows[winner.guid];
  const rl = rows[loser.guid];
  if (rw && rl && rw.totalFloatDays !== rl.totalFloatDays) return 'slackYield';
  if (rw && rl && (opt.direction === 'forward' ? rw.startMs !== rl.startMs : rw.finishMs !== rl.finishMs)) return 'laterStartYield';
  return 'idYield';
}

export function levelResources(tasks: LevelingTaskInput[], env: LevelingEnv, opt: LevelingOptions): LevelingResult {
  const byGuid = new Map(tasks.map((t) => [t.guid, t]));
  const ctx = makeCtx(env, opt.period);
  const forward = opt.direction === 'forward';
  const maxPasses = opt.maxPasses ?? DEFAULT_MAX_PASSES;
  const startDelays = { ...(opt.startDelays || {}) };
  let delays: Record<string, number> = { ...startDelays };

  const baseline = env.schedule(delays);
  let sched: LevelingSchedule = baseline;
  const before = conflictsOf(ctx, buildUsage(ctx, tasks, baseline.rows));

  const forbidden = new Set<string>(); // smoothing: moving this task moved the anchor
  const failure = new Map<string, UnresolvedCode>(); // bucket key -> why it could not be solved
  const moves: LevelingMove[] = [];
  const firstMoveOf = new Map<string, LevelingMove>();

  const violates = (s: LevelingSchedule): boolean => opt.method === 'smoothing' && (forward ? s.projectFinishMs > baseline.projectFinishMs : s.projectStartMs < baseline.projectStartMs);

  /** one scan of all conflicts; maxMoves bounds the moves (1 = one at a time) */
  const runPass = (maxMoves: number): Applied[] => {
    const rows = sched.rows;
    const usage = buildUsage(ctx, tasks, rows);
    const pos = new Map<string, { startMs: number; finishMs: number; days: number[] }>();
    const positionOf = (guid: string) => {
      let p = pos.get(guid);
      if (!p) {
        const r = rows[guid];
        p = { startMs: r.startMs, finishMs: r.finishMs, days: env.activeDays(guid, r.startMs, r.finishMs) };
        pos.set(guid, p);
      }
      return p;
    };
    const slackLeft = new Map<string, number>();
    const applied: Applied[] = [];
    let conflicts = conflictsOf(ctx, usage);
    if (!forward) conflicts = conflicts.reverse();

    for (const c of conflicts) {
      const skip = new Set<string>(); // yielders that could not be placed for this conflict
      for (let guard = 0; guard < 200; guard++) {
        const total = usage.totalAt(c.resource, c.bucket);
        const cap = capacityOf(ctx, c.resource, c.bucket);
        const foreign = foreignOf(ctx, c.resource, c.bucket);
        const over = cap === null ? total + foreign : total + foreign - cap;
        if (total <= EPS || (cap !== null && over <= EPS)) break; // solved (by an earlier move of this pass)
        const present = [...(usage.tasksAt(c.resource, c.bucket)?.keys() || [])].map((g) => byGuid.get(g)!).filter((t) => t && rows[t.guid]);
        present.sort((a, b) => keepOrder(a, b, rows, opt));
        // the yielder = the weakest contender that may move and has not failed here
        let idx = -1;
        for (let i = present.length - 1; i >= 0; i--) {
          const t = present[i];
          if (!t.frozen && !forbidden.has(t.guid) && !skip.has(t.guid)) { idx = i; break; }
        }
        if (idx < 0) {
          const fixedFirst = present.find((t) => t.frozen);
          const key = keyOf(c.resource, c.bucket);
          if (!failure.has(key)) failure.set(key, cap === null ? 'capacityUnknown' : fixedFirst ? (fixedFirst.frozen as UnresolvedCode) : present.length ? 'slackLimit' : 'foreignLoad');
          break;
        }
        const x = present[idx];
        const winner = present[Math.max(0, idx - 1)];
        const found = placeTask(x, ctx, usage, positionOf(x.guid), rows[x.guid], slackLeft, opt, env);
        if (!found.ok) {
          skip.add(x.guid);
          failure.set(keyOf(c.resource, c.bucket), found.code);
          continue;
        }
        // apply the move
        const p = positionOf(x.guid);
        usage.add(ctx, x.guid, entriesOf(x.lines, p.days), -1);
        usage.add(ctx, x.guid, entriesOf(x.lines, found.days), 1);
        p.startMs = found.startMs; p.finishMs = found.finishMs; p.days = found.days;
        const delayBefore = delays[x.guid] || 0;
        delays[x.guid] = delayBefore + found.extra;
        slackLeft.set(x.guid, (slackLeft.has(x.guid) ? slackLeft.get(x.guid)! : rows[x.guid].totalFloatDays) - found.extra);
        const move: LevelingMove = {
          task: x.guid, delayBefore, delayAfter: delays[x.guid], reason: idx === 0 ? 'foreignYield' : reasonOf(winner, x, rows, opt), resource: c.resource, bucket: c.bucket,
        };
        applied.push({ task: x.guid, extra: found.extra, move });
        failure.delete(keyOf(c.resource, c.bucket));
        if (applied.length >= maxMoves) return applied;
      }
    }
    return applied;
  };

  let passes = 0;
  let batch = true;
  while (passes < maxPasses) {
    passes++;
    const snapshot = { ...delays };
    const applied = runPass(batch ? Infinity : 1);
    if (applied.length === 0) break;
    const next = env.schedule(delays);
    if (violates(next)) {
      delays = snapshot;
      if (batch) { batch = false; continue; } // try again one move at a time
      forbidden.add(applied[0].task); // this single move moved the anchor: the task may not yield in this run
      failure.set(keyOf(applied[0].move.resource, applied[0].move.bucket), 'slackLimit');
      continue;
    }
    sched = next;
    batch = true;
    for (const a of applied) {
      moves.push(a.move);
      if (!firstMoveOf.has(a.task)) firstMoveOf.set(a.task, a.move);
    }
  }

  // ---- the result --------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const finalConflicts = conflictsOf(ctx, buildUsage(ctx, tasks, sched.rows));
  const unresolved: LevelingConflict[] = finalConflicts.map((c) => {
    const key = keyOf(c.resource, c.bucket);
    let code = failure.get(key);
    if (!code) {
      if (c.capacity === null) code = 'capacityUnknown';
      else {
        const fixed = c.tasks.map((g) => byGuid.get(g)).find((t) => t?.frozen);
        code = fixed ? (fixed.frozen as UnresolvedCode) : passes >= maxPasses ? 'passLimit' : c.tasks.length ? 'noCapacityInHorizon' : 'foreignLoad';
      }
    }
    return { ...c, code };
  });
  const postedMoved = [...firstMoveOf.keys()].filter((g) => byGuid.get(g)?.posted && (delays[g] || 0) !== (startDelays[g] || 0));
  // a task whose delay came back to its start value is not a move
  const finalMoves = moves.filter((m) => (delays[m.task] || 0) !== (startDelays[m.task] || 0));
  const seen = new Set<string>();
  const outMoves: LevelingMove[] = [];
  for (const m of finalMoves) {
    if (seen.has(m.task)) continue;
    seen.add(m.task);
    outMoves.push({ ...firstMoveOf.get(m.task)!, delayBefore: startDelays[m.task] || 0, delayAfter: delays[m.task] || 0 });
  }
  const clean: Record<string, number> = {};
  for (const [g, d] of Object.entries(delays)) if (d > 0) clean[g] = d;
  return { delays: clean, moves: outMoves, unresolved, before, schedule: sched, baseline, passes, postedMoved };
}

type PlaceResult =
  | { ok: true; extra: number; startMs: number; finishMs: number; days: number[] }
  | { ok: false; code: UnresolvedCode };

/** the first position (further away from the anchor than now) where the task's hours fit; null-capacity days, the horizon and (Smoothing) the slack bound the search */
function placeTask(
  x: LevelingTaskInput, ctx: LevelingCtx, usage: Usage,
  cur: { startMs: number; finishMs: number; days: number[] }, row: PMScheduledRow,
  slackLeft: Map<string, number>, opt: LevelingOptions, env: LevelingEnv,
): PlaceResult {
  const forward = opt.direction === 'forward';
  const slack = slackLeft.has(x.guid) ? slackLeft.get(x.guid)! : row.totalFloatDays;
  const curRow: PMScheduledRow = { ...row, startMs: cur.startMs, finishMs: cur.finishMs };
  // what the task takes now, per resource and bucket: it is taken out of the usage while we look for a place
  const nowEntries = entriesOf(x.lines, cur.days);
  const mine = new Map<string, number>();
  for (const e of nowEntries) { const k = keyOf(e.resource, bucketOf(ctx, e.dayMs)); mine.set(k, (mine.get(k) || 0) + e.hours); }
  let lastCode: UnresolvedCode = 'noCapacityInHorizon';
  let exceeds = false;
  for (let extra = 1; extra <= MAX_SEARCH_DAYS; extra++) {
    if (opt.method === 'smoothing' && extra > slack + EPS) return { ok: false, code: 'slackLimit' };
    const p = env.place(x.guid, curRow, extra);
    if (forward ? p.finishMs - DAY_MS > env.horizon.lastDayMs : p.startMs < env.horizon.firstDayMs) return { ok: false, code: exceeds ? 'taskExceedsCapacity' : lastCode };
    const days = env.activeDays(x.guid, p.startMs, p.finishMs);
    if (days.length === 0) continue;
    const need = new Map<string, { resource: string; bucket: number; hours: number }>();
    for (const e of entriesOf(x.lines, days)) {
      const b = bucketOf(ctx, e.dayMs);
      const k = keyOf(e.resource, b);
      const cur2 = need.get(k);
      if (cur2) cur2.hours += e.hours; else need.set(k, { resource: e.resource, bucket: b, hours: e.hours });
    }
    let fits = true;
    for (const [k, n] of need) {
      const cap = capacityOf(ctx, n.resource, n.bucket);
      if (cap === null) { fits = false; lastCode = 'capacityUnknown'; break; }
      if (n.hours > cap + EPS) exceeds = true;
      const others = usage.totalAt(n.resource, n.bucket) - (mine.get(k) || 0);
      if (others + foreignOf(ctx, n.resource, n.bucket) + n.hours > cap + EPS) { fits = false; if (lastCode === 'capacityUnknown') lastCode = 'noCapacityInHorizon'; break; }
    }
    if (fits) return { ok: true, extra, startMs: p.startMs, finishMs: p.finishMs, days };
  }
  return { ok: false, code: exceeds ? 'taskExceedsCapacity' : lastCode };
}
