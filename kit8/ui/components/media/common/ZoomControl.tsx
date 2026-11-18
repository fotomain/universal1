// The zoom buttons of the camera screens: [−] [0.5×] [1×] [2×] [5×] [+] and the factor now. Works while a video is being recorded.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { activePreset, canZoom, factorLabel, factorOf, stepZoom, zoomOfFactor, zoomPresets, ZoomRange } from './cameraZoom';

export interface ZoomControlProps {
  zoom: number;
  range: ZoomRange;
  onZoom: (zoom: number) => void;
  testID?: string;
}

export default function ZoomControl({ zoom, range, onZoom, testID = 'zoom' }: ZoomControlProps) {
  const theme = useTheme();
  if (!canZoom(range)) return null;
  const factor = factorOf(zoom, range);
  const presets = zoomPresets(range);
  const active = activePreset(factor, presets);
  return (
    <View style={styles.row} testID={testID}>
      <IconButton icon="minus" size={18} onPress={() => onZoom(stepZoom(zoom, -1, range))} disabled={zoom <= range.min} accessibilityLabel="Zoom out" style={styles.step} testID={`${testID}-out`} />
      {presets.map((p) => {
        const on = active === p;
        return (
          <Pressable
            key={p}
            onPress={() => onZoom(zoomOfFactor(p, range))}
            accessibilityRole="button"
            accessibilityLabel={`Zoom ${factorLabel(p)}`}
            style={[styles.chip, { backgroundColor: on ? theme.colors.primary : theme.colors.surfaceVariant }]}
            testID={`${testID}-preset-${p}`}
          >
            <Text variant="labelMedium" style={{ color: on ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>{factorLabel(p)}</Text>
          </Pressable>
        );
      })}
      <IconButton icon="plus" size={18} onPress={() => onZoom(stepZoom(zoom, 1, range))} disabled={zoom >= range.max} accessibilityLabel="Zoom in" style={styles.step} testID={`${testID}-in`} />
      {active == null && (
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }} testID={`${testID}-factor`}>{factorLabel(factor)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  step: { margin: 0 },
  chip: { minWidth: 44, height: 32, paddingHorizontal: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
