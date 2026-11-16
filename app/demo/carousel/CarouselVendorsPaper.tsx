import React from 'react';
import { ScrollView, StyleSheet, SafeAreaView, StatusBar, Platform } from 'react-native';
import CarouselVendorsPaperComponent from '../../../kit8/ui/components/carousel/paper/CarouselVendors';
import { useDesignSystem } from '../../../kit8/providers/WithDesignSystem';

/**
 * CarouselVendorsPaper Demo Screen
 * React Native Paper (MD3) styled responsive carousel of enterprise technology vendors.
 * Constrained to a maximum width of 960 pixels with 2.5s autoplay.
 */
export default function CarouselVendorsPaper() {
  let isDark = false;
  try {
    const ds = useDesignSystem();
    if (ds && typeof ds.isDark === 'boolean') {
      isDark = ds.isDark;
    }
  } catch {
    // fallback if outside WithDesignSystem provider
  }

  const bg = isDark ? '#0b1120' : '#f8fafc';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <CarouselVendorsPaperComponent
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

