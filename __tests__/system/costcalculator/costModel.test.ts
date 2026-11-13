// The cost model (kit8/system/costcalculator/costModel.ts) against the "Live sketch" of documentation/PRICE_PLAN_CALCULATOR.html.
// fixtures/sketchGolden.json = the numbers that sketch gives (its script was run on 2026-11-13 for the four examples and four more cases), so a change of the model that
// moves a number is seen here. The sketch's own names (projects, maxTasks ...) are mapped to the names of CostInput below.
import { COEFFICIENT_INFO, DEFAULT_COEFFICIENTS, coefficientChanges, isCoefficientOverrides, mergeCoefficients } from '../../../kit8/system/costcalculator/costCoefficients';
import { COST_EXAMPLES, DEFAULT_COST_INPUT, calculateCosts, costExampleInput, diskAfterMonths, isCostInput, nextMachineChange, normalizeCostInput, type CostInput, type LimitingFactor } from '../../../kit8/system/costcalculator/costModel';
import { BUILT_IN_PRICES } from '../../../kit8/system/costcalculator/supabasePrices';

const golden: any[] = require('./fixtures/sketchGolden.json');

const fromSketch = (s: any): CostInput => ({
  numberOfProjects: s.projects, maximumTasksInOneProject: s.maxTasks, maximumPlanLinesInOneProject: s.maxLines, numberOfUsers: s.users,
  dateChangesPerMonth: s.dateChanges, planLineChangesPerMonth: s.lineChanges, taskPostsPerMonth: s.posts, documentsPostedPerMonth: s.documents,
  roiForTasksEnabled: s.roiTasks, roiHistoryEnabled: s.roiHistory, reportRequestsPerMonth: s.reports, reportOpenMinutes: s.reportMinutes,
  averageProjectFillPercent: s.fill, planRowsPerLine: s.planRowsPerLine, concurrentUsersPercent: s.concurrent, projectOpensPerUserPerDay: s.opensPerDay,
  savedVersionsPerProject: s.versions, monthsOfDocumentsKept: 24, cronLogCleaned: s.cronCleaned, realtimeEnabled: s.realtime, plan: s.plan,
  secondEnvironment: s.secondEnv, pointInTimeRecovery: s.pitr, customDomain: s.domain, ipv4Address: s.ipv4,
});
const factorOf = (why: string, limited: boolean): LimitingFactor | null =>
  !limited ? null : why === 'memory' ? 'memory' : why === 'CPU' ? 'cpu' : why === 'database size' ? 'databaseSize' : why === 'biggest project' ? 'biggestProject'
    : why === 'point in time recovery' ? 'pointInTimeRecovery' : 'aboveList';
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(b)));

describe('the port gives the numbers of the sketch', () => {
  it('has the cases', () => expect(golden.map((g) => g.name)).toEqual(['Small team', 'Medium (the defaults)', 'Large', 'Very large', 'roi+nocleanup+team+extras', 'huge', 'realtime off']));

  for (const g of ['Small team', 'Medium (the defaults)', 'Large', 'Very large', 'roi+nocleanup+team+extras', 'huge', 'realtime off']) {
    it(g, () => {
      const s = golden.find((x) => x.name === g);
      const r = calculateCosts(fromSketch(s.input));
      close(r.totalPerMonth, s.total);
      expect(r.machine.size).toBe(s.vm);
      expect(r.limitingFactor).toBe(factorOf(s.why, s.limited));
      close(r.databaseGB, s.dbGB); expect(r.diskGB).toBe(s.diskGB);
      close(r.neededMemoryGB, s.ramGB); close(r.neededVcpu, s.vcpu); close(r.cpuLoad, s.load);
      expect(r.realtimeConnections).toBe(s.rtConn); close(r.realtimeMessages, s.rtMsg); close(r.egressGB, s.egressGB);
      close(r.tasksTotal, s.tasks); close(r.linesTotal, s.lines); close(r.planRowsTotal, s.planRows);
      close(r.perUser, s.perUser); close(r.perProject, s.perProject);
      expect(r.bill.map((b) => b.usd).length).toBe(s.bill.length);
      r.bill.forEach((b, n) => close(b.usd, s.bill[n]));
    });
  }

  it('the four examples of the spec are built from COST_EXAMPLES with the same numbers', () => {
    const names = ['Small team', 'Medium (the defaults)', 'Large', 'Very large'];
    COST_EXAMPLES.forEach((e, n) => {
      expect(e.title).toBe(names[n]);
      const s = golden.find((x) => x.name === names[n]);
      expect(costExampleInput(e.overrides)).toEqual(fromSketch(s.input));
    });
  });
});

describe('the answers a person would check by hand', () => {
  it('the defaults: Pro fee only, the machine is covered by the credits', () => {
    const r = calculateCosts(DEFAULT_COST_INPUT);
    expect(r.totalPerMonth).toBeCloseTo(25, 6);
    expect(r.machine.size).toBe('Micro');
    expect(r.limitingFactor).toBeNull();
    expect(r.totalPerYear).toBeCloseTo(300, 6);
    expect(r.bill.map((b) => b.id)).toEqual(['planFee', 'machine', 'secondEnvironment', 'disk', 'egress', 'realtimeConnections', 'realtimeMessages', 'users', 'addons']);
    expect(r.diskParts[0].kb).toBeGreaterThanOrEqual(r.diskParts[1].kb);
  });
  it('Team plan, second environment and add-ons are added one by one', () => {
    const base = calculateCosts(DEFAULT_COST_INPUT).totalPerMonth;
    expect(calculateCosts({ ...DEFAULT_COST_INPUT, plan: 'team' }).totalPerMonth - base).toBeCloseTo(599 - 25, 6);
    expect(calculateCosts({ ...DEFAULT_COST_INPUT, secondEnvironment: true }).totalPerMonth - base).toBeCloseTo(10, 6);
    expect(calculateCosts({ ...DEFAULT_COST_INPUT, customDomain: true, ipv4Address: true }).totalPerMonth - base).toBeCloseTo(14, 6);
  });
  it('point in time recovery needs at least Small and says why', () => {
    const r = calculateCosts({ ...DEFAULT_COST_INPUT, pointInTimeRecovery: true });
    expect(r.machine.size).toBe('Small');
    expect(r.limitingFactor).toBe('pointInTimeRecovery');
    expect(r.bill.find((b) => b.id === 'addons')!.usd).toBe(100);
  });
  it('a project with more than 2 000 / 10 000 / 50 000 tasks needs Small / Medium / Large at least', () => {
    const size = (maximumTasksInOneProject: number) => calculateCosts({ ...DEFAULT_COST_INPUT, numberOfProjects: 1, maximumTasksInOneProject, maximumPlanLinesInOneProject: 10 }).machine.size;
    expect([size(2000), size(2001), size(10001), size(50001)]).toEqual(['Micro', 'Small', 'Medium', 'Large']);
    expect(calculateCosts({ ...DEFAULT_COST_INPUT, numberOfProjects: 1, maximumTasksInOneProject: 2001, maximumPlanLinesInOneProject: 10 }).limitingFactor).toBe('biggestProject');
  });
  it('an uncleaned pg_cron log makes the disk grow with the months, a cleaned one does not', () => {
    const cleaned = { ...DEFAULT_COST_INPUT, cronLogCleaned: true };
    const dirty = { ...DEFAULT_COST_INPUT, cronLogCleaned: false };
    expect(diskAfterMonths(cleaned, 24)).toBeLessThanOrEqual(diskAfterMonths(cleaned, 12) + 1);
    expect(diskAfterMonths(dirty, 24)).toBeGreaterThan(diskAfterMonths(dirty, 12));
    expect(diskAfterMonths(dirty, 24)).toBeGreaterThan(diskAfterMonths(cleaned, 24));
  });
  it('realtime off = no connections and no messages', () => {
    const r = calculateCosts({ ...DEFAULT_COST_INPUT, realtimeEnabled: false });
    expect([r.realtimeConnections, r.realtimeMessages]).toEqual([0, 0]);
  });
  it('a price typed by hand wins: another price list changes the bill', () => {
    const dearer = { ...BUILT_IN_PRICES, plans: { ...BUILT_IN_PRICES.plans, pro: { fee: 30, computeCredits: 10 } } };
    expect(calculateCosts(DEFAULT_COST_INPUT, dearer).totalPerMonth).toBeCloseTo(30, 6);
  });
  it('a changed coefficient changes the answer (bloat x 3 makes a bigger database)', () => {
    const a = calculateCosts(DEFAULT_COST_INPUT).databaseGB;
    const b = calculateCosts(DEFAULT_COST_INPUT, BUILT_IN_PRICES, { ...DEFAULT_COEFFICIENTS, bloat: DEFAULT_COEFFICIENTS.bloat * 3 }).databaseGB;
    expect(b / a).toBeCloseTo(3, 6);
  });
  it('zero everything does not divide by zero', () => {
    const r = calculateCosts({ ...DEFAULT_COST_INPUT, numberOfProjects: 0, maximumTasksInOneProject: 0, maximumPlanLinesInOneProject: 0, numberOfUsers: 0 });
    for (const v of [r.totalPerMonth, r.perUser, r.perProject, r.neededVcpu, r.neededMemoryGB, r.egressGB, r.cpuLoad]) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('the machine the next size is needed at', () => {
  it('finds the number of projects / users at which the machine becomes bigger, and it really does', () => {
    const start = calculateCosts(DEFAULT_COST_INPUT);
    const next = nextMachineChange(DEFAULT_COST_INPUT)!;
    expect(next).not.toBeNull();
    expect(next.projects).toBeGreaterThan(DEFAULT_COST_INPUT.numberOfProjects);
    expect(next.users).toBeGreaterThan(DEFAULT_COST_INPUT.numberOfUsers);
    expect(next.perMonth).toBeGreaterThan(start.machine.perMonth);
    expect(next.size).not.toBe(start.machine.size);
    // projects, users and the activity grow together by the same factor: at that point the machine really is the bigger one
    const f = next.projects / DEFAULT_COST_INPUT.numberOfProjects;
    const grown = { ...DEFAULT_COST_INPUT, numberOfProjects: next.projects, numberOfUsers: next.users };
    for (const key of ['dateChangesPerMonth', 'planLineChangesPerMonth', 'taskPostsPerMonth', 'documentsPostedPerMonth', 'reportRequestsPerMonth'] as const) grown[key] = Math.round(DEFAULT_COST_INPUT[key] * f);
    expect(calculateCosts(grown).machine.size).toBe(next.size);
  });
  it('says nothing when the list is already exceeded', () => {
    const huge = fromSketch(golden.find((g) => g.name === 'huge').input);
    expect(nextMachineChange(huge)).toBeNull();
  });
});

describe('input and coefficient helpers', () => {
  it('normalizeCostInput fills, clamps and cleans', () => {
    expect(normalizeCostInput(null)).toEqual(DEFAULT_COST_INPUT);
    const n = normalizeCostInput({ numberOfUsers: -5, averageProjectFillPercent: 250, concurrentUsersPercent: 400, planRowsPerLine: NaN, plan: 'free' as any, realtimeEnabled: 'yes' as any, numberOfProjects: 7 });
    expect(n).toMatchObject({ numberOfUsers: DEFAULT_COST_INPUT.numberOfUsers, averageProjectFillPercent: 100, concurrentUsersPercent: 100, planRowsPerLine: 6, plan: 'pro', realtimeEnabled: true, numberOfProjects: 7 });
    expect(normalizeCostInput({ averageProjectFillPercent: 0 }).averageProjectFillPercent).toBe(1);
  });
  it('isCostInput accepts only a complete input', () => {
    expect(isCostInput(DEFAULT_COST_INPUT)).toBe(true);
    expect(isCostInput({ ...DEFAULT_COST_INPUT, plan: 'free' })).toBe(false);
    expect(isCostInput({ ...DEFAULT_COST_INPUT, numberOfUsers: '30' })).toBe(false);
    const { plan, ...noPlan } = DEFAULT_COST_INPUT;
    expect(isCostInput(noPlan)).toBe(false);
    expect(isCostInput(null)).toBe(false);
  });
  it('every coefficient has a description, and the changes are only what differs', () => {
    expect(COEFFICIENT_INFO.map((c) => c.key).sort()).toEqual(Object.keys(DEFAULT_COEFFICIENTS).sort());
    expect(coefficientChanges(DEFAULT_COEFFICIENTS)).toEqual({});
    const c = mergeCoefficients({ bloat: 2, peakFactor: -1, nonsense: 5, kbTask: 'x' });
    expect(c.bloat).toBe(2);
    expect(c.peakFactor).toBe(DEFAULT_COEFFICIENTS.peakFactor);
    expect(coefficientChanges(c)).toEqual({ bloat: 2 });
    expect(isCoefficientOverrides({ bloat: 2 })).toBe(true);
    expect(isCoefficientOverrides({ bloat: '2' })).toBe(false);
    expect(isCoefficientOverrides([])).toBe(false);
  });
});
