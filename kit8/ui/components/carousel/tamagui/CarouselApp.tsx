import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { Carousel, Pagination, CarouselRef } from 'react-native-reanimated-carousel';
import { useSharedValue } from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SvgXml } from 'react-native-svg';
import { CarouselAppProps, getChevronLeftSvg, getChevronRightSvg } from '../common';
import ButtonApp from '../../common/ButtonApp';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';

export default function CarouselApp<T = any>({
  data,
  renderItem,
  keyExtractor,
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
  testID = 'tamagui-carousel-app',
}: CarouselAppProps<T>) {
  const carouselRef = useRef<CarouselRef>(null);
  const progress = useSharedValue<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(maxWidth);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);

  let primaryColor = '#2563eb';
  try {
    const ds = useDesignSystem();
    if (ds?.themeColors?.primary) {
      primaryColor = ds.themeColors.primary;
    }
  } catch {
    // outside provider fallback
  }

  const effectiveHeight = itemHeight || 440;

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0 && Math.abs(width - containerWidth) > 2) {
      setContainerWidth(width);
    }
  }, [containerWidth]);

  // Clamp effective carousel width to not exceed maxWidth (960px)
  const carouselWidth = useMemo(() => {
    if (containerWidth <= 0) return 0;
    return Math.min(containerWidth, maxWidth);
  }, [containerWidth, maxWidth]);

  const handleSnapToItem = useCallback((index: number) => {
    setCurrentIndex(index);
    if (onIndexChange) {
      onIndexChange(index);
    }
  }, [onIndexChange]);

  const handlePrev = useCallback(() => {
    carouselRef.current?.prev();
  }, []);

  const handleNext = useCallback(() => {
    carouselRef.current?.next();
  }, []);

  const handleDotPress = useCallback((index: number) => {
    carouselRef.current?.scrollTo({ index, animated: true });
  }, []);

  const toggleAutoPlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  return (
    <View
      testID={testID}
      style={[styles.outerContainer, containerStyle]}
      onLayout={onContainerLayout}
    >
      <View style={[styles.innerResponsiveBox, { maxWidth }, style]}>
        {/* Navigation Toolbar (Controls, Indicators & Play/Pause) */}
        {showControls && data.length > 1 && (
          <View style={styles.controlsBar}>
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {currentIndex + 1} <Text style={styles.counterDivider}>/</Text> {data.length}
              </Text>
            </View>

            <View style={styles.buttonsGroup}>
              <ButtonApp
                icon={isPlaying ? 'pause' : 'play_arrow'}
                variant={isPlaying ? 'contained' : 'outlined'}
                size="small"
                onPress={toggleAutoPlay}
                accessibilityLabel={isPlaying ? 'Pause carousel rotation' : 'Start carousel rotation'}
                style={{ marginVertical: 0 }}
              />
              <ButtonApp
                icon="chevron_left"
                variant="outlined"
                size="small"
                onPress={handlePrev}
                accessibilityLabel="Previous slide"
                style={{ marginVertical: 0 }}
              />
              <ButtonApp
                icon="chevron_right"
                variant="outlined"
                size="small"
                onPress={handleNext}
                accessibilityLabel="Next slide"
                style={{ marginVertical: 0 }}
              />
            </View>
          </View>
        )}

        {/* Reanimated Carousel Core + Left/Right Side Chevrons */}
        {carouselWidth > 0 ? (
          <View style={[styles.carouselWrapper, { width: carouselWidth, height: effectiveHeight }]}>
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
                    icon={<SvgXml xml={getChevronLeftSvg(primaryColor)} width={30} height={30} />}
                    variant="toolbar"
                    onPress={handlePrev}
                    accessibilityLabel="Previous slide"
                    style={styles.chevronOnlyBtn}
                  />
                </View>
                <View style={styles.sideArrowRight}>
                  <ButtonApp
                    testID="carousel-arrow-right"
                    icon={<SvgXml xml={getChevronRightSvg(primaryColor)} width={30} height={30} />}
                    variant="toolbar"
                    onPress={handleNext}
                    accessibilityLabel="Next slide"
                    style={styles.chevronOnlyBtn}
                  />
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={[styles.loadingPlaceholder, { height: effectiveHeight }]}>
            <Text style={styles.loadingText}>Initializing Carousel...</Text>
          </View>
        )}

        {/* Pagination Indicator Dots */}
        {showPagination && data.length > 1 && (
          <View style={styles.paginationContainer}>
            <Pagination
              count={data.length}
              progress={progress}
              onPress={handleDotPress}
              dotStyle={styles.dotStyle}
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
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
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
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
      default: {},
    }),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  controlBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  carouselWrapper: {
    position: 'relative',
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 16,
    width: '100%',
  },
  sideArrowLeft: {
    position: 'absolute',
    left: 6,
    top: '50%',
    marginTop: -18,
    zIndex: 20,
  },
  sideArrowRight: {
    position: 'absolute',
    right: 6,
    top: '50%',
    marginTop: -18,
    zIndex: 20,
  },
  chevronOnlyBtn: {
    marginVertical: 0,
    marginRight: 0,
    paddingHorizontal: 4,
    height: 36,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  loadingPlaceholder: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    backgroundColor: '#cbd5e1',
  },
  activeDotStyle: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
});

