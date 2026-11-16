import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { Carousel, Pagination, CarouselRef } from 'react-native-reanimated-carousel';
import { useSharedValue } from 'react-native-reanimated';
import { Text, Surface, useTheme } from 'react-native-paper';
import { SvgXml } from 'react-native-svg';
import { CarouselAppProps, getChevronLeftSvg, getChevronRightSvg } from '../common';
import ButtonApp from '../../common/ButtonApp';

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
  testID = 'paper-carousel-app',
}: CarouselAppProps<T>) {
  const theme = useTheme();
  const carouselRef = useRef<CarouselRef>(null);
  const progress = useSharedValue<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(maxWidth);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);

  const effectiveHeight = itemHeight || 440;

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0 && Math.abs(width - containerWidth) > 2) {
      setContainerWidth(width);
    }
  }, [containerWidth]);

  const carouselWidth = useMemo(() => {
    if (containerWidth <= 0) return 0;
    return Math.min(containerWidth, maxWidth);
  }, [containerWidth, maxWidth]);

  const handleSnapToItem = useCallback((index: number) => {
    setCurrentIndex(index);
    if (onIndexChange) onIndexChange(index);
  }, [onIndexChange]);

  const handlePrev = useCallback(() => { carouselRef.current?.prev(); }, []);
  const handleNext = useCallback(() => { carouselRef.current?.next(); }, []);

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
        {/* Navigation Toolbar */}
        {showControls && data.length > 1 && (
          <View style={styles.controlsBar}>
            {/* Counter chip using Paper Surface */}
            <Surface
              style={[styles.counterSurface, { backgroundColor: theme.colors.surfaceVariant }]}
              elevation={0}
            >
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}
              >
                {currentIndex + 1}
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.outline, fontWeight: '400' }}
                >
                  {' / '}
                </Text>
                {data.length}
              </Text>
            </Surface>

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
                    icon={<SvgXml xml={getChevronLeftSvg(theme.colors.primary)} width={30} height={30} />}
                    variant="toolbar"
                    onPress={handlePrev}
                    accessibilityLabel="Previous slide"
                    style={styles.chevronOnlyBtn}
                  />
                </View>
                <View style={styles.sideArrowRight}>
                  <ButtonApp
                    testID="carousel-arrow-right"
                    icon={<SvgXml xml={getChevronRightSvg(theme.colors.primary)} width={30} height={30} />}
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
          <View style={[styles.loadingPlaceholder, { height: effectiveHeight, backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              Initializing Carousel...
            </Text>
          </View>
        )}

        {/* Pagination Dots */}
        {showPagination && data.length > 1 && (
          <View style={styles.paginationContainer}>
            <Pagination
              count={data.length}
              progress={progress}
              onPress={handleDotPress}
              dotStyle={{ ...styles.dotStyle, backgroundColor: theme.colors.outlineVariant }}
              activeDotStyle={{ ...styles.activeDotStyle, backgroundColor: theme.colors.primary }}
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
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  counterSurface: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  buttonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    margin: 0,
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
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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

