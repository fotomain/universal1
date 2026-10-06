// Pure helpers of DateInputApp (no React): text <-> local Date.

const pad2 = (n: number) => String(n).padStart(2, '0');

const valid = (y: number, m: number, d: number): Date | null => {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
};

/** YYYY-MM-DD · YYYY.MM.DD · YYYY/MM/DD · DD.MM.YYYY · DD/MM/YYYY · DD-MM-YYYY -> local Date (null = not a date). */
export function defaultParseDateInput(text: string): Date | null {
  const s = (text || '').trim();
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(s);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(s);
  if (m) return valid(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

/** local Date -> YYYY-MM-DD */
export function defaultFormatDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** UTC-midnight ms (the PM module's dates) -> the same calendar day as a local Date for the picker. */
export function utcDayToLocalDate(ms: number): Date {
  const d = new Date(ms);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** picked local Date -> UTC midnight ms of the same calendar day. */
export function localDateToUtcDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}
