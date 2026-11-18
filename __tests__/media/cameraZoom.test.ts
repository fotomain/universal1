import {
  canZoom, clampZoom, digitalCropRect, factorLabel, factorOf, normalizeZoomRange, pinchZoom, sliderPosition, stepZoom, webZoomCapability,
  zoomAtSliderPosition, zoomOfFactor, zoomPresets, MAX_USEFUL_FACTOR,
} from '../../kit8/ui/components/media/common/cameraZoom';

const phone = normalizeZoomRange({ min: 1, max: 15, neutral: 2 }); // a multi lens phone: 1× is the device zoom 2

describe('camera zoom', () => {
  it('the factor the user sees is the device zoom over the neutral lens', () => {
    expect(factorOf(2, phone)).toBe(1);
    expect(factorOf(1, phone)).toBe(0.5);
    expect(zoomOfFactor(5, phone)).toBe(10);
    expect(zoomOfFactor(100, phone)).toBe(15); // clamped to the device
  });
  it('a broken range is made safe', () => {
    const r = normalizeZoomRange({ min: 0, max: NaN, neutral: -3 } as any);
    expect(r).toEqual({ min: 1, max: 1, neutral: 1 });
    expect(canZoom(r)).toBe(false);
    expect(normalizeZoomRange(null)).toEqual({ min: 1, max: 1, neutral: 1 });
  });
  it('shows no more than MAX_USEFUL_FACTOR times the main lens', () => {
    const r = normalizeZoomRange({ min: 1, max: 120, neutral: 1 });
    expect(r.max).toBe(MAX_USEFUL_FACTOR);
  });
  it('labels', () => {
    expect(factorLabel(1)).toBe('1×');
    expect(factorLabel(2.54)).toBe('2.5×');
    expect(factorLabel(0.5)).toBe('0.5×');
    expect(factorLabel(12.4)).toBe('12×');
    expect(factorLabel(NaN)).toBe('1×');
  });
  it('presets fit the range and are at most four', () => {
    expect(zoomPresets(phone)).toEqual([0.5, 1, 2, 3]);
    expect(zoomPresets(normalizeZoomRange({ min: 1, max: 5, neutral: 1 }))).toEqual([1, 2, 3, 5]);
    expect(zoomPresets(normalizeZoomRange({ min: 1, max: 1, neutral: 1 }))).toEqual([1]);
  });
  it('+ and - step in ratio and stop at the ends', () => {
    let z = phone.neutral;
    const up = stepZoom(z, 1, phone);
    expect(up).toBeGreaterThan(z);
    expect(stepZoom(phone.max, 1, phone)).toBe(phone.max);
    expect(stepZoom(phone.min, -1, phone)).toBe(phone.min);
    z = stepZoom(up, -1, phone);
    expect(z).toBeCloseTo(phone.neutral, 5);
  });
  it('a pinch multiplies the zoom of the start and is clamped; a bad scale changes nothing', () => {
    expect(pinchZoom(2, 2, phone)).toBe(4);
    expect(pinchZoom(2, 100, phone)).toBe(phone.max);
    expect(pinchZoom(2, 0.01, phone)).toBe(phone.min);
    expect(pinchZoom(2, NaN, phone)).toBe(2);
    expect(clampZoom(NaN, phone)).toBe(phone.neutral);
  });
  it('the slider is logarithmic and the two directions agree', () => {
    for (const p of [0, 0.25, 0.5, 0.9, 1]) expect(sliderPosition(zoomAtSliderPosition(p, phone), phone)).toBeCloseTo(p, 5);
    expect(zoomAtSliderPosition(0.5, phone)).toBeCloseTo(Math.sqrt(phone.min * phone.max), 5);
    expect(sliderPosition(5, normalizeZoomRange({ min: 1, max: 1, neutral: 1 }))).toBe(0);
  });
  it('the web: a track with a zoom capability zooms by hardware, else the picture is zoomed, else nothing', () => {
    const hard = webZoomCapability({ getCapabilities: () => ({ zoom: { min: 1, max: 5, step: 0.1 } }) }, true);
    expect(hard).toMatchObject({ hardware: true, range: { min: 1, max: 5, neutral: 1 } });
    const soft = webZoomCapability({ getCapabilities: () => ({}) }, true);
    expect(soft).toMatchObject({ hardware: false, range: { min: 1, max: 4 } });
    expect(webZoomCapability({ getCapabilities: () => ({}) }, false)).toBeNull();
    expect(webZoomCapability({ getCapabilities: () => { throw new Error('x'); } }, false)).toBeNull();
    expect(webZoomCapability(null, true)?.hardware).toBe(false);
  });
  it('digital zoom shows the middle of the picture', () => {
    expect(digitalCropRect(1280, 720, 2)).toEqual({ sx: 320, sy: 180, sw: 640, sh: 360 });
    expect(digitalCropRect(1280, 720, 0.5)).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720 }); // never zooms out
  });
});
