// SVG path helpers of the network view (react-native-svg `d` strings).
// Edges follow the project's "Dependency arrows" setting (store.linkLineForm):
//   smoothForm = horizontal-tangent cubic curves, squareForm = orthogonal lines.

import { Platform } from 'react-native';
import { PMLinkLineForm } from '../types';

export type PMPt = [number, number];

const f = (v: number) => (Math.round(v * 10) / 10).toString();

/** Polyline through the points, drawn smooth or square. */
export function edgePath(points: PMPt[], form: PMLinkLineForm): string {
  if (points.length < 2) return '';
  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (Math.abs(y1 - y0) < 0.5 || Math.abs(x1 - x0) < 0.5) {
      d += ` L${f(x1)},${f(y1)}`;
    } else if (form === 'squareForm') {
      const mx = (x0 + x1) / 2;
      d += ` H${f(mx)} V${f(y1)} H${f(x1)}`;
    } else {
      const dx = Math.max(10, Math.abs(x1 - x0) / 2);
      d += ` C${f(x0 + dx)},${f(y0)} ${f(x1 - dx)},${f(y1)} ${f(x1)},${f(y1)}`;
    }
  }
  return d;
}

/** Straight segments (AOA arrows). */
export function straightPath(points: PMPt[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])},${f(p[1])}`).join(' ');
}

/** Filled triangle whose tip is at (x, y), pointing along `angle` (radians). */
export function arrowHead(x: number, y: number, angle: number, size: number): string {
  const a1 = angle + Math.PI - 0.42;
  const a2 = angle + Math.PI + 0.42;
  return `M${f(x)},${f(y)} L${f(x + size * Math.cos(a1))},${f(y + size * Math.sin(a1))} L${f(x + size * Math.cos(a2))},${f(y + size * Math.sin(a2))} Z`;
}

/** Direction of the last segment of a smooth/square edge (always ends horizontally). */
export function endAngle(points: PMPt[], form: PMLinkLineForm): number {
  const n = points.length;
  if (n < 2) return 0;
  const [x0, y0] = points[n - 2];
  const [x1, y1] = points[n - 1];
  if (form === 'squareForm' || Math.abs(x1 - x0) >= 0.5) return x1 >= x0 ? 0 : Math.PI;
  return Math.atan2(y1 - y0, x1 - x0);
}

/** Point on a circle border toward another point. */
export function towards(cx: number, cy: number, tx: number, ty: number, r: number): PMPt {
  const a = Math.atan2(ty - cy, tx - cx);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Middle of the longest segment of a polyline (label anchor) + its angle and length. */
export function labelAnchor(points: PMPt[]): { x: number; y: number; angle: number; len: number } {
  let best = { x: 0, y: 0, angle: 0, len: -1 };
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len > best.len) best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, angle: Math.atan2(y1 - y0, x1 - x0), len };
  }
  return best;
}

/**
 * Press handler props for a react-native-svg shape.
 * Web: a plain DOM `onClick` - react-native-svg's web `onPress` also forwards RN responder
 * props (onStartShouldSetResponder, ...) to the <path>, which React DOM warns about.
 * Native: `onPress`.
 */
export function svgPressProps(handler: (e: any) => void): Record<string, unknown> {
  return Platform.OS === 'web' ? { onClick: handler, style: { cursor: 'pointer' } } : { onPress: handler };
}
