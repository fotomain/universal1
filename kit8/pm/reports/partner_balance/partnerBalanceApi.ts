// partnerBalanceApi - the calls of Monitor07 (documentation/PARTNER_BALANCE.html, SQL PART 39). No React. The client is the Supabase client (any).
//   partner_balance_report(role, from, to, filters, sort, group)     the rows of the report (display sign)
//   partner_balance_filter_items(role, project, partner)              the lists of the selects (only what has rows)
//   partner_balance_movements_list(role, partner, contract, ...)      the rows behind a sum (drill-down)
import type { BalanceRole, BalanceRow, ReportSort } from './partnerBalanceModel';
import { filterItemsOf, type FilterItemLists } from './partnerBalanceModel';

export const PARTNER_BALANCE_LEDGER_TABLE = 'partner_balance_ledger';
export const RPC_PARTNER_BALANCE_REPORT = 'partner_balance_report';
export const RPC_PARTNER_BALANCE_FILTER_ITEMS = 'partner_balance_filter_items';
export const RPC_PARTNER_BALANCE_MOVEMENTS_LIST = 'partner_balance_movements_list';

const err = (e: any): Error => new Error(e?.message || String(e));

export interface BalanceReportParams { role: BalanceRole; from: string | null; to: string | null; filters: Record<string, unknown>; sort: ReportSort; group?: 'contract' | 'task' }

export async function fetchPartnerBalanceReport(client: any, p: BalanceReportParams): Promise<BalanceRow[]> {
  const { data, error } = await client.rpc(RPC_PARTNER_BALANCE_REPORT, { p_role: p.role, p_from: p.from, p_to: p.to, p_filters: p.filters, p_sort: p.sort, p_group: p.group ?? 'contract' });
  if (error) throw err(error);
  return Array.isArray(data) ? (data as BalanceRow[]) : [];
}

export async function fetchPartnerBalanceFilterItems(client: any, role: BalanceRole, project: string | null, partner: string | null): Promise<FilterItemLists> {
  const { data, error } = await client.rpc(RPC_PARTNER_BALANCE_FILTER_ITEMS, { p_role: role, p_project: project || null, p_partner: partner || null });
  if (error) throw err(error);
  return filterItemsOf(data);
}

export interface BalanceMovement {
  id: string; periodDay: string; operationType: string; registratorKind: 'vendorInvoice' | 'customerInvoice' | 'paymentFact'; registratorGUID: string; documentNumber: string | null;
  project: string; projectTitle: string; task: string | null; taskTitle: string | null; currencyForContract: string; sumForContract: number; sumForAccounting: number; sumForBudget: number;
}

export interface BalanceMovementsParams { role: BalanceRole; partner: string; contract: string | null; project: string | null; task: string | null; from: string | null; to: string | null }

export async function fetchPartnerBalanceMovements(client: any, p: BalanceMovementsParams): Promise<BalanceMovement[]> {
  const { data, error } = await client.rpc(RPC_PARTNER_BALANCE_MOVEMENTS_LIST, {
    p_role: p.role, p_partner: p.partner, p_contract: p.contract === null ? null : p.contract === '' ? 'none' : p.contract, p_project: p.project, p_task: p.task, p_from: p.from, p_to: p.to,
  });
  if (error) throw err(error);
  return Array.isArray(data) ? (data as BalanceMovement[]) : [];
}
