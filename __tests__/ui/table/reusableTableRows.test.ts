// ReusableTable pure helpers: order, dependent columns, number input, search text.
import { fitColumnWidths, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, colorToHex, moveSelectedRows, stretchColumns, widthOf, arrangeColumns, clampColumnWidth, columnDropIndex, moveColumn, dependentColumns, emptyRowJSON, insertRow, moveRow, parseNumberInput, patchForCell, rowSearchText, sanitizeNumberText, sortRows } from '../../../kit8/ui/components/table/reusable/tableRows';
import { filterRows, matchesFilter, sortRowsByColumn } from '../../../kit8/ui/components/table/reusable/tableFilter';
import { buildTableExport, exportFileName, exportToCSV, exportToJSON } from '../../../kit8/ui/components/table/reusable/tableExport';
import { buildTextTablePdf, layoutTablePdf, approxMeasure, pdfString } from '../../../kit8/ui/components/table/reusable/tablePdf';
import { addToSearchHistory } from '../../../kit8/ui/components/table/reusable/useSearchHistory';
import { buildReturnToRoute, safeReturnToRoute } from '../../../kit8/lib/returnToRoute';
import { personFullName, taskExpenseInputColumns as cols } from './fixtures/taskExpenseInputModel';

const rows = [
  { rowGUID: 'a', orderInList: 100, rowJSON: {} },
  { rowGUID: 'b', orderInList: 200, rowJSON: {} },
  { rowGUID: 'c', orderInList: 300, rowJSON: {} },
];

it('sortRows: ascending orderInList', () => {
  expect(sortRows([rows[2], rows[0], rows[1]]).map((r) => r.rowGUID)).toEqual(['a', 'b', 'c']);
});

it('moveRow: the moved row gets an order between its new neighbours', () => {
  const { rows: next, moved } = moveRow(rows, 2, 1);
  expect(next.map((r) => r.rowGUID)).toEqual(['a', 'c', 'b']);
  expect(moved!.orderInList).toBe(150);
  const first = moveRow(rows, 2, 0);
  expect(first.moved!.orderInList).toBeLessThan(100);
  const last = moveRow(rows, 0, 2);
  expect(last.moved!.orderInList).toBeGreaterThan(300);
  expect(moveRow(rows, 1, 1).moved).toBeNull();
  expect(moveRow(rows, 0, -1).moved).toBeNull();
});

it('insertRow: order between neighbours / before first / after last', () => {
  const n = { rowGUID: 'n', orderInList: 999999, rowJSON: {} };
  expect(insertRow(rows, n, 1).inserted.orderInList).toBe(150);
  expect(insertRow(rows, n, 0).inserted.orderInList).toBeLessThan(100);
  expect(insertRow(rows, n, 3).inserted.orderInList).toBeGreaterThan(300);
  expect(insertRow(rows, n, 1).rows.map((r) => r.rowGUID)).toEqual(['a', 'n', 'b', 'c']);
});

it('TableExample2 columns: contract depends on person and is cleared with it', () => {
  expect(dependentColumns(cols, 'person').map((c) => c.key)).toEqual(['contract']);
  expect(patchForCell(cols, 'person', 'p2')).toEqual({ personGUID: 'p2', contractGUID: null });
  expect(patchForCell(cols, 'contract', 'c1')).toEqual({ contractGUID: 'c1' });
  expect(patchForCell(cols, 'hours', 8)).toEqual({ hours: 8 });
  expect(emptyRowJSON(cols)).toEqual({ personGUID: null, contractGUID: null, hours: null });
});

it('number input: integer, clamp, empty', () => {
  expect(parseNumberInput('12', { integer: true })).toBe(12);
  expect(parseNumberInput('12.9', { integer: true })).toBe(12);
  expect(parseNumberInput('', { integer: true })).toBeNull();
  expect(parseNumberInput('-5', { integer: true, min: 0 })).toBe(0);
  expect(parseNumberInput('7,5')).toBe(7.5);
  expect(sanitizeNumberText('1a2.3', true, false)).toBe('123');
  expect(sanitizeNumberText('-4', true, false)).toBe('4');
  expect(sanitizeNumberText('1.2.3', false, true)).toBe('1.23');
});

it('search text uses catalog titles, not GUIDs; person title = first + last name', () => {
  expect(personFullName({ rowJSON: { personFirstName: 'John', personLastName: 'Doe', personTitle: 'JD' } })).toBe('John Doe');
  const text = rowSearchText({ rowGUID: 'x', rowJSON: { personGUID: 'p1', contractGUID: 'c1', hours: 8 } }, cols, (col, guid) => (guid === 'p1' ? 'John Doe' : 'EMP-1'));
  expect(text).toBe('john doe emp-1 8');
});

it('columns: user order + widths, move, drop index', () => {
  expect(arrangeColumns(cols, ['hours', 'zzz', 'person'], { hours: 10, person: 300 }).map((c) => [c.key, c.width])).toEqual([
    ['hours', 40], ['person', 300], ['tableRowNumber', undefined], ['contract', 260],
  ]);
  expect(arrangeColumns(cols).map((c) => c.key)).toEqual(['tableRowNumber', 'person', 'contract', 'hours']);
  expect(clampColumnWidth(5000)).toBe(800);
  expect(moveColumn(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  const same = ['a', 'b'];
  expect(moveColumn(same, 1, 1)).toBe(same);
  // widths 100 | 200 | 100: column 0 (center 50) dragged right
  expect(columnDropIndex([100, 200, 100], 0, 20)).toBe(0);
  expect(columnDropIndex([100, 200, 100], 0, 60)).toBe(1);
  expect(columnDropIndex([100, 200, 100], 0, 900)).toBe(2);
  expect(columnDropIndex([100, 200, 100], 2, -400)).toBe(0);
});

describe('column sort + filter', () => {
  const title = (_c: any, g: string) => ({ p1: 'Zoe', p2: 'adam' } as any)[g] || '';
  const data = [
    { rowGUID: '1', rowJSON: { personGUID: 'p1', hours: 8 } },
    { rowGUID: '2', rowJSON: { personGUID: null, hours: null } },
    { rowGUID: '3', rowJSON: { personGUID: 'p2', hours: 12 } },
  ];
  const ids = (r: any[]) => r.map((x) => x.rowGUID).join('');
  it('sorts catalog columns by title, numbers by value, empty cells last', () => {
    expect(ids(sortRowsByColumn(data, cols, { key: 'person', direction: 'asc' }, title))).toBe('312');
    expect(ids(sortRowsByColumn(data, cols, { key: 'person', direction: 'desc' }, title))).toBe('132');
    expect(ids(sortRowsByColumn(data, cols, { key: 'hours', direction: 'desc' }, title))).toBe('312');
    expect(sortRowsByColumn(data, cols, null, title)).toBe(data);
  });
  it('filters: contains (title), number compare, empty / not empty, all AND-ed', () => {
    expect(ids(filterRows(data, cols, { person: { op: 'contains', value: 'ZO' } }, title))).toBe('1');
    expect(ids(filterRows(data, cols, { hours: { op: 'gte', value: '9' } }, title))).toBe('3');
    expect(ids(filterRows(data, cols, { hours: { op: 'empty' } }, title))).toBe('2');
    expect(ids(filterRows(data, cols, { person: { op: 'notEmpty' }, hours: { op: 'lte', value: '8' } }, title))).toBe('1');
    expect(filterRows(data, cols, { person: { op: 'contains', value: ' ' } }, title)).toBe(data);
    expect(matchesFilter(5, { op: 'eq', value: '5,0' })).toBe(true);
  });
});

it('stretchColumns: extra width goes to the columns the user did not resize; row number keeps its width', () => {
  const total = cols.reduce((w, c) => w + widthOf(c), 0);
  const wide = stretchColumns(cols, total + 300);
  expect(wide.reduce((w, c) => w + widthOf(c), 0)).toBe(total + 300);
  expect(widthOf(wide[0])).toBe(widthOf(cols[0]));
  const resized = stretchColumns(cols, total + 300, { person: 230 });
  expect(widthOf(resized[1])).toBe(230);
  expect(resized.reduce((w, c) => w + widthOf(c), 0)).toBe(total + 300);
  expect(stretchColumns(cols, total - 50)).toBe(cols);
});

describe('export', () => {
  const title = (_c: any, g: string) => ({ p1: 'Jānis "JB" Bērziņš', c1: 'EMP-1, main' } as any)[g] || '';
  const data = [
    { rowGUID: 'r1', rowOwnerGUID: 'proj', rowParentGUID: 'task', orderInList: 1, rowJSON: { personGUID: 'p1', contractGUID: 'c1', hours: 8 } },
    { rowGUID: 'r2', rowOwnerGUID: 'proj', rowParentGUID: 'task', orderInList: 2, rowJSON: { personGUID: null, contractGUID: null, hours: null } },
  ];
  const full = buildTableExport({ title: 'Task expenses', rows: data, columns: cols, catalogTitle: title, withGuids: true });
  const vis = buildTableExport({ title: 'Task expenses', rows: data, columns: cols, catalogTitle: title, withGuids: false });

  it('visible = what the table shows; full adds the GUIDs', () => {
    expect(vis.headers).toEqual(['#', 'Person', 'Contract', 'Hours']);
    expect(vis.rows[0]).toEqual(['1', 'Jānis "JB" Bērziņš', 'EMP-1, main', '8']);
    expect(full.headers).toEqual(['#', 'Person', 'Person GUID', 'Contract', 'Contract GUID', 'Hours', 'rowGUID', 'rowOwnerGUID', 'rowParentGUID']);
    expect(full.rows[0]).toEqual(['1', 'Jānis "JB" Bērziņš', 'p1', 'EMP-1, main', 'c1', '8', 'r1', 'proj', 'task']);
    expect(full.rows[1]).toEqual(['2', '', '', '', '', '', 'r2', 'proj', 'task']);
  });
  it('JSON: visible values + rowJSON with the GUIDs', () => {
    const json = JSON.parse(exportToJSON(full, new Date('2026-10-07T12:00:00Z')));
    expect(json.rowCount).toBe(2);
    expect(json.rows[0]).toMatchObject({ rowNumber: 1, rowGUID: 'r1', visible: { Person: 'Jānis "JB" Bērziņš', Contract: 'EMP-1, main', Hours: 8 }, rowJSON: { personGUID: 'p1', contractGUID: 'c1', hours: 8 } });
    expect(json.rows[1].visible).toEqual({ Person: null, Contract: null, Hours: null });
  });
  it('CSV: BOM, quotes and commas escaped', () => {
    const csv = exportToCSV(vis);
    expect(csv.startsWith('\uFEFF#,Person,Contract,Hours\r\n')).toBe(true);
    expect(csv).toContain('1,"Jānis ""JB"" Bērziņš","EMP-1, main",8\r\n');
  });
  it('file name', () => {
    expect(exportFileName('Task expenses', 'csv', new Date(2026, 9, 7, 14, 5))).toBe('task_expenses_2026-10-07_1405.csv');
    expect(exportFileName('Šī tabula', 'pdf', new Date(2026, 0, 2, 3, 4))).toBe('si_tabula_2026-01-02_0304.pdf');
  });
  it('PDF: valid structure, pages, Windows-1252 text', () => {
    expect(pdfString('a(b)\\')).toBe('(a\\(b\\)\\\\)');
    expect(pdfString('Jānis Šmits š €')).toBe('(Janis \\212mits \\232 \\200)');
    expect(pdfString('Иван')).toBe('(????)');
    const many = Array.from({ length: 70 }, (_x, i) => [String(i + 1), 'John Doe', 'EMP', '8']);
    expect(layoutTablePdf(vis.headers, many, approxMeasure).pages.length).toBe(3);
    const bytes = buildTextTablePdf('Task expenses', '70 rows', vis.headers, many);
    const str = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    expect(str.startsWith('%PDF-1.4')).toBe(true);
    expect(str.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(str).toContain('/Count 3');
    expect(str).toContain('(page 3 / 3)');
    // every xref offset points at its object
    const xref = Number(/startxref\n(\d+)/.exec(str)![1]);
    expect(str.slice(xref, xref + 4)).toBe('xref');
    const offsets = [...str.slice(xref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(str.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
});

it('search history: newest first, no duplicates, limited', () => {
  expect(addToSearchHistory(['b', 'a'], ' c ')).toEqual(['c', 'b', 'a']);
  expect(addToSearchHistory(['b', 'a'], 'A')).toEqual(['A', 'b']);
  const same = ['x'];
  expect(addToSearchHistory(same, 'x')).toBe(same);
  expect(addToSearchHistory(same, '  ')).toBe(same);
  expect(addToSearchHistory(['1', '2', '3'], '4', 3)).toEqual(['4', '1', '2']);
});

it('moveSelectedRows: selected rows move together, blocks keep their order, edges stay', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((g, i) => ({ rowGUID: g, orderInList: (i + 1) * 100, rowJSON: {} }));
  const ids = (r: any[]) => r.map((x) => x.rowGUID).join('');
  const up = moveSelectedRows(five, ['c', 'd'], -1);
  expect(ids(up.rows)).toBe('acdbe');
  expect(up.moved.map((m) => m.rowGUID)).toEqual(['b']); // the neighbour jumped over the block
  expect(up.moved[0].orderInList).toBe(450);
  expect(ids(moveSelectedRows(five, ['b', 'd'], 1).rows)).toBe('acbed');
  expect(ids(moveSelectedRows(five, ['a', 'b', 'd'], -1).rows)).toBe('abdce'); // the block at the top stays
  expect(moveSelectedRows(five, ['a', 'b'], -1).moved).toEqual([]);
  expect(moveSelectedRows(five, ['e'], 1).moved).toEqual([]);
  const sorted = [...up.rows].sort((x, y) => x.orderInList! - y.orderInList!);
  expect(ids(sorted)).toBe('acdbe'); // the new orders give the same sequence after a re-read
});

it('returnTo: only in-app paths; built from the current path, its parameters and the extras', () => {
  expect(safeReturnToRoute('/demo/reusabletable?focusRowGUID=r1')).toBe('/demo/reusabletable?focusRowGUID=r1');
  expect(safeReturnToRoute(['/a'])).toBe('/a');
  expect(safeReturnToRoute('//evil.example')).toBeNull();
  expect(safeReturnToRoute('https://evil.example')).toBeNull();
  expect(safeReturnToRoute('/\\evil.example')).toBeNull();
  expect(safeReturnToRoute(undefined)).toBeNull();
  expect(buildReturnToRoute('/pm/task', { taskGUID: 't1', returnTo: '/old', focusRowGUID: 'old' }, { focusRowGUID: 'r 1' })).toBe('/pm/task?taskGUID=t1&focusRowGUID=r%201');
  expect(buildReturnToRoute('/x', null)).toBe('/x');
});

it('colorToHex', () => {
  expect(colorToHex('rgb(231, 224, 236)')).toBe('#e7e0ec');
  expect(colorToHex('rgba(0, 0, 0, 0.5)')).toBe('#00000080');
  expect(colorToHex('#ABC')).toBe('#aabbcc');
  expect(colorToHex('#E7E0EC')).toBe('#e7e0ec');
  expect(colorToHex('transparent')).toBe('transparent');
});

describe('fitColumnWidths ("Fit to width": all columns visible)', () => {
  const col = (key: string, width: number, type: any = 'text') => ({ key, title: key, type, width }) as any;
  const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

  it('shrinks a too wide table to exactly the available width, keeping the proportions; the row number keeps its width', () => {
    const cols = [col('n', 50, 'rowNumber'), col('a', 400), col('b', 200), col('c', 200)];
    const w = fitColumnWidths(cols, 450);
    expect(w.n).toBe(50);
    expect(sum(w)).toBe(450);
    expect(w.a).toBe(200);
    expect(w.b).toBe(100);
    expect(w.c).toBe(100);
  });

  it('widens a narrow table too, so the columns fill it', () => {
    const w = fitColumnWidths([col('a', 100), col('b', 100)], 600);
    expect(w).toEqual({ a: 300, b: 300 });
  });

  it('the pixels left by rounding go to the last column: the sum is exact', () => {
    const w = fitColumnWidths([col('a', 100), col('b', 100), col('c', 100)], 500);
    expect(sum(w)).toBe(500);
    expect(w.a).toBe(166);
    expect(w.c).toBe(168);
  });

  it('a column never gets narrower than the minimum: it stays at it and the others share the rest', () => {
    const w = fitColumnWidths([col('a', 1000), col('b', 20), col('c', 1000)], 400);
    expect(w.b).toBe(MIN_COLUMN_WIDTH);
    expect(sum(w)).toBe(400);
    expect(w.a).toBe(180);
    expect(w.c).toBe(180);
  });

  it('a column never gets wider than the maximum', () => {
    const w = fitColumnWidths([col('a', 100), col('b', 100)], 3000);
    expect(w.a).toBe(MAX_COLUMN_WIDTH);
    expect(w.b).toBe(MAX_COLUMN_WIDTH);
  });

  it('too little room for even the minimum widths: every column gets the minimum (the table scrolls)', () => {
    expect(fitColumnWidths([col('a', 300), col('b', 300), col('c', 300)], 90)).toEqual({ a: MIN_COLUMN_WIDTH, b: MIN_COLUMN_WIDTH, c: MIN_COLUMN_WIDTH });
  });

  it('only a row number column, or no columns: nothing to fit', () => {
    expect(fitColumnWidths([col('n', 50, 'rowNumber')], 800)).toEqual({ n: 50 });
    expect(fitColumnWidths([], 800)).toEqual({});
  });
});
