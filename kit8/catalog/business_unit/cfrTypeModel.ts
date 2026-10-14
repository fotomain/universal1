// CFR type - the enumeration "Centers Of Financial Responsibility" (works like a 1C enumeration): 4 fixed values, written by SQL only.
//   cfrTypeTable   rowGUID = the code · rowOwnerGUID 'cfrTypeCatalog' · rowParentGUID 'empty' (flat, no folders) · rowJSON { title, description, acceptsCosts, acceptsRevenues }
//   SQL: kit8/sql/start/start1_sql_structure.sql PART 18 (signed-in users can only READ it; nobody adds, changes or deletes a value at run time).
//   The code names the values with CFR_TYPE; WHICH budget kind a center takes is data on the row (acceptsCosts / acceptsRevenues): SQL and the app read the same flags.
//   There is no screen and no drawer item: the values are picked in the CFR column of the business units.
import type { DefRow, ProductTableDef } from '../product/productModel';

export const CFR_TYPE = { cost: 'costCenter', revenue: 'revenueCenter', profit: 'profitCenter', investment: 'investmentCenter' } as const;
export type CfrType = (typeof CFR_TYPE)[keyof typeof CFR_TYPE];

export const CFR_TYPE_TABLE: ProductTableDef = {
  table: 'cfrTypeTable',
  entity: 'cfrTypeReusable',
  itemLabel: 'CFR type',
  catalogOwner: 'cfrTypeCatalog',
  purpose: 'Centers of Financial Responsibility: cost, revenue, profit and investment centers (an enumeration: the values are fixed).',
  emptyRowJSON: () => ({ title: null, description: null, acceptsCosts: false, acceptsRevenues: false }),
};

/** the kind of a budget line: a cost (Time, Material, Expense) or a revenue */
export type BudgetKind = 'cost' | 'revenue';

export interface CfrTypeJSON { title: string; description?: string | null; acceptsCosts: boolean; acceptsRevenues: boolean }

/** the values in their order (the SQL seed; used until the rows are read, and by the tests) */
export const CFR_TYPE_SEED: { value: CfrType; title: string; acceptsCosts: boolean; acceptsRevenues: boolean }[] = [
  { value: CFR_TYPE.cost, title: 'Cost center', acceptsCosts: true, acceptsRevenues: false },
  { value: CFR_TYPE.revenue, title: 'Revenue center', acceptsCosts: false, acceptsRevenues: true },
  { value: CFR_TYPE.profit, title: 'Profit center', acceptsCosts: true, acceptsRevenues: true },
  { value: CFR_TYPE.investment, title: 'Investment center', acceptsCosts: true, acceptsRevenues: true },
];

export const isCfrType = (v: unknown): v is CfrType => typeof v === 'string' && CFR_TYPE_SEED.some((s) => s.value === v);

/** the options of the CFR column / pickers (rows read from SQL, else the seed) */
export function cfrTypeOptions(rows?: DefRow<any>[] | null): { value: string; label: string }[] {
  const src = Array.isArray(rows) && rows.length ? rows.slice().sort((a, b) => (Number(a.orderInList) || 0) - (Number(b.orderInList) || 0)).map((r) => ({ value: r.rowGUID, label: String(r.rowJSON?.title || r.rowGUID) })) : CFR_TYPE_SEED.map((s) => ({ value: s.value as string, label: s.title }));
  return src;
}

export const cfrTypeTitle = (rows: DefRow<any>[] | null | undefined, cfr: string | null | undefined): string =>
  !cfr ? '' : cfrTypeOptions(rows).find((o) => o.value === cfr)?.label ?? cfr;

/**
 * Does a center of this CFR take a line of this kind? No CFR (a unit with none up the tree) or no kind = yes: there is nothing to check.
 * `rows` = cfrTypeTable rows (the flags are data); not read yet = the seed.
 */
export function cfrAccepts(cfr: string | null | undefined, kind: BudgetKind | null | undefined, rows?: DefRow<any>[] | null): boolean {
  if (!cfr || !kind) return true;
  const row = Array.isArray(rows) ? rows.find((r) => r.rowGUID === cfr) : undefined;
  if (row) return !!(kind === 'cost' ? row.rowJSON?.acceptsCosts : row.rowJSON?.acceptsRevenues);
  const seed = CFR_TYPE_SEED.find((s) => s.value === cfr);
  return seed ? (kind === 'cost' ? seed.acceptsCosts : seed.acceptsRevenues) : false;
}
