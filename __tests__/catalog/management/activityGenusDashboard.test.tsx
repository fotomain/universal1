/** @jest-environment jsdom */
// ManagementActivityGenusCRUD on budget items generated from the management genus seed: the budget FOLDERS (tree) beside the budget ITEMS (table), editing on by default,
// ManagementActivityGenusCRUD on the SQL seed: the 3 activities and the 14 budget item keys, both read only, with the counts of the budget items and the columns Web + IFRS / D365 FO / SAP.
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

import ManagementActivityGenusCRUD from '../../../kit8/catalog/management/activity_genus/ManagementActivityGenusCRUD';
import { MANAGEMENT_ACTIVITY_GENUS_TABLE } from '../../../kit8/catalog/management/activity_genus/managementActivityGenusModel';
import { BUDGET_ITEM_KEY_MATRIX, BUDGET_ITEM_KEY_TABLE, budgetItemKeyOf } from '../../../kit8/catalog/budget/item/budgetItemKeyModel';
import { BUDGET_ITEM_TABLE } from '../../../kit8/catalog/budget/item/budgetItemModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const textOf = (id: string) => { const el = q(id)!; const input = el.matches('input,textarea') ? el : el.querySelector('input,textarea'); return input ? (input as HTMLInputElement).value : el.textContent; };
const rowIds = (table: string) => qa(`${table}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${table}-row-`, '')).filter((x) => !x.includes('-'));

const T = (rowGUID: string, json: any, orderInList: number, rowOwnerGUID: string) => ({ rowGUID, rowOwnerGUID, rowParentGUID: 'empty', orderInList, rowJSON: json });
const activities = () => [
  T('operatingActivity', { title: 'Operating activity', description: 'Core', webIfrsName: 'IAS 7.6, 7.14', d365foName: 'Financial reporting row definition', sapName: 'Liquidity item (operating)' }, 1000, 'managementActivityGenusCatalog'),
  T('investingActivity', { title: 'Investing activity', description: 'Long-term assets', webIfrsName: 'IAS 7.6, 7.16', d365foName: 'Fixed assets', sapName: 'FI-AA' }, 2000, 'managementActivityGenusCatalog'),
  T('financingActivity', { title: 'Financing activity', description: 'Equity and debt', webIfrsName: 'IAS 7.6, 7.17', d365foName: 'Liability accounts', sapName: 'Loans' }, 3000, 'managementActivityGenusCatalog'),
];
const keys = () => BUDGET_ITEM_KEY_MATRIX.map((c, i) => T(budgetItemKeyOf(c.activity, c.genus),
  { title: `${c.activity} > ${c.genus}`, activityGenus: c.activity, managementGenusItem: c.genus, directionDefault: c.direction, d365foName: 'D365 text', sapName: 'SAP text' }, (i + 1) * 100, 'budgetItemGenericKeyCatalog'));
const item = (guid: string, key: string, genus: string) => ({ rowGUID: guid, rowOwnerGUID: 'budgetItemCatalog', rowParentGUID: 'costsBudgetFolder', orderInList: 1, rowJSON: { title: guid, managementGenusItem: genus, budgetItemGenericKey: key } });

function mount(a: any[] = activities(), k: any[] = keys(), items: any[] = []) {
  mockParams = {};
  mockState = {
    uxuiState: { askBeforeDeletePost: true },
    [MANAGEMENT_ACTIVITY_GENUS_TABLE.entity]: { entityDataFromServer: a, readSuccessful: 1 },
    [BUDGET_ITEM_KEY_TABLE.entity]: { entityDataFromServer: k, readSuccessful: 1 },
    [BUDGET_ITEM_TABLE.entity]: { entityDataFromServer: items, readSuccessful: 1 },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ManagementActivityGenusCRUD />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });

describe('the two read-only tables', () => {
  it('3 activities and 14 keys, no setup hint', () => {
    mount();
    expect(rowIds('activity-genus-table').sort()).toEqual(['financingActivity', 'investingActivity', 'operatingActivity']);
    expect(rowIds('budget-item-key-table')).toHaveLength(14);
    expect(q('activity-genus-setup')).toBeNull();
    expect(q('activity-genus-dashboard')!.textContent).toContain('3 activities · 14 keys · read-only');
  });

  it('an activity shows its code, Web + IFRS, D365 FO and SAP text and how many keys it has', () => {
    mount();
    expect(q('activity-genus-code-investingActivity')!.textContent).toBe('investingActivity');
    expect(textOf('activity-genus-table-cell-operatingActivity-webIfrsName')).toBe('IAS 7.6, 7.14');
    expect(textOf('activity-genus-table-cell-investingActivity-d365foName')).toBe('Fixed assets');
    expect(textOf('activity-genus-table-cell-financingActivity-sapName')).toBe('Loans');
    expect(q('activity-genus-keys-operatingActivity')!.textContent).toBe('6');
    expect(q('activity-genus-keys-investingActivity')!.textContent).toBe('6');
    expect(q('activity-genus-keys-financingActivity')!.textContent).toBe('2');
  });

  it('a key shows its code, activity, direction and the D365 FO / SAP text', () => {
    mount();
    expect(q('budget-item-key-code-investingActivity.materialGenus')!.textContent).toBe('investingActivity.materialGenus');
    expect(q('budget-item-key-table-cell-investingActivity.materialGenus-activityGenus')!.textContent).toContain('Investing');
    expect(q('budget-item-key-table-cell-operatingActivity.revenueGenus-directionDefault')!.textContent).toContain('Inbound');
    expect(q('budget-item-key-table-cell-operatingActivity.timeGenus-directionDefault')!.textContent).toContain('Outbound');
    expect(textOf('budget-item-key-table-cell-financingActivity.inboundPaymentGenus-d365foName')).toBe('D365 text');
  });

  it('counts the budget items per activity and per key (folders are not counted)', () => {
    const items = [
      item('a', 'operatingActivity.timeGenus', 'timeGenus'), item('b', 'operatingActivity.timeGenus', 'timeGenus'),
      item('c', 'investingActivity.materialGenus', 'materialGenus'), item('d', 'financingActivity.outboundPaymentGenus', 'outboundPaymentGenus'),
      { rowGUID: 'costsBudgetFolder', rowOwnerGUID: 'budgetItemCatalog', rowParentGUID: 'empty', orderInList: 0, rowJSON: { title: 'Costs' } },
    ];
    mount(activities(), keys(), items);
    expect(q('activity-genus-items-operatingActivity')!.textContent).toBe('2');
    expect(q('activity-genus-items-investingActivity')!.textContent).toBe('1');
    expect(q('activity-genus-items-financingActivity')!.textContent).toBe('1');
    expect(q('budget-item-key-items-operatingActivity.timeGenus')!.textContent).toBe('2');
    expect(q('budget-item-key-items-operatingActivity.materialGenus')!.textContent).toBe('0');
  });

  it('is read only: no add, no row menu, no edit calls', () => {
    mount();
    expect(q('activity-genus-table-add')).toBeNull();
    expect(q('budget-item-key-table-add')).toBeNull();
    expect(mockCalls).toEqual([]);
  });
});

it('empty tables: the setup hint names the SQL files and PART 32', () => {
  mount([], [], []);
  expect(q('activity-genus-setup')!.textContent).toContain('start2_sql_code.sql');
  expect(q('activity-genus-setup')!.textContent).toContain('PART 32');
});
