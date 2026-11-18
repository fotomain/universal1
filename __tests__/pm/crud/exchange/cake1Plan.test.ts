// documentation/CAKE1: the plan file cake1_plan_json.json (made by cake_v1_optimization.py) goes through the REAL importer and scheduler of the app:
//   parse (projectExchangeFormat) -> plan the import into the target project (planProjectImport) -> schedule (scheduleProject)
// and the business rules of the task are checked on the result: 200 cakes per position, <= 10 worker operations per cake, orders >= 2 days before the delivery,
// every pinned day / link survives the CPM pass, the hour and minute fields are valid, the custom columns are all defined.
// Set CAKE1_JSON=<path> to test another file; without the file the suite is skipped.
import * as fs from 'fs';
import * as path from 'path';
import { parseProjectExchangeFile } from '../../../../kit8/pm/crud/exchange/project/projectExchangeFormat';
import { planProjectImport } from '../../../../kit8/pm/crud/exchange/project/import/planProjectImport';
import { scheduleProject, parseDateISO, projectTreePath } from '../../../../kit8/pm/view/project/scheduling';
import { normalizeTreeColumnsOrder } from '../../../../kit8/pm/view/tree/columns/treeColumns';
import { projectCustomColumnsOf, taskCustomValuesOf } from '../../../../kit8/pm/view/tree/columns/customColumns';
import type { PMProjectRow } from '../../../../kit8/pm/model/types';

const FILE = process.env.CAKE1_JSON || path.resolve(__dirname, '../../../../documentation/CAKE1/cake1_plan_json.json');
const PROJECT = '8e3e5544-5d86-4831-b116-420e6f9bde87';
const OWNER = '11111111-1111-4111-8111-111111111111';
const DAY = 86400000;
const has = fs.existsSync(FILE);
const d = has ? describe : describe.skip;

d('CAKE1 plan file -> appPM80 import', () => {
  const text = has ? fs.readFileSync(FILE, 'utf8') : '{}';
  const file = has ? parseProjectExchangeFile(text) : (null as any);
  const target: PMProjectRow = {
    rowGUID: PROJECT, treePath: projectTreePath(PROJECT), rowOwnerGUID: OWNER, rowDuration: null, rowProgress: 0, orderInList: 1,
    rowJSON: { rowKind: 'project', name: 'My target project', durationDays: 0 } as any,
  };
  let seq = 0;
  const newId = () => `bbbbbbbb-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const plan = has ? planProjectImport(file, target, OWNER, newId) : (null as any);
  const byTitle = (rows: any[]) => rows.map((t) => [t.rowGUID, t.rowJSON.taskDescription as string] as const);

  it('is a project file of the project it was made for, with its tasks and links', () => {
    expect(file.format).toBe('kit8.pm.project');
    expect(file.project.rowGUID).toBe(PROJECT);
    expect(file.tasks.length).toBeGreaterThan(1000);
    expect(file.dependencies.length).toBeGreaterThan(1000);
    expect(plan.tasks).toHaveLength(file.tasks.length);
    expect(plan.dependencies).toHaveLength(file.dependencies.length);
    expect(plan.skippedDependencies).toBe(0);
    expect(plan.projectRowJSON).toMatchObject({ name: 'My target project', planDay: true, planHour: true, planMinute: true, skipWeekends: false, calendarForTaskPlan: 'sixDayWeekCalendar', currencyForBudget: 'EUR' });
    expect(plan.taskLines).toHaveLength(3252);
    expect(plan.skippedLines).toBe(0);
  });

  it('every row has a parent before it and a tree path under the target project', () => {
    const seen = new Set<string>();
    for (const t of plan.tasks) {
      const labels = t.treePath.split('.');
      expect(labels[0]).toBe(projectTreePath(PROJECT));
      if (labels.length > 2) expect(seen.has(labels.slice(0, -1).join('.'))).toBe(true);
      seen.add(t.treePath);
    }
  });

  it('the days, hours and minutes are valid and every custom column of a row is defined by the project', () => {
    const defs = new Set(projectCustomColumnsOf(file.project.rowJSON).columns.map((c) => c.key));
    expect(defs.size).toBeGreaterThanOrEqual(10);
    for (const t of file.tasks) {
      const j: any = t.rowJSON;
      for (const k of Object.keys(taskCustomValuesOf(j))) expect(defs.has(k as any)).toBe(true);
      if (j.rowKind === 'stage') continue;
      expect(j.durationDays).toBeGreaterThanOrEqual(1);
      for (const k of ['startHourStart', 'startHourFinish']) expect(Number.isInteger(j[k]) && j[k] >= 0 && j[k] <= 23).toBe(true);
      for (const k of ['planMinuteStart', 'planMinuteFinish']) expect(Number.isInteger(j[k]) && j[k] >= 0 && j[k] <= 59).toBe(true);
      expect(parseDateISO(String(j.manualStartAt).slice(0, 10))).not.toBeNull();
    }
    // the saved column order is accepted by the tree (every key known)
    const order = normalizeTreeColumnsOrder(file.uxuiSettings.treeColumnsOrder, [...defs] as string[]);
    for (const k of file.uxuiSettings.treeColumnsOrder) expect(order).toContain(k);
  });

  it('the app scheduler puts every operation on the day the optimizer chose (pins + links, no cycle)', () => {
    const res = scheduleProject({ tasks: plan.tasks, deps: plan.dependencies, projectStartMs: Date.UTC(2026, 0, 1), calendar: { skipWeekends: false } });
    expect(res.cycleGUIDs).toEqual([]);
    let leaves = 0;
    for (const t of plan.tasks) {
      const j: any = t.rowJSON;
      if (j.rowKind === 'stage') continue;
      leaves++;
      const row = res.rows[t.rowGUID];
      const want = parseDateISO(String(j.manualStartAt).slice(0, 10))!;
      expect(`${j.taskDescription}: ${new Date(row.startMs).toISOString().slice(0, 10)}`).toBe(`${j.taskDescription}: ${new Date(want).toISOString().slice(0, 10)}`);
      expect(row.finishMs).toBe(want + j.durationDays * DAY);
    }
    expect(leaves).toBeGreaterThan(1500);
    expect(new Date(res.projectStartMs).toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(new Date(res.projectFinishMs - DAY).getTime()).toBeLessThanOrEqual(Date.UTC(2026, 0, 31));
  });

  describe('the business rules of the task', () => {
    const stages = (rows: any[]) => rows.filter((t) => t.rowJSON.rowKind === 'stage');
    const cakeStages = stages(file?.tasks ?? []).filter((t: any) => t.treePath.split('.').length === 2 && / cakes × 5 kg /.test(t.rowJSON.taskDescription));

    it('8 cake positions, each 200 cakes of 5 kg in 20 batches of 10 (1 stage per cake, a stage per batch)', () => {
      expect(cakeStages).toHaveLength(8);
      for (const cs of cakeStages) {
        const label = cs.treePath.split('.').pop()!;
        const batches = stages(file.tasks).filter((t: any) => t.treePath.split('.').length === 3 && t.treePath.split('.')[1] === label);
        expect(batches).toHaveLength(20);
        const cakes = batches.reduce((n: number, b: any) => n + Number(/· (\d+) cakes ·/.exec(b.rowJSON.taskDescription)![1]), 0);
        expect(cakes).toBe(200);
      }
    });

    it('at most 10 worker operations per cake (a batch has <= 10 tasks with a person)', () => {
      for (const cs of cakeStages) {
        const label = cs.treePath.split('.').pop()!;
        const ops = file.tasks.filter((t: any) => t.treePath.split('.').length === 4 && t.treePath.split('.')[1] === label);
        const perBatch = new Map<string, number>();
        for (const t of ops) {
          const cc: any = t.rowJSON.customColumns;
          if (cc?.cc_role === 'Confectioner') perBatch.set(t.treePath.split('.')[2], (perBatch.get(t.treePath.split('.')[2]) ?? 0) + 1);
        }
        expect(perBatch.size).toBe(20);
        for (const n of perBatch.values()) expect(n).toBeLessThanOrEqual(10);
        for (const t of ops) expect(t.rowJSON.durationDays).toBeGreaterThanOrEqual(1);
      }
    });

    it('every purchase order line is placed >= 2 calendar days before its delivery, and the first delivery is not before 3 Jan', () => {
      const lines = file.tasks.filter((t: any) => t.rowJSON.customColumns?.cc_order && t.rowJSON.customColumns?.cc_deliv && t.rowJSON.customColumns?.cc_role === 'Purchasing manager');
      expect(lines.length).toBeGreaterThan(40);
      let first = '9999';
      for (const t of lines) {
        const cc: any = t.rowJSON.customColumns;
        const gap = (Date.parse(cc.cc_deliv) - Date.parse(cc.cc_order)) / DAY;
        expect(gap).toBeGreaterThanOrEqual(2);
        expect(String(t.rowJSON.manualStartAt).slice(0, 10)).toBe(cc.cc_order);
        if (cc.cc_deliv < first) first = cc.cc_deliv;
        expect(cc.cc_order >= '2026-01-01').toBe(true);
      }
      expect(first).toBe('2026-01-03');
    });

    it('worker names are made up, unique and every worker has a shift pattern with a day off in the title', () => {
      const staff = file.tasks.filter((t: any) => /Confectioner · (Early|Late)/.test(t.rowJSON.taskDescription));
      expect(staff.length).toBeGreaterThanOrEqual(5);
      const names = staff.map((t: any) => t.rowJSON.customColumns.cc_worker);
      expect(new Set(names).size).toBe(names.length);
      for (const t of staff) expect(t.rowJSON.taskDescription).toMatch(/day off (Mon|Tue|Wed|Thu|Fri|Sat)/);
    });

    it('no operation of a person overlaps another one of the same person (day, from, to)', () => {
      const per = new Map<string, { s: number; e: number }[]>();
      for (const t of file.tasks) {
        const cc: any = t.rowJSON.customColumns;
        if (cc?.cc_role !== 'Confectioner' || t.rowJSON.rowKind === 'stage' || !cc.cc_from) continue;
        const day = Date.parse(String(t.rowJSON.manualStartAt).slice(0, 10));
        const [h1, m1] = String(cc.cc_from).split(':').map(Number);
        const [h2, m2] = String(cc.cc_to).split(':').map(Number);
        const arr = per.get(cc.cc_worker) ?? [];
        arr.push({ s: day + (h1 * 60 + m1) * 60000, e: day + (h2 * 60 + m2) * 60000 });
        per.set(cc.cc_worker, arr);
      }
      expect(per.size).toBeGreaterThanOrEqual(5);
      for (const [, arr] of per) {
        arr.sort((a, b) => a.s - b.s);
        for (let i = 1; i < arr.length; i++) expect(arr[i].s).toBeGreaterThanOrEqual(arr[i - 1].e);
      }
    });
  });
});
