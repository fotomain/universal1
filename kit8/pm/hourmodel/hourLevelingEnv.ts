// hourLevelingEnv - the LevelingEnv of the time-of-day model (documentation/RESOURCE_LEVELING_HOURS_WBS.html section 4.6). Pure: no React / Supabase.
//
// The leveling engine (resourceLevelingEngine.ts) is NOT rewritten: it works on a VIRTUAL axis where one virtual day is one STEP (resourceSlotMinutes) of working time:
//   slot k            = the working minutes [k x step, (k + 1) x step) of the working-minute axis (hourAxis.ts)
//   virtual ms        = (working minute / step) x DAY_MS          (the engine's "day" bucket = a slot)
//   delay             = steps (1 step = `step` working minutes; stored as taskLevelingDelayMinutes = steps x step)
//   capacity of slot  = hours of the resource's calendar windows inside the real pieces of the slot
//   foreign of slot   = hours of the other projects' posted slices inside the real pieces of the slot
//   hours of a line   = spread evenly over the slots of the task (= over its working minutes), as Post spreads them over the days
// Positions are exact (minutes); the engine's demand and capacity are per slot, so with a step that is not 1 the leveling is an approximation that the exact minute check of Post confirms.
import { DAY_MS } from '../model/constants';
import type { PMScheduledRow, PMTaskDependencyRow, PMTaskRow } from '../model/types';
import type { PMScheduleOptions } from '../model/scheduleOptions';
import type { LevelingEnv, LevelingSchedule } from '../resourceleveling/resourceLevelingModel';
import { MINUTE_MS } from './hourAxis';
import type { HourAxis } from './hourAxis';
import { scheduleProjectHours } from './scheduleHours';
import type { HourScheduleResult } from './scheduleHours';

/** what project_resource_leveling_inputs_hours returns for the capacity: the windows of a resource on a day, in minutes of the day (w = [] = a day known to be closed; no row = unknown) */
export interface HourCapacityRow { k: string; g: string; d: string; w: [number, number][] }
/** ... for the other projects: a posted slice [s, e) (ISO wall-clock instants of the project) holding h hours */
export interface HourForeignRow { k: string; g: string; s: string; e: string; h: number }

export interface HourLevelingEnvArgs {
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
  options?: Partial<PMScheduleOptions>;
  projectStartMs: number;
  axis: HourAxis;
  step: number;
  levelingEnabled?: boolean;
  capacityRows: HourCapacityRow[];
  foreignRows: HourForeignRow[];
}

export const virtualOf = (wm: number, step: number): number => (wm / step) * DAY_MS;
export const slotOfVirtual = (ms: number): number => Math.floor(ms / DAY_MS + 1e-9);
/** the date of slot 0 in a server problem: the database counts virtual days from this day */
export const SERVER_BASE_MS = Date.UTC(2000, 0, 1);

const dayOfIso = (d: string): number => Date.parse(d.slice(0, 10) + 'T00:00:00Z');
const instantOfIso = (s: string): number => Date.parse(s.length <= 19 && !/Z|[+-]\d\d:?\d\d$/.test(s) ? s + 'Z' : s);

export function buildHourLevelingEnv(a: HourLevelingEnvArgs): LevelingEnv {
  const { axis, step } = a;
  const realOf = new WeakMap<LevelingSchedule, HourScheduleResult>();

  // capacity: "resource|day" -> windows
  const windows = new Map<string, [number, number][]>();
  let lastCapDay = -Infinity;
  for (const r of a.capacityRows) {
    const d = dayOfIso(r.d);
    windows.set(`${r.k}:${r.g}|${d}`, r.w);
    if (d > lastCapDay) lastCapDay = d;
  }
  // foreign: "resource|day" -> slices
  const foreignByDay = new Map<string, { s: number; e: number; h: number }[]>();
  for (const r of a.foreignRows) {
    const s = instantOfIso(r.s);
    const e = instantOfIso(r.e);
    if (!(e > s)) continue;
    const key = `${r.k}:${r.g}|${Math.floor(s / DAY_MS) * DAY_MS}`;
    const list = foreignByDay.get(key) || [];
    list.push({ s, e, h: Number(r.h) });
    foreignByDay.set(key, list);
  }
  const lastSlot = lastCapDay === -Infinity ? 0 : Math.floor(axis.workMinuteAt(lastCapDay + DAY_MS) / step) - 1;

  const slotPieces = (slot: number) => axis.pieces(slot * step, (slot + 1) * step);
  const capCache = new Map<string, number | null>();
  const forCache = new Map<string, number>();

  const capacity = (resource: string, dayMs: number): number | null => {
    const slot = slotOfVirtual(dayMs);
    const key = `${resource}|${slot}`;
    const hit = capCache.get(key);
    if (hit !== undefined) return hit;
    let minutes = 0;
    let unknown = false;
    for (const p of slotPieces(slot)) {
      const day = Math.floor(p.startMs / DAY_MS) * DAY_MS;
      const w = windows.get(`${resource}|${day}`);
      if (!w) { unknown = true; break; }
      const from0 = (p.startMs - day) / MINUTE_MS;
      const to0 = (p.endMs - day) / MINUTE_MS;
      for (const [from, to] of w) minutes += Math.max(0, Math.min(to0, to) - Math.max(from0, from));
    }
    const v = unknown ? null : minutes / 60;
    capCache.set(key, v);
    return v;
  };
  const foreign = (resource: string, dayMs: number): number => {
    const slot = slotOfVirtual(dayMs);
    const key = `${resource}|${slot}`;
    const hit = forCache.get(key);
    if (hit !== undefined) return hit;
    let hours = 0;
    for (const p of slotPieces(slot)) {
      const day = Math.floor(p.startMs / DAY_MS) * DAY_MS;
      for (const f of foreignByDay.get(`${resource}|${day}`) || []) {
        const lo = Math.max(p.startMs, f.s);
        const hi = Math.min(p.endMs, f.e);
        if (hi > lo) hours += (f.h * (hi - lo)) / (f.e - f.s);
      }
    }
    forCache.set(key, hours);
    return hours;
  };

  const toVirtualRows = (r: HourScheduleResult): LevelingSchedule => {
    const rows: Record<string, PMScheduledRow> = {};
    for (const [guid, row] of Object.entries(r.rows)) {
      rows[guid] = {
        ...row,
        startMs: virtualOf(row.startWm, step), finishMs: virtualOf(row.finishWm, step),
        durationDays: row.durationMinutes / step, totalFloatDays: row.totalFloatMinutes / step,
      };
    }
    const s: LevelingSchedule = { rows, projectStartMs: virtualOf(r.projectStartWm, step), projectFinishMs: virtualOf(r.projectFinishWm, step) };
    realOf.set(s, r);
    return s;
  };

  return {
    schedule: (delays) => {
      const minutes: Record<string, number> = {};
      for (const [g, steps] of Object.entries(delays)) if (steps > 0) minutes[g] = steps * step;
      return toVirtualRows(scheduleProjectHours({
        tasks: a.tasks, deps: a.deps, projectStartMs: a.projectStartMs, axis, options: a.options, levelingEnabled: a.levelingEnabled !== false, levelingDelaysMinutes: minutes,
      }));
    },
    // the slots the task touches (every slot of the virtual axis is working time)
    activeDays: (_task, startMs, finishMs) => {
      const out: number[] = [];
      const first = slotOfVirtual(startMs);
      const end = Math.ceil(finishMs / DAY_MS - 1e-9);
      for (let s = first; s < end; s++) out.push(s * DAY_MS);
      return out;
    },
    // forward only: `extra` steps later than the row
    place: (_task, row, extra) => ({ startMs: row.startMs + extra * DAY_MS, finishMs: row.finishMs + extra * DAY_MS }),
    capacity,
    foreign,
    horizon: { firstDayMs: 0, lastDayMs: Math.max(0, lastSlot) * DAY_MS },
    maxSearch: Math.min(20000, Math.max(800, lastSlot + 1)),
    present: (s) => {
      const r = realOf.get(s);
      if (!r) return s;
      return { rows: r.rows as Record<string, PMScheduledRow>, projectStartMs: r.projectStartMs, projectFinishMs: r.projectFinishMs };
    },
    bucketToReal: (bucketMs) => axis.startInstant(slotOfVirtual(bucketMs) * step),
    serverBucketMs: (bucket) => Math.round((Date.parse(String(bucket).slice(0, 10) + 'T00:00:00Z') - SERVER_BASE_MS) / DAY_MS) * DAY_MS,
    delayUnitMinutes: step,
  };
}
