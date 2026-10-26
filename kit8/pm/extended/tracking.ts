// C1 Baselines, C3 Actual dates, C5 Status date / Update project, C7 Progress lines (pure).
//   rowJSON.baselines["0".."10"] = { startAt, finishAt, durationDays }   saved by "Set baseline"
//   rowJSON.actualStartAt / actualFinishAt                               set when progress is entered (the first % = the actual start, 100 % = the actual finish), editable
import type { PMScheduledRow, PMTaskJSON, PMTaskRow } from '../model/types';

const DAY = 86400000;
const day = (ms: number) => Math.floor(ms / DAY) * DAY;

export interface PMBaseline { startMs: number; finishMs: number; durationDays: number }

/** baseline no. 0..10 of a task row, or null */
export function baselineOf(json: Partial<PMTaskJSON> | null | undefined, no: number): PMBaseline | null {
  const b = json?.baselines?.[String(no)];
  if (!b) return null;
  const s = Date.parse(b.startAt);
  const f = Date.parse(b.finishAt);
  return Number.isFinite(s) && Number.isFinite(f) ? { startMs: s, finishMs: f, durationDays: Number(b.durationDays) || 0 } : null;
}

/** the rowJSON patches of "Set baseline": the rows of `scope` (null = every row that has a schedule row) get baseline `no` = their dates now */
export function setBaselinePatches(tasks: PMTaskRow[], schedule: Record<string, PMScheduledRow>, no: number, scope: Set<string> | null): { rowGUID: string; rowJSON: PMTaskJSON }[] {
  const out: { rowGUID: string; rowJSON: PMTaskJSON }[] = [];
  for (const t of tasks) {
    const r = schedule[t.rowGUID];
    if (!r || (scope && !scope.has(t.rowGUID))) continue;
    const json = t.rowJSON as PMTaskJSON;
    out.push({
      rowGUID: t.rowGUID,
      rowJSON: { ...json, baselines: { ...(json.baselines ?? {}), [String(no)]: { startAt: new Date(r.startMs).toISOString(), finishAt: new Date(r.finishMs).toISOString(), durationDays: r.durationDays } } },
    });
  }
  return out;
}

/** variance in calendar days: plan - baseline (positive = later than the baseline) */
export function baselineVariance(row: PMScheduledRow, b: PMBaseline | null): { startDays: number; finishDays: number } | null {
  if (!b) return null;
  return { startDays: Math.round((row.startMs - b.startMs) / DAY), finishDays: Math.round((row.finishMs - b.finishMs) / DAY) };
}

/** the actual dates after the % complete changed (the first % sets the start, 100 % the finish; back to 0 clears them; a typed actual date is kept) */
export function actualPatchOnProgress(json: PMTaskJSON, oldPct: number, newPct: number, row: PMScheduledRow | undefined, nowMs: number): Pick<PMTaskJSON, 'actualStartAt' | 'actualFinishAt'> {
  let start = json.actualStartAt ?? null;
  let finish = json.actualFinishAt ?? null;
  if (newPct > 0 && !start) start = new Date(day(row?.startMs ?? nowMs)).toISOString();
  if (newPct >= 100 && !finish) finish = new Date(day(row ? row.finishMs - DAY : nowMs)).toISOString();
  if (newPct < 100 && oldPct >= 100) finish = null;
  if (newPct <= 0 && oldPct > 0) { start = null; finish = null; }
  return { actualStartAt: start, actualFinishAt: finish };
}

/** where the ACTUAL bar of a task is drawn: from the actual start to the actual finish (inclusive day), or - while in progress - the share of the planned length that is done */
export function actualBarOf(json: Partial<PMTaskJSON> | null | undefined, row: PMScheduledRow, progress: number, statusMs: number): { startMs: number; finishMs: number } | null {
  const s = json?.actualStartAt ? Date.parse(json.actualStartAt) : NaN;
  if (!Number.isFinite(s)) return null;
  const f = json?.actualFinishAt ? Date.parse(json.actualFinishAt) : NaN;
  if (Number.isFinite(f)) return { startMs: day(s), finishMs: day(f) + DAY };
  const len = Math.max(DAY, row.finishMs - row.startMs);
  return { startMs: day(s), finishMs: Math.max(day(s) + DAY, day(s) + Math.round((len * Math.max(0, Math.min(100, progress))) / 100 / DAY) * DAY) };
}

export const statusDateMsOf = (statusDate: string | null | undefined, todayMs: number): number => {
  const ms = statusDate ? Date.parse(`${statusDate}T00:00:00Z`) : NaN;
  return Number.isFinite(ms) ? ms : day(todayMs);
};

/** the % a task should have reached at the status date by its dates (0..100, by calendar days) */
export function expectedPercent(row: PMScheduledRow, statusMs: number): number {
  if (row.isMilestone || row.finishMs <= row.startMs) return statusMs >= row.startMs ? 100 : 0;
  if (statusMs <= row.startMs) return 0;
  if (statusMs >= row.finishMs) return 100;
  return Math.round(((statusMs - row.startMs) / (row.finishMs - row.startMs)) * 100);
}

/** "Mark work complete through the status date": the new % of every leaf that is behind its dates (never lowers a %) */
export function markCompletePatches(tasks: PMTaskRow[], schedule: Record<string, PMScheduledRow>, statusMs: number): { rowGUID: string; progress: number }[] {
  const out: { rowGUID: string; progress: number }[] = [];
  for (const t of tasks) {
    const r = schedule[t.rowGUID];
    if (!r || r.isSummary || r.isInactive) continue;
    const want = expectedPercent(r, statusMs);
    if (want > Math.round(t.rowProgress || 0)) out.push({ rowGUID: t.rowGUID, progress: want });
  }
  return out;
}

/** "Reschedule uncompleted work": a task that has not started (0 %) and should have started before the status date gets Start No Earlier Than = the status date */
export function rescheduleUncompletedPatches(tasks: PMTaskRow[], schedule: Record<string, PMScheduledRow>, statusMs: number): { rowGUID: string; manualStartAt: string }[] {
  const out: { rowGUID: string; manualStartAt: string }[] = [];
  for (const t of tasks) {
    const r = schedule[t.rowGUID];
    if (!r || r.isSummary || r.isInactive || r.isManual) continue;
    if ((t.rowProgress || 0) <= 0 && r.startMs < statusMs) out.push({ rowGUID: t.rowGUID, manualStartAt: new Date(statusMs).toISOString() });
  }
  return out;
}

/**
 * C7 the PROGRESS LINE: for each row the x (ms) where the line passes.
 *   a task in progress: the point its % reaches on its own bar; finished: its finish; not started and due before the status date: its start (behind, left);
 *   not started and not yet due: the status date (on time); a task that is ahead (more % than expected) passes right of the status date.
 * The line bends left of the status date for tasks that are behind and right of it for tasks that are ahead.
 */
export function progressLineX(row: PMScheduledRow, progress: number, statusMs: number): number | null {
  if (row.isSummary || row.isInactive) return null;
  if (row.isMilestone) return progress >= 100 ? row.startMs : row.startMs <= statusMs ? row.startMs : statusMs;
  const len = row.finishMs - row.startMs;
  const p = Math.max(0, Math.min(100, progress));
  if (p >= 100) return row.finishMs > statusMs && row.startMs > statusMs ? row.finishMs : Math.max(statusMs, row.finishMs);
  if (p <= 0) return row.startMs < statusMs ? row.startMs : statusMs;
  return row.startMs + (len * p) / 100;
}
