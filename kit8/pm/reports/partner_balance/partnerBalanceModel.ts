// partnerBalanceModel - the rules of Monitor07CustomerBalance / Monitor07VendorBalance that are not a screen (documentation/PARTNER_BALANCE.html, README next to this file). No React.
//   * SUM_KINDS      the registry of the sum kinds ("+ other types of sums"): the flags, the four columns of each kind (Begin · Plus · Minus · End), the names of the database columns come from it
//   * the tree       Partner -> Contract (-> Project / Task, loaded when a contract is opened). The numbers come from partner_balance_report already in the DISPLAY sign (customer: positive = the
//                    customer owes us; vendor: positive = we owe the vendor)
//   * the currency   a sum is added only inside ONE currency: a group whose children have two currencies shows "mixed" (cell currency null); the footer is one line per currency
//   * the filters    the values of the bar are strings (reportFilterModel); balanceFiltersToRpc turns them into what the database takes - an unreadable date / amount is no filter
import { CUSTOMER_INVOICE_ROUTE } from '../../../documents/customer/invoice/customerInvoiceModel';
import { PAYMENT_FACT_ROUTE } from '../../../documents/payment/fact/paymentFactModel';
import { VENDOR_INVOICE_ROUTE } from '../../../documents/vendor/invoice/vendorInvoiceModel';
import { parseDayInput } from '../../../documents/fact/input/factInputModel';
import { FilterDescriptor, FilterValues, SelectItem } from '../common/reportFilterModel';
import { parseReportAmount } from '../common/reportFormat';

export type BalanceRole = 'customer' | 'vendor';
export type SumKindId = 'contract' | 'accounting' | 'budget';
export type SumPart = 'Begin' | 'Plus' | 'Minus' | 'End';
export const SUM_PARTS: readonly SumPart[] = ['Begin', 'Plus', 'Minus', 'End'];

export interface SumKind {
  id: SumKindId;
  /** the flag of the report: showSumForContract ... */
  flag: 'showSumForContract' | 'showSumForAccounting' | 'showSumForBudget';
  /** the database name: sumForContract + Begin|Plus|Minus|End */
  column: 'sumForContract' | 'sumForAccounting' | 'sumForBudget';
  currencyKey: 'currencyForContract' | 'currencyForAccounting' | 'currencyForBudget';
  title: string;
  tip: string;
}

export const SUM_KINDS: readonly SumKind[] = [
  { id: 'contract', flag: 'showSumForContract', column: 'sumForContract', currencyKey: 'currencyForContract', title: 'Contract', tip: 'In the currency of the contract. This is the exact balance: what is owed.' },
  { id: 'accounting', flag: 'showSumForAccounting', column: 'sumForAccounting', currencyKey: 'currencyForAccounting', title: 'Accounting', tip: 'In the accounting currency of the project, as posted (the rate of the day of every invoice and payment): a settled contract can show the exchange rate difference here.' },
  { id: 'budget', flag: 'showSumForBudget', column: 'sumForBudget', currencyKey: 'currencyForBudget', title: 'Budget', tip: 'In the budget currency of the project, as posted (the rate of the day of every invoice and payment).' },
];

export const PART_TIPS: Record<SumPart, string> = {
  Begin: 'The balance before the first day of the period',
  Plus: 'Increases of the period: the rows that raise the balance shown',
  Minus: 'Decreases of the period: the rows that lower the balance shown (a credit note lands here)',
  End: 'The balance on the last day of the period = Begin + Plus - Minus',
};

export type ReportFlags = { showSumForContract: boolean; showSumForAccounting: boolean; showSumForBudget: boolean; hideSettled: boolean };
export const DEFAULT_FLAGS: ReportFlags = { showSumForContract: true, showSumForAccounting: false, showSumForBudget: false, hideSettled: true };

/** the shown kinds; at least one is always shown (all three off = contract) */
export const shownKinds = (flags: ReportFlags): SumKind[] => {
  const list = SUM_KINDS.filter((k) => flags[k.flag]);
  return list.length ? list : [SUM_KINDS[0]];
};
/** a flag change that cannot switch the last shown kind off */
export const setFlag = (flags: ReportFlags, flag: keyof ReportFlags, on: boolean): ReportFlags => {
  const next = { ...flags, [flag]: on };
  return flag !== 'hideSettled' && !SUM_KINDS.some((k) => next[k.flag]) ? flags : next;
};
export const isReportFlags = (v: unknown): v is ReportFlags =>
  !!v && typeof v === 'object' && ['showSumForContract', 'showSumForAccounting', 'showSumForBudget', 'hideSettled'].every((k) => typeof (v as any)[k] === 'boolean');

// ---- the sort ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export type SortBy = 'partnerName' | 'sumForBudgetEnd' | 'contractFinishDate';
export type SortDir = 'asc' | 'desc';
export interface ReportSort { sortBy: SortBy; sortDir: SortDir }
export const SORT_OPTIONS: readonly { value: SortBy; label: string }[] = [
  { value: 'partnerName', label: 'Partner name' },
  { value: 'sumForBudgetEnd', label: 'Budget sum (End)' },
  { value: 'contractFinishDate', label: 'Contract finish date' },
];
export const DEFAULT_SORT: ReportSort = { sortBy: 'partnerName', sortDir: 'asc' };
/** the direction a sort starts with: the biggest sum first, the others from A / the earliest */
export const defaultDirOf = (by: SortBy): SortDir => (by === 'sumForBudgetEnd' ? 'desc' : 'asc');
export const isReportSort = (v: unknown): v is ReportSort =>
  !!v && typeof v === 'object' && SORT_OPTIONS.some((o) => o.value === (v as any).sortBy) && ['asc', 'desc'].includes((v as any).sortDir);

// ---- the rows of the database ----------------------------------------------------------------------------------------------------------------------------------------------------------
export interface BalanceRow {
  partner: string; partnerTitle: string; contract: string; contractTitle: string; contractFinishDate: string | null;
  currencyForContract: string; currencyForAccounting: string; currencyForBudget: string;
  project: string | null; projectTitle: string | null; task: string | null; taskTitle: string | null;
  [column: string]: any;
}
export interface BalanceCell { begin: number; plus: number; minus: number; end: number }
/** currency: the code, '' = no currency (nothing to show), null = MIXED (two currencies: the numbers are not added) */
export interface KindCell extends BalanceCell { currency: string | null }
export type KindCells = Record<SumKindId, KindCell>;

export const zeroCell = (): BalanceCell => ({ begin: 0, plus: 0, minus: 0, end: 0 });
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** the four numbers of one kind in a database row */
export const cellOfRow = (row: BalanceRow, kind: SumKind): BalanceCell => ({
  begin: num(row[`${kind.column}Begin`]), plus: num(row[`${kind.column}Plus`]), minus: num(row[`${kind.column}Minus`]), end: num(row[`${kind.column}End`]),
});

/** adds cells of one kind; the currency is kept while all non-empty currencies are the same, else null (mixed) */
export const mergeKindCells = (cells: readonly KindCell[]): KindCell => {
  const cur = new Set(cells.map((c) => c.currency).filter((c) => c !== ''));
  const mixed = cur.has(null as any) || cur.size > 1;
  const out: KindCell = { ...zeroCell(), currency: mixed ? null : cur.size === 1 ? ([...cur][0] as string) : '' };
  for (const c of cells) { out.begin += c.begin; out.plus += c.plus; out.minus += c.minus; out.end += c.end; }
  return out;
};

export const kindCellsOfRow = (row: BalanceRow): KindCells => {
  const out = {} as KindCells;
  for (const k of SUM_KINDS) out[k.id] = { ...cellOfRow(row, k), currency: String(row[k.currencyKey] ?? '') };
  return out;
};
const mergeAll = (list: readonly KindCells[]): KindCells => {
  const out = {} as KindCells;
  for (const k of SUM_KINDS) out[k.id] = mergeKindCells(list.map((c) => c[k.id]));
  return out;
};

// ---- the tree ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export type BalanceLevel = 'partner' | 'contract' | 'task';
export interface BalanceNode {
  key: string;
  level: BalanceLevel;
  label: string;
  partner: string;
  contract: string;
  project: string | null;
  task: string | null;
  finishDate: string | null;
  /** the currency of the CONTRACT (the first column); null = mixed */
  currency: string | null;
  cells: KindCells;
  children: BalanceNode[];
}

export const contractKeyOf = (partner: string, contract: string): string => `c|${partner}|${contract || 'none'}`;
export const NO_CONTRACT_LABEL = '(no contract)';

/** Partner -> Contract from the rows of the 'contract' group, in the order the database sent them (it sorts) */
export function buildBalanceTree(rows: readonly BalanceRow[]): BalanceNode[] {
  const partners = new Map<string, { head: BalanceRow; contracts: Map<string, BalanceRow[]> }>();
  for (const r of rows) {
    let p = partners.get(r.partner);
    if (!p) { p = { head: r, contracts: new Map() }; partners.set(r.partner, p); }
    const list = p.contracts.get(r.contract) ?? [];
    list.push(r);
    p.contracts.set(r.contract, list);
  }
  const out: BalanceNode[] = [];
  for (const [partner, p] of partners) {
    const children: BalanceNode[] = [];
    for (const [contract, list] of p.contracts) {
      const cells = mergeAll(list.map(kindCellsOfRow));
      children.push({
        key: contractKeyOf(partner, contract), level: 'contract', label: contract ? (list[0].contractTitle || contract) : NO_CONTRACT_LABEL, partner, contract, project: null, task: null,
        finishDate: list[0].contractFinishDate ?? null, currency: cells.contract.currency, cells, children: [],
      });
    }
    const cells = mergeAll(children.map((c) => c.cells));
    const dates = children.map((c) => c.finishDate).filter((d): d is string => !!d).sort();
    out.push({ key: `p|${partner}`, level: 'partner', label: p.head.partnerTitle || partner, partner, contract: '', project: null, task: null, finishDate: dates[0] ?? null, currency: cells.contract.currency, cells, children });
  }
  return out;
}

/** the task level of ONE contract, from the rows of the 'task' group */
export function buildTaskNodes(parent: BalanceNode, rows: readonly BalanceRow[]): BalanceNode[] {
  return rows.map((r) => {
    const cells = kindCellsOfRow(r);
    const label = [r.projectTitle, r.taskTitle].filter(Boolean).join(' / ') || r.task || '';
    return { key: `t|${parent.partner}|${parent.contract || 'none'}|${r.project}|${r.task ?? 'none'}|${r.currencyForAccounting}|${r.currencyForBudget}`, level: 'task' as const, label, partner: parent.partner, contract: parent.contract,
             project: r.project, task: r.task, finishDate: null, currency: r.currencyForContract, cells, children: [] };
  });
}

export interface FlatBalanceLine { node: BalanceNode; depth: number }
/** the visible lines: a node's children follow it while it is expanded; `tasks` = the task nodes loaded for a contract key */
export function flattenBalance(nodes: readonly BalanceNode[], expanded: ReadonlySet<string>, tasks: Readonly<Record<string, BalanceNode[]>> = {}): FlatBalanceLine[] {
  const out: FlatBalanceLine[] = [];
  const walk = (list: readonly BalanceNode[], depth: number) => {
    for (const n of list) {
      out.push({ node: n, depth });
      if (!expanded.has(n.key)) continue;
      walk(n.level === 'contract' ? tasks[n.key] ?? [] : n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}

export interface FooterLine { label: string; cells: Partial<Record<SumKindId, BalanceCell>> }
/** the footer: one line per currency. A kind is added over the rows of the same currency of THAT kind; the lines of the same code are joined */
export function balanceFooter(rows: readonly BalanceRow[], kinds: readonly SumKind[]): FooterLine[] {
  const lines = new Map<string, FooterLine>();
  for (const k of kinds) {
    for (const r of rows) {
      const cur = String(r[k.currencyKey] ?? '');
      const c = cellOfRow(r, k);
      if (cur === '' && c.begin === 0 && c.plus === 0 && c.minus === 0 && c.end === 0) continue;
      const line = lines.get(cur) ?? { label: cur || '-', cells: {} };
      const cell = line.cells[k.id] ?? zeroCell();
      cell.begin += c.begin; cell.plus += c.plus; cell.minus += c.minus; cell.end += c.end;
      line.cells[k.id] = cell;
      lines.set(cur, line);
    }
  }
  return [...lines.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// ---- the filters -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export const FILTER_IDS = ['dateFrom', 'dateTo', 'projectFilter', 'taskFilter', 'partnerFilter', 'partnerContractFilter', 'legalEntityFilter', 'sumBiggerThan', 'sumSmallerThan'] as const;
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** the first run: from the first day of this month to today */
export const defaultFilterValues = (today: Date = new Date()): FilterValues => ({
  dateFrom: isoOf(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: isoOf(today),
  projectFilter: '', taskFilter: '', partnerFilter: '', partnerContractFilter: '', legalEntityFilter: '', sumBiggerThan: '', sumSmallerThan: '',
});

export interface FilterItemLists { projects: SelectItem[]; tasks: SelectItem[]; partners: SelectItem[]; contracts: SelectItem[]; legalEntities: SelectItem[] }
export const EMPTY_FILTER_ITEMS: FilterItemLists = { projects: [], tasks: [], partners: [], contracts: [], legalEntities: [] };
const toItems = (list: any): SelectItem[] => (Array.isArray(list) ? list.map((x: any) => ({ value: String(x.id), label: String(x.title ?? x.id) })) : []);
export const filterItemsOf = (raw: any): FilterItemLists => ({
  projects: toItems(raw?.projects), tasks: toItems(raw?.tasks), partners: toItems(raw?.partners), contracts: toItems(raw?.contracts), legalEntities: toItems(raw?.legalEntities),
});

/** the descriptors of the bar (the order of the Google Doc: dates, project, task, partner, contract, then the sums; the legal entity only when there is more than one) */
export function balanceFilterDescriptors(items: FilterItemLists, values: FilterValues): FilterDescriptor[] {
  const list: FilterDescriptor[] = [
    { id: 'dateFrom', kind: 'date', label: 'dateFrom' },
    { id: 'dateTo', kind: 'date', label: 'dateTo' },
    { id: 'projectFilter', kind: 'select', label: 'Project', items: items.projects, clears: ['taskFilter'] },
    { id: 'taskFilter', kind: 'select', label: 'Task', items: items.tasks, disabled: !values.projectFilter },
    { id: 'partnerFilter', kind: 'select', label: 'Partner', items: items.partners, clears: ['partnerContractFilter'] },
    { id: 'partnerContractFilter', kind: 'select', label: 'Contract', items: items.contracts, disabled: !values.partnerFilter },
  ];
  if (items.legalEntities.length > 1) list.push({ id: 'legalEntityFilter', kind: 'select', label: 'Legal entity', items: items.legalEntities });
  list.push({ id: 'sumBiggerThan', kind: 'amount', label: 'Sum bigger than' }, { id: 'sumSmallerThan', kind: 'amount', label: 'Sum smaller than' });
  return list;
}

export interface BalanceQuery {
  from: string | null;
  to: string | null;
  filters: Record<string, unknown>;
  /** dateFrom is after dateTo: the report is not asked */
  invalid: boolean;
}

/** what the database takes: an unreadable date or amount is no filter (the field is red); the sum filters judge the first shown kind */
export function balanceFiltersToRpc(values: FilterValues, flags: ReportFlags): BalanceQuery {
  const from = parseDayInput(values.dateFrom);
  const to = parseDayInput(values.dateTo);
  const filters: Record<string, unknown> = {};
  if (values.projectFilter) filters.projectFilter = values.projectFilter;
  if (values.projectFilter && values.taskFilter) filters.taskFilter = values.taskFilter;
  if (values.partnerFilter) filters.partnerFilter = values.partnerFilter;
  if (values.partnerFilter && values.partnerContractFilter) filters.partnerContractFilter = values.partnerContractFilter;
  if (values.legalEntityFilter) filters.legalEntityFilter = values.legalEntityFilter;
  const big = parseReportAmount(values.sumBiggerThan);
  const small = parseReportAmount(values.sumSmallerThan);
  if (typeof big === 'number') filters.sumBiggerThan = big;
  if (typeof small === 'number') filters.sumSmallerThan = small;
  filters.sumKind = shownKinds(flags)[0].id;
  filters.hideSettled = flags.hideSettled;
  return { from, to, filters, invalid: !!from && !!to && from > to };
}

// ---- the rows behind a number ----------------------------------------------------------------------------------------------------------------------------------------------------------
export const MOVEMENT_TYPE_TITLE: Record<string, string> = {
  customerDebit: 'Customer invoice', customerPayment: 'Payment received', customerRefund: 'Refund to the customer',
  vendorCredit: 'Vendor invoice', paymentToVendor: 'Payment to the vendor', vendorRefund: 'Refund from the vendor',
};
export const movementRouteOf = (m: { registratorKind: string }): string =>
  m.registratorKind === 'vendorInvoice' ? VENDOR_INVOICE_ROUTE : m.registratorKind === 'customerInvoice' ? CUSTOMER_INVOICE_ROUTE : PAYMENT_FACT_ROUTE;

