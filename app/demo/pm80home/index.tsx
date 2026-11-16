import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import HomeAppPM80 from '../../../apps/appPM80/home/HomeAppPM80';
import { useDesignSystem } from '../../../kit8/providers/WithDesignSystem';

/**
 * Route: /demo/pm80home
 * Renders the PM80 Analogic Circular ROI Calculation Dashboard.
 * Supports switching between React Native Paper (MD3) and React Native Tamagui styles,
 * or passing `?style=paper` / `?style=tamagui` in the URL.
 */
export default function PM80HomeDemoRoute() {
  const params = useLocalSearchParams<{ style?: string }>();
  let isDark = false;
  let bg = '#F8FAFC';

  try {
    const ds = useDesignSystem();
    if (ds) {
      if (typeof ds.isDark === 'boolean') isDark = ds.isDark;
      if (ds.themeColors?.background) bg = ds.themeColors.background;
    }
  } catch {
    // fallback if outside provider
  }

  const forcedVariant =
    params.style === 'paper' || params.style === 'tamagui'
      ? params.style
      : undefined;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <HomeAppPM80 variant={forcedVariant} showVariantSwitcher={true} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    ...Platform.select({
      web: {
        minHeight: '100vh',
      } as any,
      default: {},
    }),
  },
});

