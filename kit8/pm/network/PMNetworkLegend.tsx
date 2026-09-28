// Compact legend at the right end of the network sub-toolbar.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { PMPalette } from '../theme';

export interface PMLegendItem {
  label: string;
  color: string;
  dash?: string;
  width?: number;
}

export function legendItems(
  palette: PMPalette,
  opts: {
    critical: boolean;
    dummy?: boolean;
    freeFloat?: boolean;
    viaStage?: boolean;
  },
): PMLegendItem[] {
  const items: PMLegendItem[] = [{ label: 'Dependency', color: palette.link }];
  if (opts.critical) items.push({ label: 'Critical', color: palette.critical, width: 2.4 });
  if (opts.viaStage) items.push({ label: 'Via stage', color: palette.link, dash: '6 3' });
  if (opts.dummy) items.push({ label: 'Dummy', color: palette.link, dash: '4 3' });
  if (opts.freeFloat) items.push({ label: 'Free float', color: palette.textMuted, dash: '1 3' });
  return items;
}

export default function PMNetworkLegend({ items, palette }: { items: PMLegendItem[]; palette: PMPalette }) {
  return (
    <View style={styles.row} testID="pm-net-legend">
      {items.map((it) => (
        <View key={it.label} style={styles.item}>
          <Svg width={22} height={8}>
            <Line x1={1} y1={4} x2={21} y2={4} stroke={it.color} strokeWidth={it.width ?? 1.6} strokeDasharray={it.dash} strokeLinecap="round" />
          </Svg>
          <Text style={[styles.label, { color: palette.textMuted }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  item: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  label: { fontSize: 11, marginLeft: 4 },
});
