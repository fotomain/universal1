// E7 Project summary row (pure): the numbers of the whole project from the scheduled rows - start, finish, duration, progress, counts.
import type { PMScheduledRow } from '../model/types';

export interface PMProjectSummary {
  startMs: number;
  finishMs: number;
  /** calendar days from start to finish (finish is exclusive) */
  spanDays: number;
  /** progress 0..100, weighted by the duration of the tasks */
  progress: number;
  tasks: number;
  milestones: number;
  critical: number;
  done: number;
  late: number;
}

const DAY = 86400000;

/** the summary of the rows (the stages are not counted: their dates come from the tasks); null when there is no task. `statusMs` marks the late tasks */
export function projectSummaryOf(rows: PMScheduledRow[], statusMs: number): PMProjectSummary | null {
  const leaves = rows.filter((r) => !r.isSummary && !r.isInactive);
  if (leaves.length === 0) return null;
  let start = Infinity;
  let finish = -Infinity;
  let weight = 0;
  let done = 0;
  let late = 0;
  let milestones = 0;
  let critical = 0;
  let progressSum = 0;
  for (const r of leaves) {
    start = Math.min(start, r.startMs);
    finish = Math.max(finish, r.finishMs);
    const w = r.isMilestone ? 0 : Math.max(1, r.durationDays);
    weight += w;
    progressSum += w * r.progress;
    if (r.isMilestone) milestones++;
    if (r.isCritical) critical++;
    if (r.progress >= 100) done++;
    else if (r.finishMs - DAY <= statusMs || r.deadlineMissed === true) late++;
  }
  return {
    startMs: start,
    finishMs: finish,
    spanDays: Math.max(1, Math.round((finish - start) / DAY)),
    progress: weight > 0 ? Math.round(progressSum / weight) : leaves.every((r) => r.progress >= 100) ? 100 : 0,
    tasks: leaves.length - milestones,
    milestones,
    critical,
    done,
    late,
  };
}
