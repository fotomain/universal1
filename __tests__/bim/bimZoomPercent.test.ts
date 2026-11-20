import { BIM_ZOOM_STEP_PERCENT, fitBox, parseZoomPercent, scaleOfPercent, zoomByPercent, zoomPercentOf, BIM_MIN_DISTANCE } from '../../kit8/pm/bim/view/bimCamera';

const box = [0, 0, 0, 40, 10, 30];
const fit = fitBox(box, 45, 1.5);

describe('BIM zoom in percent', () => {
  it('100 % = the whole model fits', () => {
    expect(zoomPercentOf(fit, fit.distance)).toBeCloseTo(100, 6);
  });

  it('+100 doubles the size (half the distance), +50 = 1.5x, -50 = half as big', () => {
    expect(zoomByPercent(fit, 100).distance).toBeCloseTo(fit.distance / 2, 6);
    expect(zoomByPercent(fit, 50).distance).toBeCloseTo(fit.distance / 1.5, 6);
    expect(zoomByPercent(fit, -50).distance).toBeCloseTo(fit.distance * 2, 6);
    expect(zoomPercentOf(zoomByPercent(fit, 100), fit.distance)).toBeCloseTo(200, 6);
  });

  it('+p then the reverse change lands on the same view', () => {
    const zoomedIn = zoomByPercent(fit, BIM_ZOOM_STEP_PERCENT);
    const back = zoomByPercent(zoomedIn, (1 / (1 + BIM_ZOOM_STEP_PERCENT / 100) - 1) * 100);
    expect(back.distance).toBeCloseTo(fit.distance, 6);
  });

  it('only the distance changes (target and angles stay)', () => {
    const z = zoomByPercent(fit, 30);
    expect(z.target).toEqual(fit.target);
    expect(z.yaw).toBe(fit.yaw);
    expect(z.pitch).toBe(fit.pitch);
  });

  it('-100 or less, NaN and 0 do nothing; a huge zoom in stops at the minimum distance', () => {
    expect(scaleOfPercent(-100)).toBeNull();
    expect(scaleOfPercent(-250)).toBeNull();
    expect(scaleOfPercent(NaN)).toBeNull();
    expect(zoomByPercent(fit, -100)).toBe(fit);
    expect(zoomByPercent(fit, 0)).toBe(fit);
    expect(zoomByPercent(fit, 1e12).distance).toBe(BIM_MIN_DISTANCE);
  });

  it('parses what a person types', () => {
    expect(parseZoomPercent('50')).toBe(50);
    expect(parseZoomPercent('+50')).toBe(50);
    expect(parseZoomPercent('-30')).toBe(-30);
    expect(parseZoomPercent(' 25 % ')).toBe(25);
    expect(parseZoomPercent('12,5')).toBe(12.5);
    expect(parseZoomPercent('-99.5')).toBe(-99.5);
  });

  it('refuses what is not a percent change', () => {
    for (const bad of ['', '  ', 'abc', '5x', '--5', '1e3', '-100', '-150', '+', '%', '1.2.3']) expect(parseZoomPercent(bad)).toBeNull();
  });
});
