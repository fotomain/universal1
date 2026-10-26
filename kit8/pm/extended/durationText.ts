// A8 / A9 Duration units, elapsed time and the estimate mark (pure): "3d", "2w", "1mo", "4ed", "2ew", "6h", "3d?".
//   d  working days   w  weeks = 5 working days   mo  months = 20 working days   h  hours = 8 per working day (rounded up)
//   ed / ew / emo  ELAPSED calendar days (ew = 7 days, emo = 30 days): the calendar is ignored
//   a trailing "?" marks the duration as an estimate; a bare number is working days.
// The plan keeps the duration in days (durationDays) + the flags durationElapsed / durationEstimated of the task row.
export interface PMDurationText {
  days: number;
  elapsed: boolean;
  estimated: boolean;
}

const WORK: Record<string, number> = { d: 1, w: 5, mo: 20 };
const ELAPSED: Record<string, number> = { ed: 1, ew: 7, emo: 30 };

export function parseDurationText(text: string): PMDurationText | null {
  const t = (text || '').trim().toLowerCase().replace(',', '.');
  const m = /^(\d+(?:\.\d+)?)\s*(emo|ed|ew|mo|d|w|h)?\s*(\?)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] || 'd';
  if (!Number.isFinite(n)) return null;
  const estimated = m[3] === '?';
  if (unit === 'h') return { days: Math.ceil(n / 8), elapsed: false, estimated };
  if (unit in ELAPSED) return { days: Math.round(n * ELAPSED[unit]), elapsed: true, estimated };
  return { days: Math.round(n * WORK[unit]), elapsed: false, estimated };
}

/** "3d", "4ed", "10d?" - weeks / months only when the number divides evenly (a stable text) */
export function formatDurationText(days: number, opts: { elapsed?: boolean; estimated?: boolean } = {}): string {
  const d = Math.max(0, Math.round(days));
  const q = opts.estimated ? '?' : '';
  if (opts.elapsed) {
    if (d >= 30 && d % 30 === 0) return `${d / 30}emo${q}`;
    if (d >= 7 && d % 7 === 0) return `${d / 7}ew${q}`;
    return `${d}ed${q}`;
  }
  return `${d}d${q}`;
}
