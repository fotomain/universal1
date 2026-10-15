// monitor01SumSources - the SumExplorerListReusable sources of a Monitor01 number: which lists make it, with their columns, sign and "Open" action.
//   planned          the movements of the plan                          contracted      the movements of lines that have a resource contract
//   invoiced         the movements of the POSTED vendor invoices ("Open" shows the invoice)
//   rest to contract planned − contracted (two lists)                    used            the lines of the POSTED fact documents ("Open" shows the document)       delivered  no data yet: the list is empty
//   on-hand          delivered − used (two lists)
//   A click / touch on a row opens its task line (handlers.openTaskLine); the button at the end of the row keeps its own job (Plan / Document).
import type { SumExplorerSource } from '../../../ui/components/common/SumExplorerListReusable';
import { MONITOR01_SUM_PAGE_SIZE } from './monitor01Constants';
import { Monitor01SourceMeasure, Monitor01SourceRow, fetchMonitor01Sources } from './monitor01Api';
import { Monitor01Measure, drillOperands } from './monitor01Model';

export interface Monitor01SourceHandlers {
  /** shows the posted days of the task (the Plan view) */
  openPlan?: (taskGUID: string) => void;
  /** shows a posted fact document */
  openFactDocument?: (documentGUID: string, taskGUID: string) => void;
  /** shows a posted vendor invoice */
  openVendorInvoice?: (documentGUID: string, taskGUID: string) => void;
  /** a click / touch on a transaction: its task line (dashboard, Finances view: task + tab + line), in a new tab on the web */
  openTaskLine?: (row: Monitor01SourceRow) => void;
}

const TITLE: Record<string, string> = {
  planned: 'Plan movements',
  contracted: 'Plan movements of lines with a resource contract',
  delivered: 'Delivered',
  invoiced: 'Posted vendor invoices',
  used: 'Posted fact documents',
};

export function buildMonitor01Sources(client: any, measure: Monitor01Measure, filter: Record<string, any>, handlers: Monitor01SourceHandlers = {}): SumExplorerSource<Monitor01SourceRow>[] {
  return drillOperands(measure).map(({ measure: m, sign }) => {
    const isContract = m === 'contracted';
    return {
      key: m,
      title: TITLE[m] ?? m,
      sign,
      rowKey: (r) => r.rowGUID,
      emptyText: m === 'delivered' ? 'No data yet: Delivered is drawn without data.' : m === 'used' ? 'No posted fact documents.' : m === 'invoiced' ? 'No posted vendor invoices.' : 'No source transactions.',
      columns: [
        { key: 'day', title: 'Day', width: 92, render: (r) => String(r.day ?? '').slice(0, 10) },
        { key: 'task', title: 'Task', flex: 1.4, render: (r) => r.taskName || r.taskGUID },
        { key: 'role', title: 'Role', flex: 1.2, render: (r) => r.roleName || (r.roleGUID ? r.roleGUID : '') },
        ...(m === 'used' || m === 'invoiced' ? [{ key: 'document', title: m === 'invoiced' ? 'Invoice' : 'Document', width: 100, render: (r: Monitor01SourceRow) => r.documentNumber || '' }] : []),
        ...(isContract ? [{ key: 'contract', title: 'Contract', flex: 1, render: (r: Monitor01SourceRow) => r.contractGUID || '' }] : []),
        { key: 'qty', title: 'Qty', width: 70, align: 'right' as const, render: (r) => String(Math.round(r.qty * 100) / 100) },
        ...(m === 'planned' ? [{ key: 'stale', title: '', width: 70, render: (r: Monitor01SourceRow) => (r.stale ? 'Post needed' : '') }] : []),
      ],
      fetchPage: async (page) => {
        const p = await fetchMonitor01Sources(client, m as Monitor01SourceMeasure, filter, page, MONITOR01_SUM_PAGE_SIZE);
        return { rows: p.rows, totalCount: p.totalCount, sum: p.sum };
      },
      onOpen: m === 'used'
        ? (handlers.openFactDocument ? (r) => { if (r.documentGUID) handlers.openFactDocument!(r.documentGUID, r.taskGUID); } : undefined)
        : m === 'invoiced'
          ? (handlers.openVendorInvoice ? (r) => { if (r.documentGUID) handlers.openVendorInvoice!(r.documentGUID, r.taskGUID); } : undefined)
          : handlers.openPlan ? (r) => handlers.openPlan!(r.taskGUID) : undefined,
      openLabel: m === 'used' || m === 'invoiced' ? 'Document' : 'Plan',
      onRowPress: handlers.openTaskLine,
    };
  });
}
