// Critical path task color (uxuiSettings.criticalPathTaskColor, saved per project and user in
// project_user_settings_table). Chosen with ColorPickerApp (Gantt settings -> Task tab): any '#RRGGBB'.
// No imports -> safe to use from model/types.ts and view/theme.ts.

/** Quick swatches offered by the picker: 9 colors + black. Any other '#RRGGBB' is allowed too (Custom). */
export const PM_CRITICAL_PATH_TASK_COLORS = ['#FCFF00', '#FFAA00', '#FF5500', '#00FF66', '#00F0FF', '#4455FF', '#9D00FF', '#FF007F', '#FF0033', '#000000'];

/** Default critical path color (red of the set). */
export const PM_DEFAULT_CRITICAL_PATH_TASK_COLOR = '#FF0033';

/** A saved color -> upper-case '#RRGGBB' ('#abc' and '#RRGGBBAA' are normalized); invalid / missing -> the default. */
export function criticalPathTaskColorOf(value: unknown): string {
  if (typeof value !== 'string') return PM_DEFAULT_CRITICAL_PATH_TASK_COLOR;
  let v = value.trim().toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (/^#[0-9A-F]{8}$/.test(v)) v = v.slice(0, 7);
  return /^#[0-9A-F]{6}$/.test(v) ? v : PM_DEFAULT_CRITICAL_PATH_TASK_COLOR;
}

/** Very dark colors (e.g. black) have no darker shade for the progress part of a critical bar. */
export function isVeryDarkColor(hex: string): boolean {
  const m = /^#([0-9A-F]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 40;
}
