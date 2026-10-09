/** @jest-environment jsdom */
// ReusableTable: EditRowModalCard (menu "Edit", fresh row, setCell / patchRow / onClose) and uxuiTable.inlineEdit (default true).
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
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ items, testID }: any) => R.createElement(View, { testID }, items.map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.onPress }, R.createElement(Text, null, i.label)))) };
});
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
import type { EditRowModalCardProps, VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import { Pressable, Text } from 'react-native';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 't';
const columns: VisualColumn[] = [
  { key: 'n', title: '#', type: 'rowNumber' },
  { key: 'title', title: 'Title', type: 'text' },
  { key: 'active', title: 'Active', type: 'boolean' },
];
const rows = [
  { rowGUID: 'a', rowOwnerGUID: 'o1', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: 'Phone', active: true } },
  { rowGUID: 'b', rowOwnerGUID: 'o1', rowParentGUID: 'empty', orderInList: 2, rowJSON: { title: 'Soup', active: false } },
];
let lastProps: EditRowModalCardProps | null = null;
function Card(p: EditRowModalCardProps) {
  lastProps = p;
  return (
    <>
      <Text testID="card-title">{String(p.row.rowJSON?.title)}</Text>
      <Pressable testID="card-set" onPress={() => p.setCell('title', 'Changed')}><Text>set</Text></Pressable>
      <Pressable testID="card-patch" onPress={() => p.patchRow({ active: true })}><Text>patch</Text></Pressable>
      <Pressable testID="card-close" onPress={p.onClose}><Text>close</Text></Pressable>
    </>
  );
}
function mount(props: any = {}) {
  mockState = { uxuiState: { askBeforeDeletePost: false }, thing: { entityDataFromServer: rows, readSuccessful: 1 } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID={T} entityName="thing" listOwnerGUID={REUSABLE_TABLE_ALL} listParentGUID={REUSABLE_TABLE_ALL} visualColumns={columns} {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); lastProps = null; });

it('inlineEdit is on by default: cells are inputs, a click on a cell opens nothing', () => {
  mount({ EditRowModalCard: Card });
  expect(q(`${T}-cell-a-title`)!.tagName).toBe('INPUT');
  expect(q(`${T}-open-a-title`)).toBeNull();
  expect(q('card-title')).toBeNull();
});

it('without the EditRowModalCard prop the row menu has no "Edit"', () => {
  mount();
  press(`${T}-menu-button-a`);
  expect(q(`${T}-menu-edit`)).toBeNull();
  expect(q(`${T}-menu-duplicate`)).not.toBeNull();
});

it('row menu "Edit" opens the card with the fresh row; setCell / patchRow save like an in-place edit; onClose closes it', () => {
  mount({ EditRowModalCard: Card });
  press(`${T}-menu-button-b`);
  press(`${T}-menu-edit`);
  expect(q('card-title')!.textContent).toBe('Soup');
  expect(lastProps!.itemLabel).toBe('Row');
  expect(lastProps!.visualColumns.map((col) => col.key)).toEqual(["n", "title", "active"]);
  press('card-set');
  expect(mockActions.updateOne).toHaveBeenCalledWith(expect.objectContaining({ rowGUID: 'b', rowJSON: expect.objectContaining({ title: 'Changed' }) }));
  press('card-patch');
  expect(mockActions.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({ rowGUID: 'b', rowJSON: expect.objectContaining({ active: true }) }));
  press('card-close');
  expect(q('card-title')).toBeNull();
});

it('inlineEdit = false: cells only show, a click on a row opens the card', () => {
  mount({ EditRowModalCard: Card, uxuiTable: { inlineEdit: false } });
  expect(q(`${T}-cell-a-title`)!.tagName).not.toBe('INPUT');
  expect(q(`${T}-cell-a-title`)!.textContent).toBe('Phone');
  press(`${T}-open-a-title`);
  expect(q('card-title')!.textContent).toBe('Phone');
  expect(mockActions.updateOne).not.toHaveBeenCalled();
});

it('inlineEdit = false without a card keeps the cells editable (nothing could edit them otherwise)', () => {
  mount({ uxuiTable: { inlineEdit: false } });
  expect(q(`${T}-cell-a-title`)!.tagName).toBe('INPUT');
});
