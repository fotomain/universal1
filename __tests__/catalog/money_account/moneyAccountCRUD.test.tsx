/** @jest-environment jsdom */
// MoneyAccountCRUD (the catalog with the folders = legal entities) and MoneyAccountRests (the rests of the account picked, the button "Refresh rests"). The data hook, the table and the Supabase client are fakes.
import { act } from 'react';
import { cleanupUI, press, q, qa, renderUI, textOf } from '../../pm/ui/pmUiTestKit';

const mockData = {
  rows: [
    { rowGUID: 'ma-1', rowOwnerGUID: 'moneyAccountCatalog', rowParentGUID: 'le-1', rowJSON: { moneyAccountTitle: 'Bank EUR', moneyAccountCurrency: 'EUR', moneyAccountOpeningDate: '2030-01-02', moneyAccountOpeningBalance: 1000 } },
    { rowGUID: 'ma-2', rowOwnerGUID: 'moneyAccountCatalog', rowParentGUID: 'empty', rowJSON: { moneyAccountTitle: 'Cash', moneyAccountCurrency: 'USD' } },
  ],
  legalEntities: [{ rowGUID: 'le-1', rowJSON: { title: 'Acme SIA' } }, { rowGUID: 'le-2', rowJSON: { title: 'Unused' } }],
  loaded: true, error: '', reload: jest.fn(),
};
jest.mock('../../../kit8/catalog/money_account/useMoneyAccountData', () => ({ useMoneyAccountData: () => mockData }));
const mockTable = jest.fn();
jest.mock('../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
const mockPick: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/SelectItemFromListApp', () => ({ __esModule: true, default: (p: any) => { mockPick[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => ({ PMIconButton: (p: any) => require('react').createElement('button', { 'data-testid': p.testID, onClick: p.onPress }) }));
let mockRestRows: any[] = [];
const mockRpc = jest.fn(async (name: string) => (name === 'cash_ledger_queue_length' ? { data: 2, error: null } : { data: { changed: 1, queue: 0 }, error: null }));
const mockFrom = jest.fn((_table: string) => ({ select: () => ({ eq: () => ({ order: async () => ({ data: mockRestRows, error: null }) }) }) }));
const mockClient = { from: mockFrom, rpc: mockRpc };
jest.doMock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockClient }) }));
const MoneyAccountCRUD = require('../../../kit8/catalog/money_account/MoneyAccountCRUD').default;
const MoneyAccountRests = require('../../../kit8/catalog/money_account/MoneyAccountRests').default;

const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const lastTable = () => mockTable.mock.calls.at(-1)![0];
afterEach(() => { cleanupUI(); jest.clearAllMocks(); Object.keys(mockPick).forEach((k) => delete mockPick[k]); mockRestRows = []; mockData.error = ''; });

describe('the catalog screen', () => {
  it('a ReusableTable on the money account entity, folders = the legal entities that have an account (the button shows all)', () => {
    renderUI(<MoneyAccountCRUD />);
    expect(lastTable()).toMatchObject({ entityName: 'moneyAccountReusable', listOwnerGUID: '*', listParentGUID: '*', itemLabel: 'Money account', realtime: true });
    expect(lastTable().foldersTree.nodes.map((n: any) => [n.id, n.title])).toEqual([['le-1', 'Acme SIA']]);
    expect(lastTable().foldersTree).toMatchObject({ folderTarget: 'rowParentGUID', noFolderValue: 'empty' });
    press('money-account-all-entities');
    expect(lastTable().foldersTree.nodes.map((n: any) => n.title)).toEqual(['Acme SIA', 'Unused']);
    expect(textOf('money-account')).toContain('2 money accounts');
  });
  it('the columns: title, kind, currency, number, bank, opening date, opening balance (may be negative), legal entity (the folder), active', () => {
    renderUI(<MoneyAccountCRUD />);
    const cols = lastTable().visualColumns;
    expect(cols.map((c: any) => c.key)).toEqual(['n', 'title', 'kind', 'currency', 'number', 'bank', 'openingDate', 'openingBalance', 'entity', 'isActive']);
    expect(cols.find((c: any) => c.key === 'kind').options.map((o: any) => o.value)).toEqual(['bank', 'cash']);
    expect(cols.find((c: any) => c.key === 'openingBalance')).toMatchObject({ field: 'moneyAccountOpeningBalance', type: 'number' });
    expect(cols.find((c: any) => c.key === 'entity')).toMatchObject({ target: 'rowParentGUID' });
    expect(cols.find((c: any) => c.key === 'entity').options).toEqual([{ value: 'le-1', label: 'Acme SIA' }, { value: 'le-2', label: 'Unused' }]);
    expect(lastTable().defaultRowJSON()).toMatchObject({ moneyAccountKind: 'bank', isActive: true });
  });
  it('a new account goes into the picked legal entity folder, else into "No folder"', () => {
    renderUI(<MoneyAccountCRUD />);
    expect(lastTable().newRowDefaults()).toEqual({ rowOwnerGUID: 'moneyAccountCatalog', rowParentGUID: 'empty', rowJSON: {} });
    act(() => lastTable().foldersTree.onSelectedFolderChange('le-1'));
    expect(lastTable().newRowDefaults().rowParentGUID).toBe('le-1');
  });
  it('a read error tells to run PART 38', () => {
    mockData.error = 'relation "moneyAccountTable" does not exist';
    renderUI(<MoneyAccountCRUD />);
    expect(textOf('money-account-setup')).toContain('PART 38');
  });
  it('the select under the table offers the accounts with their currency; the account picked shows its rests', async () => {
    mockRestRows = [{ moneyAccount: 'ma-1', sumKind: 'account', currency: 'EUR', periodDay: '2030-01-05', turnover: -360, rest: 640 }];
    renderUI(<MoneyAccountCRUD />);
    expect(q('money-account-rests-none')).not.toBeNull();
    expect(mockPick['money-account-pick'].items).toEqual([{ value: 'ma-1', label: 'Bank EUR · EUR' }, { value: 'ma-2', label: 'Cash · USD' }]);
    act(() => mockPick['money-account-pick'].onSelect('ma-1'));
    await flush();
    expect(mockFrom).toHaveBeenCalledWith('cash_account_ledger_rests');
    expect(textOf('money-account-rests-now-account-EUR')).toContain('640.00 EUR');
  });
});

describe('the rests', () => {
  const account = mockData.rows[0];
  it('what the account holds now per kind and currency, and the days (newest first)', async () => {
    mockRestRows = [
      { moneyAccount: 'ma-1', sumKind: 'account', currency: 'EUR', periodDay: '2030-01-04', turnover: -50, rest: 950 },
      { moneyAccount: 'ma-1', sumKind: 'account', currency: 'EUR', periodDay: '2030-01-05', turnover: -360, rest: 590 },
      { moneyAccount: 'ma-1', sumKind: 'budget', currency: 'USD', periodDay: '2030-01-05', turnover: -432, rest: -492 },
    ];
    renderUI(<MoneyAccountRests account={account} />);
    await flush();
    expect(textOf('money-account-rests-now-account-EUR')).toContain('590.00 EUR');
    expect(textOf('money-account-rests-now-account-EUR')).toContain('Account currency · 2030-01-05');
    expect(textOf('money-account-rests-now-budget-USD')).toContain('-492.00 USD');
    expect(textOf('money-account-rests-days').indexOf('2030-01-05')).toBeLessThan(textOf('money-account-rests-days').indexOf('2030-01-04'));
    expect(textOf('money-account-rests-queue')).toContain('2 exchange rate changes wait');
  });
  it('an account without movements shows its opening balance; an account without anything says so', async () => {
    renderUI(<MoneyAccountRests account={account} />);
    await flush();
    expect(textOf('money-account-rests-now-account-EUR')).toMatch(/1[.,]?000[.,]00 EUR/);
    cleanupUI();
    renderUI(<MoneyAccountRests account={mockData.rows[1]} />);
    await flush();
    expect(textOf('money-account-rests-now-account-USD')).toContain('0.00 USD');
  });
  it('Refresh rests calls cash_ledger_refresh_now and reads the rests again', async () => {
    renderUI(<MoneyAccountRests account={account} />);
    await flush();
    mockFrom.mockClear();
    press('money-account-rests-refresh');
    await flush();
    expect(mockRpc).toHaveBeenCalledWith('cash_ledger_refresh_now');
    expect(mockFrom).toHaveBeenCalledWith('cash_account_ledger_rests');
  });
  it('no account: a hint and no read', async () => {
    renderUI(<MoneyAccountRests account={null} />);
    await flush();
    expect(textOf('money-account-rests-none')).toContain('Pick a money account');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(qa('money-account-rests-')).toEqual(['money-account-rests-none']);
  });
});
