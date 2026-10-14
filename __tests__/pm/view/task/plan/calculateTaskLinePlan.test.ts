// calculateTaskLinePlan - the plan of the task lines (pure): the periods = the active days of the calendar, the coefficients normalized to 1,
// Correct033 (the "0333 Effect": 100.00 on 3 days = 33.33 + 33.33 + 33.34), what is refused, and the state of the Post button.
import {
  BASE_OF_DISTRIBUTION, calculateTaskLinePlan, distributeCorrect033, normalizedCoefficients,
} from '../../../../../kit8/pm/view/task/plan/calculateTaskLinePlan';
import { defaultBudgetItemOfGenus, summarizeTaskLinePlan, taskPostState } from '../../../../../kit8/pm/view/task/plan/taskLinePlanModel';
import { distributionShares, DISTRIBUTION } from '../../../../../kit8/catalog/distribution/distributionModel';
import { daysBetween } from '../../../../../kit8/catalog/management/calendar/managementCalendarModel';

const sum = (a: (number | null)[]) => Math.round(a.reduce<number>((x, y) => x + (y ?? 0), 0) * 1e10) / 1e10;
const distributions = Object.values(DISTRIBUTION).map((code) => ({ rowGUID: code, rowOwnerGUID: 'distributionGenericCatalog', rowParentGUID: 'g', rowJSON: {} })) as any[];

/** a calendar: Monday-Friday of 2026-10-12 .. 2026-10-30 active */
const weekdays = (from: string, to: string, off: string[] = []) =>
  daysBetween(from, to).map((day) => {
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    return { rowJSON: { day, isActive: dow !== 0 && dow !== 6 && !off.includes(day) } };
  });

const line = (guid: string, over: Record<string, any> = {}, genus = 'timeGenus', order = 1): any => ({
  rowGUID: guid, rowOwnerGUID: 't1', rowParentGUID: genus, orderInList: order,
  rowJSON: { budgetItemTaskLine: 'timeBudgetItem', distributionForBudgetTaskLine: 'uniformDistribution', qtyTaskLine: 10, sumForBudget: 100, sumForContract: 100, taskIsPosted: false, ...over },
});

describe('normalizedCoefficients', () => {
  it('adds up to exactly 1 (the rest goes to the last day), 10 digits', () => {
    const c = normalizedCoefficients([1, 1, 1]);
    expect(c).toEqual([0.3333333333, 0.3333333333, 0.3333333334]);
    expect(sum(c)).toBe(1);
  });
  it.each(Object.values(DISTRIBUTION).filter((d) => d !== DISTRIBUTION.manual))('%s: sums to 1 for any number of days', (code) => {
    for (const n of [1, 2, 3, 7, 10, 23, 60, 261]) {
      const c = normalizedCoefficients(distributionShares(code, n));
      expect(c).toHaveLength(n);
      expect(sum(c)).toBe(BASE_OF_DISTRIBUTION);
      expect(c.every((x) => x >= 0)).toBe(true);
    }
  });
  it('the rest never lands on a zero tail', () => {
    const c = normalizedCoefficients([1, 1, 1, 0, 0]);
    expect(c.slice(3)).toEqual([0, 0]);
    expect(sum(c)).toBe(1);
  });
  it('no weight at all -> zeros', () => { expect(normalizedCoefficients([0, 0])).toEqual([0, 0]); });
});

describe('Correct033 - the document "0333 Effect"', () => {
  const third = normalizedCoefficients([1, 1, 1]);
  it('100.00 on 3 equal days: 33.33 + 33.33 + 33.33 = 99.99 would be wrong -> the last row gets the 0.01', () => {
    const parts = distributeCorrect033(100, third);
    expect(parts).toEqual([33.33, 33.33, 33.34]);
    expect(sum(parts)).toBe(100);
  });
  it('100.00 on 7 days: 14.29 x 7 = 100.03 -> the last row loses 0.03', () => {
    const parts = distributeCorrect033(100, normalizedCoefficients(Array(7).fill(1)));
    expect(parts).toEqual([14.29, 14.29, 14.29, 14.29, 14.29, 14.29, 14.26]);
    expect(sum(parts)).toBe(100);
  });
  it('0.01 on 3 days: 0.00 + 0.00 + 0.01', () => { expect(distributeCorrect033(0.01, third)).toEqual([0, 0, 0.01]); });
  it('an exact split is left alone', () => { expect(distributeCorrect033(100, [0.5, 0.25, 0.25])).toEqual([50, 25, 25]); });
  it('a null total gives null parts, a zero total zeros, a negative total (a credit) adds up too', () => {
    expect(distributeCorrect033(null, third)).toEqual([null, null, null]);
    expect(distributeCorrect033(0, third)).toEqual([0, 0, 0]);
    expect(sum(distributeCorrect033(-100, third))).toBe(-100);
  });
  it('every distribution adds up to the total, for many totals and lengths', () => {
    for (const code of Object.values(DISTRIBUTION).filter((d) => d !== DISTRIBUTION.manual)) {
      for (const n of [1, 3, 7, 22, 90]) {
        const c = normalizedCoefficients(distributionShares(code, n));
        for (const total of [0.01, 1, 99.99, 100, 1234.56, 1e6 + 0.07]) {
          const parts = distributeCorrect033(total, c);
          expect(sum(parts)).toBeCloseTo(total, 2);
          // the safety rule of the SQL: the rounding cannot lose more than n half-cents
          const lost = Math.abs(total - parts.reduce<number>((x, y, i) => x + (i < parts.length - 1 ? (y as number) : 0), 0) - (parts[parts.length - 1] as number));
          expect(lost).toBeLessThan(1e-6);
        }
      }
    }
  });
});

describe('calculateTaskLinePlan', () => {
  const base = { taskGUID: 't1', fromDay: '2026-10-12', toDay: '2026-10-16', distributions, calendarDays: weekdays('2026-10-01', '2026-10-31') };

  it('a Monday-Friday task = 5 days, coefficients 0.2 each, the totals as they are', () => {
    const r = calculateTaskLinePlan({ ...base, lines: [line('l1')] });
    expect(r.errors).toEqual([]);
    expect(r.days).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
    expect(r.taskLinePlanJSON).toEqual({
      taskGUID: 't1',
      lines: [{ lineGUID: 'l1', baseOfDistribution: 1, qtyTaskLine: 10, sumForBudget: 100, sumForContract: 100, sumForAccounting: null, days: r.days.map((d) => ({ d, c: 0.2 })) }],
    });
  });

  it('a weekend and an excluded day divide the timeline: they get no row', () => {
    const r = calculateTaskLinePlan({ ...base, toDay: '2026-10-23', lines: [line('l1')], calendarDays: weekdays('2026-10-01', '2026-10-31', ['2026-10-14']) });
    expect(r.days).toEqual(['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
    expect(r.excludedDays).toContain('2026-10-14');
    expect(r.excludedDays).toContain('2026-10-17');
    expect(r.segments).toEqual([['2026-10-12', '2026-10-13'], ['2026-10-15', '2026-10-16'], ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']]);
    const l = r.taskLinePlanJSON!.lines[0];
    expect(l.days).toHaveLength(9);
    expect(sum(l.days.map((x) => x.c))).toBe(1);
  });

  it('a one-day task (a milestone) = one row with the whole coefficient', () => {
    const r = calculateTaskLinePlan({ ...base, toDay: '2026-10-12', lines: [line('l1')] });
    expect(r.taskLinePlanJSON!.lines[0].days).toEqual([{ d: '2026-10-12', c: 1 }]);
  });

  it('a line without a budget item is skipped, not an error', () => {
    const r = calculateTaskLinePlan({ ...base, lines: [line('l1'), line('l2', { budgetItemTaskLine: null })] });
    expect(r.skipped).toEqual(['l2']);
    expect(r.postedLines).toEqual(['l1']);
    expect(r.errors).toEqual([]);
  });

  it('manual distribution is not used now; an empty / unknown one is refused; the other lines are still posted', () => {
    const r = calculateTaskLinePlan({
      ...base,
      lines: [line('l1'), line('m', { distributionForBudgetTaskLine: 'manualDistribution' }), line('e', { distributionForBudgetTaskLine: null }), line('u', { distributionForBudgetTaskLine: 'nope' })],
    });
    expect(r.postedLines).toEqual(['l1']);
    expect(r.errors.map((e) => e.lineGUID).sort()).toEqual(['e', 'm', 'u']);
    expect(r.errors.find((e) => e.lineGUID === 'm')!.message).toMatch(/manual/i);
  });

  it('sumForAccounting is posted with the line (the sum in the accounting currency); no accounting currency = null stays null', () => {
    const r = calculateTaskLinePlan({ ...base, lines: [line('a', { sumForAccounting: 120.5 }), line('b')] });
    expect(r.taskLinePlanJSON!.lines.map((l) => l.sumForAccounting)).toEqual([120.5, null]);
  });
  it('a line whose ONLY total is the accounting sum is still posted', () => {
    const r = calculateTaskLinePlan({ ...base, lines: [line('z', { qtyTaskLine: null, sumForBudget: null, sumForContract: null, sumForAccounting: 50 })] });
    expect(r.errors).toEqual([]);
    expect(r.taskLinePlanJSON!.lines[0]).toMatchObject({ lineGUID: 'z', sumForAccounting: 50 });
  });
  it('a line with no quantity and no sum has nothing to post; null totals stay null', () => {
    const r = calculateTaskLinePlan({ ...base, lines: [line('z', { qtyTaskLine: null, sumForBudget: null, sumForContract: null }), line('p', { sumForBudget: null })] });
    expect(r.errors.map((e) => e.lineGUID)).toEqual(['z']);
    expect(r.taskLinePlanJSON!.lines[0]).toMatchObject({ lineGUID: 'p', sumForBudget: null, sumForContract: 100, qtyTaskLine: 10 });
  });

  it('the lines are sent genus by genus, each in its order (the rows of the plan follow it)', () => {
    const r = calculateTaskLinePlan({ ...base, lines: [line('rev', {}, 'revenueGenus', 1), line('t2', {}, 'timeGenus', 2), line('t1', {}, 'timeGenus', 1), line('mat', {}, 'materialGenus', 1)] });
    expect(r.postedLines).toEqual(['t1', 't2', 'mat', 'rev']);
  });

  it('a problem of the task stops everything: no dates, a year the calendar does not have, no active day', () => {
    const none = calculateTaskLinePlan({ ...base, fromDay: null, toDay: null, lines: [line('l1')] });
    expect(none.taskLinePlanJSON).toBeNull();
    expect(none.errors[0].message).toMatch(/no start and finish/);

    const year = calculateTaskLinePlan({ ...base, fromDay: '2026-12-28', toDay: '2027-01-05', lines: [line('l1')], calendarDays: weekdays('2026-12-01', '2026-12-31'), calendarTitle: 'Working days' });
    expect(year.taskLinePlanJSON).toBeNull();
    expect(year.errors[0].message).toMatch(/not filled for 2027/);

    const off = calculateTaskLinePlan({ ...base, toDay: '2026-10-12', lines: [line('l1')], calendarDays: weekdays('2026-10-01', '2026-10-31', ['2026-10-12']) });
    expect(off.taskLinePlanJSON).toBeNull();
    expect(off.errors[0].message).toMatch(/no active day/);
  });

  it('nothing budgeted = nothing to post and no error', () => {
    const r = calculateTaskLinePlan({ ...base, lines: [line('l1', { budgetItemTaskLine: null })] });
    expect(r).toMatchObject({ taskLinePlanJSON: null, errors: [], skipped: ['l1'] });
  });
});

describe('the state of the Post button: Post · Posted · Post needed', () => {
  const l = (over: Record<string, any>) => line('x', over);
  it('"Post" until anything was posted (the first edit)', () => {
    expect(taskPostState([])).toBe('post');
    expect(taskPostState([l({ taskIsPosted: false })])).toBe('post');
    expect(taskPostState([l({ budgetItemTaskLine: null })])).toBe('post');
  });
  it('"Posted" when every budgeted line is posted (a line without a budget item does not count)', () => {
    expect(taskPostState([l({ taskIsPosted: true, baseOfDistribution: 1 })])).toBe('posted');
    expect(taskPostState([l({ taskIsPosted: true, baseOfDistribution: 1 }), line('y', { budgetItemTaskLine: null })])).toBe('posted');
  });
  it('"Post needed" when it was posted and the data changed, or a line was added', () => {
    expect(taskPostState([l({ taskIsPosted: false, baseOfDistribution: 1 })])).toBe('postNeeded');
    expect(taskPostState([l({ taskIsPosted: true, baseOfDistribution: 1 }), line('new', { taskIsPosted: false })])).toBe('postNeeded');
  });
});

describe('summarizeTaskLinePlan - the days add up to the line', () => {
  const planRow = (lineGUID: string, i: number, c: number, q: number, b: number, k: number) =>
    ({ rowGUID: `${lineGUID}${i}`, rowOwnerGUID: 't1', rowParentGUID: lineGUID, orderInList: i, rowPeriodDatetime: '2026-10-12T00:00:00+00:00', rowCoefficient: String(c), qtyTaskLine: String(q), sumForBudget: String(b), sumForContract: String(k) }) as any;
  it('ok when coefficients, qty and sums equal the line (numbers may arrive as strings)', () => {
    const rows = [planRow('l1', 1, 0.3333333333, 3.33, 33.33, 33.33), planRow('l1', 2, 0.3333333333, 3.33, 33.33, 33.33), planRow('l1', 3, 0.3333333334, 3.34, 33.34, 33.34)];
    const s = summarizeTaskLinePlan(rows, [line('l1', { baseOfDistribution: 1 })]);
    expect(s).toEqual([{ lineGUID: 'l1', days: 3, coefficient: 1, qtyTaskLine: 10, sumForBudget: 100, sumForContract: 100, sumForAccounting: null, ok: true }]);
  });
  it('the accounting sum is added up too and is part of "ok"', () => {
    const acc = (id: string, i: number, c: number, a: number) => ({ rowGUID: `${id}${i}`, rowOwnerGUID: 't1', rowParentGUID: id, orderInList: i, rowPeriodDatetime: '2026-10-12T00:00:00+00:00', rowCoefficient: String(c), qtyTaskLine: '5', sumForBudget: '50', sumForContract: '50', sumForAccounting: String(a) }) as any;
    const good = summarizeTaskLinePlan([acc('l1', 1, 0.5, 33.33), acc('l1', 2, 0.5, 66.67)], [line('l1', { baseOfDistribution: 1, sumForAccounting: 100 })]);
    expect(good[0]).toMatchObject({ sumForAccounting: 100, ok: true });
    const lost = summarizeTaskLinePlan([acc('l1', 1, 0.5, 33.33), acc('l1', 2, 0.5, 66.66)], [line('l1', { baseOfDistribution: 1, sumForAccounting: 100 })]);
    expect(lost[0]).toMatchObject({ sumForAccounting: 99.99, ok: false });
  });
  it('not ok when a cent is missing; lines without rows are not listed', () => {
    const rows = [planRow('l1', 1, 0.5, 5, 50, 50), planRow('l1', 2, 0.5, 5, 49.99, 50)];
    const s = summarizeTaskLinePlan(rows, [line('l1', { baseOfDistribution: 1 }), line('l2')]);
    expect(s).toHaveLength(1);
    expect(s[0].ok).toBe(false);
  });
});

describe('defaultBudgetItemOfGenus', () => {
  const items = [
    { rowGUID: 'x2', rowParentGUID: 'f', orderInList: 2, rowJSON: { managementGenusItem: 'timeGenus' } },
    { rowGUID: 'timeBudgetItem', rowParentGUID: 'f', orderInList: 5, rowJSON: { managementGenusItem: 'timeGenus' } },
    { rowGUID: 'x1', rowParentGUID: 'f', orderInList: 1, rowJSON: { managementGenusItem: 'materialGenus' } },
  ] as any[];
  it('the seed item of the genus, else the first one of the genus, else null', () => {
    expect(defaultBudgetItemOfGenus(items, 'timeGenus')).toBe('timeBudgetItem');
    expect(defaultBudgetItemOfGenus(items, 'materialGenus')).toBe('x1');
    expect(defaultBudgetItemOfGenus(items, 'revenueGenus')).toBeNull();
    expect(defaultBudgetItemOfGenus([], 'timeGenus')).toBeNull();
  });
});
