// Tip-carrying pressables that are not ButtonApp buttons: an icon that only explains
// itself (PMTipIcon) and any custom Pressable with a tip (PMTipPressable).

import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import IconApp from '../../../components/common/IconApp';
import { usePMTip } from '../tooltip/PMTooltip';

/** A non-button icon that still shows its tip on hover (web) / long-press (touch). */
export function PMTipIcon({ tip, style, ...icon }: { tip: string; name: string; size?: number; color?: string; testID: string; style?: StyleProp<ViewStyle> }) {
  const tipProps = usePMTip(tip);
  return (
    <Pressable {...tipProps} accessibilityLabel={tip} style={style}>
      <IconApp {...icon} />
    </Pressable>
  );
}

/** Any Pressable with a tip. */
export function PMTipPressable({ tip, ...props }: PressableProps & { tip: string }) {
  const tipProps = usePMTip(tip);
  return <Pressable {...tipProps} accessibilityLabel={tip} {...props} />;
}
