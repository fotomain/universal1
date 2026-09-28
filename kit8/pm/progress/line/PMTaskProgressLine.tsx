// Skia: the thick progress line of one task bar (showTaskProgressOnGantt).

import React from 'react';
import { RoundedRect } from '@shopify/react-native-skia';
import { PMProgressLinePosition, PM_PROGRESS_LINE_HEIGHT } from './progressLineConstants';
import { taskProgressLineWidth, taskProgressLineY } from './progressLineGeometry';

export default function PMTaskProgressLine({
  x,
  barTop,
  barWidth,
  barHeight,
  progress01,
  position,
  color,
}: {
  x: number;
  barTop: number;
  barWidth: number;
  barHeight: number;
  /** 0..1 */
  progress01: number;
  position: PMProgressLinePosition;
  color: string;
}) {
  if (progress01 <= 0) return null;
  const H = PM_PROGRESS_LINE_HEIGHT;
  return (
    <RoundedRect x={x} y={taskProgressLineY(position, barTop, barHeight)} width={taskProgressLineWidth(barWidth, progress01)} height={H} r={H / 2} color={color} />
  );
}
