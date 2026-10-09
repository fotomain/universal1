// kit8/pm/view/tree/columns: custom columns (AddCustomProjectTaskColumn), column widths (columnResizeWidth),
// horizontal scroll helpers and the row panel placement on a scrolled tree. Pure logic.
import {
  editTextOfCustomValue,
  formatCustomColumnValue,
  isCustomColumnKey,
  newCustomColumnKey,
  parseCustomColumnValue,
  PMCustomColumnDef,
  projectCustomColumnsOf,
  taskCustomValuesOf,
  validateCustomColumnName,
  withCustomColumnAdded,
  withCustomColumnDeleted,
  withHeaderBackgroundColor,
  PM_CUSTOM_COLUMN_DEFAULT_WIDTH,
} from '../../../../../kit8/pm/view/tree/columns/customColumns';
import {
  clampTreeColumnWidth,
  layoutTreeColumns,
  moveTreeColumn,
  normalizeTreeColumnsOrder,
  normalizeTreeColumnsWidths,
  PM_TREE_COLUMN_WIDTHS,
  PM_TREE_NAME_MIN_WIDTH,
  PM_TREE_NAME_RESIZE_MIN_WIDTH,
  scrollXToRevealColumn,
  treeColumnAt,
  treeColumnResizeHandleAt,
  treeColumnTitle,
  treeMaxScrollX,
} from '../../../../../kit8/pm/view/tree/columns/treeColumns';
import { placeTreeRowPanel, treeRowPanelViewLeft } from '../../../../../kit8/pm/view/tree/panels/treeRowPanelGeometry';
import { readableTextOn } from '../../../../../kit8/pm/view/theme';
import { uxuiSettingsOf } from '../../../../../kit8/pm/model/types';

const budget: PMCustomColumnDef = { key: 'cc_budget01', name: 'Budget', type: 'float' };
const ok: PMCustomColumnDef = { key: 'cc_approved', name: 'Approved', type: 'boolean' };
const due: PMCustomColumnDef = { key: 'cc_due00001', name: 'Due', type: 'date' };
const BUILTIN_FIXED = PM_TREE_COLUMN_WIDTHS.wbs + PM_TREE_COLUMN_WIDTHS.taskStartDate + PM_TREE_COLUMN_WIDTHS.taskFinishDate + PM_TREE_COLUMN_WIDTHS.taskDuration + PM_TREE_COLUMN_WIDTHS.progress + PM_TREE_COLUMN_WIDTHS.kanban + PM_TREE_COLUMN_WIDTHS.kanbanStageProgressPercent;

describe('custom column values', () => {
  it('parses every type; empty = cleared', () => {
    expect(parseCustomColumnValue('text', '  hello ')).toEqual({ value: '  hello ' });
    expect(parseCustomColumnValue('integer', '-42')).toEqual({ value: -42 });
    expect(parseCustomColumnValue('integer', '4.2')).toEqual({ error: 'whole number' });
    expect(parseCustomColumnValue('float', '1 250,5')).toEqual({ value: 1250.5 });
    expect(parseCustomColumnValue('float', '1e3')).toEqual({ value: 1000 });
    expect(parseCustomColumnValue('float', 'abc')).toEqual({ error: 'number' });
    expect(parseCustomColumnValue('date', '2026-9-3')).toEqual({ value: '2026-09-03' });
    expect(parseCustomColumnValue('date', '2026-02-30')).toEqual({ error: 'no such date' });
    expect(parseCustomColumnValue('date', '03.09.2026')).toEqual({ error: 'YYYY-MM-DD' });
    expect(parseCustomColumnValue('boolean', 'Yes')).toEqual({ value: true });
    expect(parseCustomColumnValue('boolean', '0')).toEqual({ value: false });
    expect(parseCustomColumnValue('boolean', 'maybe')).toEqual({ error: 'yes / no' });
    for (const t of ['text', 'date', 'boolean', 'integer', 'float'] as const) expect(parseCustomColumnValue(t, '   ')).toEqual({ value: null });
  });

  it('formats cells and editor text', () => {
    expect(formatCustomColumnValue('float', 0.1 + 0.2)).toBe('0.3');
    expect(formatCustomColumnValue('integer', 7)).toBe('7');
    expect(formatCustomColumnValue('boolean', true)).toBe(''); // drawn as a check box
    expect(formatCustomColumnValue('text', null)).toBe('');
    expect(editTextOfCustomValue('boolean', false)).toBe('no');
    expect(editTextOfCustomValue('date', '2026-01-02')).toBe('2026-01-02');
    expect(editTextOfCustomValue('integer', undefined)).toBe('');
  });

  it('task values: always an object', () => {
    expect(taskCustomValuesOf({ customColumns: { cc_a: 1 } } as any)).toEqual({ cc_a: 1 });
    expect(taskCustomValuesOf({ customColumns: [1, 2] } as any)).toEqual({});
    expect(taskCustomValuesOf(undefined)).toEqual({});
  });
});

describe('project.rowJSON.customColumns', () => {
  it('validates definitions and reads header colors (also the misspelled headersBacgroundColors key)', () => {
    const json = {
      customColumns: {
        columns: [budget, { key: 'bad key', name: 'x', type: 'text' }, { key: 'cc_x', name: 'X', type: 'money' }, budget, { key: 'cc_noname', type: 'text' }],
        headersBacgroundColors: { cc_budget01: '#fef3c7', name: 12 },
      },
    };
    const cc = projectCustomColumnsOf(json);
    expect(cc.columns.map((c) => c.key)).toEqual(['cc_budget01', 'cc_noname']);
    expect(cc.columns[1].name).toBe('cc_noname');
    expect(cc.headersBackgroundColors).toEqual({ cc_budget01: '#fef3c7' });
    expect(projectCustomColumnsOf(undefined)).toEqual({ columns: [], headersBackgroundColors: {} });
  });

  it('add / sql_for_delete / header color edits are pure', () => {
    const json = { customColumns: withCustomColumnAdded(undefined, budget) };
    const two = { customColumns: withCustomColumnAdded(json, ok) };
    expect(projectCustomColumnsOf(two).columns.map((c) => c.key)).toEqual(['cc_budget01', 'cc_approved']);
    const colored = { customColumns: withHeaderBackgroundColor(two, 'cc_budget01', '#dbeafe') };
    expect(projectCustomColumnsOf(colored).headersBackgroundColors).toEqual({ cc_budget01: '#dbeafe' });
    const deleted = withCustomColumnDeleted(colored, 'cc_budget01');
    expect(deleted).toEqual({ columns: [ok], headersBackgroundColors: {} });
    expect(withHeaderBackgroundColor(colored, 'cc_budget01', null).headersBackgroundColors).toEqual({});
    expect(json.customColumns.columns).toHaveLength(1); // not mutated
  });

  it('keys and names', () => {
    let i = 0;
    const seq = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const k1 = newCustomColumnKey([], () => seq[i++]);
    expect(isCustomColumnKey(k1)).toBe(true);
    i = 0;
    expect(newCustomColumnKey([k1], () => seq[i++])).not.toBe(k1); // unique
    expect(isCustomColumnKey('name')).toBe(false);
    expect(validateCustomColumnName('  ', [])).toBe('Enter a column name');
    expect(validateCustomColumnName('budget', [budget])).toBe('A column with this name already exists');
    expect(validateCustomColumnName('Task name', [])).toBe('This is the name of a built-in column');
    expect(validateCustomColumnName('x'.repeat(41), [])).toMatch(/At most/);
    expect(validateCustomColumnName('Owner', [budget])).toBeNull();
  });
});

describe('tree columns with custom columns', () => {
  it('a new custom column is the LAST column; deleted ones disappear from the order', () => {
    expect(normalizeTreeColumnsOrder(['wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress'], ['cc_budget01'])).toEqual(['wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent', 'cc_budget01']);
    // dragged into the middle: stays there
    expect(normalizeTreeColumnsOrder(['wbs', 'cc_budget01', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress'], ['cc_budget01'])).toEqual(['wbs', 'cc_budget01', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent']);
    // column deleted: dropped from the saved order
    expect(normalizeTreeColumnsOrder(['wbs', 'cc_budget01', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress'], [])).toEqual(['wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent']);
    // uxuiSettingsOf keeps the custom keys of the project
    const json = { customColumns: { columns: [budget, ok] }, uxuiSettings: { treeColumnsOrder: ['cc_approved', 'wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress'] } } as any;
    expect(uxuiSettingsOf(json).treeColumnsOrder).toEqual(['cc_approved', 'wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent', 'cc_budget01']);
  });

  it('lays custom columns out with their type width; they never hide - the tree scrolls horizontally', () => {
    const l = layoutTreeColumns(600, undefined, { customColumns: [budget, ok] });
    expect(l.columns.map((c) => c.key)).toEqual(['wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent', 'cc_budget01', 'cc_approved']);
    expect(l.byKey.cc_budget01).toMatchObject({ w: PM_CUSTOM_COLUMN_DEFAULT_WIDTH.float, customType: 'float', title: 'Budget' });
    expect(l.byKey.name!.w).toBe(PM_TREE_NAME_MIN_WIDTH); // flexible name column keeps its minimum
    expect(l.contentWidth).toBe(BUILTIN_FIXED + PM_TREE_NAME_MIN_WIDTH + PM_CUSTOM_COLUMN_DEFAULT_WIDTH.float + PM_CUSTOM_COLUMN_DEFAULT_WIDTH.boolean);
    expect(treeMaxScrollX(l)).toBe(l.contentWidth - 600);
    expect(treeColumnAt(l, l.contentWidth - 1)).toBe('cc_approved');
    // narrow pane: built-in columns still hide by their own widths only
    expect(layoutTreeColumns(250, undefined, { customColumns: [budget] }).columns.map((c) => c.key)).toEqual(['name', 'taskStartDate', 'cc_budget01']);
    expect(treeColumnTitle('cc_budget01', [budget])).toBe('Budget');
    expect(treeColumnTitle('progress')).toBe('%');
    expect(treeColumnTitle('kanban')).toBe('Kanban');
    expect(treeColumnTitle('kanbanStageProgressPercent')).toBe('Kanban %');
  });

  it('custom columns move by drag & drop like the built-in ones', () => {
    const l = layoutTreeColumns(900, undefined, { customColumns: [budget, due] });
    expect(moveTreeColumn(l, 'cc_due00001', 1)).toEqual(['wbs', 'cc_due00001', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent', 'cc_budget01']);
    expect(moveTreeColumn(l, 'name', 10)).toEqual(['wbs', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent', 'cc_budget01', 'cc_due00001', 'name']);
  });
});

describe('columnResizeWidth', () => {
  it('a saved Task name width makes the column fixed (no responsive hiding, horizontal scroll instead)', () => {
    const l = layoutTreeColumns(300, undefined, { widths: { name: 260 } });
    expect(l.columns.map((c) => c.key)).toEqual(['wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent']);
    expect(l.byKey.name!.w).toBe(260);
    expect(l.contentWidth).toBe(BUILTIN_FIXED + 260);
    // wide pane: a narrow fixed name leaves room on the right
    const wide = layoutTreeColumns(900, undefined, { widths: { name: 200 } });
    expect(wide.contentWidth).toBe(BUILTIN_FIXED + 200);
    expect(treeMaxScrollX(wide)).toBe(0);
  });

  it('other columns keep their saved width; the flexible Task name column fills the rest', () => {
    const l = layoutTreeColumns(600, undefined, { widths: { taskStartDate: 120, cc_budget01: 140 }, customColumns: [budget] });
    expect(l.byKey.taskStartDate!.w).toBe(120);
    expect(l.byKey.cc_budget01!.w).toBe(140);
    expect(l.byKey.name!.w).toBe(Math.max(PM_TREE_NAME_MIN_WIDTH, 600 - (BUILTIN_FIXED - PM_TREE_COLUMN_WIDTHS.taskStartDate + 120 + 140)));
  });

  it('clamps widths and drops junk', () => {
    expect(clampTreeColumnWidth('name', 10)).toBe(PM_TREE_NAME_RESIZE_MIN_WIDTH);
    expect(clampTreeColumnWidth('taskDuration', 5)).toBe(32);
    expect(clampTreeColumnWidth('taskDuration', 99999)).toBe(1200);
    expect(normalizeTreeColumnsWidths({ name: 250.4, taskDuration: 'x' as any, bogus: 10, cc_ok: 20 })).toEqual({ name: 250, cc_ok: 32 });
    expect(normalizeTreeColumnsWidths(null)).toEqual({});
    expect(uxuiSettingsOf({ uxuiSettings: { treeColumnsWidths: { name: 300 } } } as any).treeColumnsWidths).toEqual({ name: 300 });
  });

  it('resize handles sit on the right edge of every column (Task name included)', () => {
    const l = layoutTreeColumns(600, undefined);
    const name = l.byKey.name!;
    expect(treeColumnResizeHandleAt(l, name.x + name.w + 3)).toBe('name');
    expect(treeColumnResizeHandleAt(l, name.x + name.w - 4)).toBe('name');
    expect(treeColumnResizeHandleAt(l, name.x + name.w / 2)).toBeNull();
    expect(treeColumnResizeHandleAt(l, l.contentWidth - 1)).toBe('kanbanStageProgressPercent');
  });

  it('scrolls a column into view', () => {
    const l = layoutTreeColumns(600, undefined, { customColumns: [budget, ok] });
    const last = l.byKey.cc_approved!;
    expect(scrollXToRevealColumn(l, 'cc_approved', 0)).toBe(last.x + last.w - 600);
    expect(scrollXToRevealColumn(l, 'wbs', 200)).toBe(0);
    expect(scrollXToRevealColumn(l, 'name', 10)).toBe(10); // already visible
  });
});

describe('row panel on a horizontally scrolled tree', () => {
  it('stays inside the visible pane', () => {
    const l = layoutTreeColumns(380, undefined, { customColumns: [budget, ok], widths: { name: 400 } });
    const box = placeTreeRowPanel(l, false);
    expect(box.left + box.width).toBe(l.byKey.name!.x + 400 - 4); // content x: ends at the Task name right edge
    expect(treeRowPanelViewLeft(box.left, box.width, 0, 380)).toBe(380 - 4 - box.width);
    expect(treeRowPanelViewLeft(box.left, box.width, box.left - 20, 380)).toBe(20);
    expect(treeRowPanelViewLeft(box.left, box.width, 5000, 380)).toBe(4);
  });
});

describe('header colors', () => {
  it('picks readable header text', () => {
    expect(readableTextOn('#fef3c7')).toBe('#1f2937');
    expect(readableTextOn('#1e293b')).toBe('#f8fafc');
    expect(readableTextOn('tomato')).toBeNull();
  });
});
