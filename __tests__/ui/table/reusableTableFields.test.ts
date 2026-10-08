// ReusableTable - all-rows mode, root-column targets and the new column types (pure helpers).
import { REUSABLE_TABLE_ALL } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import {
  builtInCellError, cellPatch, cellValue, displayText, emptyRowJSON, filterOptions, isHexColor, isValidDay, newRowColumns, optionsOf, patchForCell, rowSearchText, tableScope,
} from '../../../kit8/ui/components/table/reusable/tableRows';
import { columnValue, filterRows } from '../../../kit8/ui/components/table/reusable/tableFilter';
import { buildTableExport } from '../../../kit8/ui/components/table/reusable/tableExport';

const types = [{ value: 't1', label: 'Smartphone' }, { value: 't2', label: 'Meal' }];
const columns: VisualColumn[] = [
  { key: 'n', title: '#', type: 'rowNumber' },
  { key: 'title', title: 'Title', type: 'text' },
  { key: 'type', title: 'Type', type: 'select', target: 'rowOwnerGUID', options: types },
  { key: 'folder', title: 'Folder', type: 'catalog', target: 'rowParentGUID', catalogEntityName: 'f' },
  { key: 'sub', title: 'Sub', type: 'catalog', catalogEntityName: 's', dependsOn: 'folder' },
  { key: 'active', title: 'Active', type: 'boolean' },
  { key: 'modes', title: 'Modes', type: 'multiSelect', options: [{ value: 'property', label: 'Property' }, { value: 'variant', label: 'Variant' }] },
  { key: 'day', title: 'Day', type: 'date' },
  { key: 'hex', title: 'Color', type: 'color' },
  { key: 'meta', title: 'Meta', type: 'json' },
];
const col = (k: string) => columns.find((c) => c.key === k)!;
const row = { rowGUID: 'r1', rowOwnerGUID: 't1', rowParentGUID: 'empty', rowJSON: { title: 'Phone', active: true, modes: ['variant', 'property'], day: '2026-10-08', hex: '#D32F2F', meta: { a: 1 } } };
const catalogTitle = (_c: VisualColumn, g: string) => ({ f1: 'Electronics' } as any)[g] || '';

describe('targets: rowJSON or a root column', () => {
  it('reads the root column; "empty" = nothing', () => {
    expect(cellValue(row, col('type'))).toBe('t1');
    expect(cellValue(row, col('folder'))).toBeNull();
    expect(cellValue(row, col('title'))).toBe('Phone');
  });
  it('a change is split into rowJSON / root columns; dependents are cleared; nothing = "empty"', () => {
    expect(cellPatch(columns, 'type', 't2')).toEqual({ rowJSON: {}, columns: { rowOwnerGUID: 't2' } });
    expect(cellPatch(columns, 'folder', null)).toEqual({ rowJSON: { sub: null }, columns: { rowParentGUID: 'empty' } });
    expect(cellPatch(columns, 'title', 'X')).toEqual({ rowJSON: { title: 'X' }, columns: {} });
    expect(patchForCell(columns, 'folder', 'f1')).toEqual({ sub: null });
  });
  it('a new row: rowJSON only for rowJSON columns (boolean false, multiSelect [])', () => {
    expect(emptyRowJSON(columns)).toEqual({ title: null, sub: null, active: false, modes: [], day: null, hex: null, meta: null });
  });
});

describe('all-rows mode (REUSABLE_TABLE_ALL)', () => {
  it('scope leaves "*" columns out', () => {
    expect(tableScope(REUSABLE_TABLE_ALL, REUSABLE_TABLE_ALL)).toEqual({});
    expect(tableScope('p1', 'empty')).toEqual({ rowOwnerGUID: 'p1', rowParentGUID: 'empty' });
    expect(tableScope(REUSABLE_TABLE_ALL, null, { rowParentGUID: 'x' })).toEqual({ rowParentGUID: 'x' });
  });
  it('owner / parent of a new row: defaults > scope > "empty"', () => {
    expect(newRowColumns(REUSABLE_TABLE_ALL, REUSABLE_TABLE_ALL)).toEqual({ rowOwnerGUID: 'empty', rowParentGUID: 'empty' });
    expect(newRowColumns(REUSABLE_TABLE_ALL, REUSABLE_TABLE_ALL, { rowOwnerGUID: 't1' })).toEqual({ rowOwnerGUID: 't1', rowParentGUID: 'empty' });
    expect(newRowColumns('p', 'task')).toEqual({ rowOwnerGUID: 'p', rowParentGUID: 'task' });
  });
});

describe('visible text: search, filter, sort, export', () => {
  it('labels instead of stored values', () => {
    expect(displayText(row, col('type'), catalogTitle)).toBe('Smartphone');
    expect(displayText(row, col('active'), catalogTitle)).toBe('Yes');
    expect(displayText({ ...row, rowJSON: { active: false } }, col('active'), catalogTitle)).toBe('No');
    expect(displayText(row, col('modes'), catalogTitle)).toBe('Variant, Property');
    expect(displayText(row, col('meta'), catalogTitle)).toBe('{"a":1}');
    expect(rowSearchText(row, columns, catalogTitle)).toContain('smartphone');
  });
  it('options may depend on the row', () => {
    const c: VisualColumn = { key: 'v', title: 'V', type: 'select', options: (r) => [{ value: String(r.rowOwnerGUID), label: 'own' }] };
    expect(optionsOf(c, row)).toEqual([{ value: 't1', label: 'own' }]);
  });
  it('column filter + export use the labels; select GUIDs exported too', () => {
    expect(columnValue(row, col('type'), catalogTitle)).toBe('Smartphone');
    const rows = [row, { ...row, rowGUID: 'r2', rowOwnerGUID: 't2' }];
    expect(filterRows(rows, columns, { type: { op: 'contains', value: 'meal' } }, catalogTitle).map((r) => r.rowGUID)).toEqual(['r2']);
    const ex = buildTableExport({ title: 'T', rows: [row], columns: [col('type'), col('active')], catalogTitle, withGuids: true });
    expect(ex.headers).toEqual(['Type', 'Type GUID', 'Active', 'rowGUID', 'rowOwnerGUID', 'rowParentGUID']);
    expect(ex.rows[0]).toEqual(['Smartphone', 't1', 'Yes', 'r1', 't1', 'empty']);
  });
  it('the picker search', () => {
    expect(filterOptions(types, 'MEA')).toEqual([types[1]]);
    expect(filterOptions(types, ' ')).toEqual(types);
  });
});

describe('built-in checks', () => {
  it('dates and colors', () => {
    expect(isValidDay('2026-02-28')).toBe(true);
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('8.10.2026')).toBe(false);
    expect(isHexColor('#abc')).toBe(true);
    expect(isHexColor('red')).toBe(false);
    expect(builtInCellError(col('day'), '2026-13-01')).toMatch(/YYYY-MM-DD/);
    expect(builtInCellError(col('hex'), 'blue')).toMatch(/#RRGGBB/);
    expect(builtInCellError(col('day'), null)).toBeNull();
  });
});
