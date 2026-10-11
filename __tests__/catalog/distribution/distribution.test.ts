// Distribution - the two-level table (model helpers, metadata), the shares of every distribution, and the SQL files against the seed fixture.
import * as fs from 'fs';
import * as path from 'path';
import seed from './distributionSeed.json';
import {
  DISTRIBUTION, DISTRIBUTION_GROUPS, DISTRIBUTION_PARAMS, DISTRIBUTION_TABLE, distributeAmount, distributionGroups, distributionItems, distributionNodes,
  distributionOptions, distributionPath, distributionShares,
} from '../../../kit8/catalog/distribution/distributionModel';
import { distributionSystemMetaData } from '../../../kit8/catalog/distribution/distributionMetaData';

// the column builder pulls in the design-system buttons: not needed here
jest.mock('../../../kit8/pm/inner/buttons', () => ({ PMTipIcon: () => null }));

const rows = (seed as any).distributionGenericTable as any[];
const sql = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/create_distribution_generic_table.sql'), 'utf8');
const del = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/delete_distribution_generic_table.sql'), 'utf8');
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('the table', () => {
  it('level 1 = groups, level 2 = the 8 distributions of the document', () => {
    const children = (g: string) => rows.filter((r) => r.rowParentGUID === g).map((r) => r.rowGUID);
    expect(distributionGroups(rows).map((r) => r.rowGUID)).toEqual(['simpleDistributionGroup', 'curvesDistributionGroup', 'customDistributionGroup']);
    expect(children('simpleDistributionGroup')).toEqual(['frontLoadedDistribution', 'backLoadedDistribution', 'uniformDistribution']);
    expect(children('curvesDistributionGroup')).toEqual(['normalDistribution', 'logarithmicFrontDistribution', 'logarithmicBackDistribution', 'epidemicDistribution']);
    expect(children('customDistributionGroup')).toEqual(['manualDistribution']);
    expect(distributionItems(rows)).toHaveLength(8);
    expect(rows).toHaveLength(11);
    expect(Object.values(DISTRIBUTION).sort()).toEqual(distributionItems(rows).map((r) => r.rowGUID).sort());
    expect(Object.values(DISTRIBUTION_GROUPS).sort()).toEqual(distributionGroups(rows).map((r) => r.rowGUID).sort());
    expect(rows.every((r) => r.rowOwnerGUID === 'distributionGenericCatalog' && r.rowJSON.title && r.rowJSON.description)).toBe(true);
  });

  it('only manual is editable; the parameters of the SQL are those of the model', () => {
    for (const r of distributionItems(rows)) {
      expect([r.rowGUID, r.rowJSON.editable]).toEqual([r.rowGUID, r.rowGUID === 'manualDistribution']);
      expect([r.rowGUID, r.rowJSON.params]).toEqual([r.rowGUID, (DISTRIBUTION_PARAMS as any)[r.rowGUID]]);
    }
    expect(DISTRIBUTION_PARAMS.normalDistribution.map((p) => p.key)).toEqual(['peak', 'spread']);
    expect(DISTRIBUTION_PARAMS.logarithmicFrontDistribution.map((p) => p.key)).toEqual(['steepness']);
    expect(DISTRIBUTION_PARAMS.epidemicDistribution.map((p) => p.key)).toEqual(['peak', 'spread']);
  });

  it('tree nodes = the groups; path; options of the task line picker', () => {
    expect(distributionNodes(rows).map((n) => [n.id, n.parentId, n.title])).toEqual([['simpleDistributionGroup', null, 'Simple'], ['curvesDistributionGroup', null, 'Curves'], ['customDistributionGroup', null, 'Custom']]);
    expect(distributionPath(rows, 'normalDistribution')).toBe('Curves › Normal (Gaussian)');
    expect(distributionPath(rows, 'nope')).toBe('nope');
    expect(distributionOptions(rows).map((o) => o.value)).toEqual(['frontLoadedDistribution', 'backLoadedDistribution', 'uniformDistribution', 'normalDistribution', 'logarithmicFrontDistribution', 'logarithmicBackDistribution', 'epidemicDistribution', 'manualDistribution']);
    expect(distributionOptions(rows)[0]).toEqual({ value: 'frontLoadedDistribution', label: 'Front-loaded (start)' });
  });

  it('SystemMetaData entry', () => {
    expect(distributionSystemMetaData()).toEqual({ distributionGenericReusable: expect.objectContaining({ tableName: 'distributionGenericTable', itemLabel: 'Distribution' }) });
    expect(DISTRIBUTION_TABLE.emptyRowJSON()).toEqual({ title: null, description: null, shape: null, params: [], editable: false });
  });
});

describe('the shares (a period is a day, at least one)', () => {
  const ALL = Object.values(DISTRIBUTION).filter((c) => c !== DISTRIBUTION.manual);

  it.each(ALL)('%s: sums to 1 for 1, 2, 7 and 90 days, none negative', (code) => {
    for (const n of [1, 2, 7, 90]) {
      const s = distributionShares(code, n);
      expect(s).toHaveLength(n);
      expect(sum(s)).toBeCloseTo(1, 10);
      expect(Math.min(...s)).toBeGreaterThanOrEqual(0);
    }
  });

  it('one day (the minimum) gets everything; fewer than one day is one day', () => {
    for (const code of ALL) expect(distributionShares(code, 1)).toEqual([expect.closeTo(1, 10)]);
    expect(distributionShares(DISTRIBUTION.uniform, 0)).toEqual([1]);
    expect(distributionShares(DISTRIBUTION.uniform, -5)).toEqual([1]);
  });

  it('uniform: an equal share every day', () => {
    expect(distributionShares(DISTRIBUTION.uniform, 4)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it('front-loaded falls from the start to ~zero at the end; back-loaded is its mirror', () => {
    const f = distributionShares(DISTRIBUTION.frontLoaded, 10);
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeLessThan(f[i - 1]);
    expect(f[9]).toBeLessThan(f[0] / 10);
    expect(distributionShares(DISTRIBUTION.backLoaded, 10)).toEqual(f.slice().reverse().map((x, i) => expect.closeTo(x, 12) as any));
  });

  it('normal: symmetric by default with the peak in the middle; the peak parameter moves it', () => {
    const n = distributionShares(DISTRIBUTION.normal, 11);
    expect(n.indexOf(Math.max(...n))).toBe(5);
    n.forEach((v, i) => expect(v).toBeCloseTo(n[10 - i], 10));
    const early = distributionShares(DISTRIBUTION.normal, 11, { peak: 0.1 });
    expect(early.indexOf(Math.max(...early))).toBeLessThan(3);
    // a narrower spread puts more in the middle
    expect(distributionShares(DISTRIBUTION.normal, 11, { spread: 0.05 })[5]).toBeGreaterThan(n[5]);
  });

  it('logarithmic front: a fast start flattening into a long thin tail; back is the mirror; steepness sharpens it', () => {
    const lf = distributionShares(DISTRIBUTION.logarithmicFront, 20);
    for (let i = 1; i < lf.length; i++) expect(lf[i]).toBeLessThan(lf[i - 1]);
    const lb = distributionShares(DISTRIBUTION.logarithmicBack, 20);
    lb.forEach((v, i) => expect(v).toBeCloseTo(lf[19 - i], 12));
    expect(distributionShares(DISTRIBUTION.logarithmicFront, 20, { steepness: 50 })[0]).toBeGreaterThan(lf[0]);
  });

  it('epidemic: slow start, rise to a peak at about 35 %, a longer decline than the rise (right-skewed)', () => {
    const e = distributionShares(DISTRIBUTION.epidemic, 100);
    const top = e.indexOf(Math.max(...e));
    expect(top).toBeGreaterThan(25);
    expect(top).toBeLessThan(45);
    expect(e[0]).toBeLessThan(e[top] / 10);
    expect(100 - top).toBeGreaterThan(top);
    expect(sum(e.slice(top))).toBeGreaterThan(sum(e.slice(0, top)));
  });

  it('manual: the values of the user, scaled to sum 1; nothing typed = nothing', () => {
    expect(distributionShares(DISTRIBUTION.manual, 4, { values: [1, 1, 2, 0] })).toEqual([0.25, 0.25, 0.5, 0]);
    expect(distributionShares(DISTRIBUTION.manual, 3, { values: [5] })).toEqual([1, 0, 0]);
    expect(distributionShares(DISTRIBUTION.manual, 3)).toEqual([0, 0, 0]);
  });

  it('an unknown distribution is refused', () => {
    expect(() => distributionShares('nope', 3)).toThrow('Unknown distribution');
  });

  it('distributeAmount: the parts add up to the amount exactly', () => {
    for (const code of ALL) {
      const parts = distributeAmount(code, 1000, 7);
      expect(parts).toHaveLength(7);
      expect(Math.round(sum(parts) * 100) / 100).toBe(1000);
    }
    expect(distributeAmount(DISTRIBUTION.uniform, 100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(distributeAmount(DISTRIBUTION.manual, 100, 2)).toEqual([0, 0]);
  });
});

describe('SQL', () => {
  it('create_distribution_generic_table.sql: the table, secured, in realtime, with exactly the seed rows', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public."distributionGenericTable"');
    expect(sql).toContain("SELECT public.kit8_setup_def_table('distributionGenericTable')");
    expect(sql).toContain('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated');
    expect(sql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public."distributionGenericTable"');
    const block = sql.slice(sql.indexOf('INSERT INTO public."distributionGenericTable"'));
    expect((block.slice(0, block.indexOf('ON CONFLICT')).match(/^  \('/gm) || [])).toHaveLength(rows.length);
    for (const r of rows) expect(sql).toContain(`('${r.rowGUID}', 'distributionGenericCatalog', '${r.rowParentGUID}',`);
  });
  it('delete_distribution_generic_table.sql drops it', () => {
    expect(del).toContain('DROP TABLE IF EXISTS public."distributionGenericTable"');
  });
  it('run_fresh_data.sql has it', () => {
    const all = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/run_fresh_data.sql'), 'utf8');
    expect(all).toContain('-- PART: kit8/sql/init/create_distribution_generic_table.sql');
    expect(all).toContain('delete_distribution_generic_table.sql');
  });
});

describe('the task line column', () => {
  it('the line keeps the distribution in rowJSON.distributionForBudgetTaskLine, offered from the catalog', () => {
    const { emptyTaskLine } = require('../../../kit8/pm/view/task/finances/taskLineModel');
    const { emptyTaskLineCatalogs } = require('../../../kit8/pm/view/task/finances/taskLineCatalogs');
    const { buildTaskLineColumns } = require('../../../kit8/pm/view/task/finances/taskLineColumns');
    expect(emptyTaskLine().distributionForBudgetTaskLine).toBeNull();
    const data = { ...emptyTaskLineCatalogs(), distribution: rows };
    const col = buildTaskLineColumns({ data, genus: { genus: 'timeGenus', title: 'Time', icon: 'schedule', resource: 'person', hasPartner: false }, textColor: '#000', errorColor: '#d00' })
      .find((c: any) => c.key === 'distribution');
    expect(col).toMatchObject({ type: 'select', field: 'distributionForBudgetTaskLine' });
    expect(col.options.map((o: any) => o.value)).toEqual(distributionOptions(rows).map((o) => o.value));
  });
});
