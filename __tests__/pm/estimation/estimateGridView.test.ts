import { buildExternalView, findCells, gridColumnValue, gridFilterOps, stepFind, allTreeGUIDs } from '../../../kit8/pm/estimation/model/estimateGridView';
import { buildGridRows, gridColumns } from '../../../kit8/pm/estimation/model/estimateGridModel';
import { filterAndSortTreeRows } from '../../../kit8/pm/view/tree/filter/treeColumnFilter';

// stage S1 { a (qty 5), b (qty 2), c (no qty) }, stage S2 { d (qty 9) }
const children: Record<string, string[]> = { __root__: ['S1', 'S2'], S1: ['a', 'b', 'c'], S2: ['d'] };
const kinds: Record<string, string> = { S1: 'stage', S2: 'stage', a: 'task', b: 'task', c: 'task', d: 'task' };
const line = (task: string, qty: number | undefined, title: string) => ({ rowGUID: `L${task}`, rowOwnerGUID: 'x', rowParentGUID: 'x', orderInList: 1, rowJSON: { taskGUID: task, lineKind: 'position', title, qty, unit: 'm3' } }) as any;
const lines = [line('a', 5, 'Concrete'), line('b', 2, 'Brick wall'), line('c', undefined, 'Paint'), line('d', 9, 'Concrete floor')];
const all = allTreeGUIDs('__root__', children);
const rows = buildGridRows({ visible: all, childrenById: children, kindOf: (g) => kinds[g], lines, byLine: {} });
const byGuid = Object.fromEntries(rows.map((r) => [r.guid, r]));
const { columns } = gridColumns('simple');
const col = (k: string) => columns.find((c) => c.key === k)!;
const ctx = { sumKey: 'sumForBudget', area: 0, totalCurrent: 0 } as any;
const view = (filters: any, sort: any) => buildExternalView({ rootKey: '__root__', childrenById: children, rowOf: (g) => byGuid[g], columns, ctx, filters, sort });
const tree = { wbsById: {}, childrenById: children } as any;
const order = (v: any) => filterAndSortTreeRows(tree, {}, { tasksById: {}, schedule: {}, tree, customColumns: [] } as any, {}, null, undefined, v).visibleRows;

describe('grid column values and operators', () => {
  test('numeric columns compare numbers, empty cells are null', () => {
    expect(gridColumnValue(col('qty'), byGuid.a, ctx)).toBe(5);
    expect(gridColumnValue(col('qty'), byGuid.c, ctx)).toBeNull();
    expect(gridColumnValue(col('title'), byGuid.b, ctx)).toBe('Brick wall');
    expect(gridFilterOps(col('qty'))).toEqual(['eq', 'gte', 'lte', 'empty', 'notEmpty']);
    expect(gridFilterOps(col('title'))).toEqual(['contains', 'empty', 'notEmpty']);
  });
});

describe('the grid filter / sort reaches the tree rows', () => {
  test('no filter and no sort = nothing to apply', () => { expect(view({}, null)).toBeNull(); expect(view({ qty: { op: 'gte', value: '' } }, null)).toBeNull(); });
  test('a filter keeps the matching tasks and their stage (context); a stage with no match goes', () => {
    expect(order(view({ title: { op: 'contains', value: 'concrete' } }, null))).toEqual(['S1', 'a', 'S2', 'd']);
    expect(order(view({ qty: { op: 'gte', value: '9' } }, null))).toEqual(['S2', 'd']);
    expect(order(view({ qty: { op: 'empty' } }, null))).toEqual(['S1', 'c']);
  });
  test('a sort orders the tasks inside their stage; empty cells are last in both directions', () => {
    expect(order(view({}, { key: 'qty', direction: 'asc' }))).toEqual(['S1', 'b', 'a', 'c', 'S2', 'd']);
    expect(order(view({}, { key: 'qty', direction: 'desc' }))).toEqual(['S2', 'd', 'S1', 'a', 'b', 'c']); // the stage sums (9 and 7) are sorted too
    expect(order(view({}, { key: 'title', direction: 'asc' }))[1]).toBe('b');
  });
});

describe('find', () => {
  test('finds the cells that contain the text, row by row', () => {
    const found = findCells(rows.filter((r) => r.kind === 'task'), columns, ctx, 'CONCRETE');
    expect(found.map((f) => `${f.guid}:${f.colKey}`)).toEqual(['a:title', 'd:title']);
    expect(findCells(rows, columns, ctx, '  ')).toEqual([]);
  });
  test('the next / previous match goes round', () => {
    expect(stepFind(3, -1, 1)).toBe(0);
    expect(stepFind(3, 2, 1)).toBe(0);
    expect(stepFind(3, 0, -1)).toBe(2);
    expect(stepFind(0, -1, 1)).toBe(-1);
  });
});
