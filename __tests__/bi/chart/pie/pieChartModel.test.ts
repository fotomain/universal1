import { buildPieSlices, formatPiePercent, PIE_COLORS, PIE_OTHER_KEY, PIE_START_DEG } from '../../../../kit8/bi/chart/pie/pieChartModel';

describe('buildPieSlices', () => {
  it('biggest first, fractions add up to 1, angles run clockwise from 12 o\'clock and close the circle', () => {
    const s = buildPieSlices([{ key: 'a', label: 'A', value: 25 }, { key: 'b', label: 'B', value: 50 }, { key: 'c', label: 'C', value: 25 }]);
    expect(s.map((x) => x.key)).toEqual(['b', 'a', 'c']);
    expect(s.reduce((a, x) => a + x.fraction, 0)).toBeCloseTo(1);
    expect(s[0].startDeg).toBe(PIE_START_DEG);
    expect(s[0].sweepDeg).toBeCloseTo(180);
    expect(s[1].startDeg).toBeCloseTo(PIE_START_DEG + 180);
    const last = s[s.length - 1];
    expect(last.startDeg + last.sweepDeg).toBeCloseTo(PIE_START_DEG + 360);
  });

  it('zero, negative and non-finite rows are left out; nothing left = no slices', () => {
    const s = buildPieSlices([{ key: 'a', label: 'A', value: 0 }, { key: 'b', label: 'B', value: -5 }, { key: 'c', label: 'C', value: NaN }, { key: 'd', label: 'D', value: 3 }]);
    expect(s.map((x) => x.key)).toEqual(['d']);
    expect(s[0].sweepDeg).toBeCloseTo(360);
    expect(buildPieSlices([])).toEqual([]);
    expect(buildPieSlices([{ key: 'a', label: 'A', value: 0 }])).toEqual([]);
  });

  it('beyond maxSlices the smallest are added up into "Other"', () => {
    const data = Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, label: `K${i}`, value: 10 - i }));
    const s = buildPieSlices(data, { maxSlices: 4, otherLabel: 'Rest' });
    expect(s).toHaveLength(4);
    expect(s[3].key).toBe(PIE_OTHER_KEY);
    expect(s[3].label).toBe('Rest');
    expect(s[3].value).toBe(7 + 6 + 5);
    expect(s.reduce((a, x) => a + x.value, 0)).toBe(10 + 9 + 8 + 7 + 6 + 5);
  });

  it('colors: the palette in order (wraps), a datum\'s own color wins', () => {
    const data = Array.from({ length: 3 }, (_, i) => ({ key: `k${i}`, label: 'x', value: 10 - i }));
    expect(buildPieSlices(data).map((x) => x.color)).toEqual(PIE_COLORS.slice(0, 3));
    expect(buildPieSlices(data, { colors: ['#111', '#222'] }).map((x) => x.color)).toEqual(['#111', '#222', '#111']);
    expect(buildPieSlices([{ key: 'a', label: 'A', value: 1, color: '#abcdef' }])[0].color).toBe('#abcdef');
  });
});

describe('formatPiePercent', () => {
  it('one decimal; tiny shares are "<0.1%"', () => {
    expect(formatPiePercent(0.2534)).toBe('25.3%');
    expect(formatPiePercent(1)).toBe('100.0%');
    expect(formatPiePercent(0.0004)).toBe('<0.1%');
  });
});
