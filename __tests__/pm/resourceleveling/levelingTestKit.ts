// Test kit of the Resource optimization tests: small hand-made plans, the real scheduler, a calendar of Monday to Friday.
import { DAY_MS } from '../../../kit8/pm/model/constants';
import type { PMLinkType, PMTaskDependencyRow, PMTaskRow } from '../../../kit8/pm/model/types';
import { isWorkDay, scheduleProject } from '../../../kit8/pm/view/project/scheduling';
import type { PMCalendar } from '../../../kit8/pm/view/project/scheduling';
import { activeDaysBetween, placeAway } from '../../../kit8/pm/resourceleveling/resourceLevelingPlace';
import type { LevelingEnv, LevelingOptions, LevelingTaskInput } from '../../../kit8/pm/resourceleveling/resourceLevelingModel';

export const D0 = Date.UTC(2026, 9, 5); // Monday 2026-10-05
export const day = (n: number) => D0 + n * DAY_MS;
export const dayIndex = (ms: number) => Math.round((ms - D0) / DAY_MS);
export const WEEKDAYS: PMCalendar = { skipWeekends: true };
const P = '11111111-1111-4111-8111-111111111111';

let seq = 0;
export const resetSeq = () => { seq = 0; };

export function makeTask(name: string, durationDays: number, extra: Record<string, unknown> = {}, rowKind: 'task' | 'milestone' | 'stage' = 'task', parent?: string): PMTaskRow {
  const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const label = id.replace(/-/g, '_');
  return {
    rowGUID: id, treePath: parent ? `${parent}.${label}` : `p.${label}`, projectGUID: P, rowOwnerGUID: 'o', rowDuration: null, rowProgress: 0, orderInList: seq,
    rowJSON: { rowKind, taskDescription: name, durationDays, ...extra },
  } as unknown as PMTaskRow;
}

export const makeLink = (pred: PMTaskRow, succ: PMTaskRow, linkType: PMLinkType = 'FS', lagDays = 0): PMTaskDependencyRow =>
  ({ rowGUID: succ.rowGUID, rowDependsOnGUID: pred.rowGUID, projectGUID: P, rowOwnerGUID: 'o', linkType, lagDays }) as PMTaskDependencyRow;

/** a Time line of a task: hours of a person */
export function timeLine(taskGUID: string, resource: string, hours: number, extra: Record<string, unknown> = {}): any {
  return {
    rowGUID: `line-${taskGUID}-${resource}`, rowParentGUID: 'timeGenus', rowOwnerGUID: taskGUID, rowProjectGUID: P, orderInList: 1,
    rowJSON: { taskResourceItem: resource, taskResourceKind: 'person', qtyTaskLine: hours, measureUnitTaskLine: 'unit_hour', distributionForBudgetTaskLine: 'uniformDistribution', taskIsPosted: false, ...extra },
  };
}

export interface KitOptions {
  tasks: PMTaskRow[];
  deps?: PMTaskDependencyRow[];
  cal?: PMCalendar;
  /** hours per working day of every resource (default 8); a function gives it per resource and day (null = unknown) */
  capacity?: number | ((resource: string, dayMs: number) => number | null);
  foreign?: (resource: string, dayMs: number) => number;
  scheduleFromFinishDay?: number;
  lastDay?: number;
  scheduleExtra?: Record<string, unknown>;
}

export function makeEnv(o: KitOptions): LevelingEnv {
  const cal = o.cal ?? WEEKDAYS;
  const forward = o.scheduleFromFinishDay === undefined;
  const cap = o.capacity ?? 8;
  return {
    schedule: (delays) => {
      const r = scheduleProject({
        tasks: o.tasks, deps: o.deps ?? [], projectStartMs: D0, calendar: cal, levelingEnabled: true, levelingDelays: delays,
        ...(forward ? {} : { scheduleFrom: 'finish' as const, projectFinishDayMs: day(o.scheduleFromFinishDay!) }),
        ...(o.scheduleExtra ?? {}),
      });
      return { rows: r.rows, projectStartMs: r.projectStartMs, projectFinishMs: r.projectFinishMs };
    },
    activeDays: (_t, s, f) => activeDaysBetween(s, f, (d) => isWorkDay(d, cal)),
    place: (_t, row, extra) => placeAway(row, extra, cal, forward),
    capacity: (resource, d) => (typeof cap === 'function' ? cap(resource, d) : isWorkDay(d, cal) ? cap : 0),
    foreign: (resource, d) => o.foreign?.(resource, d) ?? 0,
    horizon: { firstDayMs: day(-400), lastDayMs: day(o.lastDay ?? 400) },
  };
}

export function taskInput(t: PMTaskRow, lines: ReturnType<typeof timeLine>[], extra: Partial<LevelingTaskInput> = {}): LevelingTaskInput {
  const j: any = t.rowJSON;
  return {
    guid: t.rowGUID,
    lines: lines.map((l) => ({ resource: `person:${l.rowJSON.taskResourceItem}`, hours: l.rowJSON.qtyTaskLine, shape: 'uniformDistribution' })),
    priority: j.taskPriority ?? 500, order: t.orderInList, frozen: null, posted: false, ...extra,
  };
}

export const OPT: LevelingOptions = { order: 'standard', method: 'leveling', direction: 'forward', period: 'day' };
