// AppleMacUI design tokens (iOS look and feel on iOS / Android / web). Pure data - no React.
// Source: Apple Human Interface Guidelines (color, typography, layout) - system colors of iOS, Dynamic Type "Large"
// (default) text styles, 4 pt grid, 44 pt minimum touch target.
// Components read ONLY these tokens (through useAppleMacUI()); no component hard-codes a color or a size.

import { Platform } from 'react-native';

export interface AppleMacUIColors {
  systemBlue: string;
  systemGreen: string;
  systemRed: string;
  systemOrange: string;
  systemYellow: string;
  systemGray: string;
  systemGray2: string;
  systemGray3: string;
  systemGray4: string;
  systemGray5: string;
  systemGray6: string;
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  placeholderText: string;
  systemBackground: string;
  secondarySystemBackground: string;
  tertiarySystemBackground: string;
  systemGroupedBackground: string;
  secondarySystemGroupedBackground: string;
  separator: string;
  opaqueSeparator: string;
  /** thin fill behind controls (gray button, segmented track, text field in a plain context) */
  fill: string;
  secondaryFill: string;
  tertiaryFill: string;
  /** dimming behind sheets */
  backdrop: string;
  /** text on a filled (tinted) control */
  onTint: string;
  /** the selected segment / switch thumb */
  elevatedControl: string;
  shadow: string;
}

export interface AppleMacUITextStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '600' | '700';
  letterSpacing: number;
}

export type AppleMacUITextStyleName = 'largeTitle' | 'title1' | 'title2' | 'title3' | 'headline' | 'body' | 'callout' | 'subhead' | 'footnote' | 'caption1' | 'caption2';

export interface AppleMacUITheme {
  name: 'light' | 'dark';
  dark: boolean;
  /** the app's tint (accent) color: systemBlue unless the app overrides it */
  tint: string;
  colors: AppleMacUIColors;
  /** continuous-corner feel: inputs 10, buttons 12-14, cards / grouped lists 12, sheets 20+ */
  radii: { xs: number; input: number; buttonSmall: number; button: number; buttonLarge: number; card: number; sheet: number; pill: number };
  /** 4 pt grid */
  space: { 0: number; 1: number; 2: number; 3: number; 4: number; 5: number; 6: number; 8: number; 10: number };
  size: { touchTarget: number; controlSmall: number; controlMedium: number; controlLarge: number; listRow: number; hairline: number; grabberWidth: number; grabberHeight: number; switchWidth: number; switchHeight: number; switchThumb: number; segmented: number; icon: number };
  typography: Record<AppleMacUITextStyleName, AppleMacUITextStyle>;
  fontFamily: string | undefined;
  motion: { pressScale: number; pressOpacity: number; spring: { damping: number; stiffness: number; mass: number }; sheetSpring: { damping: number; stiffness: number; mass: number }; durationShort: number };
  /** web focus ring */
  focusRing: { width: number; color: string };
}

/** -apple-system / SF Pro on iOS and web, Roboto on Android (undefined = the platform's system font = SF on iOS). */
export const APPLE_MAC_UI_FONT_FAMILY: string | undefined = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Roboto, Arial, sans-serif',
  android: 'Roboto',
  default: undefined,
});

// iOS Dynamic Type, size "Large" (the default): point size / leading / weight / tracking
const typography: AppleMacUITheme['typography'] = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '400', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '400', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '400', letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '400', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.07 },
};

const shared = {
  radii: { xs: 6, input: 10, buttonSmall: 12, button: 12, buttonLarge: 14, card: 12, sheet: 20, pill: 999 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 },
  size: { touchTarget: 44, controlSmall: 32, controlMedium: 44, controlLarge: 50, listRow: 44, hairline: 0.5, grabberWidth: 36, grabberHeight: 5, switchWidth: 51, switchHeight: 31, switchThumb: 27, segmented: 32, icon: 20 },
  typography,
  fontFamily: APPLE_MAC_UI_FONT_FAMILY,
  motion: { pressScale: 0.97, pressOpacity: 0.75, spring: { damping: 18, stiffness: 320, mass: 0.6 }, sheetSpring: { damping: 28, stiffness: 300, mass: 0.9 }, durationShort: 200 },
} as const;

export const appleMacUILightTheme: AppleMacUITheme = {
  ...shared,
  name: 'light',
  dark: false,
  tint: '#007AFF',
  colors: {
    systemBlue: '#007AFF',
    systemGreen: '#34C759',
    systemRed: '#FF3B30',
    systemOrange: '#FF9500',
    systemYellow: '#FFCC00',
    systemGray: '#8E8E93',
    systemGray2: '#AEAEB2',
    systemGray3: '#C7C7CC',
    systemGray4: '#D1D1D6',
    systemGray5: '#E5E5EA',
    systemGray6: '#F2F2F7',
    label: '#000000',
    secondaryLabel: 'rgba(60,60,67,0.6)',
    tertiaryLabel: 'rgba(60,60,67,0.3)',
    placeholderText: 'rgba(60,60,67,0.3)',
    systemBackground: '#FFFFFF',
    secondarySystemBackground: '#F2F2F7',
    tertiarySystemBackground: '#FFFFFF',
    systemGroupedBackground: '#F2F2F7',
    secondarySystemGroupedBackground: '#FFFFFF',
    separator: 'rgba(60,60,67,0.29)',
    opaqueSeparator: '#C6C6C8',
    fill: 'rgba(120,120,128,0.2)',
    secondaryFill: 'rgba(120,120,128,0.16)',
    tertiaryFill: 'rgba(118,118,128,0.12)',
    backdrop: 'rgba(0,0,0,0.4)',
    onTint: '#FFFFFF',
    elevatedControl: '#FFFFFF',
    shadow: 'rgba(0,0,0,0.12)',
  },
  focusRing: { width: 3, color: 'rgba(0,122,255,0.45)' },
};

export const appleMacUIDarkTheme: AppleMacUITheme = {
  ...shared,
  name: 'dark',
  dark: true,
  tint: '#0A84FF',
  colors: {
    systemBlue: '#0A84FF',
    systemGreen: '#30D158',
    systemRed: '#FF453A',
    systemOrange: '#FF9F0A',
    systemYellow: '#FFD60A',
    systemGray: '#8E8E93',
    systemGray2: '#636366',
    systemGray3: '#48484A',
    systemGray4: '#3A3A3C',
    systemGray5: '#2C2C2E',
    systemGray6: '#1C1C1E',
    label: '#FFFFFF',
    secondaryLabel: 'rgba(235,235,245,0.6)',
    tertiaryLabel: 'rgba(235,235,245,0.3)',
    placeholderText: 'rgba(235,235,245,0.3)',
    systemBackground: '#000000',
    secondarySystemBackground: '#1C1C1E',
    tertiarySystemBackground: '#2C2C2E',
    systemGroupedBackground: '#000000',
    secondarySystemGroupedBackground: '#1C1C1E',
    separator: 'rgba(84,84,88,0.6)',
    opaqueSeparator: '#38383A',
    fill: 'rgba(120,120,128,0.36)',
    secondaryFill: 'rgba(120,120,128,0.32)',
    tertiaryFill: 'rgba(118,118,128,0.24)',
    backdrop: 'rgba(0,0,0,0.55)',
    onTint: '#FFFFFF',
    elevatedControl: '#636366',
    shadow: 'rgba(0,0,0,0.5)',
  },
  focusRing: { width: 3, color: 'rgba(10,132,255,0.55)' },
};

/** light + dark: <WithAppleMacUI theme={appleMacUITheme}> picks the one for the current mode */
export const appleMacUITheme = { light: appleMacUILightTheme, dark: appleMacUIDarkTheme } as const;
export type AppleMacUIThemeSet = { light: AppleMacUITheme; dark: AppleMacUITheme };

/** "rgba(…)"/"#RRGGBB" tint with another alpha: the tinted button's background (tint at 15 %) */
export function appleMacUIAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** The 7 colors every kit8 component reads (useDesignSystem().themeColors) in AppleMacUI terms. */
export function appleMacUIThemeColors(t: AppleMacUITheme) {
  return {
    primary: t.tint,
    background: t.colors.systemGroupedBackground,
    surface: t.colors.secondarySystemGroupedBackground,
    text: t.colors.label,
    border: t.colors.opaqueSeparator,
    error: t.colors.systemRed,
    card: t.colors.secondarySystemGroupedBackground,
  };
}
