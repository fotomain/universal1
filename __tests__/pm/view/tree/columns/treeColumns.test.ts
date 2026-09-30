// kit8/pm/view/tree/columns (column order / layout / drag & drop) and the tree row panel placement.
import {
  layoutTreeColumns,
  moveTreeColumn,
  normalizeTreeColumnsOrder,
  PM_TREE_COLUMNS_DEFAULT_ORDER,
  PM_TREE_COLUMN_WIDTHS,
  PM_TREE_NAME_MIN_WIDTH,
  treeColumnAt,
  treeColumnDropSlot,
} from '../../../../../kit8/pm/view/tree/columns/treeColumns';
import { placeTreeRowPanel, treeRowPanelNaturalWidth, isOverTreeRowPanel } from '../../../../../kit8/pm/view/tree/panels/treeRowPanelGeometry';
import { uxuiSettingsOf } from '../../../../../kit8/pm/model/types';

const keys = (w: number, order?: unknown, showHierarchyNumbers?: boolean) => layoutTreeColumns(w, order, { showHierarchyNumbers }).columns.map((c) => c.key);

describe('tree columns: order', () => {
  it('"#" is the first column by default and "kanbanStageProgressPercent" is the last', () => {
    expect(PM_TREE_COLUMNS_DEFAULT_ORDER[0]).toBe('wbs');
    expect(PM_TREE_COLUMNS_DEFAULT_ORDER[PM_TREE_COLUMNS_DEFAULT_ORDER.length - 2]).toBe('kanban');
    expect(PM_TREE_COLUMNS_DEFAULT_ORDER[PM_TREE_COLUMNS_DEFAULT_ORDER.length - 1]).toBe('kanbanStageProgressPercent');
    expect(keys(600)).toEqual(['wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent']);
    expect(uxuiSettingsOf(undefined).treeColumnsOrder).toEqual(['wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent']);
    expect(uxuiSettingsOf(undefined).showTreeHierarchyNumbers).toBe(true);
  });

  it('normalizes saved orders (unknown / duplicate keys dropped, missing ones re-inserted)', () => {
    expect(normalizeTreeColumnsOrder(['name', 'bogus', 'name', 'progress'])).toEqual(['wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent']);
    expect(normalizeTreeColumnsOrder(['progress', 'taskDuration', 'taskStartDate', 'name', 'wbs'])).toEqual(['progress', 'taskDuration', 'taskStartDate', 'taskFinishDate', 'name', 'wbs', 'kanban', 'kanbanStageProgressPercent']);
    expect(normalizeTreeColumnsOrder(['name', 'wbs'])).toEqual(['name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'wbs', 'kanban', 'kanbanStageProgressPercent']);
    expect(normalizeTreeColumnsOrder(null)).toEqual([...PM_TREE_COLUMNS_DEFAULT_ORDER]);
    expect(uxuiSettingsOf({ uxuiSettings: { treeColumnsOrder: ['name', 'wbs'] as any, showTreeHierarchyNumbers: false } } as any)).toMatchObject({
      treeColumnsOrder: ['name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'wbs', 'kanban', 'kanbanStageProgressPercent'],
      showTreeHierarchyNumbers: false,
    });
  });
});

describe('tree columns: layout', () => {
  it('lays the columns out left to right, Task name takes the rest', () => {
    const l = layoutTreeColumns(600, PM_TREE_COLUMNS_DEFAULT_ORDER);
    const fixed =
      PM_TREE_COLUMN_WIDTHS.wbs +
      PM_TREE_COLUMN_WIDTHS.taskStartDate +
      PM_TREE_COLUMN_WIDTHS.taskFinishDate +
      PM_TREE_COLUMN_WIDTHS.taskDuration +
      PM_TREE_COLUMN_WIDTHS.progress +
      PM_TREE_COLUMN_WIDTHS.kanban +
      PM_TREE_COLUMN_WIDTHS.kanbanStageProgressPercent;
    expect(l.byKey.wbs).toMatchObject({ x: 0, w: PM_TREE_COLUMN_WIDTHS.wbs });
    expect(l.byKey.name).toMatchObject({ x: PM_TREE_COLUMN_WIDTHS.wbs, w: 600 - fixed });
    expect(l.columns[l.columns.length - 1].x + l.columns[l.columns.length - 1].w).toBe(600);
    expect(l.separators).toEqual(l.columns.slice(1).map((c) => c.x));
    expect(treeColumnAt(l, 1)).toBe('wbs');
    expect(treeColumnAt(l, 599)).toBe('kanbanStageProgressPercent');
    expect(treeColumnAt(l, 600)).toBeNull();
  });

  it('showTreeHierarchyNumbers = false hides "#"', () => {
    expect(keys(600, undefined, false)).toEqual(['name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent']);
  });

  it('narrow panes hide #, then Kanban %, then Kanban, then %, then Duration, then Finish, then Start - Task name always stays', () => {
    const all =
      PM_TREE_COLUMN_WIDTHS.wbs +
      PM_TREE_COLUMN_WIDTHS.taskStartDate +
      PM_TREE_COLUMN_WIDTHS.taskFinishDate +
      PM_TREE_COLUMN_WIDTHS.taskDuration +
      PM_TREE_COLUMN_WIDTHS.progress +
      PM_TREE_COLUMN_WIDTHS.kanban +
      PM_TREE_COLUMN_WIDTHS.kanbanStageProgressPercent;
    expect(keys(all + PM_TREE_NAME_MIN_WIDTH)).toContain('wbs');
    expect(keys(all + PM_TREE_NAME_MIN_WIDTH - 1)).toEqual(['name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent']);
    expect(keys(PM_TREE_NAME_MIN_WIDTH + PM_TREE_COLUMN_WIDTHS.taskStartDate + PM_TREE_COLUMN_WIDTHS.taskFinishDate + PM_TREE_COLUMN_WIDTHS.taskDuration + PM_TREE_COLUMN_WIDTHS.progress + PM_TREE_COLUMN_WIDTHS.kanban)).toEqual(['name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban']);
    expect(keys(PM_TREE_NAME_MIN_WIDTH + PM_TREE_COLUMN_WIDTHS.taskStartDate + PM_TREE_COLUMN_WIDTHS.taskFinishDate + PM_TREE_COLUMN_WIDTHS.taskDuration + PM_TREE_COLUMN_WIDTHS.progress)).toEqual(['name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress']);
    expect(keys(PM_TREE_NAME_MIN_WIDTH + PM_TREE_COLUMN_WIDTHS.taskStartDate + PM_TREE_COLUMN_WIDTHS.taskFinishDate + PM_TREE_COLUMN_WIDTHS.taskDuration)).toEqual(['name', 'taskStartDate', 'taskFinishDate', 'taskDuration']);
    expect(keys(PM_TREE_NAME_MIN_WIDTH + PM_TREE_COLUMN_WIDTHS.taskStartDate + PM_TREE_COLUMN_WIDTHS.taskFinishDate)).toEqual(['name', 'taskStartDate', 'taskFinishDate']);
    expect(keys(PM_TREE_NAME_MIN_WIDTH + PM_TREE_COLUMN_WIDTHS.taskStartDate)).toEqual(['name', 'taskStartDate']);
    expect(keys(100)).toEqual(['name']);
  });
});

describe('tree columns: drag & drop', () => {
  const l = layoutTreeColumns(600, PM_TREE_COLUMNS_DEFAULT_ORDER);
  it('drop slots are the nearest column boundary', () => {
    expect(treeColumnDropSlot(l, 0)).toBe(0);
    expect(treeColumnDropSlot(l, 600)).toBe(8);
    expect(treeColumnDropSlot(l, l.byKey.taskStartDate!.x + 3)).toBe(2);
  });

  it('moves a column; dropping on its own edges changes nothing', () => {
    expect(moveTreeColumn(l, 'wbs', 0)).toBe(l.order);
    expect(moveTreeColumn(l, 'wbs', 1)).toBe(l.order);
    expect(moveTreeColumn(l, 'wbs', 2)).toEqual(['name', 'wbs', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent']);
    expect(moveTreeColumn(l, 'progress', 0)).toEqual(['progress', 'wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'kanban', 'kanbanStageProgressPercent']);
    expect(moveTreeColumn(l, 'name', 8)).toEqual(['wbs', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent', 'name']);
  });

  it('hidden columns keep their place in the saved order', () => {
    const noNum = layoutTreeColumns(600, PM_TREE_COLUMNS_DEFAULT_ORDER, { showHierarchyNumbers: false });
    expect(moveTreeColumn(noNum, 'progress', 0)).toEqual(['wbs', 'progress', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'kanban', 'kanbanStageProgressPercent']);
    expect(moveTreeColumn(noNum, 'name', 7)).toEqual(['wbs', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent', 'name']);
  });
});

describe('tree row hover panel placement', () => {
  it('uses the width its icons need, not only the Task name column', () => {
    const l = layoutTreeColumns(380, PM_TREE_COLUMNS_DEFAULT_ORDER); // name column ~158px
    const box = placeTreeRowPanel(l, true);
    expect(box.width).toBe(treeRowPanelNaturalWidth(true));
    expect(box.width).toBeGreaterThan(l.byKey.name!.w);
    expect(box.left).toBeGreaterThanOrEqual(4);
    expect(box.left + box.width).toBeLessThanOrEqual(380 - 4);
    expect(isOverTreeRowPanel(box, box.left + 1)).toBe(true);
    expect(isOverTreeRowPanel(null, box.left + 1)).toBe(false);
  });

  it('ends at the Task name column right edge when it fits there', () => {
    const l = layoutTreeColumns(800, PM_TREE_COLUMNS_DEFAULT_ORDER);
    const name = l.byKey.name!;
    const box = placeTreeRowPanel(l, false);
    expect(box.left + box.width).toBe(name.x + name.w - 4);
    expect(box.left).toBeGreaterThanOrEqual(name.x);
  });

  it('is clamped to very narrow trees', () => {
    const l = layoutTreeColumns(200, PM_TREE_COLUMNS_DEFAULT_ORDER);
    const box = placeTreeRowPanel(l, true);
    expect(box).toEqual({ left: 4, width: 192 });
  });
});
