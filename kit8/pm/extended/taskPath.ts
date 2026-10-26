// B7 Task path and B6 Task inspector (pure).
//   taskPathOf   which rows are the predecessors / DRIVING predecessors / successors / DRIVEN successors of a task (MS Project: Format > Task Path)
//   inspectTask  the sentences that explain why a task starts on its date (MS Project: Task Inspector)
// A link DRIVES its successor when it is the one that decides its start: the start the link alone would give is the start the successor has.
import { PMCalendar, shiftWorkDays, nextWorkDay, subtractWorkDays } from '../view/project/scheduling';
import type { PMScheduledRow, PMTaskDependencyRow, PMTaskRow } from '../model/types';
import { PM_CONSTRAINT_LABELS, constraintOf } from '../model/taskConstraint';

export type PMTaskPathRole = 'self' | 'predecessor' | 'drivingPredecessor' | 'successor' | 'drivenSuccessor';

/** the start the link alone would give the successor (before its own constraints) */
export function linkStartOf(dep: Pick<PMTaskDependencyRow, 'linkType' | 'lagDays'>, pred: PMScheduledRow, succDurationDays: number, cal: PMCalendar): number {
  const lag = Number(dep.lagDays) || 0;
  switch (dep.linkType || 'FS') {
    case 'SS': return nextWorkDay(shiftWorkDays(pred.startMs, lag, cal), cal);
    case 'FF': return nextWorkDay(subtractWorkDays(shiftWorkDays(pred.finishMs, lag, cal), succDurationDays, cal), cal);
    case 'SF': return nextWorkDay(subtractWorkDays(shiftWorkDays(pred.startMs, lag, cal), succDurationDays, cal), cal);
    default: return nextWorkDay(shiftWorkDays(pred.finishMs, lag, cal), cal);
  }
}

/** the links whose start equals the start of the successor (the driving ones) */
export function drivingLinksOf(succ: string, deps: PMTaskDependencyRow[], schedule: Record<string, PMScheduledRow>, cal: PMCalendar): PMTaskDependencyRow[] {
  const s = schedule[succ];
  if (!s) return [];
  return deps.filter((d) => {
    if (d.rowGUID !== succ) return false;
    const p = schedule[d.rowDependsOnGUID];
    return !!p && linkStartOf(d, p, s.durationDays, cal) === s.startMs;
  });
}

export function taskPathOf(guid: string, deps: PMTaskDependencyRow[], schedule: Record<string, PMScheduledRow>, cal: PMCalendar): Record<string, PMTaskPathRole> {
  const out: Record<string, PMTaskPathRole> = { [guid]: 'self' };
  const preds = new Map<string, PMTaskDependencyRow[]>();
  const succs = new Map<string, PMTaskDependencyRow[]>();
  for (const d of deps) {
    (preds.get(d.rowGUID) ?? preds.set(d.rowGUID, []).get(d.rowGUID)!).push(d);
    (succs.get(d.rowDependsOnGUID) ?? succs.set(d.rowDependsOnGUID, []).get(d.rowDependsOnGUID)!).push(d);
  }
  const walk = (start: string, next: (g: string) => PMTaskDependencyRow[], pick: (d: PMTaskDependencyRow) => string, driving: (d: PMTaskDependencyRow) => boolean, plain: PMTaskPathRole, drv: PMTaskPathRole) => {
    const seen = new Set<string>([start]);
    // two passes: all rows are plain; the driving chain is marked again
    const queue = [start];
    while (queue.length) {
      const g = queue.shift()!;
      for (const d of next(g)) {
        const other = pick(d);
        if (seen.has(other)) continue;
        seen.add(other);
        out[other] = plain;
        queue.push(other);
      }
    }
    const dq = [start];
    const dseen = new Set<string>([start]);
    while (dq.length) {
      const g = dq.shift()!;
      for (const d of next(g)) {
        if (!driving(d)) continue;
        const other = pick(d);
        if (dseen.has(other)) continue;
        dseen.add(other);
        out[other] = drv;
        dq.push(other);
      }
    }
  };
  const isDriving = (d: PMTaskDependencyRow) => drivingLinksOf(d.rowGUID, deps, schedule, cal).some((x) => x.rowDependsOnGUID === d.rowDependsOnGUID);
  walk(guid, (g) => preds.get(g) ?? [], (d) => d.rowDependsOnGUID, isDriving, 'predecessor', 'drivingPredecessor');
  walk(guid, (g) => succs.get(g) ?? [], (d) => d.rowGUID, isDriving, 'successor', 'drivenSuccessor');
  return out;
}

export interface PMInspectorLine { kind: 'info' | 'warning' | 'driver'; text: string }

/** why the task starts where it starts */
export function inspectTask(opts: {
  task: PMTaskRow;
  row: PMScheduledRow;
  deps: PMTaskDependencyRow[];
  schedule: Record<string, PMScheduledRow>;
  tasksById: Record<string, PMTaskRow>;
  cal: PMCalendar;
  projectStartMs: number;
  constraintsEnabled: boolean;
  fmt: (ms: number) => string;
}): PMInspectorLine[] {
  const { task, row, deps, schedule, tasksById, cal, fmt } = opts;
  const lines: PMInspectorLine[] = [];
  const name = (g: string) => tasksById[g]?.rowJSON?.taskDescription || g;
  if (row.isInactive) { lines.push({ kind: 'info', text: 'The task is inactive: it is not part of the schedule, nothing depends on its dates.' }); return lines; }
  if (row.isManual) {
    lines.push({ kind: 'driver', text: `The task is scheduled manually: it starts on ${fmt(row.startMs)} because you typed that date.` });
    if (row.constraintConflict && row.engineStartMs !== undefined) lines.push({ kind: 'warning', text: `A predecessor would start it on ${fmt(row.engineStartMs)}. Move the task or its predecessor, or schedule it automatically.` });
  } else {
    const driving = drivingLinksOf(task.rowGUID, deps, schedule, cal);
    const c = constraintOf(task.rowJSON, opts.constraintsEnabled);
    if (driving.length) {
      for (const d of driving) lines.push({ kind: 'driver', text: `Driven by "${name(d.rowDependsOnGUID)}" (${d.linkType || 'FS'}${Number(d.lagDays) ? ` ${Number(d.lagDays) > 0 ? '+' : ''}${d.lagDays}d` : ''}): its dates put this task at ${fmt(row.startMs)}.` });
    } else if (!c.implicit && c.dateMs !== null && (c.type === 'SNET' || c.type === 'MSO' || c.type === 'MFO' || c.type === 'FNET')) {
      lines.push({ kind: 'driver', text: `${PM_CONSTRAINT_LABELS[c.type]} ${fmt(c.dateMs)} puts the task at ${fmt(row.startMs)}.` });
    } else if (row.startMs === opts.projectStartMs) {
      lines.push({ kind: 'driver', text: `No link holds the task: it starts with the project on ${fmt(row.startMs)}.` });
    } else {
      lines.push({ kind: 'info', text: `The task starts on ${fmt(row.startMs)}.` });
    }
    if (row.constraintConflict) {
      const kindText = row.constraintConflict === 'constraintWins' ? 'The constraint date was kept although' : 'The links won: the constraint is not met because';
      lines.push({ kind: 'warning', text: `${kindText} a link would start the task on ${row.engineStartMs !== undefined ? fmt(row.engineStartMs) : 'a later date'}.` });
    }
  }
  const slack = row.slackDays ?? row.totalFloatDays;
  lines.push({ kind: slack < 0 ? 'warning' : 'info', text: slack < 0 ? `Negative slack ${slack} d: the task finishes later than its successors or the project allow.` : row.isCritical ? 'The task is on the critical path (no slack).' : `Slack: ${slack} d.` });
  if (row.deadlineMs !== undefined) lines.push({ kind: row.deadlineMissed ? 'warning' : 'info', text: row.deadlineMissed ? `The finish is after the deadline ${fmt(row.deadlineMs)}.` : `Deadline ${fmt(row.deadlineMs)} is met.` });
  return lines;
}
