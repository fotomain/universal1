// minutes - the minute arithmetic of the time-of-day model (documentation/RESOURCE_LEVELING_HOURS_WBS.html section 4.0). Pure: no React / Supabase.
// Every time value of the model is a WHOLE number of minutes: a duration (taskDurationMinutes), a start time of day (taskStartMinute, 0..1439), a leveling delay (taskLevelingDelayMinutes),
// the ends of a calendar window ('HH:MM'). Seconds do not exist: a typed 45s is rounded UP to a minute.

export type MinuteUnit = 'minute' | 'hour' | 'day';

export const DAY_MINUTES = 1440;

export interface ParsedMinutes {
  minutes: number;
  /** seconds were typed and rounded up to a whole minute */
  roundedUp: boolean;
}

/**
 * Text -> whole minutes. Accepts 90m, 1h30m, 1h 30m, 1.5h, 2d, 45s, 1d4h and a bare number (in `defaultUnit`). `dayMinutes` = the working minutes of a day (a typed "d").
 * null = not a duration (empty, text, negative, zero is allowed = 0).
 */
export function parseMinutes(text: string, defaultUnit: MinuteUnit = 'minute', dayMinutes = 480): ParsedMinutes | null {
  const s = String(text ?? '').trim().toLowerCase().replace(/,/g, '.');
  if (!s) return null;
  const bare = /^(\d+(?:\.\d+)?)$/.exec(s);
  if (bare) {
    const per = defaultUnit === 'day' ? dayMinutes : defaultUnit === 'hour' ? 60 : 1;
    return finish(parseFloat(bare[1]) * per, false);
  }
  const re = /(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)/y;
  let total = 0;
  let seconds = 0;
  let pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) return null;
    const v = parseFloat(m[1]);
    const u = m[2][0];
    if (u === 'd') total += v * dayMinutes;
    else if (u === 'h') total += v * 60;
    else if (u === 'm') total += v;
    else seconds += v;
    pos = re.lastIndex;
    while (pos < s.length && s[pos] === ' ') pos++;
  }
  return finish(total + seconds / 60, seconds > 0);
}

function finish(minutes: number, hadSeconds: boolean): ParsedMinutes | null {
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  const whole = Math.max(0, Math.ceil(minutes - 1e-9)) + 0;
  return { minutes: whole, roundedUp: hadSeconds || Math.abs(minutes - whole) > 1e-9 };
}

/** 90 -> "1h 30m", 45 -> "45m", 120 -> "2h", 0 -> "0" */
export function formatMinutes(minutes: number): string {
  const n = Math.max(0, Math.round(Number(minutes) || 0));
  if (n === 0) return '0';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
}

/** minutes of the day -> "09:15" (1440 -> "24:00") */
export function formatClock(minuteOfDay: number): string {
  const n = Math.max(0, Math.min(DAY_MINUTES, Math.round(Number(minuteOfDay) || 0)));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

/** "09:15" -> 555; "24:00" -> 1440; anything else (also seconds) -> null */
export function parseClock(text: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

/** a whole number of minutes >= 0 or null (the trigger of the database refuses the same values) */
export const wholeMinutesOf = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : null;
};

/** the allowed steps of the model (resourceSlotMinutes) */
export const SLOT_MINUTE_CHOICES = [1, 5, 10, 15, 30, 60] as const;
export const DEFAULT_SLOT_MINUTES = 15;
export const slotMinutesOf = (v: unknown): number => {
  const n = Math.round(Number(v));
  return (SLOT_MINUTE_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_SLOT_MINUTES;
};

export const ceilToStep = (minutes: number, step: number): number => Math.ceil((minutes - 1e-9) / step) * step;

/** a floating wall-clock instant (ms) as "2026-10-05 14:30" (the date and the time of the project, no zone) */
export function formatInstant(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
