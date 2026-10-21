// timesheetListColumns - the columns of the ReusableTable of the time sheet list (PMTimesheetDocumentList).
// The rows of the table are the header rows of the redux entity (realtime); what a cell SHOWS comes from the list RPC (timesheet_list: the work center, the hours ...), found by the GUID of the row through
// `fromStored`. Every cell is read only: a sheet is changed in its form.
import React from 'react';
import { pmT } from '../../pm/i18n/pmT';
import PMTreePostStatusIcon from '../../pm/view/tree/columns/PMTreePostStatusIcon';
import type { ReusableTableRow, VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { formatDateTime, type TimesheetListRow } from './timesheetModel';

export type TimesheetListInfo = (row: ReusableTableRow) => TimesheetListRow | undefined;

export function timesheetListColumns(info: TimesheetListInfo): VisualColumn[] {
  const text = (key: string, title: string, width: number, get: (r: TimesheetListRow) => string): VisualColumn =>
    ({ key, title: pmT(title), type: 'text', width, editable: false, fromStored: (_s: any, row: ReusableTableRow) => { const r = info(row); return r ? get(r) : ''; } } as VisualColumn);
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    // the POSTED column (as the task tree): nothing = a draft, a green check = posted (a posted sheet cannot be changed, so there is no "changed" state)
    {
      key: 'posted', title: pmT('Posted'), type: 'custom', width: 70, editable: false,
      renderCell: (row: ReusableTableRow) => (info(row)?.documentStatus === 'posted' ? <PMTreePostStatusIcon indicator="posted" testID={`timesheet-list-posted-${row.rowGUID}`} height={30} /> : null),
      searchText: (row: ReusableTableRow) => (info(row)?.documentStatus === 'posted' ? 'posted' : ''),
    } as VisualColumn,
    text('document', 'Document', 120, (r) => r.documentNumber),
    text('workCenter', 'Work center', 240, (r) => r.workCenterTitle),
    text('startDate', 'Start date', 120, (r) => r.startDate),
    text('finishDate', 'Finish date', 120, (r) => r.finishDate),
    { key: 'hours', title: pmT('Hours'), type: 'number', width: 100, editable: false, stepper: false, total: true, fromStored: (_s: any, row: ReusableTableRow) => info(row)?.hours ?? 0 } as VisualColumn,
    { key: 'lines', title: pmT('Lines'), type: 'integer', width: 80, editable: false, stepper: false, total: false, fromStored: (_s: any, row: ReusableTableRow) => info(row)?.lineCount ?? 0 } as VisualColumn,
    text('status', 'Status', 100, (r) => pmT(r.documentStatus === 'posted' ? 'Posted' : 'Draft')),
    text('postedAt', 'Posting date and time', 170, (r) => formatDateTime(r.postedAt)),
  ];
}
