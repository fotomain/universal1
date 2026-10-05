// Shared shell of the floating row panels (tree hover panel, chart bar panel): a small
// rounded bar of compact icon buttons, positioned by an animated style from the parent
// (follows the shared scroll on the UI thread).

import React from 'react';
import { ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { PM_ROW_HEIGHT } from '../../model/constants';

export default function PMFloatingRowPanel({
  children,
  width,
  background,
  border,
  animatedStyle,
  style,
  testID,
  scroll,
}: {
  /** narrow panes (phones): the buttons scroll horizontally instead of being cut off */
  scroll?: boolean;
  children: React.ReactNode;
  width: number;
  background: string;
  border: string;
  /** position (translate / opacity) computed by the parent with useAnimatedStyle */
  animatedStyle: any;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Animated.View
      testID={testID}
      style={[styles.panel, { pointerEvents: 'box-none' }, { width, backgroundColor: background, borderColor: border }, style, animatedStyle]}
    >
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center' }}>
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    height: PM_ROW_HEIGHT - 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
