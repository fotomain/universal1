// PieChartReusable - a pie chart drawn with Skia (web + iOS + Android) and a legend, for any rows { key, label, value }.
//   <PieChartReusable data={[{ key: 'a', label: 'Time', value: 120 }, ...]} size={220} />
// Slices: pieChartModel.buildPieSlices (biggest first, the smallest added up into "Other" beyond maxSlices, zero / negative rows left out).
// Colors come from the props (`colors` / a datum's own `color`), the text colors from `textColor` / `mutedColor`, the gap between slices is `gapColor`
// (give it the background of the card the chart sits on). Nothing here knows about projects: the Reports view feeds it its table rows.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { buildPieSlices, formatPiePercent, PieDatum, PieSlice } from './pieChartModel';

export interface PieChartReusableProps {
  data: readonly PieDatum[];
  /** diameter of the pie in px (default 200) */
  size?: number;
  maxSlices?: number;
  otherLabel?: string;
  colors?: readonly string[];
  /** the line between slices (default white) */
  gapColor?: string;
  textColor?: string;
  mutedColor?: string;
  /** legend (color dot, label, percent) under the pie (default true) */
  showLegend?: boolean;
  /** text shown instead of the pie when no row has a positive value */
  emptyText?: string;
  testID?: string;
}

const GAP = 2;

/** the closed path of one slice: centre -> arc -> centre */
function slicePath(cx: number, cy: number, r: number, s: PieSlice) {
  const b = Skia.PathBuilder.Make();
  const oval = Skia.XYWHRect(cx - r, cy - r, 2 * r, 2 * r);
  if (s.sweepDeg >= 359.99) b.addOval(oval);
  else {
    b.moveTo(cx, cy);
    b.arcToOval(oval, s.startDeg, s.sweepDeg, false);
    b.close();
  }
  return b.build();
}

export default function PieChartReusable({
  data,
  size = 200,
  maxSlices,
  otherLabel,
  colors,
  gapColor = '#ffffff',
  textColor = '#0f172a',
  mutedColor = '#64748b',
  showLegend = true,
  emptyText = 'No data',
  testID = 'pie-chart',
}: PieChartReusableProps) {
  const slices = useMemo(() => buildPieSlices(data, { maxSlices, otherLabel, colors }), [data, maxSlices, otherLabel, colors]);
  const paths = useMemo(() => slices.map((s) => ({ key: s.key, color: s.color, path: slicePath(size / 2, size / 2, size / 2 - 1, s) })), [slices, size]);

  if (slices.length === 0) {
    return (
      <View testID={testID} style={styles.box}>
        <Text testID={`${testID}-empty`} style={{ color: mutedColor, fontSize: 13 }}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <View testID={testID} style={styles.box}>
      <Canvas style={{ width: size, height: size }} accessibilityLabel="Pie chart">
        {paths.map((p) => (
          <Path key={p.key} path={p.path} color={p.color} style="fill" />
        ))}
        {paths.length > 1 && paths.map((p) => <Path key={`${p.key}-gap`} path={p.path} color={gapColor} style="stroke" strokeWidth={GAP} />)}
      </Canvas>
      {showLegend && (
        <View style={[styles.legend, { width: Math.max(size, 160) }]} testID={`${testID}-legend`}>
          {slices.map((s) => (
            <View key={s.key} style={styles.legendRow} testID={`${testID}-slice-${s.key}`}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text numberOfLines={1} style={[styles.legendLabel, { color: textColor }]}>{s.label}</Text>
              <Text style={[styles.legendPercent, { color: mutedColor }]}>{formatPiePercent(s.fraction)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  legend: { marginTop: 10, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 12 },
  legendPercent: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
