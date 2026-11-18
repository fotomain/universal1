// The looks to choose from: black and white modes first, then the colour looks; the strip scrolls sideways.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { PHOTO_FILTERS, PhotoFilterGroup } from './photoFilters';

const GROUP_LABEL: Record<PhotoFilterGroup, string> = { normal: '', bw: 'Black & white', color: 'Colour' };

export interface PhotoFilterStripProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  testID?: string;
}

export default function PhotoFilterStrip({ value, onChange, disabled, testID = 'photo-filters' }: PhotoFilterStripProps) {
  const theme = useTheme();
  let lastGroup: PhotoFilterGroup | null = null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} testID={testID}>
      {PHOTO_FILTERS.map((f) => {
        const showGroup = f.group !== lastGroup && GROUP_LABEL[f.group];
        lastGroup = f.group;
        const on = f.id === value;
        return (
          <View key={f.id} style={styles.item}>
            {!!showGroup && <Text variant="labelSmall" style={[styles.group, { color: theme.colors.onSurfaceVariant }]}>{GROUP_LABEL[f.group]}</Text>}
            {!showGroup && <Text variant="labelSmall" style={styles.group}> </Text>}
            <Pressable
              onPress={() => onChange(f.id)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled }}
              style={[styles.chip, { backgroundColor: on ? theme.colors.primary : theme.colors.surfaceVariant, opacity: disabled ? 0.5 : 1 }]}
              testID={`${testID}-${f.id}`}
            >
              <Text variant="labelMedium" style={{ color: on ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>{f.label}</Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { paddingVertical: 4, gap: 8, alignItems: 'flex-end' },
  item: { alignItems: 'flex-start' },
  group: { marginBottom: 2, marginLeft: 4, minHeight: 14 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
