// Filter & sort of the tree columns (kit8/pm/view/tree/filter): variants, parsing, D365 "matches",
// visible rows (matches + ancestors, siblings sorted, empty last), saved-settings normalization,
// header icon geometry, and the store (visible rows follow filters / sort / expansion).
import {
  columnFilterIconColorOf,
  compileMatches,
  compileTreeColumnFilter,
  defaultFilterVariant,
  describeTreeColumnFilter,
  filterAndSortTreeRows,
  filterVariantInputs,
  filterVariantLabel,
  filterVariantsForColumn,
  normalizeTreeColumnSort,
  normalizeTreeColumnsFilters,
  parseFilterDate,
  PMTreeColumnDataType,
  PMTreeColumnFilter,
  PMTreeFilterContext,
  sortLabels,
  splitFilterList,
  treeColumnDataType,
  treeCellFilterValue,
} from '../../../../../kit8/pm/view/tree/filter/treeColumnFilter';
import { treeFilterIconAt, treeFilterIconBox, treeHeaderTitleWidth } from '../../../../../kit8/pm/view/tree/filter/treeFilterIconGeometry';
import { buildTreeIndex } from '../../../../../kit8/pm/view/project/scheduling';
import { layoutTreeColumns } from '../../../../../kit8/pm/view/tree/columns/treeColumns';
import { usePMStore } from '../../../../../kit8/pm/store/store_pm';
import { uxuiSettingsOf, PMProjectRow, PMTaskRow } from '../../../../../kit8/pm/model/types';

const T0 = Date.UTC(2026, 8, 30); // "today" for the tests
const test1 = (f: PMTreeColumnFilter, type: PMTreeColumnDataType, v: any) => {
  const c = compileTreeColumnFilter(f, type, T0);
  if ('error' in c) throw new Error(c.error);
  return c.test(v);
};
const f = (filterVariantForColumn: PMTreeColumnFilter['filterVariantForColumn'], value?: string, value2?: string): PMTreeColumnFilter => ({
  filterVariantForColumn,
  value,
  value2,
});

describe('columns and filterVariantForColumn', () => {
  const custom = [
    { key: 'cc_txt00001' as const, name: 'Owner', type: 'text' as const },
    { key: 'cc_int00001' as const, name: 'Qty', type: 'integer' as const },
    { key: 'cc_flt00001' as const, name: 'Budget', type: 'float' as const },
    { key: 'cc_dat00001' as const, name: 'Due', type: 'date' as const },
    { key: 'cc_bool0001' as const, name: 'Ok', type: 'boolean' as const },
  ];
  it('data type of built-in and custom columns', () => {
    expect(['wbs', 'name', 'start', 'days', 'progress'].map((k) => treeColumnDataType(k))).toEqual(['text', 'text', 'date', 'number', 'number']);
    expect(custom.map((c) => treeColumnDataType(c.key, custom))).toEqual(['text', 'number', 'number', 'date', 'boolean']);
    expect(treeColumnDataType('cc_deleted1', custom)).toBeNull();
    expect(treeColumnDataType('junk')).toBeNull();
  });

  it('variants in the requested order; empty / not empty only for custom columns', () => {
    expect(filterVariantsForColumn('text')).toEqual([
      'isExactly', 'isNot', 'isOneOf', 'contains', 'doesNotContain', 'beginsWith',
      'after', 'before', 'lessThanOrEqual', 'greaterThanOrEqual', 'between', 'matches',
    ]);
    expect(filterVariantsForColumn('number')).not.toContain('contains');
    expect(filterVariantsForColumn('date', true).slice(-2)).toEqual(['isEmpty', 'isNotEmpty']);
    expect(filterVariantsForColumn('boolean')).toEqual(['isExactly', 'isNot']);
    expect(defaultFilterVariant('text')).toBe('beginsWith');
    expect(defaultFilterVariant('number')).toBe('isExactly');
  });

  it('labels follow the type (Is exactly / Is equal to, After / Greater than ...)', () => {
    expect(filterVariantLabel('isExactly', 'text')).toBe('Is exactly');
    expect(filterVariantLabel('isExactly', 'number')).toBe('Is equal to');
    expect(filterVariantLabel('isNot', 'number')).toBe('Is not equal to');
    expect(filterVariantLabel('after', 'number')).toBe('Greater than');
    expect(filterVariantLabel('before', 'number')).toBe('Less than');
    expect(filterVariantLabel('lessThanOrEqual', 'number')).toBe('Less than or equal');
    expect(filterVariantLabel('after', 'date')).toBe('After');
    expect(filterVariantLabel('lessThanOrEqual', 'date')).toBe('On or before');
    expect(sortLabels('text')).toEqual({ asc: 'Sort A to Z', desc: 'Sort Z to A' });
    expect(sortLabels('date').asc).toBe('Sort oldest to newest');
    expect([filterVariantInputs('between'), filterVariantInputs('isEmpty'), filterVariantInputs('contains')]).toEqual([2, 0, 1]);
  });
});

describe('text filters (case-insensitive)', () => {
  it('is exactly / is not / contains / does not contain / begins with', () => {
    expect(test1(f('isExactly', 'design'), 'text', 'Design')).toBe(true);
    expect(test1(f('isExactly', 'design'), 'text', 'Designs')).toBe(false);
    expect(test1(f('isNot', 'design'), 'text', 'Build')).toBe(true);
    expect(test1(f('isNot', 'design'), 'text', 'DESIGN')).toBe(false);
    expect(test1(f('contains', 'SIG'), 'text', 'Design')).toBe(true);
    expect(test1(f('doesNotContain', 'sig'), 'text', 'Design')).toBe(false);
    expect(test1(f('doesNotContain', 'sig'), 'text', '')).toBe(true);
    expect(test1(f('beginsWith', 'des'), 'text', 'Design')).toBe(true);
    expect(test1(f('beginsWith', 'sign'), 'text', 'Design')).toBe(false);
  });

  it('is one of = comma separated list (quotes keep commas)', () => {
    expect(splitFilterList('a, "b, c" ,, d')).toEqual(['a', '"b, c"', 'd']);
    expect(test1(f('isOneOf', 'Design, Build'), 'text', 'build')).toBe(true);
    expect(test1(f('isOneOf', 'Design, Build'), 'text', 'Test')).toBe(false);
    expect(test1(f('isOneOf', '"Plan, v2-1", x'), 'text', 'plan, v2-1')).toBe(true);
  });

  it('after / before / <= / >= / between use the natural order (1.9 < 1.10)', () => {
    expect(test1(f('after', '1.9'), 'text', '1.10')).toBe(true);
    expect(test1(f('before', 'b'), 'text', 'A')).toBe(true);
    expect(test1(f('lessThanOrEqual', 'b'), 'text', 'B')).toBe(true);
    expect(test1(f('greaterThanOrEqual', 'b'), 'text', 'a')).toBe(false);
    expect(test1(f('between', 'b', 'd'), 'text', 'C')).toBe(true);
    expect(test1(f('between', 'd', 'b'), 'text', 'c')).toBe(true); // any order
    expect(test1(f('between', 'b', 'd'), 'text', 'e')).toBe(false);
  });

  it('errors: empty operands', () => {
    expect(compileTreeColumnFilter(f('contains', '  '), 'text')).toEqual({ error: 'Enter a value' });
    expect('error' in compileTreeColumnFilter(f('between', 'a', ''), 'text')).toBe(true);
    expect('error' in compileTreeColumnFilter(f('isOneOf', ' , '), 'text')).toBe(true);
    expect('error' in compileTreeColumnFilter(f('contains', 'x'), 'number')).toBe(true); // not offered for numbers
  });
});

describe('number / date / boolean filters', () => {
  it('numbers: %, spaces and decimal commas are accepted', () => {
    expect(test1(f('isExactly', '50%'), 'number', 50)).toBe(true);
    expect(test1(f('after', '1,5'), 'number', 2)).toBe(true);
    expect(test1(f('lessThanOrEqual', '10'), 'number', 10)).toBe(true);
    expect(test1(f('between', '5', '1'), 'number', 3)).toBe(true);
    expect(test1(f('isOneOf', '1, 5, 10'), 'number', 5)).toBe(true);
    expect(test1(f('isNot', '3'), 'number', null)).toBe(true);
    expect(test1(f('after', '3'), 'number', null)).toBe(false);
    expect(compileTreeColumnFilter(f('isExactly', 'abc'), 'number')).toEqual({ error: '"abc" is not a number' });
  });

  it('dates: YYYY-MM-DD, D.M.YYYY, M/D/YYYY, t, (day(n))', () => {
    const d = Date.UTC(2018, 3, 27);
    expect(parseFilterDate('2018-04-27')).toBe(d);
    expect(parseFilterDate('27.4.2018')).toBe(d);
    expect(parseFilterDate('4/27/2018')).toBe(d);
    expect(parseFilterDate('t', T0)).toBe(T0);
    expect(parseFilterDate('(day(-1))', T0)).toBe(T0 - 86_400_000);
    expect(parseFilterDate('2018-02-30')).toBeNull();
    expect(test1(f('between', '4/27/2018', '10/23/2018'), 'date', Date.UTC(2018, 5, 1))).toBe(true);
    expect(test1(f('after', 't'), 'date', T0 + 86_400_000)).toBe(true);
    expect(test1(f('lessThanOrEqual', '2018-04-27'), 'date', d)).toBe(true);
  });

  it('booleans: yes / no; empty / not empty', () => {
    expect(test1(f('isExactly', 'yes'), 'boolean', true)).toBe(true);
    expect(test1(f('isExactly', 'no'), 'boolean', true)).toBe(false);
    expect(test1(f('isNot', 'yes'), 'boolean', null)).toBe(true);
    expect(test1(f('isEmpty'), 'boolean', null)).toBe(true);
    expect(test1(f('isNotEmpty'), 'text', 'x')).toBe(true);
    expect(test1(f('isNotEmpty'), 'text', '')).toBe(false);
  });
});

describe('matches (old AX / D365 syntax)', () => {
  const m = (expr: string, type: PMTreeColumnDataType, v: any) => {
    const c = compileMatches(expr, type, T0);
    if ('error' in c) throw new Error(c.error);
    return c.test(v);
  };
  it('"G*V, !Gustav" = starts with G, ends with V, not Gustav', () => {
    expect(m('G*V, !Gustav', 'text', 'Gustav')).toBe(false);
    expect(m('G*V, !Gustav', 'text', 'gustav V')).toBe(true);
    expect(m('G*V, !Gustav', 'text', 'Gerv')).toBe(true);
    expect(m('G*V, !Gustav', 'text', 'Hugo')).toBe(false);
  });
  it('wildcards, ranges, comparisons, lists, empty', () => {
    expect(m('De?ign', 'text', 'design')).toBe(true);
    expect(m('a..c', 'text', 'b')).toBe(true);
    expect(m('..c', 'text', 'z')).toBe(false);
    expect(m('10..20, !15', 'number', 15)).toBe(false);
    expect(m('10..20, !15', 'number', 12)).toBe(true);
    expect(m('>5', 'number', 6)).toBe(true);
    expect(m('<5', 'number', 6)).toBe(false);
    expect(m('>=5', 'number', 5)).toBe(true);
    expect(m('1, 3', 'number', 3)).toBe(true);
    expect(m('""', 'text', '')).toBe(true);
    expect(m('!""', 'text', '')).toBe(false);
    expect(m('!a', 'text', 'b')).toBe(true);
    expect(m('2026*', 'date', Date.UTC(2026, 0, 5))).toBe(true); // wildcards on the date text
    expect(m('(day(-1))..t', 'date', T0)).toBe(true);
  });
  it('errors', () => {
    expect('error' in compileMatches('', 'text')).toBe(true);
    expect('error' in compileMatches('..', 'text')).toBe(true);
    expect('error' in compileMatches('>x', 'number')).toBe(true);
    expect('error' in compileMatches('!', 'text')).toBe(true);
  });
});

describe('describe / normalize / icon color', () => {
  it('describes a filter', () => {
    expect(describeTreeColumnFilter(f('beginsWith', 'Des'), 'text')).toBe('begins with "Des"');
    expect(describeTreeColumnFilter(f('between', '1', '5'), 'number')).toBe('between 1 and 5');
    expect(describeTreeColumnFilter(f('isEmpty'), 'date')).toBe('is empty');
  });
  it('saved filters / sort are validated', () => {
    expect(normalizeTreeColumnsFilters({ name: { filterVariantForColumn: 'contains', value: 'x', junk: 1 }, days: { filterVariantForColumn: 'nope' }, x: 5 })).toEqual({
      name: { filterVariantForColumn: 'contains', value: 'x' },
    });
    expect(normalizeTreeColumnsFilters({ name: { filterVariantForColumn: 'isEmpty' } }, ['days'])).toEqual({});
    expect(normalizeTreeColumnSort({ key: 'days', direction: 'desc' })).toEqual({ key: 'days', direction: 'desc' });
    expect(normalizeTreeColumnSort({ key: 'days', direction: 'up' })).toBeNull();
    expect(normalizeTreeColumnSort(null)).toBeNull();
  });
  it('uxuiSettingsOf reads them; icon color default = light vibrant red', () => {
    const u = uxuiSettingsOf({ rowKind: 'project', name: 'p', durationDays: 0, uxuiSettings: { treeColumnSort: { key: 'name', direction: 'asc' }, columnFilterIconColor: '#0a84ff' } } as any);
    expect(u.treeColumnSort).toEqual({ key: 'name', direction: 'asc' });
    expect(u.columnFilterIconColor).toBe('#0A84FF');
    expect(uxuiSettingsOf(undefined).columnFilterIconColor).toBe('#FF4D6D');
    expect(columnFilterIconColorOf('red')).toBe('#FF4D6D');
  });
});

// ---------------------------------------------------------------------------------------
// tree rows
// ---------------------------------------------------------------------------------------
const P = 'p1';
const lab = (g: string) => g.toLowerCase().replace(/-/g, '_');
const task = (id: string, parent: string | null, order: number, name: string, extra: Record<string, unknown> = {}): PMTaskRow =>
  ({
    rowGUID: id,
    treePath: parent ? `${P}.${lab(parent)}.${lab(id)}` : `${P}.${lab(id)}`,
    projectGUID: P,
    rowOwnerGUID: 'u',
    rowDuration: null,
    rowProgress: 0,
    orderInList: order,
    rowJSON: { rowKind: parent ? 'task' : 'stage', name, durationDays: 1, ...extra },
  }) as PMTaskRow;

//  S1 Design          (stage)
//    t1 Sketch   days 3  owner Ann
//    t2 Review   days 1  owner (empty)
//  S2 Build           (stage)
//    t3 Code     days 5  owner Bob
//    t4 Deploy   days 2  owner Ann
const tasks = [
  task('S1', null, 1, 'Design'),
  task('t1', 'S1', 1, 'Sketch', { durationDays: 3, customColumns: { cc_owner001: 'Ann' } }),
  task('t2', 'S1', 2, 'Review', { durationDays: 1 }),
  task('S2', null, 2, 'Build'),
  task('t3', 'S2', 1, 'Code', { durationDays: 5, customColumns: { cc_owner001: 'Bob' } }),
  task('t4', 'S2', 2, 'Deploy', { durationDays: 2, customColumns: { cc_owner001: 'Ann' } }),
];
// stage S2 needs the parent path of t3 / t4: treePath p1.S2.t3
const tree = buildTreeIndex(tasks);
const tasksById = Object.fromEntries(tasks.map((t) => [t.rowGUID, t]));
const customColumns = [{ key: 'cc_owner001' as const, name: 'Owner', type: 'text' as const }];
const ctx: PMTreeFilterContext = { tasksById, schedule: {}, tree, customColumns };

describe('filterAndSortTreeRows', () => {
  it('no filter / sort = the expanded tree order', () => {
    expect(filterAndSortTreeRows(tree, {}, ctx, {}, null).visibleRows).toEqual(['S1', 't1', 't2', 'S2', 't3', 't4']);
    expect(filterAndSortTreeRows(tree, { S1: false }, ctx, {}, null).visibleRows).toEqual(['S1', 'S2', 't3', 't4']);
  });

  it('matching rows + their ancestors (context rows)', () => {
    const r = filterAndSortTreeRows(tree, {}, ctx, { cc_owner001: f('isExactly', 'ann') }, null);
    expect(r.visibleRows).toEqual(['S1', 't1', 'S2', 't4']);
    expect(r.contextGUIDs).toEqual({ S1: true, S2: true });
    expect(r.matchCount).toBe(2);
    expect(r.appliedFilterKeys).toEqual(['cc_owner001']);
  });

  it('a matching stage stays even without matching children; filters are AND-ed', () => {
    expect(filterAndSortTreeRows(tree, {}, ctx, { name: f('beginsWith', 'b') }, null).visibleRows).toEqual(['S2']);
    const both = filterAndSortTreeRows(tree, {}, ctx, { cc_owner001: f('isExactly', 'Ann'), name: f('contains', 'dep') }, null);
    expect(both.visibleRows).toEqual(['S2', 't4']);
  });

  it('invalid filters and unknown columns are ignored', () => {
    const r = filterAndSortTreeRows(tree, {}, ctx, { name: f('contains', ''), cc_gone0001: f('isEmpty') }, null);
    expect(r.visibleRows).toHaveLength(6);
    expect(r.contextGUIDs).toBeNull();
  });

  it('sort = siblings inside every parent; empty values last in both directions', () => {
    expect(filterAndSortTreeRows(tree, {}, ctx, {}, { key: 'name', direction: 'desc' }).visibleRows).toEqual(['S1', 't1', 't2', 'S2', 't4', 't3']);
    expect(filterAndSortTreeRows(tree, {}, ctx, {}, { key: 'days', direction: 'asc' }).visibleRows).toEqual(['S1', 't2', 't1', 'S2', 't4', 't3']);
    // t2 has no owner: last in asc AND desc
    expect(filterAndSortTreeRows(tree, {}, ctx, {}, { key: 'cc_owner001', direction: 'asc' }).visibleRows.slice(0, 3)).toEqual(['S1', 't1', 't2']);
    expect(filterAndSortTreeRows(tree, {}, ctx, {}, { key: 'cc_owner001', direction: 'desc' }).visibleRows).toEqual(['S1', 't1', 't2', 'S2', 't3', 't4']);
  });

  it('cell values', () => {
    expect(treeCellFilterValue('name', 't1', ctx)).toBe('Sketch');
    expect(treeCellFilterValue('days', 't3', ctx)).toBe(5);
    expect(treeCellFilterValue('wbs', 't4', ctx)).toBe('2.2');
    expect(treeCellFilterValue('cc_owner001', 't2', ctx)).toBeNull();
  });
});

describe('header filter icon geometry', () => {
  const layout = layoutTreeColumns(600, ['wbs', 'name', 'start', 'days', 'progress']);
  it('icon at the right of every column, left of the resize handle', () => {
    const name = layout.byKey.name!;
    const box = treeFilterIconBox(name)!;
    expect(box.x + box.size).toBeLessThan(name.x + name.w - 5);
    expect(treeFilterIconAt(layout, box.x + 4, 20)).toBe('name');
    expect(treeFilterIconAt(layout, name.x + 20, 20)).toBeNull(); // on the title
    expect(treeFilterIconAt(layout, name.x + name.w - 2, 20)).toBeNull(); // resize handle
    expect(treeFilterIconAt(layout, box.x + 4, 60)).toBeNull(); // below the header
    expect(treeFilterIconBox({ x: 0, w: 20 })).toBeNull(); // too narrow
    expect(treeHeaderTitleWidth(name, 10, true)).toBeLessThan(treeHeaderTitleWidth(name, 10, false));
  });
});

describe('store: visible rows follow the filters, the sort and the expansion', () => {
  const project: PMProjectRow = { rowGUID: P, treePath: P, rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name: 'P', durationDays: 0, customColumns: { columns: customColumns } } as any };
  it('setTreeColumnsSettings / toggleExpanded / expandRows / user settings re-compute visibleRows', () => {
    const s = usePMStore.getState();
    s.selectProject(null);
    s.setProjects([project]);
    usePMStore.getState().selectProject(P);
    usePMStore.getState().hydrate(P, tasks, []);
    expect(usePMStore.getState().visibleRows).toHaveLength(6);

    usePMStore.getState().setTreeColumnsSettings({ treeColumnsFilters: { cc_owner001: f('isExactly', 'Ann') } });
    let st = usePMStore.getState();
    expect(st.visibleRows).toEqual(['S1', 't1', 'S2', 't4']);
    expect(st.rowIndexById.t4).toBe(3);
    expect(st.treeFilterContextGUIDs).toEqual({ S1: true, S2: true });
    expect(st.treeFilterMatchCount).toBe(2);

    usePMStore.getState().toggleExpanded('S1'); // collapse: the filter stays
    expect(usePMStore.getState().visibleRows).toEqual(['S1', 'S2', 't4']);
    usePMStore.getState().expandRows(['S1']);
    expect(usePMStore.getState().visibleRows).toEqual(['S1', 't1', 'S2', 't4']);

    usePMStore.getState().setTreeColumnsSettings({ treeColumnSort: { key: 'name', direction: 'asc' } });
    expect(usePMStore.getState().visibleRows).toEqual(['S2', 't4', 'S1', 't1']); // Build < Design

    // the saved user row (e.g. after a refetch) is applied too
    usePMStore.getState().setProjectUserSettings(P, { treeColumnsFilters: {}, treeColumnSort: null });
    st = usePMStore.getState();
    expect(st.visibleRows).toEqual(['S1', 't1', 't2', 'S2', 't3', 't4']);
    expect(st.treeFilterMatchCount).toBeNull();
    expect(st.treeFilterContextGUIDs).toEqual({});
  });
});
