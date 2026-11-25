/** @jest-environment jsdom */
// ProjectEstimationTable: the rows and columns handed to the ReusableTable (local rows, read only), the titles of the budget items, the footer (cost / revenue / profit / ROI1), the warnings.
import { cleanupUI, q, renderUI, textOf } from '../../../ui/pmUiTestKit';

let mockTableProps: any = null;
jest.mock('../../../../../kit8/ui/components/table/reusable/ReusableTable', () => ({
  __esModule: true,
  default: (p: any) => { mockTableProps = p; return require('react').createElement(require('react-native').View, { testID: p.testID }); },
}));
jest.mock('../../../../../kit8/catalog/budget/item/useBudgetItemData', () => ({
  useBudgetItemData: () => ({ rows: [{ rowGUID: 'item-wages', rowJSON: { title: 'Wages' } }, { rowGUID: 'item-sales', rowJSON: { title: 'Sale of services' } }, { rowGUID: 'item-materials', rowJSON: { title: 'Materials' } }], loaded: true }),
}));

import React from 'react';
import ProjectEstimationTable, { budgetItemTitleOf, formatEstimationAmount, formatEstimationRoi } from '../../../../../kit8/pm/view/project/estimation/ProjectEstimationTable';
import { parseEstimationSummary } from '../../../../../kit8/pm/view/project/estimation/estimationModel';

const item = (budgetItemGUID: string | null, kind: string, lines: number, sumForBudget: number, vatForBudget: number, linesWithoutSum = 0) => ({ budgetItemGUID, kind, lines, sumForBudget, vatForBudget, linesWithoutSum });
const side = (extra: any = {}) => ({ projectGUID: 'p', name: 'n', currencyForBudget: 'EUR', currencyForAccounting: 'EUR', tasks: 3, links: 1, lines: 6, linesWithoutItem: 0, linesWithoutSum: 0, items: [], ...extra });
const summary = (src: any = {}, target: any | null = {}) => parseEstimationSummary({
  source: side({ items: [item('item-wages', 'cost', 3, 14200, 0), item('item-materials', 'cost', 4, 8650, 1816.5), item('item-sales', 'revenue', 1, 36000, 7560), item(null, 'cost', 1, 500, 105)], ...src }),
  target: target === null ? null : side({ tasks: 1, items: [item('item-wages', 'cost', 1, 2000, 0)], postedTasks: 0, documents: 0, readonly: false, canCreate: true, roots: [], ...target }),
});
afterEach(() => { cleanupUI(); mockTableProps = null; });

describe('ProjectEstimationTable', () => {
  it('a read only ReusableTable in local rows mode: one row per budget item with its title, cost before revenue', () => {
    renderUI(<ProjectEstimationTable summary={summary()} />);
    expect(mockTableProps.readOnly).toBe(true);
    expect(mockTableProps.addEnabled).toBe(false);
    expect(mockTableProps.deleteEnabled).toBe(false);
    const titles = mockTableProps.localRows.map((r: any) => r.rowJSON.title);
    expect(titles).toEqual(['Wages', 'Materials', '(no budget item)', 'Sale of services']);
    expect(mockTableProps.localRows.map((r: any) => r.rowJSON.kindTitle)).toEqual(['Cost', 'Cost', 'Cost', 'Revenue']);
    expect(mockTableProps.localRows[0].rowJSON).toMatchObject({ lines: 3, estimate: 14200, vat: 0, projectNow: 2000, difference: 12200 });
  });

  it('the columns: the estimate shows its currency, Project now and the difference only for a saved project, no sums of its own in the footer', () => {
    renderUI(<ProjectEstimationTable summary={summary()} />);
    const keys = mockTableProps.visualColumns.map((c: any) => c.key);
    expect(keys).toEqual(['title', 'kindTitle', 'lines', 'estimate', 'vat', 'projectNow', 'difference']);
    expect(mockTableProps.visualColumns.find((c: any) => c.key === 'estimate').title).toBe('Estimate (EUR)');
    expect(mockTableProps.visualColumns.filter((c: any) => c.type !== 'text').every((c: any) => c.total === false && c.editable === false)).toBe(true);
    cleanupUI();
    renderUI(<ProjectEstimationTable summary={summary({}, null)} />);
    expect(mockTableProps.visualColumns.map((c: any) => c.key)).toEqual(['title', 'kindTitle', 'lines', 'estimate', 'vat']);
  });

  it('the footer: the worked example cost / revenue / profit / ROI1', () => {
    renderUI(<ProjectEstimationTable summary={summary({ items: [item('item-wages', 'cost', 3, 14200, 0), item('item-materials', 'cost', 4, 8650, 1816.5), item('x', 'cost', 2, 3100, 651), item('y', 'cost', 1, 1250, 262.5), item('item-sales', 'revenue', 1, 36000, 7560)] })} />);
    expect(textOf('pm-project-estimation-table-total-estimate-text')).toBe('Cost 27 200.00  ·  Revenue 36 000.00  ·  Profit 8 800.00  ·  ROI1 32.35 %');
    expect(textOf('pm-project-estimation-table-total-now-text')).toContain('Cost 2 000.00');
  });

  it('another budget currency: the converted column (with the rate) and the sentence; no rate = the sentence says so and nothing is invented', () => {
    renderUI(<ProjectEstimationTable summary={summary({}, { currencyForBudget: 'USD' })} rate={1.1} />);
    expect(mockTableProps.visualColumns.map((c: any) => c.key)).toContain('converted');
    expect(mockTableProps.visualColumns.find((c: any) => c.key === 'converted').title).toBe('Estimate (USD)');
    expect(mockTableProps.localRows[0].rowJSON.converted).toBe(15620);
    expect(textOf('pm-project-estimation-table-warn-currency')).toContain('rate of today');
    cleanupUI();
    renderUI(<ProjectEstimationTable summary={summary({}, { currencyForBudget: 'USD' })} rate={null} />);
    expect(textOf('pm-project-estimation-table-warn-currency')).toContain('no exchange rate for today');
    expect(mockTableProps.localRows[0].rowJSON.converted).toBeNull();
  });

  it('warnings: lines without a budget sum / without a budget item', () => {
    renderUI(<ProjectEstimationTable summary={summary({ linesWithoutSum: 2, linesWithoutItem: 1 })} />);
    expect(textOf('pm-project-estimation-table-warn-sum')).toContain('2 lines have no budget sum');
    expect(textOf('pm-project-estimation-table-warn-item')).toContain('1 lines have no budget item');
  });

  it('empty estimation, loading, error', () => {
    renderUI(<ProjectEstimationTable summary={summary({ lines: 0, items: [] })} />);
    expect(q('pm-project-estimation-table-empty')).not.toBeNull();
    expect(mockTableProps).toBeNull();
    cleanupUI();
    renderUI(<ProjectEstimationTable summary={null} loading />);
    expect(q('pm-project-estimation-table-loading')).not.toBeNull();
    cleanupUI();
    renderUI(<ProjectEstimationTable summary={null} error="the estimation project does not exist or you cannot read it" />);
    expect(textOf('pm-project-estimation-table-error')).toContain('cannot read it');
  });

  it('helpers: the title of an item falls back to its id; the formats', () => {
    expect(budgetItemTitleOf('unknown-guid', [])).toBe('unknown-guid');
    expect(budgetItemTitleOf(null, [])).toBe('(no budget item)');
    expect(formatEstimationAmount(1234.5)).toBe('1 234.50');
    expect(formatEstimationAmount(null)).toBe('');
    expect(formatEstimationRoi(0.3235)).toBe('32.35 %');
    expect(formatEstimationRoi(null)).toBe('-');
  });
});
