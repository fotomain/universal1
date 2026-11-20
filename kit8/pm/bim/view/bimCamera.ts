// The camera of the BIM viewer, as pure math (no three): an ORBIT around a target. The gestures change this state, the scene reads it. Scene space: Y up, metres.
//   one finger / left mouse = orbit · two fingers / right mouse = pan · pinch / wheel = zoom · tap = pick (see BimViewer)
export interface BimOrbit {
  target: [number, number, number];
  /** radians around the Y axis */
  yaw: number;
  /** radians above the horizon: -PI/2 + e .. PI/2 - e */
  pitch: number;
  distance: number;
}

export const BIM_MIN_DISTANCE = 0.5;
const PITCH_LIMIT = Math.PI / 2 - 0.05;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const orbitBy = (o: BimOrbit, dx: number, dy: number, radiansPerPixel = 0.006): BimOrbit => ({ ...o, yaw: o.yaw - dx * radiansPerPixel, pitch: clamp(o.pitch + dy * radiansPerPixel, -PITCH_LIMIT, PITCH_LIMIT) });

export const zoomBy = (o: BimOrbit, factor: number, maxDistance = 5000): BimOrbit => ({ ...o, distance: clamp(o.distance * factor, BIM_MIN_DISTANCE, maxDistance) });

// ZOOM IN PERCENT. The zoom level = how big the model looks: 100 % = the whole model fits (`fitBox`), 200 % = twice as big (half the distance).
// A CHANGE in percent is relative to what is on the screen: +50 = 1.5 times bigger, -50 = half as big, +100 = twice, -100 or less is refused (the model would vanish).
// scale = 1 + p / 100, the distance is divided by it; the buttons use the inverse pair (+25 % / the reverse of it), so + then - lands on the same view.
export const BIM_ZOOM_STEP_PERCENT = 25;

/** the zoom level of an orbit in percent (100 = the whole model in view) */
export const zoomPercentOf = (o: BimOrbit, fitDistance: number): number => (o.distance > 0 && fitDistance > 0 ? (fitDistance / o.distance) * 100 : 100);

/** the size factor of a percent change (1 + p/100), or null for a value that is not a number or is -100 or less */
export const scaleOfPercent = (p: number): number | null => (Number.isFinite(p) && p > -100 ? 1 + p / 100 : null);

/** the orbit after a change of p percent (+ bigger, - smaller); a refused value returns the same orbit */
export const zoomByPercent = (o: BimOrbit, p: number, maxDistance = 5000): BimOrbit => {
  const s = scaleOfPercent(p);
  return s === null || s === 1 ? o : zoomBy(o, 1 / s, maxDistance);
};

/** the text typed in the percent field ("50", "+50", "-30", "50 %", "12,5") -> a number, or null when it is not one */
export function parseZoomPercent(text: string): number | null {
  const t = (text || '').trim().replace('%', '').trim().replace(',', '.');
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return scaleOfPercent(n) === null ? null : n;
}

/** the position of the camera (it looks at the target) */
export function orbitPosition(o: BimOrbit): [number, number, number] {
  const cp = Math.cos(o.pitch);
  return [o.target[0] + o.distance * cp * Math.sin(o.yaw), o.target[1] + o.distance * Math.sin(o.pitch), o.target[2] + o.distance * cp * Math.cos(o.yaw)];
}

/** the pan: a drag of (dx, dy) pixels moves the target in the plane of the screen; `viewHeightPx` = the height of the view, `fovDeg` the vertical field of view */
export function panBy(o: BimOrbit, dx: number, dy: number, viewHeightPx: number, fovDeg = 45): BimOrbit {
  const worldPerPixel = (2 * o.distance * Math.tan((fovDeg * Math.PI) / 360)) / Math.max(1, viewHeightPx);
  // right vector (screen x) and up vector (screen y) of the camera
  const right: [number, number, number] = [Math.cos(o.yaw), 0, -Math.sin(o.yaw)];
  const up: [number, number, number] = [-Math.sin(o.pitch) * Math.sin(o.yaw), Math.cos(o.pitch), -Math.sin(o.pitch) * Math.cos(o.yaw)];
  return {
    ...o,
    target: [
      o.target[0] - right[0] * dx * worldPerPixel + up[0] * dy * worldPerPixel,
      o.target[1] - right[1] * dx * worldPerPixel + up[1] * dy * worldPerPixel,
      o.target[2] - right[2] * dx * worldPerPixel + up[2] * dy * worldPerPixel,
    ],
  };
}

/** the orbit that shows a box (minx, miny, minz, maxx, maxy, maxz) completely from the default direction */
export function fitBox(box: number[], fovDeg = 45, aspect = 1, yaw = Math.PI / 4, pitch = 0.5): BimOrbit {
  const c: [number, number, number] = [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2];
  const radius = Math.max(0.5, Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) / 2);
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.max(0.1, aspect));
  const distance = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.05;
  return { target: c, yaw, pitch, distance: Math.max(BIM_MIN_DISTANCE, distance) };
}

/** the box around several element boxes (null when there are none) */
export function unionBoxes(boxes: number[][]): number[] | null {
  if (!boxes.length) return null;
  const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const b of boxes) for (let i = 0; i < 3; i++) (out[i] = Math.min(out[i], b[i]), (out[i + 3] = Math.max(out[i + 3], b[i + 3])));
  return out;
}

/** a tap is a tap only when the finger moved less than 8 px and lasted less than 250 ms (a mouse click: 4 px); otherwise it was an orbit */
export const BIM_TAP_MAX_MOVE_PX = 8;
export const BIM_TAP_MAX_MS = 250;
export const isTap = (movePx: number, ms: number, mouse = false) => movePx < (mouse ? 4 : BIM_TAP_MAX_MOVE_PX) && ms < BIM_TAP_MAX_MS;
