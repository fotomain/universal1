// A touch / click area that tells WHERE it was hit: onTap(x, width, pointer). Web: DOM click (a mouse or a touch of a phone browser),
// iOS / Android: Pressable. onHover (web): the mouse moves over it.
import React, { useState } from 'react';
import { Platform, Pressable, StyleProp, View, ViewStyle } from 'react-native';

export type TapPointer = 'touch' | 'mouse';

export interface TapSurfaceProps {
  onTap: (x: number, width: number, pointer: TapPointer) => void;
  onHover?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}

export default function TapSurface({ onTap, onHover, style, testID, accessibilityLabel, children }: TapSurfaceProps) {
  const [width, setWidth] = useState(0);

  if (Platform.OS === 'web') {
    const dom = {
      onClick: (e: any) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const type = e.nativeEvent?.pointerType ?? e.pointerType;
        onTap((e.clientX ?? 0) - rect.left, rect.width, type === 'touch' ? 'touch' : 'mouse');
      },
      onMouseMove: onHover,
    };
    return (
      <View style={style} testID={testID} accessibilityLabel={accessibilityLabel} {...(dom as any)}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) => onTap(e.nativeEvent.locationX, width, 'touch')}
    >
      {children}
    </Pressable>
  );
}
