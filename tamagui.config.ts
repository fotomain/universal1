// tamagui.config.ts - Base Tamagui configuration file
// AppleMacUI: the iOS design tokens live in kit8/applemacui/appleMacUITheme.ts (one source); they are published here as the
// themes apple_light / apple_dark and the token groups appleColor / appleRadius / appleSpace / appleSize / appleFont.
import { appleMacUIDarkTheme, appleMacUILightTheme, APPLE_MAC_UI_FONT_FAMILY } from './kit8/applemacui/appleMacUITheme';

const appleTheme = (t: typeof appleMacUILightTheme) => ({
  bg: t.colors.systemBackground,
  color: t.colors.label,
  primary: t.tint,
  secondary: t.colors.secondaryLabel,
  accent: t.colors.systemGreen,
  cardBg: t.colors.secondarySystemGroupedBackground,
  borderColor: t.colors.separator,
  inputBg: t.colors.tertiaryFill,
  placeholder: t.colors.placeholderText,
  ...t.colors,
});

export const tamaguiConfig = {
  themes: {
    apple_light: appleTheme(appleMacUILightTheme),
    apple_dark: appleTheme(appleMacUIDarkTheme),
    light: {
      bg: '#ffffff',
      color: '#111827',
      primary: '#6366f1',
      secondary: '#4f46e5',
      accent: '#06b6d4',
      cardBg: '#f9fafb',
      borderColor: '#e5e7eb',
      inputBg: '#ffffff',
      placeholder: '#9ca3af',
    },
    dark: {
      bg: '#111827',
      color: '#f9fafb',
      primary: '#818cf8',
      secondary: '#6366f1',
      accent: '#22d3ee',
      cardBg: '#1f2937',
      borderColor: '#374151',
      inputBg: '#1f2937',
      placeholder: '#6b7280',
    },
  },
  tokens: {
    appleColor: appleMacUILightTheme.colors,
    appleRadius: appleMacUILightTheme.radii,
    appleSpace: appleMacUILightTheme.space,
    appleSize: appleMacUILightTheme.size,
    appleFont: { family: APPLE_MAC_UI_FONT_FAMILY, ...appleMacUILightTheme.typography },
    color: {
      primary: '#6366f1',
      secondary: '#4f46e5',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
    space: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    radius: {
      sm: 4,
      md: 8,
      lg: 12,
      full: 9999,
    },
    size: {
      sm: 32,
      md: 44,
      lg: 52,
    },
  },
};

export type AppTamaguiConfig = typeof tamaguiConfig;
export default tamaguiConfig;
