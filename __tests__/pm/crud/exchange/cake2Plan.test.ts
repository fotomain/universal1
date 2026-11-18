// documentation/CAKE1 RUN1: the plan file cake2_plan_json.json + total_costs.csv (made by cake_v1_optimization.py) goes through the REAL importer and scheduler of the app:
//   parse (projectExchangeFormat) -> plan the import into the target project (planProjectImport) -> schedule (scheduleProject)
// and the business rules of the task are checked on the result: 20 cakes per position (2 production days from 2026-01-01), <= 10 worker operations per cake, orders >= 2 days before the delivery,
// every pinned day / link survives the CPM pass, the hour and minute fields are valid, the custom columns are all defined.
// Set CAKE2_JSON=<path> to test another file; without the file the suite is skipped.
import * as fs from 'fs';
import * as path from 'path';
import { parseProjectExchangeFile } from '../../../../kit8/pm/crud/exchange/project/projectExchangeFormat';
import { planProjectImport } from '../../../../kit8/pm/crud/exchange/project/import/planProjectImport';
import { scheduleProject, parseDateISO, projectTreePath } from '../../../../kit8/pm/view/project/scheduling';
import { normalizeTreeColumnsOrder } from '../../../../kit8/pm/view/tree/columns/treeColumns';
import { projectCustomColumnsOf, taskCustomValuesOf } from '../../../../kit8/pm/view/tree/columns/customColumns';
import type { PMProjectRow } from '../../../../kit8/pm/model/types';

const FILE = process.env.CAKE2_JSON || path.resolve(__dirname, '../../../../documentation/CAKE1/cake2_plan_json.json')
const CSV = path.resolve(path.dirname(FILE), 'total_costs.csv');
const PROJECT = 'c79ba49f-5795-470f-899d-ed412eeb7cb5';
const OWNER = '11111111-1111-4111-8111-111111111111';
const DAY = 86400000;
const has = fs.existsSync(FILE);
const d = has ? describe : describe.skip;

d('CAKE1 / RUN1 plan file (cake2_plan_json.json) -> appPM80 import', () => {
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
    expect(file.project.rowGUID).not.toBe('8e3e5544-5d86-4831-b116-420e6f9bde87'); // the GUID of the first run is marked "do not use"
    expect(file.tasks.length).toBeGreaterThan(200);
    expect(file.dependencies.length).toBeGreaterThan(200);
    expect(plan.tasks).toHaveLength(file.tasks.length);
    expect(plan.dependencies).toHaveLength(file.dependencies.length);
    expect(plan.skippedDependencies).toBe(0);
    expect(plan.projectRowJSON).toMatchObject({ name: 'My target project', planDay: true, planHour: true, planMinute: true, skipWeekends: false, calendarForTaskPlan: 'sixDayWeekCalendar', currencyForBudget: 'EUR' });
    expect(plan.taskLines.length).toBeGreaterThan(300);
    expect(plan.taskLines).toHaveLength(file.taskLines.length);
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
    const res = scheduleProject({ tasks: plan.tasks, deps: plan.dependencies, projectStartMs: Date.UTC(2025, 11, 29), calendar: { skipWeekends: false } });
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
    expect(leaves).toBeGreaterThan(150);
    expect(new Date(res.projectStartMs).toISOString().slice(0, 10)).toBe('2025-12-29');
    expect(new Date(res.projectFinishMs - DAY).getTime()).toBeLessThanOrEqual(Date.UTC(2026, 0, 2));
  });

  describe('the business rules of the task', () => {
    const stages = (rows: any[]) => rows.filter((t) => t.rowJSON.rowKind === 'stage');
    const cakeStages = stages(file?.tasks ?? []).filter((t: any) => t.treePath.split('.').length === 2 && / cakes × 5 kg /.test(t.rowJSON.taskDescription));

    it('8 cake positions, each 20 cakes of 5 kg in 2 batches of 10 (1 stage per cake, a stage per batch)', () => {
      expect(cakeStages).toHaveLength(8);
      for (const cs of cakeStages) {
        const label = cs.treePath.split('.').pop()!;
        const batches = stages(file.tasks).filter((t: any) => t.treePath.split('.').length === 3 && t.treePath.split('.')[1] === label);
        expect(batches).toHaveLength(2);
        const cakes = batches.reduce((n: number, b: any) => n + Number(/· (\d+) cakes ·/.exec(b.rowJSON.taskDescription)![1]), 0);
        expect(cakes).toBe(20);
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
        expect(perBatch.size).toBe(2);
        for (const n of perBatch.values()) expect(n).toBeLessThanOrEqual(10);
        for (const t of ops) expect(t.rowJSON.durationDays).toBeGreaterThanOrEqual(1);
      }
    });

    it('every purchase order line is placed >= 2 calendar days before its delivery, the goods are there before the production (1 Jan)', () => {
      const lines = file.tasks.filter((t: any) => t.rowJSON.customColumns?.cc_order && t.rowJSON.customColumns?.cc_deliv && t.rowJSON.customColumns?.cc_role === 'Purchasing manager');
      expect(lines.length).toBeGreaterThan(20);
      let first = '9999';
      for (const t of lines) {
        const cc: any = t.rowJSON.customColumns;
        const gap = (Date.parse(cc.cc_deliv) - Date.parse(cc.cc_order)) / DAY;
        expect(gap).toBeGreaterThanOrEqual(2);
        expect(String(t.rowJSON.manualStartAt).slice(0, 10)).toBe(cc.cc_order);
        if (cc.cc_deliv < first) first = cc.cc_deliv;
        expect(cc.cc_order >= '2025-12-29').toBe(true);
        expect(cc.cc_deliv < '2026-01-01').toBe(true);
      }
      expect(first).toBe('2025-12-31');
    });

    it('the production is 1 Jan + 2 Jan 2026 only (2 days), every person works only on those days', () => {
      const prod = file.tasks.filter((t: any) => t.treePath.split('.').length === 4 && t.rowJSON.customColumns?.cc_role === 'Confectioner');
      expect(prod.length).toBeGreaterThan(100);
      const days = new Set(prod.map((t: any) => String(t.rowJSON.manualStartAt).slice(0, 10)));
      expect([...days].sort()).toEqual(['2026-01-01', '2026-01-02']);
    });

    it('total_costs.csv: the workers and the materials needed agree with the task lines of the file', () => {
      const rows = fs.readFileSync(CSV, 'utf8').trim().split('\n').slice(1).map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')));
      // columns: section,item,detail,supplier,qty_needed,qty_ordered,unit,unit_price_eur,cost_needed_eur,cost_ordered_eur,po,order_date,delivery_date,note
      const labour = rows.filter((r) => r[0] === 'labour');
      const conf = labour.filter((r) => r[2].startsWith('Confectioner'));
      const staff = file.tasks.filter((t: any) => /Confectioner · (Early|Late)/.test(t.rowJSON.taskDescription));
      expect(conf).toHaveLength(staff.length);
      const summary = rows.find((r) => r[0] === 'summary' && r[1] === 'confectioners needed')!;
      expect(Number(summary[4])).toBe(staff.length);
      const need = Number(rows.find((r) => r[0] === 'total' && r[1] === 'TOTAL')![8]);
      const costLines = file.taskLines.filter((l: any) => l.rowParentGUID !== 'revenueGenus').reduce((a: number, l: any) => a + l.rowJSON.sumForBudget, 0);
      expect(Math.abs(need - costLines)).toBeLessThan(1);
      const revenue = Number(rows.find((r) => r[0] === 'total' && r[1] === 'revenue (deliverables)')![8]);
      const revLines = file.taskLines.filter((l: any) => l.rowParentGUID === 'revenueGenus').reduce((a: number, l: any) => a + l.rowJSON.sumForBudget, 0);
      expect(Math.abs(revenue - revLines)).toBeLessThan(0.01);
    });

    it('the lines book REAL catalog rows: persons (Time), products + suppliers (Material), cakes + the customer (Deliverable); every id is made by CAKE2_CATALOG_DATA.sql', () => {
      const sql = fs.readFileSync(path.resolve(path.dirname(FILE), 'CAKE2_CATALOG_DATA.sql'), 'utf8');
      const known = (id: string) => sql.includes(`'${id}'`);
      const by = (g: string) => file.taskLines.filter((l: any) => l.rowParentGUID === g);
      const time = by('timeGenus'), mat = by('materialGenus'), rev = by('revenueGenus');
      expect(time.length).toBeGreaterThan(100);
      expect(rev).toHaveLength(16); // one Deliverable line per batch (8 cakes x 2 batches), on the packing task
      for (const l of time) {
        const j = l.rowJSON;
        expect(j.taskResourceKind).toBe('person');
        expect(j.priceSourceTaskLine).toBe('contract');
        for (const id of [j.taskResourceItem, j.taskResourceContract, j.resourceRoleItem]) expect(known(id)).toBe(true);
        expect(j.raciItem).toBe('raciResponsibleGUID');
      }
      for (const l of [...mat, ...rev]) {
        const j = l.rowJSON;
        expect(j.priceSourceTaskLine).toBe('product');
        for (const id of [j.taskResourceItem, j.resourceRoleItem, j.taskLinePartnerItem, j.taskLinePartnerContract]) expect(known(id)).toBe(true);
      }
      for (const l of rev) {
        expect(l.rowJSON).toMatchObject({ budgetItemTaskLine: 'saleOfGoodsBudgetItem', measureUnitTaskLine: 'unit_pcs', qtyTaskLine: 10 });
        expect(l.rowJSON.priceTaskLine).toBeGreaterThan(0);
      }
      // the people of the Time lines are exactly the people of the workforce stage (8 confectioners + the buyer + 2 keepers)
      expect(new Set(time.map((l: any) => l.rowJSON.taskResourceItem)).size).toBe(11);
    });

    it('worker names are made up, unique and every worker has a shift pattern with a day off in the title', () => {
      const staff = file.tasks.filter((t: any) => /Confectioner · (Early|Late)/.test(t.rowJSON.taskDescription));
      expect(staff.length).toBeGreaterThanOrEqual(7);
      const names = staff.map((t: any) => t.rowJSON.customColumns.cc_worker);
      expect(new Set(names).size).toBe(names.length);
      for (const t of staff) expect(t.rowJSON.taskDescription).toMatch(/day off (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/);
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
      expect(per.size).toBeGreaterThanOrEqual(7);
      for (const [, arr] of per) {
        arr.sort((a, b) => a.s - b.s);
        for (let i = 1; i < arr.length; i++) expect(arr[i].s).toBeGreaterThanOrEqual(arr[i - 1].e);
      }
    });
  });
});
