import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { usePMTip } from '../../../kit8/pm/inner/tooltip/PMTooltip';

/**
 * A tip on hover (web) around any image / icon / circle of the PM80 home. The bubble is drawn by the layer of the
 * root layout (scope 'app', see AppTooltipLayer in app/_layout.tsx), so a screen without its own layer shows it too.
 * The child keeps its own onPress (the deepest responder wins); on touch the tip needs the long press of the app's
 * other tips and is therefore web first.
 */
export default function PM80Tip({
  tip,
  children,
  style,
  testID,
}: {
  tip: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const tipProps = usePMTip(tip, 'app');
  return (
    <Pressable
      {...tipProps}
      testID={testID}
      accessible={false}
      focusable={false}
      style={style}
    >
      {children}
    </Pressable>
  );
}
