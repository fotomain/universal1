// A2 Project calculation Automatic | Manual (MS Project Calculation Options) - the pure part. documentation/MORE_GANTT_ProjectCalculationAutomaticOrManual.html
//
// In MANUAL mode the plan on the screen (store.schedule) is the last CALCULATED one. To know what changed since, the store keeps the INPUT SIGNATURE of that
// calculation: every field of the tasks, the links and the project row that the scheduler reads. After each refresh the new signature is compared with it:
//   a task row whose inputs differ  -> PENDING (its own provisional dates are shown, nothing else moves)
//   a moved / deleted task, a changed link, a changed project setting -> STRUCTURAL pending (counted, no single row)
// A field the scheduler does not read (name, notes, colors, % complete, custom columns, Kanban) is NOT part of the signature - it never makes a plan "not calculated".
// Keep taskInputsOf() equal to what scheduleProject() reads (a test lists both).
import type { PMProjectRow, PMScheduledRow, PMTaskDependencyRow, PMTaskRow } from './types';
import { constraintOf } from './taskConstraint';
import { manualStartOf, taskModeOf } from './taskScheduleMode';
import { scheduleOptionsOf } from './scheduleOptions';
import { extendedOf } from '../extended/extendedModel';
import { extendedOptionsOf } from '../extended/extendedOptions';
import { addWorkDays, nextWorkDay, PMCalendar, utcMidnight } from '../view/project/scheduling';

export interface PMCalcSignature {
  /** per task: the inputs of the scheduler */
  tasks: Record<string, string>;
  /** per task: where it stands in the tree (moves) */
  place: Record<string, string>;
  /** the links */
  deps: string[];
  /** the project settings the scheduler reads */
  project: string;
}

/** the scheduler inputs of ONE task row, as a string */
export function taskInputsOf(t: PMTaskRow): string {
  const j: any = t.rowJSON || {};
  return [
    j.rowKind ?? '',
    j.durationDays ?? '',
    j.manualStartAt ?? '',
    j.taskScheduleMode ?? '',
    j.taskManualStartAt ?? '',
    j.taskConstraintType ?? '',
    j.taskConstraintDate ?? '',
    j.taskIsSubproject === true ? 1 : 0,
    j.taskInactive === true ? 1 : 0,
    j.taskCalendarId ?? '',
    j.durationElapsed === true ? 1 : 0,
    j.taskDeadline ?? '',
    JSON.stringify(j.taskSplits ?? ''),
    JSON.stringify(j.externalPredecessors ?? ''),
  ].join('|');
}

export function projectInputsOf(project: PMProjectRow | undefined | null): string {
  const j: any = project?.rowJSON || {};
  const o = scheduleOptionsOf(j);
  const opt = extendedOptionsOf(j);
  return [
    j.projectStartAt ?? '',
    j.skipWeekends ? 1 : 0,
    JSON.stringify(extendedOf(j)),
    opt.constraintsAlwaysHonored ? 1 : 0,
    JSON.stringify(opt.calendars),
    opt.projectCalendarId ?? '',
    o.scheduleFrom,
    o.projectFinishDayMs ?? '',
  ].join('|');
}

export function signatureOf(tasks: PMTaskRow[], deps: PMTaskDependencyRow[], project: PMProjectRow | undefined | null): PMCalcSignature {
  const t: Record<string, string> = {};
  const place: Record<string, string> = {};
  for (const x of tasks) {
    t[x.rowGUID] = taskInputsOf(x);
    place[x.rowGUID] = `${x.treePath}|${x.orderInList}`;
  }
  return {
    tasks: t,
    place,
    deps: deps.map((d) => `${d.rowDependsOnGUID}>${d.rowGUID}|${d.linkType || 'FS'}|${Number(d.lagDays) || 0}|${(d.rowJSON as any)?.lagPercent ?? ''}`).sort(),
    project: projectInputsOf(project),
  };
}

export interface PMPending {
  /** tasks whose own inputs changed (or new tasks) */
  guids: Record<string, true>;
  /** moved / deleted tasks, changed links, changed project settings */
  structure: number;
}

export const NO_PENDING: PMPending = Object.freeze({ guids: Object.freeze({}) as Record<string, true>, structure: 0 }) as PMPending;

export function pendingOf(prev: PMCalcSignature, next: PMCalcSignature): PMPending {
  const guids: Record<string, true> = {};
  let structure = 0;
  for (const g of Object.keys(next.tasks)) {
    if (prev.tasks[g] === undefined || prev.tasks[g] !== next.tasks[g]) guids[g] = true;
    if (prev.place[g] !== undefined && prev.place[g] !== next.place[g]) structure++;
  }
  for (const g of Object.keys(prev.tasks)) if (next.tasks[g] === undefined) structure++;
  const prevDeps = new Set(prev.deps);
  const nextDeps = new Set(next.deps);
  for (const d of nextDeps) if (!prevDeps.has(d)) structure++;
  for (const d of prevDeps) if (!nextDeps.has(d)) structure++;
  if (prev.project !== next.project) structure++;
  return { guids, structure };
}

export const pendingCountOf = (p: PMPending): number => Object.keys(p.guids).length + p.structure;

/**
 * The row shown for a task that was edited (or created) after the last calculation: its OWN dates from its OWN inputs - no links, no roll-up.
 *   start = the manual start of a manual task; else the later of its frozen start and its Start No Earlier Than; else the frozen start; else the project start
 *   finish = start + its duration in the project calendar
 */
export function provisionalRowOf(task: PMTaskRow, projectStartMs: number, cal: PMCalendar, frozen: PMScheduledRow | undefined, project: PMProjectRow | undefined | null): PMScheduledRow {
  const o = scheduleOptionsOf(project?.rowJSON);
  const json: any = task.rowJSON || {};
  const kind = json.rowKind;
  const dur = kind === 'milestone' ? 0 : Math.max(kind === 'stage' ? 1 : 0, Math.round(Number(json.durationDays ?? 1)) || 0);
  const manual = taskModeOf(json, o.manualEnabled) === 'manual' ? manualStartOf(json) : null;
  const con = constraintOf(json, o.constraintsEnabled && json.taskIsSubproject !== true);
  let start = frozen?.startMs ?? projectStartMs;
  if (manual !== null) start = utcMidnight(manual);
  else if (con.dateMs !== null && (con.type === 'SNET' || con.type === 'MSO')) start = con.type === 'MSO' ? con.dateMs : Math.max(start, con.dateMs);
  start = nextWorkDay(start, cal);
  const finish = json.durationElapsed === true && o.elapsedEnabled ? start + dur * 86400000 : addWorkDays(start, dur, cal);
  const progress = Math.min(100, Math.max(0, Number(task.rowProgress) || 0));
  return {
    startAt: new Date(start).toISOString(),
    finishAt: new Date(finish).toISOString(),
    startMs: start,
    finishMs: finish,
    durationDays: dur,
    isSummary: kind === 'stage',
    isMilestone: dur === 0 && kind !== 'stage',
    progress,
    totalFloatDays: frozen?.totalFloatDays ?? 0,
    isCritical: frozen?.isCritical ?? false,
    inCycle: false,
    slackDays: frozen?.slackDays ?? 0,
    ...(manual !== null ? { isManual: true } : {}),
  };
}
