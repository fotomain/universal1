// Drag handle icon (⠿ "drag_indicator") for the row panels: press and drag it to move the row.
// The drag itself is a react-native-gesture-handler gesture owned by the parent (e.g. the tree's
// row reorder gesture); without `gesture` it is only an icon with its tip (tests, read-only).
// Same size as a compact PMIconButton, so the panel geometry counts it as one icon.

import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { GestureDetector, GestureType } from 'react-native-gesture-handler';
import IconApp from '../../../ui/components/common/IconApp';
import { usePMTip } from '../tooltip/PMTooltip';

export function PMDragHandleButton({
  testID,
  gesture,
  color,
  size = 16,
  title = 'Drag to move the task',
}: {
  testID: string;
  /** Pan gesture that moves the row (null = icon only) */
  gesture?: GestureType | null;
  color: string;
  size?: number;
  title?: string;
}) {
  const tip = usePMTip(title);
  const handle = (
    <Pressable
      ref={tip.ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={tip.accessibilityHint}
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPressIn={tip.onPressIn}
      onLongPress={tip.onLongPress}
      delayLongPress={tip.delayLongPress}
      style={[styles.box, Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any) : null]}
    >
      <IconApp testID={`${testID}-icon`} name="drag_indicator" size={size} color={color} />
    </Pressable>
  );
  return gesture ? <GestureDetector gesture={gesture}>{handle}</GestureDetector> : handle;
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: 4, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
});

export default PMDragHandleButton;
