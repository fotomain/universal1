// tamagui.config.ts - Base Tamagui configuration file
export const tamaguiConfig = {
  themes: {
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
