// A3 Task constraints - the 8 MS Project constraint types (pure, no React / store). documentation/MORE_GANTT_The8ConstraintTypes.html
//
//   ASAP  As Soon As Possible      ALAP  As Late As Possible        (no date)
//   MSO   Must Start On            MFO   Must Finish On
//   SNET  Start No Earlier Than    SNLT  Start No Later Than
//   FNET  Finish No Earlier Than   FNLT  Finish No Later Than       (the date of a finish type is the LAST day of the task, inclusive)
//
// Stored in the rowJSON of project_task_table: taskConstraintType + taskConstraintDate. The old key `manualStartAt` stays the date of Start No Earlier Than
// (the inline Start cell, a bar drag and the subproject sync write it): constraintOf() reads it as SNET when no type is stored, and
// constraintPatch() writes both keys for SNET and clears manualStartAt for every other type.
// The function is on only with the Extended switch ganttConstraintsEnabled (kit8/pm/extended); "always honored" is the option constraintsAlwaysHonored (default true).
import type { PMTaskJSON } from './types';

export type PMConstraintType = 'ASAP' | 'ALAP' | 'MSO' | 'MFO' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT';

export const PM_CONSTRAINT_TYPES: PMConstraintType[] = ['ASAP', 'ALAP', 'MSO', 'MFO', 'SNET', 'SNLT', 'FNET', 'FNLT'];

export const PM_CONSTRAINT_LABELS: Record<PMConstraintType, string> = {
  ASAP: 'As Soon As Possible',
  ALAP: 'As Late As Possible',
  MSO: 'Must Start On',
  MFO: 'Must Finish On',
  SNET: 'Start No Earlier Than',
  SNLT: 'Start No Later Than',
  FNET: 'Finish No Earlier Than',
  FNLT: 'Finish No Later Than',
};

/** MS Project XML (MSPDI) Task/ConstraintType */
export const MSP_CONSTRAINT_TYPE: Record<PMConstraintType, number> = { ASAP: 0, ALAP: 1, MSO: 2, MFO: 3, SNET: 4, SNLT: 5, FNET: 6, FNLT: 7 };

const NO_DATE: PMConstraintType[] = ['ASAP', 'ALAP'];
/** a type that carries a date */
export const constraintHasDate = (t: PMConstraintType): boolean => !NO_DATE.includes(t);
/** a type whose date is a FINISH (the last day of the task) */
export const constraintIsFinish = (t: PMConstraintType): boolean => t === 'MFO' || t === 'FNET' || t === 'FNLT';

export const isConstraintType = (v: unknown): v is PMConstraintType => typeof v === 'string' && (PM_CONSTRAINT_TYPES as string[]).includes(v);

export interface PMConstraint {
  type: PMConstraintType;
  /** UTC midnight of the date (start day of a start type, LAST day of a finish type); null for ASAP / ALAP */
  dateMs: number | null;
  /** nothing is stored: the task has no constraint of its own (an old task, a new task) - ASAP when scheduled from the start, ALAP from the finish */
  implicit: boolean;
}

const dayOf = (iso: unknown): number | null => {
  if (typeof iso !== 'string' || !iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) * 86400000 : null;
};

/**
 * The constraint of a task row. Without the function (`enabled` false) only the old Start No Earlier Than (manualStartAt) is read.
 * A dated type without a valid date reads as ASAP.
 */
export function constraintOf(json: Partial<PMTaskJSON> | null | undefined, enabled: boolean): PMConstraint {
  const legacy = dayOf(json?.manualStartAt);
  if (enabled && isConstraintType(json?.taskConstraintType)) {
    const type = json!.taskConstraintType as PMConstraintType;
    if (!constraintHasDate(type)) return { type, dateMs: null, implicit: false };
    const d = dayOf(json?.taskConstraintDate) ?? (type === 'SNET' ? legacy : null);
    return d === null ? { type: 'ASAP', dateMs: null, implicit: false } : { type, dateMs: d, implicit: false };
  }
  if (legacy !== null) return { type: 'SNET', dateMs: legacy, implicit: false };
  return { type: 'ASAP', dateMs: null, implicit: true };
}

/**
 * The rowJSON after the user chose a constraint. SNET keeps the old key manualStartAt (mirror); every other type clears it.
 * `dateMs` is required for a dated type (the caller validates).
 */
export function constraintPatch(json: PMTaskJSON, type: PMConstraintType, dateMs: number | null): PMTaskJSON {
  const next: PMTaskJSON = { ...json };
  if (!constraintHasDate(type) || dateMs === null) {
    next.taskConstraintType = constraintHasDate(type) ? 'ASAP' : type;
    delete next.taskConstraintDate;
    next.manualStartAt = null;
    return next;
  }
  const iso = new Date(dateMs).toISOString();
  next.taskConstraintType = type;
  next.taskConstraintDate = iso;
  next.manualStartAt = type === 'SNET' ? iso : null;
  return next;
}

/** why the constraint of this row cannot be set (null = it can). A stage, a subproject task and a manually scheduled task have none. */
export function constraintReadOnlyReason(json: Partial<PMTaskJSON> | null | undefined, hasChildren: boolean, manualTask: boolean): string | null {
  if (hasChildren || json?.rowKind === 'stage') return 'A stage takes its dates from its tasks';
  if (json?.taskIsSubproject === true) return 'The dates of a subproject task follow the subproject';
  if (manualTask) return 'A manually scheduled task has no constraint';
  return null;
}
