/** @jest-environment jsdom */
// ReusableTable: with .env ENVIRONMENT_NAME=DEV_ENVIRONMENT the three dots menu of the bar shows the table name as its LAST item; a press copies it to the clipboard.
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
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: 'rgb(231, 224, 236)' } }), TextInput: () => null, HelperText: () => null }));
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
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: () => '', default: () => null }));
const mockMenus: Record<string, any[]> = {};
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: (p: any) => { mockMenus[p.testID] = p.items; return null; } }));
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
// the calendar field: a text input with the commit hooks + a button that "picks" 2026-12-24
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput, Pressable } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, onSelectDate, onSubmitEditing }: any) => R.createElement(R.Fragment, null,
    R.createElement(TextInput, { testID, value, onChangeText, onSubmitEditing }),
    R.createElement(Pressable, { testID: `${testID}-pick`, onPress: () => onSelectDate(new Date(2026, 11, 24)) })) };
});
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));

const mockEnv = { dev: false };
jest.mock('../../../kit8/ui/environment', () => ({ isDevEnvironment: () => mockEnv.dev, DEV_ENVIRONMENT: 'DEV_ENVIRONMENT', environmentName: () => (mockEnv.dev ? 'DEV_ENVIRONMENT' : '') }));
import ReusableTable from '../../../kit8/ui/components/table/reusable/ReusableTable';
import * as Clipboard from 'expo-clipboard';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 'ft';
const columns: VisualColumn[] = [{ key: 'n', title: '#', type: 'rowNumber' }, { key: 'name', title: 'Name', type: 'text', field: 'name' }];
function mount(extra: Record<string, any> = {}) {
  mockState = { uxuiState: { askBeforeDeletePost: false }, thing: { entityDataFromServer: [{ rowGUID: 'a', rowOwnerGUID: 'task', orderInList: 1, rowJSON: { name: 'x' } }], readSuccessful: 1 } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID={T} entityName="thing" listOwnerGUID="task" listParentGUID="*" visualColumns={columns} {...extra} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockEnv.dev = false; Object.keys(mockMenus).forEach((k) => delete mockMenus[k]); });

describe('the table name in the three dots menu', () => {
  it('DEV_ENVIRONMENT: the table name (the entity) is the LAST item, after Export and Share', () => {
    mockEnv.dev = true;
    mount();
    press(`${T}-more`);
    const items = mockMenus[`${T}-more-menu`];
    expect(items.map((i) => i.testID)).toEqual([`${T}-more-export`, `${T}-more-share`, `${T}-more-table-name`]);
    expect(items[items.length - 1].label).toBe('thing');
  });
  it('a press copies the table name to the clipboard', () => {
    mockEnv.dev = true;
    mount();
    press(`${T}-more`);
    act(() => { mockMenus[`${T}-more-menu`].find((i) => i.testID === `${T}-more-table-name`).onPress(); });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('thing');
  });
  it('any other environment: Export and Share only', () => {
    mount();
    press(`${T}-more`);
    expect(mockMenus[`${T}-more-menu`].map((i) => i.testID)).toEqual([`${T}-more-export`, `${T}-more-share`]);
  });
});

describe('barMenuItems: more commands in the three dots menu (the lines of a task: Save to template / Fill from template)', () => {
  it('they come after Export and Share and before the table name; a press closes the menu first and then runs', () => {
    mockEnv.dev = true;
    const run = jest.fn();
    mount({ barMenuItems: (close: () => void) => [{ testID: 'x-save', label: 'Save to template', icon: 'library_add', onPress: () => { close(); run('save'); } }, { testID: 'x-fill', label: 'Fill from template', icon: 'content_paste_go', onPress: () => run('fill') }] });
    press(`${T}-more`);
    expect(mockMenus[`${T}-more-menu`].map((i) => i.testID)).toEqual([`${T}-more-export`, `${T}-more-share`, 'x-save', 'x-fill', `${T}-more-table-name`]);
    act(() => { mockMenus[`${T}-more-menu`].find((i) => i.testID === 'x-save').onPress(); });
    expect(run).toHaveBeenCalledWith('save');
  });
  it('without the prop the menu is as before', () => {
    mount();
    press(`${T}-more`);
    expect(mockMenus[`${T}-more-menu`]).toHaveLength(2);
  });
});
