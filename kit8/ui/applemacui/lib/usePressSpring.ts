// Press feedback of AppleMacUI controls: spring scale 0.97 + opacity, on the UI thread (Reanimated).
// Reduced motion: no scale, opacity only.
import { useCallback } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppleMacUI } from '../WithAppleMacUI';

export function usePressSpring(enabled = true) {
  const { theme, reduceMotion } = useAppleMacUI();
  const pressed = useSharedValue(0);
  const { pressScale, pressOpacity, spring } = theme.motion;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * (1 - pressOpacity),
    transform: [{ scale: reduceMotion ? 1 : 1 - pressed.value * (1 - pressScale) }],
  }));
  const onPressIn = useCallback(() => {
    if (enabled) pressed.value = reduceMotion ? withTiming(1, { duration: 0 }) : withSpring(1, spring);
  }, [enabled, reduceMotion, pressed, spring]);
  const onPressOut = useCallback(() => {
    pressed.value = reduceMotion ? withTiming(0, { duration: 0 }) : withSpring(0, spring);
  }, [reduceMotion, pressed, spring]);
  return { animatedStyle, onPressIn, onPressOut };
}
