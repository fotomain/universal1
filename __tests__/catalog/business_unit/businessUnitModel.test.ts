// The business unit model on the 29 units of the seed (documents/BUSINESS_UNIT_CFR_STRUCTURE.html): tree, effective CFR, what a unit takes, what a picker offers,
// the four project centers. cfrTypeModel: the enumeration.
import {
  BUSINESS_UNIT_TABLE, businessUnitAccepts, businessUnitDescendants, businessUnitLeaves, businessUnitNodes, businessUnitOptions, businessUnitPath, businessUnitProblem,
  defaultProjectCenters, effectiveCfr, projectCenterOptions, projectCentersError, selectableBusinessUnits, unitFitsProjectCenter,
} from '../../../kit8/catalog/business_unit/businessUnitModel';
import { CFR_TYPE, CFR_TYPE_SEED, CFR_TYPE_TABLE, cfrAccepts, cfrTypeOptions, cfrTypeTitle, isCfrType } from '../../../kit8/catalog/business_unit/cfrTypeModel';
import { cfrRows, unitRows } from './businessUnitTestKit';

const rows = unitRows();
const cfr = cfrRows();
const get = (guid: string) => rows.find((r) => r.rowGUID === guid)!;

describe('the seed of the document', () => {
  it('29 units, 4 levels, 9 with a CFR (1 investment, 4 profit, 2 revenue, 2 cost)', () => {
    expect(rows).toHaveLength(29);
    const own = rows.filter((r) => r.rowJSON.cfrAssigned);
    expect(own).toHaveLength(9);
    const count = (c: string) => own.filter((r) => r.rowJSON.cfrAssigned === c).length;
    expect([count('investmentCenter'), count('profitCenter'), count('revenueCenter'), count('costCenter')]).toEqual([1, 4, 2, 2]);
    expect(rows.filter((r) => r.rowParentGUID === 'empty').map((r) => r.rowGUID)).toEqual(['bu_enterprise1']);
    const depth = (g: string): number => (get(g).rowParentGUID === 'empty' ? 1 : 1 + depth(get(g).rowParentGUID));
    expect(Math.max(...rows.map((r) => depth(r.rowGUID)))).toBe(4);
  });
  it('every parent exists and comes before its child', () => {
    rows.forEach((r, i) => { if (r.rowParentGUID !== 'empty') expect(rows.findIndex((p) => p.rowGUID === r.rowParentGUID)).toBeGreaterThanOrEqual(0); expect(i >= 0).toBe(true); });
    rows.forEach((r, i) => { if (r.rowParentGUID !== 'empty') expect(rows.findIndex((p) => p.rowGUID === r.rowParentGUID)).toBeLessThan(i); });
  });
});

describe('the tree', () => {
  it('nodes carry every unit; path and descendants', () => {
    expect(businessUnitNodes(rows)).toHaveLength(29);
    expect(businessUnitNodes(rows).find((n) => n.id === 'bu_team1costs')).toEqual({ id: 'bu_team1costs', parentId: 'bu_pmteam1', title: 'Team #1 costs', order: 20 });
    expect(businessUnitPath(rows, 'bu_team1costs')).toBe('Enterprise #1 › Project Management › PM Team #1 › Team #1 costs');
    const below = businessUnitDescendants(rows, 'bu_pm');
    expect([...below].sort()).toEqual(['bu_pm', 'bu_pmteam1', 'bu_pmteam2', 'bu_team1', 'bu_team1costs', 'bu_team2', 'bu_team2costs']);
    expect(businessUnitLeaves(rows).some((r) => r.rowGUID === 'bu_pm')).toBe(false);
    expect(businessUnitLeaves(rows).some((r) => r.rowGUID === 'bu_ceo')).toBe(true);
  });
  it('a missing parent makes the unit a root node (never a crash)', () => {
    expect(businessUnitNodes([{ rowGUID: 'x', rowParentGUID: 'gone', orderInList: 0, rowJSON: { title: 'X' } } as any])[0].parentId).toBeNull();
  });
});

describe('the effective CFR', () => {
  it('own, inherited from the parent / the grandparent, none', () => {
    expect(effectiveCfr(rows, 'bu_team1')).toBe('revenueCenter');
    expect(effectiveCfr(rows, 'bu_ceo')).toBe('investmentCenter'); // Board > CEO: both inherit from Enterprise #1
    expect(effectiveCfr(rows, 'bu_cloud')).toBe('investmentCenter');
    expect(effectiveCfr(rows, 'bu_keyaccounts')).toBe('profitCenter');
    const orphan = [{ rowGUID: 'a', rowParentGUID: 'empty', rowJSON: {} }, { rowGUID: 'b', rowParentGUID: 'a', rowJSON: {} }] as any[];
    expect(effectiveCfr(orphan, 'b')).toBeNull();
    expect(effectiveCfr(rows, 'nope')).toBeNull();
    expect(effectiveCfr(rows, null)).toBeNull();
  });
  it('a loop in bad data ends (no endless walk)', () => {
    const loop = [{ rowGUID: 'a', rowParentGUID: 'b', rowJSON: {} }, { rowGUID: 'b', rowParentGUID: 'a', rowJSON: {} }] as any[];
    expect(effectiveCfr(loop, 'a')).toBeNull();
  });
});

describe('what a unit takes (the matrix of the document)', () => {
  it.each([
    ['bu_team1costs', 'cost', true], ['bu_team1costs', 'revenue', false],
    ['bu_team1', 'cost', false], ['bu_team1', 'revenue', true],
    ['bu_pmteam1', 'cost', true], ['bu_pmteam1', 'revenue', true],
    ['bu_enterprise1', 'cost', true], ['bu_enterprise1', 'revenue', true],
    ['bu_ceo', 'cost', true], // inherits the investment center
  ] as const)('%s takes a %s line: %s', (unit, kind, ok) => {
    expect(businessUnitAccepts(rows, cfr, unit, kind)).toBe(ok);
    expect(businessUnitProblem(rows, cfr, unit, kind) === '').toBe(ok);
  });
  it('the message names the line, the center and the unit', () => {
    expect(businessUnitProblem(rows, cfr, 'bu_team1', 'cost')).toBe('A cost line cannot be posted to the Revenue center "Team #1"');
    expect(businessUnitProblem(rows, cfr, 'bu_team1costs', 'revenue')).toBe('A revenue line cannot be posted to the Cost center "Team #1 costs"');
    expect(businessUnitProblem(rows, cfr, 'ghost', 'cost')).toContain('does not exist');
    expect(businessUnitProblem(rows, cfr, null, 'cost')).toBe('');
  });
  it('no unit set / no kind known = nothing to check; a unit with no CFR up the tree takes everything', () => {
    expect(businessUnitAccepts(rows, cfr, 'bu_team1', null)).toBe(true);
    expect(businessUnitAccepts([{ rowGUID: 'a', rowParentGUID: 'empty', rowJSON: {} }] as any[], cfr, 'a', 'cost')).toBe(true);
  });
});

describe('what a picker / a select offers', () => {
  it('selectFromTree (the business unit): every active unit, any level, the first too', () => {
    expect(selectableBusinessUnits(rows, { selectFromTree: true })).toHaveLength(29);
    expect(selectableBusinessUnits(rows).length).toBe(29); // the default of the unit catalog is true
  });
  it('without selectFromTree only the leaves', () => {
    const leaves = selectableBusinessUnits(rows, { selectFromTree: false }).map((r) => r.rowGUID);
    expect(leaves).toContain('bu_ceo');
    expect(leaves).not.toContain('bu_enterprise1');
    expect(leaves).not.toContain('bu_pmteam1');
  });
  it('a kind leaves out the units that do not take it; the value already set stays; inactive units are not offered', () => {
    const costs = selectableBusinessUnits(rows, { kind: 'cost', cfrRows: cfr }).map((r) => r.rowGUID);
    expect(costs).not.toContain('bu_team1');
    expect(costs).toContain('bu_team1costs');
    expect(selectableBusinessUnits(rows, { kind: 'cost', cfrRows: cfr, keep: 'bu_team1' }).map((r) => r.rowGUID)).toContain('bu_team1');
    const off = rows.map((r) => (r.rowGUID === 'bu_hrm' ? { ...r, rowJSON: { ...r.rowJSON, isActive: false } } : r));
    expect(selectableBusinessUnits(off).map((r) => r.rowGUID)).not.toContain('bu_hrm');
    expect(selectableBusinessUnits(off, { keep: 'bu_hrm' }).map((r) => r.rowGUID)).toContain('bu_hrm');
  });
  it('options: the path as the label, sorted so the tree reads top to bottom', () => {
    const o = businessUnitOptions(rows);
    expect(o[0]).toEqual({ value: 'bu_enterprise1', label: 'Enterprise #1' });
    expect(o.find((x) => x.value === 'bu_team2costs')!.label).toBe('Enterprise #1 › Project Management › PM Team #2 › Team #2 costs');
    expect([...o].sort((a, b) => a.label.localeCompare(b.label))).toEqual(o);
  });
});

describe('the four project centers', () => {
  it('which unit fits which field (the rule of the SQL trigger)', () => {
    expect(unitFitsProjectCenter(rows, cfr, 'projectCostCenter', 'bu_team1costs')).toBe(true);
    expect(unitFitsProjectCenter(rows, cfr, 'projectCostCenter', 'bu_team1')).toBe(false);
    expect(unitFitsProjectCenter(rows, cfr, 'projectRevenueCenter', 'bu_team1')).toBe(true);
    expect(unitFitsProjectCenter(rows, cfr, 'projectRevenueCenter', 'bu_team1costs')).toBe(false);
    expect(unitFitsProjectCenter(rows, cfr, 'projectProfitCenter', 'bu_pmteam1')).toBe(true);
    expect(unitFitsProjectCenter(rows, cfr, 'projectProfitCenter', 'bu_team1costs')).toBe(false);
    expect(unitFitsProjectCenter(rows, cfr, 'projectProfitCenter', 'bu_ceo')).toBe(false); // inherits an investment center
    expect(unitFitsProjectCenter(rows, cfr, 'projectInvestmentCenter', 'bu_enterprise1')).toBe(true);
    expect(unitFitsProjectCenter(rows, cfr, 'projectInvestmentCenter', 'bu_ceo')).toBe(true);
    expect(projectCenterOptions(rows, cfr, 'projectProfitCenter').map((o) => o.value).sort()).toEqual(['bu_internetsales', 'bu_keyaccounts', 'bu_pmteam1', 'bu_pmteam2']);
  });
  it('a NEW project gets the first unit that fits each field (an exact CFR first)', () => {
    const d = defaultProjectCenters(rows, cfr);
    expect(d.projectCostCenter).toBe('bu_team1costs');
    expect(d.projectRevenueCenter).toBe('bu_team1');
    expect(d.projectProfitCenter).toBe('bu_pmteam1'); // the exact CFR first, then the first path: "... › Project Management › PM Team #1" comes before "... › Sales › ..."
    expect(d.projectInvestmentCenter).toBe('bu_enterprise1');
    expect(projectCentersError({ ...d, projectBusinessUnitsRequired: true }, rows, cfr)).toBeNull();
  });
  it('obligatory on a project made with business units: missing / wrong / no units at all = the message; a project made before is never refused', () => {
    const ok = { projectCostCenter: 'bu_team1costs', projectRevenueCenter: 'bu_team1', projectProfitCenter: 'bu_pmteam1', projectInvestmentCenter: 'bu_enterprise1', projectBusinessUnitsRequired: true };
    expect(projectCentersError(ok, rows, cfr)).toBeNull();
    expect(projectCentersError({ ...ok, projectRevenueCenter: null }, rows, cfr)).toBe('The project needs its revenue center (Finances tab)');
    expect(projectCentersError({ ...ok, projectCostCenter: 'bu_team1' }, rows, cfr)).toBe('"Team #1" cannot be the project\'s cost center (it must be takes costs)');
    expect(projectCentersError({ ...ok, projectProfitCenter: 'ghost' }, rows, cfr)).toBe('The profit center "ghost" does not exist');
    expect(projectCentersError(ok, [], cfr)).toContain('create them first');
    expect(projectCentersError({ ...ok, projectCostCenter: null, projectBusinessUnitsRequired: false }, rows, cfr)).toBeNull(); // an old project
    expect(projectCentersError({ ...ok, projectCostCenter: null }, [], cfr, false)).toBeNull(); // not loaded yet
  });
});

describe('cfrTypeModel - the enumeration', () => {
  it('four fixed values; the seed matches the SQL rows', () => {
    expect(CFR_TYPE_SEED.map((s) => s.value)).toEqual(Object.values(CFR_TYPE));
    expect(CFR_TYPE_SEED.map((s) => [s.value, s.acceptsCosts, s.acceptsRevenues])).toEqual(cfr.map((r) => [r.rowGUID, r.rowJSON.acceptsCosts, r.rowJSON.acceptsRevenues]));
    expect(isCfrType('profitCenter')).toBe(true);
    expect(isCfrType('nonsense')).toBe(false);
    expect(CFR_TYPE_TABLE.catalogOwner).toBe('cfrTypeCatalog');
  });
  it('accepts: the rows are the rule; the seed until they are read; unknown CFR = no', () => {
    expect(cfrAccepts('costCenter', 'cost', cfr)).toBe(true);
    expect(cfrAccepts('costCenter', 'revenue', cfr)).toBe(false);
    expect(cfrAccepts('revenueCenter', 'cost')).toBe(false);
    expect(cfrAccepts('investmentCenter', 'revenue')).toBe(true);
    expect(cfrAccepts('costCenter', 'revenue', [{ rowGUID: 'costCenter', rowJSON: { acceptsCosts: true, acceptsRevenues: true } } as any])).toBe(true); // the data decides
    expect(cfrAccepts('whatever', 'cost')).toBe(false);
    expect(cfrAccepts(null, 'cost')).toBe(true);
    expect(cfrAccepts('costCenter', null)).toBe(true);
  });
  it('options and titles: from the rows, else the seed', () => {
    expect(cfrTypeOptions(cfr).map((o) => o.label)).toEqual(['Cost center', 'Revenue center', 'Profit center', 'Investment center']);
    expect(cfrTypeOptions([]).map((o) => o.value)).toEqual(['costCenter', 'revenueCenter', 'profitCenter', 'investmentCenter']);
    expect(cfrTypeTitle(cfr, 'profitCenter')).toBe('Profit center');
    expect(cfrTypeTitle(cfr, null)).toBe('');
  });
});

it('the table def', () => {
  expect(BUSINESS_UNIT_TABLE.table).toBe('businessUnitTable');
  expect(BUSINESS_UNIT_TABLE.catalogOwner).toBe('businessUnitCatalog');
  expect(BUSINESS_UNIT_TABLE.emptyRowJSON()).toEqual({ title: null, code: null, description: null, cfrAssigned: null, isActive: true });
});
