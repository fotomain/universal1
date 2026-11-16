import React from 'react';
import { ScrollView, StyleSheet, SafeAreaView, StatusBar, Platform } from 'react-native';
import CarouselVendorsComponent from '../../../kit8/ui/components/carousel/CarouselVendors';
import { useDesignSystem } from '../../../kit8/providers/WithDesignSystem';

/**
 * CarouselVendors Demo Screen
 * Automatically adapts to the active design system and theme colors configured
 * in http://localhost:8088/settings.
 * Clicking any carousel slide opens a new browser tab to the Vendor home page.
 */
export default function CarouselVendors() {
  let isDark = false;
  let bg = '#f8fafc';

  try {
    const ds = useDesignSystem();
    if (ds) {
      if (typeof ds.isDark === 'boolean') isDark = ds.isDark;
      if (ds.themeColors?.background) bg = ds.themeColors.background;
    }
  } catch {
    // fallback if outside WithDesignSystem provider
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <CarouselVendorsComponent
          maxWidth={960}
          autoPlay={true}
          autoPlayInterval={2500}
          itemHeight={440}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 40,
    ...Platform.select({
      web: {
        minHeight: '100vh',
      } as any,
      default: {},
    }),
  },
});
