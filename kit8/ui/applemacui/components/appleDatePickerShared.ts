// One API for AppleDatePicker on every platform + the pure text helpers.
import type { StyleProp, ViewStyle } from 'react-native';

export type AppleDatePickerMode = 'date' | 'time' | 'datetime';

export interface AppleDatePickerProps {
  value: Date | null | undefined;
  onChange: (value: Date) => void;
  mode?: AppleDatePickerMode;
  min?: Date;
  max?: Date;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** calendar locale (default 'en') */
  locale?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const p2 = (n: number) => String(n).padStart(2, '0');
/** local date -> "2026-10-06" */
export const toDateInputValue = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
/** local time -> "17:05" */
export const toTimeInputValue = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
/** value of <input type="date | time | datetime-local"> */
export function toInputValue(d: Date | null | undefined, mode: AppleDatePickerMode): string {
  if (!d || isNaN(d.getTime())) return '';
  return mode === 'date' ? toDateInputValue(d) : mode === 'time' ? toTimeInputValue(d) : `${toDateInputValue(d)}T${toTimeInputValue(d)}`;
}
/** text of the input -> Date (time mode keeps the day of `base`); null = not a date */
export function fromInputValue(text: string, mode: AppleDatePickerMode, base?: Date | null): Date | null {
  if (mode === 'time') {
    const m = /^(\d{1,2}):(\d{2})/.exec(text || '');
    if (!m) return null;
    const d = base && !isNaN(base.getTime()) ? new Date(base) : new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(text || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), 0, 0);
  return isNaN(d.getTime()) ? null : d;
}
export function clampDate(d: Date, min?: Date, max?: Date): Date {
  if (min && d < min) return new Date(min);
  if (max && d > max) return new Date(max);
  return d;
}
/** what the field shows */
export function formatPickerValue(d: Date | null | undefined, mode: AppleDatePickerMode): string {
  if (!d || isNaN(d.getTime())) return '';
  return mode === 'date' ? toDateInputValue(d) : mode === 'time' ? toTimeInputValue(d) : `${toDateInputValue(d)} ${toTimeInputValue(d)}`;
}
