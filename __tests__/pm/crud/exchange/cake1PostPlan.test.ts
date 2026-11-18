// documentation/CAKE1: the Post of EVERY task of the plan, with the app's own calculation (calculateTaskLinePlan) on the dates the app's scheduler gives and the days of the
// calendar the project posts with (sixDayWeekCalendar = Mon-Sat, no holidays). Checks: nothing is refused, every line gets its days, the coefficients add up to 1, the money of the
// days (Correct033, as the SQL procedure rounds it) adds up to the line. CAKE1_POST_OUT=<file> writes the payloads of create_task_line_plan for the Docker check.
import * as fs from 'fs';
import * as path from 'path';
import { parseProjectExchangeFile } from '../../../../kit8/pm/crud/exchange/project/projectExchangeFormat';
import { scheduleProject, formatDateISO } from '../../../../kit8/pm/view/project/scheduling';
import { calculateTaskLinePlan, distributeCorrect033 } from '../../../../kit8/pm/view/task/plan/calculateTaskLinePlan';
import { postableLines } from '../../../../kit8/pm/view/task/plan/taskLinePlanModel';

const FILE = process.env.CAKE1_JSON || path.resolve(__dirname, '../../../../documentation/CAKE1/cake1_plan_json.json');
const has = fs.existsSync(FILE);
const d = has ? describe : describe.skip;
const DAY = 86400000;

d('CAKE1 plan: Post of every task', () => {
  const file = has ? parseProjectExchangeFile(fs.readFileSync(FILE, 'utf8')) : (null as any);
  const sched = has ? scheduleProject({ tasks: file.tasks, deps: file.dependencies, projectStartMs: Date.UTC(2026, 0, 1), calendar: { skipWeekends: false } }) : (null as any);
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
    expect(file.taskLines.length).toBe(3252);
  });

  it('every line has what Post needs (budget item, distribution, qty, sums) and sits on a task, never on a stage', () => {
    const tasks = new Map<string, any>(file.tasks.map((t: any) => [t.rowGUID, t]));
    for (const l of file.taskLines) {
      expect(tasks.get(l.rowOwnerGUID)?.rowJSON.rowKind).toBe('task');
      expect(['timeGenus', 'materialGenus']).toContain(l.rowParentGUID);
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
      payloads.push(plan.taskLinePlanJSON);
    }
    expect(lines).toBe(3252);
    expect(tasks).toBe(1332); // 1 240 worker operations + 68 order lines + 24 goods receipts
    expect(Math.round(sum * 100) / 100).toBeCloseTo(file.taskLines.reduce((a: number, l: any) => a + l.rowJSON.sumForBudget, 0), 2);
    if (process.env.CAKE1_POST_OUT) fs.writeFileSync(process.env.CAKE1_POST_OUT, JSON.stringify(payloads));
    // one day per operation (every operation lies inside one day); the order lines on 1 Jan are posted too (the six day calendar has no holiday)
    expect(days).toBeGreaterThanOrEqual(lines);
  });
});
