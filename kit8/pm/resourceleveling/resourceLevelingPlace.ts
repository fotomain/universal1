// resourceLevelingPlace - where a task would stand if it were moved `extra` more working days AWAY FROM THE ANCHOR of the plan (documentation/RESOURCE_LEVELING_WBS.html 7.3, 7.8).
// The same arithmetic the scheduler uses for the leveling delay (scheduling.ts: shiftWorkDays in the calendar of the task), so the engine's search and the scheduler agree.
// Pure: no React / Supabase.
import { DAY_MS } from '../model/constants';
import { addWorkDays, nextWorkDay, shiftWorkDays } from '../view/project/scheduling';
import type { PMCalendar } from '../view/project/scheduling';

export interface PlaceRow { startMs: number; finishMs: number; durationDays: number }

/**
 * forward (planned from the start): `extra` working days later; backward (planned from the finish): `extra` working days earlier.
 * `elapsed` (Extended A8) = the duration counts calendar days; `gapDays` = the working days of the user's splits (Extended A12) that the task holds.
 */
export function placeAway(row: PlaceRow, extra: number, cal: PMCalendar, forward: boolean, elapsed = false, gapDays = 0): { startMs: number; finishMs: number } {
  const moved = forward ? shiftWorkDays(row.startMs, extra, cal) : shiftWorkDays(row.startMs, -extra, cal);
  const startMs = elapsed ? Math.floor(moved / DAY_MS) * DAY_MS : nextWorkDay(moved, cal);
  const finishMs = elapsed ? startMs + row.durationDays * DAY_MS : addWorkDays(startMs, row.durationDays + gapDays, cal);
  return { startMs, finishMs };
}

/** the active days (UTC midnights) in [startMs, finishMs) for which `isActive` says yes: the days Post spreads the hours of a line over */
export function activeDaysBetween(startMs: number, finishMs: number, isActive: (dayMs: number) => boolean): number[] {
  const out: number[] = [];
  for (let d = Math.floor(startMs / DAY_MS) * DAY_MS; d < finishMs; d += DAY_MS) if (isActive(d)) out.push(d);
  return out;
}
