/** @jest-environment jsdom */
// PMBudgetItemCRUD on budget items generated from the management genus seed: the budget FOLDERS (tree) beside the budget ITEMS (table), editing on by default,
// the management genus of an item is obligatory.
import React, { act } from 'react';
import { budgetSeedRows } from './budgetItemTestKit';
import { genusRows } from '../resourcerole/resourceRoleTestKit';
import { mockRects, rowTop } from '../../ui/tree/folderTreeTestKit';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
let mockParams: Record<string, string> = {};
const mockSetParams = jest.fn((p: any) => { mockParams = { ...mockParams, ...p }; });
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), setParams: mockSetParams }), usePathname: () => '/catalog/resourcerole/dashboard', useGlobalSearchParams: () => mockParams }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `uuid-${++n}` }; });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn(() => 'subscribed') }));
const mockCalls: any[] = [];
const mockActionsFor = (entity: string) => ({
  readData: (p: any) => ({ type: `${entity}/readData`, p }),
  createOne: (p: any) => { mockCalls.push(['create', entity, p]); return { type: `${entity}/createOne`, p }; },
  updateOne: (p: any) => { mockCalls.push(['update', entity, p]); return { type: `${entity}/updateOne`, p }; },
  deleteOne: (p: any) => { mockCalls.push(['delete', entity, p]); return { type: `${entity}/deleteOne`, p }; },
});
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: (_t, k: string) => ({ actions: mockActionsFor(k) }) }) }));
let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch, shallowEqual: jest.requireActual('react-redux').shallowEqual }));
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '', default: () => null }));
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ items, testID }: any) => R.createElement(View, { testID }, items.map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.onPress }, R.createElement(Text, null, i.label)))) };
});
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ visible, onConfirm, modalBody }: any) => (visible
    ? R.createElement(Pressable, { testID: 'ask-confirm', onPress: onConfirm }, R.createElement(Text, { testID: 'ask-body' }, modalBody))
    : null) };
});
jest.mock('../../../kit8/pm/store/store_pm', () => ({ usePMStore: (sel: any) => sel({ selectRowCheckBoxForm: 'formRound' }) }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, heightVariant, ...p }: any) => R.createElement(TextInput, p) };
});
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
// design-system components of the product card: light stand-ins (the real ones switch on the active design system)
jest.mock('../../../kit8/ui/components/common/TextApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ children, testID }: any) => R.createElement(Text, { testID }, children) };
});
jest.mock('../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  const ButtonApp = ({ title, icon, onPress, testID }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, title ?? icon));
  return { __esModule: true, default: ButtonApp, ButtonApp };
});
jest.mock('../../../kit8/ui/components/common/SegmentButtonsApp', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ buttons, value, onValueChange, testID }: any) => R.createElement(View, { testID },
    buttons.map((b: any) => R.createElement(Pressable, { key: b.value, testID: b.testID, 'aria-selected': b.value === value, onPress: () => onValueChange(b.value) }, R.createElement(Text, null, b.label)))) };
});
jest.mock('../../../kit8/ui/components/common/SwitchApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ value, onValueChange, label, testID }: any) => R.createElement(Pressable, { testID, 'aria-checked': value, onPress: () => onValueChange(!value) }, R.createElement(Text, null, label)) };
});
jest.mock('../../../kit8/ui/components/common/SelectorFromApp', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ options, value, onValueChange, label, testID }: any) => R.createElement(View, { testID, 'data-value': value },
    R.createElement(Text, null, label),
    options.map((o: any) => R.createElement(Pressable, { key: o.value, testID: `${testID}-option-${o.value || 'none'}`, onPress: () => onValueChange(o.value) }, R.createElement(Text, null, o.label)))) };
});

import PMBudgetItemCRUD from '../../../kit8/catalog/budget/item/PMBudgetItemCRUD';
import { BUDGET_ITEM_TABLE } from '../../../kit8/catalog/budget/item/budgetItemModel';
import { MANAGEMENT_GENUS_TABLE } from '../../../kit8/catalog/management/genus/managementGenusModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const calls = (kind: string, entity: string) => mockCalls.filter((c) => c[0] === kind && c[1] === entity).map((c) => c[2]);
const TABLE = 'budget-item-table';
const TREE = `${TABLE}-folders`;
const rowIds = () => qa(`${TABLE}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${TABLE}-row-`, '')).filter((x) => !x.includes('-'));
const pickFolder = (id: string) => act(() => { (q(`${TREE}-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });

function mount(props: { noCrud?: boolean } = {}, rows: any[] = budgetSeedRows(), genus: any[] = genusRows()) {
  mockParams = {};
  mockState = {
    uxuiState: { askBeforeDeletePost: true },
    [BUDGET_ITEM_TABLE.entity]: { entityDataFromServer: rows, readSuccessful: 1 },
    [MANAGEMENT_GENUS_TABLE.entity]: { entityDataFromServer: genus, readSuccessful: 1 },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<PMBudgetItemCRUD {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });

describe('the folders and the items', () => {
  it('the tree has the 3 folders, the table the 6 items - no folder is a row', () => {
    mount();
    expect(rowIds().sort()).toEqual(['expenseBudgetItem', 'inboundPaymentBudgetItem', 'materialBudgetItem', 'outboundPaymentBudgetItem', 'revenueBudgetItem', 'timeBudgetItem']);
    for (const f of ['costsBudgetFolder', 'revenuesBudgetFolder', 'paymentsBudgetFolder']) expect(q(`${TREE}-row-${f}`)).not.toBeNull();
    for (const i of ['timeBudgetItem', 'revenueBudgetItem']) expect(q(`${TREE}-row-${i}`)).toBeNull();
    expect(q(`${TREE}-row-__tree_none__`)).toBeNull();
    expect(q('budget-item-no-genus')).toBeNull();
  });

  it('picking a folder shows its items; counts per folder', () => {
    mount();
    expect(q(`${TREE}-row-costsBudgetFolder-count`)!.textContent).toBe('3');
    expect(q(`${TREE}-row-revenuesBudgetFolder-count`)!.textContent).toBe('1');
    expect(q(`${TREE}-row-paymentsBudgetFolder-count`)!.textContent).toBe('2');
    pickFolder('costsBudgetFolder');
    expect(rowIds().sort()).toEqual(['expenseBudgetItem', 'materialBudgetItem', 'timeBudgetItem']);
    pickFolder('paymentsBudgetFolder');
    expect(rowIds().sort()).toEqual(['inboundPaymentBudgetItem', 'outboundPaymentBudgetItem']);
  });

  it('the code, the folder and the management genus (obligatory) of an item are shown', () => {
    mount();
    expect(q('budget-item-code-timeBudgetItem')!.textContent).toBe('timeBudgetItem');
    expect(q(`${TABLE}-cell-timeBudgetItem-parent`)!.textContent).toContain('Costs');
    expect(q(`${TABLE}-cell-timeBudgetItem-managementGenusItem`)!.textContent).toContain('Time');
    expect(q(`${TABLE}-cell-outboundPaymentBudgetItem-managementGenusItem`)!.textContent).toContain('Outbound payment');
  });

  it('an item without a valid genus is reported', () => {
    const rows = budgetSeedRows();
    rows.find((r) => r.rowGUID === 'timeBudgetItem').rowJSON.managementGenusItem = null;
    rows.find((r) => r.rowGUID === 'revenueBudgetItem').rowJSON.managementGenusItem = 'costsGenus'; // a genus FOLDER
    mount({}, rows);
    expect(q('budget-item-no-genus')!.textContent).toContain('2 budget items without a valid management genus');
  });
});

describe('editing is on by default; the lock makes it read-only', () => {
  it('"+" creates an ITEM in the picked folder with a management genus; "new folder" a top level row without one', () => {
    mount();
    expect(q('budget-item-edit-toggle')!.textContent).toBe('lock_open');
    pickFolder('paymentsBudgetFolder');
    press(`${TABLE}-add`);
    expect(calls('create', BUDGET_ITEM_TABLE.entity)[0]).toEqual(expect.objectContaining({
      rowOwnerGUID: 'budgetItemCatalog', rowParentGUID: 'paymentsBudgetFolder', rowJSON: expect.objectContaining({ managementGenusItem: 'inboundPaymentGenus' }),
    }));
    press(`${TREE}-new-root`);
    const created = calls('create', BUDGET_ITEM_TABLE.entity);
    expect(created[created.length - 1]).toEqual(expect.objectContaining({ rowOwnerGUID: 'budgetItemCatalog', rowParentGUID: 'empty', rowJSON: { title: 'New folder' } }));
  });

  it('a new item with "All" picked goes into the first folder, never to the top level, and gets a genus', () => {
    mount();
    press(`${TABLE}-add`);
    const created = calls('create', BUDGET_ITEM_TABLE.entity)[0];
    expect(created.rowParentGUID).toBe('costsBudgetFolder');
    expect(created.rowJSON.managementGenusItem).toBe('timeGenus');
  });

  it('no subfolders: "new subfolder" is refused', () => {
    mount();
    pickFolder('costsBudgetFolder');
    press(`${TREE}-new-sub`);
    expect(calls('create', BUDGET_ITEM_TABLE.entity)).toEqual([]);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: 'A budget item is added in the table: pick the folder and press +' } });
  });

  it('deleting a folder deletes its items', () => {
    mount();
    pickFolder('paymentsBudgetFolder');
    press(`${TREE}-delete`);
    press('ask-confirm');
    expect(calls('delete', BUDGET_ITEM_TABLE.entity).map((c) => c.rowGUID).sort()).toEqual(['inboundPaymentBudgetItem', 'outboundPaymentBudgetItem', 'paymentsBudgetFolder']);
  });

  it('noCrud: no add, no folder commands, cells not editable', () => {
    mount({ noCrud: true });
    expect(q('budget-item-edit-toggle')!.textContent).toBe('lock');
    expect(q(`${TABLE}-add`)).toBeNull();
    expect(q(`${TREE}-new-root`)).toBeNull();
    expect(q(`${TREE}-delete`)).toBeNull();
    expect(q('budget-item-dashboard')!.textContent).toContain('read-only');
    expect(calls('update', BUDGET_ITEM_TABLE.entity)).toEqual([]);
    press('budget-item-edit-toggle');
    expect(q(`${TABLE}-add`)).not.toBeNull();
  });
});

it('no rows: the setup hint names the SQL file', () => {
  mount({}, []);
  expect(q('budget-item-setup')!.textContent).toContain('create_budget_item_table.sql');
});
