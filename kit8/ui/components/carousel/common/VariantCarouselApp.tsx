import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  LayoutChangeEvent,
} from 'react-native';
import { Carousel, Pagination, CarouselRef } from 'react-native-reanimated-carousel';
import { useSharedValue } from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CarouselAppProps } from './types';
import ButtonApp from '../../common/ButtonApp';
import { DesignSystemType, useDesignSystem } from '../../../../providers/WithDesignSystem';

export interface VariantCarouselAppProps<T = any> extends CarouselAppProps<T> {
  designVariant: DesignSystemType;
}

const ACCENTS: Record<string, { color: string; radius: number }> = {
  applemacui: { color: '#007AFF', radius: 14 },
  ant: { color: '#1677ff', radius: 8 },
  expo: { color: '#f59e0b', radius: 22 },
  googlemd3web: { color: '#00639B', radius: 24 },
  native: { color: '#8b5cf6', radius: 6 },
};

export default function VariantCarouselApp<T = any>({
  data,
  renderItem,
  maxWidth = 960,
  itemHeight = 440,
  autoPlay = true,
  autoPlayInterval = 2500,
  loop = true,
  showPagination = true,
  showControls = true,
  onIndexChange,
  style,
  containerStyle,
  testID,
  designVariant,
}: VariantCarouselAppProps<T>) {
  const carouselRef = useRef<CarouselRef>(null);
  const progress = useSharedValue<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(maxWidth);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);

  let isDark = false;
  let primaryColor = ACCENTS[designVariant]?.color || '#2563eb';
  let borderColor = '#e2e8f0';
  let surfaceColor = '#ffffff';
  let textColor = '#334155';

  try {
    const ds = useDesignSystem();
    if (ds) {
      isDark = ds.isDark;
      if (ds.themeColors) {
        primaryColor = ds.themeColors.primary || primaryColor;
        borderColor = ds.themeColors.border || (isDark ? '#334155' : '#e2e8f0');
        surfaceColor = ds.themeColors.surface || (isDark ? '#1e293b' : '#ffffff');
        textColor = ds.themeColors.text || (isDark ? '#f8fafc' : '#334155');
      }
    }
  } catch {
    // outside provider fallback
  }

  const effectiveHeight = itemHeight || 440;
  const radius = ACCENTS[designVariant]?.radius ?? 16;

  const onContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      if (width > 0 && Math.abs(width - containerWidth) > 2) {
        setContainerWidth(width);
      }
    },
    [containerWidth]
  );

  const carouselWidth = useMemo(() => {
    if (containerWidth <= 0) return 0;
    return Math.min(containerWidth, maxWidth);
  }, [containerWidth, maxWidth]);

  const handleSnapToItem = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      if (onIndexChange) onIndexChange(index);
    },
    [onIndexChange]
  );

  return (
    <View
      testID={testID || `${designVariant}-carousel-app`}
      style={[styles.outerContainer, containerStyle]}
      onLayout={onContainerLayout}
    >
      <View style={[styles.innerResponsiveBox, { maxWidth }, style]}>
        {showControls && data.length > 1 && (
          <View style={styles.controlsBar}>
            <View
              style={[
                styles.counterBadge,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  borderColor,
                  borderRadius: Math.min(radius, 12),
                },
              ]}
            >
              <Text style={[styles.counterText, { color: textColor }]}>
                {currentIndex + 1} <Text style={styles.counterDivider}>/</Text> {data.length}
              </Text>
            </View>

            <View style={styles.buttonsGroup}>
              <ButtonApp
                icon={isPlaying ? 'pause' : 'play_arrow'}
                variant={isPlaying ? 'contained' : 'outlined'}
                size="small"
                onPress={() => setIsPlaying((prev) => !prev)}
                accessibilityLabel={isPlaying ? 'Pause carousel rotation' : 'Start carousel rotation'}
                style={{ marginVertical: 0 }}
              />
              <ButtonApp
                icon="chevron_left"
                variant="outlined"
                size="small"
                onPress={() => carouselRef.current?.prev()}
                accessibilityLabel="Previous slide"
                style={{ marginVertical: 0 }}
              />
              <ButtonApp
                icon="chevron_right"
                variant="outlined"
                size="small"
                onPress={() => carouselRef.current?.next()}
                accessibilityLabel="Next slide"
                style={{ marginVertical: 0 }}
              />
            </View>
          </View>
        )}

        {carouselWidth > 0 ? (
          <View
            style={[
              styles.carouselWrapper,
              { width: carouselWidth, height: effectiveHeight, borderRadius: radius },
            ]}
          >
            <Carousel
              ref={carouselRef}
              data={data}
              renderItem={({ item, index }) => renderItem(item, index)}
              itemSize={carouselWidth}
              loop={loop}
              autoplay={isPlaying}
              autoplayInterval={autoPlayInterval}
              progress={progress}
              onSnapToItem={handleSnapToItem}
              style={{ width: carouselWidth, height: effectiveHeight }}
            />
            {showControls && data.length > 1 && (
              <>
                <View style={styles.sideArrowLeft}>
                  <ButtonApp
                    testID="carousel-arrow-left"
                    icon="chevron_left"
                    variant="outlined"
                    size="small"
                    onPress={() => carouselRef.current?.prev()}
                    accessibilityLabel="Previous slide"
                    style={{ marginVertical: 0 }}
                  />
                </View>
                <View style={styles.sideArrowRight}>
                  <ButtonApp
                    testID="carousel-arrow-right"
                    icon="chevron_right"
                    variant="outlined"
                    size="small"
                    onPress={() => carouselRef.current?.next()}
                    accessibilityLabel="Next slide"
                    style={{ marginVertical: 0 }}
                  />
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={[styles.loadingPlaceholder, { height: effectiveHeight, borderRadius: radius }]}>
            <Text style={styles.loadingText}>Initializing Carousel...</Text>
          </View>
        )}

        {showPagination && data.length > 1 && (
          <View style={styles.paginationContainer}>
            <Pagination
              count={data.length}
              progress={progress}
              onPress={(index: number) => carouselRef.current?.scrollTo({ index, animated: true })}
              dotStyle={{ ...styles.dotStyle, backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
              activeDotStyle={{ ...styles.activeDotStyle, backgroundColor: primaryColor }}
              containerStyle={styles.paginationDotsContainer}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerResponsiveBox: {
    width: '100%',
    alignSelf: 'center',
    minHeight: 520,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  counterBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  counterDivider: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  buttonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselWrapper: {
    position: 'relative',
    alignSelf: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  sideArrowLeft: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -19,
    zIndex: 20,
  },
  sideArrowRight: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -19,
    zIndex: 20,
  },
  loadingPlaceholder: {
    width: '100%',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  paginationContainer: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationDotsContainer: {
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotStyle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDotStyle: {
    width: 24,
    height: 8,
    borderRadius: 4,
  },
});

