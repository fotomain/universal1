/** @jest-environment jsdom */
// ReusableTable in LOCAL ROWS mode (localRows + onLocalRowsChange): the screen holds the rows - no read, no realtime, no redux entity, no listOwnerGUID;
// a cell, a new / deleted row go up as the WHOLE list; the folders tree filters the local rows.
import React, { act } from 'react';
import { mockRects } from '../tree/folderTreeTestKit';

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
import type { ReusableTableFoldersTree, VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let restore: () => void;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 'lt';
const TREE = `${T}-folders`;
const tableRows = () => qa(`${T}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${T}-row-`, ''));
const pickFolder = (id: string) => act(() => { (q(`${TREE}-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });

const columns: VisualColumn[] = [
  { key: 'on', title: 'On', type: 'boolean' },
  { key: 'title', title: 'Title', type: 'text', editable: false },
];
const folders: ReusableTableFoldersTree = {
  nodes: [{ id: 'g1', parentId: null, title: 'Plan', order: 1000 }, { id: 'g2', parentId: null, title: 'Fact', order: 2000 }],
};
const initial = [
  { rowGUID: 'a', rowParentGUID: 'g1', orderInList: 1, rowJSON: { on: true, title: 'Planned' } },
  { rowGUID: 'b', rowParentGUID: 'g1', orderInList: 2, rowJSON: { on: true, title: 'Contracted' } },
  { rowGUID: 'c', rowParentGUID: 'g2', orderInList: 3, rowJSON: { on: false, title: 'Ordered' } },
];

/** a screen that holds the rows, as Monitor01FieldsTab does */
function Screen({ spy, extra }: { spy: (rows: any[]) => void; extra?: any }) {
  const [rows, setRows] = React.useState<any[]>(initial);
  return (
    <ReusableTable testID={T} entityName="localThing" localRows={rows} onLocalRowsChange={(next) => { spy(next); setRows(next); }} visualColumns={columns}
      selectionEnabled={false} {...extra} />
  );
}
function mount(spy: (rows: any[]) => void, extra?: any) {
  mockState = { uxuiState: { askBeforeDeletePost: false } };
  restore = mockRects({
    [TREE]: { left: 0, top: 0, width: 260, height: 500 },
    [`${TREE}-pinned`]: { left: 0, top: 80, width: 260, height: 64 },
    [`${TREE}-list`]: { left: 0, top: 144, width: 260, height: 350 },
  });
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<Screen spy={spy} extra={extra} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; restore?.(); jest.clearAllMocks(); });

it('shows the local rows without an owner, a read or a redux entity', () => {
  mount(jest.fn());
  expect(q(`${T}-no-owner`)).toBeNull();
  expect(tableRows().sort()).toEqual(['a', 'b', 'c']);
  expect(mockActions.readData).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
});

it('a cell goes up as the WHOLE new list, and comes back into the table; nothing is dispatched', () => {
  const spy = jest.fn();
  mount(spy);
  expect(q(`${T}-cell-a-on`)!.getAttribute('aria-checked')).toBe('true');
  press(`${T}-cell-a-on`);
  expect(spy).toHaveBeenCalledTimes(1);
  const list = spy.mock.calls[0][0];
  expect(list.map((r: any) => [r.rowGUID, r.rowJSON.on])).toEqual([['a', false], ['b', true], ['c', false]]);
  expect(q(`${T}-cell-a-on`)!.getAttribute('aria-checked')).toBe('false');
  expect(mockActions.updateOne).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
});

it('a new row goes up as the whole list too', () => {
  const spy = jest.fn();
  mount(spy);
  press(`${T}-add`);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0][0]).toHaveLength(4);
  expect(tableRows()).toHaveLength(4);
  expect(mockActions.createOne).not.toHaveBeenCalled();
});

it('the folders tree filters the local rows by rowParentGUID', () => {
  mount(jest.fn(), { foldersTree: folders, uxuiTable: { showFoldersTree: true } });
  pickFolder('g1');
  expect(tableRows().sort()).toEqual(['a', 'b']);
  pickFolder('g2');
  expect(tableRows()).toEqual(['c']);
  expect(q(`${TREE}-row-g1-count`)!.textContent).toBe('2');
});

it('without localRows an owner is still needed', () => {
  mockState = { uxuiState: { askBeforeDeletePost: false } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID={T} entityName="thing" visualColumns={columns} />));
  expect(q(`${T}-no-owner`)).not.toBeNull();
});
