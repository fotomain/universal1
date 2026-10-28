// resourceLevelingDetect - the load of every resource per period and the over-allocated periods (documentation/RESOURCE_LEVELING_WBS.html section 7.2). Pure.
// The rule is the one of the busy check at Post (organization_resource_busy_check): over-allocated = the hours booked (this project + the posted hours of the other projects)
// are STRICTLY above the capacity of the calendar; equal is not busy; a period whose calendar has no row (capacity unknown) with load on it is a conflict that is never "fixed" by guessing.
// Period = 'day' (hour and day grain: one working day is the finest period the plan has) or 'week' (Monday to Sunday: the sums of the week against the capacity of the week).
import { DAY_MS } from '../model/constants';
import type { PMScheduledRow } from '../model/types';
import { entriesOf, mondayOf } from './resourceLevelingDemand';
import type { LevelingConflict, LevelingEnv, LevelingTaskInput, ResourceKey } from './resourceLevelingModel';

export type LevelingPeriod = 'day' | 'week';
export const EPS = 1e-9;

/** the caches of one run: capacity and foreign hours do not change while the engine works */
export interface LevelingCtx {
  env: LevelingEnv;
  period: LevelingPeriod;
  capCache: Map<string, number | null>;
  foreignCache: Map<string, number>;
}

export const makeCtx = (env: LevelingEnv, period: LevelingPeriod): LevelingCtx => ({ env, period, capCache: new Map(), foreignCache: new Map() });

export const bucketOf = (ctx: LevelingCtx, dayMs: number): number => (ctx.period === 'week' ? mondayOf(dayMs) : Math.floor(dayMs / DAY_MS) * DAY_MS);
const daysOfBucket = (ctx: LevelingCtx, bucket: number): number[] => (ctx.period === 'week' ? [0, 1, 2, 3, 4, 5, 6].map((i) => bucket + i * DAY_MS) : [bucket]);

/** capacity of the period in hours; null = unknown (day: no calendar row; week: no row for any of its days) */
export function capacityOf(ctx: LevelingCtx, resource: ResourceKey, bucket: number): number | null {
  const key = resource + '|' + bucket;
  let v = ctx.capCache.get(key);
  if (v === undefined) {
    let sum = 0;
    let known = false;
    for (const d of daysOfBucket(ctx, bucket)) {
      const c = ctx.env.capacity(resource, d);
      if (c !== null && c !== undefined && Number.isFinite(c)) { sum += c; known = true; }
    }
    v = known ? sum : null;
    ctx.capCache.set(key, v);
  }
  return v;
}

export function foreignOf(ctx: LevelingCtx, resource: ResourceKey, bucket: number): number {
  const key = resource + '|' + bucket;
  let v = ctx.foreignCache.get(key);
  if (v === undefined) {
    v = 0;
    for (const d of daysOfBucket(ctx, bucket)) v += ctx.env.foreign(resource, d) || 0;
    ctx.foreignCache.set(key, v);
  }
  return v;
}

/** resource -> bucket -> task -> hours of the project's own tasks */
export class Usage {
  readonly byRes = new Map<string, Map<number, Map<string, number>>>();
  readonly total = new Map<string, Map<number, number>>();

  add(ctx: LevelingCtx, task: string, entries: { resource: string; dayMs: number; hours: number }[], sign: 1 | -1 = 1): void {
    for (const e of entries) {
      const b = bucketOf(ctx, e.dayMs);
      let rb = this.byRes.get(e.resource);
      if (!rb) this.byRes.set(e.resource, (rb = new Map()));
      let tb = rb.get(b);
      if (!tb) rb.set(b, (tb = new Map()));
      const next = (tb.get(task) || 0) + sign * e.hours;
      if (next > EPS) tb.set(task, next); else tb.delete(task);
      let tot = this.total.get(e.resource);
      if (!tot) this.total.set(e.resource, (tot = new Map()));
      tot.set(b, Math.max(0, (tot.get(b) || 0) + sign * e.hours));
    }
  }
  totalAt(resource: string, bucket: number): number { return this.total.get(resource)?.get(bucket) || 0; }
  tasksAt(resource: string, bucket: number): Map<string, number> | undefined { return this.byRes.get(resource)?.get(bucket); }
  taskHoursAt(task: string, resource: string, bucket: number): number { return this.byRes.get(resource)?.get(bucket)?.get(task) || 0; }
}

/** the usage of all tasks at the positions of the given plan */
export function buildUsage(ctx: LevelingCtx, tasks: LevelingTaskInput[], rows: Record<string, PMScheduledRow>): Usage {
  const usage = new Usage();
  for (const t of tasks) {
    const row = rows[t.guid];
    if (!row) continue;
    const days = ctx.env.activeDays(t.guid, row.startMs, row.finishMs);
    usage.add(ctx, t.guid, entriesOf(t.lines, days));
  }
  return usage;
}

/** the over-allocated (and unknown-capacity) periods of a usage, sorted by period then resource */
export function conflictsOf(ctx: LevelingCtx, usage: Usage): LevelingConflict[] {
  const out: LevelingConflict[] = [];
  for (const [resource, byBucket] of usage.total) {
    for (const [bucket, booked] of byBucket) {
      if (!(booked > EPS)) continue;
      const cap = capacityOf(ctx, resource, bucket);
      const foreign = foreignOf(ctx, resource, bucket);
      const over = cap === null ? booked + foreign : booked + foreign - cap;
      if (cap !== null && !(over > EPS)) continue;
      out.push({ resource, bucket, capacity: cap, booked, foreign, over, tasks: [...(usage.tasksAt(resource, bucket)?.keys() || [])] });
    }
  }
  return out.sort((a, b) => a.bucket - b.bucket || (a.resource < b.resource ? -1 : a.resource > b.resource ? 1 : 0));
}

/** detection only (read-only, works whatever the switches say): the conflicts of the plan `rows` */
export function detectConflicts(env: LevelingEnv, tasks: LevelingTaskInput[], rows: Record<string, PMScheduledRow>, period: LevelingPeriod = 'day'): LevelingConflict[] {
  const ctx = makeCtx(env, period);
  return conflictsOf(ctx, buildUsage(ctx, tasks, rows));
}
