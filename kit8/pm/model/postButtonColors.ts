// Post button color (uxuiSettings.postButtonBackgroundColor, saved per project and user in project_user_settings_table): the background of the
// Post button of the task line table (ReusableTable postDataNeeded). Chosen with ColorPickerApp (Gantt settings -> Task tab): any '#RRGGBB'.
// No imports -> safe to use from model/types.ts.

/** Default: light fuchsia. */
export const PM_DEFAULT_POST_BUTTON_COLOR = '#F0ABFC';

/** Quick swatches offered by the picker (light colors: the button text stays dark). Any other '#RRGGBB' is allowed too (Custom). */
export const PM_POST_BUTTON_COLORS = ['#F0ABFC', '#F9A8D4', '#FDBA74', '#FDE047', '#86EFAC', '#67E8F9', '#93C5FD', '#C4B5FD', '#E5E7EB'];

/** A saved color -> upper-case '#RRGGBB' ('#abc' and '#RRGGBBAA' are normalized); invalid / missing -> the default. */
export function postButtonColorOf(value: unknown): string {
  if (typeof value !== 'string') return PM_DEFAULT_POST_BUTTON_COLOR;
  let v = value.trim().toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (/^#[0-9A-F]{8}$/.test(v)) v = v.slice(0, 7);
  return /^#[0-9A-F]{6}$/.test(v) ? v : PM_DEFAULT_POST_BUTTON_COLOR;
}

/** black or white text for a '#RRGGBB' background (the light default gets dark text) */
export function textColorOnBackground(hex: string): string {
  const m = /^#([0-9A-F]{6})$/i.exec(hex);
  if (!m) return '#1F2937';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#1F2937' : '#FFFFFF';
}
