/** @jest-environment jsdom */
// ReusableTable in all-rows mode (a catalog dashboard): every owner, root-column cells (rowOwnerGUID), select picker,
// boolean cells, validate, rowFilter + newRowDefaults, totals off, toolbarExtra.
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/x', useGlobalSearchParams: () => ({}) }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: 'rgb(231, 224, 236)' } }) }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `new-${++n}` }; });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
const mockActions = {
  readData: jest.fn((p: any) => ({ type: 'read', p })),
  createOne: jest.fn((p: any) => ({ type: 'create', p })),
  updateOne: jest.fn((p: any) => ({ type: 'update', p })),
  deleteOne: jest.fn((p: any) => ({ type: 'delete', p })),
};
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { thing: { get actions() { return mockActions; } } } }));
let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch }));
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '', default: () => null }));
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));
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

import ReusableTable from '../../../kit8/ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import { Text } from 'react-native';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 't';
const columns: VisualColumn[] = [
  { key: 'n', title: '#', type: 'rowNumber' },
  { key: 'title', title: 'Title', type: 'text' },
  { key: 'type', title: 'Type', type: 'select', target: 'rowOwnerGUID', allowEmpty: false, options: [{ value: 'o1', label: 'Phones' }, { value: 'o2', label: 'Meals' }] },
  { key: 'active', title: 'Active', type: 'boolean' },
  { key: 'price', title: 'Price', type: 'number', total: false, validate: (v) => (Number(v) > 1000 ? 'Too expensive' : null) },
  { key: 'qty', title: 'Qty', type: 'integer' },
];
const rows = [
  { rowGUID: 'a', rowOwnerGUID: 'o1', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: 'Phone', active: true, price: 10, qty: 1 } },
  { rowGUID: 'b', rowOwnerGUID: 'o2', rowParentGUID: 'f1', orderInList: 2, rowJSON: { title: 'Soup', active: false, price: 5, qty: 2 } },
  { rowGUID: 'c', rowOwnerGUID: 'o1', rowParentGUID: 'f2', orderInList: 3, rowJSON: { title: 'Tablet', active: true, price: 20, qty: 3 } },
];
function mount(props: any = {}) {
  mockState = { uxuiState: { askBeforeDeletePost: false }, thing: { entityDataFromServer: rows, readSuccessful: 1 } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID={T} entityName="thing" listOwnerGUID={REUSABLE_TABLE_ALL} listParentGUID={REUSABLE_TABLE_ALL} visualColumns={columns} {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

it('reads the whole table (no match) and shows the rows of every owner; no total where total: false', () => {
  mount();
  expect(mockActions.readData).toHaveBeenCalledWith({ paginationSize: 1000, originationCurrentPage: 0 });
  expect(['a', 'b', 'c'].every((g) => q(`${T}-row-${g}`))).toBe(true);
  expect(q(`${T}-cell-b-type`)!.textContent).toContain('Meals');
  expect(q(`${T}-total-price`)).toBeNull();
  expect(q(`${T}-total-qty`)!.textContent).toBe('6');
});

it('a root column is changed through the picker: updateOne with columns.rowOwnerGUID', () => {
  mount();
  press(`${T}-cell-a-type`);
  press(`${T}-cell-a-type-picker-option-o2`);
  expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'a', rowOwnerGUID: 'o1', columns: { rowOwnerGUID: 'o2' } });
  expect(q(`${T}-cell-a-type`)!.textContent).toContain('Meals');
});

it('boolean cell toggles rowJSON', () => {
  mount();
  press(`${T}-cell-a-active`);
  expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'a', rowOwnerGUID: 'o1', rowJSON: { active: false } });
});

it('validate refuses a value with a snackbar and saves nothing', () => {
  mount();
  const input = q(`${T}-cell-a-price`) as HTMLInputElement;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, '5000');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => { input.focus(); input.blur(); });
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: 'Too expensive' } });
  expect(mockActions.updateOne).not.toHaveBeenCalled();
});

it('rowFilter shows a part; a new row gets newRowDefaults (owner + rowJSON); toolbarExtra is in the bar', () => {
  mount({ rowFilter: (r: any) => r.rowOwnerGUID === 'o1', newRowDefaults: () => ({ rowOwnerGUID: 'o1', rowParentGUID: 'f9', rowJSON: { active: true } }), toolbarExtra: <Text testID="extra">x</Text> });
  expect(q(`${T}-row-b`)).toBeNull();
  expect(q(`${T}-count`)!.textContent).toContain('2');
  expect(q('extra')).not.toBeNull();
  press(`${T}-add`);
  expect(mockActions.createOne).toHaveBeenCalledWith(expect.objectContaining({ rowOwnerGUID: 'o1', rowParentGUID: 'f9', rowJSON: expect.objectContaining({ active: true, title: null }) }));
});

it('computeRowJSON adds derived fields to the saved change', () => {
  mount({ computeRowJSON: (j: any) => ({ label: `${j.title} (${j.active ? 'on' : 'off'})` }) });
  press(`${T}-cell-c-active`);
  expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'c', rowOwnerGUID: 'o1', rowJSON: { active: false, label: 'Tablet (off)' } });
});
