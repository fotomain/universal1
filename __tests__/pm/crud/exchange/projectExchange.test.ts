// kit8/pm/crud/exchange/project: export / import of a project with ALL its tasks (project_data_<rowGUID>.json).
import { createPMApi } from '../../../../kit8/pm/crud/api/api_pm';
import { buildDemoData } from '../../../../kit8/pm/model/seedDemo';
import { toLtreeLabel } from '../../../../kit8/pm/view/project/scheduling';
import {
  buildProjectExchangeFile,
  isProjectDataFileName,
  parseProjectExchangeFile,
  PMProjectExchangeError,
  projectDataFileName,
} from '../../../../kit8/pm/crud/exchange/project/projectExchangeFormat';
import { planProjectImport } from '../../../../kit8/pm/crud/exchange/project/import/planProjectImport';
import { exportProjectToFile } from '../../../../kit8/pm/crud/exchange/project/export/exportProjectToFile';
import { importProjectFromFile, pickProjectDataFile } from '../../../../kit8/pm/crud/exchange/project/import/importProjectFromFile';
import { applyBudgetSettingsOfImport } from '../../../../kit8/pm/crud/exchange/project/import/budgetSettingsOfImport';
import { createFakeSupabase } from '../fakeSupabaseTestKit';

const OWNER = '11111111-1111-4111-8111-111111111111';

function setup() {
  const db = createFakeSupabase();
  let n = 0;
  const demo = buildDemoData(OWNER, Date.UTC(2026, 8, 28), () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`);
  db.seed('project_table', demo.projects);
  db.seed('project_task_table', demo.tasks);
  db.seed('project_task_dependencies_table', demo.deps.map((d) => ({ ...d, rowJSON: {} })));
  const api = createPMApi(db as any);
  return { db, api, demo, P1: demo.projects[0], P2: demo.projects[1] };
}
let seq = 0;
const newId = () => `aaaaaaaa-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

describe('projectExchangeFormat', () => {
  it('file name project_data_<rowGUID>.json', () => {
    expect(projectDataFileName('abc-1')).toBe('project_data_abc-1.json');
    expect(isProjectDataFileName('project_data_abc-1.json')).toBe(true);
    expect(isProjectDataFileName('notes.json')).toBe(false);
  });

  it('build -> JSON -> parse keeps the project, its tasks and dependencies (only this project)', () => {
    const { demo, P1 } = setup();
    const file = buildProjectExchangeFile(P1, demo.tasks, demo.deps, { ganttArrowsForm: 'squareForm' }, new Date('2026-09-29T10:00:00Z'));
    const back = parseProjectExchangeFile(JSON.stringify(file));
    expect(back.format).toBe('kit8.pm.project');
    expect(back.exportedAt).toBe('2026-09-29T10:00:00.000Z');
    expect(back.project.rowGUID).toBe(P1.rowGUID);
    expect(back.tasks).toHaveLength(demo.tasks.filter((t) => t.projectGUID === P1.rowGUID).length);
    expect(back.tasks.every((t) => t.projectGUID === P1.rowGUID)).toBe(true);
    expect(back.dependencies.length).toBeGreaterThan(0);
    expect(back.uxuiSettings).toEqual({ ganttArrowsForm: 'squareForm' });
  });

  it.each([
    ['not json', /not valid JSON/],
    [JSON.stringify({ hello: 1 }), /not a project data file/],
    [JSON.stringify({ format: 'kit8.pm.project', version: 99, project: {}, tasks: [], dependencies: [] }), /Unsupported file version/],
    [JSON.stringify({ format: 'kit8.pm.project', version: 1, project: { rowGUID: 'p', rowJSON: {} }, tasks: [{ rowGUID: 'x' }], dependencies: [] }), /broken task row/],
  ])('rejects %s', (text, msg) => {
    expect(() => parseProjectExchangeFile(text as string)).toThrow(PMProjectExchangeError);
    expect(() => parseProjectExchangeFile(text as string)).toThrow(msg as RegExp);
  });
});

describe('task lines in a project file (optional taskLines)', () => {
  const LINE = (g: string, owner: string, genus = 'timeGenus') => ({ rowGUID: g, rowOwnerGUID: owner, rowParentGUID: genus, orderInList: 1024, rowJSON: { qtyTaskLine: 2, priceTaskLine: 21, sumForBudget: 42, taskIsPosted: true, baseOfDistribution: 1, description: 'Confectioner' } });

  it('a file without them imports as before; broken lines are refused', () => {
    const { demo, P1 } = setup();
    const file = buildProjectExchangeFile(P1, demo.tasks, demo.deps);
    expect(parseProjectExchangeFile(JSON.stringify(file)).taskLines).toBeUndefined();
    const bad = { ...file, taskLines: [{ rowGUID: 'x' }] };
    expect(() => parseProjectExchangeFile(JSON.stringify(bad))).toThrow('broken task line');
    expect(() => parseProjectExchangeFile(JSON.stringify({ ...file, taskLines: 5 }))).toThrow('not a list');
    const ok = { ...file, taskLines: [LINE('11111111-aaaa-4aaa-8aaa-000000000001', file.tasks[2].rowGUID)] };
    expect(parseProjectExchangeFile(JSON.stringify(ok)).taskLines).toHaveLength(1);
  });

  it('the plan puts the lines on the NEW task ids with new line ids, unposted; a line of a task that is not in the file is dropped', () => {
    const { demo, P1, P2 } = setup();
    const file = { ...buildProjectExchangeFile(P1, demo.tasks, demo.deps), taskLines: [] as any[] };
    const leaf = file.tasks.filter((t) => t.rowJSON.rowKind !== 'stage')[0];
    file.taskLines = [LINE('11111111-aaaa-4aaa-8aaa-000000000001', leaf.rowGUID), LINE('11111111-aaaa-4aaa-8aaa-000000000002', leaf.rowGUID, 'materialGenus'), LINE('11111111-aaaa-4aaa-8aaa-000000000003', 'deadbeef-0000-4000-8000-000000000000')];
    const plan = planProjectImport(file, P2, OWNER, newId);
    expect(plan.taskLines).toHaveLength(2);
    expect(plan.skippedLines).toBe(1);
    const newTask = plan.idMap[leaf.rowGUID];
    for (const l of plan.taskLines) {
      expect(l.rowOwnerGUID).toBe(newTask);
      expect(file.taskLines!.some((o) => o.rowGUID === l.rowGUID)).toBe(false);
      expect(l.rowJSON).toMatchObject({ taskIsPosted: false, baseOfDistribution: null, qtyTaskLine: 2, description: 'Confectioner' });
    }
    expect(plan.taskLines.map((l) => l.rowParentGUID)).toEqual(['timeGenus', 'materialGenus']);
    expect(plan.taskLines[0].rowJSON.taskIsPosted).toBe(false);
  });
});

describe('planProjectImport', () => {
  it('new ids, tree paths rebuilt under the target, dependencies follow, target keeps its name', () => {
    const { demo, P1, P2 } = setup();
    const file = buildProjectExchangeFile({ ...P1, rowJSON: { ...P1.rowJSON, skipWeekends: true, notes: 'n' } as any }, demo.tasks, demo.deps);
    const plan = planProjectImport(file, P2, OWNER, newId);
    const old = file.tasks;
    expect(plan.tasks).toHaveLength(old.length);
    const newIds = new Set(plan.tasks.map((t) => t.rowGUID));
    expect(old.some((t) => newIds.has(t.rowGUID))).toBe(false); // all new ids
    // parents first, every path = <target>.<...new ids>, parent exists earlier
    const seen = new Set<string>();
    for (const t of plan.tasks) {
      const labels = t.treePath.split('.');
      expect(labels[0]).toBe(toLtreeLabel(P2.rowGUID));
      expect(labels[labels.length - 1]).toBe(toLtreeLabel(t.rowGUID));
      if (labels.length > 2) expect(seen.has(labels.slice(0, -1).join('.'))).toBe(true);
      seen.add(t.treePath);
      expect(t).toMatchObject({ projectGUID: P2.rowGUID, rowOwnerGUID: OWNER });
    }
    // same shape: a stage keeps its children (by name)
    const byName = (rows: any[], name: string) => rows.find((t) => t.rowJSON.taskDescription === name);
    expect(byName(plan.tasks, 'Task 113').treePath.startsWith(byName(plan.tasks, 'Stage 1').treePath + '.')).toBe(true);
    // dependencies re-pointed
    expect(plan.dependencies).toHaveLength(file.dependencies.length);
    for (const d of plan.dependencies) expect(newIds.has(d.rowGUID) && newIds.has(d.rowDependsOnGUID)).toBe(true);
    expect(plan.projectRowJSON).toMatchObject({ name: P2.rowJSON.name, rowKind: 'project', skipWeekends: true, notes: 'n' });
    expect(plan.sourceProjectName).toBe(P1.rowJSON.name);
  });

  it('drops dependencies to rows missing in the file; broken tree paths are rejected', () => {
    const { demo, P1, P2 } = setup();
    const file = buildProjectExchangeFile(P1, demo.tasks, demo.deps);
    file.dependencies.push({ ...file.dependencies[0], rowDependsOnGUID: 'ffffffff-0000-4000-8000-000000000000' });
    expect(planProjectImport(file, P2, OWNER, newId).skippedDependencies).toBe(1);
    const broken = JSON.parse(JSON.stringify(file));
    broken.tasks[broken.tasks.length - 1].treePath = `${toLtreeLabel(P1.rowGUID)}.zzz.${toLtreeLabel(broken.tasks[broken.tasks.length - 1].rowGUID)}`;
    expect(() => planProjectImport(broken, P2, OWNER, newId)).toThrow(/no parent/);
  });
});

describe('exportProjectToFile -> importProjectFromFile (API on the in-memory Supabase)', () => {
  const asDropped = (name: string, text: string) => [{ name, mimeType: 'application/json', blob: new Blob([text], { type: 'application/json' }) }];

  async function exported() {
    const s = setup();
    let saved = { name: '', text: '' };
    const r = await exportProjectToFile(s.api, s.P1.rowGUID, {
      uxuiSettings: { showCriticalPath: false },
      download: async (name, text) => {
        saved = { name, text };
        return 'downloaded';
      },
    });
    return { ...s, r, saved };
  }

  it('export: project_data_<rowGUID>.json with the project and ALL its tasks (fresh from the DB)', async () => {
    const { r, saved, P1, db } = await exported();
    expect(saved.name).toBe(`project_data_${P1.rowGUID}.json`);
    expect(r.result).toBe('downloaded');
    const file = JSON.parse(saved.text);
    expect(file.tasks).toHaveLength(db.rows('project_task_table').filter((t) => t.projectGUID === P1.rowGUID).length);
    expect(file.uxuiSettings).toEqual({ showCriticalPath: false });
  });

  it('the tasks go in through the RPC project_import_tasks, 500 a chunk (one progress calculation per chunk, not per row)', async () => {
    const { saved, api, db, P2 } = await exported();
    const out = await importProjectFromFile(api, P2, OWNER, asDropped(saved.name, saved.text), async () => true);
    expect(out.status).toBe('imported');
    const calls = db.rpcCalls.filter((c) => c.fn === 'project_import_tasks');
    expect(calls.length).toBe(Math.ceil((out as any).plan.tasks.length / 500));
    expect(calls[0].args.p_project).toBe(P2.rowGUID);
    expect(db.calls.filter((c) => c.table === 'project_task_table' && c.op === 'insert')).toHaveLength(0);
  });

  it('a database without the function (start2 not run yet) falls back to the plain insert; any other error is raised', async () => {
    const { saved, api, db, P2 } = await exported();
    db.failNext('Could not find the function public.project_import_tasks(p_project, p_rows) in the schema cache', { table: 'project_import_tasks', op: 'rpc' });
    const out = await importProjectFromFile(api, P2, OWNER, asDropped(saved.name, saved.text), async () => true);
    expect(out.status).toBe('imported');
    expect(db.calls.filter((c) => c.table === 'project_task_table' && c.op === 'insert').length).toBeGreaterThan(0);
    const again = await exported();
    again.db.failNext('permission denied for table project_task_table', { table: 'project_import_tasks', op: 'rpc' });
    await expect(importProjectFromFile(again.api, again.P2, OWNER, asDropped(again.saved.name, again.saved.text), async () => true)).rejects.toThrow('permission denied');
  });

  it('replacing a project deletes its tasks through the RPC project_delete_tasks (one statement, no plain delete of thousands of rows)', async () => {
    const { saved, api, db, P1, P2 } = await exported();
    await importProjectFromFile(api, P2, OWNER, asDropped(saved.name, saved.text), async () => true);
    db.calls.length = 0;
    db.rpcCalls.length = 0;
    const again = await importProjectFromFile(api, P2, OWNER, asDropped(saved.name, saved.text), async () => true);
    expect(again.status).toBe('imported');
    const del = db.rpcCalls.filter((c) => c.fn === 'project_delete_tasks');
    expect(del).toHaveLength(1);
    expect(del[0].args.p_project).toBe(P2.rowGUID);
    expect(db.calls.filter((c) => c.table === 'project_task_table' && c.op === 'delete')).toHaveLength(0);
    expect(db.rows('project_task_table').filter((t) => t.projectGUID === P1.rowGUID).length).toBeGreaterThan(0); // the other project is untouched
  });

  it('delete: a database without project_delete_tasks gets the plain delete; any other error is raised', async () => {
    const { saved, api, db, P2 } = await exported();
    await importProjectFromFile(api, P2, OWNER, asDropped(saved.name, saved.text), async () => true);
    db.failNext('Could not find the function public.project_delete_tasks(p_project) in the schema cache', { table: 'project_delete_tasks', op: 'rpc' });
    await api.deleteProjectTasks(P2.rowGUID);
    expect(db.rows('project_task_table').filter((t) => t.projectGUID === P2.rowGUID)).toHaveLength(0);
    expect(db.calls.filter((c) => c.table === 'project_task_table' && c.op === 'delete').length).toBeGreaterThan(0);
    db.failNext('canceling statement due to statement timeout', { table: 'project_delete_tasks', op: 'rpc' });
    await expect(api.deleteProjectTasks(P2.rowGUID)).rejects.toThrow('statement timeout');
  });

  it('the task lines of the file are written after the tasks and the links (250 a chunk), on the new tasks, NOT posted', async () => {
    const { saved, api, db, P2 } = await exported();
    const file = JSON.parse(saved.text);
    const leaves = file.tasks.filter((t: any) => t.rowJSON.rowKind !== 'stage');
    file.taskLines = Array.from({ length: 1200 }, (_, i) => ({ rowGUID: `11111111-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`, rowOwnerGUID: leaves[i % leaves.length].rowGUID, rowParentGUID: 'materialGenus', orderInList: i, rowJSON: { qtyTaskLine: 1, sumForBudget: 3, taskIsPosted: true } }));
    const out = await importProjectFromFile(api, P2, OWNER, asDropped(saved.name, JSON.stringify(file)), async () => true);
    expect(out.status).toBe('imported');
    expect((out as any).plan.taskLines).toHaveLength(1200);
    const rows = db.rows('task_line_table');
    expect(rows).toHaveLength(1200);
    const taskIds = new Set(db.rows('project_task_table').filter((t) => t.projectGUID === P2.rowGUID).map((t) => t.rowGUID));
    expect(rows.every((r) => taskIds.has(r.rowOwnerGUID) && r.rowJSON.taskIsPosted === false)).toBe(true);
    expect(db.calls.filter((c) => c.table === 'task_line_table' && c.op === 'insert')).toHaveLength(5); // 250 x 4 + 200
  });

  it('import into a project WITH data: asks; "no" changes nothing, "yes" deletes and replaces', async () => {
    const { saved, api, db, P1, P2 } = await exported();
    const tasksOf = (p: string) => db.rows('project_task_table').filter((t) => t.projectGUID === p);
    const before = tasksOf(P2.rowGUID).map((t) => t.rowGUID).sort();
    const p1Before = tasksOf(P1.rowGUID).length;

    const no = jest.fn(async () => false);
    expect(await importProjectFromFile(api, P2, OWNER, asDropped(saved.name, saved.text), no)).toEqual({ status: 'cancelled' });
    expect(no).toHaveBeenCalledWith(expect.objectContaining({ projectName: P2.rowJSON.name, tasks: before.length, sourceProjectName: P1.rowJSON.name }));
    expect(tasksOf(P2.rowGUID).map((t) => t.rowGUID).sort()).toEqual(before);

    const yes = jest.fn(async () => true);
    const out = await importProjectFromFile(api, P2, OWNER, asDropped(saved.name, saved.text), yes);
    expect(out.status).toBe('imported');
    const now = tasksOf(P2.rowGUID);
    expect(now).toHaveLength(p1Before); // a copy of Project 1
    expect(now.some((t) => before.includes(t.rowGUID))).toBe(false); // old rows gone
    expect(now.every((t) => t.treePath.startsWith(toLtreeLabel(P2.rowGUID) + '.'))).toBe(true);
    const deps = db.rows('project_task_dependencies_table').filter((d) => d.projectGUID === P2.rowGUID);
    expect(deps.length).toBe(JSON.parse(saved.text).dependencies.length);
    expect(tasksOf(P1.rowGUID)).toHaveLength(p1Before); // the source is untouched
    expect(db.rows('project_table').find((p) => p.rowGUID === P2.rowGUID)!.rowJSON.name).toBe(P2.rowJSON.name);
  });

  it('import into an EMPTY project: no question', async () => {
    const { saved, api, db, P2 } = await exported();
    await api.deleteProjectTasks(P2.rowGUID);
    expect(db.rows('project_task_table').filter((t) => t.projectGUID === P2.rowGUID)).toHaveLength(0);
    const ask = jest.fn(async () => true);
    const out = await importProjectFromFile(api, P2, OWNER, asDropped('other-name.json', saved.text), ask);
    expect(out.status).toBe('imported');
    expect(ask).not.toHaveBeenCalled();
    expect(db.rows('project_task_table').filter((t) => t.projectGUID === P2.rowGUID).length).toBeGreaterThan(0);
  });

  it('a wrong file is rejected before anything is deleted', async () => {
    const { api, db, P2 } = setup();
    const n = db.rows('project_task_table').length;
    await expect(importProjectFromFile(api, P2, OWNER, asDropped('x.json', '{"a":1}'), async () => true)).rejects.toThrow(/not a project data file/);
    expect(db.rows('project_task_table')).toHaveLength(n);
  });

  it('pickProjectDataFile prefers project_data_*.json, then any .json', () => {
    const f = (name: string, mimeType = '') => ({ name, mimeType });
    expect(pickProjectDataFile([f('a.png'), f('b.json'), f('project_data_x.json')])!.name).toBe('project_data_x.json');
    expect(pickProjectDataFile([f('a.png'), f('b.json')])!.name).toBe('b.json');
    expect(pickProjectDataFile([])).toBeNull();
  });
});

describe('budget settings of the file (scenarios, business units)', () => {
  const scenario = (rowGUID: string, scenarioKind: string) => ({ rowGUID, rowOwnerGUID: 'budgetScenarioCatalog', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: rowGUID, scenarioKind, isActive: true } });
  const unit = (rowGUID: string, cfrAssigned: string) => ({ rowGUID, rowOwnerGUID: 'businessUnitCatalog', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: rowGUID, cfrAssigned, isActive: true } });
  const target: any = { name: 'T', rowKind: 'project', budgetScenarioForPlan: 'planMine', projectBusinessUnitsRequired: false };

  it('the export carries the budget settings of the project (they are in project.rowJSON)', () => {
    const { demo, P1 } = setup();
    const p = { ...P1, rowJSON: { ...P1.rowJSON, budgetScenarioForPlan: 'planScenarioProject1', budgetScenarioForFact: 'factScenarioProject1', projectCostCenter: 'u1' } };
    const back = parseProjectExchangeFile(JSON.stringify(buildProjectExchangeFile(p, demo.tasks, demo.deps)));
    expect(back.project.rowJSON).toMatchObject({ budgetScenarioForPlan: 'planScenarioProject1', budgetScenarioForFact: 'factScenarioProject1', projectCostCenter: 'u1' });
  });

  it('a scenario of the file that exists with the right kind is taken', () => {
    const merged = { ...target, budgetScenarioForPlan: 'planScenarioProject1', budgetScenarioForFact: 'factScenarioProject1' };
    const r = applyBudgetSettingsOfImport(merged, target, { scenarios: [scenario('planScenarioProject1', 'plan'), scenario('factScenarioProject1', 'fact')] });
    expect(r.rowJSON.budgetScenarioForPlan).toBe('planScenarioProject1');
    expect(r.rowJSON.budgetScenarioForFact).toBe('factScenarioProject1');
    expect(r.notTaken).toEqual([]);
  });

  it('a scenario missing here / of the wrong kind is not taken: the target keeps its own', () => {
    const merged = { ...target, budgetScenarioForPlan: 'gone', budgetScenarioForFact: 'planScenarioProject1' };
    const r = applyBudgetSettingsOfImport(merged, target, { scenarios: [scenario('planScenarioProject1', 'plan')] });
    expect(r.rowJSON.budgetScenarioForPlan).toBe('planMine');
    expect(r.rowJSON.budgetScenarioForFact).toBeNull();
    expect(r.notTaken).toHaveLength(2);
  });

  it('catalogs not loaded: nothing is checked, the file passes', () => {
    const merged = { ...target, budgetScenarioForPlan: 'x', projectCostCenter: 'y' };
    expect(applyBudgetSettingsOfImport(merged, target, {})).toEqual({ rowJSON: merged, notTaken: [] });
  });

  it('project centers: an unknown unit keeps the whole set of the target (flag too)', () => {
    const t: any = { ...target, projectCostCenter: 'mineCost', projectRevenueCenter: 'mineRev', projectBusinessUnitsRequired: false };
    const merged = { ...t, projectCostCenter: 'costU', projectRevenueCenter: 'unknownU', projectBusinessUnitsRequired: true };
    const r = applyBudgetSettingsOfImport(merged, t, { units: [unit('costU', 'costCenter'), unit('mineCost', 'costCenter'), unit('mineRev', 'revenueCenter')], cfrRows: [] });
    expect(r.rowJSON).toMatchObject({ projectCostCenter: 'mineCost', projectRevenueCenter: 'mineRev', projectBusinessUnitsRequired: false });
    expect(r.notTaken[0]).toMatch(/unknownU.*does not exist/);
  });

  it('planProjectImport applies the check and reports what was not taken', () => {
    const { demo, P1, P2 } = setup();
    const p = { ...P1, rowJSON: { ...P1.rowJSON, budgetScenarioForPlan: 'planScenarioProject1', budgetScenarioForFact: 'factGone' } };
    const file = buildProjectExchangeFile(p, demo.tasks, demo.deps);
    const plan = planProjectImport(file, P2, OWNER, newId, { scenarios: [scenario('planScenarioProject1', 'plan')] });
    expect(plan.projectRowJSON.budgetScenarioForPlan).toBe('planScenarioProject1');
    expect(plan.projectRowJSON.budgetScenarioForFact ?? null).toBeNull();
    expect(plan.budgetNotTaken).toEqual(['Fact scenario "factGone" does not exist here']);
  });
});
