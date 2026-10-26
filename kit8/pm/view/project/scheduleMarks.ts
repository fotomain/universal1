// The marks of the "Schedule" (indicators) column of the task tree (pure): which row shows an icon and what its tip says. (E11 Indicators column + the warnings of A1 / A2 / A3)
//   warning   a manual start / a constraint that a link would not meet (the date won), or a constraint the links did not meet (the link won, negative slack) (A1 / A3)
//   pending   Manual calculation: the row was edited and the plan is not calculated yet (A2)
//   deadline  the finish is after the deadline (A5)       inactive  an inactive task (A14)      estimate  an estimated duration (A9)
//   push_pin  a manually scheduled task (A1)               lock  a constraint other than As Soon As Possible / Start No Earlier Than (A3)
//   link      a predecessor in another project (B5)        notes  the task has notes (E11)
// No mark = no column: a project that uses none of the functions looks exactly as before.
import type { PMScheduledRow, PMTaskRow } from '../../model/types';
import { constraintOf, PM_CONSTRAINT_LABELS } from '../../model/taskConstraint';

export interface PMScheduleMark {
  icon: 'warning' | 'pending' | 'push_pin' | 'lock' | 'flag' | 'block' | 'help' | 'public' | 'notes';
  /** dark orange: a date and a link disagree / the deadline is missed */
  conflict: boolean;
  tip: string;
}

export function scheduleMarksOf(
  schedule: Record<string, PMScheduledRow>,
  tasksById: Record<string, PMTaskRow>,
  pendingGUIDs: Record<string, true>,
  fmt: (ms: number) => string,
  flags: Record<string, boolean>
): Record<string, PMScheduleMark> {
  const out: Record<string, PMScheduleMark> = {};
  for (const guid of Object.keys(schedule)) {
    const r = schedule[guid];
    const t = tasksById[guid];
    if (!r || !t) continue;
    const j: any = t.rowJSON ?? {};
    if (r.isSummary) continue;
    const eng = r.engineStartMs !== undefined ? fmt(r.engineStartMs) : '';
    if (r.isInactive && flags.ganttInactiveTasksEnabled) { out[guid] = { icon: 'block', conflict: false, tip: 'Inactive task: it is shown but is not part of the schedule.' }; continue; }
    if (r.constraintConflict && (flags.ganttManualSchedulingEnabled || flags.ganttConstraintsEnabled)) {
      let tip: string;
      if (r.isManual) tip = `Manually scheduled: starts on ${fmt(r.startMs)}. A predecessor would start it on ${eng}.`;
      else {
        const c = constraintOf(t.rowJSON, true);
        const what = `${PM_CONSTRAINT_LABELS[c.type]}${c.dateMs !== null ? ' ' + fmt(c.dateMs) : ''}`;
        tip = r.constraintConflict === 'constraintWins'
          ? `${what}: kept although a link would start the task on ${eng}.`
          : `${what} is not met: the links start the task on ${eng}${(r.slackDays ?? 0) < 0 ? ` (slack ${r.slackDays} d)` : ''}.`;
      }
      out[guid] = { icon: 'warning', conflict: true, tip };
    } else if (r.deadlineMissed && flags.ganttDeadlineEnabled) {
      out[guid] = { icon: 'flag', conflict: true, tip: `The finish is after the deadline ${r.deadlineMs !== undefined ? fmt(r.deadlineMs) : ''}.` };
    } else if (pendingGUIDs[guid] && flags.ganttCalculationModeEnabled) {
      out[guid] = { icon: 'pending', conflict: false, tip: 'Edited - the plan is not calculated yet. Press Calculate (F9): the dates of the other tasks do not follow this edit until then.' };
    } else if (r.isManual) {
      out[guid] = { icon: 'push_pin', conflict: false, tip: `Manually scheduled: starts on ${fmt(r.startMs)}; no link or calendar moves it.` };
    } else if (r.constraintType && r.constraintType !== 'ASAP' && r.constraintType !== 'SNET') {
      const c = constraintOf(t.rowJSON, true);
      out[guid] = { icon: 'lock', conflict: false, tip: `${PM_CONSTRAINT_LABELS[c.type]}${c.dateMs !== null ? ' ' + fmt(c.dateMs) : ''}` };
    } else if (flags.ganttEstimatedDurationEnabled && j.durationEstimated === true) {
      out[guid] = { icon: 'help', conflict: false, tip: 'The duration is an estimate (?).' };
    } else if (r.hasExternal) {
      out[guid] = { icon: 'public', conflict: false, tip: 'The task waits for a task of another project.' };
    } else if (flags.ganttIndicatorsColumnEnabled && typeof j.notes === 'string' && j.notes.trim()) {
      out[guid] = { icon: 'notes', conflict: false, tip: 'The task has notes.' };
    }
  }
  return out;
}
