// What a bar drag / resize writes into the rowJSON of a task (pure, unit-tested): the mode of the task and the project's Extended functions decide.
//   manual task (A1)                       -> its own start (taskManualStartAt); a manual bar stays where it is dropped
//   auto task, constraints on (A3), Must Start On / Must Finish On -> the date moves with the bar and the type stays
//   auto task, constraints on, project planned from its FINISH date (A4) -> Finish No Later Than at the dropped finish (what MS Project does)
//   auto task, constraints on, any other type -> Start No Earlier Than at the dropped start
//   auto task, constraints off (the default) -> manualStartAt = Start No Earlier Than, exactly as before
import { DAY_MS } from '../../model/constants';
import { constraintOf, constraintPatch } from '../../model/taskConstraint';
import { patchManualStart } from '../../model/taskScheduleMode';
import type { PMTaskJSON } from '../../model/types';

export type PMBarEditKind = 'move' | 'resize-start' | 'resize-end';

export interface PMBarEdit {
  mode: PMBarEditKind;
  /** the start and the EXCLUSIVE finish the bar has after the drag */
  startMs: number;
  finishMs: number;
  durationDays: number;
}

export interface PMBarEditContext {
  manual: boolean;
  constraintsEnabled: boolean;
  fromFinish: boolean;
}

export function barEditJSON(json: PMTaskJSON, edit: PMBarEdit, ctx: PMBarEditContext): PMTaskJSON {
  if (edit.mode === 'resize-end') return { ...json, durationDays: edit.durationDays };
  const base: PMTaskJSON = edit.mode === 'resize-start' ? { ...json, durationDays: edit.durationDays } : { ...json };
  if (ctx.manual) return patchManualStart(base, edit.startMs);
  if (!ctx.constraintsEnabled) return { ...base, manualStartAt: new Date(edit.startMs).toISOString() };
  const lastDay = json.rowKind === 'milestone' ? edit.startMs : Math.max(edit.startMs, edit.finishMs - DAY_MS);
  const type = constraintOf(json, true).type;
  if (type === 'MSO') return constraintPatch(base, 'MSO', edit.startMs);
  if (type === 'MFO') return constraintPatch(base, 'MFO', lastDay);
  if (ctx.fromFinish) return constraintPatch(base, 'FNLT', lastDay);
  return constraintPatch(base, 'SNET', edit.startMs);
}
