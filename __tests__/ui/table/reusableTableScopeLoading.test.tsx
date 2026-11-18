/** @jest-environment jsdom */
// ReusableTable of ONE owner (the lines of a task): while the rows of THIS owner are being read the table shows the spinner - also when the entity has been read before for ANOTHER owner
// (opening the next task used to show an empty table / "No lines yet" until the rows arrived).
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
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const T = 't';
const columns: VisualColumn[] = [{ key: 'n', title: '#', type: 'rowNumber' }, { key: 'title', title: 'Title', type: 'text' }];
const rowOf = (guid: string, owner: string) => ({ rowGUID: guid, rowOwnerGUID: owner, rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: guid } });
const element = (owner: string) => <ReusableTable testID={T} entityName="thing" listOwnerGUID={owner} visualColumns={columns} emptyText="No lines yet" />;
function mount(state: any, owner = 'task2') {
  mockState = { uxuiState: { askBeforeDeletePost: false }, thing: state };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(element(owner)));
  // a real dispatch changes the store and the screen renders again; the mocked one does not: render once more (the effect of the first render has sent the read)
  act(() => root.render(element(owner)));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

it('the entity was read before for ANOTHER task and the read of this task is on its way: spinner, no "No lines yet"', () => {
  // stale flags of the earlier task (a successful read AND a realtime event) must not hide the spinner: only isReading says a read is on its way
  mount({ entityDataFromServer: [rowOf('l1', 'task1')], readSuccessful: 1, lastRealtimeEvent: { eventType: 'UPDATE', at: 1 }, isReading: true });
  expect(mockActions.readData).toHaveBeenCalledTimes(1);
  expect(q(`${T}-loading`)).not.toBeNull();
  expect(q(`${T}-empty`)).toBeNull();
});

it('the read of this task has answered with no row: the empty text, no spinner', () => {
  mount({ entityDataFromServer: [], readSuccessful: 1, isReading: false });
  expect(q(`${T}-loading`)).toBeNull();
  expect(q(`${T}-empty`)!.textContent).toContain('No lines yet');
});

it('the rows of this task are there: no spinner even while a refresh read runs', () => {
  mount({ entityDataFromServer: [rowOf('l2', 'task2')], readSuccessful: -1, isReading: true });
  expect(q(`${T}-loading`)).toBeNull();
  expect(q(`${T}-row-l2`)).not.toBeNull();
});

it('the table reads the rows of its OWN task (owner + parent scope)', () => {
  mockState = { uxuiState: { askBeforeDeletePost: false }, thing: { entityDataFromServer: [], readSuccessful: 1, isReading: false } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(element('task9')));
  expect(mockActions.readData).toHaveBeenCalledWith({ paginationSize: 1000, originationCurrentPage: 0, match: { rowOwnerGUID: 'task9', rowParentGUID: 'empty' } });
});
