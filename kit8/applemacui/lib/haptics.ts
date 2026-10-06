// Light haptic tap on iOS (expo-haptics); nothing on Android / web or when the module is missing.
import { Platform } from 'react-native';

export function appleHapticTap() {
  if (Platform.OS !== 'ios') return;
  try {
    const Haptics = require('expo-haptics');
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light)?.catch?.(() => undefined);
  } catch {
    // no haptics in this build
  }
}

export function appleHapticSelection() {
  if (Platform.OS !== 'ios') return;
  try {
    require('expo-haptics').selectionAsync?.()?.catch?.(() => undefined);
  } catch {
    // no haptics in this build
  }
}
