import { DAY_MS } from '../../../kit8/pm/model/constants';
import { MINUTE_MS } from '../../../kit8/pm/hourmodel/hourAxis';
import { daysOfSlices, slicesOf, withHourSlices } from '../../../kit8/pm/hourmodel/hourPostPlan';
import { D0 } from '../resourceleveling/levelingTestKit';

const at = (dayOffset: number, h: number, m = 0) => D0 + dayOffset * DAY_MS + (h * 60 + m) * MINUTE_MS;
const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 1e10) / 1e10;

describe('slicesOf', () => {
  test('uniform: the share of a piece is its working minutes; the coefficients add up to 1', () => {
    const s = slicesOf([{ startMs: at(0, 11), endMs: at(0, 13) }, { startMs: at(0, 14), endMs: at(0, 18) }], 'uniformDistribution');
    expect(s.map((x) => [x.d, x.f, x.t])).toEqual([['2026-10-05', 660, 780], ['2026-10-05', 840, 1080]]);
    expect(s[0].c).toBeCloseTo(1 / 3, 9);
    expect(sum(s.map((x) => x.c))).toBe(1);
  });
  test('a task of two days: the coefficients of each day are the shares of its minutes', () => {
    const slices = slicesOf([{ startMs: at(0, 9), endMs: at(0, 13) }, { startMs: at(0, 14), endMs: at(0, 18) }, { startMs: at(1, 9), endMs: at(1, 10) }], 'uniformDistribution');
    const days = daysOfSlices(slices);
    expect(days.map((d) => d.d)).toEqual(['2026-10-05', '2026-10-06']);
    expect(days[0].c).toBeCloseTo(480 / 540, 9);
    expect(days[1].c).toBeCloseTo(60 / 540, 9);
    expect(sum(days.map((d) => d.c))).toBe(1);
  });
  test('the end of the day is minute 1440', () => {
    const s = slicesOf([{ startMs: at(0, 22), endMs: at(1, 0) }], undefined);
    expect(s).toEqual([{ d: '2026-10-05', f: 1320, t: 1440, c: 1 }]);
  });
  test('no working minute: no slice; an unknown shape is uniform', () => {
    expect(slicesOf([], 'uniformDistribution')).toEqual([]);
    expect(slicesOf([{ startMs: at(0, 9), endMs: at(0, 9) }], 'uniformDistribution')).toEqual([]);
    const s = slicesOf([{ startMs: at(0, 9), endMs: at(0, 10) }, { startMs: at(0, 10), endMs: at(0, 12) }], 'no-such-shape');
    expect(s[0].c).toBeCloseTo(1 / 3, 9);
  });
});

describe('withHourSlices', () => {
  const plan = (guids: string[]) => ({ taskGUID: 't', lines: guids.map((g) => ({ lineGUID: g, baseOfDistribution: 1, qtyTaskLine: 6, sumForBudget: 60, sumForContract: 60, days: [{ d: '2026-10-05', c: 0.5 }, { d: '2026-10-06', c: 0.5 }] })) });
  const line = (guid: string, parent: string, extra: Record<string, unknown> = {}): any => ({ rowGUID: guid, rowParentGUID: parent, rowJSON: { distributionForBudgetTaskLine: 'uniformDistribution', ...extra } });
  const pieces = [{ startMs: at(0, 11), endMs: at(0, 13) }, { startMs: at(0, 14), endMs: at(0, 18) }];

  test('a Time line of a resource gets slices and the days of its slices; the other lines keep their days', () => {
    const lines = [line('L1', 'timeGenus', { taskResourceItem: 'p1', taskResourceKind: 'person', measureUnitTaskLine: 'unit_hour' }), line('L2', 'materialGenus'), line('L3', 'timeGenus')];
    const out = withHourSlices(plan(['L1', 'L2', 'L3']), lines, pieces)!;
    expect(out.lines[0].hours).toHaveLength(2);
    expect(out.lines[0].days).toEqual([{ d: '2026-10-05', c: 1 }]);
    expect(out.lines[1].hours).toBeUndefined();
    expect(out.lines[1].days).toHaveLength(2);
    expect(out.lines[2].hours).toBeUndefined(); // a Time line with no resource books nobody
  });
  test('a quantity in days or pieces is not hours: no slices', () => {
    const lines = [line('L1', 'timeGenus', { taskResourceItem: 'p1', measureUnitTaskLine: 'unit_day' })];
    expect(withHourSlices(plan(['L1']), lines, pieces)!.lines[0].hours).toBeUndefined();
  });
  test('no pieces (the day model) or no plan: nothing changes', () => {
    const lines = [line('L1', 'timeGenus', { taskResourceItem: 'p1' })];
    const p = plan(['L1']);
    expect(withHourSlices(p, lines, undefined)).toBe(p);
    expect(withHourSlices(p, lines, [])).toBe(p);
    expect(withHourSlices(null, lines, pieces)).toBeNull();
  });
});
