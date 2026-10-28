import { buildLevelingTasks, entriesOf, levelingLinesOf, mondayOf, sharesOf } from '../../../kit8/pm/resourceleveling/resourceLevelingDemand';
import { D0, day, makeTask, resetSeq, timeLine } from './levelingTestKit';

beforeEach(() => resetSeq());

describe('the Time lines that book a resource in hours', () => {
  it('takes only Time lines with a resource, a quantity in hours and hours above zero', () => {
    const t = makeTask('A', 2);
    const good = timeLine(t.rowGUID, 'p1', 16);
    const material = { ...timeLine(t.rowGUID, 'p2', 5), rowParentGUID: 'materialGenus' };
    const days = timeLine(t.rowGUID, 'p3', 5, { measureUnitTaskLine: 'unit_day' });
    const none = timeLine(t.rowGUID, 'p4', 0);
    const noResource = timeLine(t.rowGUID, '', 5, { taskResourceItem: null });
    const wc = timeLine(t.rowGUID, 'w1', 8, { taskResourceKind: 'workCenter' });
    expect(levelingLinesOf([good, material, days, none, noResource, wc])).toEqual([
      { resource: 'person:p1', hours: 16, shape: 'uniformDistribution' },
      { resource: 'workCenter:w1', hours: 8, shape: 'uniformDistribution' },
    ]);
  });
});

describe('spreading the hours over the active days', () => {
  it('the shares add up to 1 for every distribution; an unknown or manual one is uniform', () => {
    for (const shape of ['uniformDistribution', 'frontLoadedDistribution', 'backLoadedDistribution', 'normalDistribution', 'epidemicDistribution', 'manualDistribution', 'nope']) {
      const s = sharesOf(shape, 7);
      expect(s).toHaveLength(7);
      expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
    expect(sharesOf('manualDistribution', 4)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it('entries: the hours of a line on its days add up to the quantity', () => {
    const e = entriesOf([{ resource: 'person:p1', hours: 24, shape: 'frontLoadedDistribution' }], [day(0), day(1), day(2)]);
    expect(e).toHaveLength(3);
    expect(e.reduce((a, b) => a + b.hours, 0)).toBeCloseTo(24, 9);
    expect(e[0].hours).toBeGreaterThan(e[2].hours);
    expect(entriesOf([{ resource: 'person:p1', hours: 8, shape: 'uniformDistribution' }], [])).toEqual([]);
  });

  it('mondayOf: the Monday of the week of any day', () => {
    expect(mondayOf(day(0))).toBe(day(0));
    expect(mondayOf(day(4))).toBe(day(0));
    expect(mondayOf(day(6))).toBe(day(0)); // Sunday
    expect(mondayOf(day(7))).toBe(day(7));
  });
});

describe('the tasks the engine gets and why one is frozen', () => {
  const base = (over: Record<string, unknown> = {}) => ({
    tasks: [] as any[], linesByTask: {} as Record<string, any[]>, rows: {} as Record<string, any>, todayMs: D0 - 30 * 86400000,
    manualTasksAllowed: false, priorityEnabled: true, manualEnabled: true, constraintsEnabled: true, postedMayMove: true, ...over,
  });
  const one = (extraJSON: Record<string, unknown> = {}, over: Record<string, unknown> = {}, lineExtra: Record<string, unknown> = {}, progress = 0) => {
    const t: any = makeTask('A', 3, extraJSON);
    t.rowProgress = progress;
    const args = base({ tasks: [t], linesByTask: { [t.rowGUID]: [timeLine(t.rowGUID, 'p1', 24, lineExtra)] }, rows: { [t.rowGUID]: { startMs: D0 } }, ...over });
    return buildLevelingTasks(args as any)[0];
  };

  it('a plain task is not frozen; priority defaults to 500', () => {
    expect(one()).toMatchObject({ frozen: null, priority: 500, posted: false });
  });
  it('stages, milestones, inactive tasks and tasks without a Time line are not in the input', () => {
    const s: any = makeTask('S', 1, {}, 'stage');
    const m: any = makeTask('M', 0, {}, 'milestone');
    const i: any = makeTask('I', 2, { taskInactive: true });
    const n: any = makeTask('N', 2);
    const args = base({ tasks: [s, m, i, n], linesByTask: { [s.rowGUID]: [timeLine(s.rowGUID, 'p', 8)], [m.rowGUID]: [timeLine(m.rowGUID, 'p', 8)], [i.rowGUID]: [timeLine(i.rowGUID, 'p', 8)] } });
    expect(buildLevelingTasks(args as any)).toEqual([]);
  });
  it('a parent row (it has children) is a summary: not in the input', () => {
    const parent: any = makeTask('P', 1);
    const child: any = makeTask('C', 2, {}, 'task', parent.treePath);
    const args = base({ tasks: [parent, child], linesByTask: { [parent.rowGUID]: [timeLine(parent.rowGUID, 'p', 8)], [child.rowGUID]: [timeLine(child.rowGUID, 'p', 16)] }, rows: { [child.rowGUID]: { startMs: D0 } } });
    expect(buildLevelingTasks(args as any).map((t) => t.guid)).toEqual([child.rowGUID]);
  });
  it('priority 1000 = never level; priority is 500 for all while Extended A15 is off', () => {
    expect(one({ taskPriority: 1000 }).frozen).toBe('priority1000');
    expect(one({ taskPriority: 1000 }, { priorityEnabled: false })).toMatchObject({ frozen: null, priority: 500 });
    expect(one({ taskPriority: 200 }).priority).toBe(200);
  });
  it('started: progress above 0, or a start before today', () => {
    expect(one({}, {}, {}, 10).frozen).toBe('frozenStarted');
    const t: any = makeTask('A', 3);
    const args = base({ tasks: [t], linesByTask: { [t.rowGUID]: [timeLine(t.rowGUID, 'p1', 24)] }, rows: { [t.rowGUID]: { startMs: D0 } }, todayMs: D0 + 86400000 });
    expect(buildLevelingTasks(args as any)[0].frozen).toBe('frozenStarted');
  });
  it('a posted fact makes it frozen; a posted task is frozen only when the user does not want it moved', () => {
    const t: any = makeTask('A', 3);
    const lines = { [t.rowGUID]: [timeLine(t.rowGUID, 'p1', 24, { taskIsPosted: true, budgetItemTaskLine: 'budgetItem1' })] };
    const rows = { [t.rowGUID]: { startMs: D0 } };
    expect(buildLevelingTasks(base({ tasks: [t], linesByTask: lines, rows, factTasks: new Set([t.rowGUID]) }) as any)[0].frozen).toBe('frozenFact');
    expect(buildLevelingTasks(base({ tasks: [t], linesByTask: lines, rows, postedMayMove: true }) as any)[0]).toMatchObject({ frozen: null, posted: true });
    expect(buildLevelingTasks(base({ tasks: [t], linesByTask: lines, rows, postedMayMove: false }) as any)[0]).toMatchObject({ frozen: 'frozenPosted', posted: true });
  });
  it('Must Start On / Must Finish On and a manual task (unless allowed) are frozen', () => {
    const iso = new Date(day(2)).toISOString();
    expect(one({ taskConstraintType: 'MSO', taskConstraintDate: iso }).frozen).toBe('constraintHonored');
    expect(one({ taskConstraintType: 'MSO', taskConstraintDate: iso }, { constraintsEnabled: false }).frozen).toBeNull();
    expect(one({ taskScheduleMode: 'manual', taskManualStartAt: iso }).frozen).toBe('manualTask');
    expect(one({ taskScheduleMode: 'manual', taskManualStartAt: iso }, { manualTasksAllowed: true }).frozen).toBeNull();
  });
  it('a task outside the scope of the run is fixed', () => {
    expect(one({}, { scope: new Set(['other']) }).frozen).toBe('outOfScope');
  });
});
