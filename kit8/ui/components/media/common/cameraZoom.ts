// Zoom of the camera screens (video, photo, scan). Pure: no React, no native module.
// The camera speaks of a ZOOM FACTOR the user sees ("1×", "2.5×"). Vision Camera speaks of a device zoom between `minZoom` and `maxZoom`,
// where `neutralZoom` is the 1× lens (it is 2 on a phone whose main camera is the second lens of a multi camera device).
// The slider is logarithmic: the same finger distance gives the same ratio, whatever the range (0.5-10×).

export interface ZoomRange {
  /** the smallest device zoom (Vision Camera `device.minZoom`) */
  min: number;
  /** the biggest device zoom (`device.maxZoom`); a device that cannot zoom has min = max */
  max: number;
  /** the device zoom that is shown as 1× (`device.neutralZoom`) */
  neutral: number;
}

/** an upper limit of the digital zoom shown to the user (a phone can say 120×, which is only noise) */
export const MAX_USEFUL_FACTOR = 20;

export const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);

/** a range that is safe to divide by (missing / zero values of a device in a test or a browser) */
export function normalizeZoomRange(range?: Partial<ZoomRange> | null): ZoomRange {
  const min = Number.isFinite(range?.min) && (range!.min as number) > 0 ? (range!.min as number) : 1;
  const maxRaw = Number.isFinite(range?.max) && (range!.max as number) > 0 ? (range!.max as number) : min;
  const neutralRaw = Number.isFinite(range?.neutral) && (range!.neutral as number) > 0 ? (range!.neutral as number) : 1;
  const neutral = clamp(neutralRaw, min, Math.max(min, maxRaw));
  // the user never sees more than MAX_USEFUL_FACTOR times the neutral lens
  const max = Math.max(min, Math.min(maxRaw, neutral * MAX_USEFUL_FACTOR));
  return { min, max, neutral };
}

/** can the user change anything? */
export const canZoom = (range: ZoomRange) => range.max - range.min > 0.01;

export const clampZoom = (zoom: number, range: ZoomRange) => clamp(Number.isFinite(zoom) ? zoom : range.neutral, range.min, range.max);

/** device zoom -> the factor shown to the user (neutral = 1) */
export const factorOf = (zoom: number, range: ZoomRange) => zoom / range.neutral;

/** the factor the user asks for -> device zoom (clamped) */
export const zoomOfFactor = (factor: number, range: ZoomRange) => clampZoom(factor * range.neutral, range);

/** '1×', '2.5×', '0.5×', '12×' */
export function factorLabel(factor: number): string {
  if (!Number.isFinite(factor)) return '1×';
  const rounded = factor < 10 ? Math.round(factor * 10) / 10 : Math.round(factor);
  return `${rounded}×`;
}

/** the buttons "0.5× 1× 2× 5×" that fit the range (always the 1× lens first when it is inside) */
export function zoomPresets(range: ZoomRange): number[] {
  const candidates = [0.5, 1, 2, 3, 5, 10];
  const lo = factorOf(range.min, range);
  const hi = factorOf(range.max, range);
  const fits = candidates.filter((f) => f >= lo - 0.01 && f <= hi + 0.01);
  // never more than 4 buttons: keep the first (widest), 1×, and the last ones
  if (fits.length <= 4) return fits;
  const tele = fits.filter((f) => f > 1);
  return [...fits.filter((f) => f <= 1), ...tele.slice(0, 4 - fits.filter((f) => f <= 1).length)];
}

/** one step of the + / - buttons: 1/6 of the logarithmic range, at least 10 % */
export function stepZoom(zoom: number, direction: 1 | -1, range: ZoomRange): number {
  const ratio = Math.max(1.1, Math.pow(range.max / range.min, 1 / 6));
  return clampZoom(direction > 0 ? zoom * ratio : zoom / ratio, range);
}

/** a pinch: the zoom when the fingers started × the scale of the pinch (1 = no change) */
export const pinchZoom = (startZoom: number, scale: number, range: ZoomRange) => clampZoom(startZoom * (Number.isFinite(scale) && scale > 0 ? scale : 1), range);

/** position of the thumb of a slider (0 = min, 1 = max), logarithmic */
export function sliderPosition(zoom: number, range: ZoomRange): number {
  if (!canZoom(range)) return 0;
  return clamp(Math.log(clampZoom(zoom, range) / range.min) / Math.log(range.max / range.min), 0, 1);
}

export function zoomAtSliderPosition(position: number, range: ZoomRange): number {
  if (!canZoom(range)) return range.min;
  return clampZoom(range.min * Math.pow(range.max / range.min, clamp(position, 0, 1)), range);
}

/** the web: a browser track that has `zoom` in its capabilities zooms with its optics / sensor; others zoom the picture */
export interface WebZoomCapability {
  hardware: boolean;
  range: ZoomRange;
}

export function webZoomCapability(track: { getCapabilities?: () => any } | null | undefined, digitalAvailable: boolean): WebZoomCapability | null {
  let caps: any = null;
  try {
    caps = track?.getCapabilities?.() ?? null;
  } catch {
    caps = null;
  }
  const z = caps?.zoom;
  if (z && typeof z.min === 'number' && typeof z.max === 'number' && z.max > z.min) {
    return { hardware: true, range: normalizeZoomRange({ min: z.min, max: z.max, neutral: clamp(1, z.min, z.max) }) };
  }
  if (digitalAvailable) return { hardware: false, range: normalizeZoomRange({ min: 1, max: 4, neutral: 1 }) };
  return null;
}

/** digital zoom: the part of a picture (width x height) that is shown at `factor` - the middle, as a source rectangle for drawImage */
export function digitalCropRect(width: number, height: number, factor: number) {
  const f = Math.max(1, Number.isFinite(factor) ? factor : 1);
  const w = width / f;
  const h = height / f;
  return { sx: (width - w) / 2, sy: (height - h) / 2, sw: w, sh: h };
}

/** the distance between the first two touches (px), 0 when there are fewer than two (a pinch) */
export function touchDistance(touches: ReadonlyArray<{ pageX: number; pageY: number }> | undefined | null): number {
  if (!touches || touches.length < 2) return 0;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

/** the preset the zoom is nearest to (in ratio), or null when it is not near any (within 6 %) */
export function activePreset(factor: number, presets: number[]): number | null {
  for (const p of presets) if (Math.abs(Math.log(factor / p)) < 0.06) return p;
  return null;
}
