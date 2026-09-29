// Skia: the project progress line in the time-scale header (faint full-length track from
// project start to finish + colored fill = project %) and its "Project XX%" label.

import React from 'react';
import { Group, RoundedRect, SkFont, Text as SkText } from '@shopify/react-native-skia';

export function PMProjectProgressLine({
  y,
  H,
  band,
  progress,
  color,
}: {
  y: number;
  H: number;
  /** project start x + width (committed zoom) */
  band: { x: number; w: number };
  /** 0..100 */
  progress: number;
  color: string;
}) {
  const fill = Math.max(0, Math.min(1, progress / 100)) * band.w;
  return (
    <Group>
      <RoundedRect x={band.x} y={y} width={band.w} height={H} r={H / 2} color={color} opacity={0.25} />
      {fill > 0 && <RoundedRect x={band.x} y={y} width={Math.max(H, fill)} height={H} r={H / 2} color={color} />}
    </Group>
  );
}

/** "Project XX%" on a small header-colored pill, right-justified at the project finish. */
export function PMProjectProgressLabel({
  x,
  baseline,
  textWidth,
  text,
  font,
  background,
  color,
}: {
  x: number;
  baseline: number;
  textWidth: number;
  text: string;
  font: SkFont | null;
  background: string;
  color: string;
}) {
  if (!font) return null;
  return (
    <>
      <RoundedRect x={x - 4} y={baseline - 11} width={textWidth + 8} height={15} r={4} color={background} opacity={0.9} />
      <SkText x={x} y={baseline} text={text} font={font} color={color} />
    </>
  );
}

export default PMProjectProgressLine;
