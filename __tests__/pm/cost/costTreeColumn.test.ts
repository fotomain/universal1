// The Cost column of the tree (costTotalForBudget): shown only when asked, placed after "%", never in the default order, its title carries the budget currency, a saved order is kept.
import { PM_TREE_COLUMNS_DEFAULT_ORDER, PM_TREE_COLUMN_TITLES, PM_TREE_COLUMN_WIDTHS, isBuiltinTreeColumnKey, layoutTreeColumns, normalizeTreeColumnsOrder } from '../../../kit8/pm/view/tree/columns/treeColumns';

describe('the Cost column', () => {
  it('is a built-in key with a title and a width, but not in the default order (old saved orders and tests are unchanged)', () => {
    expect(isBuiltinTreeColumnKey('costTotalForBudget')).toBe(true);
    expect(PM_TREE_COLUMN_TITLES.costTotalForBudget).toBe('Cost');
    expect(PM_TREE_COLUMN_WIDTHS.costTotalForBudget).toBeGreaterThan(60);
    expect(PM_TREE_COLUMNS_DEFAULT_ORDER).not.toContain('costTotalForBudget');
    expect(normalizeTreeColumnsOrder(undefined)).not.toContain('costTotalForBudget');
  });
  it('is hidden by default and when showCost is false', () => {
    expect(layoutTreeColumns(1200, undefined).byKey.costTotalForBudget).toBeUndefined();
    expect(layoutTreeColumns(1200, undefined, { showCost: false }).byKey.costTotalForBudget).toBeUndefined();
  });
  it('showCost puts it right after "%" (before the Kanban columns)', () => {
    const l = layoutTreeColumns(1400, undefined, { showCost: true });
    const keys = l.columns.map((c) => c.key);
    expect(keys.indexOf('costTotalForBudget')).toBe(keys.indexOf('progress') + 1);
    expect(keys.indexOf('costTotalForBudget')).toBeLessThan(keys.indexOf('kanban'));
  });
  it('the title carries the budget currency', () => {
    expect(layoutTreeColumns(1400, undefined, { showCost: true, costCurrency: 'EUR' }).byKey.costTotalForBudget!.title).toBe('Cost (EUR)');
    expect(layoutTreeColumns(1400, undefined, { showCost: true }).byKey.costTotalForBudget!.title).toBe('Cost');
  });
  it('a position the user chose (dragging the header) is kept', () => {
    const saved = ['wbs', 'name', 'costTotalForBudget', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent'];
    const keys = layoutTreeColumns(1600, saved, { showCost: true }).columns.map((c) => c.key);
    expect(keys.indexOf('costTotalForBudget')).toBe(2);
    expect(layoutTreeColumns(1600, saved, { showCost: false }).byKey.costTotalForBudget).toBeUndefined();   // hidden again, the saved place is not lost
    expect(normalizeTreeColumnsOrder(saved)).toContain('costTotalForBudget');
  });
  it('on a narrow pane it is dropped after "%" and before the dates (the Task name keeps its width)', () => {
    const wide = layoutTreeColumns(1400, undefined, { showCost: true });
    expect(wide.byKey.costTotalForBudget).toBeDefined();
    const narrow = layoutTreeColumns(420, undefined, { showCost: true });
    expect(narrow.byKey.name!.w).toBeGreaterThanOrEqual(130);
    expect(narrow.byKey.costTotalForBudget).toBeUndefined();
  });
  it('the other columns keep their places', () => {
    const base = layoutTreeColumns(1400, undefined).columns.map((c) => c.key);
    const withCost = layoutTreeColumns(1400, undefined, { showCost: true }).columns.map((c) => c.key).filter((k) => k !== 'costTotalForBudget');
    expect(withCost).toEqual(base);
  });
});

describe('the Cost with VAT column (costTotalForBudgetWithVAT, documentation/VENDOR_INVOICE_DOC.html section 17)', () => {
  it('is a built-in key with a title and a width, not in the default order', () => {
    expect(isBuiltinTreeColumnKey('costTotalForBudgetWithVAT')).toBe(true);
    expect(PM_TREE_COLUMN_TITLES.costTotalForBudgetWithVAT).toBe('Cost with VAT');
    expect(PM_TREE_COLUMN_WIDTHS.costTotalForBudgetWithVAT).toBeGreaterThan(60);
    expect(PM_TREE_COLUMNS_DEFAULT_ORDER).not.toContain('costTotalForBudgetWithVAT');
  });
  it('is hidden by default and when showCostWithVat is false (even while the Cost column is shown)', () => {
    expect(layoutTreeColumns(1200, undefined).byKey.costTotalForBudgetWithVAT).toBeUndefined();
    expect(layoutTreeColumns(1400, undefined, { showCost: true }).byKey.costTotalForBudgetWithVAT).toBeUndefined();
  });
  it('stands right after the Cost column; alone it stands after "%"; the title carries the budget currency', () => {
    const both = layoutTreeColumns(1600, undefined, { showCost: true, showCostWithVat: true, costCurrency: 'EUR' });
    const keys = both.columns.map((c) => c.key);
    expect(keys.indexOf('costTotalForBudgetWithVAT')).toBe(keys.indexOf('costTotalForBudget') + 1);
    expect(both.byKey.costTotalForBudgetWithVAT!.title).toBe('Cost with VAT (EUR)');
    const alone = layoutTreeColumns(1600, undefined, { showCostWithVat: true }).columns.map((c) => c.key);
    expect(alone.indexOf('costTotalForBudgetWithVAT')).toBe(alone.indexOf('progress') + 1);
  });
  it('on a narrow pane it is the first of the two to go (the Task name keeps its width)', () => {
    const narrow = layoutTreeColumns(520, undefined, { showCost: true, showCostWithVat: true });
    expect(narrow.byKey.name!.w).toBeGreaterThanOrEqual(130);
    if (narrow.byKey.costTotalForBudgetWithVAT) expect(narrow.byKey.costTotalForBudget).toBeDefined();     // never the VAT column without the Cost column
  });
});
