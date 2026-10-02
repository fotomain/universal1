// Pure comparison logic of project versions (no React / Supabase / Skia):
//   scheduleVersion()            dates of every row of a version (same CPM scheduler as the live project)
//   compareVersionWithCurrent()  what changed between a version and the live project
//   buildVersionOverlays()       what PMProjectGanttChart draws: one thin bar per (checked version, task)
//   versionStripGeometry()       where those thin bars sit inside a Gantt row

import { DAY_MS, PM_BAR_VPAD, PM_ROW_HEIGHT } from '../../model/constants';
import type { PMScheduledRow, PMTaskRow } from '../../model/types';
import { scheduleProject, todayUTC } from '../../view/project/scheduling';
import { assignVersionColors, PMProjectVersionRow, PMVersionData } from './versionTypes';

/** One row of a version on the time line. */
export interface PMVersionBar {
  startMs: number;
  finishMs: number;
  isMilestone: boolean;
  isSummary: boolean;
  progress: number;
  name: string;
}

export interface PMVersionOverlay {
  versionGUID: string;
  title: string;
  color: string;
  /** rowGUID (same ids as the live project) -> bar */
  bars: Record<string, PMVersionBar>;
  startMs: number;
  finishMs: number;
}

export function versionProjectStartMs(version: Pick<PMProjectVersionRow, 'rowJSON' | 'created_at'>): number {
  const parsed = version.rowJSON?.projectStartAt ? Date.parse(version.rowJSON.projectStartAt) : NaN;
  if (Number.isFinite(parsed)) return parsed;
  const created = version.created_at ? Date.parse(version.created_at) : NaN;
  return Number.isFinite(created) ? created : todayUTC();
}

/** Schedules the version's own tasks + dependencies with the version's own start date and calendar. */
export function scheduleVersion(version: PMProjectVersionRow, data: Pick<PMVersionData, 'tasks' | 'deps'>): { bars: Record<string, PMVersionBar>; startMs: number; finishMs: number } {
  const result = scheduleProject({
    tasks: data.tasks,
    deps: data.deps,
    projectStartMs: versionProjectStartMs(version),
    calendar: { skipWeekends: !!version.rowJSON?.skipWeekends },
  });
  const bars: Record<string, PMVersionBar> = {};
  for (const t of data.tasks) {
    const r: PMScheduledRow | undefined = result.rows[t.rowGUID];
    if (!r) continue;
    bars[t.rowGUID] = { startMs: r.startMs, finishMs: r.finishMs, isMilestone: r.isMilestone, isSummary: r.isSummary, progress: r.progress, name: t.rowJSON?.name || '' };
  }
  return { bars, startMs: result.projectStartMs, finishMs: result.projectFinishMs };
}

export interface PMVersionDiff {
  /** rows of the live project that the version does not have */
  added: number;
  /** rows of the version that the live project no longer has */
  removed: number;
  /** same row, other start or finish */
  moved: number;
  /** same row and dates, other name / duration / progress */
  changed: number;
  unchanged: number;
  /** live project finish - version finish, in days (+ = the project is later now) */
  finishDeltaDays: number;
}

const days = (ms: number) => Math.round(ms / DAY_MS);

export function compareVersionWithCurrent(
  versionBars: Record<string, PMVersionBar>,
  versionFinishMs: number,
  current: { schedule: Record<string, PMScheduledRow>; tasksById: Record<string, PMTaskRow>; projectFinishMs: number }
): PMVersionDiff {
  const diff: PMVersionDiff = { added: 0, removed: 0, moved: 0, changed: 0, unchanged: 0, finishDeltaDays: days(current.projectFinishMs - versionFinishMs) };
  for (const guid of Object.keys(current.tasksById)) {
    const now = current.schedule[guid];
    const was = versionBars[guid];
    if (!was) {
      diff.added++;
      continue;
    }
    if (!now) continue;
    if (now.startMs !== was.startMs || now.finishMs !== was.finishMs) diff.moved++;
    else if ((current.tasksById[guid].rowJSON?.name || '') !== was.name || Math.round(now.progress) !== Math.round(was.progress)) diff.changed++;
    else diff.unchanged++;
  }
  for (const guid of Object.keys(versionBars)) if (!current.tasksById[guid]) diff.removed++;
  return diff;
}

/** "+3 added · 1 removed · 4 moved · finish +5 d" ("No differences" when equal). */
export function describeVersionDiff(d: PMVersionDiff): string {
  const parts: string[] = [];
  if (d.added) parts.push(`${d.added} added`);
  if (d.removed) parts.push(`${d.removed} removed`);
  if (d.moved) parts.push(`${d.moved} moved`);
  if (d.changed) parts.push(`${d.changed} changed`);
  if (d.finishDeltaDays) parts.push(`finish ${d.finishDeltaDays > 0 ? '+' : ''}${d.finishDeltaDays} d`);
  return parts.length ? parts.join(' · ') : 'No differences';
}

/** Overlays of the checked versions whose data is loaded, in the order they were checked. */
export function buildVersionOverlays(
  checkedGUIDs: string[],
  versions: PMProjectVersionRow[],
  dataByVersion: Record<string, PMVersionData>,
  avoidColors: string[] = []
): PMVersionOverlay[] {
  const byGUID = new Map(versions.map((v) => [v.rowVersionGUID, v]));
  const present = checkedGUIDs.filter((g) => byGUID.has(g));
  const colors = assignVersionColors(present, avoidColors);
  const out: PMVersionOverlay[] = [];
  for (const g of present) {
    const version = byGUID.get(g)!;
    const data = dataByVersion[g];
    if (!data) continue;
    const s = scheduleVersion(version, data);
    out.push({ versionGUID: g, title: version.rowJSON.versionTitle, color: colors[g], bars: s.bars, startMs: s.startMs, finishMs: s.finishMs });
  }
  return out;
}

/** Earliest start / latest finish over all overlays (null = nothing to draw) - widens the Gantt time line. */
export function overlaysRange(overlays: PMVersionOverlay[]): { startMs: number; finishMs: number } | null {
  if (!overlays.length) return null;
  return { startMs: Math.min(...overlays.map((o) => o.startMs)), finishMs: Math.max(...overlays.map((o) => o.finishMs)) };
}

/**
 * Thin version bars are stacked from the bottom edge of a Gantt row upwards: version 0 is the lowest.
 * One version fits completely under the task bar; with more versions the strips get thinner.
 */
export function versionStripGeometry(count: number, index: number): { offsetY: number; height: number } {
  const n = Math.max(1, count);
  const height = n === 1 ? 4 : n === 2 ? 2.5 : 2;
  const gap = 1;
  const bottom = PM_ROW_HEIGHT - 1.5;
  return { offsetY: bottom - (index + 1) * height - index * gap, height };
}

/** Free space under a task bar (px) - version strips beyond it overlap the bar's lower edge. */
export const PM_VERSION_STRIP_FREE_SPACE = PM_BAR_VPAD - 1.5;
