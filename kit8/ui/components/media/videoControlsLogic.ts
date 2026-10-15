// Pure rules of the video buttons (no React): where a double touch lands, how far a jump goes, the time of the second touch.

export type TapZone = 'left' | 'center' | 'right';

/** the video is cut in three parts: left 40 % (back), middle 20 % (play / pause), right 40 % (forward) */
export const LEFT_ZONE_END = 0.4;
export const RIGHT_ZONE_START = 0.6;

/** a second touch / click within this time is a double touch / double click */
export const TAP_WINDOW_MS = 300;

/** the part of the video a touch / click at x (of width) hits; no width (not measured yet) = center */
export function doubleTapZone(x: number, width: number): TapZone {
  if (!(width > 0) || !Number.isFinite(x)) return 'center';
  const ratio = x / width;
  if (ratio < LEFT_ZONE_END) return 'left';
  if (ratio > RIGHT_ZONE_START) return 'right';
  return 'center';
}

/** the second touch of a double touch? */
export function isRepeatedTap(previousTime: number | null, now: number, windowMs: number = TAP_WINDOW_MS): boolean {
  return previousTime !== null && now - previousTime >= 0 && now - previousTime <= windowMs;
}

/** current time + delta, kept inside the video (0 .. duration; an unknown duration has no end) */
export function seekTarget(current: number, delta: number, duration: number): number {
  const base = Number.isFinite(current) ? current : 0;
  const end = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
  return Math.min(end, Math.max(0, base + delta));
}

/** 0 .. 1 for the progress bar */
export function progressOf(current: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(duration)) return 0;
  return Math.min(1, Math.max(0, (current || 0) / duration));
}

/** a touch at x of a bar of `width` -> seconds */
export function timeAtPosition(x: number, width: number, duration: number): number {
  if (!(width > 0) || !(duration > 0)) return 0;
  return (Math.min(width, Math.max(0, x)) / width) * duration;
}
