// Plan date and duration formats and conversion helpers for PM scheduling.
// Supports:
//   planDateInputFormat: 'DD MMM' | 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'HH:MM:SS' | 'MM:SS' | 'YYYY-MM-DD'
//   plan units: planDay, planHour, planMinute, planSecond

import { DAY_MS } from './constants';

export type PMPlanDateInputFormat =
  | 'DD MMM'
  | 'DD.MM.YYYY'
  | 'MM/DD/YYYY'
  | 'DD/MM/YYYY'
  | 'HH:MM:SS'
  | 'MM:SS'
  | 'YYYY-MM-DD';

export const PM_PLAN_DATE_INPUT_FORMATS: readonly PMPlanDateInputFormat[] = [
  'DD MMM',
  'DD.MM.YYYY',
  'MM/DD/YYYY',
  'DD/MM/YYYY',
  'HH:MM:SS',
  'MM:SS',
  'YYYY-MM-DD',
] as const;

export const PM_DEFAULT_PLAN_DATE_INPUT_FORMAT: PMPlanDateInputFormat = 'YYYY-MM-DD';

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const MONTH_INDEX_BY_NAME: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function pad2(n: number): string {
  return String(Math.floor(Math.abs(n))).padStart(2, '0');
}

/** Formats a timestamp (ms) into a string using the selected planDateInputFormat. */
export function formatPlanDate(ms: number, format: PMPlanDateInputFormat = PM_DEFAULT_PLAN_DATE_INPUT_FORMAT): string {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  switch (format) {
    case 'DD MMM':
      return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
    case 'DD.MM.YYYY':
      return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
    case 'MM/DD/YYYY':
      return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}/${d.getUTCFullYear()}`;
    case 'DD/MM/YYYY':
      return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    case 'HH:MM:SS':
      return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
    case 'MM:SS':
      return `${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
    case 'YYYY-MM-DD':
    default:
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
}

/**
 * Parses user input date text into UTC ms according to format.
 * Falls back to other standard patterns (e.g. YYYY-MM-DD or DD.MM.YYYY) if format doesn't match directly.
 */
export function parsePlanDate(
  text: string,
  format: PMPlanDateInputFormat = PM_DEFAULT_PLAN_DATE_INPUT_FORMAT,
  referenceMs?: number
): number | null {
  const s = (text || '').trim();
  if (!s) return null;

  const refDate = referenceMs ? new Date(referenceMs) : new Date();
  const refYear = refDate.getUTCFullYear();
  const refMidnight = Math.floor((referenceMs ?? Date.now()) / DAY_MS) * DAY_MS;

  // 1. Try preferred format
  switch (format) {
    case 'YYYY-MM-DD': {
      const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
      if (m) {
        const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
        if (mo >= 0 && mo <= 11 && d >= 1 && d <= 31) return Date.UTC(y, mo, d);
      }
      break;
    }
    case 'DD MMM': {
      const m = /^(\d{1,2})\s+([A-Za-z]{3,})(?:\s+(\d{4}))?$/.exec(s);
      if (m) {
        const d = Number(m[1]);
        const moName = m[2].slice(0, 3).toLowerCase();
        const mo = MONTH_INDEX_BY_NAME[moName];
        const y = m[3] ? Number(m[3]) : refYear;
        if (mo !== undefined && d >= 1 && d <= 31) return Date.UTC(y, mo, d);
      }
      break;
    }
    case 'DD.MM.YYYY': {
      const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
      if (m) {
        const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3]);
        if (mo >= 0 && mo <= 11 && d >= 1 && d <= 31) return Date.UTC(y, mo, d);
      }
      break;
    }
    case 'MM/DD/YYYY': {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
      if (m) {
        const mo = Number(m[1]) - 1, d = Number(m[2]), y = Number(m[3]);
        if (mo >= 0 && mo <= 11 && d >= 1 && d <= 31) return Date.UTC(y, mo, d);
      }
      break;
    }
    case 'DD/MM/YYYY': {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
      if (m) {
        const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3]);
        if (mo >= 0 && mo <= 11 && d >= 1 && d <= 31) return Date.UTC(y, mo, d);
      }
      break;
    }
    case 'HH:MM:SS': {
      const m = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(s);
      if (m) {
        const h = Number(m[1]), mi = Number(m[2]), sec = Number(m[3]);
        if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59 && sec >= 0 && sec <= 59) {
          return refMidnight + h * 3600000 + mi * 60000 + sec * 1000;
        }
      }
      break;
    }
    case 'MM:SS': {
      const m = /^(\d{1,2}):(\d{1,2})$/.exec(s);
      if (m) {
        const mi = Number(m[1]), sec = Number(m[2]);
        if (mi >= 0 && mi <= 59 && sec >= 0 && sec <= 59) {
          return refMidnight + mi * 60000 + sec * 1000;
        }
      }
      break;
    }
  }

  // 2. Fallbacks
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) {
    const y = Number(iso[1]), mo = Number(iso[2]) - 1, d = Number(iso[3]);
    if (mo >= 0 && mo <= 11 && d >= 1 && d <= 31) return Date.UTC(y, mo, d);
  }
  const dot = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (dot) {
    const d = Number(dot[1]), mo = Number(dot[2]) - 1, y = Number(dot[3]);
    if (mo >= 0 && mo <= 11 && d >= 1 && d <= 31) return Date.UTC(y, mo, d);
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) {
    const p1 = Number(slash[1]), p2 = Number(slash[2]), y = Number(slash[3]);
    const [mo, d] = format === 'MM/DD/YYYY' ? [p1 - 1, p2] : [p2 - 1, p1];
    if (mo >= 0 && mo <= 11 && d >= 1 && d <= 31) return Date.UTC(y, mo, d);
  }
  const ddMmm = /^(\d{1,2})\s+([A-Za-z]{3,})(?:\s+(\d{4}))?$/.exec(s);
  if (ddMmm) {
    const d = Number(ddMmm[1]);
    const moName = ddMmm[2].slice(0, 3).toLowerCase();
    const mo = MONTH_INDEX_BY_NAME[moName];
    const y = ddMmm[3] ? Number(ddMmm[3]) : refYear;
    if (mo !== undefined && d >= 1 && d <= 31) return Date.UTC(y, mo, d);
  }

  return null;
}

export interface PMPlanUnits {
  planDay?: boolean;
  planHour?: boolean;
  planMinute?: boolean;
  planSecond?: boolean;
}

/** Formats duration into string according to enabled planning units. */
export function formatPlanDuration(durationDays: number, units: PMPlanUnits = {}): string {
  const d = Number(durationDays);
  if (!Number.isFinite(d)) return '0';

  const { planDay = true, planHour = false, planMinute = false, planSecond = false } = units;

  if (planSecond && !planDay && !planHour && !planMinute) {
    return `${Math.round(d * 86400)}s`;
  }
  if (planMinute && !planDay && !planHour) {
    const mins = Math.round(d * 1440 * 10) / 10;
    return `${mins}m`;
  }
  if (planHour && !planDay) {
    const hrs = Math.round(d * 24 * 10) / 10;
    return `${hrs}h`;
  }

  // Default / planDay: show days
  const roundedDays = Math.round(d * 100) / 100;
  return String(roundedDays);
}

/** Parses duration text (which may contain 'd', 'h', 'm', 's' or raw number) into durationDays. */
export function parsePlanDuration(text: string, units: PMPlanUnits = {}): number | null {
  const s = (text || '').trim().toLowerCase();
  if (!s) return null;

  // Check explicit unit suffixes
  const matchWithUnit = /^([0-9]+(?:\.[0-9]+)?)\s*([a-z]+)?$/.exec(s);
  if (!matchWithUnit) return null;

  const val = parseFloat(matchWithUnit[1]);
  if (!Number.isFinite(val) || val <= 0) return null;

  const unit = matchWithUnit[2];
  if (unit) {
    if (unit === 'd' || unit === 'day' || unit === 'days') return val;
    if (unit === 'h' || unit === 'hr' || unit === 'hrs' || unit === 'hour' || unit === 'hours') return val / 24;
    if (unit === 'm' || unit === 'min' || unit === 'mins' || unit === 'minute' || unit === 'minutes') return val / 1440;
    if (unit === 's' || unit === 'sec' || unit === 'secs' || unit === 'second' || unit === 'seconds') return val / 86400;
    return null;
  }

  // Without unit suffix: use primary active unit
  const { planDay = true, planHour = false, planMinute = false, planSecond = false } = units;
  if (planSecond && !planDay && !planHour && !planMinute) return val / 86400;
  if (planMinute && !planDay && !planHour) return val / 1440;
  if (planHour && !planDay) return val / 24;
  return val; // default days
}
