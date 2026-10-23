// moneyAccountModel - the money account catalog: titles, the folders (legal entities), the checks, the rests of an account (the rest on a day, what the account holds now).
import {
  MONEY_ACCOUNT_ENTITY, MONEY_ACCOUNT_TABLE, emptyMoneyAccount, isMoneyAccountActive, latestRests, moneyAccountCurrencyOf, moneyAccountFolderNodes, moneyAccountLabel, moneyAccountProblem, moneyAccountTitle,
  moneyAccountsToChoose, parseRests, restOnDay,
} from '../../../kit8/catalog/money_account/moneyAccountModel';
import { moneyAccountSystemMetaData } from '../../../kit8/catalog/money_account/moneyAccountMetaData';

const acc = (guid: string, json: Record<string, any> = {}, parent = 'empty') => ({ rowGUID: guid, rowOwnerGUID: 'moneyAccountCatalog', rowParentGUID: parent, rowJSON: json }) as any;

describe('the catalog', () => {
  it('table, entity, defaults', () => {
    expect(MONEY_ACCOUNT_TABLE.table).toBe('moneyAccountTable');
    expect(MONEY_ACCOUNT_ENTITY).toBe('moneyAccountReusable');
    expect(emptyMoneyAccount()).toMatchObject({ moneyAccountKind: 'bank', moneyAccountCurrency: null, isActive: true, moneyAccountOpeningBalance: null });
    const meta = moneyAccountSystemMetaData();
    expect((meta[MONEY_ACCOUNT_ENTITY] as any).tableName).toBe('moneyAccountTable');
  });
  it('title: the title, else the number, else the GUID; the label has the currency', () => {
    expect(moneyAccountTitle(acc('a', { moneyAccountTitle: ' Bank EUR ' }))).toBe('Bank EUR');
    expect(moneyAccountTitle(acc('a', { moneyAccountNumber: 'LV00' }))).toBe('LV00');
    expect(moneyAccountTitle(acc('a'))).toBe('a');
    expect(moneyAccountLabel(acc('a', { moneyAccountTitle: 'Bank', moneyAccountCurrency: 'eur' }))).toBe('Bank · EUR');
    expect(moneyAccountLabel(acc('a', { moneyAccountTitle: 'Cash' }))).toBe('Cash');
    expect(moneyAccountCurrencyOf(acc('a', { moneyAccountCurrency: ' usd ' }))).toBe('USD');
    expect(moneyAccountCurrencyOf(null)).toBe('');
  });
  it('a picker offers the active accounts (the one chosen stays), by title', () => {
    const rows = [acc('b', { moneyAccountTitle: 'Beta' }), acc('a', { moneyAccountTitle: 'Alpha', isActive: false }), acc('c', { moneyAccountTitle: 'Gamma' })];
    expect(isMoneyAccountActive(rows[1])).toBe(false);
    expect(moneyAccountsToChoose(rows).map((r) => r.rowGUID)).toEqual(['b', 'c']);
    expect(moneyAccountsToChoose(rows, 'a').map((r) => r.rowGUID)).toEqual(['a', 'b', 'c']);
  });
  it('the folders are the legal entities that have an account (all of them on demand)', () => {
    const entities = [{ rowGUID: 'le2', rowJSON: { title: 'Zeta' } }, { rowGUID: 'le1', rowJSON: { title: 'Acme' } }, { rowGUID: 'le3', rowJSON: { title: 'Unused' } }] as any[];
    const accounts = [acc('a', {}, 'le1'), acc('b', {}, 'le2'), acc('c', {}, 'empty')];
    expect(moneyAccountFolderNodes(entities, accounts).map((n) => n.title)).toEqual(['Acme', 'Zeta']);
    expect(moneyAccountFolderNodes(entities, accounts, true).map((n) => n.title)).toEqual(['Acme', 'Unused', 'Zeta']);
  });
  it('moneyAccountProblem: the currency is needed (Post), an ISO code, a date YYYY-MM-DD, a number', () => {
    expect(moneyAccountProblem({})).toMatch(/currency/);
    expect(moneyAccountProblem({ moneyAccountCurrency: 'EURO' })).toMatch(/ISO/);
    expect(moneyAccountProblem({ moneyAccountCurrency: 'EUR', moneyAccountOpeningDate: '01.01.2030' })).toMatch(/YYYY-MM-DD/);
    expect(moneyAccountProblem({ moneyAccountCurrency: 'EUR', moneyAccountOpeningBalance: NaN as any })).toMatch(/number/);
    expect(moneyAccountProblem({ moneyAccountCurrency: 'EUR', moneyAccountOpeningDate: '2030-01-02', moneyAccountOpeningBalance: 1000 })).toBeNull();
  });
});

describe('the rests of an account', () => {
  const account = acc('ma1', { moneyAccountCurrency: 'EUR', moneyAccountOpeningDate: '2030-01-02', moneyAccountOpeningBalance: 1000 });
  const rests = parseRests([
    { moneyAccount: 'ma1', sumKind: 'account', currency: 'EUR', periodDay: '2030-01-04', turnover: '-50', rest: '950' },
    { moneyAccount: 'ma1', sumKind: 'account', currency: 'EUR', periodDay: '2030-01-05', turnover: -360, rest: 590 },
    { moneyAccount: 'ma1', sumKind: 'budget', currency: 'USD', periodDay: '2030-01-05', turnover: -432, rest: -492 },
    { moneyAccount: 'ma1', sumKind: 'weird', currency: 'EUR', periodDay: '2030-01-06T00:00:00', turnover: 1, rest: 1 },
  ]);
  it('parseRests: typed, an unknown kind is the account kind, the day is 10 characters', () => {
    expect(rests[0]).toEqual({ moneyAccount: 'ma1', sumKind: 'account', currency: 'EUR', periodDay: '2030-01-04', turnover: -50, rest: 950 });
    expect(rests[3]).toMatchObject({ sumKind: 'account', periodDay: '2030-01-06' });
    expect(parseRests(null)).toEqual([]);
  });
  it('restOnDay: the row with the latest day <= the day; before the first movement the opening balance (from its date), else 0', () => {
    expect(restOnDay(rests, account, 'account', 'EUR', '2030-01-05')).toBe(590);
    expect(restOnDay(rests, account, 'account', 'eur', '2030-01-04')).toBe(950);
    expect(restOnDay(rests, account, 'account', 'EUR', '2030-01-03')).toBe(1000);            // after the opening date, before the first movement
    expect(restOnDay(rests, account, 'account', 'EUR', '2030-01-01')).toBe(0);   // before the opening date: nothing yet
    expect(restOnDay([], account, 'account', 'EUR', '2030-02-01')).toBe(1000);
    expect(restOnDay(rests, account, 'budget', 'USD', '2030-01-04')).toBe(0);
    expect(restOnDay(rests, account, 'budget', 'USD', '2030-01-09')).toBe(-492);
    expect(restOnDay([], null, 'account', 'EUR', '2030-01-09')).toBe(0);
  });
  it('latestRests: what the account holds now per kind and currency; an account without movements shows its opening balance', () => {
    const now = latestRests(rests, account);
    expect(now.map((r) => `${r.kind}:${r.currency}=${r.rest}@${r.day}`)).toEqual(['account:EUR=1@2030-01-06', 'budget:USD=-492@2030-01-05']);
    expect(latestRests([], account)).toEqual([{ kind: 'account', currency: 'EUR', day: null, rest: 1000 }]);
    expect(latestRests([], null)).toEqual([]);
  });
});
