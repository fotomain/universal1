// hourModelSettings - the project settings of the time-of-day model (documentation/RESOURCE_LEVELING_HOURS_WBS.html section 3). Pure: no React / Supabase.
//   project_table.rowJSON
//     resourceOptimizationMode   'dayByDayModel' (default) | 'hourByHourModel'   (kit8/pm/resourceleveling/resourceLevelingSettings.ts)
//     resourceSlotMinutes        the step of the model: 1 | 5 | 10 | 15 (default) | 30 | 60 (typed start times, leveling moves, the axis of the load views; checks are exact to the minute)
//     projectWorkWindows         the daily working windows of the project calendar: [{ from: '08:00', to: '16:00' }, ...] (default one window 08:00-16:00)
//     projectTimeZone            IANA name of the zone the windows are wall-clock of (default 'UTC'); only Post writes real timestamps with it
// With the day model (the default) none of this is read: every function here answers "not active".
import { HOUR_BY_HOUR_MODEL_AVAILABLE } from '../resourceleveling/resourceLevelingSettings';
import { DEFAULT_WINDOWS, normalizeWindows } from './hourAxis';
import type { HourWindow } from './hourAxis';
import { formatClock, parseClock, slotMinutesOf } from './minutes';

type Json = Record<string, any> | null | undefined;

/** the keys of the time-of-day model next to the Resource optimization values (the settings tab edits both) */
export interface HourModelValues {
  projectTimeZone?: string;
  resourceSlotMinutes?: number;
  projectWorkWindows?: { from: string; to: string }[];
}

export interface HourModelSettings {
  /** the project plans by the clock */
  active: boolean;
  windows: HourWindow[];
  slotMinutes: number;
  timeZone: string;
}

export const DEFAULT_TIME_ZONE = 'UTC';

/** the effective settings of the time-of-day model of a project row */
export function hourModelOf(j: Json): HourModelSettings {
  const active = HOUR_BY_HOUR_MODEL_AVAILABLE && j?.resourceOptimizationMode === 'hourByHourModel';
  const tz = typeof j?.projectTimeZone === 'string' && j.projectTimeZone.trim() ? j.projectTimeZone.trim() : DEFAULT_TIME_ZONE;
  return { active, windows: normalizeWindows(j?.projectWorkWindows), slotMinutes: slotMinutesOf(j?.resourceSlotMinutes), timeZone: tz };
}

/** is the zone name known to the runtime (Intl)? */
export function timeZoneIsValid(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** the windows as they are stored ('HH:MM') */
export const windowsToJson = (windows: readonly HourWindow[]): { from: string; to: string }[] => windows.map((w) => ({ from: formatClock(w.from), to: formatClock(w.to) }));
export const DEFAULT_WINDOWS_JSON = windowsToJson(DEFAULT_WINDOWS);

/** the patch of the settings window when the user switches the model (the values that must exist in the model) */
export function hourModelSwitchPatch(to: 'dayByDayModel' | 'hourByHourModel', current: Json, deviceTimeZone?: string): Record<string, unknown> {
  if (to === 'dayByDayModel') return { resourceOptimizationMode: 'dayByDayModel' };
  const tz = typeof current?.projectTimeZone === 'string' && current.projectTimeZone ? current.projectTimeZone : deviceTimeZone && timeZoneIsValid(deviceTimeZone) ? deviceTimeZone : DEFAULT_TIME_ZONE;
  return {
    resourceOptimizationMode: 'hourByHourModel',
    projectTimeZone: tz,
    resourceSlotMinutes: slotMinutesOf(current?.resourceSlotMinutes),
    projectWorkWindows: current?.projectWorkWindows ?? DEFAULT_WINDOWS_JSON,
  };
}

/** "09:00-13:00, 14:00-18:00" -> windows; null = not valid (a part that is not from-to, an end before its start, overlap) */
export function parseWindowsText(text: string): HourWindow[] | null {
  const parts = String(text ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const out: HourWindow[] = [];
  for (const part of parts) {
    const m = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(part);
    if (!m) return null;
    const from = parseClock(m[1]);
    const to = parseClock(m[2]);
    if (from === null || to === null || to <= from) return null;
    out.push({ from, to });
  }
  out.sort((a, b) => a.from - b.from);
  for (let i = 1; i < out.length; i++) if (out[i].from < out[i - 1].to) return null;
  return out;
}

export const windowsToText = (windows: readonly HourWindow[]): string => windows.map((w) => `${formatClock(w.from)}-${formatClock(w.to)}`).join(', ');
