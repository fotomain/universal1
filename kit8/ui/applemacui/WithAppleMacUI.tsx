// <WithAppleMacUI theme={appleMacUITheme}> - provider of the AppleMacUI design system. Mounted in app/_layout.tsx right below
// <PaperProvider theme={paperTheme}>.
//
//   theme    { light, dark } (appleMacUITheme) or one AppleMacUITheme
//   mode     'light' | 'dark' | 'system' (default: the app's dark mode from WithDesignSystem, else the OS setting)
//   tint     accent color override (default systemBlue)
//
// useAppleMacUI() -> { theme, text(style), reduceMotion }. Works without the provider too (light / system theme), so a
// component can be rendered alone in a test.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { appleMacUITheme as defaultThemes, AppleMacUITextStyleName, AppleMacUITheme, AppleMacUIThemeSet } from './appleMacUITheme';

export interface AppleMacUIContextType {
  theme: AppleMacUITheme;
  /** text style of an iOS text style name (font family included) */
  text: (name: AppleMacUITextStyleName) => { fontSize: number; lineHeight: number; fontWeight: '400' | '600' | '700'; letterSpacing: number; fontFamily: string | undefined };
  /** the user asked the OS for reduced motion: springs become instant */
  reduceMotion: boolean;
}

const make = (theme: AppleMacUITheme, reduceMotion: boolean): AppleMacUIContextType => {
  const cache: Partial<Record<AppleMacUITextStyleName, ReturnType<AppleMacUIContextType['text']>>> = {};
  return {
    theme,
    reduceMotion,
    text: (name) => (cache[name] ||= { ...theme.typography[name], fontFamily: theme.fontFamily }),
  };
};

const AppleMacUIContext = createContext<AppleMacUIContextType | null>(null);
const fallbackLight = make(defaultThemes.light, false);
const fallbackDark = make(defaultThemes.dark, false);

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => alive && setReduce(!!v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduce(!!v));
    return () => {
      alive = false;
      (sub as any)?.remove?.();
    };
  }, []);
  return reduce;
}

export function WithAppleMacUI({
  theme = defaultThemes,
  mode,
  tint,
  children,
}: {
  theme?: AppleMacUIThemeSet | AppleMacUITheme;
  mode?: 'light' | 'dark' | 'system';
  tint?: string;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  let appDark: boolean | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    appDark = useDesignSystem().isDark;
  } catch {
    appDark = undefined;
  }
  const reduceMotion = useReduceMotion();
  const dark = mode === 'dark' ? true : mode === 'light' ? false : mode === 'system' || appDark === undefined ? system === 'dark' : appDark;
  const value = useMemo(() => {
    const base: AppleMacUITheme = 'colors' in theme ? theme : dark ? theme.dark : theme.light;
    return make(tint ? { ...base, tint } : base, reduceMotion);
  }, [theme, dark, tint, reduceMotion]);
  return <AppleMacUIContext.Provider value={value}>{children}</AppleMacUIContext.Provider>;
}

export function useAppleMacUI(): AppleMacUIContextType {
  const ctx = useContext(AppleMacUIContext);
  const system = useColorScheme();
  return ctx || (system === 'dark' ? fallbackDark : fallbackLight);
}

export default WithAppleMacUI;
