// Toolbar layout primitives shared by every PM toolbar: the bar (horizontally scrollable on
// phones), a spacer and a divider. Buttons live in kit8/pm/buttons.

import React from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { PM_TOOLBAR_HEIGHT } from '../constants';

export function PMToolbar({
  children,
  background,
  border,
  style,
}: {
  children: React.ReactNode;
  background: string;
  border: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.bar, { backgroundColor: background, borderColor: border }, style]}>
      {/* scrolls horizontally on phones instead of clipping buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

export function PMToolbarSpacer() {
  return <View style={{ flex: 1 }} />;
}

export function PMToolbarDivider({ color }: { color: string }) {
  return <View style={{ width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 8, marginHorizontal: 4, backgroundColor: color }} />;
}

const styles = StyleSheet.create({
  bar: {
    height: PM_TOOLBAR_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  content: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
});
