// A1 Manually scheduled tasks (MS Project "Task Mode") - pure, no React / store. documentation/MORE_GANTT_ManuallyScheduledTasks_WBS.html
//
//   project_task_table.rowJSON  taskScheduleMode     'auto' (default, absent) | 'manual'
//                               taskManualStartAt    the typed start of a manual task (ISO); the finish = start + durationDays in the task's calendar
// A manual task is never moved by a link, the calendar or the project start; its links stay (its finish still drives its successors).
// A stage (summary row) and a subproject task are always auto. `manualStartAt` stays the Start No Earlier Than of an AUTO task (taskConstraint.ts).
// On only with the Extended switch ganttManualSchedulingEnabled; the mode of a NEW task is the option newTasksManual.
import type { PMTaskJSON } from './types';

export type PMScheduleMode = 'auto' | 'manual';

const dayOf = (iso: unknown): number | null => {
  if (typeof iso !== 'string' || !iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

/** why the mode of this row cannot be changed (null = it can) */
export function taskModeReadOnlyReason(json: Partial<PMTaskJSON> | null | undefined, hasChildren: boolean): string | null {
  if (hasChildren || json?.rowKind === 'stage') return 'A stage takes its dates from its tasks';
  if (json?.taskIsSubproject === true) return 'The dates of a subproject task follow the subproject';
  return null;
}

/** the mode the scheduler uses for a row: manual only while the function is on, for a task / milestone that is not a stage or a subproject task and has a start */
export function taskModeOf(json: Partial<PMTaskJSON> | null | undefined, enabled: boolean, hasChildren = false): PMScheduleMode {
  if (!enabled || taskModeReadOnlyReason(json, hasChildren)) return 'auto';
  return json?.taskScheduleMode === 'manual' && dayOf(json?.taskManualStartAt) !== null ? 'manual' : 'auto';
}

/** the typed start of a manual task (ms) or null */
export const manualStartOf = (json: Partial<PMTaskJSON> | null | undefined): number | null => dayOf(json?.taskManualStartAt);

/**
 * The rowJSON after the user switched a task's mode.
 *  Auto -> Manual: keeps the dates the task has now (currentStartMs = its scheduled start).
 *  Manual -> Auto: forgets the manual start AND the Start No Earlier Than (the task returns to the position its links give).
 */
export function patchForMode(json: PMTaskJSON, mode: PMScheduleMode, currentStartMs: number | null): PMTaskJSON {
  const next: PMTaskJSON = { ...json };
  if (mode === 'manual') {
    const start = manualStartOf(json) ?? currentStartMs;
    next.taskScheduleMode = 'manual';
    if (start !== null) next.taskManualStartAt = new Date(start).toISOString();
    return next;
  }
  delete next.taskScheduleMode;
  delete next.taskManualStartAt;
  next.manualStartAt = null;
  return next;
}

/** what a typed start / a dropped bar writes into the rowJSON of a MANUAL task */
export function patchManualStart(json: PMTaskJSON, startMs: number): PMTaskJSON {
  return { ...json, taskScheduleMode: 'manual', taskManualStartAt: new Date(startMs).toISOString() };
}
