// A help text as ONE line with "more..." at its right; a press shows all of it ("less" folds it back).
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export default function CollapsibleHint({ children, testID }: { children: string; testID: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const link = (label: string, onPress: () => void, id: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} testID={id}><Text variant="labelMedium" style={{ color: theme.colors.primary }}>{label}</Text></Pressable>
  );
  return (
    <View style={open ? styles.col : styles.row}>
      <Text variant="bodySmall" style={[styles.flex, { color: theme.colors.onSurfaceVariant }]} numberOfLines={open ? undefined : 1} testID={testID}>{children}</Text>
      {open ? link('less', () => setOpen(false), `${testID}-less`) : link('more...', () => setOpen(true), `${testID}-more`)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  col: { gap: 4 },
  flex: { flex: 1 },
});
