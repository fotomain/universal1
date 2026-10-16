// factListColumns - the columns of the ReusableTable of the Actuals list (PMFactInputDocumentList).
// The rows of the table are the header rows of the redux entity (realtime, delete of a draft); what a cell SHOWS comes from the list RPC (task_fact_document_list: author, task, project and the
// totals of ALL the lines of the document), found by the GUID of the row through `fromStored`. Every cell is read only: a document is changed in its form.
import { pmT } from '../../../pm/i18n/pmT';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { FactListRow, dayOfPeriod } from './factInputModel';

export type FactListInfo = (row: ReusableTableRow) => FactListRow | undefined;

export function factListColumns(info: FactListInfo): VisualColumn[] {
  const text = (key: string, title: string, width: number, get: (r: FactListRow) => string): VisualColumn =>
    ({ key, title: pmT(title), type: 'text', width, editable: false, fromStored: (_s: any, row: ReusableTableRow) => { const r = info(row); return r ? get(r) : ''; } } as VisualColumn);
  const sum = (key: 'sumForBudget' | 'sumForContract' | 'sumForAccounting', title: string): VisualColumn =>
    ({ key, title: pmT(title), type: 'number', width: 140, editable: false, stepper: false, fromStored: (_s: any, row: ReusableTableRow) => info(row)?.[key] ?? 0 } as VisualColumn);
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    text('document', 'Document', 130, (r) => r.documentNumber),
    text('status', 'Status', 90, (r) => pmT(r.documentStatus === 'posted' ? 'Posted' : 'Draft')),
    text('input', 'Input', 80, (r) => pmT(r.strongInput ? 'Strong' : 'Free')),
    text('task', 'Task', 170, (r) => r.taskName),
    text('project', 'Project', 160, (r) => r.projectName),
    text('period', 'Period', 190, (r) => (r.firstDay ? `${dayOfPeriod(r.firstDay)} – ${dayOfPeriod(r.lastDay)}` : '')),
    { key: 'lines', title: pmT('Lines'), type: 'integer', width: 80, editable: false, stepper: false, total: false, fromStored: (_s: any, row: ReusableTableRow) => info(row)?.lineCount ?? 0 } as VisualColumn,
    sum('sumForBudget', 'sumForBudget'),
    sum('sumForContract', 'sumForContract'),
    sum('sumForAccounting', 'sumForAccounting'),
    text('author', 'Author', 150, (r) => r.authorName),
    text('created', 'Created', 110, (r) => dayOfPeriod(r.createdAt)),
  ];
}
