// Money account - the bank accounts and cash desks the payment facts (kit8/documents/payment/fact) move money on. SQL: PART 38 of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql.
//   moneyAccountTable  rowGUID · rowOwnerGUID 'moneyAccountCatalog' · rowParentGUID = the FOLDER = the GUID of a legal entity (legalEntityTable) or 'empty' · orderInList
//                      · rowJSON { moneyAccountTitle, moneyAccountKind 'bank' | 'cash', moneyAccountCurrency (ISO), moneyAccountNumber (IBAN / cash desk no.), moneyAccountBank, moneyAccountOpeningDate ('YYYY-MM-DD'),
//                        moneyAccountOpeningBalance (in the currency of the account), isActive }
//   The rest of an account on a day = its opening balance + all the posted movements up to that day (cash_account_ledger_rests, rebuilt by the database, never typed). Once an account has posted
//   movements its currency, opening date and opening balance cannot change; an account a payment fact uses is not deleted (set it inactive).
// Pure (no React, no Supabase): the rules and the texts are tested without a screen.
import type { DefRow, ProductTableDef } from '../product/productModel';
import type { FolderTreeNode } from '../../ui/components/tree/folderTreeModel';
import { legalEntityTitle } from '../legal_entity/legalEntityModel';

export const MONEY_ACCOUNT_ROUTES = { list: '/catalog/money/account' } as const;
/** rowParentGUID of a money account that is in no legal entity folder */
export const MONEY_ACCOUNT_NO_FOLDER = 'empty';
export const MONEY_ACCOUNT_KINDS = [{ value: 'bank', label: 'Bank' }, { value: 'cash', label: 'Cash' }] as const;
export type MoneyAccountKind = (typeof MONEY_ACCOUNT_KINDS)[number]['value'];

export interface MoneyAccountJSON {
  moneyAccountTitle: string | null;
  moneyAccountKind: MoneyAccountKind;
  moneyAccountCurrency: string | null;
  moneyAccountNumber: string | null;
  moneyAccountBank: string | null;
  moneyAccountOpeningDate: string | null;
  moneyAccountOpeningBalance: number | null;
  isActive: boolean;
}

export const emptyMoneyAccount = (): MoneyAccountJSON => ({
  moneyAccountTitle: null, moneyAccountKind: 'bank', moneyAccountCurrency: null, moneyAccountNumber: null, moneyAccountBank: null, moneyAccountOpeningDate: null, moneyAccountOpeningBalance: null, isActive: true,
});

export const MONEY_ACCOUNT_TABLE: ProductTableDef = {
  table: 'moneyAccountTable',
  entity: 'moneyAccountReusable',
  itemLabel: 'Money account',
  catalogOwner: 'moneyAccountCatalog',
  purpose: 'The bank accounts and cash desks of the organization that payment facts move money on. The folders are the legal entities.',
  emptyRowJSON: () => ({ ...emptyMoneyAccount() }),
};
/** the SystemMetaData / redux entity of the catalog */
export const MONEY_ACCOUNT_ENTITY = MONEY_ACCOUNT_TABLE.entity;
export const MONEY_ACCOUNT_CATALOG_OWNER = MONEY_ACCOUNT_TABLE.catalogOwner as string;

export const isMoneyAccountActive = (r: DefRow<any> | undefined | null): boolean => r?.rowJSON?.isActive !== false;
export const moneyAccountCurrencyOf = (r: DefRow<any> | undefined | null): string => String(r?.rowJSON?.moneyAccountCurrency ?? '').trim().toUpperCase();
/** "Bank EUR · EUR" - the title, else the number, else the GUID */
export const moneyAccountTitle = (r: DefRow<any> | undefined | null): string => String(r?.rowJSON?.moneyAccountTitle ?? '').trim() || String(r?.rowJSON?.moneyAccountNumber ?? '').trim() || r?.rowGUID || '';
/** the title with its currency, for a picker */
export const moneyAccountLabel = (r: DefRow<any> | undefined | null): string => {
  const cur = moneyAccountCurrencyOf(r);
  return cur ? `${moneyAccountTitle(r)} · ${cur}` : moneyAccountTitle(r);
};

/** the money accounts a picker offers: the active ones (the one already chosen stays), by title */
export function moneyAccountsToChoose(rows: DefRow<any>[], keepGUID?: string | null): DefRow<any>[] {
  return (rows || []).filter((r) => isMoneyAccountActive(r) || r.rowGUID === keepGUID).slice().sort((a, b) => moneyAccountTitle(a).localeCompare(moneyAccountTitle(b)));
}

/** the folders of the tree = the legal entities that have a money account (all of them with `all`); an account whose legal entity is not in the list is in "No folder" */
export function moneyAccountFolderNodes(legalEntities: DefRow<any>[], accounts: DefRow<any>[], all = false): FolderTreeNode[] {
  const used = new Set((accounts || []).map((a) => a.rowParentGUID));
  return (legalEntities || [])
    .filter((e) => all || used.has(e.rowGUID))
    .slice()
    .sort((a, b) => legalEntityTitle(a).localeCompare(legalEntityTitle(b)))
    .map((e, i) => ({ id: e.rowGUID, parentId: null, title: legalEntityTitle(e), order: i }));
}

/** what is wrong with an account (null = fine): Post of a payment fact needs the currency */
export function moneyAccountProblem(json: Partial<MoneyAccountJSON> | null | undefined): string | null {
  const cur = String(json?.moneyAccountCurrency ?? '').trim();
  if (!cur) return 'Enter the currency of the money account.';
  if (!/^[A-Za-z]{3}$/.test(cur)) return 'The currency is an ISO code of three letters (EUR).';
  const date = String(json?.moneyAccountOpeningDate ?? '').trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'The opening date is YYYY-MM-DD.';
  const bal = json?.moneyAccountOpeningBalance;
  if (bal !== null && bal !== undefined && !Number.isFinite(Number(bal))) return 'The opening balance is a number.';
  return null;
}

// ---- the rests of an account (cash_account_ledger_rests: one row per day that has movements, per sum kind and currency) -----------------------------------------------------------------------------
export type RestSumKind = 'account' | 'contract' | 'accounting' | 'budget';
export const REST_SUM_KINDS: { id: RestSumKind; title: string }[] = [
  { id: 'account', title: 'Account currency' },
  { id: 'contract', title: 'Contract currency' },
  { id: 'accounting', title: 'Accounting currency' },
  { id: 'budget', title: 'Budget currency' },
];
export interface RestRow { moneyAccount: string; sumKind: RestSumKind; currency: string; periodDay: string; turnover: number; rest: number }
const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
export function parseRests(rows: any[] | null | undefined): RestRow[] {
  return (rows || []).map((r) => ({
    moneyAccount: String(r.moneyAccount), sumKind: (REST_SUM_KINDS.some((k) => k.id === r.sumKind) ? r.sumKind : 'account') as RestSumKind,
    currency: String(r.currency ?? ''), periodDay: String(r.periodDay ?? '').slice(0, 10), turnover: num(r.turnover), rest: num(r.rest),
  }));
}
/**
 * The rest of the account at the END of a day, for one sum kind and currency: the row with the latest periodDay <= day; none = the opening balance (kind 'account' in the currency of the account, from its
 * opening date) or 0.
 */
export function restOnDay(rests: RestRow[], account: DefRow<any> | undefined | null, kind: RestSumKind, currency: string, day: string): number {
  const cur = currency.toUpperCase();
  let best: RestRow | null = null;
  for (const r of rests) {
    if (r.sumKind !== kind || r.currency.toUpperCase() !== cur || r.periodDay > day) continue;
    if (!best || r.periodDay > best.periodDay) best = r;
  }
  if (best) return best.rest;
  const opening = account?.rowJSON?.moneyAccountOpeningDate as string | null | undefined;
  if (kind === 'account' && cur === moneyAccountCurrencyOf(account) && (!opening || day >= opening)) return num(account?.rowJSON?.moneyAccountOpeningBalance);
  return 0;
}
/** the latest rest of each (kind, currency) of the rows - what the account holds now (plus the opening balance when it has no movement) */
export function latestRests(rests: RestRow[], account: DefRow<any> | undefined | null): { kind: RestSumKind; currency: string; day: string | null; rest: number }[] {
  const keys = new Map<string, { kind: RestSumKind; currency: string }>();
  for (const r of rests) keys.set(`${r.sumKind}|${r.currency}`, { kind: r.sumKind, currency: r.currency });
  const own = moneyAccountCurrencyOf(account);
  if (own) keys.set(`account|${own}`, { kind: 'account', currency: own });
  const order = (k: RestSumKind) => REST_SUM_KINDS.findIndex((x) => x.id === k);
  return [...keys.values()].sort((a, b) => order(a.kind) - order(b.kind) || a.currency.localeCompare(b.currency)).map(({ kind, currency }) => {
    const mine = rests.filter((r) => r.sumKind === kind && r.currency === currency);
    const day = mine.reduce<string | null>((m, r) => (m === null || r.periodDay > m ? r.periodDay : m), null);
    return { kind, currency, day, rest: restOnDay(rests, account, kind, currency, day ?? '9999-12-31') };
  });
}
