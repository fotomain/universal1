// Color tokens for the Skia tree + chart, derived from the app design system so the
// Gantt follows light/dark mode and the user's theme primary color.

export interface PMPalette {
  background: string;
  surface: string;
  header: string;
  text: string;
  textMuted: string;
  textOnBar: string;
  grid: string;
  gridStrong: string;
  weekend: string;
  hover: string;
  selected: string;
  primary: string;
  bar: string;
  barProgress: string;
  summary: string;
  summaryProgress: string;
  milestone: string;
  critical: string;
  criticalProgress: string;
  link: string;
  linkActive: string;
  today: string;
  ghost: string;
  handle: string;
  error: string;
  border: string;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** '#rrggbb' + alpha -> 'rgba(...)'; non-hex colors are returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})` : color;
}

/** Mix a hex color toward black (amount < 0) or white (amount > 0). */
export function shade(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = rgb.map((c) => Math.round((t - c) * p + c));
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function makePMPalette(
  colors: { primary: string; background: string; surface: string; text: string; border: string; error: string },
  isDark: boolean
): PMPalette {
  const primary = colors.primary || '#6366f1';
  return {
    background: colors.background,
    surface: colors.surface,
    header: isDark ? shade(colors.surface || '#1e293b', 0.04) : shade(colors.background || '#f8fafc', -0.02),
    text: colors.text,
    textMuted: withAlpha(isDark ? '#cbd5e1' : '#475569', 0.9),
    textOnBar: '#ffffff',
    grid: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.07)',
    gridStrong: isDark ? 'rgba(148,163,184,0.30)' : 'rgba(15,23,42,0.16)',
    weekend: isDark ? 'rgba(148,163,184,0.07)' : 'rgba(15,23,42,0.035)',
    hover: withAlpha(primary, isDark ? 0.14 : 0.08),
    selected: withAlpha(primary, isDark ? 0.26 : 0.16),
    primary,
    bar: primary,
    barProgress: shade(primary, -0.35),
    summary: isDark ? '#64748b' : '#475569',
    summaryProgress: isDark ? '#cbd5e1' : '#1e293b',
    milestone: '#f59e0b',
    critical: '#ef4444',
    criticalProgress: '#991b1b',
    link: isDark ? 'rgba(203,213,225,0.75)' : 'rgba(51,65,85,0.7)',
    linkActive: primary,
    today: '#f97316',
    ghost: withAlpha(primary, 0.35),
    handle: isDark ? '#e2e8f0' : '#334155',
    error: colors.error,
    border: colors.border,
  };
}

/** Binary-search ellipsis so a label never overflows its tree column / bar. */
export function ellipsize(text: string, maxWidth: number, measure: (s: string) => number): string {
  if (maxWidth <= 8 || !text) return '';
  if (measure(text) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(text.slice(0, mid) + '…') <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + '…' : '';
}
