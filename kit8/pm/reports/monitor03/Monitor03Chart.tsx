// Monitor03Chart - the line chart of ROI1-4 over time (react-native-svg). x = a real time axis (days since the first point), y = the ratio in percent with the zero line always inside.
//   'seen' mode draws STEP lines (the value stays until the next row of the log) with a marker on every row; 'month' mode draws straight lines between the monthly points.
//   a gap (no cost -> no ratio) breaks the line. The colours of the four kinds are fixed (ROI_KIND_COLOR) and the legend chips switch a kind on and off.
import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { pmT } from '../../i18n/pmT';
import { ROI_KINDS, ROI_KIND_TITLE, RoiKind } from '../roi/roiModel';
import { RoiPoint, roiChartData, roiSeriesSegments } from '../roi/roiHistoryModel';

export const ROI_KIND_COLOR: Record<RoiKind, string> = { roi1: '#2563eb', roi2: '#7c3aed', roi3: '#0891b2', roi4: '#16a34a' };
const M = { left: 52, right: 14, top: 12, bottom: 30 };
const HEIGHT = 280;

/** round ticks covering [lo, hi] (percent) */
export function roiNiceTicks(lo: number, hi: number, count = 5): number[] {
  const span = Math.max(1, hi - lo);
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export interface Monitor03ChartProps {
  points: readonly RoiPoint[];
  step: boolean;
  color: string;
  gridColor: string;
  testID?: string;
}

function Monitor03ChartImpl({ points, step, color, gridColor, testID = 'monitor03-chart' }: Monitor03ChartProps) {
  const [width, setWidth] = useState(720);
  const [on, setOn] = useState<ReadonlySet<RoiKind>>(() => new Set(ROI_KINDS));
  const kinds = useMemo(() => ROI_KINDS.filter((k) => on.has(k)), [on]);
  const data = useMemo(() => roiChartData(points, kinds), [points, kinds]);
  const w = Math.max(240, width);
  const px = (x: number) => M.left + (data.xMax === 0 ? 0 : (x / data.xMax) * (w - M.left - M.right));
  const py = (y: number) => M.top + (1 - (y - data.yMin) / (data.yMax - data.yMin)) * (HEIGHT - M.top - M.bottom);
  const ticks = useMemo(() => roiNiceTicks(data.yMin, data.yMax), [data.yMin, data.yMax]);
  const toggle = (k: RoiKind) => setOn((cur) => { const next = new Set(cur); if (next.has(k)) { if (next.size > 1) next.delete(k); } else next.add(k); return next; });
  const first = points[0]?.x;
  const last = points[points.length - 1]?.x;
  return (
    <View testID={testID} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      <View style={styles.legend}>
        {ROI_KINDS.map((k) => (
          <Pressable key={k} testID={`${testID}-legend-${k}`} accessibilityRole="button" aria-pressed={on.has(k)} onPress={() => toggle(k)} style={[styles.chip, { borderColor: ROI_KIND_COLOR[k], backgroundColor: on.has(k) ? ROI_KIND_COLOR[k] : 'transparent' }]}>
            <Text style={{ color: on.has(k) ? '#fff' : color, fontSize: 12, fontWeight: '700' }}>{ROI_KIND_TITLE[k]}</Text>
          </Pressable>
        ))}
      </View>
      {data.empty ? (
        <Text testID={`${testID}-empty`} style={{ color, opacity: 0.6, padding: 16 }}>{pmT('No points yet.')}</Text>
      ) : (
        <Svg testID={`${testID}-svg`} width={w} height={HEIGHT}>
          {ticks.map((t) => (
            <React.Fragment key={t}>
              <Line x1={M.left} x2={w - M.right} y1={py(t)} y2={py(t)} stroke={t === 0 ? color : gridColor} strokeWidth={t === 0 ? 1.5 : 1} opacity={t === 0 ? 0.7 : 1} />
              <SvgText x={M.left - 6} y={py(t) + 4} fontSize={11} fill={color} textAnchor="end">{`${t} %`}</SvgText>
            </React.Fragment>
          ))}
          {first && <SvgText x={M.left} y={HEIGHT - 8} fontSize={11} fill={color} textAnchor="start">{first}</SvgText>}
          {last && last !== first && <SvgText x={w - M.right} y={HEIGHT - 8} fontSize={11} fill={color} textAnchor="end">{last}</SvgText>}
          {data.series.map((s) => roiSeriesSegments(s.points, step).map((seg, i) => (
            <Polyline key={`${s.kind}-${i}`} testID={`${testID}-line-${s.kind}-${i}`} points={seg.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')} fill="none" stroke={ROI_KIND_COLOR[s.kind]} strokeWidth={2} />
          )))}
          {data.series.map((s) => s.points.filter((p) => p.y !== null).map((p) => (
            <Circle key={`${s.kind}-${p.index}`} cx={px(p.x)} cy={py(p.y as number)} r={step ? 3.5 : 3} fill={ROI_KIND_COLOR[s.kind]} />
          )))}
        </Svg>
      )}
    </View>
  );
}

export default memo(Monitor03ChartImpl);
const styles = StyleSheet.create({
  wrap: { width: '100%' },
  legend: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 6, flexWrap: 'wrap' },
  chip: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 3 },
});
