// The business unit of a task line: the kind of the line, the sources in priority order (the first one whose unit TAKES the kind wins), the line that follows
// the sources and the one the user typed, the problem, the Post check. On the 29 units of the seed (documents/BUSINESS_UNIT_CFR_STRUCTURE.html).
import {
  businessUnitPatch, kindOfGenus, lineBudgetKind, lineBusinessUnitProblem, lineUnitPostProblem, resolveLineBusinessUnit, BusinessUnitLists,
} from '../../../../../kit8/pm/view/task/finances/taskLineBusinessUnit';
import { taskLineGenusDef } from '../../../../../kit8/pm/view/task/finances/taskLineModel';
import { cfrRows, unitRows } from '../../../../catalog/business_unit/businessUnitTestKit';
import { calculateTaskLinePlan } from '../../../../../kit8/pm/view/task/plan/calculateTaskLinePlan';
import { genusRows } from '../../../../catalog/resourcerole/resourceRoleTestKit';
import { budgetSeedRows } from '../../../../catalog/budget/budgetItemTestKit';

const time = taskLineGenusDef('timeGenus')!;
const revenue = taskLineGenusDef('revenueGenus')!;
const lists = (over: Partial<BusinessUnitLists> = {}): BusinessUnitLists => ({
  businessUnit: unitRows(), cfrType: cfrRows(), budgetItem: budgetSeedRows(), managementGenus: genusRows() as any[],
  resourceRole: [], person: [], equipment: [], product: [], contract: [], ...over,
});
const withUnit = (guid: string, unit: string | null, extra: Record<string, any> = {}) => ({ rowGUID: guid, rowOwnerGUID: 'x', rowParentGUID: 'x', orderInList: 0, rowJSON: { businessUnitAssigned: unit, ...extra } });
const project = { projectCostCenter: 'bu_team1costs', projectRevenueCenter: 'bu_team1', projectProfitCenter: 'bu_pmteam1', projectInvestmentCenter: 'bu_enterprise1' };

describe('the kind of a line', () => {
  it('the genus folder of the budget item: time / material / expense = cost, revenue = revenue; payments = none', () => {
    expect(kindOfGenus(genusRows() as any[], 'timeGenus')).toBe('cost');
    expect(kindOfGenus(genusRows() as any[], 'materialGenus')).toBe('cost');
    expect(kindOfGenus(genusRows() as any[], 'revenueGenus')).toBe('revenue');
    expect(kindOfGenus(genusRows() as any[], 'inboundPaymentGenus')).toBeNull();
    expect(kindOfGenus([], 'timeGenus')).toBe('cost'); // genus rows not read yet
  });
  it('by the budget item first, else by the genus of the line', () => {
    expect(lineBudgetKind(lists(), 'timeGenus', { budgetItemTaskLine: 'timeBudgetItem' })).toBe('cost');
    expect(lineBudgetKind(lists(), 'timeGenus', { budgetItemTaskLine: 'revenueBudgetItem' })).toBe('revenue');
    expect(lineBudgetKind(lists(), 'revenueGenus', {})).toBe('revenue');
  });
});

describe('the sources, in priority order', () => {
  const json = { budgetItemTaskLine: 'timeBudgetItem', taskResourceItem: 'p1', resourceRoleItem: 'r1', taskResourceContract: 'c1' };
  const all = (over: Partial<BusinessUnitLists> = {}) => lists({
    person: [withUnit('p1', 'bu_cto') as any], resourceRole: [withUnit('r1', 'bu_erp') as any], contract: [withUnit('c1', 'bu_qm') as any],
    budgetItem: budgetSeedRows().map((b: any) => (b.rowGUID === 'timeBudgetItem' ? { ...b, rowJSON: { ...b.rowJSON, businessUnitAssigned: 'bu_hrm' } } : b)), ...over,
  });
  it('resource > role > budget item > contract > project', () => {
    expect(resolveLineBusinessUnit(all(), time, json, project)).toEqual({ unit: 'bu_cto', source: 'resource' });
    expect(resolveLineBusinessUnit(all({ person: [] }), time, json, project)).toEqual({ unit: 'bu_erp', source: 'role' });
    expect(resolveLineBusinessUnit(all({ person: [], resourceRole: [] }), time, json, project)).toEqual({ unit: 'bu_hrm', source: 'budget' });
    expect(resolveLineBusinessUnit(all({ person: [], resourceRole: [], budgetItem: budgetSeedRows() }), time, json, project)).toEqual({ unit: 'bu_qm', source: 'contract' });
    expect(resolveLineBusinessUnit(all({ person: [], resourceRole: [], budgetItem: budgetSeedRows(), contract: [] }), time, json, project)).toEqual({ unit: 'bu_team1costs', source: 'project' });
  });
  it('a source whose unit does not take the kind is SKIPPED, not an error: a revenue line of a person in a cost center goes to the project\'s revenue center', () => {
    const l = lists({ person: [withUnit('p1', 'bu_team1costs') as any] });
    expect(resolveLineBusinessUnit(l, revenue, { budgetItemTaskLine: 'revenueBudgetItem', taskResourceItem: 'p1' }, project)).toEqual({ unit: 'bu_team1', source: 'project' });
    // ... and a cost line of the same person takes the person's unit
    expect(resolveLineBusinessUnit(l, time, { budgetItemTaskLine: 'timeBudgetItem', taskResourceItem: 'p1' }, project)).toEqual({ unit: 'bu_team1costs', source: 'resource' });
  });
  it('the project chain: cost center, then profit center, then investment center (revenue: revenue center first)', () => {
    expect(resolveLineBusinessUnit(lists(), time, { budgetItemTaskLine: 'timeBudgetItem' }, { ...project, projectCostCenter: null })).toEqual({ unit: 'bu_pmteam1', source: 'project' });
    expect(resolveLineBusinessUnit(lists(), time, { budgetItemTaskLine: 'timeBudgetItem' }, { projectInvestmentCenter: 'bu_enterprise1' })).toEqual({ unit: 'bu_enterprise1', source: 'project' });
    expect(resolveLineBusinessUnit(lists(), revenue, { budgetItemTaskLine: 'revenueBudgetItem' }, project)).toEqual({ unit: 'bu_team1', source: 'project' });
    // a revenue center as the project's cost center (bad data) is skipped
    expect(resolveLineBusinessUnit(lists(), time, { budgetItemTaskLine: 'timeBudgetItem' }, { projectCostCenter: 'bu_team1', projectProfitCenter: 'bu_pmteam1' })).toEqual({ unit: 'bu_pmteam1', source: 'project' });
  });
  it('an inactive or deleted unit is skipped; nothing found = null', () => {
    const off = unitRows().map((r) => (r.rowGUID === 'bu_cto' ? { ...r, rowJSON: { ...r.rowJSON, isActive: false } } : r));
    expect(resolveLineBusinessUnit(all({ businessUnit: off }), time, json, project).source).toBe('role');
    expect(resolveLineBusinessUnit(lists({ person: [withUnit('p1', 'ghost') as any] }), time, { taskResourceItem: 'p1', budgetItemTaskLine: 'timeBudgetItem' }, null)).toEqual({ unit: null, source: null });
  });
  it('the resource is read from the catalog of its kind: person / equipment (Time), product (the others)', () => {
    const l = lists({ equipment: [withUnit('e1', 'bu_cloud') as any], product: [withUnit('pr1', 'bu_main' as any) as any] });
    expect(resolveLineBusinessUnit(l, time, { budgetItemTaskLine: 'timeBudgetItem', taskResourceKind: 'equipment', taskResourceItem: 'e1' }, project)).toEqual({ unit: 'bu_cloud', source: 'resource' });
    expect(resolveLineBusinessUnit(lists({ product: [withUnit('pr1', 'bu_cloud') as any] }), taskLineGenusDef('materialGenus')!, { budgetItemTaskLine: 'materialBudgetItem', taskResourceItem: 'pr1' }, null)).toEqual({ unit: 'bu_cloud', source: 'resource' });
  });
  it('the contract: the person\'s, else the partner\'s', () => {
    const l = lists({ contract: [withUnit('c2', 'bu_qm') as any] });
    expect(resolveLineBusinessUnit(l, taskLineGenusDef('materialGenus')!, { budgetItemTaskLine: 'materialBudgetItem', taskLinePartnerContract: 'c2' }, null)).toEqual({ unit: 'bu_qm', source: 'contract' });
  });
});

describe('the line follows the sources until the user chooses', () => {
  const j = { budgetItemTaskLine: 'timeBudgetItem' };
  it('a new line takes the suggestion and remembers it as the suggestion', () => {
    expect(businessUnitPatch(lists(), time, j, project)).toEqual({ businessUnitTaskLine: 'bu_team1costs', businessUnitAutoTaskLine: 'bu_team1costs', businessUnitSourceTaskLine: 'project' });
  });
  it('while the unit equals the last suggestion it FOLLOWS: the new suggestion replaces it', () => {
    const line = { ...j, businessUnitTaskLine: 'bu_team1costs', businessUnitAutoTaskLine: 'bu_team1costs', businessUnitSourceTaskLine: 'project' as const };
    expect(businessUnitPatch(lists({ person: [withUnit('p1', 'bu_cto') as any] }), time, { ...line, taskResourceItem: 'p1' }, project))
      .toEqual({ businessUnitTaskLine: 'bu_cto', businessUnitAutoTaskLine: 'bu_cto', businessUnitSourceTaskLine: 'resource' });
  });
  it('a unit the user chose stays (source "line") whatever the sources say', () => {
    const line = { ...j, businessUnitTaskLine: 'bu_hrm', businessUnitAutoTaskLine: 'bu_team1costs', businessUnitSourceTaskLine: 'project' as const };
    expect(businessUnitPatch(lists(), time, line, project)).toEqual({ businessUnitSourceTaskLine: 'line' });
    expect(businessUnitPatch(lists(), time, { ...line, businessUnitSourceTaskLine: 'line' }, project)).toEqual({});
  });
  it('nothing changes when nothing changed (no endless patches)', () => {
    const line = { ...j, businessUnitTaskLine: 'bu_team1costs', businessUnitAutoTaskLine: 'bu_team1costs', businessUnitSourceTaskLine: 'project' as const };
    expect(businessUnitPatch(lists(), time, line, project)).toEqual({});
  });
  it('NO units at all (an old project, SQL part not run): nothing is ever written to the line', () => {
    expect(businessUnitPatch(lists({ businessUnit: [] }), time, j, project)).toEqual({});
    expect(businessUnitPatch(lists(), time, j, null)).toEqual({}); // units exist but no source has one: nothing to write
  });
  it('a line whose suggestion disappeared goes back to empty (it was following)', () => {
    const line = { ...j, businessUnitTaskLine: 'bu_team1costs', businessUnitAutoTaskLine: 'bu_team1costs', businessUnitSourceTaskLine: 'project' as const };
    expect(businessUnitPatch(lists(), time, line, null)).toEqual({ businessUnitTaskLine: null, businessUnitAutoTaskLine: null, businessUnitSourceTaskLine: null });
  });
});

describe('the problem of a unit on a line, and the Post check', () => {
  it('a cost line on a revenue center / a revenue line on a cost center is a problem; the others are not', () => {
    expect(lineBusinessUnitProblem(lists(), time, { budgetItemTaskLine: 'timeBudgetItem', businessUnitTaskLine: 'bu_team1' })).toBe('A cost line cannot be posted to the Revenue center "Team #1"');
    expect(lineBusinessUnitProblem(lists(), revenue, { budgetItemTaskLine: 'revenueBudgetItem', businessUnitTaskLine: 'bu_team1costs' })).toBe('A revenue line cannot be posted to the Cost center "Team #1 costs"');
    for (const [g, item, unit] of [[time, 'timeBudgetItem', 'bu_team1costs'], [time, 'timeBudgetItem', 'bu_pmteam1'], [time, 'timeBudgetItem', 'bu_ceo'], [revenue, 'revenueBudgetItem', 'bu_team1']] as const) {
      expect(lineBusinessUnitProblem(lists(), g, { budgetItemTaskLine: item, businessUnitTaskLine: unit })).toBe('');
    }
    expect(lineBusinessUnitProblem(lists(), time, { budgetItemTaskLine: 'timeBudgetItem' })).toBe(''); // no unit = as before
    expect(lineBusinessUnitProblem(lists({ businessUnit: [] }), time, { businessUnitTaskLine: 'bu_team1' })).toBe(''); // no units loaded: nothing to check
  });
  it('lineUnitPostProblem works from the saved line (genus = rowParentGUID)', () => {
    expect(lineUnitPostProblem(lists(), { rowParentGUID: 'timeGenus', rowJSON: { budgetItemTaskLine: 'timeBudgetItem', businessUnitTaskLine: 'bu_team1' } })).toContain('cannot be posted');
    expect(lineUnitPostProblem(lists(), { rowParentGUID: 'timeGenus', rowJSON: { budgetItemTaskLine: 'timeBudgetItem', businessUnitTaskLine: 'bu_team1costs' } })).toBeNull();
    expect(lineUnitPostProblem(lists(), { rowParentGUID: 'timeGenus', rowJSON: {} })).toBeNull();
  });
  it('Post: the line is left out with the message, the others are posted; without a check (an old project) every line is posted as before', () => {
    const line = (guid: string, unit: string | null) => ({ rowGUID: guid, rowOwnerGUID: 't', rowParentGUID: 'timeGenus', orderInList: 0, rowJSON: { budgetItemTaskLine: 'timeBudgetItem', distributionForBudgetTaskLine: 'uniformDistribution', qtyTaskLine: 2, sumForBudget: 10, businessUnitTaskLine: unit } });
    const l = lists();
    const run = (check?: any) => calculateTaskLinePlan({
      taskGUID: 't', fromDay: '2026-10-12', toDay: '2026-10-13', calendarDays: [{ rowJSON: { day: '2026-10-12', isActive: true } }, { rowJSON: { day: '2026-10-13', isActive: true } }],
      lines: [line('ok', 'bu_team1costs'), line('bad', 'bu_team1'), line('none', null)] as any[], distributions: [], lineCheck: check,
    });
    const checked = run((ln: any) => lineUnitPostProblem(l, ln));
    expect(checked.errors).toEqual([{ lineGUID: 'bad', message: 'A cost line cannot be posted to the Revenue center "Team #1"' }]);
    expect(checked.postedLines.sort()).toEqual(['none', 'ok']);
    expect(run().errors).toEqual([]);
    expect(run().postedLines.sort()).toEqual(['bad', 'none', 'ok']);
  });
});

describe('a work center line (kit8/catalog/work_center)', () => {
  const wc = (guid: string, json: Record<string, any>): any => ({ rowGUID: guid, rowOwnerGUID: 'workCenterCatalog', rowParentGUID: json.businessUnit ?? 'empty', orderInList: 0, rowJSON: { workCenterKind: 'person', ...json } });
  const line = (guid: string) => ({ taskResourceKind: 'workCenter' as const, taskResourceItem: guid, resourceRoleItem: null, budgetItemTaskLine: null });
  it('the business unit of the work center (its folder) is the unit of the lines that book it - the "resource" source', () => {
    const d = lists({ workCenter: [wc('wc1', { businessUnit: 'bu_cto' })] });
    expect(resolveLineBusinessUnit(d, time, line('wc1'), project)).toEqual({ unit: 'bu_cto', source: 'resource' });
  });
  it('a work center that has no unit, or is not in the catalog, leaves the next source (the project) to decide', () => {
    expect(resolveLineBusinessUnit(lists({ workCenter: [wc('wc1', {})] }), time, line('wc1'), project).source).toBe('project');
    expect(resolveLineBusinessUnit(lists(), time, line('nope'), project).source).toBe('project');
  });
  it('a person keeps businessUnitAssigned: it wins over the folder fields of a row that is not a work center', () => {
    const d = lists({ person: [withUnit('p1', 'bu_cto')] });
    expect(resolveLineBusinessUnit(d, time, { taskResourceKind: 'person' as const, taskResourceItem: 'p1' }, project)).toEqual({ unit: 'bu_cto', source: 'resource' });
  });
});
