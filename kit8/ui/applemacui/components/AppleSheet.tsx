// AppleSheet - iOS bottom sheet (HIG: Sheets): grabber, detents (medium = half, large = almost full), dimmed
// backdrop, swipe down to dismiss / swipe between detents. Movement runs on the UI thread (Reanimated +
// gesture-handler); with reduced motion it appears / disappears without the slide.
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppleMacUI } from '../WithAppleMacUI';

export type AppleSheetDetent = 'medium' | 'large';

export interface AppleSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** heights the sheet rests at (default ['medium', 'large']) */
  detents?: AppleSheetDetent[];
  initialDetent?: AppleSheetDetent;
  /** false = the backdrop and the swipe do not close it (a decision is required) */
  dismissible?: boolean;
  children?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  closeLabel?: string;
}

/** share of the window height a detent takes */
export const APPLE_SHEET_DETENT: Record<AppleSheetDetent, number> = { medium: 0.5, large: 0.92 };

/** Where a released sheet goes: 'close' or the nearest detent (pure; y = px the sheet is pulled DOWN from "large"). */
export function resolveSheetRelease(offsets: number[], y: number, velocityY: number, closedAt: number, dismissible: boolean): number | 'close' {
  const projected = y + velocityY * 0.2;
  const lowest = Math.max(...offsets);
  if (dismissible && projected > lowest + (closedAt - lowest) * 0.35) return 'close';
  return offsets.reduce((best, o) => (Math.abs(o - projected) < Math.abs(best - projected) ? o : best), offsets[0]);
}

export const AppleSheet = memo(function AppleSheet({ visible, onClose, title, detents = ['medium', 'large'], initialDetent, dismissible = true, children, contentStyle, testID = 'apple-sheet', closeLabel = 'Close' }: AppleSheetProps) {
  const { theme, text, reduceMotion } = useAppleMacUI();
  const win = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const fullH = Math.round(win.height * APPLE_SHEET_DETENT.large);
  // translateY of each detent: 0 = large, bigger = lower
  const offsets = useMemo(() => detents.map((d) => Math.round(fullH - win.height * APPLE_SHEET_DETENT[d])), [detents, fullH, win.height]);
  const startOffset = offsets[Math.max(0, detents.indexOf(initialDetent ?? detents[0]))] ?? 0;
  const y = useSharedValue(fullH);
  const dragStart = useSharedValue(0);
  const spring = theme.motion.sheetSpring;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = reduceMotion ? withTiming(startOffset, { duration: 0 }) : withSpring(startOffset, spring);
    } else if (mounted) {
      y.value = withTiming(fullH, { duration: reduceMotion ? 0 : theme.motion.durationShort }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, startOffset, fullH, reduceMotion]);

  const close = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);
  const release = useCallback(
    (at: number, velocity: number) => {
      const to = resolveSheetRelease(offsets, at, velocity, fullH, dismissible);
      if (to === 'close') onClose();
      else y.value = reduceMotion ? withTiming(to, { duration: 0 }) : withSpring(to, spring);
    },
    [offsets, fullH, dismissible, onClose, reduceMotion, spring, y]
  );
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          dragStart.value = y.value;
        })
        .onUpdate((e) => {
          // rubber band above the large detent
          const next = dragStart.value + e.translationY;
          y.value = next < 0 ? next / 4 : next;
        })
        .onEnd((e) => {
          runOnJS(release)(y.value, e.velocityY);
        }),
    [dragStart, y, release]
  );

  const s = useMemo(() => {
    const c = theme.colors;
    return StyleSheet.create({
      root: { flex: 1, justifyContent: 'flex-end' },
      backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.backdrop },
      sheet: {
        height: fullH,
        width: '100%',
        maxWidth: 640,
        alignSelf: 'center',
        borderTopLeftRadius: theme.radii.sheet,
        borderTopRightRadius: theme.radii.sheet,
        backgroundColor: c.secondarySystemBackground,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -4 },
        elevation: 24,
      },
      handle: { minHeight: theme.size.touchTarget, alignItems: 'center', paddingTop: theme.space[2] - 2, ...(Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none' } as any) : null) },
      grabber: { width: theme.size.grabberWidth, height: theme.size.grabberHeight, borderRadius: theme.size.grabberHeight / 2, backgroundColor: c.systemGray3 },
      title: { ...text('headline'), color: c.label, marginTop: theme.space[2], textAlign: 'center' },
      content: { flex: 1, paddingHorizontal: theme.space[4], paddingBottom: theme.space[6] },
    });
  }, [theme, text, fullH]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, 1 - y.value / fullH)) }));

  if (!mounted && !visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={s.root}>
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Pressable testID={`${testID}-backdrop`} accessibilityLabel={closeLabel} accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>
        <Animated.View testID={testID} accessibilityViewIsModal accessibilityRole={Platform.OS === 'web' ? ('dialog' as any) : undefined} aria-modal style={[s.sheet, sheetStyle]}>
          <GestureDetector gesture={pan}>
            <View style={s.handle} testID={`${testID}-handle`}>
              <View style={s.grabber} />
              {!!title && (
                <Text style={s.title} accessibilityRole="header" allowFontScaling>
                  {title}
                </Text>
              )}
            </View>
          </GestureDetector>
          <View style={[s.content, contentStyle]}>{children}</View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
});

export default AppleSheet;
