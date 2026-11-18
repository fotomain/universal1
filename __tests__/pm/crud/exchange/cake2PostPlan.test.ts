// documentation/CAKE2 RUN1 (cake2_plan_json.json): the Post of EVERY task of the plan, with the app's own calculation (calculateTaskLinePlan) on the dates the app's scheduler gives and the days of the
// calendar the project posts with (sixDayWeekCalendar = Mon-Sat, no holidays). Checks: nothing is refused, every line gets its days, the coefficients add up to 1, the money of the
// days (Correct033, as the SQL procedure rounds it) adds up to the line. CAKE2_POST_OUT=<file> writes the payloads of create_task_line_plan for the Docker check.
import * as fs from 'fs';
import * as path from 'path';
import { parseProjectExchangeFile } from '../../../../kit8/pm/crud/exchange/project/projectExchangeFormat';
import { formatDateISO } from '../../../../kit8/pm/view/project/scheduling';
import { buildHourAxis } from '../../../../kit8/pm/hourmodel/hourAxis';
import { hourModelOf } from '../../../../kit8/pm/hourmodel/hourModelSettings';
import { scheduleProjectHours } from '../../../../kit8/pm/hourmodel/scheduleHours';
import { withHourSlices } from '../../../../kit8/pm/hourmodel/hourPostPlan';
import { calculateTaskLinePlan, distributeCorrect033 } from '../../../../kit8/pm/view/task/plan/calculateTaskLinePlan';
import { postableLines } from '../../../../kit8/pm/view/task/plan/taskLinePlanModel';

const FILE = process.env.CAKE2_JSON || path.resolve(__dirname, '../../../../documentation/CAKE2/cake2_plan_json.json');
const has = fs.existsSync(FILE);
const d = has ? describe : describe.skip;
const DAY = 86400000;

d('CAKE2 / RUN1 plan: Post of every task', () => {
  const file = has ? parseProjectExchangeFile(fs.readFileSync(FILE, 'utf8')) : (null as any);
  // the time-of-day model: the plan of the app's own scheduler on the working-minute axis (project day 00:00-24:00, Mon-Sat) = the pieces of every bar, the slices of Post
  const sched = has ? scheduleProjectHours({
    tasks: file.tasks, deps: file.dependencies, projectStartMs: Date.UTC(2025, 11, 29),
    axis: buildHourAxis({ windows: hourModelOf(file.project.rowJSON).windows, calendar: { skipWeekends: false, workWeek: [false, true, true, true, true, true, true] }, originMs: Date.UTC(2025, 11, 29) }),
  }) : (null as any);
  // the days the project posts with: sixDayWeekCalendar as seeded in start4 (every day but Sunday, 2025-2027)
  const calendarDays = (from: string, to: string) => {
    const out: { rowJSON: { day: string; isActive: boolean } }[] = [];
    for (let ms = Date.parse(from); ms <= Date.parse(to); ms += DAY) out.push({ rowJSON: { day: formatDateISO(ms), isActive: new Date(ms).getUTCDay() !== 0 } });
    return out;
  };
  const distributions = [{ rowGUID: 'uniformDistribution', rowJSON: { title: 'Uniform (even)' } }] as any[];
  const byTask = new Map<string, any[]>();
  for (const l of has ? file.taskLines ?? [] : []) byTask.set(l.rowOwnerGUID, [...(byTask.get(l.rowOwnerGUID) ?? []), l]);

  it('the project posts with the six day calendar and in EUR', () => {
    expect(file.project.rowJSON).toMatchObject({ calendarForTaskPlan: 'sixDayWeekCalendar', currencyForBudget: 'EUR', budgetScenarioForPlan: 'planScenarioProject1' });
    expect(file.taskLines.length).toBeGreaterThan(300);
  });

  it('every line has what Post needs (budget item, distribution, qty, sums) and sits on a task, never on a stage', () => {
    const tasks = new Map<string, any>(file.tasks.map((t: any) => [t.rowGUID, t]));
    for (const l of file.taskLines) {
      expect(tasks.get(l.rowOwnerGUID)?.rowJSON.rowKind).toBe('task');
      expect(['timeGenus', 'materialGenus', 'revenueGenus']).toContain(l.rowParentGUID);
      expect(l.rowJSON).toMatchObject({ distributionForBudgetTaskLine: 'uniformDistribution', taskIsPosted: false });
      expect(typeof l.rowJSON.budgetItemTaskLine).toBe('string');
      expect(l.rowJSON.qtyTaskLine).toBeGreaterThan(0);
      expect(l.rowJSON.sumForBudget).toBe(Math.round(l.rowJSON.qtyTaskLine * l.rowJSON.priceTaskLine * 100 + 1e-7) / 100);
    }
  });

  it('Post of every task: nothing is refused, the days of every line add up to its qty and sums', () => {
    const payloads: any[] = [];
    let lines = 0, tasks = 0, sum = 0, days = 0;
    for (const [taskGUID, ls] of byTask) {
      const row = sched.rows[taskGUID];
      const from = formatDateISO(row.startMs), to = formatDateISO(row.finishMs > row.startMs ? row.finishMs - 1 : row.startMs);
      const plan = calculateTaskLinePlan({ taskGUID, fromDay: from, toDay: to, lines: ls as any, calendarDays: calendarDays(from, to), distributions, calendarTitle: '6-day week', timeZone: 'UTC' });
      expect(plan.errors).toEqual([]);
      expect(plan.taskLinePlanJSON).not.toBeNull();
      // the SLICES of every Time line of a person over the pieces of the bar (what create_task_line_plan checks to the minute): they add up to 1 and to the day rows
      const withSlices = withHourSlices(plan.taskLinePlanJSON, ls as any, row.pieces)!;
      for (const pl of withSlices.lines) {
        const src = ls.find((x: any) => x.rowGUID === pl.lineGUID)!;
        if (src.rowParentGUID !== 'timeGenus') { expect((pl as any).hours).toBeUndefined(); continue; }
        const hours = (pl as any).hours as { d: string; f: number; t: number; c: number }[];
        expect(hours.length).toBeGreaterThanOrEqual(1);
        expect(hours.reduce((a, x) => a + x.c, 0)).toBeCloseTo(1, 9);
        for (const x of hours) { expect(x.f).toBeGreaterThanOrEqual(0); expect(x.t).toBeLessThanOrEqual(1440); expect(x.t).toBeGreaterThan(x.f); }
        for (const dd of pl.days) expect(hours.filter((x) => x.d === dd.d).reduce((a, x) => a + x.c, 0)).toBeCloseTo(dd.c, 9);
        expect(hours.reduce((a, x) => a + (x.t - x.f), 0)).toBe(row.durationMinutes);
      }
      expect(plan.postedLines).toHaveLength(postableLines(ls as any).length);
      for (const pl of plan.taskLinePlanJSON!.lines) {
        const src = ls.find((x: any) => x.rowGUID === pl.lineGUID)!;
        expect(pl.days.reduce((a: number, x: any) => a + x.c, 0)).toBeCloseTo(1, 9);
        const parts = distributeCorrect033(pl.sumForBudget as number, pl.days.map((x: any) => x.c));
        expect(Math.round(parts.reduce((a: number, b) => a + (b as number), 0) * 100)).toBe(Math.round(src.rowJSON.sumForBudget * 100));
        sum += src.rowJSON.sumForBudget;
        days += pl.days.length;
        lines++;
      }
      tasks++;
      payloads.push(withSlices);
    }
    expect(lines).toBe(file.taskLines.length);
    expect(tasks).toBe(byTask.size); // every operation of a person + every order line + every goods receipt
    expect(Math.round(sum * 100) / 100).toBeCloseTo(file.taskLines.reduce((a: number, l: any) => a + l.rowJSON.sumForBudget, 0), 2);
    if (process.env.CAKE2_POST_OUT) fs.writeFileSync(process.env.CAKE2_POST_OUT, JSON.stringify(payloads));
    // one day per operation (every operation lies inside one day); the order lines of Mon 29 Dec and the work of Thu 1 Jan are posted too (the six day calendar has no holiday)
    expect(days).toBeGreaterThanOrEqual(lines);
  });
});
