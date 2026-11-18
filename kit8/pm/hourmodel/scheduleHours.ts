// scheduleHours - the scheduler of the time-of-day model (documentation/RESOURCE_LEVELING_HOURS_WBS.html section 4.4). Pure: no React / Supabase.
//
// It does NOT duplicate the day scheduler: the plan is moved onto the working-minute axis (hourAxis.ts), where ONE VIRTUAL DAY IS ONE WORKING MINUTE and every virtual day is a working day,
// scheduleProject runs there unchanged (links, lags, stages, forward / backward pass, float, cycles), and the result is mapped back to real instants. So the two models cannot drift:
//   task duration   taskDurationMinutes (else durationDays x the working minutes of a day)        -> virtual days
//   lag of a link   lagDays x the working minutes of a day                                         -> virtual days
//   leveling delay  taskLevelingDelayMinutes                                                       -> virtual days (taskLevelingDelayDays of the day scheduler)
//   start time      taskStartMinute: the task starts on its scheduled day NOT BEFORE that minute (a pin that is found in a few passes)
//   legacy start    manualStartAt (Start No Earlier Than): the start of that day's first window
// Not in this model (the plan says so, nothing is guessed): constraints other than the legacy Start No Earlier Than, split / elapsed / task calendars, planning from the finish, external predecessors.
import { DAY_MS } from '../model/constants';
import type { PMScheduledRow, PMTaskDependencyRow, PMTaskJSON, PMTaskRow } from '../model/types';
import type { PMScheduleOptions } from '../model/scheduleOptions';
import { scheduleProject } from '../view/project/scheduling';
import type { HourAxis, AxisPiece } from './hourAxis';
import { MINUTE_MS } from './hourAxis';
import { wholeMinutesOf } from './minutes';

export interface HourScheduledRow extends PMScheduledRow {
  /** the position on the working-minute axis: [startWm, finishWm) */
  startWm: number;
  finishWm: number;
  /** the duration in working minutes */
  durationMinutes: number;
  /** the real pieces of the bar (a break between two windows splits it) */
  pieces: AxisPiece[];
  /** the total float in working minutes (totalFloatDays is the same in days of the calendar) */
  totalFloatMinutes: number;
}

export interface HourScheduleInput {
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
  projectStartMs: number;
  axis: HourAxis;
  /** the Extended scheduling options of the project (scheduleOptionsOf); the ones the hour model does not know are switched off here */
  options?: Partial<PMScheduleOptions>;
  /** the leveling delays to use INSTEAD of the stored ones (task GUID -> working minutes) */
  levelingDelaysMinutes?: Record<string, number>;
  /** honor the leveling delays (resourceLevelingFunctionalityEnabled) */
  levelingEnabled?: boolean;
}

export interface HourScheduleResult {
  rows: Record<string, HourScheduledRow>;
  projectStartMs: number;
  projectFinishMs: number;
  projectStartWm: number;
  projectFinishWm: number;
  cycleGUIDs: string[];
  projectStartInPast?: boolean;
}

const MAX_PIN_PASSES = 8;

/** the duration of a task in working minutes: its own, else the days of the day model in working minutes of a day */
export function durationMinutesOf(task: PMTaskRow, axis: HourAxis): number {
  const j = (task.rowJSON || {}) as PMTaskJSON;
  if (j.rowKind === 'milestone') return 0;
  const own = wholeMinutesOf(j.taskDurationMinutes);
  if (own !== null && own > 0) return own;
  const d = Math.round(Number(j.durationDays ?? 1));
  const days = Number.isFinite(d) && d > 0 ? d : 0;
  return days * axis.dayMinutes;
}

const virtualIso = (wm: number): string => new Date(wm * DAY_MS).toISOString();

export function scheduleProjectHours(input: HourScheduleInput): HourScheduleResult {
  const { axis } = input;
  const W = axis.dayMinutes;
  const opt = input.options ?? {};
  const startWm = axis.workMinuteAt(input.projectStartMs);

  // ---- the plan on the virtual axis (one virtual day = one working minute) -------------------------------------------------------------------------------------------------
  const pins = new Map<string, number>(); // task -> the working minute it may not start before (taskStartMinute)
  const virtualTasks = (): PMTaskRow[] => input.tasks.map((t) => {
    const j = { ...((t.rowJSON || {}) as PMTaskJSON) };
    j.durationDays = durationMinutesOf(t, axis);
    const delay = input.levelingDelaysMinutes ? input.levelingDelaysMinutes[t.rowGUID] : wholeMinutesOf(j.taskLevelingDelayMinutes);
    j.taskLevelingDelayDays = delay && delay > 0 ? delay : null;
    const legacy = typeof j.manualStartAt === 'string' && j.manualStartAt ? Date.parse(j.manualStartAt) : NaN;
    let pinWm = Number.isFinite(legacy) ? axis.workMinuteAt(Math.floor(legacy / DAY_MS) * DAY_MS) : null;
    const pin = pins.get(t.rowGUID);
    if (pin !== undefined) pinWm = pinWm === null ? pin : Math.max(pinWm, pin);
    j.manualStartAt = pinWm === null ? null : virtualIso(pinWm);
    if (typeof j.taskManualStartAt === 'string' && j.taskManualStartAt) {
      const m = Date.parse(j.taskManualStartAt);
      if (Number.isFinite(m)) j.taskManualStartAt = virtualIso(axis.workMinuteAt(m));
    }
    return { ...t, rowJSON: j };
  });
  const virtualDeps = (): PMTaskDependencyRow[] => input.deps.map((d) => ({ ...d, lagDays: (Number(d.lagDays) || 0) * W }));

  const run = () => scheduleProject({
    tasks: virtualTasks(), deps: virtualDeps(), projectStartMs: startWm * DAY_MS, calendar: { skipWeekends: false },
    manualEnabled: opt.manualEnabled === true, constraintsEnabled: false, constraintsAlwaysHonored: opt.constraintsAlwaysHonored,
    scheduleFrom: 'start', projectFinishDayMs: null, splitEnabled: false, inactiveEnabled: opt.inactiveEnabled === true, elapsedEnabled: false, deadlineEnabled: false,
    lagPercentEnabled: opt.lagPercentEnabled === true, externalEnabled: false,
    levelingEnabled: input.levelingEnabled === true, levelingManualTasks: opt.levelingManualTasks === true,
    ...(input.levelingDelaysMinutes ? { levelingDelays: input.levelingDelaysMinutes } : {}),
  });

  let result = run();
  // taskStartMinute: not before that clock time on the day the plan gives the task; a pin raises the start, so a few passes settle it
  const timed = input.tasks.filter((t) => wholeMinutesOf((t.rowJSON as PMTaskJSON)?.taskStartMinute) !== null);
  for (let pass = 0; pass < MAX_PIN_PASSES && timed.length > 0; pass++) {
    let changed = false;
    for (const t of timed) {
      const row = result.rows[t.rowGUID];
      if (!row || row.isSummary) continue;
      const sw = Math.round(row.startMs / DAY_MS);
      const at = axis.startInstant(sw);
      const day = Math.floor(at / DAY_MS) * DAY_MS;
      const minute = wholeMinutesOf((t.rowJSON as PMTaskJSON).taskStartMinute)!;
      const target = axis.workMinuteAt(day + Math.min(1439, minute) * MINUTE_MS);
      if (target > sw && target > (pins.get(t.rowGUID) ?? -1)) { pins.set(t.rowGUID, target); changed = true; }
    }
    if (!changed) break;
    result = run();
  }

  // ---- back to real instants ------------------------------------------------------------------------------------------------------------------------------------------------
  const real = (v: number, kind: 'start' | 'finish'): number => {
    const wm = Math.round(v / DAY_MS);
    return kind === 'start' ? axis.startInstant(wm) : axis.endInstant(wm);
  };
  const rows: Record<string, HourScheduledRow> = {};
  for (const [guid, r] of Object.entries(result.rows)) {
    const sWm = Math.round(r.startMs / DAY_MS);
    const fWm = Math.max(sWm, Math.round(r.finishMs / DAY_MS));
    const startMs = axis.startInstant(sWm);
    const finishMs = fWm > sWm ? axis.endInstant(fWm) : startMs;
    const mapMs = (v: number | undefined, kind: 'start' | 'finish') => (v === undefined ? undefined : real(v, kind));
    const out: HourScheduledRow = {
      ...r,
      startMs, finishMs, startAt: new Date(startMs).toISOString(), finishAt: new Date(finishMs).toISOString(),
      startWm: sWm, finishWm: fWm, durationMinutes: fWm - sWm, pieces: axis.pieces(sWm, fWm),
      durationDays: (fWm - sWm) / W, totalFloatMinutes: r.totalFloatDays, totalFloatDays: r.totalFloatDays / W,
      slackDays: r.slackDays === undefined ? undefined : r.slackDays / W,
      levelingDelayDays: r.levelingDelayDays === undefined ? undefined : r.levelingDelayDays / W,
      earlyStartMs: mapMs(r.earlyStartMs, 'start'), lateStartMs: mapMs(r.lateStartMs, 'start'), engineStartMs: mapMs(r.engineStartMs, 'start'),
    };
    rows[guid] = out;
  }
  const projectStartWm = Math.round(result.projectStartMs / DAY_MS);
  const projectFinishWm = Math.max(projectStartWm, Math.round(result.projectFinishMs / DAY_MS));
  return {
    rows, projectStartMs: axis.startInstant(projectStartWm), projectFinishMs: projectFinishWm > projectStartWm ? axis.endInstant(projectFinishWm) : axis.startInstant(projectStartWm),
    projectStartWm, projectFinishWm, cycleGUIDs: result.cycleGUIDs,
  };
}
