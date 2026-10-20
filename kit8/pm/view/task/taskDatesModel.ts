// taskDatesModel - the START / FINISH dates of a task edited in the toolbar of the task window (TaskDatesBar), pure (no React, no store):
//   * which tasks can be edited here: a leaf task or a milestone in a project planned in DAYS (a stage / a task with children gets its dates from below, a task that follows its subproject
//     keeps the dates the database gave it, and with hours / minutes / seconds on the dates are edited in the task form)
//   * what a typed start / finish / a picked period writes: manualStartAt + durationDays of rowJSON, exactly as the task form does (finish = the last working day of the task, the duration
//     is the number of working days from the start to it)
import { utcMidnight, workDaysBetween, parseDateISO } from '../project/scheduling';
import { DAY_MS } from '../../model/constants';
import { parsePlanDate } from '../../model/planDateFormats';
import type { PMPlanDateInputFormat } from '../../model/types';

export interface TaskDatesInput {
  /** task.rowJSON (rowKind, durationDays, manualStartAt, taskIsSubproject, ...) */
  json: Record<string, any>;
  hasChildren: boolean;
  /** hours / minutes / seconds are on in the project */
  subDay: boolean;
  skipWeekends: boolean;
  format: PMPlanDateInputFormat;
}

/** null = the dates can be edited here; else why not (a short text for the tip) */
export function taskDatesReadOnlyReason(i: Pick<TaskDatesInput, 'json' | 'hasChildren' | 'subDay'>): string | null {
  if (i.hasChildren || i.json.rowKind === 'stage') return 'The dates of a stage come from its tasks';
  if (i.json.taskIsSubproject === true) return 'The dates of a subproject task follow the subproject';
  if (i.subDay) return 'Hours, minutes or seconds are on: edit the dates in the task form';
  return null;
}

/** a typed date (the project format or YYYY-MM-DD) -> the UTC day; null = not a date */
export const parseTaskDay = (text: string, format: PMPlanDateInputFormat): number | null => {
  const t = (text || '').trim();
  if (!t) return null;
  const ms = parseDateISO(t) ?? parsePlanDate(t, format);
  return ms === null || ms === undefined ? null : utcMidnight(ms);
};

export type TaskDatesPatch = { json: Record<string, any> } | { error: string } | null;

/**
 * The rowJSON patch of a change of the dates. `start` / `finish` = the typed texts (undefined = not changed); `startMs` = the start the task has now (schedule).
 * null = nothing to write (the same dates, or an unreadable text - the field shows it, nothing is saved).
 */
export function taskDatesPatch(i: TaskDatesInput, change: { start?: string; finish?: string }, currentStartMs: number | null): TaskDatesPatch {
  if (taskDatesReadOnlyReason(i)) return null;
  const milestone = i.json.rowKind === 'milestone';
  const newStart = change.start !== undefined ? parseTaskDay(change.start, i.format) : null;
  const newFinish = change.finish !== undefined ? parseTaskDay(change.finish, i.format) : null;
  if (change.start !== undefined && newStart === null) return null;
  if (change.finish !== undefined && newFinish === null) return null;
  const startMs = newStart ?? (currentStartMs === null ? null : utcMidnight(currentStartMs));
  const patch: Record<string, any> = {};
  if (newStart !== null) patch.manualStartAt = new Date(newStart).toISOString();
  if (newFinish !== null && !milestone) {
    if (startMs === null) return { error: 'Set the start date first' };
    const finishInstant = newFinish + DAY_MS;
    if (finishInstant <= startMs) return { error: 'Finish date cannot be before start date.' };
    const days = workDaysBetween(startMs, finishInstant, { skipWeekends: i.skipWeekends });
    if (days >= 1) patch.durationDays = days;
  }
  if (Object.keys(patch).length === 0) return null;
  const sameStart = patch.manualStartAt === undefined || patch.manualStartAt === (i.json.manualStartAt ?? null);
  const sameDays = patch.durationDays === undefined || patch.durationDays === i.json.durationDays;
  if (sameStart && sameDays) return null;
  return { json: patch };
}

/** a picked period (a range of months: first day .. last day) -> the patch (start AND finish at once) */
export function taskPeriodPatch(i: TaskDatesInput, period: { startDate: string; finishDate: string }, currentStartMs: number | null): TaskDatesPatch {
  return taskDatesPatch(i, { start: period.startDate, finish: period.finishDate }, currentStartMs);
}
