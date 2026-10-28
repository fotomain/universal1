// resourceLevelingModel - the types and the codes of Resource optimization (documentation/RESOURCE_LEVELING_WBS.html sections 7.2, 7.3, 8). Pure: no React / Supabase.
//
// The engine works on plain numbers: a DAY is a UTC midnight in ms (the scheduler's unit), a RESOURCE is the string `kind:guid` (the key of resource_occupancy_x_movement),
// HOURS are the Time-line hours. Nothing here knows about tables or screens, so the engine can be tested on small hand-made plans.
import type { PMScheduledRow } from '../model/types';

/** `person:<guid>` | `equipment:<guid>` | `workCenter:<guid>` */
export type ResourceKey = string;
export const resourceKeyOf = (kind: string | null | undefined, guid: string): ResourceKey => `${kind || 'person'}:${guid}`;
export const resourceKindOfKey = (key: ResourceKey): string => key.slice(0, key.indexOf(':'));
export const resourceGuidOfKey = (key: ResourceKey): string => key.slice(key.indexOf(':') + 1);

/** one Time line of a task that books a resource (hours unit only) */
export interface LevelingLine {
  resource: ResourceKey;
  hours: number;
  /** the distribution code of the line (distributionForBudgetTaskLine), e.g. 'uniformDistribution' */
  shape: string;
}

/** why a task is NOT moved (it stays load); `null` = it may be moved */
export type FrozenCode =
  | 'frozenPosted'      // posted and the user does not want it moved (7.7)
  | 'frozenStarted'     // progress > 0, finished or starts before today
  | 'frozenFact'        // has a posted fact input / payment fact
  | 'priority1000'      // priority 1000 = never level
  | 'constraintHonored' // Must Start On / Must Finish On
  | 'manualTask'        // manually scheduled and resourceLevelingManualTasks is off
  | 'outOfScope';       // not in the scope of this run

export interface LevelingTaskInput {
  guid: string;
  lines: LevelingLine[];
  /** 0..1000, default 500 (Extended A15) */
  priority: number;
  /** the row number in the WBS (smaller = earlier); the last tie-break */
  order: number;
  frozen: FrozenCode | null;
  /** the task is posted (any budgeted line posted): moving it unposts it, so the user is asked first (7.7) */
  posted: boolean;
}

export type LevelingOrder = 'idOnly' | 'standard' | 'priorityStandard';
export type LevelingMethod = 'leveling' | 'smoothing';
/** forward = planned from the project start (a yielding task moves LATER); backward = planned from the finish (a yielding task moves EARLIER) */
export type LevelingDirection = 'forward' | 'backward';

/** the reason a task was moved: which rule decided that IT yields */
export type MoveReason = 'priorityYield' | 'slackYield' | 'laterStartYield' | 'idYield' | 'foreignYield';

/** why a conflict could not be solved */
export type UnresolvedCode =
  | FrozenCode
  | 'slackLimit'          // Smoothing: the slack is not enough
  | 'noCapacityInHorizon' // no later (earlier) day has the room
  | 'taskExceedsCapacity'  // the task alone needs more hours in a period than the resource has: moving cannot help (a split or another resource can)
  | 'capacityUnknown'     // the calendar has no row for the day
  | 'foreignLoad'         // the other projects hold the resource and nothing of this project can move
  | 'passLimit';          // the safety counter stopped the run

export interface LevelingMove {
  task: string;
  delayBefore: number;
  delayAfter: number;
  reason: MoveReason;
  resource: ResourceKey;
  /** the first conflict bucket (day, or the Monday of the week) that made the task yield */
  bucket: number;
}

export interface LevelingConflict {
  resource: ResourceKey;
  /** the bucket start (UTC midnight): the day, or the Monday of the week */
  bucket: number;
  capacity: number | null;
  /** hours of the project's own tasks in the bucket */
  booked: number;
  /** hours of the other projects */
  foreign: number;
  /** hours above the capacity (null capacity: booked + foreign) */
  over: number;
  /** the tasks of this project that have load in the bucket */
  tasks: string[];
  /** set on an unresolved conflict */
  code?: UnresolvedCode;
}

export interface LevelingSchedule {
  rows: Record<string, PMScheduledRow>;
  projectStartMs: number;
  projectFinishMs: number;
}

/** what the engine needs from the application (the scheduler, the calendars, the capacity) */
export interface LevelingEnv {
  /** the plan for these leveling delays (task GUID -> working days away from the anchor); wraps scheduleProject */
  schedule: (delays: Record<string, number>) => LevelingSchedule;
  /** the active days (UTC midnights) of the task in [startMs, finishMs) in the calendar that POST uses; the hours of a line are spread over them */
  activeDays: (task: string, startMs: number, finishMs: number) => number[];
  /** where the task would stand `extra` more working days away from the anchor than `row` (extra > 0 = later when forward, earlier when backward) */
  place: (task: string, row: PMScheduledRow, extra: number) => { startMs: number; finishMs: number };
  /** hours the calendar of the resource allows on the day; null/undefined = the calendar has no row (unknown, never guessed) */
  capacity: (resource: ResourceKey, dayMs: number) => number | null | undefined;
  /** hours the OTHER projects (posted) hold on the day */
  foreign: (resource: ResourceKey, dayMs: number) => number;
  /** the last day the capacity is known for (the search never goes beyond it) and, backward, the first */
  horizon: { firstDayMs: number; lastDayMs: number };
}

export interface LevelingOptions {
  order: LevelingOrder;
  method: LevelingMethod;
  direction: LevelingDirection;
  /** 'day' (hour and day: one working day is the finest period the plan has) | 'week' (Monday to Sunday) */
  period: 'day' | 'week';
  /** start from no delays (resourceLevelingClearBeforeLeveling) or keep the delays already in `startDelays` */
  startDelays?: Record<string, number>;
  /** safety: passes (each pass = a scan of all conflicts + one recalculation of the plan) */
  maxPasses?: number;
}

export interface LevelingResult {
  delays: Record<string, number>;
  moves: LevelingMove[];
  /** conflicts that are still there, with the reason */
  unresolved: LevelingConflict[];
  /** the conflicts of the starting plan (before) */
  before: LevelingConflict[];
  /** the plan with the final delays */
  schedule: LevelingSchedule;
  /** the plan the run started from (delays cleared or `startDelays`) */
  baseline: LevelingSchedule;
  passes: number;
  /** tasks that are posted and were moved/should be moved: the caller asks the user (7.7) */
  postedMoved: string[];
}

export const DEFAULT_PRIORITY = 500;
export const NEVER_LEVEL_PRIORITY = 1000;

/** the priority of a task row (Extended A15): 0..1000, default 500 */
export const priorityOf = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== null && v !== '' && v !== undefined ? Math.min(1000, Math.max(0, n)) : DEFAULT_PRIORITY;
};
