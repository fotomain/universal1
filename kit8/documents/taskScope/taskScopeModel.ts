// taskScopeModel - the "Go to" menu of a task / a task line opens a document LIST filtered for that task (or task line): /pm/vendor-invoice/list?taskGUID=…&taskLineGUID=…
// /pm/purchase-order/list?… and /pm/fact/list?taskGUID=…&taskLineGUID=…. The scope is NOT one of the quick filters (no column): the list shows a chip "Task: …" with a Clear icon and sends the scope to the
// list RPC (vendor_invoice_list / task_fact_document_list: keys taskGUID, taskLineGUID). Pure TypeScript, unit-tested.
export const VENDOR_INVOICE_LIST_ROUTE = '/pm/vendor-invoice/list';
export const CUSTOMER_INVOICE_LIST_ROUTE = '/pm/customer-invoice/list';
export const FACT_LIST_ROUTE = '/pm/fact/list';
export const PURCHASE_ORDER_LIST_ROUTE = '/pm/purchase-order/list';
export const PRODUCT_RECEIPT_LIST_ROUTE = '/pm/product-receipt/list';
export const TIMESHEET_LIST_ROUTE = '/pm/timesheet/list';

export interface TaskScope {
  taskGUID: string;
  taskLineGUID: string;
}
export const EMPTY_TASK_SCOPE: TaskScope = { taskGUID: '', taskLineGUID: '' };

const clean = (v: unknown): string => {
  const t = Array.isArray(v) ? v[0] : v;
  return typeof t === 'string' && t.length <= 64 ? t.trim() : '';
};

/** the scope of the route params; a task line without its task is no scope (the RPC would still work, but the chip needs the task) */
export function parseTaskScope(params: Record<string, unknown> | null | undefined): TaskScope {
  const taskGUID = clean(params?.taskGUID);
  const taskLineGUID = clean(params?.taskLineGUID);
  return taskGUID || taskLineGUID ? { taskGUID, taskLineGUID } : EMPTY_TASK_SCOPE;
}
export const taskScopeActive = (s: TaskScope | null | undefined): boolean => !!s && (!!s.taskGUID || !!s.taskLineGUID);
export const sameTaskScope = (a: TaskScope, b: TaskScope): boolean => a.taskGUID === b.taskGUID && a.taskLineGUID === b.taskLineGUID;

/** the keys the list RPCs take: only what is set */
export function taskScopeToRpc(s: TaskScope | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (s?.taskGUID) out.taskGUID = s.taskGUID;
  if (s?.taskLineGUID) out.taskLineGUID = s.taskLineGUID;
  return out;
}

/** the route params of a link (only what is set) */
export const taskScopeRouteParams = (s: TaskScope): Record<string, string> => taskScopeToRpc(s);

const withScope = (route: string, s: TaskScope): string => {
  const q = Object.entries(taskScopeToRpc(s)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return q ? `${route}?${q}` : route;
};
export const vendorInvoiceListPath = (s: TaskScope): string => withScope(VENDOR_INVOICE_LIST_ROUTE, s);
export const customerInvoiceListPath = (s: TaskScope): string => withScope(CUSTOMER_INVOICE_LIST_ROUTE, s);
export const factListPath = (s: TaskScope): string => withScope(FACT_LIST_ROUTE, s);

/** the text of the chip: "Task: <name>" or "Task line of <name> (<id>)"; the name is '' until it is read */
export function taskScopeLabel(s: TaskScope, taskName: string, t: (text: string) => string = (x) => x): string {
  const name = taskName || s.taskGUID.slice(0, 8);
  if (s.taskLineGUID) return `${t('Task line')} ${s.taskLineGUID.slice(0, 8)} · ${t('Task')}: ${name}`;
  return `${t('Task')}: ${name}`;
}
