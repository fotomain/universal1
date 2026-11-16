// Tip-carrying pressables that are not ButtonApp buttons: an icon that only explains
// itself (PMTipIcon) and any custom Pressable with a tip (PMTipPressable).

import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import IconApp from '../../../ui/components/common/IconApp';
import { usePMTip } from '../tooltip/PMTooltip';
import { pmT } from '../../i18n/pmT';

/** A non-button icon that still shows its tip on hover (web) / long-press (touch). */
export function PMTipIcon({ tip, style, onPress, ...icon }: { tip: string; name: string; size?: number; color?: string; testID: string; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const tipProps = usePMTip(tip);
  // an icon with NO onPress is still a Pressable and swallows the click: pass onPress when it sits inside a pressable parent
  return (
    <Pressable {...tipProps} accessibilityLabel={pmT(tip)} style={style} onPress={onPress} hitSlop={onPress ? 8 : undefined}>
      <IconApp {...icon} />
    </Pressable>
  );
}

/** Any Pressable with a tip. */
export function PMTipPressable({ tip, ...props }: PressableProps & { tip: string }) {
  const tipProps = usePMTip(tip);
  return <Pressable {...tipProps} accessibilityLabel={pmT(tip)} {...props} />;
}
